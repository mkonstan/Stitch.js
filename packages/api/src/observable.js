"use strict";

const { createReactiveFactory, createComputedMarker, getDefaultFactory, resetDefaultFactory } = require("./reactive-factory");
const { MessageBus } = require("../../core/src/message-bus");
const runtimeHelpers = require("../../utils/src/runtime-helpers");
const { defineHidden } = require("../../utils/src/reactive-object-helpers");

const Version = "v2.1.0";
const getProperty = runtimeHelpers.getProperty;
class Observable {
    /**
     * Creates reactive object with eager conversion.
     * Handles computed properties and adds Message Bus API.
     *
     * ⭐ OPTION 7 REFACTOR: Simplified to just call reactive() which handles everything.
     *
     * @param {Object} data - Data object to make reactive
     * @param {Object} [options={}] - Options
     * @param {boolean} [options.isolated] - If true, creates an isolated ReactiveSystem instead of using the shared singleton
     * @param {boolean} [options.debug] - Enable debug logging for this instance
     * @returns {Object} Reactive proxy
     * @example
     * // Basic reactive object
     * const model = Stitch.Observable.create({
     *     count: 0,
     *     message: 'Hello'
     * });
     * model.count++; // Triggers reactivity
     *
     * @example
     * // With computed properties at any nesting level
     * const model = Stitch.Observable.create({
     *     firstName: 'John',
     *     lastName: 'Doe',
     *     fullName: Stitch.computed(function() {
     *         return `${this.firstName} ${this.lastName}`;
     *     }),
     *     user: {
     *         firstName: 'Jane',
     *         lastName: 'Smith',
     *         fullName: Stitch.computed(function() {
     *             return `${this.firstName} ${this.lastName}`;
     *         })
     *     }
     * });
     * console.log(model.fullName); // "John Doe"
     * console.log(model.user.fullName); // "Jane Smith" (nested computed works!)
     *
     * @example
     * // Message Bus API
     * const model = Stitch.Observable.create({ count: 0 });
     * model.$watch('count', (newVal, oldVal) => {
     *     console.log(`Count: ${oldVal} → ${newVal}`);
     * });
     * model.count = 5; // Triggers handler
     */
    static create(data, options = {}) {
        if (!data || typeof data !== "object") {
            throw new Error("Observable.create() requires an object as input");
        }
        if (data.__isReactive && data._factory) {
            throw new Error("Observable.create() received an already-reactive object. Use the existing proxy or pass a plain object.");
        }

        const factory = options.isolated ? createReactiveFactory() : getDefaultFactory();

        // ⭐ OPTION 7 KEY CHANGE: Just call reactive() - it handles EVERYTHING
        // No more manual computed extraction, no more manual descriptor wrapping
        // Single source of truth: reactive()
        const reactiveData = factory.reactive(data, new WeakSet);

        // Add factory reference
        defineHidden(reactiveData, "_factory", factory);

        // Per-model MessageBus for user-facing event API ($on/$emit/$off/$once/$use).
        // Each model gets its own bus so events don't leak across unrelated observables.
        // The shared factory's reactiveSystem.messageBus handles internal framework events
        // (nested-change, array-mutation) which are already payload-scoped.
        const modelBus = new MessageBus({ version: Version });

        // Add Message Bus API
        const messageBusMethods = {
            $on: function (event, callback) {
                return modelBus.subscribe(event, callback);
            },
            $use: function (middleware) {
                return modelBus.use(middleware);
            },
            $off: function (event, callback) {
                modelBus.unsubscribe(event, callback);
            },
            $emit: function (event, payload) {
                modelBus.publish(event, payload);
            },
            $once: function (event, callback) {
                const unsubscribe = modelBus.subscribe(event, payload => {
                    callback(payload);
                    unsubscribe();
                });
                return unsubscribe;
            }
        };
        for (const [name, fn] of Object.entries(messageBusMethods)) {
            defineHidden(reactiveData, name, fn);
        }

        // $watch remains separate due to closure over previousValue
        defineHidden(reactiveData, "$watch", function (property, callback, options = {}) {
            let previousValue = getProperty(reactiveData, property);

            // Create effect that tracks the property
            return factory.reactiveSystem.effect(() => {
                const currentValue = getProperty(reactiveData, property);

                // Call callback if value changed
                if (currentValue !== previousValue) {
                    callback(currentValue, previousValue, {
                        key: property,
                        newValue: currentValue,
                        oldValue: previousValue,
                        target: reactiveData
                    });
                    previousValue = currentValue;
                }
            }, {
                batch: options.batch !== undefined ? options.batch : false  // Immediate by default
            });
        });

        if (options.debug) {
            reactiveData.on(change => {
                console.log(`[Stitch.js ${Version} Debug] ${change.field}:`, change.oldValue, "->", change.newValue);
            });
        }

        return reactiveData;
    }

    /**
     * Creates reactive array with all mutations tracked.
     *
     * @param {Array} [items=[]] - Initial array items
     * @param {Object} [options={}] - Options
     * @param {boolean} [options.isolated] - If true, creates an isolated ReactiveSystem instead of using the shared singleton
     * @returns {Proxy} Reactive Proxy
     * @example
     * const list = Stitch.Observable.createArray([1, 2, 3]);
     * list.push(4); // Triggers reactivity
     * list[0] = 10; // Triggers reactivity
     */
    static createArray(items = [], options = {}) {
        if (!Array.isArray(items)) {
            throw new Error("Observable.createArray() requires an array as input");
        }
        const factory = options.isolated ? createReactiveFactory() : getDefaultFactory();
        const reactiveArray = factory.reactive([...items], new WeakSet);
        defineHidden(reactiveArray, "_factory", factory);
        return reactiveArray;
    }

    /**
     * Makes existing object reactive. Eager conversion of entire tree.
     *
     * @param {Object} obj - Object to make reactive
     * @param {Object} [options={}] - Options
     * @param {boolean} [options.isolated] - If true, creates an isolated ReactiveSystem instead of using the shared singleton
     * @returns {Object} Reactive object
     */
    static reactive(obj, options = {}) {
        if (obj && obj.__isReactive) {
            return obj;
        }
        const factory = options.isolated ? createReactiveFactory() : getDefaultFactory();
        const reactiveObj = factory.reactive(obj, new WeakSet);
        defineHidden(reactiveObj, "_factory", factory);
        return reactiveObj;
    }

    /**
     * Creates computed property marker for Observable.create().
     * Supports function or {get, deps} syntax.
     *
     * ⭐ OPTION 7 REFACTOR: Returns standardized marker that reactive() will detect.
     *
     * ⚠️ ACCESSING COMPUTED PROPERTIES: Computed properties are GETTERS, not functions.
     * Always access as properties, never call as functions.
     *
     * @param {Function|Object} config - Compute function or config object
     * @returns {Object} Computed marker
     * @example
     * // Function syntax (automatic dependency tracking)
     * const model = Stitch.Observable.create({
     *     firstName: 'John',
     *     lastName: 'Doe',
     *     fullName: Stitch.computed(function() {
     *         return `${this.firstName} ${this.lastName}`;
     *     })
     * });
     *
     * // ✅ CORRECT: Access as property (getter)
     * console.log(model.fullName);  // "John Doe"
     *
     * // ❌ WRONG: Don't call as function
     * console.log(model.fullName());  // Error: fullName is not a function
     *
     * @example
     * // Object syntax (explicit dependencies)
     * const model = Stitch.Observable.create({
     *     count: 0,
     *     multiplier: 2,
     *     result: Stitch.computed({
     *         get() { return this.count * this.multiplier; },
     *         deps: ['count', 'multiplier']
     *     })
     * });
     *
     * // Access as property, not function
     * console.log(model.result);  // 0
     * model.count = 5;
     * console.log(model.result);  // 10
     */
    static computed(config) {
        return createComputedMarker(config, Version);
    }

    /**
     * Checks if object is reactive.
     *
     * @param {*} obj - Object to check
     * @returns {boolean} true if reactive, false otherwise
     */
    static isReactive(obj) {
        return obj && typeof obj === "object" && obj.__isReactive === true;
    }

    /**
     * Unwraps reactive object to plain object.
     * Calls toJSON() internally.
     *
     * @param {Object} reactiveObj - Reactive object
     * @returns {Object} Plain object
     */
    static toRaw(reactiveObj) {
        if (!Observable.isReactive(reactiveObj)) {
            return reactiveObj;
        }
        return reactiveObj.toJSON ? reactiveObj.toJSON() : reactiveObj;
    }

    /**
     * Resets the shared ReactiveSystem, clearing all shared state.
     * Primarily for testing. Creates a fresh system on next Observable.create().
     * Existing observables retain their old factory; only new observables use the new one.
     */
    static reset() {
        resetDefaultFactory();
    }
}
function computed(config) {
    return Observable.computed(config);
}

module.exports = {
    Observable,
    computed
};
