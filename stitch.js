/*! Stitch.js v2.1.0 | MIT License | https://github.com/user/Stitch.js */

/*! STITCH_ASSEMBLY_METADATA {"source":"stitch.entry.js","mode":"reachable","availableModuleCount":24,"moduleCount":24,"modules":["packages/api/index.js","packages/api/src/observable.js","packages/api/src/reactive-factory.js","packages/browser/index.js","packages/browser/src/binding-runtime.js","packages/browser/src/binding-scan-helpers.js","packages/browser/src/data-binder.js","packages/browser/src/foreach-binding-orchestrator.js","packages/core/index.js","packages/core/src/batch-scheduler.js","packages/core/src/computed-ref.js","packages/core/src/message-bus.js","packages/core/src/reactive-system.js","packages/utils/index.js","packages/utils/src/attr-value-handlers.js","packages/utils/src/debug-config.js","packages/utils/src/foreach-keys.js","packages/utils/src/foreach-row-context.js","packages/utils/src/reactive-object-helpers.js","packages/utils/src/reactive-stats.js","packages/utils/src/runtime-helpers.js","packages/utils/src/type-converters.js","packages/utils/src/value-binding-helpers.js","packages/utils/src/version.js"],"moduleMap":{"0":"packages/api/index.js","1":"packages/api/src/observable.js","2":"packages/api/src/reactive-factory.js","3":"packages/browser/index.js","4":"packages/browser/src/binding-runtime.js","5":"packages/browser/src/binding-scan-helpers.js","6":"packages/browser/src/data-binder.js","7":"packages/browser/src/foreach-binding-orchestrator.js","8":"packages/core/index.js","9":"packages/core/src/batch-scheduler.js","10":"packages/core/src/computed-ref.js","11":"packages/core/src/message-bus.js","12":"packages/core/src/reactive-system.js","13":"packages/utils/index.js","14":"packages/utils/src/attr-value-handlers.js","15":"packages/utils/src/debug-config.js","16":"packages/utils/src/foreach-keys.js","17":"packages/utils/src/foreach-row-context.js","18":"packages/utils/src/reactive-object-helpers.js","19":"packages/utils/src/reactive-stats.js","20":"packages/utils/src/runtime-helpers.js","21":"packages/utils/src/type-converters.js","22":"packages/utils/src/value-binding-helpers.js","23":"packages/utils/src/version.js"}} */

(function(root){
  var __stitchModuleFactories = Object.create(null);
  __stitchModuleFactories[0] = function(module, exports, __stitchRequire){
"use strict";

const { VERSION } = __stitchRequire(23);
const { createReactiveFactory } = __stitchRequire(2);
const { Observable, computed } = __stitchRequire(1);

module.exports = {
    Observable,
    computed,
    version: VERSION,
    createReactiveFactory,
    ExtractedObservable: Observable,
    extractedComputed: computed
};

  };
  __stitchModuleFactories[1] = function(module, exports, __stitchRequire){
"use strict";

const { createReactiveFactory, createComputedMarker, getDefaultFactory, resetDefaultFactory } = __stitchRequire(2);
const { MessageBus } = __stitchRequire(11);
const runtimeHelpers = __stitchRequire(20);
const { defineHidden } = __stitchRequire(18);

const { VERSION } = __stitchRequire(23);

const Version = `v${VERSION}`;
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

  };
  __stitchModuleFactories[2] = function(module, exports, __stitchRequire){
"use strict";

const { ReactiveSystem } = __stitchRequire(12);
const { ComputedRef } = __stitchRequire(10);
const runtimeHelpers = __stitchRequire(20);
const objectHelpers = __stitchRequire(18);
const { NOOP_DEBUG } = __stitchRequire(15);
const { VERSION } = __stitchRequire(23);
const defineHidden = objectHelpers.defineHidden;

/**
 * Creates a standardized computed property marker.
 * Shared validation/marker-creation logic used by both Observable.computed()
 * and the factory's computed() function.
 *
 * @param {Function|Object} config - Compute function or config object
 * @param {string} version - Version string for error messages
 * @returns {Object} Computed marker { __isStitchComputed, fn, __explicitDeps }
 */
function createComputedMarker(config, version) {
    let fn, explicitDeps;
    if (typeof config === "function") {
        fn = config;
        explicitDeps = null;
    } else if (typeof config === "object" && config.get) {
        fn = config.get;
        explicitDeps = config.deps || null;
        if (explicitDeps && !Array.isArray(explicitDeps)) {
            throw new Error(`[Stitch.js ${version}] Stitch.computed() deps must be an array of property names.\n` + `Example: Stitch.computed({ get() { ... }, deps: ['prop1', 'prop2'] })`);
        }
    } else {
        throw new Error(`[Stitch.js ${version}] Stitch.computed() expects either:\n` + `  - A function: Stitch.computed(function() { ... })\n` + `  - An object: Stitch.computed({ get() { ... }, deps: [...] })`);
    }

    return {
        __isStitchComputed: true,
        fn: fn,
        __explicitDeps: explicitDeps
    };
}
function createReactiveFactory(options = {}) {
    const Version = options.version || `v${VERSION}`;
    const StitchDebug = options.debug || NOOP_DEBUG;
    const ReactiveSystemClass = options.ReactiveSystem || ReactiveSystem;
    const ComputedRefClass = options.ComputedRef || ComputedRef;
    const isArrowFunction = options.isArrowFunction || runtimeHelpers.isArrowFunction;
    const setProperty = options.setProperty || runtimeHelpers.setProperty;
    const getProperty = options.getProperty || runtimeHelpers.getProperty;
    const addChangeHandler = options.addChangeHandler || objectHelpers.addChangeHandler;
    const removeChangeHandler = options.removeChangeHandler || objectHelpers.removeChangeHandler;
    const toJSON = options.toJSON || objectHelpers.toJSON;
    // ReactiveSystem will be created after bubbleChangeUp is defined
    let reactiveSystem;
    /** @type {WeakMap<object, object>} Raw object/collection -> reactive proxy cache */
    const proxyMap = new WeakMap();

    /**
     * Adds parent metadata once for nested change bubbling.
     * Collection/object targets are non-configurable after first define.
     *
     * @param {Object} target - Reactive target object
     * @param {Object|null} parent - Parent object
     * @param {string|number|null} key - Property key in parent
     */
    function attachParent(target, parent, key) {
        if (parent && key !== null && key !== undefined && !target._parent) {
            defineHidden(target, "_parent", { obj: parent, key: key });
        }
    }

    /**
     * Resolves Set membership key so raw object lookups match proxied storage.
     * If object has already been proxied, use cached proxy for has/delete tracking.
     *
     * @param {*} value - Raw or reactive value
     * @returns {*} Normalized value for Set operations
     */
    function normalizeSetLookup(value) {
        if (value && typeof value === "object" && !value.__isReactive) {
            return proxyMap.get(value) || value;
        }
        return value;
    }

    /**
     * Recursively bubbles changes to parent objects.
     * Publishes 'nested-change' events for parent notification.
     * 
     * OPTIMIZED: Iterative traversal + Conditional publishing.
     * Prevents event spam in deep trees when no one is listening.
     *
     * @param {Object} target - Child object that changed
     * @param {string} key - Property key that changed
     * @param {*} oldValue - Previous value
     * @param {*} newValue - New value
     */
    function bubbleChangeUp(target, key, oldValue, newValue) {
        let current = target;
        let currentKey = key;
        
        // Iterative traversal to prevent stack overflow on deep objects
        while (current._parent && current._parent.obj) {
            const parent = current._parent.obj;
            const parentKey = current._parent.key;
            const fullPath = `${parentKey}.${currentKey}`;
            
            // Optimization: Only publish if parent has handlers OR global wildcard listeners exist
            // This avoids creating 100s of events for deep updates that no one cares about
            if ((parent._changeHandlers && parent._changeHandlers.size > 0) || 
                (reactiveSystem.messageBus.subscribers.has("*"))) {
                
                reactiveSystem.messageBus.publish("nested-change", {
                    parent: parent,
                    parentKey: parentKey,
                    childKey: currentKey,
                    oldValue: oldValue,
                    newValue: newValue,
                    fullPath: fullPath
                });
            }
            
            // Move up the tree
            current = parent;
            currentKey = fullPath;
        }
    }

    // Now create ReactiveSystem with bubbleChangeUp dependency
    reactiveSystem = new ReactiveSystemClass(bubbleChangeUp, { version: Version, debug: StitchDebug });

    /**
     * Returns property descriptor with reactive get/set.
     * Tracks access and triggers changes.
     * Rejects arrow functions (cannot access 'this').
     * 
     * @param {Object} target - Target object
     * @param {string} key - Property key
     * @param {Object} internal - Internal storage object
     * @returns {Object} Property descriptor
     */
    function createReactiveDescriptor(target, key, internal) {
        return {
            enumerable: true,
            configurable: true,
            get() {
                reactiveSystem.track(target, key);
                StitchDebug.enabled && StitchDebug.log("reactivity", `⬆️ GET: ${reactiveSystem._getObjectId(target)}.${String(key)}`, {
                    value: internal[key],
                    hasEffect: !!reactiveSystem.currentEffect,
                    effectId: reactiveSystem.currentEffect?.id
                });
                return internal[key];
            },
            set(newValue) {
                const oldValue = internal[key];
                if (oldValue === newValue) {
                    StitchDebug.enabled && StitchDebug.log("reactivity", `SET SKIPPED (no change): ${reactiveSystem._getObjectId(target)}.${String(key)} = ${newValue}`);
                    return;
                }
                StitchDebug.enabled && StitchDebug.log("reactivity", `⬇️ SET: ${reactiveSystem._getObjectId(target)}.${String(key)}`, {
                    oldValue: oldValue,
                    newValue: newValue
                });
                if (typeof newValue === "function" && isArrowFunction(newValue)) {
                    throw new Error(`Stitch.js ${Version}: Cannot set arrow function on property '${String(key)}'\n\n` + `Arrow functions cannot access reactive properties via 'this'.\n` + `Use regular function or ES6 method shorthand instead.`);
                }
                newValue = makeDeepReactive(newValue, target, key);
                internal[key] = newValue;
                reactiveSystem.trigger(target, key, oldValue, newValue);
                bubbleChangeUp(target, key, oldValue, newValue);
            }
        };
    }

    /**
     * Creates computed property descriptor with synchronous invalidation.
     *
     * ⭐ KEY CHANGE FROM V1: Uses ComputedRef class instead of effect with scheduler.
     * Computed invalidation is now SYNCHRONOUS, evaluation is still LAZY.
     *
     * @param {Object} target - Target object
     * @param {string} key - Property key
     * @param {Function} computeFn - Compute function
     * @param {Array<string>} [explicitDeps=null] - Explicit dependencies
     * @returns {Object} Property descriptor with getter/setter
     */
    function createComputedDescriptor(target, key, computeFn, explicitDeps = null) {
        // Create ComputedRef instance
        const computedRef = new ComputedRefClass(
            computeFn,
            reactiveSystem,
            target,
            explicitDeps
        );

        if (explicitDeps) {
            StitchDebug.enabled && StitchDebug.log("computed", `COMPUTED DESCRIPTOR CREATED for ${String(key)} with explicit deps`, {
                deps: explicitDeps
            });
        } else {
            StitchDebug.enabled && StitchDebug.log("computed", `COMPUTED DESCRIPTOR CREATED for ${String(key)}`);
        }

        return {
            enumerable: true,
            configurable: false,
            get() {
                // Delegate to ComputedRef
                return computedRef.get();
            },
            set() {
                throw new Error(`[Stitch.js ${Version}] Cannot set computed property '${String(key)}'`);
            }
        };
    }

    /**
     * Recursively makes nested objects/arrays reactive.
     * Preserves existing reactive objects.
     * 
     * @param {*} value - Value to make reactive
     * @param {Object} parent - Parent object
     * @param {string} key - Property key
     * @returns {*} Reactive value or original if primitive
     */
    function makeDeepReactive(value, parent, key) {
        if (value === null || typeof value !== "object") {
            return value;
        }
        if (value.__isReactive) {
            return value;
        }
        if (Array.isArray(value)) {
            return createReactiveArray(value, parent, key);
        }
        return reactive(value, new WeakSet, parent, key);
    }

    /**
     * Makes object reactive via Object.defineProperty.
     * Detects and rejects arrow functions (cannot bind 'this').
     * 
     * ⭐ OPTION 7 REFACTOR: This function NOW handles computed properties at ALL nesting levels.
     * Single source of truth for ALL reactivity concerns.
     * 
     * @param {Object} obj - Object to make reactive
     * @param {WeakSet} [seen=new WeakSet] - Circular reference detection
     * @param {Object|null} [parent=null] - Parent object for change bubbling
     * @param {string|null} [key=null] - Property key in parent
     * @returns {Object} Reactive object
     */
    function reactive(obj, seen = new WeakSet, parent = null, key = null) {
        if (obj === null || typeof obj !== "object") {
            return obj;
        }
        if (obj.__isReactive) {
            return obj;
        }

        // Return cached proxy for collections to preserve identity:
        // reactive(raw) === reactive(raw)
        const cachedProxy = proxyMap.get(obj);
        if (cachedProxy) {
            attachParent(obj, parent, key);
            return cachedProxy;
        }

        if (seen.has(obj)) {
            return obj;
        }
        seen.add(obj);
        
        if (obj instanceof Map) {
            return createReactiveMap(obj, parent, key);
        }
        if (obj instanceof Set) {
            return createReactiveSet(obj, parent, key);
        }
        
        // Arrow function validation
        for (const [childKey, value] of Object.entries(obj)) {
            if (typeof value === "function" && isArrowFunction(value)) {
                throw new Error(`Stitch.js ${Version}: Arrow function detected in property '${childKey}'\n\n` + `Arrow functions cannot access reactive properties via 'this'.\n` + `They use lexical 'this' binding which cannot be changed.\n\n` + `Convert to regular function or ES6 method shorthand:\n` + `  ❌ ${childKey}: () => { return this.someValue; }\n` + `  ✅ ${childKey}() { return this.someValue; }\n` + `  ✅ ${childKey}: function() { return this.someValue; }\n\n` + `Learn more: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Functions/Arrow_functions`);
            }
        }
        
        // ⭐ OPTION 7 KEY CHANGE: Separate computed properties from regular properties
        const computedProps = new Map();
        const regularProps = {};
        
        for (const [childKey, value] of Object.entries(obj)) {
            // Detect computed properties (standardized marker)
            if (value && typeof value === "object" && value.__isStitchComputed) {
                StitchDebug.enabled && StitchDebug.log("computed", `Found computed property at: ${childKey}`, {
                    hasExplicitDeps: !!value.__explicitDeps
                });
                computedProps.set(childKey, value);
            } else {
                regularProps[childKey] = value;
            }
        }
        
        // Make nested objects reactive (only regular properties)
        for (const [childKey, value] of Object.entries(regularProps)) {
            if (value && typeof value === "object" && !value.__isReactive) {
                regularProps[childKey] = makeDeepReactive(value, obj, childKey);
            }
        }
        
        // Replace original object properties with processed ones
        for (const childKey in obj) {
            if (obj.hasOwnProperty(childKey)) {
                delete obj[childKey];
            }
        }
        Object.assign(obj, regularProps);
        
        // Handle arrays
        if (Array.isArray(obj)) {
            return createReactiveArray(obj, parent, key);
        }
        
        // ⭐ OPTION 7 KEY CHANGE: Pass computed properties to createReactiveObject
        return createReactiveObject(obj, parent, key, computedProps);
    }

    /**
     * Core object reactivity using Object.defineProperty.
     * Adds metadata: _changeHandlers, __isReactive, _parent.
     * Defines reactive descriptors for all properties.
     * 
     * ⭐ OPTION 7 REFACTOR: Now accepts computedProps Map parameter.
     * Handles computed properties uniformly regardless of nesting level.
     * 
     * @param {Object} target - Object to make reactive
     * @param {Object|null} [parent=null] - Parent object
     * @param {string|null} [key=null] - Property key in parent
     * @param {Map} [computedProps=new Map()] - Map of computed properties
     * @returns {Object} Reactive object with descriptors
     */
    function createReactiveObject(target, parent = null, key = null, computedProps = new Map()) {
        // Add metadata
        if (!target._changeHandlers) {
            defineHidden(target, "_changeHandlers", new Set);
        }
        if (StitchDebug.enabled && !target.__stitchId) {
            defineHidden(target, "__stitchId", `obj_${Math.random().toString(36).substr(2, 9)}`);
        }
        attachParent(target, parent, key);
        defineHidden(target, "__isReactive", true);
        
        const internal = {};
        const propertyDescriptors = {};
        
        // Process regular properties
        const keys = Object.keys(target).filter(k => !computedProps.has(k));
        keys.forEach(propKey => {
            const value = target[propKey];
            if (propKey.startsWith("_") || propKey === "on" || propKey === "off") {
                return;
            }
            
            internal[propKey] = value;
            propertyDescriptors[propKey] = createReactiveDescriptor(target, propKey, internal);
        });
        
        // ⭐ OPTION 7 KEY CHANGE: Process computed properties
        computedProps.forEach((computedMarker, propKey) => {
            StitchDebug.enabled && StitchDebug.log("computed", `Creating computed descriptor for: ${propKey}`, {
                hasExplicitDeps: !!computedMarker.__explicitDeps
            });
            
            // Extract function and explicit dependencies
            const computeFn = computedMarker.fn;
            const explicitDeps = computedMarker.__explicitDeps;
            
            // Resolve explicit dependencies if provided
            let resolvedDeps = null;
            if (explicitDeps) {
                resolvedDeps = resolveDependencies(explicitDeps, target);
                StitchDebug.enabled && StitchDebug.log("computed", `Resolved dependencies for "${propKey}":`, {
                    declared: explicitDeps,
                    resolved: resolvedDeps
                });
            }
            
            // Create computed descriptor
            propertyDescriptors[propKey] = createComputedDescriptor(target, propKey, computeFn, resolvedDeps);
        });
        
        Object.defineProperties(target, propertyDescriptors);

        // Add helper methods
        defineHidden(target, "on", addChangeHandler.bind(target));
        defineHidden(target, "off", removeChangeHandler.bind(target));
        defineHidden(target, "set", setProperty.bind(null, target));
        defineHidden(target, "get", getProperty.bind(null, target));
        defineHidden(target, "toJSON", toJSON.bind(target));
        defineHidden(target, "$set", function (key, value) {
            if (this.hasOwnProperty(key) && Object.getOwnPropertyDescriptor(this, key).get) {
                this[key] = value;
            } else {
                const descriptor = createReactiveDescriptor(this, key, internal);
                Object.defineProperty(this, key, descriptor);
                this[key] = value;
            }
        });

        return target;
    }

    /**
     * Shared factory for reactive Map and Set proxies.
     * Handles common proxy infrastructure: cache lookup, metadata setup,
     * and shared traps (__isReactive, _changeHandlers, _parent, on, off,
     * size, clear, iteration methods).
     *
     * Type-specific methods (Map: get/has/set/delete, Set: has/add/delete)
     * are injected via methodOverrides, which is a function receiving
     * (target, reactiveSystem, reactive, bubbleChangeUp) and returning
     * a map of prop -> handler function factories.
     *
     * @param {Map|Set} target - Collection to make reactive
     * @param {Object|null} parent - Parent object
     * @param {string|null} key - Property key in parent
     * @param {Function} methodOverrides - Returns object of prop -> function(target) overrides
     * @returns {Proxy} Reactive collection proxy
     */
    function createReactiveCollection(target, parent, key, methodOverrides) {
        const cachedProxy = proxyMap.get(target);
        if (cachedProxy) {
            attachParent(target, parent, key);
            return cachedProxy;
        }

        if (!target._changeHandlers) {
            defineHidden(target, "_changeHandlers", new Set);
        }
        attachParent(target, parent, key);

        const overrides = methodOverrides(target);

        const proxy = new Proxy(target, {
            get(target, prop, receiver) {
                if (prop === "__isReactive") return true;
                if (prop === "_changeHandlers") return target._changeHandlers;
                if (prop === "_parent") return target._parent;
                if (prop === "on") return addChangeHandler.bind(target);
                if (prop === "off") return removeChangeHandler.bind(target);

                // Track size dependency
                if (prop === "size") {
                    reactiveSystem.track(target, "size");
                    return Reflect.get(target, prop, target);
                }

                const value = Reflect.get(target, prop, receiver);

                if (typeof value === 'function') {
                    // Check type-specific method overrides first
                    if (Object.prototype.hasOwnProperty.call(overrides, prop)) {
                        return overrides[prop];
                    }
                    // Common: clear
                    if (prop === 'clear') {
                        return function() {
                            const oldSize = target.size;
                            if (oldSize > 0) {
                                target.clear();
                                reactiveSystem.trigger(target, "size", oldSize, 0);
                                reactiveSystem.trigger(target, "iteration", null, null);
                                bubbleChangeUp(target, "clear", oldSize, 0);
                            }
                        }
                    }
                    // Common: iteration methods
                    if (['forEach', 'keys', 'values', 'entries', Symbol.iterator].includes(prop)) {
                         reactiveSystem.track(target, "iteration");
                         return value.bind(target);
                    }
                    return value.bind(target);
                }
                return value;
            }
        });
        proxyMap.set(target, proxy);
        return proxy;
    }

    /**
     * Makes Map reactive using Proxy.
     * Thin wrapper over createReactiveCollection with Map-specific methods:
     * get (tracked read), has (tracked membership), set (reactive mutation),
     * delete (reactive removal).
     *
     * @param {Map} target - Map to make reactive
     * @param {Object|null} [parent=null] - Parent object
     * @param {string|null} [key=null] - Property key in parent
     * @returns {Proxy} Reactive Map proxy
     */
    function createReactiveMap(target, parent = null, key = null) {
        return createReactiveCollection(target, parent, key, function(target) {
            return {
                get: function(key) {
                    reactiveSystem.track(target, key);
                    return target.get(key);
                },
                has: function(key) {
                    reactiveSystem.track(target, key);
                    return target.has(key);
                },
                set: function(key, val) {
                    const oldHas = target.has(key);
                    const oldValue = target.get(key);
                    // Make value reactive if object
                    if (val && typeof val === "object" && !val.__isReactive) {
                        val = reactive(val, new WeakSet);
                    }
                    const result = target.set(key, val);
                    if (!oldHas || oldValue !== val) {
                        reactiveSystem.trigger(target, key, oldValue, val);
                        reactiveSystem.trigger(target, "size", target.size, target.size);
                        reactiveSystem.trigger(target, "iteration", null, null);
                        bubbleChangeUp(target, key, oldValue, val);
                    }
                    return result;
                },
                delete: function(key) {
                    const oldHas = target.has(key);
                    const oldValue = target.get(key);
                    const result = target.delete(key);
                    if (oldHas) {
                        reactiveSystem.trigger(target, key, oldValue, undefined);
                        reactiveSystem.trigger(target, "size", target.size + 1, target.size);
                        reactiveSystem.trigger(target, "iteration", null, null);
                        bubbleChangeUp(target, key, oldValue, undefined);
                    }
                    return result;
                }
            };
        });
    }

    /**
     * Makes Set reactive using Proxy.
     * Thin wrapper over createReactiveCollection with Set-specific methods:
     * has (tracked membership with normalizeSetLookup), add (reactive insertion),
     * delete (reactive removal with normalizeSetLookup).
     *
     * @param {Set} target - Set to make reactive
     * @param {Object|null} [parent=null] - Parent object
     * @param {string|null} [key=null] - Property key in parent
     * @returns {Proxy} Reactive Set proxy
     */
    function createReactiveSet(target, parent = null, key = null) {
        return createReactiveCollection(target, parent, key, function(target) {
            return {
                has: function(key) {
                    const normalizedKey = normalizeSetLookup(key);
                    reactiveSystem.track(target, normalizedKey);
                    return target.has(normalizedKey);
                },
                add: function(val) {
                    const oldValue = val;
                    if (val && typeof val === "object" && !val.__isReactive) {
                        val = reactive(val, new WeakSet);
                    }
                    const normalizedVal = normalizeSetLookup(val);
                    const oldHas = target.has(normalizedVal);
                    const result = target.add(normalizedVal);
                    if (!oldHas) {
                        reactiveSystem.trigger(target, normalizedVal, undefined, normalizedVal); // Key is value for Set
                        reactiveSystem.trigger(target, "size", target.size - 1, target.size);
                        reactiveSystem.trigger(target, "iteration", null, null);
                        bubbleChangeUp(target, "add", undefined, oldValue);
                    }
                    return result;
                },
                delete: function(val) {
                    const normalizedVal = normalizeSetLookup(val);
                    const oldHas = target.has(normalizedVal);
                    const result = target.delete(normalizedVal);
                    if (oldHas) {
                        reactiveSystem.trigger(target, normalizedVal, normalizedVal, undefined);
                        reactiveSystem.trigger(target, "size", target.size + 1, target.size);
                        reactiveSystem.trigger(target, "iteration", null, null);
                        bubbleChangeUp(target, "delete", val, undefined);
                    }
                    return result;
                }
            };
        });
    }

    /**
     * Makes array reactive using Proxy.
     * Intercepts mutations: push, pop, shift, unshift, splice, sort, reverse, fill.
     * Publishes 'array-mutation' events for tracking.
     * 
     * @param {Array} target - Array to make reactive
     * @param {Object|null} [parent=null] - Parent object
     * @param {string|null} [key=null] - Property key in parent
     * @returns {Proxy} Reactive array proxy
     */
    function createReactiveArray(target, parent = null, key = null) {
        const cachedProxy = proxyMap.get(target);
        if (cachedProxy) {
            attachParent(target, parent, key);
            return cachedProxy;
        }

        const arrayMethods = ["push", "pop", "shift", "unshift", "splice", "sort", "reverse", "fill"];
        if (!target._changeHandlers) {
            defineHidden(target, "_changeHandlers", new Set);
        }
        attachParent(target, parent, key);

        const proxy = new Proxy(target, {
            get(target, key, receiver) {
                if (key === "__isReactive") return true;
                if (key === "_changeHandlers") return target._changeHandlers;
                if (key === "_parent") return target._parent;
                if (key === "on") return addChangeHandler.bind(target);
                if (key === "off") return removeChangeHandler.bind(target);
                reactiveSystem.track(target, key);
                if (arrayMethods.includes(key)) {
                    return function (...args) {
                        // Only snapshot when indexed deps are actually being tracked.
                        const deps = reactiveSystem.depsMap.get(target);
                        const trackedIndexKeys = [];
                        if (deps) {
                            deps.forEach((depSet, depKey) => {
                                if (depSet && depSet.size > 0 && typeof depKey !== "symbol" && !isNaN(depKey)) {
                                    trackedIndexKeys.push(depKey);
                                }
                            });
                        }
                        const oldSnapshot = trackedIndexKeys.length > 0 ? target.slice() : null;
                        const oldLength = target.length;
                        const result = Array.prototype[key].apply(target, args);

                        // FIX: Trigger synchronously for immediate computed invalidation
                        reactiveSystem.trigger(target, "length", oldLength, target.length);

                        // Trigger only tracked index keys whose values actually changed.
                        // Keeps cost proportional to active dependencies, not array size.
                        if (oldSnapshot) {
                            trackedIndexKeys.forEach(indexKey => {
                                const oldValue = oldSnapshot[indexKey];
                                const newValue = target[indexKey];
                                if (oldValue !== newValue) {
                                    reactiveSystem.trigger(target, indexKey, oldValue, newValue);
                                }
                            });
                        }

                        // Keep MessageBus event for backward compatibility with user listeners
                        reactiveSystem.messageBus.publish("array-mutation", {
                            target: target,
                            method: key,
                            args: args,
                            oldLength: oldLength,
                            newLength: target.length
                        });
                        return result;
                    };
                }
                const value = Reflect.get(target, key, receiver);
                if (typeof key !== "symbol" && !isNaN(key) && value && typeof value === "object" && !value.__isReactive) {
                    const reactiveValue = reactive(value, new WeakSet, receiver, key);
                    target[key] = reactiveValue;
                    return reactiveValue;
                }
                return value;
            },
            set(target, key, value, receiver) {
                const oldValue = target[key];
                if (value && typeof value === "object" && !value.__isReactive) {
                    value = reactive(value, new WeakSet, receiver, key);
                }
                const result = Reflect.set(target, key, value, receiver);
                if (oldValue !== value) {
                    reactiveSystem.trigger(target, key, oldValue, value);
                    bubbleChangeUp(target, key, oldValue, value);
                }
                return result;
            }
        });
        proxyMap.set(target, proxy);
        return proxy;
    }

    /**
     * Creates computed property proxy with lazy evaluation.
     * Supports function or {get, deps} syntax.
     *
     * ⚠️ IMPORTANT - USER ACCESS PATTERN:
     * Users access computed properties as DIRECT GETTERS on the model:
     * ✅ CORRECT:   const name = model.fullName;         // Direct access
     * ✅ CORRECT:   <span s-text="fullName"></span>      // Direct binding
     * ❌ WRONG:     const name = model.fullName.value;   // .value is internal only!
     * ❌ WRONG:     const name = model.fullName();       // Not a function call!
     *
     * @param {Function|Object} config - Compute function or config object
     * @param {Function} [config.get] - Getter function
     * @param {Array<string>} [config.deps] - Explicit dependencies array
     * @returns {Object} Computed marker object
     * 
     * @example
     * // Function syntax
     * const fullName = computed(function() {
     *     return this.firstName + ' ' + this.lastName;
     * });
     * 
     * @example
     * // Explicit dependencies
     * const doubled = computed({
     *     get() { return this.count * 2; },
     *     deps: ['count']
     * });
     */
    function computed(config) {
        return createComputedMarker(config, Version);
    }

    /**
     * Recursively resolves nested computed dependencies.
     * Prevents circular dependencies with visited Set tracking.
     * 
     * @param {Array<string>} deps - Dependency keys to resolve
     * @param {Object} target - Target object containing dependencies
     * @param {Set} [visited=new Set] - Visited keys for circular detection
     * @returns {Array<string>} Resolved dependency keys
     */
    function resolveDependencies(deps, target, visited = new Set) {
        const resolved = new Set;
        for (const depKey of deps) {
            if (visited.has(depKey)) {
                console.warn(`[Stitch.js ${Version}] Circular dependency detected: "${depKey}"\n` + `Dependency chain: ${Array.from(visited).join(" → ")} → ${depKey}`);
                continue;
            }
            visited.add(depKey);
            
            // Check if this dependency is itself a computed property with explicit deps
            const descriptor = Object.getOwnPropertyDescriptor(target, depKey);
            if (descriptor && descriptor.get && target[depKey + '__explicitDeps']) {
                const nestedDeps = target[depKey + '__explicitDeps'];
                const nestedResolved = resolveDependencies(nestedDeps, target, new Set(visited));
                for (const dep of nestedResolved) {
                    resolved.add(dep);
                }
            } else {
                resolved.add(depKey);
            }
            
            visited.delete(depKey);
        }
        return Array.from(resolved);
    }
    
    return {
        reactiveSystem: reactiveSystem,
        reactive: reactive,
        createReactiveArray: createReactiveArray,
        computed: computed,
        resolveDependencies: resolveDependencies,
        bubbleChangeUp: bubbleChangeUp
    };
}
let _defaultFactory = null;

function getDefaultFactory() {
    if (!_defaultFactory) {
        _defaultFactory = createReactiveFactory();
    }
    return _defaultFactory;
}

function resetDefaultFactory() {
    _defaultFactory = null;
}

module.exports = {
    createReactiveFactory,
    createComputedMarker,
    getDefaultFactory,
    resetDefaultFactory
};

  };
  __stitchModuleFactories[3] = function(module, exports, __stitchRequire){
"use strict";

const { VERSION } = __stitchRequire(23);
const foreachBindingOrchestrator = __stitchRequire(7);
const bindingScanHelpers = __stitchRequire(5);
const bindingRuntime = __stitchRequire(4);
const dataBinderFactory = __stitchRequire(6);
const runtimeHelpers = __stitchRequire(20);
const debugConfig = __stitchRequire(15);
const attrValueHandlers = __stitchRequire(14);
const valueBindingHelpers = __stitchRequire(22);
const typeConverters = __stitchRequire(21);
const foreachKeys = __stitchRequire(16);
const foreachRowContext = __stitchRequire(17);

const stitchDebugState = debugConfig.createDebugState(`v${VERSION}`);
const stitchDebug = {
    ...stitchDebugState,
    log() {},
    group() {},
    groupEnd() {}
};

const typeConverterRegistry = typeConverters.createTypeConverters({ version: VERSION });
function getTypeConverter(element, value) {
    return typeConverters.getTypeConverter(element, value, typeConverterRegistry);
}

const valueValidatorRegistry = valueBindingHelpers.createValueValidators({
    getTypeConverter,
    setProperty: runtimeHelpers.setProperty,
    doc: typeof document !== "undefined" ? document : null
});
function getValueValidator(element) {
    return valueBindingHelpers.getValueValidator(element, valueValidatorRegistry);
}

const valueHandlerRegistry = valueBindingHelpers.createValueHandlers({
    getTypeConverter,
    resolveValueValidator: getValueValidator
});
function getValueHandler(element) {
    return valueBindingHelpers.getValueHandler(element, valueHandlerRegistry);
}

const runtimeBinding = bindingRuntime.createBindingRuntime({
    version: VERSION,
    debug: stitchDebug,
    getProperty: runtimeHelpers.getProperty,
    setProperty: runtimeHelpers.setProperty,
    getValueHandler,
    getValueValidator,
    getTypeConverter,
    getAttrHandler: attrValueHandlers.getAttrHandler,
    propertyExists: runtimeHelpers.propertyExists,
    findSimilarProperty: runtimeHelpers.findSimilarProperty,
    bindForeach(element, viewModel, path, context, validateBinding) {
        return foreachBindingOrchestrator.bindForeach(element, viewModel, path, context, {
            validateBinding,
            getProperty: runtimeHelpers.getProperty,
            getValueValidator,
            createItemContext: foreachRowContext.createItemContext,
            resolveRowKeys: foreachKeys.resolveRowKeys,
            version: `v${VERSION}`,
            doc: typeof document !== "undefined" ? document : null
        });
    }
});

const DataBinder = dataBinderFactory.createDataBinderClass({
    version: VERSION,
    debug: stitchDebug,
    getProperty: runtimeHelpers.getProperty,
    getBindingHandler: runtimeBinding.getBindingHandler,
    scanCustomAttributes: runtimeBinding.scanCustomAttributes,
    bindingHandlers: runtimeBinding.BINDING_HANDLERS
});

module.exports = {
    DataBinder,
    version: VERSION,
    ...foreachBindingOrchestrator,
    ...bindingScanHelpers,
    ...bindingRuntime,
    ...dataBinderFactory
};

  };
  __stitchModuleFactories[4] = function(module, exports, __stitchRequire){
"use strict";

const { NOOP_DEBUG } = __stitchRequire(15);
const { VERSION } = __stitchRequire(23);

function createBindingRuntime(deps = {}) {
    const Version = deps.version || `v${VERSION}`;
    const StitchDebug = deps.debug || NOOP_DEBUG;
    const getProperty = deps.getProperty;
    const setProperty = deps.setProperty;
    const getValueHandler = deps.getValueHandler;
    const getValueValidator = deps.getValueValidator;
    const getTypeConverter = deps.getTypeConverter;
    const getAttrHandler = deps.getAttrHandler;
    const propertyExists = deps.propertyExists;
    const findSimilarProperty = deps.findSimilarProperty;
    const bindForeach = deps.bindForeach;

function validateBinding(viewModel, path, bindingType, element) {
    if (!StitchDebug.enabled) return true;
    if (!propertyExists(viewModel, path)) {
        const suggestion = findSimilarProperty(viewModel, path);
        const availableProps = Object.keys(viewModel).filter(k => !k.startsWith("_")).slice(0, 10);
        console.warn(`[Stitch.js] ${bindingType} binding failed: Property "${path}" not found\n`, {
            element: element.tagName,
            elementId: element.id || "(no id)",
            elementClasses: element.className || "(no classes)",
            expectedProperty: path,
            availableProperties: availableProps,
            totalProperties: Object.keys(viewModel).filter(k => !k.startsWith("_")).length,
            suggestion: suggestion
        });
        return false;
    }
    return true;
}

/**
 * @typedef {Object} BindingHandler
 * @property {Function} bind - Establishes reactive binding
 */

/**
 * BINDING_HANDLERS - Registry of built-in binding handlers implementing Strategy Pattern.
 * 
 * Each handler encapsulates complete binding logic for its type (text, value, visible, etc.),
 * enabling clean two-way data binding, event handling, and list rendering.
 * Supports custom binding registration via DataBinder.registerBinding().
 * 
 * @const {Object.<string, BindingHandler>}
 * @example
 * // Custom binding registration (PUBLIC API)
 * Stitch.DataBinder.registerBinding('tooltip', {
 *     bind(element, viewModel, path, context) {
 *         context.reactiveSystem.effect(() => {
 *             const value = getProperty(viewModel, path);
 *             element.setAttribute('title', value || '');
 *         });
 *     }
 * });
 * // Usage: <button data-tooltip="helpText">Help</button>
 */
const BINDING_HANDLERS = {
    /**
     * text binding - Updates element.textContent reactively.
     * One-way binding from model to view.
     */
    text: {
        bind(element, viewModel, path, context) {
            validateBinding(viewModel, path, "text", element);
            const eff = context.reactiveSystem.effect(() => {
                const value = getProperty(viewModel, path);
                if (typeof value === "function") {
                    console.warn(`[Stitch.js ${Version}] Binding 'text' to a function: "${path}". Did you mean to call it or use a computed property?`);
                }
                element.textContent = value != null ? value : "";
            }, { batch: true });
            context.binder._trackCleanup(element, () => context.reactiveSystem.cleanup(eff));
        }
    },
    /**
     * value binding - Two-way data binding for form inputs with automatic type conversion.
     * Model changes update view, view changes update model.
     */
    value: {
        bind(element, viewModel, path, context) {
            validateBinding(viewModel, path, "value", element);
            StitchDebug.enabled && StitchDebug.log("bindings", `BINDING: value binding (two-way) for "${path}"`, {
                element: element.tagName,
                type: element.type
            });
            const handler = getValueHandler(element);
            const eff = context.reactiveSystem.effect(() => {
                const value = getProperty(viewModel, path);
                StitchDebug.enabled && StitchDebug.log("bindings", `VALUE BINDING UPDATE (Model→View): "${path}" = ${value}`);
                handler.modelToView(element, value, viewModel, path);
            }, { batch: true });
            context.binder._trackCleanup(element, () => context.reactiveSystem.cleanup(eff));
            const updateModel = () => {
                const value = handler.viewToModel(element);
                StitchDebug.enabled && StitchDebug.log("bindings", `VALUE BINDING UPDATE (View→Model): "${path}" = ${value}`);
                const validator = getValueValidator(element);
                const validValue = validator.validate(element, value, viewModel, path, "user-input");
                setProperty(viewModel, path, validValue);
            };
            element.addEventListener("input", updateModel);
            element.addEventListener("change", updateModel);
            context.binder._trackCleanup(element, () => {
                element.removeEventListener("input", updateModel);
                element.removeEventListener("change", updateModel);
            });
        }
    },
    /**
     * visible binding - Shows/hides element by toggling display: none.
     * One-way binding from model to view.
     */
    visible: {
        bind(element, viewModel, path, context) {
            validateBinding(viewModel, path, "visible", element);
            const eff = context.reactiveSystem.effect(() => {
                const value = getProperty(viewModel, path);
                element.style.display = value ? "" : "none";
            }, { batch: true });
            context.binder._trackCleanup(element, () => context.reactiveSystem.cleanup(eff));
        }
    },
    /**
     * enabled binding - Enables/disables element by setting disabled attribute.
     * One-way binding from model to view.
     */
    enabled: {
        bind(element, viewModel, path, context) {
            validateBinding(viewModel, path, "enabled", element);
            const eff = context.reactiveSystem.effect(() => {
                const value = getProperty(viewModel, path);
                element.disabled = !value;
            }, { batch: true });
            context.binder._trackCleanup(element, () => context.reactiveSystem.cleanup(eff));
        }
    },
    /**
     * click binding - Attaches click event handler.
     * Supports $parent context for calling parent methods from foreach loops.
     */
    click: {
        bind(element, viewModel, path, context) {
            validateBinding(viewModel, path, "click", element);
            const clickHandler = e => {
                const handler = getProperty(viewModel, path);
                if (typeof handler === "function") {
                    // UNWRAP: If viewModel is a context wrapper (has $data), pass $data (the original item)
                    // This ensures handlers receive the actual model, not the context wrapper
                    const target = (viewModel && viewModel.$data) ? viewModel.$data : viewModel;
                    
                    if (path.startsWith("$parent.") && viewModel.$data !== undefined) {
                        // Case 1: Calling parent method from child context (e.g. data-click="$parent.remove")
                        // Call on parent, pass target (the item) as first arg, event as second
                        handler.call(viewModel.$parent, target, e);
                    } else {
                        // Case 2: Calling method on self (e.g. data-click="toggle")
                        // Call on target (the item), pass event as first arg
                        handler.call(target, e);
                    }
                }
            };
            element.addEventListener("click", clickHandler);
            context.binder._trackCleanup(element, () => element.removeEventListener("click", clickHandler));
        }
    },
    /**
     * event binding - Generic event handler for any DOM event.
     * Binds multiple event types to handler methods in single declaration.
     *
     * ⚠️ SYNTAX REQUIREMENT: Binding value must be a property path (e.g., "eventBindings"),
     * NOT an inline object literal. Inline objects like data-event="{ click: fn }"
     * will fail because Stitch.js treats all binding values as property paths.
     * Define the object in your model and reference it by property name.
     */
    event: {
        bind(element, viewModel, path, context) {
            validateBinding(viewModel, path, "event", element);
            StitchDebug.enabled && StitchDebug.log("bindings", `EVENT BINDING: "${path}"`, {
                element: element.tagName
            });
            // Track active listeners so each effect run can replace prior registrations.
            const eventListeners = [];
            const removeEventListeners = () => {
                eventListeners.forEach(({ eventName, wrappedHandler }) => {
                    element.removeEventListener(eventName, wrappedHandler);
                });
                eventListeners.length = 0;
            };
            const eff = context.reactiveSystem.effect(() => {
                // Avoid duplicate listeners when effect re-runs.
                removeEventListeners();

                const eventConfig = getProperty(viewModel, path);
                if (!eventConfig || typeof eventConfig !== "object") {
                    console.error(`[Stitch.js ${Version}] event: binding requires an object. Got: ${typeof eventConfig}`);
                    return;
                }
                for (const [eventName, handlerPath] of Object.entries(eventConfig)) {
                    const handler = typeof handlerPath === "string" ? getProperty(viewModel, handlerPath) : handlerPath;
                    if (typeof handler === "function") {
                        StitchDebug.enabled && StitchDebug.log("bindings", `  Registering: ${eventName} → ${handlerPath}`, {
                            event: eventName
                        });
                        const wrappedHandler = e => handler.call(viewModel, e);
                        element.addEventListener(eventName, wrappedHandler);
                        eventListeners.push({ eventName, wrappedHandler });
                    } else {
                        console.warn(`[Stitch.js ${Version}] event: binding handler not found: "${handlerPath}"`);
                    }
                }
            }, { batch: true });
            context.binder._trackCleanup(element, () => {
                removeEventListeners();
                context.reactiveSystem.cleanup(eff);
            });
        }
    },
    /**
     * class binding - Dynamic CSS class management.
     *
     * ⚠️ SYNTAX REQUIREMENT: Binding value must be a property path (e.g., "classBindings"),
     * NOT an inline object literal. Inline objects like data-class="{ active: true }"
     * will fail because Stitch.js treats all binding values as property paths.
     * Define the object in your model and reference it by property name.
     *
     * ⚠️ CRITICAL: String mode replaces ALL classes (destroys framework CSS).
     * ALWAYS use object mode (computed) with elements that have static classes.
     * String mode should only be used when element has NO static classes.
     *
     * Two modes:
     * - String mode: `element.className = value` (replaces all classes - DESTRUCTIVE)
     * - Object mode: `element.classList.toggle()` (selective toggle - PRESERVES unlisted classes)
     *
     * HOW OBJECT MODE PRESERVATION WORKS:
     * Object mode "preserves" classes by simple omission - it ONLY toggles classes
     * that are LISTED in the object. Any class NOT in the object is left untouched.
     * This is NOT "smart preservation" - it's just classList.toggle() not caring about
     * classes it wasn't asked to toggle.
     *
     * @example
     * // ❌ BAD: String mode destroys Bootstrap classes
     * // HTML: <button class="btn btn-primary" data-class="buttonState">
     * // Model: { buttonState: 'active' }
     * // Result: class="active" (btn btn-primary DESTROYED by className assignment)
     *
     * @example
     * // ✅ GOOD: Object mode preserves unlisted classes
     * // HTML: <button class="btn btn-primary" data-class="buttonClasses">
     * // Model: { buttonClasses: computed(function() { return { active: this.isActive }; }) }
     * // Result: class="btn btn-primary active"
     * // Why preserved? Object only lists 'active', so toggle() ignores 'btn' and 'btn-primary'
     *
     * @example
     * // Object mode only affects classes it knows about:
     * // HTML: <div class="foo bar baz" data-class="classes">
     * // Model: { classes: { bar: false, qux: true } }
     * // Result: class="foo baz qux"
     * // - 'foo' preserved (not in object, never touched)
     * // - 'bar' removed (in object, value is false)
     * // - 'baz' preserved (not in object, never touched)
     * // - 'qux' added (in object, value is true)
     */
    class: {
        bind(element, viewModel, path, context) {
            validateBinding(viewModel, path, "class", element);
            StitchDebug.enabled && StitchDebug.log("bindings", `BINDING: class binding for "${path}"`, {
                element: element.tagName,
                initialClasses: Array.from(element.classList)
            });
            const eff = context.reactiveSystem.effect(() => {
                const value = getProperty(viewModel, path);
                StitchDebug.enabled && StitchDebug.log("bindings", `CLASS BINDING UPDATE: "${path}"`, {
                    element: element.tagName,
                    valueType: typeof value,
                    value: value
                });
                if (typeof value === "string") {
                    element.className = value;
                    StitchDebug.enabled && StitchDebug.log("bindings", `  → Set className to: "${value}"`);
                } else if (value && typeof value === "object") {
                    Object.keys(value).forEach(className => {
                        const shouldHaveClass = !!value[className];
                        element.classList.toggle(className, shouldHaveClass);
                        StitchDebug.enabled && StitchDebug.log("bindings", `  → Toggle "${className}": ${shouldHaveClass}`);
                    });
                    StitchDebug.enabled && StitchDebug.log("bindings", `  → Final classList: ${Array.from(element.classList).join(", ")}`);
                }
            }, { batch: true });
            context.binder._trackCleanup(element, () => context.reactiveSystem.cleanup(eff));
        }
    },
    /**
     * attr binding - Dynamic HTML attribute management with type-aware handling.
     *
     * ⚠️ SYNTAX REQUIREMENT: Binding value must be a property path (e.g., "attrBindings"),
     * NOT an inline object literal. Inline objects like data-attr="{ title: 'Text' }"
     * will fail because Stitch.js treats all binding values as property paths.
     * Define the object in your model and reference it by property name.
     *
     * PRESERVATION: Only manages attributes IN binding object.
     * Static HTML attributes NOT in binding remain unchanged.
     *
     * ⚠️ WARNING: If attribute exists in BOTH HTML and binding, binding wins (overwrites static value).
     * 
     * Supports: strings, numbers, booleans, objects (style), arrays (class), null/undefined (removes).
     * 
     * @example
     * // Static attributes preserved
     * // HTML: <input type="text" id="username" placeholder="Enter name" data-attr="dynamicAttrs">
     * // Model: { dynamicAttrs: { 'aria-invalid': true } }
     * // Result: type, id, placeholder preserved; aria-invalid added
     * 
     * @example
     * // Boolean attributes - use actual booleans
     * dynamicAttrs: {
     *     'disabled': true,      // ✅ Sets disabled=""
     *     'required': false,     // ✅ Removes required attribute
     *     'readonly': "false"    // ❌ WRONG: Sets readonly="false" (still readonly!)
     * }
     * 
     * @example
     * // Null/undefined removes attributes
     * dynamicAttrs: {
     *     'title': showTooltip ? tooltipText : null,  // Conditionally remove
     *     'data-id': hasId ? userId : undefined       // Conditionally remove
     * }
     */
    attr: {
        bind(element, viewModel, path, context) {
            validateBinding(viewModel, path, "attr", element);
            const eff = context.reactiveSystem.effect(() => {
                const value = getProperty(viewModel, path);
                if (typeof value === "object" && value !== null) {
                    Object.keys(value).forEach(attrName => {
                        const attrValue = value[attrName];
                        const handler = getAttrHandler(attrValue);
                        handler.apply(element, attrName, attrValue);
                    });
                } else {
                    console.warn(`[Stitch.js ${Version}] attr: binding requires an object value. Example: attr: { href: url, target: "_blank" }`);
                }
            }, { batch: true });
            context.binder._trackCleanup(element, () => context.reactiveSystem.cleanup(eff));
        }
    },
    /**
     * foreach binding - Keyed list rendering (see foreach-binding-orchestrator.js).
     * One implementation for every list element, <select> included.
     * Provides $data, $index, $parent context variables.
     */
    foreach: {
        bind(element, viewModel, path, context) {
            if (typeof bindForeach !== "function") {
                throw new Error(`[Stitch.js ${Version}] foreach binding is not available: createBindingRuntime() was given no bindForeach.`);
            }
            return bindForeach(element, viewModel, path, context, validateBinding);
        }
    },
    /**
     * loading binding - Composite binding for loading states.
     * Sets/removes disabled, toggles 'loading' class, sets aria-busy.
     */
    loading: {
        bind(element, viewModel, path, context) {
            validateBinding(viewModel, path, "loading", element);
            const eff = context.reactiveSystem.effect(() => {
                const isLoading = getProperty(viewModel, path);
                element.disabled = isLoading;
                element.classList.toggle("loading", isLoading);
                element.setAttribute("aria-busy", isLoading ? "true" : "false");
            }, { batch: true });
            context.binder._trackCleanup(element, () => context.reactiveSystem.cleanup(eff));
        }
    }
};

/**
 * Lazily resolves extracted binding-scan helpers in CommonJS environments.
 * Browser script usage keeps local implementations for single-file compatibility.
 *
 * @returns {{getBindingHandler: Function, scanCustomAttributes: Function}|null}
 */
let _externalBindingScanIntegrationAttempted = false;
let _externalBindingScanIntegration = null;
function resolveExternalBindingScanIntegration() {
    if (_externalBindingScanIntegrationAttempted) {
        return _externalBindingScanIntegration;
    }

    _externalBindingScanIntegrationAttempted = true;
    if (typeof module === "undefined" || !module.exports || typeof require !== "function") {
        return null;
    }

    try {
        const bindingScanModule = require("./packages/browser/src/binding-scan-helpers");
        if (bindingScanModule &&
            typeof bindingScanModule.getBindingHandler === "function" &&
            typeof bindingScanModule.scanCustomAttributes === "function") {
            _externalBindingScanIntegration = bindingScanModule;
        } else {
            _externalBindingScanIntegration = null;
        }
    } catch (error) {
        _externalBindingScanIntegration = null;
    }

    return _externalBindingScanIntegration;
}

/**
 * Retrieves binding handler from BINDING_HANDLERS registry by type name.
 * 
 * @param {string} type - Binding type (e.g., 'text', 'value', 'click')
 * @returns {BindingHandler|null} Handler with bind() method, or null if not found
 * @example
 * const handler = getBindingHandler('text');
 * // Returns: BINDING_HANDLERS.text
 */
function getBindingHandler(type) {
    const external = resolveExternalBindingScanIntegration();
    if (external) {
        return external.getBindingHandler(type, BINDING_HANDLERS);
    }
    return BINDING_HANDLERS[type] || null;
}

/**
 * Scans element attributes to find data-* bindings that correspond to registered handlers.
 * Filters out non-binding data-* attributes (like data-template, data-default-text).
 * 
 * @param {HTMLElement} element - Element to scan for binding attributes
 * @returns {Array<Object>} Array of binding objects [{type, path, attributeName}]
 * @example
 * // Single binding
 * // HTML: <div data-text="message"></div>
 * const bindings = scanCustomAttributes(divEl);
 * // Returns: [{ type: 'text', path: 'message', attributeName: 'data-text' }]
 * 
 * @example
 * // Multiple bindings
 * // HTML: <input data-value="count" data-enabled="isActive">
 * const bindings = scanCustomAttributes(inputEl);
 * // Returns: [
 * //   { type: 'value', path: 'count', attributeName: 'data-value' },
 * //   { type: 'enabled', path: 'isActive', attributeName: 'data-enabled' }
 * // ]
 */
function scanCustomAttributes(element) {
    const external = resolveExternalBindingScanIntegration();
    if (external) {
        return external.scanCustomAttributes(element, BINDING_HANDLERS);
    }
    const bindings = [];
    for (const attr of element.attributes) {
        if (attr.name.startsWith("data-")) {
            const type = attr.name.substring(5);
            const handler = getBindingHandler(type);
            if (handler) {
                bindings.push({
                    type: type,
                    path: attr.value,
                    attributeName: attr.name
                });
            }
        }
    }
    return bindings;
}

    return {
        validateBinding,
        BINDING_HANDLERS,
        getBindingHandler,
        scanCustomAttributes,
        resolveExternalBindingScanIntegration
    };
}

module.exports = {
    createBindingRuntime
};

  };
  __stitchModuleFactories[5] = function(module, exports, __stitchRequire){
"use strict";

/**
 * Retrieves a binding handler by type from a handlers registry.
 *
 * @param {string} type
 * @param {Object} handlers
 * @returns {Object|null}
 */
function getBindingHandler(type, handlers) {
    return handlers[type] || null;
}

/**
 * Scans element attributes and returns recognized data-* bindings.
 *
 * @param {HTMLElement} element
 * @param {Object} handlers
 * @returns {Array<{type: string, path: string, attributeName: string}>}
 */
function scanCustomAttributes(element, handlers) {
    const bindings = [];
    for (const attr of element.attributes) {
        if (attr.name.startsWith("data-")) {
            const type = attr.name.substring(5);
            const handler = getBindingHandler(type, handlers);
            if (handler) {
                bindings.push({
                    type: type,
                    path: attr.value,
                    attributeName: attr.name
                });
            }
        }
    }
    return bindings;
}

/**
 * Creates bound helper functions for a specific handlers registry.
 *
 * @param {Object} handlers
 * @returns {{getBindingHandler: Function, scanCustomAttributes: Function}}
 */
function createBindingScanner(handlers) {
    return {
        getBindingHandler(type) {
            return getBindingHandler(type, handlers);
        },
        scanCustomAttributes(element) {
            return scanCustomAttributes(element, handlers);
        }
    };
}

module.exports = {
    getBindingHandler,
    scanCustomAttributes,
    createBindingScanner
};

  };
  __stitchModuleFactories[6] = function(module, exports, __stitchRequire){
"use strict";

const { NOOP_DEBUG } = __stitchRequire(15);
const { VERSION } = __stitchRequire(23);

function createDataBinderClass(deps = {}) {
    const Version = deps.version || `v${VERSION}`;
    const StitchDebug = deps.debug || NOOP_DEBUG;
    const getProperty = deps.getProperty;
    const getBindingHandler = deps.getBindingHandler;
    const scanCustomAttributes = deps.scanCustomAttributes;
    const BINDING_HANDLERS = deps.bindingHandlers || Object.create(null);
class DataBinder {
    /**
     * Creates a new DataBinder instance.
     * 
     * @param {Object} [hooks={}] - Optional lifecycle hooks
     * @param {Function} [hooks.onBind] - Called when element bound
     * @param {Function} [hooks.onChange] - Called when property changes
     * @param {Object} [hooks.properties] - Property-specific hooks
     */
    constructor(hooks = {}) {
        /** @type {Set<HTMLElement>} Bound elements tracking */
        this.boundElements = new Set;
        /** @type {Object} Lifecycle hooks */
        this.hooks = this.createHooks(hooks);
        /** @type {Map<HTMLElement, Set<Function>>} Cleanup functions per element for unbind */
        this._elementCleanups = new Map();
        /** @type {boolean} Whether binder has been disposed */
        this._disposed = false;
    }

    /**
     * Binds DOM element (and children) to reactive view model.
     * 
     * @param {string|HTMLElement} element - CSS selector or HTMLElement
     * @param {Object} viewModel - Reactive view model (must be from Observable.create())
     * @throws {Error} If viewModel not reactive or element invalid
     * @example
     * const model = Stitch.Observable.create({ count: 0 });
     * binder.bind('#app', model);
     */
    bind(element, viewModel) {
        if (typeof element === "string") {
            element = document.querySelector(element);
        }
        if (!element || !viewModel) {
            throw new Error("Invalid element or viewModel");
        }
        if (!viewModel._factory || !viewModel._factory.reactiveSystem) {
            throw new Error(`Stitch.js ${Version}: viewModel must be created with Observable.create() to have a _factory property`);
        }
        this.reactiveSystem = viewModel._factory.reactiveSystem;

        // Global onChange hook: subscribe once per root bind and route model change events.
        if (typeof this.hooks.onChange === "function") {
            const onChangeHandler = change => {
                try {
                    this.hooks.onChange.call(this, change, viewModel, element);
                } catch (error) {
                    console.warn(`[Stitch.js ${Version}] DataBinder onChange hook error:`, error);
                }
            };
            viewModel.on(onChangeHandler);
            this._trackCleanup(element, () => viewModel.off(onChangeHandler));
        }

        this._bindElement(element, viewModel, []);
    }

    /**
     * Creates hooks object with defaults.
     * @private
     */
    createHooks(userHooks = {}) {
        return {
            onBind: userHooks.onBind || null,
            onChange: userHooks.onChange || null,
            properties: userHooks.properties || {}
        };
    }

    /**
     * Recursively binds element and its children with boundary awareness.
     * Stops traversal at binding boundaries (foreach, component, portal).
     *
     * @private
     * @param {HTMLElement} element - Element to bind
     * @param {Object} context - Binding context
     * @param {string} contextPath - Current path in view model
     */
    _bindElement(element, context, contextPath) {
        // Process this element's bindings
        this._processBindings(element, context, contextPath);

        // Check if this element creates a binding boundary
        // Boundary handlers (foreach, component) are responsible for binding their own children
        if (this._isBindingBoundary(element)) {
            return; // Stop here - boundary handler manages descendants
        }

        // Recursively process direct children only (tree-walking)
        // Using element.children instead of querySelectorAll ensures we traverse
        // AFTER parent bindings execute, allowing boundaries to be respected
        Array.from(element.children).forEach(child => {
            this._bindElement(child, context, contextPath);
        });
    }

    /**
     * Checks if element creates a binding boundary.
     * Boundary bindings manage their own children and prevent parent binding traversal.
     *
     * @private
     * @param {HTMLElement} element - Element to check
     * @returns {boolean} true if element creates a binding boundary
     */
    _isBindingBoundary(element) {
        // foreach boundaries: manage their own child rendering
        if (element.hasAttribute("data-foreach")) {
            StitchDebug.enabled && StitchDebug.log("bindings", "Stopped at binding boundary: " + element.tagName);
            return true;
        }

        // Future boundary types can be added here:
        // if (element.hasAttribute("data-component")) return true;
        // if (element.hasAttribute("data-portal")) return true;
        // if (element.hasAttribute("data-if")) return true;

        return false;
    }

    /**
     * Scans and applies bindings to single element.
     * Prevents duplicate binding.
     * @private
     */
    _processBindings(element, context, contextPath) {
        if (this.boundElements.has(element)) {
            return;
        }
        const customBindings = scanCustomAttributes(element);
        if (customBindings.length > 0) {
            customBindings.forEach(binding => {
                this._applyTypedBinding(element, context, binding.type, binding.path, contextPath);
            });
            this.boundElements.add(element);

            if (typeof this.hooks.onBind === "function") {
                try {
                    this.hooks.onBind.call(this, element, context, customBindings);
                } catch (error) {
                    console.warn(`[Stitch.js ${Version}] DataBinder onBind hook error:`, error);
                }
            }
        }
    }

    /**
     * Delegates to binding handler from registry using Strategy Pattern.
     * Checks for property-specific hooks before applying default binding.
     * @private
     */
    _applyTypedBinding(element, viewModel, type, path, contextPath = []) {
        // Construct full path from context
        const fullPath = contextPath.length > 0 ? `${contextPath.join('.')}.${path}` : path;

        StitchDebug.enabled && StitchDebug.log("bindings", `_applyTypedBinding called: type="${type}", path="${path}", fullPath="${fullPath}"`, {
            element: element.tagName
        });

        // Check for property-specific hooks
        // Try property name first, then full path (matches historical behavior)
        const propertyName = path.split('.').pop();
        const propertyHooks = this.hooks.properties[propertyName] || this.hooks.properties[fullPath] || this.hooks.properties[path];

        // Get initial value for hook
        const value = getProperty(viewModel, path);

        // If onBind hook exists, call it instead of default binding
        if (propertyHooks && propertyHooks.onBind) {
            StitchDebug.enabled && StitchDebug.log("bindings", `  → Using property hook onBind for "${fullPath}"`, {
                propertyName: propertyName,
                hasOnChange: !!propertyHooks.onChange
            });

            // Create binding object for hook (matches historical signature)
            const binding = { type, path, attributeName: `data-${type}` };

            // Call onBind hook with DataBinder as 'this'
            propertyHooks.onBind.call(this, element, value, binding, fullPath);
        } else {
            // No onBind hook, use default binding handler
            const handler = getBindingHandler(type);
            if (handler) {
                const context = {
                    reactiveSystem: this.reactiveSystem,
                    binder: this
                };
                handler.bind(element, viewModel, path, context);
            } else {
                console.warn(`[Stitch.js ${Version}] Unknown binding type: ${type}`);
            }
        }

        // Set up onChange hook if it exists (always, even if onBind exists)
        if (propertyHooks && propertyHooks.onChange) {
            StitchDebug.enabled && StitchDebug.log("bindings", `  → Setting up onChange reactive effect for "${fullPath}"`);

            // Create binding object for hook
            const binding = { type, path, attributeName: `data-${type}` };

            // Track old value for onChange callback
            let oldValue = value;

            const eff = this.reactiveSystem.effect(() => {
                const newValue = getProperty(viewModel, path);

                // Call onChange hook with DataBinder as 'this'
                propertyHooks.onChange.call(this, element, newValue, oldValue, binding, fullPath);

                // Update oldValue for next change
                oldValue = newValue;
            });
            this._trackCleanup(element, () => this.reactiveSystem.cleanup(eff));
        }
    }

    /**
     * Unbinds an element AND every element inside it: runs all their cleanups (effects
     * released, listeners removed) and forgets them. The DOM is left as it is.
     *
     * @param {string|HTMLElement} element - CSS selector or HTMLElement
     */
    unbind(element) {
        if (typeof element === "string") {
            element = document.querySelector(element);
        }
        if (element) {
            this._unbindTree(element);
        }
    }

    /**
     * Releases the bindings of root and all of its descendants.
     * @private
     */
    _unbindTree(root) {
        this._releaseElement(root);
        if (typeof root.querySelectorAll === "function" && root.firstElementChild) {
            const descendants = root.querySelectorAll("*");
            for (let i = 0; i < descendants.length; i++) {
                this._releaseElement(descendants[i]);
            }
        }
    }

    /**
     * Runs one element's cleanups and forgets the element.
     * @private
     */
    _releaseElement(element) {
        this.boundElements.delete(element);
        const cleanups = this._elementCleanups.get(element);
        if (cleanups) {
            this._elementCleanups.delete(element);
            cleanups.forEach(fn => {
                try { fn(); } catch (e) { console.error(`[Stitch.js ${Version}] unbind cleanup error:`, e); }
            });
        }
    }

    /**
     * Registers a cleanup function for disposal.
     * @private
     * @param {HTMLElement} element - Element associated with cleanup
     * @param {Function} cleanupFn - Function to call during dispose
     */
    _trackCleanup(element, cleanupFn) {
        if (!this._disposed) {
            if (!this._elementCleanups.has(element)) {
                this._elementCleanups.set(element, new Set());
            }
            this._elementCleanups.get(element).add(cleanupFn);
        }
    }

    /**
     * Disposes the binder, cleaning up all effects and event listeners.
     * Call this when unmounting a Stitch-bound section in SPA context.
     *
     * @example
     * // In SPA unmount lifecycle
     * binder.dispose();
     */
    dispose() {
        if (this._disposed) return;
        this._disposed = true;

        // Run all cleanup functions (effects + event listeners)
        this._elementCleanups.forEach(cleanups => {
            cleanups.forEach(fn => {
                try { fn(); } catch(e) { console.warn(`[Stitch.js ${Version}] dispose cleanup error:`, e); }
            });
        });
        this._elementCleanups.clear();
        this.boundElements.clear();
        this.reactiveSystem = null;

        StitchDebug.enabled && StitchDebug.log("bindings", "DataBinder disposed");
    }
}

/**
 * Registers a custom binding handler (PUBLIC API).
 * Extends framework without modifying core code.
 * 
 * @static
 * @param {string} name - Binding name (e.g., 'tooltip' for data-tooltip)
 * @param {BindingHandler} handler - Handler object with bind() method
 * @throws {Error} If name not string or handler missing bind() method
 * @example
 * Stitch.DataBinder.registerBinding('tooltip', {
 *     bind(element, viewModel, path, context) {
 *         context.reactiveSystem.effect(() => {
 *             const value = getProperty(viewModel, path);
 *             element.setAttribute('title', value || '');
 *         });
 *     }
 * });
 * // Usage: <button data-tooltip="helpText">Help</button>
 */
DataBinder.registerBinding = function (name, handler) {
    if (typeof name !== "string") {
        throw new Error(`[Stitch.js ${Version}] registerBinding: name must be a string`);
    }
    if (!handler || typeof handler.bind !== "function") {
        throw new Error(`[Stitch.js ${Version}] registerBinding: handler must have a bind() method`);
    }
    if (BINDING_HANDLERS[name]) {
        console.warn(`[Stitch.js ${Version}] registerBinding: Overriding existing handler "${name}"`);
    }
    BINDING_HANDLERS[name] = handler;
};
    return DataBinder;
}

module.exports = {
    createDataBinderClass
};

  };
  __stitchModuleFactories[7] = function(module, exports, __stitchRequire){
"use strict";

/**
 * foreach: keyed list rendering. The ONE implementation used for every list element
 * (ul/ol/tbody/div/... and <select> options), whether the row template is inline or
 * comes from data-template.
 *
 * Rules:
 * - The row template has exactly one root element (whitespace and comments ignored).
 * - Every row has a unique key (resolveRowKeys: data-key field, default "id"; a plain
 *   value is its own key). A list that breaks the rule throws before the DOM changes.
 * - Same key + same object: the row is reused untouched (DOM state kept); only its
 *   $index is updated if it moved.
 * - Same key + a different object: the old row is released and a fresh row is bound
 *   to the new object.
 * - Every row that leaves the list is released (all bindings in its subtree disposed)
 *   before it is removed. Releasing the foreach binding releases all of its rows.
 */

function describeList(element, path) {
    const keyAttr = element.getAttribute("data-key");
    return `<${element.tagName.toLowerCase()} data-foreach="${path}"${keyAttr !== null ? ` data-key="${keyAttr}"` : ""}>`;
}

function describeNode(node) {
    if (node.nodeType === 1) return `<${node.tagName.toLowerCase()}>`;
    const text = node.textContent.trim();
    return `text "${text.length > 20 ? text.slice(0, 20) + "..." : text}"`;
}

/**
 * Reads the list's key field from data-key. Absent = null (the default, "id").
 */
function readKeyField(element, path, version) {
    if (!element.hasAttribute("data-key")) {
        return null;
    }
    const field = element.getAttribute("data-key").trim();
    if (!field) {
        throw new Error(
            `[Stitch.js ${version}] ${describeList(element, path)}: data-key is empty. ` +
            `Set it to the field that identifies a row (e.g. data-key="sku"), or remove it to use "id".`
        );
    }
    return field;
}

/**
 * Takes the row template out of the list element (inline) or out of the <template>
 * named by data-template, enforcing the one-root rule. Returns a detached element
 * that is cloned for every row; it is never bound itself.
 */
function readRowTemplate(element, path, version, doc) {
    const templateId = element.getAttribute("data-template");
    const where = describeList(element, path);
    let nodes;
    let source;
    if (templateId) {
        const templateElement = doc.getElementById(templateId);
        if (!templateElement) {
            throw new Error(`[Stitch.js ${version}] ${where}: data-template="${templateId}" names no element. Add <template id="${templateId}"> with one row element inside.`);
        }
        if (templateElement.tagName !== "TEMPLATE") {
            throw new Error(`[Stitch.js ${version}] ${where}: data-template="${templateId}" must name a <template> element, got <${templateElement.tagName.toLowerCase()}>.`);
        }
        nodes = Array.from(templateElement.content.childNodes);
        source = `the row template <template id="${templateId}">`;
    } else {
        nodes = Array.from(element.childNodes);
        source = "the inline row template";
    }

    const roots = nodes.filter(node =>
        node.nodeType === 1 || (node.nodeType === 3 && node.textContent.trim() !== ""));

    if (roots.length === 0) {
        throw new Error(
            `[Stitch.js ${version}] ${where}: ${source} is empty. ` +
            (templateId
                ? `Put one row element inside <template id="${templateId}">.`
                : `Put one row element inside the list element, e.g. <li data-text="name"></li>, or point data-template at a <template>.`)
        );
    }
    if (roots.length > 1) {
        const kind = roots.every(node => node.nodeType === 1) ? "root elements" : "root nodes";
        throw new Error(
            `[Stitch.js ${version}] ${where}: ${source} has ${roots.length} ${kind} (${roots.map(describeNode).join(", ")}), ` +
            `but a row must be exactly one element. Wrap them in one element, e.g. <div>...</div>.`
        );
    }
    if (roots[0].nodeType !== 1) {
        throw new Error(
            `[Stitch.js ${version}] ${where}: ${source} is ${describeNode(roots[0])}, but a row must be one element. ` +
            `Wrap it in an element, e.g. <span data-text="$data"></span>.`
        );
    }

    // Inline template nodes were never bound (foreach is a binding boundary), so they can
    // simply be taken out of the list element.
    while (element.firstChild) {
        element.removeChild(element.firstChild);
    }
    return templateId ? doc.importNode(roots[0], true) : roots[0];
}

/**
 * Gives a row context a reactive $index, so bindings that show it follow moves.
 */
function defineRowIndex(itemContext, index, reactiveSystem) {
    const holder = { index };
    Object.defineProperty(itemContext, "$index", {
        configurable: true,
        enumerable: false,
        get() {
            reactiveSystem.track(holder, "index");
            return holder.index;
        }
    });
    return function setIndex(next) {
        if (holder.index !== next) {
            const previous = holder.index;
            holder.index = next;
            reactiveSystem.trigger(holder, "index", previous, next);
        }
    };
}

/**
 * Binds a foreach list.
 *
 * @param {HTMLElement} element - the list element (has data-foreach)
 * @param {Object} viewModel
 * @param {string} path - the data-foreach path
 * @param {{reactiveSystem: Object, binder: Object}} context
 * @param {Object} deps
 * @param {Function} deps.validateBinding
 * @param {Function} deps.getProperty
 * @param {Function} deps.getValueValidator
 * @param {Function} deps.createItemContext
 * @param {Function} deps.resolveRowKeys
 * @param {string} deps.version
 * @param {Document} [deps.doc]
 * @returns {Function} the list's effect
 */
function bindForeach(element, viewModel, path, context, deps) {
    const version = deps.version;
    const doc = deps.doc || element.ownerDocument;
    const binder = context.binder;
    const reactiveSystem = context.reactiveSystem;

    deps.validateBinding(viewModel, path, "foreach", element);

    const list = {
        name: path,
        keyField: readKeyField(element, path, version),
        tagName: element.tagName
    };
    const rowTemplate = readRowTemplate(element, path, version, doc);

    const isSelect = element.tagName === "SELECT";
    const valuePath = isSelect ? element.getAttribute("data-value") : null;
    let placeholder = null;
    if (isSelect && element.getAttribute("data-default-text")) {
        placeholder = doc.createElement("option");
        placeholder.value = element.getAttribute("data-default-value") || "";
        placeholder.textContent = element.getAttribute("data-default-text");
        element.appendChild(placeholder);
    }

    /** @type {Map<*, {el: HTMLElement, item: *, setIndex: Function}>} key -> row */
    let rows = new Map();

    function createRow(item, index) {
        const el = rowTemplate.cloneNode(true);
        const itemContext = deps.createItemContext(item, index, viewModel);
        const setIndex = defineRowIndex(itemContext, index, reactiveSystem);
        const row = { el, item, setIndex };
        try {
            // Untracked: what the row's bindings read while they are set up belongs to
            // their own effects, not to the list (a row change must not re-render the list).
            reactiveSystem.untracked(() => binder._bindElement(el, itemContext, []));
        } catch (error) {
            binder._unbindTree(el);
            throw error;
        }
        return row;
    }

    function releaseRow(row) {
        binder._unbindTree(row.el);
        if (row.el.parentNode === element) {
            element.removeChild(row.el);
        }
    }

    function readItems() {
        const value = deps.getProperty(viewModel, path);
        if (value === undefined || value === null) {
            return [];
        }
        if (!Array.isArray(value)) {
            throw new TypeError(
                `[Stitch.js ${version}] ${describeList(element, path)}: "${path}" must be an array (or null/undefined for no rows), ` +
                `got ${typeof value}. Bind data-foreach to an array.`
            );
        }
        return value;
    }

    function reconcile(items) {
        // 1. Keys first: a list that breaks the key rule throws before anything changes.
        const keys = deps.resolveRowKeys(items, list, version);

        // 2. Reuse a row only for the same key AND the same object; build the others.
        //    If building a row throws, release what was built and leave the DOM as it was.
        const next = new Map();
        const ordered = new Array(items.length);
        const created = [];
        try {
            for (let index = 0; index < items.length; index++) {
                const item = items[index];
                const existing = rows.get(keys[index]);
                let row;
                if (existing && Object.is(existing.item, item)) {
                    row = existing;
                } else {
                    row = createRow(item, index);
                    created.push(row);
                }
                ordered[index] = row;
                next.set(keys[index], row);
            }
        } catch (error) {
            created.forEach(row => binder._unbindTree(row.el));
            throw error;
        }

        // 3. Release every old row that is not reused (key gone, or a new object).
        rows.forEach((row, key) => {
            if (next.get(key) !== row) {
                releaseRow(row);
            }
        });

        // 4. Put rows in order after the placeholder (if any).
        let cursor = placeholder ? placeholder.nextSibling : element.firstChild;
        for (const row of ordered) {
            if (row.el === cursor) {
                cursor = cursor.nextSibling;
            } else {
                element.insertBefore(row.el, cursor);
            }
        }

        // 5. Moved rows show their new position.
        for (let index = 0; index < ordered.length; index++) {
            ordered[index].setIndex(index);
        }
        rows = next;
    }

    function restoreSelectValue() {
        if (valuePath) {
            const currentValue = deps.getProperty(viewModel, valuePath);
            if (currentValue !== undefined && currentValue !== null) {
                const validator = deps.getValueValidator(element);
                const validValue = validator.validate(element, currentValue, viewModel, valuePath, "render");
                if (validValue !== undefined) {
                    element.value = validValue;
                }
            } else if (placeholder) {
                element.value = placeholder.value;
            }
            return;
        }
        // No data-value: options are reused, so the user's choice stays selected unless
        // its option left the list.
        if (placeholder && element.selectedIndex < 0) {
            element.value = placeholder.value;
        }
    }

    const effect = reactiveSystem.effect(() => {
        reconcile(readItems());
        if (isSelect) {
            restoreSelectValue();
        }
    }, { batch: true });

    binder._trackCleanup(element, () => {
        reactiveSystem.cleanup(effect);
        rows.forEach(row => binder._unbindTree(row.el));
        rows = new Map();
    });
    return effect;
}

/**
 * Builds a foreach binding handler compatible with the BINDING_HANDLERS contract.
 *
 * @param {Object} deps - see bindForeach
 * @returns {{bind: Function}}
 */
function createForeachBindingHandler(deps) {
    return {
        bind(element, viewModel, path, context) {
            return bindForeach(element, viewModel, path, context, deps);
        }
    };
}

module.exports = {
    bindForeach,
    createForeachBindingHandler,
    readRowTemplate,
    readKeyField
};

  };
  __stitchModuleFactories[8] = function(module, exports, __stitchRequire){
"use strict";

const { VERSION } = __stitchRequire(23);
const { MessageBus } = __stitchRequire(11);
const { BatchScheduler } = __stitchRequire(9);
const { ComputedRef } = __stitchRequire(10);
const { ReactiveSystem } = __stitchRequire(12);

module.exports = {
    MessageBus,
    version: VERSION,
    CoreMessageBus: MessageBus,
    BatchScheduler,
    ComputedRef,
    ReactiveSystem
};

  };
  __stitchModuleFactories[9] = function(module, exports, __stitchRequire){
"use strict";

const { NOOP_DEBUG } = __stitchRequire(15);
const { VERSION } = __stitchRequire(23);

class BatchScheduler {
    constructor(options = {}) {
        this.version = options.version || `v${VERSION}`;
        this.debug = options.debug || NOOP_DEBUG;
        this._pendingEffects = new Set();
        this.flushing = false;
        this.flushScheduled = false;
        this.flushDepth = 0;
        this.MAX_FLUSH_DEPTH = 100;
    }

    queue(effect) {
        if (typeof effect !== "function") {
            throw new TypeError(
                `[Stitch.js ${this.version} BatchScheduler] queue() expects a function, got ${typeof effect}`
            );
        }
        this._pendingEffects.add(effect);
        this.scheduleFlush();
    }

    scheduleFlush() {
        if (!this.flushScheduled && !this.flushing) {
            this.flushScheduled = true;
            Promise.resolve().then(() => this.flush());
        }
    }

    flush() {
        if (this.flushing) return;

        if (this.flushDepth >= this.MAX_FLUSH_DEPTH) {
            console.error(
                `[Stitch.js ${this.version} BatchScheduler] Maximum flush depth exceeded.\n` +
                "Possible infinite loop detected. Queue cleared."
            );
            this._pendingEffects.clear();
            this.flushDepth = 0;
            this.flushScheduled = false;
            return;
        }

        this.flushing = true;
        this.flushScheduled = false;
        this.flushDepth++;

        this.debug.enabled && this.debug.group("effects", `Flushing BatchScheduler (${this._pendingEffects.size} effects, depth: ${this.flushDepth})`);

        const effectsToRun = Array.from(this._pendingEffects);
        this._pendingEffects.clear();

        effectsToRun.forEach((effect) => {
            try {
                effect();
            } catch (error) {
                console.error(`[Stitch.js ${this.version} BatchScheduler] Error in effect:`, error);
            }
        });

        this.debug.enabled && this.debug.groupEnd("effects");

        this.flushing = false;
        if (this._pendingEffects.size > 0) {
            this.debug.enabled && this.debug.log("effects", `New effects queued during flush (${this._pendingEffects.size}), scheduling next flush`);
            this.scheduleFlush();
        } else {
            this.flushDepth = 0;
        }
    }

    /** Drops a queued effect (used when the effect is released before the flush). */
    dequeue(effect) {
        this._pendingEffects.delete(effect);
    }

    hasQueued() {
        return this._pendingEffects.size > 0;
    }

    clear() {
        this._pendingEffects.clear();
        this.flushScheduled = false;
    }
}

module.exports = {
    BatchScheduler
};

  };
  __stitchModuleFactories[10] = function(module, exports, __stitchRequire){
"use strict";

// The dependency key under which readers of a computed subscribe to it. Readers live in
// the system's dependency map like any other subscription, so releasing a reader
// (ReactiveSystem.cleanup) removes it from every computed it read.
const COMPUTED_VALUE_KEY = "value";

class ComputedRef {
    constructor(getter, reactiveSystem, context, explicitDeps = null) {
        this.getter = getter;
        this.reactiveSystem = reactiveSystem;
        this.context = context;
        this.explicitDeps = explicitDeps;
        this.value = undefined;
        this.dirty = true;
        this.deps = new Set();
        this._generation = reactiveSystem._generation;
        this.id = Math.random().toString(36).substr(2, 9);
        this.isComputedRef = true;

        this.reactiveSystem.debug.enabled && this.reactiveSystem.debug.log("computed", `COMPUTED REF CREATED (id: ${this.id})`, {
            hasExplicitDeps: !!explicitDeps,
            explicitDeps
        });
    }

    markDirty() {
        if (this.dirty) {
            return;
        }

        this.reactiveSystem.debug.enabled && this.reactiveSystem.debug.log("computed", `COMPUTED MARKED DIRTY (id: ${this.id})`);
        this.dirty = true;

        // Notify readers (effects and computeds) through the system's dependency map.
        this.reactiveSystem.trigger(this, COMPUTED_VALUE_KEY);
    }

    evaluate() {
        this.reactiveSystem.debug.enabled && this.reactiveSystem.debug.log("computed", `COMPUTING VALUE (id: ${this.id})`);
        this.cleanup();
        this.reactiveSystem.effectStack.push(this);

        try {
            if (this.explicitDeps && this.context) {
                for (const depKey of this.explicitDeps) {
                    void this.context[depKey];
                }
            }

            this.value = this.getter.call(this.context);
            this.dirty = false;

            this.reactiveSystem.debug.enabled && this.reactiveSystem.debug.log("computed", `COMPUTED VALUE (id: ${this.id})`, {
                value: this.value,
                deps: this.deps.size
            });

            return this.value;
        } finally {
            this.reactiveSystem.effectStack.pop();
        }
    }

    get() {
        this.reactiveSystem.track(this, COMPUTED_VALUE_KEY);

        // A disposed system no longer invalidates computeds, so never serve a cached value.
        if (this.dirty || this.reactiveSystem.disposed) {
            return this.evaluate();
        }

        this.reactiveSystem.debug.enabled && this.reactiveSystem.debug.log("computed", `COMPUTED CACHED (id: ${this.id})`, {
            value: this.value
        });
        return this.value;
    }

    cleanup() {
        this.reactiveSystem._untrack(this);
    }
}

module.exports = {
    ComputedRef,
    COMPUTED_VALUE_KEY
};

  };
  __stitchModuleFactories[11] = function(module, exports, __stitchRequire){
"use strict";

const { NOOP_DEBUG } = __stitchRequire(15);
const { VERSION } = __stitchRequire(23);

class MessageBus {
    constructor(options = {}) {
        this.version = options.version || `v${VERSION}`;
        this.debug = options.debug || NOOP_DEBUG;
        this.subscribers = new Map();
        this.queue = [];
        this.isFlushing = false;
        this.middleware = [];
        this.flushDepth = 0;
        this.MAX_FLUSH_DEPTH = 100;
    }

    subscribe(event, callback) {
        if (!this.subscribers.has(event)) {
            this.subscribers.set(event, new Set());
        }
        this.subscribers.get(event).add(callback);
        this.debug.enabled && this.debug.log("messageBus", `Subscribed to event: "${event}"`, {
            subscriberCount: this.subscribers.get(event).size
        });
        return () => this.unsubscribe(event, callback);
    }

    unsubscribe(event, callback) {
        const subscribers = this.subscribers.get(event);
        if (subscribers) {
            subscribers.delete(callback);
        }
    }

    publish(event, payload) {
        this.queue.push({
            event,
            payload,
            timestamp: Date.now()
        });
        this.debug.enabled && this.debug.log("messageBus", `Published event: "${event}" (queued)`, {
            payload,
            queueLength: this.queue.length
        });
        if (!this.isFlushing) {
            Promise.resolve().then(() => this.flush());
        }
    }

    publishSync(event, payload) {
        this._executeEvent({
            event,
            payload,
            timestamp: Date.now()
        });
    }

    flush() {
        if (this.isFlushing || this.queue.length === 0) return;
        if (this.flushDepth >= this.MAX_FLUSH_DEPTH) {
            console.error(
                `[Stitch.js ${this.version} MessageBus] Maximum flush depth (${this.MAX_FLUSH_DEPTH}) exceeded.\n` +
                "Possible infinite loop detected. Event queue has been cleared."
            );
            this.flushDepth = 0;
            this.queue = [];
            return;
        }

        this.isFlushing = true;
        this.flushDepth++;
        const eventsToProcess = [...this.queue];
        this.queue = [];

        this.debug.enabled && this.debug.group("messageBus", `Flushing Message Bus (${eventsToProcess.length} events, depth: ${this.flushDepth})`);
        eventsToProcess.forEach((eventData) => {
            this._executeEvent(eventData);
        });
        this.debug.enabled && this.debug.groupEnd("messageBus");

        this.isFlushing = false;
        if (this.queue.length > 0) {
            this.debug.enabled && this.debug.log(
                "messageBus",
                `New events queued during flush (${this.queue.length}), scheduling next flush (depth: ${this.flushDepth})`
            );
            if (this.flushDepth > 5) {
                console.warn(`[Stitch.js ${this.version} MessageBus] Flush depth > 5. Queued events:`, this.queue.map((e) => e.event).join(", "));
            }
            Promise.resolve().then(() => this.flush());
        } else {
            this.flushDepth = 0;
        }
    }

    _executeEvent(eventData) {
        let processedData = eventData;
        for (const middlewareFn of this.middleware) {
            processedData = middlewareFn(processedData) || processedData;
        }

        const event = processedData.event;
        const payload = processedData.payload;
        const subscribers = this.subscribers.get(event);

        this.debug.enabled && this.debug.log("messageBus", `Executing event: "${event}"`, {
            payload,
            subscriberCount: subscribers ? subscribers.size : 0
        });

        if (subscribers) {
            subscribers.forEach((callback) => {
                try {
                    callback(payload);
                } catch (error) {
                    console.error(`[Stitch.js ${this.version} MessageBus] Error in subscriber for event "${event}":`, error);
                }
            });
        }

        const wildcardSubscribers = this.subscribers.get("*");
        if (wildcardSubscribers) {
            wildcardSubscribers.forEach((callback) => {
                try {
                    callback({ event, payload });
                } catch (error) {
                    console.error(`[Stitch.js ${this.version} MessageBus] Error in wildcard subscriber:`, error);
                }
            });
        }
    }

    use(middlewareFn) {
        this.middleware.push(middlewareFn);
    }

    clear() {
        this.queue = [];
    }
}

module.exports = {
    MessageBus,
    NOOP_DEBUG
};

  };
  __stitchModuleFactories[12] = function(module, exports, __stitchRequire){
"use strict";

const { MessageBus, NOOP_DEBUG } = __stitchRequire(11);
const { BatchScheduler } = __stitchRequire(9);
const { VERSION } = __stitchRequire(23);
const { REACTIVE_TOTALS } = __stitchRequire(19);

class ReactiveSystem {
    constructor(bubbleChangeUp = null, options = {}) {
        this.version = options.version || `v${VERSION}`;
        this.debug = options.debug || NOOP_DEBUG;
        this.effectStack = [];
        this.depsMap = new WeakMap();
        // Live counts for this system (Stitch.debug.stats() sums every system).
        this._stats = { effects: 0, subscriptions: 0 };
        // Bumped by dispose(): subscribers of an older generation sit in dependency
        // sets that no longer exist, so releasing them changes no live count.
        this._generation = 0;
        this.disposed = false;

        const BatchSchedulerCtor = options.BatchScheduler || BatchScheduler;
        const MessageBusCtor = options.MessageBus || MessageBus;

        this.batchScheduler = new BatchSchedulerCtor({
            version: this.version,
            debug: this.debug
        });
        this.messageBus = new MessageBusCtor({
            version: this.version,
            debug: this.debug
        });
        this.bubbleChangeUp = bubbleChangeUp;

        this.messageBus.subscribe("nested-change", (payload) => {
            const parent = payload.parent;
            const fullPath = payload.fullPath;
            const oldValue = payload.oldValue;
            const newValue = payload.newValue;
            if (parent._changeHandlers && parent._changeHandlers.size > 0) {
                parent._changeHandlers.forEach((handler) => {
                    handler({
                        field: fullPath,
                        oldValue,
                        newValue,
                        target: parent,
                        nestedChange: true
                    });
                });
            }
        });

        this.messageBus.subscribe("array-mutation", (payload) => {
            const target = payload.target;
            const method = payload.method;
            const args = payload.args;
            const oldLength = payload.oldLength;
            const newLength = payload.newLength;

            if (target._changeHandlers) {
                target._changeHandlers.forEach((handler) => {
                    handler({
                        field: "items",
                        action: method,
                        args,
                        target
                    });
                });
            }

            if (this.bubbleChangeUp) {
                this.bubbleChangeUp(target, "items", oldLength, newLength);
            }
        });
    }

    get currentEffect() {
        return this.effectStack[this.effectStack.length - 1] || null;
    }

    _getObjectId(obj) {
        if (!obj) return "null";
        return obj.__stitchId || obj.constructor?.name || "unknown";
    }

    track(target, key) {
        const currentEffect = this.currentEffect;

        if (!currentEffect || this.disposed) {
            this.debug.enabled && this.debug.log("reactivity", `TRACK SKIPPED (no current effect): ${this._getObjectId(target)}.${String(key)}`);
            return;
        }

        let deps = this.depsMap.get(target);
        if (!deps) {
            deps = new Map();
            this.depsMap.set(target, deps);
        }

        let dep = deps.get(key);
        if (!dep) {
            dep = new Set();
            deps.set(key, dep);
        }

        if (!dep.has(currentEffect)) {
            dep.add(currentEffect);
            currentEffect.deps.add(dep);
            this._countSubscriptions(1);
        }

        this.debug.enabled && this.debug.log("reactivity", `TRACK: ${this._getObjectId(target)}.${String(key)} -> ${currentEffect.id || "unknown"}`, {
            effectId: currentEffect.id,
            isComputed: !!currentEffect.isComputedRef,
            dependencyCount: dep.size
        });
    }

    trigger(target, key, oldValue, newValue) {
        const deps = this.depsMap.get(target);
        const dep = deps?.get(key);

        if (!dep || dep.size === 0) {
            this.debug.enabled && this.debug.log("reactivity", `TRIGGER SKIPPED (no deps): ${this._getObjectId(target)}.${String(key)}`);
            return;
        }

        this.debug.enabled && this.debug.log("reactivity", `TRIGGER: ${this._getObjectId(target)}.${String(key)} (${dep.size} dependents)`, {
            oldValue,
            newValue
        });

        const effectsToRun = new Set(dep);
        effectsToRun.forEach((dependent) => {
            if (dependent.disposed) {
                return;
            }
            if (dependent.isComputedRef) {
                dependent.markDirty();
            } else if (dependent.options && dependent.options.batch) {
                this.batchScheduler.queue(dependent);
            } else {
                dependent();
            }
        });

        if (target._changeHandlers) {
            target._changeHandlers.forEach((handler) => {
                handler({
                    field: key,
                    oldValue,
                    newValue,
                    target
                });
            });
        }
    }

    /**
     * Creates an effect: runs fn now (unless options.lazy) and again whenever a
     * reactive value it read changes. Release it with cleanup(effect).
     * If the first run throws, the effect is released and the error is rethrown.
     */
    effect(fn, options = {}) {
        if (this.disposed) {
            throw new Error(`[Stitch.js ${this.version}] effect(): this ReactiveSystem was disposed; create a new model to bind again.`);
        }
        const effectId = Math.random().toString(36).substr(2, 9);

        const effect = () => {
            if (effect.disposed || this.disposed) {
                return undefined;
            }
            this._untrack(effect);
            this.effectStack.push(effect);

            this.debug.enabled && this.debug.log("effects", `EFFECT RUNNING (id: ${effectId})`, {
                stackDepth: this.effectStack.length,
                batch: !!options.batch
            });

            try {
                return fn();
            } finally {
                this.effectStack.pop();
            }
        };

        effect.deps = new Set();
        effect.options = options;
        effect.id = effectId;
        effect.disposed = false;
        effect._generation = this._generation;
        this._countEffects(1);

        this.debug.enabled && this.debug.log("effects", `EFFECT CREATED (id: ${effectId})`, {
            lazy: !!options.lazy,
            batch: !!options.batch
        });

        if (!options.lazy) {
            try {
                effect();
            } catch (error) {
                this.cleanup(effect);
                throw error;
            }
        }

        return effect;
    }

    /**
     * Runs fn without subscribing the current effect to anything fn reads.
     * Effects created inside fn still track their own reads.
     */
    untracked(fn) {
        this.effectStack.push(null);
        try {
            return fn();
        } finally {
            this.effectStack.pop();
        }
    }

    /**
     * Releases an effect for good: it leaves every dependency set it joined
     * (reactive properties and computeds), leaves the batch queue, and never runs again.
     * Safe to call more than once.
     */
    cleanup(effect) {
        this._untrack(effect);
        if (effect.disposed) {
            return;
        }
        effect.disposed = true;
        if (this.batchScheduler && typeof this.batchScheduler.dequeue === "function") {
            this.batchScheduler.dequeue(effect);
        }
        if (effect._generation === this._generation) {
            this._countEffects(-1);
        }
    }

    /**
     * Removes a subscriber (effect or computed) from every dependency set it joined.
     * Used before each re-run (dependencies are collected afresh) and on release.
     * @private
     */
    _untrack(subscriber) {
        const live = subscriber._generation === this._generation;
        let removed = 0;
        subscriber.deps.forEach((dep) => {
            if (dep.delete(subscriber)) {
                removed++;
            }
        });
        subscriber.deps.clear();
        if (live && removed > 0) {
            this._countSubscriptions(-removed);
        }
    }

    /**
     * Releases the whole reactive graph of this system: every effect stops for good,
     * every subscription is dropped, the batch queue is cleared. Models keep their
     * plain values (computeds recompute on each read) but nothing reacts any more.
     */
    dispose() {
        if (this.disposed) {
            return;
        }
        this.disposed = true;
        REACTIVE_TOTALS.effects -= this._stats.effects;
        REACTIVE_TOTALS.subscriptions -= this._stats.subscriptions;
        this._stats.effects = 0;
        this._stats.subscriptions = 0;
        this._generation++;
        this.depsMap = new WeakMap();
        this.batchScheduler.clear();
    }

    /** Live counts for this system: { effects, subscriptions }. */
    stats() {
        return { effects: this._stats.effects, subscriptions: this._stats.subscriptions };
    }

    /** @private */
    _countEffects(delta) {
        this._stats.effects += delta;
        REACTIVE_TOTALS.effects += delta;
    }

    /** @private */
    _countSubscriptions(delta) {
        this._stats.subscriptions += delta;
        REACTIVE_TOTALS.subscriptions += delta;
    }
}

module.exports = {
    ReactiveSystem
};

  };
  __stitchModuleFactories[13] = function(module, exports, __stitchRequire){
"use strict";

const { VERSION } = __stitchRequire(23);
const helpers = __stitchRequire(20);
const debugConfig = __stitchRequire(15);
const attrValueHandlers = __stitchRequire(14);
const valueBindingHelpers = __stitchRequire(22);
const typeConverters = __stitchRequire(21);
const foreachKeys = __stitchRequire(16);
const foreachRowContext = __stitchRequire(17);
const reactiveObjectHelpers = __stitchRequire(18);
const { readReactiveStats } = __stitchRequire(19);

const debugState = debugConfig.createDebugState(`v${VERSION}`);
const debug = {
    enable() {
        debugState.enabled = true;
        console.log("[Stitch.js Debug] Enabled");
    },
    disable() {
        debugState.enabled = false;
        console.log("[Stitch.js Debug] Disabled");
    },
    enableCategory(category) {
        if (debugConfig.isKnownDebugCategory(debugState.categories, category)) {
            debugState.categories[category] = true;
            console.log(`[Stitch.js Debug] Enabled category: ${category}`);
        } else {
            console.warn(debugConfig.formatUnknownCategoryWarning(category, debugState.categories));
        }
    },
    disableCategory(category) {
        if (debugConfig.isKnownDebugCategory(debugState.categories, category)) {
            debugState.categories[category] = false;
            console.log(`[Stitch.js Debug] Disabled category: ${category}`);
        } else {
            console.warn(debugConfig.formatUnknownCategoryWarning(category, debugState.categories));
        }
    },
    categories() {
        console.log("[Stitch.js Debug] Available categories:");
        console.table(debugState.categories);
    },
    /**
     * Live reactive-graph counts across the page, read-only: { effects, subscriptions }.
     * Works whether or not debug output is enabled.
     */
    stats() {
        return readReactiveStats();
    }
};

module.exports = {
    debug,
    version: VERSION,
    ...helpers,
    ...debugConfig,
    ...attrValueHandlers,
    ...valueBindingHelpers,
    ...typeConverters,
    ...foreachKeys,
    ...foreachRowContext,
    ...reactiveObjectHelpers
};

  };
  __stitchModuleFactories[14] = function(module, exports, __stitchRequire){
"use strict";

/**
 * Internal registry for attribute value type handling.
 * Mirrors Stitch runtime behavior for attr binding semantics.
 */
const ATTR_VALUE_HANDLERS = {
    null: {
        apply(element, attrName, attrValue) {
            element.removeAttribute(attrName);
        }
    },
    undefined: {
        apply(element, attrName, attrValue) {
            element.removeAttribute(attrName);
        }
    },
    boolean: {
        apply(element, attrName, attrValue) {
            if (attrValue === true) {
                element.setAttribute(attrName, "");
            } else {
                element.removeAttribute(attrName);
            }
        }
    },
    object: {
        apply(element, attrName, attrValue) {
            if (attrName === "style" && typeof attrValue === "object") {
                const cssString = Object.keys(attrValue).map(key => {
                    const kebabKey = key.replace(/([A-Z])/g, "-$1").toLowerCase();
                    return `${kebabKey}: ${attrValue[key]}`;
                }).join("; ");
                element.setAttribute(attrName, cssString);
            } else {
                element.setAttribute(attrName, JSON.stringify(attrValue));
            }
        }
    },
    array: {
        apply(element, attrName, attrValue) {
            if (attrName === "class") {
                element.setAttribute(attrName, attrValue.join(" "));
            } else {
                element.setAttribute(attrName, attrValue.join(","));
            }
        }
    },
    default: {
        apply(element, attrName, attrValue) {
            element.setAttribute(attrName, String(attrValue));
        }
    }
};

/**
 * Selects appropriate attribute value handler based on value type.
 *
 * @param {*} value
 * @returns {{apply: Function}}
 */
function getAttrHandler(value) {
    if (value === null) {
        return ATTR_VALUE_HANDLERS.null;
    }
    if (value === undefined) {
        return ATTR_VALUE_HANDLERS.undefined;
    }
    if (typeof value === "boolean") {
        return ATTR_VALUE_HANDLERS.boolean;
    }
    if (Array.isArray(value)) {
        return ATTR_VALUE_HANDLERS.array;
    }
    if (typeof value === "object") {
        return ATTR_VALUE_HANDLERS.object;
    }
    return ATTR_VALUE_HANDLERS.default;
}

module.exports = {
    ATTR_VALUE_HANDLERS,
    getAttrHandler
};

  };
  __stitchModuleFactories[15] = function(module, exports, __stitchRequire){
"use strict";

/**
 * Canonical debug category toggles extracted from Stitch runtime defaults.
 */
const DEFAULT_DEBUG_CATEGORIES = Object.freeze({
    reactivity: true,
    computed: true,
    effects: true,
    bindings: true,
    messageBus: true,
    warnings: true
});

/**
 * Canonical debug colors extracted from Stitch runtime defaults.
 */
const DEFAULT_DEBUG_COLORS = Object.freeze({
    reactivity: "#2196F3",
    computed: "#4CAF50",
    effects: "#FF9800",
    bindings: "#9C27B0",
    messageBus: "#F44336",
    warnings: "#FF5722"
});

/**
 * Creates a mutable debug state object seeded from extracted defaults.
 *
 * @param {string} version
 * @returns {{version: string, enabled: boolean, categories: Object, colors: Object}}
 */
function createDebugState(version) {
    return {
        version,
        enabled: false,
        categories: { ...DEFAULT_DEBUG_CATEGORIES },
        colors: { ...DEFAULT_DEBUG_COLORS }
    };
}

/**
 * Lists available debug categories from a category map.
 *
 * @param {Object} [categories]
 * @returns {string[]}
 */
function listDebugCategories(categories = DEFAULT_DEBUG_CATEGORIES) {
    return Object.keys(categories);
}

/**
 * Checks whether a category key exists in a category map.
 *
 * @param {Object} categories
 * @param {string} category
 * @returns {boolean}
 */
function isKnownDebugCategory(categories, category) {
    return !!categories && Object.prototype.hasOwnProperty.call(categories, category);
}

/**
 * Formats the standard unknown-category warning with current category list.
 *
 * @param {string} category
 * @param {Object} [categories]
 * @returns {string}
 */
function formatUnknownCategoryWarning(category, categories = DEFAULT_DEBUG_CATEGORIES) {
    return `[Stitch.js Debug] Unknown category: ${category}. Valid categories: ${listDebugCategories(categories).join(", ")}`;
}

/**
 * No-op debug object used as a default when debugging is disabled.
 * Provides the same interface as the real debug object so callers
 * don't need to check for null.
 */
const NOOP_DEBUG = {
    enabled: false,
    categories: Object.create(null),
    log() {},
    group() {},
    groupEnd() {}
};

module.exports = {
    DEFAULT_DEBUG_CATEGORIES,
    DEFAULT_DEBUG_COLORS,
    NOOP_DEBUG,
    createDebugState,
    listDebugCategories,
    isKnownDebugCategory,
    formatUnknownCategoryWarning
};

  };
  __stitchModuleFactories[16] = function(module, exports, __stitchRequire){
"use strict";

/**
 * THE key rule for list rows. Every foreach path (inline template, data-template,
 * <select> options, lists that come and go) resolves row keys here and nowhere else.
 *
 * - A row that is an object: its key is row[keyField]. keyField is the list's data-key
 *   attribute, or "id" when the list has none.
 * - A row that is a plain value (string, number, boolean, ...): the value is its own key.
 * - No fallback to the row index and none to row.key: a missing key throws.
 * - Two rows with the same key throw.
 *
 * Keys are compared as JavaScript values (Map semantics): 1 and "1" are different keys.
 */

// Field names worth suggesting when a row lacks its key field.
const LIKELY_KEY_FIELD = /^(key|uuid|guid|code|sku|ticker|slug|symbol)$|[a-z0-9](Id|ID|Key|Code)$|_(id|key|code)$/;

function describeList(list) {
    const tag = list.tagName ? list.tagName.toLowerCase() : "element";
    const keyAttr = list.keyField ? ` data-key="${list.keyField}"` : "";
    return `<${tag} data-foreach="${list.name}"${keyAttr}>`;
}

function formatKey(value) {
    if (typeof value === "string") return JSON.stringify(value);
    if (typeof value === "symbol") return value.toString();
    return String(value);
}

function suggestKeyField(row, missingField) {
    let names;
    try {
        names = Object.keys(row);
    } catch (error) {
        return null;
    }
    for (const name of names) {
        if (name === missingField || !LIKELY_KEY_FIELD.test(name)) continue;
        const value = row[name];
        if (value !== undefined && value !== null && typeof value !== "object" && typeof value !== "function") {
            return name;
        }
    }
    return null;
}

function missingKeyError(version, list, index, field, row) {
    const where = describeList(list);
    const which = list.keyField ? "the key field set by data-key" : "the default key field";
    const suggestion = list.keyField ? null : suggestKeyField(row, field);
    let fix;
    if (suggestion) {
        fix = `This row has "${suggestion}": if that identifies a row, add data-key="${suggestion}" to ${where}.`;
    } else if (list.keyField) {
        fix = `Give every row a "${field}", or set data-key to a field that every row has.`;
    } else {
        fix = `Give every row an "id", or name the key field with data-key, e.g. <${(list.tagName || "ul").toLowerCase()} data-foreach="${list.name}" data-key="sku">.`;
    }
    return new Error(
        `[Stitch.js ${version}] ${where}: row ${index} has no "${field}" (${which}). ` +
        `Every row of a list needs a unique key. ${fix}`
    );
}

/**
 * Resolves the key of every row, in order. Throws (and changes nothing) if any row has
 * no key or two rows share one.
 *
 * @param {Array} items - the list's rows
 * @param {{name: string, keyField: (string|null), tagName: string}} list
 *        name = the data-foreach path; keyField = the data-key value (null = "id");
 *        tagName = the list element's tag, for the message
 * @param {string} version - for the error prefix
 * @returns {Array} keys, one per row
 */
function resolveRowKeys(items, list, version) {
    const keys = new Array(items.length);
    const seen = new Map();
    const field = list.keyField || "id";

    for (let index = 0; index < items.length; index++) {
        const row = items[index];
        let key;
        if (row !== null && typeof row === "object") {
            key = row[field];
            if (key === undefined || key === null) {
                throw missingKeyError(version, list, index, field, row);
            }
        } else if (row === undefined || row === null) {
            throw new Error(
                `[Stitch.js ${version}] ${describeList(list)}: row ${index} is ${row}. ` +
                `A list row must be an object with a key, or a plain value (string, number, boolean). ` +
                `Remove the empty row from the list.`
            );
        } else if (list.keyField) {
            throw new Error(
                `[Stitch.js ${version}] ${describeList(list)}: row ${index} is a plain ${typeof row} (${formatKey(row)}), ` +
                `so it has no "${list.keyField}" field. data-key is for lists of objects; ` +
                `remove data-key and each plain value is its own key.`
            );
        } else {
            key = row;
        }

        if (seen.has(key)) {
            const first = seen.get(key);
            const what = (row !== null && typeof row === "object")
                ? `the same key ${formatKey(key)} (field "${field}")`
                : `the same value ${formatKey(key)} (in a list of plain values each value is its own key)`;
            throw new Error(
                `[Stitch.js ${version}] ${describeList(list)}: rows ${first} and ${index} have ${what}. ` +
                `Keys must be unique within a list: remove the duplicate, or key the rows by a field that is unique.`
            );
        }
        seen.set(key, index);
        keys[index] = key;
    }
    return keys;
}

module.exports = {
    resolveRowKeys
};

  };
  __stitchModuleFactories[17] = function(module, exports, __stitchRequire){
"use strict";

/**
 * Creates the binding context of one foreach row: the row's own fields (through the
 * prototype chain, so two-way bindings write to the row object), plus $data (the row
 * itself), $index and $parent (the list's view model).
 * The foreach binding replaces $index with a reactive accessor.
 *
 * @param {*} item
 * @param {number} index
 * @param {Object} viewModel
 * @returns {Object}
 */
function createItemContext(item, index, viewModel) {
    let context;
    if (typeof item === "object" && item !== null) {
        context = Object.create(item);
        Object.defineProperty(context, "$data", {
            value: item,
            writable: true,
            enumerable: false
        });
    } else {
        context = Object.create(null);
        context.$data = item;
    }
    context.$index = index;
    context.$parent = viewModel;
    return context;
}

module.exports = {
    createItemContext
};

  };
  __stitchModuleFactories[18] = function(module, exports, __stitchRequire){
"use strict";

function defineHidden(target, name, value) {
    Object.defineProperty(target, name, {
        value: value,
        writable: false,
        enumerable: false,
        configurable: false
    });
}

function addChangeHandler(handler) {
    this._changeHandlers.add(handler);
}

function removeChangeHandler(handler) {
    if (handler) {
        this._changeHandlers.delete(handler);
    } else {
        this._changeHandlers.clear();
    }
}

function toJSON() {
    const result = {};
    for (const [key, value] of Object.entries(this)) {
        if (key.startsWith("_")) continue;
        if (value && typeof value === "object" && value.toJSON) {
            result[key] = value.toJSON();
        } else if (Array.isArray(value)) {
            result[key] = value.map((item) => item && typeof item === "object" && item.toJSON ? item.toJSON() : item);
        } else {
            result[key] = value;
        }
    }
    return result;
}

module.exports = {
    defineHidden,
    addChangeHandler,
    removeChangeHandler,
    toJSON
};

  };
  __stitchModuleFactories[19] = function(module, exports, __stitchRequire){
"use strict";

/**
 * Live counts of the reactive graph, summed over every ReactiveSystem in the page.
 * Read-only from outside: Stitch.debug.stats() returns a copy.
 *
 * - effects: effects created and not yet disposed (one per live effect-backed binding,
 *   plus any $watch or custom-binding effect).
 * - subscriptions: subscriber edges that a change can reach: an effect or computed
 *   subscribed to a reactive property, or an effect / computed subscribed to a computed.
 */
const REACTIVE_TOTALS = {
    effects: 0,
    subscriptions: 0
};

function readReactiveStats() {
    return {
        effects: REACTIVE_TOTALS.effects,
        subscriptions: REACTIVE_TOTALS.subscriptions
    };
}

module.exports = {
    REACTIVE_TOTALS,
    readReactiveStats
};

  };
  __stitchModuleFactories[20] = function(module, exports, __stitchRequire){
"use strict";

const { VERSION } = __stitchRequire(23);

/**
 * Detects arrow functions. Mirrors Stitch runtime behavior for reactive function guards.
 *
 * @param {*} fn
 * @returns {boolean}
 */
function isArrowFunction(fn) {
    if (typeof fn !== "function") {
        return false;
    }
    if (fn.prototype !== undefined) {
        return false;
    }
    const fnStr = fn.toString();
    if (fnStr.includes("[native code]")) {
        return false;
    }
    if (fn.name && fn.name.startsWith("bound ")) {
        return false;
    }
    const arrowPattern = /^\s*(\([^)]*\)|[a-zA-Z_$][\w$]*)\s*=>/;
    return arrowPattern.test(fnStr);
}

/**
 * Sets property values using dot-notation paths, creating intermediate objects as needed.
 *
 * @param {Object} target
 * @param {string} path
 * @param {*} value
 */
function setProperty(target, path, value) {
    const keys = path.split(".");
    let current = target;
    for (let i = 0; i < keys.length - 1; i++) {
        if (!current[keys[i]] || typeof current[keys[i]] !== "object") {
            current[keys[i]] = {};
        }
        current = current[keys[i]];
    }
    current[keys[keys.length - 1]] = value;
}

/**
 * Safely retrieves property values using dot-notation paths.
 *
 * @param {Object} target
 * @param {string} path
 * @param {Object} [options]
 * @param {string} [options.version] defaults to the package version
 * @param {boolean} [options.debugEnabled=false]
 * @returns {*}
 */
function getProperty(target, path, options = {}) {
    const version = options.version || VERSION;
    const debugEnabled = !!options.debugEnabled;

    if (path.trim().startsWith("{")) {
        console.error(
            `[Stitch.js ${version}] Invalid binding syntax: "${path}"\n` +
            `\n` +
            `Inline object literals are not supported in bindings.\n` +
            `Use a property path reference instead.`
        );
        return undefined;
    }

    const keys = path.split(".");
    let current = target;
    for (let i = 0; i < keys.length; i++) {
        const key = keys[i];
        if (current == null) {
            if (debugEnabled) {
                const pathSoFar = keys.slice(0, i).join(".");
                console.warn(`[Stitch.js ${version}] Property path "${path}" is null/undefined at "${pathSoFar}"`);
            }
            return undefined;
        }
        if (!(key in current)) {
            if (debugEnabled) {
                const pathSoFar = keys.slice(0, i).join(".");
                console.warn(`[Stitch.js ${version}] Property "${key}" does not exist on object at path "${pathSoFar}". Full path: "${path}"`);
            }
            return undefined;
        }
        current = current[key];
    }
    return current;
}

/**
 * Checks if a property path exists on an object using dot notation.
 *
 * @param {Object} obj
 * @param {string} path
 * @returns {boolean}
 */
function propertyExists(obj, path) {
    if (!obj || !path) return false;
    const keys = path.split(".");
    let current = obj;
    for (const key of keys) {
        if (current == null || !(key in current)) {
            return false;
        }
        current = current[key];
    }
    return true;
}

/**
 * Finds similar top-level property names for typo hints.
 *
 * @param {Object} obj
 * @param {string} targetPath
 * @returns {string|null}
 */
function findSimilarProperty(obj, targetPath) {
    if (!obj || !targetPath) return null;
    const targetKey = targetPath.split(".").pop();
    const available = Object.keys(obj).filter(k => !k.startsWith("_"));
    const similar = available.find(key => {
        const lower1 = key.toLowerCase();
        const lower2 = targetKey.toLowerCase();
        return (lower1.includes(lower2) || lower2.includes(lower1)) && lower1 !== lower2;
    });
    return similar ? `Did you mean "${similar}"?` : null;
}

module.exports = {
    isArrowFunction,
    setProperty,
    getProperty,
    propertyExists,
    findSimilarProperty
};

  };
  __stitchModuleFactories[21] = function(module, exports, __stitchRequire){
"use strict";

const { VERSION: DEFAULT_VERSION } = __stitchRequire(23);

/**
 * Builds the type converter registry with Stitch-compatible behavior.
 *
 * @param {Object} [options]
 * @param {string} [options.version]
 * @returns {Object}
 */
function createTypeConverters(options = {}) {
    const version = options.version || DEFAULT_VERSION;

    return {
        int: {
            canHandle(value, element) {
                return element?.getAttribute("data-type") === "int" || element?.type === "number" && value !== null && Number.isInteger(value);
            },
            toModel(value) {
                if (value === "" || value === null || value === undefined) return null;
                const parsed = parseInt(value, 10);
                if (isNaN(parsed)) {
                    console.warn(`[Stitch.js ${version}] Failed to convert "${value}" to int. Returning null.`);
                    return null;
                }
                return parsed;
            },
            toDom(value) {
                return value === null || value === undefined ? "" : String(value);
            },
            equals(value1, value2) {
                const v1 = this.toModel(value1);
                const v2 = this.toModel(value2);
                return v1 === v2;
            }
        },
        float: {
            canHandle(value, element) {
                return element?.getAttribute("data-type") === "float" || element?.type === "number" && value !== null && !Number.isInteger(value);
            },
            toModel(value) {
                if (value === "" || value === null || value === undefined) return null;
                const parsed = parseFloat(value);
                if (isNaN(parsed)) {
                    console.warn(`[Stitch.js ${version}] Failed to convert "${value}" to float. Returning null.`);
                    return null;
                }
                return parsed;
            },
            toDom(value) {
                return value === null || value === undefined ? "" : String(value);
            },
            equals(value1, value2) {
                const v1 = this.toModel(value1);
                const v2 = this.toModel(value2);
                if (v1 === null || v2 === null) return v1 === v2;
                return Math.abs(v1 - v2) < Number.EPSILON;
            }
        },
        boolean: {
            canHandle(value, element) {
                return element?.getAttribute("data-type") === "bool" || element?.getAttribute("data-type") === "boolean" || element?.type === "checkbox";
            },
            toModel(value) {
                if (typeof value === "boolean") return value;
                if (typeof value === "string") {
                    const lower = value.toLowerCase().trim();
                    if (lower === "true" || lower === "1" || lower === "yes") return true;
                    if (lower === "false" || lower === "0" || lower === "no" || lower === "") return false;
                }
                return Boolean(value);
            },
            toDom(value) {
                return value ? "true" : "false";
            },
            equals(value1, value2) {
                return this.toModel(value1) === this.toModel(value2);
            }
        },
        string: {
            canHandle(value, element) {
                return element?.getAttribute("data-type") === "string" || element?.type === "text" || element?.type === "email" || element?.type === "url" || element?.type === "tel" || element?.type === "password" || element?.tagName === "TEXTAREA";
            },
            toModel(value) {
                return value === null || value === undefined ? "" : String(value);
            },
            toDom(value) {
                return value === null || value === undefined ? "" : String(value);
            },
            equals(value1, value2) {
                return String(value1) === String(value2);
            }
        },
        date: {
            canHandle(value, element) {
                return element?.getAttribute("data-type") === "date" || element?.type === "date";
            },
            toModel(value) {
                if (!value) return null;
                if (value instanceof Date) return value;
                const date = new Date(value);
                if (isNaN(date.getTime())) {
                    console.warn(`[Stitch.js ${version}] Failed to convert "${value}" to date. Returning null.`);
                    return null;
                }
                return date;
            },
            toDom(value) {
                if (!value) return "";
                const date = value instanceof Date ? value : new Date(value);
                if (isNaN(date.getTime())) return "";
                return date.toISOString().split("T")[0];
            },
            equals(value1, value2) {
                const d1 = this.toModel(value1);
                const d2 = this.toModel(value2);
                if (d1 === null || d2 === null) return d1 === d2;
                return d1.getTime() === d2.getTime();
            }
        },
        datetime: {
            canHandle(value, element) {
                return element?.getAttribute("data-type") === "datetime" || element?.type === "datetime-local";
            },
            toModel(value) {
                if (!value) return null;
                if (value instanceof Date) return value;
                const date = new Date(value);
                if (isNaN(date.getTime())) {
                    console.warn(`[Stitch.js ${version}] Failed to convert "${value}" to datetime. Returning null.`);
                    return null;
                }
                return date;
            },
            toDom(value) {
                if (!value) return "";
                const date = value instanceof Date ? value : new Date(value);
                if (isNaN(date.getTime())) return "";
                const year = date.getFullYear();
                const month = String(date.getMonth() + 1).padStart(2, "0");
                const day = String(date.getDate()).padStart(2, "0");
                const hours = String(date.getHours()).padStart(2, "0");
                const minutes = String(date.getMinutes()).padStart(2, "0");
                return `${year}-${month}-${day}T${hours}:${minutes}`;
            },
            equals(value1, value2) {
                const d1 = this.toModel(value1);
                const d2 = this.toModel(value2);
                if (d1 === null || d2 === null) return d1 === d2;
                return d1.getTime() === d2.getTime();
            }
        },
        auto: {
            canHandle(value, element) {
                return true;
            },
            toModel(value) {
                return value;
            },
            toDom(value) {
                return value === null || value === undefined ? "" : String(value);
            },
            equals(value1, value2) {
                return value1 == value2;
            }
        }
    };
}

const TYPE_CONVERTERS = createTypeConverters();

/**
 * Selects converter using explicit data-type, then canHandle(), then value inference.
 *
 * @param {HTMLElement} element
 * @param {*} value
 * @param {Object} [converters]
 * @returns {Object}
 */
function getTypeConverter(element, value, converters = TYPE_CONVERTERS) {
    const dataType = element?.getAttribute("data-type");
    if (dataType && converters[dataType]) {
        return converters[dataType];
    }
    if (element) {
        for (const [typeName, converter] of Object.entries(converters)) {
            if (typeName !== "auto" && converter.canHandle(value, element)) {
                return converter;
            }
        }
    }
    if (value !== null && value !== undefined) {
        const valueType = typeof value;
        if (valueType === "number") {
            return Number.isInteger(value) ? converters.int : converters.float;
        }
        if (valueType === "boolean") {
            return converters.boolean;
        }
        if (value instanceof Date) {
            return converters.date;
        }
    }
    return converters.auto;
}

module.exports = {
    DEFAULT_VERSION,
    createTypeConverters,
    TYPE_CONVERTERS,
    getTypeConverter
};

  };
  __stitchModuleFactories[22] = function(module, exports, __stitchRequire){
"use strict";

/**
 * Builds value validators with injected runtime dependencies.
 *
 * @param {Object} deps
 * @param {Function} deps.getTypeConverter
 * @param {Function} deps.setProperty
 * @param {Document} [deps.doc]
 * @returns {Object}
 */
function createValueValidators(deps) {
    const getTypeConverter = deps.getTypeConverter;
    const setProperty = deps.setProperty;
    const doc = deps.doc || (typeof document !== "undefined" ? document : null);

    return {
        "select-single": {
            validate(element, value, viewModel = null, path = null, source = "render") {
                const hasPlaceholder = element.hasAttribute("data-default-text");
                const placeholderValue = element.hasAttribute("data-default-value") ? element.getAttribute("data-default-value") : "";
                if (hasPlaceholder && value === placeholderValue) {
                    return placeholderValue;
                }
                if (!value || value === "") {
                    return hasPlaceholder ? placeholderValue : "";
                }
                const converter = getTypeConverter(element, value);
                const valueExists = Array.from(element.options).some(opt => converter.equals(opt.value, value));
                if (!valueExists) {
                    if (hasPlaceholder) {
                        element.value = placeholderValue;
                        if (source === "user-input" && viewModel && path) {
                            setProperty(viewModel, path, placeholderValue);
                        }
                        return placeholderValue;
                    }
                    element.selectedIndex = 0;
                    const firstValue = element.options[0]?.value || "";
                    if (source === "user-input" && viewModel && path) {
                        setProperty(viewModel, path, firstValue);
                    }
                    return firstValue;
                }
                return value;
            }
        },
        "select-multiple": {
            validate(element, values, viewModel = null, path = null, source = "render") {
                if (!Array.isArray(values) || values.length === 0) return [];
                const converter = getTypeConverter(element, values[0]);
                const validOptions = Array.from(element.options).map(opt => opt.value);
                const validValues = values.filter(val => validOptions.some(optVal => converter.equals(optVal, val)));
                Array.from(element.options).forEach(option => {
                    option.selected = validValues.some(val => converter.equals(option.value, val));
                });
                if (source === "user-input" && viewModel && path && validValues.length !== values.length) {
                    setProperty(viewModel, path, validValues);
                }
                return validValues;
            }
        },
        "radio-group": {
            validate(element, value, viewModel = null, path = null, source = "render") {
                const name = element.name;
                if (!name) return value;
                if (!doc) return value;
                const converter = getTypeConverter(element, value);
                const radios = doc.querySelectorAll(`input[type="radio"][name="${name}"]`);
                const valueExists = Array.from(radios).some(radio => converter.equals(radio.value, value));
                if (!valueExists && value !== "") {
                    radios.forEach(radio => {
                        radio.checked = false;
                    });
                    if (source === "user-input" && viewModel && path) {
                        setProperty(viewModel, path, "");
                    }
                    return "";
                }
                return value;
            }
        },
        default: {
            validate(element, value, viewModel = null, path = null) {
                return value;
            }
        }
    };
}

/**
 * Selects value validator based on element type.
 *
 * @param {HTMLElement} element
 * @param {Object} validators
 * @returns {{validate: Function}}
 */
function getValueValidator(element, validators) {
    if (element.tagName === "SELECT" && element.multiple) {
        return validators["select-multiple"];
    }
    if (element.tagName === "SELECT") {
        return validators["select-single"];
    }
    if (element.type === "radio") {
        return validators["radio-group"];
    }
    return validators.default;
}

/**
 * Builds value handlers with injected runtime dependencies.
 *
 * @param {Object} deps
 * @param {Function} deps.getTypeConverter
 * @param {Function} deps.resolveValueValidator
 * @returns {Object}
 */
function createValueHandlers(deps) {
    const getTypeConverter = deps.getTypeConverter;
    const resolveValueValidator = deps.resolveValueValidator;

    return {
        checkbox: {
            modelToView(element, value, viewModel = null, path = null) {
                element.checked = !!value;
            },
            viewToModel(element) {
                return element.checked;
            }
        },
        radio: {
            modelToView(element, value, viewModel = null, path = null) {
                const converter = getTypeConverter(element, value);
                element.checked = converter.equals(element.value, value);
            },
            viewToModel(element) {
                const converter = getTypeConverter(element, element.value);
                return converter.toModel(element.value);
            }
        },
        "select-multiple": {
            modelToView(element, value, viewModel = null, path = null) {
                const values = Array.isArray(value) ? value : [];
                const validator = resolveValueValidator(element);
                validator.validate(element, values, viewModel, path, "render");
            },
            viewToModel(element) {
                const converter = getTypeConverter(element, element.value);
                return Array.from(element.selectedOptions).map(opt => converter.toModel(opt.value));
            }
        },
        number: {
            modelToView(element, value, viewModel = null, path = null) {
                const converter = getTypeConverter(element, value);
                element.value = converter.toDom(value);
            },
            viewToModel(element) {
                const converter = getTypeConverter(element, element.value);
                return converter.toModel(element.value);
            }
        },
        range: {
            modelToView(element, value, viewModel = null, path = null) {
                element.value = value != null ? value : "";
            },
            viewToModel(element) {
                return parseFloat(element.value) || 0;
            }
        },
        default: {
            modelToView(element, value, viewModel = null, path = null) {
                const converter = getTypeConverter(element, value);
                const newValue = converter.toDom(value);
                if (element.tagName === "SELECT") {
                    const validator = resolveValueValidator(element);
                    const validValue = validator.validate(element, newValue, viewModel, path, "render");
                    if (element.value !== validValue) {
                        element.value = validValue;
                    }
                } else if (element.value !== newValue) {
                    element.value = newValue;
                }
            },
            viewToModel(element) {
                const converter = getTypeConverter(element, element.value);
                return converter.toModel(element.value);
            }
        }
    };
}

/**
 * Selects value handler based on element type.
 *
 * @param {HTMLElement} element
 * @param {Object} handlers
 * @returns {{modelToView: Function, viewToModel: Function}}
 */
function getValueHandler(element, handlers) {
    if (element.type === "checkbox") {
        return handlers.checkbox;
    }
    if (element.type === "radio") {
        return handlers.radio;
    }
    if (element.tagName === "SELECT" && element.multiple) {
        return handlers["select-multiple"];
    }
    if (element.type === "number") {
        return handlers.number;
    }
    if (element.type === "range") {
        return handlers.range;
    }
    return handlers.default;
}

module.exports = {
    createValueValidators,
    getValueValidator,
    createValueHandlers,
    getValueHandler
};

  };
  __stitchModuleFactories[23] = function(module, exports, __stitchRequire){
"use strict";
// Stamped by the build from package.json.
module.exports = { VERSION: "2.1.0" };

  };
  var __stitchModuleCache = Object.create(null);
  function __stitchRequire(id){
    var factory = __stitchModuleFactories[id];
    if (!factory) throw new Error('Stitch assembly missing inline module: ' + id);
    if (__stitchModuleCache[id]) return __stitchModuleCache[id].exports;
    var module = { exports: {} };
    __stitchModuleCache[id] = module;
    factory(module, module.exports, __stitchRequire);
    return module.exports;
  }
  if (typeof root.__stitchInlineRequire !== 'function') {
    root.__stitchInlineRequire = function(id){
      try {
        return __stitchRequire(id);
      } catch (_error) {
        return null;
      }
    };
  }
})(typeof globalThis !== 'undefined' ? globalThis : (typeof self !== 'undefined' ? self : this));

/**
 * Stitch.js distribution entry. The version comes from package.json (stamped by the build). Source of truth is package modules under packages/*.
 */
(function () {
    "use strict";

    const api = (typeof __stitchInlineRequire === "function" ? (__stitchInlineRequire(0) || require("./packages/api/index.js")) : require("./packages/api/index.js"));
    const browser = (typeof __stitchInlineRequire === "function" ? (__stitchInlineRequire(3) || require("./packages/browser/index.js")) : require("./packages/browser/index.js"));
    const core = (typeof __stitchInlineRequire === "function" ? (__stitchInlineRequire(8) || require("./packages/core/index.js")) : require("./packages/core/index.js"));
    const utils = (typeof __stitchInlineRequire === "function" ? (__stitchInlineRequire(13) || require("./packages/utils/index.js")) : require("./packages/utils/index.js"));

    if (!api || !browser || !core || !utils) {
        throw new Error("Stitch.js bootstrap failed: one or more package modules could not be resolved.");
    }

    const Observable = api.Observable;
    const computed = api.computed || (Observable && Observable.computed);
    const DataBinder = browser.DataBinder;
    const MessageBus = core.MessageBus;
    const version = api.version;
    if (typeof version !== "string" || !version) {
        throw new Error("Stitch.js bootstrap failed: package version is missing.");
    }
    const debug = utils.debug || {
        enable() {},
        disable() {},
        enableCategory() {},
        disableCategory() {},
        categories() {}
    };

    const Stitch = {
        Observable,
        DataBinder,
        MessageBus,
        computed,
        version,
        debug
    };

    if (typeof window !== "undefined") {
        window.Stitch = Stitch;
    } else if (typeof module !== "undefined" && module.exports) {
        module.exports = Stitch;
    }
})();
