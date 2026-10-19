"use strict";

const { createReactiveFactory, createComputedMarker, getDefaultFactory, resetDefaultFactory } = require("./reactive-factory");
const runtimeHelpers = require("../../utils/src/runtime-helpers");
const { defineHidden } = require("../../utils/src/reactive-object-helpers");

const { VERSION } = require("../../utils/src/version");

const Version = `v${VERSION}`;
const getProperty = runtimeHelpers.getProperty;

/** "user", "rows[2].meta": where obj sits in its model (from its parent links). */
function modelPathOf(obj) {
    const parts = [];
    const seen = new Set();
    let current = obj;
    while (current && current._parent && current._parent.obj && !seen.has(current)) {
        seen.add(current);
        parts.unshift(current._parent.key);
        current = current._parent.obj;
    }
    return parts.reduce((text, part) => /^\d+$/.test(String(part)) ? `${text}[${part}]` : (text ? `${text}.${part}` : String(part)), "");
}

/** Throws when obj is a reactive object inside a model (not a root of its own). */
function refuseNested(method, obj) {
    if (obj && obj.__isReactive && !Object.prototype.hasOwnProperty.call(obj, "_factory")) {
        throw new Error(
            `[Stitch.js ${Version}] ${method}(): "${modelPathOf(obj) || "this object"}" already belongs to a model; use the root model ` +
            "(events, change handlers and bindings live there), or Observable.toRaw() it to make a separate model from a copy."
        );
    }
}

/** A deep plain copy: reactive objects, arrays, Maps and Sets become plain ones; computeds become values. */
function toPlain(value, seen) {
    if (value === null || typeof value !== "object") return value;
    if (seen.has(value)) return seen.get(value);
    if (value instanceof Date) return new Date(value.getTime());
    if (Array.isArray(value)) {
        const out = [];
        seen.set(value, out);
        for (let i = 0; i < value.length; i++) out.push(toPlain(value[i], seen));
        return out;
    }
    if (value instanceof Map) {
        const out = new Map();
        seen.set(value, out);
        value.forEach((v, k) => out.set(k, toPlain(v, seen)));
        return out;
    }
    if (value instanceof Set) {
        const out = new Set();
        seen.set(value, out);
        value.forEach(v => out.add(toPlain(v, seen)));
        return out;
    }
    const proto = Object.getPrototypeOf(value);
    if (!value.__isReactive && proto !== Object.prototype && proto !== null) {
        return value; // a class instance that is not model data: kept as is
    }
    const out = {};
    seen.set(value, out);
    for (const key of Object.keys(value)) {
        if (key[0] === "_") continue;
        out[key] = toPlain(value[key], seen);
    }
    return out;
}

// The options Observable.create / createArray / reactive accept. Anything else throws,
// rather than being ignored (v2's { debug: true } is gone: there is no debug mode).
const KNOWN_OPTIONS = ["isolated"];
function checkOptions(method, options) {
    if (options === null || typeof options !== "object") {
        throw new TypeError(`[Stitch.js ${Version}] ${method}(data, options): options must be an object, got ${options === null ? "null" : typeof options}.`);
    }
    for (const key of Object.keys(options)) {
        if (KNOWN_OPTIONS.indexOf(key) === -1) {
            const hint = key === "debug"
                ? " There is no debug mode in v3: mistakes throw (or go to Stitch.onError), and Stitch.onBindReport lists what bind() did."
                : "";
            throw new Error(`[Stitch.js ${Version}] ${method}(): unknown option "${key}". Known options: ${KNOWN_OPTIONS.join(", ")}.${hint}`);
        }
    }
}
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
        checkOptions("Observable.create", options);
        if (data.__isReactive && Object.prototype.hasOwnProperty.call(data, "_factory")) {
            throw new Error("Observable.create() received an already-reactive object. Use the existing proxy or pass a plain object.");
        }
        refuseNested("Observable.create", data);

        const factory = options.isolated ? createReactiveFactory() : getDefaultFactory();

        // ⭐ OPTION 7 KEY CHANGE: Just call reactive() - it handles EVERYTHING
        // No more manual computed extraction, no more manual descriptor wrapping
        // Single source of truth: reactive()
        const reactiveData = factory.reactive(data, new WeakSet);

        // Add factory reference
        defineHidden(reactiveData, "_factory", factory);

        // $on / $off / $emit / $once / $use / $get / $set come from the factory: every model
        // object has them (D28), each with its own event bus, created on first use.

        // $watch remains separate due to closure over previousValue
        defineHidden(reactiveData, "$watch", function (property, callback, options = {}) {
            runtimeHelpers.assertPathExists(reactiveData, property, `$watch("${property}")`);
            if (typeof callback !== "function") {
                throw new TypeError(`[Stitch.js ${Version}] $watch("${property}", callback): callback must be a function, got ${typeof callback}.`);
            }
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
                batch: options.batch !== undefined ? options.batch : false,  // Immediate by default
                errorContext: { source: "watch", property }
            });
        });

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
        checkOptions("Observable.createArray", options);
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
        checkOptions("Observable.reactive", options);
        refuseNested("Observable.reactive", obj);
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
        return toPlain(reactiveObj, new Map());
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
