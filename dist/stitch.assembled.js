/* STITCH_ASSEMBLY_METADATA {"generatedAt":"2026-02-21T19:44:21.958Z","source":"stitch.entry.js","mode":"reachable","availableModuleCount":23,"moduleCount":23,"modules":["packages/api/index.js","packages/api/src/observable.js","packages/api/src/reactive-factory.js","packages/browser/index.js","packages/browser/src/binding-runtime.js","packages/browser/src/binding-scan-helpers.js","packages/browser/src/data-binder.js","packages/browser/src/foreach-binding-orchestrator.js","packages/browser/src/foreach-rendering-delegates.js","packages/core/index.js","packages/core/src/batch-scheduler.js","packages/core/src/computed-ref.js","packages/core/src/message-bus.js","packages/core/src/reactive-system.js","packages/utils/index.js","packages/utils/src/attr-value-handlers.js","packages/utils/src/debug-config.js","packages/utils/src/foreach-reconcile-helpers.js","packages/utils/src/foreach-template-helpers.js","packages/utils/src/reactive-object-helpers.js","packages/utils/src/runtime-helpers.js","packages/utils/src/type-converters.js","packages/utils/src/value-binding-helpers.js"]} */

(function(root){
  var __stitchModuleFactories = Object.create(null);
  __stitchModuleFactories["packages/api/index.js"] = function(module, exports, __stitchRequire){
"use strict";

const VERSION = "2.1.0";
const { createReactiveFactory } = __stitchRequire("packages/api/src/reactive-factory.js");
const { Observable, computed } = __stitchRequire("packages/api/src/observable.js");

module.exports = {
    Observable,
    computed,
    version: VERSION,
    createReactiveFactory,
    ExtractedObservable: Observable,
    extractedComputed: computed
};

  };
  __stitchModuleFactories["packages/api/src/observable.js"] = function(module, exports, __stitchRequire){
"use strict";

const { createReactiveFactory } = __stitchRequire("packages/api/src/reactive-factory.js");
const runtimeHelpers = __stitchRequire("packages/utils/src/runtime-helpers.js");

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
        
        const factory = createReactiveFactory();
        
        // ⭐ OPTION 7 KEY CHANGE: Just call reactive() - it handles EVERYTHING
        // No more manual computed extraction, no more manual descriptor wrapping
        // Single source of truth: reactive()
        const reactiveData = factory.reactive(data, new WeakSet);
        
        // Add factory reference
        Object.defineProperty(reactiveData, "_factory", {
            value: factory,
            writable: false,
            enumerable: false,
            configurable: false
        });
        
        // Add Message Bus API
        Object.defineProperty(reactiveData, "$on", {
            value: function (event, callback) {
                return factory.reactiveSystem.messageBus.subscribe(event, callback);
            },
            writable: false,
            enumerable: false,
            configurable: false
        });
        Object.defineProperty(reactiveData, "$watch", {
            value: function (property, callback, options = {}) {
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
            },
            writable: false,
            enumerable: false,
            configurable: false
        });
        Object.defineProperty(reactiveData, "$use", {
            value: function (middleware) {
                return factory.reactiveSystem.messageBus.use(middleware);
            },
            writable: false,
            enumerable: false,
            configurable: false
        });
        Object.defineProperty(reactiveData, "$off", {
            value: function (event, callback) {
                factory.reactiveSystem.messageBus.unsubscribe(event, callback);
            },
            writable: false,
            enumerable: false,
            configurable: false
        });
        Object.defineProperty(reactiveData, "$emit", {
            value: function (event, payload) {
                factory.reactiveSystem.messageBus.publish(event, payload);
            },
            writable: false,
            enumerable: false,
            configurable: false
        });
        Object.defineProperty(reactiveData, "$once", {
            value: function (event, callback) {
                const unsubscribe = factory.reactiveSystem.messageBus.subscribe(event, payload => {
                    callback(payload);
                    unsubscribe();
                });
                return unsubscribe;
            },
            writable: false,
            enumerable: false,
            configurable: false
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
     * @returns {Proxy} Reactive Proxy
     * @example
     * const list = Stitch.Observable.createArray([1, 2, 3]);
     * list.push(4); // Triggers reactivity
     * list[0] = 10; // Triggers reactivity
     */
    static createArray(items = []) {
        if (!Array.isArray(items)) {
            throw new Error("Observable.createArray() requires an array as input");
        }
        const factory = createReactiveFactory();
        const reactiveArray = factory.reactive([...items], new WeakSet);
        Object.defineProperty(reactiveArray, "_factory", {
            value: factory,
            writable: false,
            enumerable: false,
            configurable: false
        });
        return reactiveArray;
    }

    /**
     * Makes existing object reactive. Eager conversion of entire tree.
     * 
     * @param {Object} obj - Object to make reactive
     * @returns {Object} Reactive object
     */
    static reactive(obj) {
        const factory = createReactiveFactory();
        const reactiveObj = factory.reactive(obj, new WeakSet);
        Object.defineProperty(reactiveObj, "_factory", {
            value: factory,
            writable: false,
            enumerable: false,
            configurable: false
        });
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
        let fn, explicitDeps;
        if (typeof config === "function") {
            fn = config;
            explicitDeps = null;
        } else if (typeof config === "object" && config.get) {
            fn = config.get;
            explicitDeps = config.deps || null;
            if (explicitDeps && !Array.isArray(explicitDeps)) {
                throw new Error(`[Stitch.js ${Version}] Stitch.computed() deps must be an array of property names.\n` + `Example: Stitch.computed({ get() { ... }, deps: ['prop1', 'prop2'] })`);
            }
        } else {
            throw new Error(`[Stitch.js ${Version}] Stitch.computed() expects either:\n` + `  - A function: Stitch.computed(function() { ... })\n` + `  - An object: Stitch.computed({ get() { ... }, deps: [...] })`);
        }
        
        // ⭐ OPTION 7 KEY CHANGE: Return standardized marker
        // reactive() will detect __isStitchComputed and handle uniformly
        return {
            __isStitchComputed: true,
            fn: fn,
            __explicitDeps: explicitDeps
        };
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
}
function computed(config) {
    return Observable.computed(config);
}

module.exports = {
    Observable,
    computed
};

  };
  __stitchModuleFactories["packages/api/src/reactive-factory.js"] = function(module, exports, __stitchRequire){
"use strict";

const { ReactiveSystem } = __stitchRequire("packages/core/src/reactive-system.js");
const { ComputedRef } = __stitchRequire("packages/core/src/computed-ref.js");
const runtimeHelpers = __stitchRequire("packages/utils/src/runtime-helpers.js");
const objectHelpers = __stitchRequire("packages/utils/src/reactive-object-helpers.js");

const NOOP_DEBUG = {
    enabled: false,
    categories: Object.create(null),
    log() {},
    group() {},
    groupEnd() {}
};
function createReactiveFactory(options = {}) {
    const Version = options.version || "v2.1.0";
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
            Object.defineProperty(target, "_parent", {
                value: { obj: parent, key: key },
                writable: false,
                enumerable: false,
                configurable: false
            });
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
     * OPTIMIZED (v2.1.0): Iterative traversal + Conditional publishing.
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
                StitchDebug.log("reactivity", `⬆️ GET: ${reactiveSystem._getObjectId(target)}.${String(key)}`, {
                    value: internal[key],
                    hasEffect: !!reactiveSystem.currentEffect,
                    effectId: reactiveSystem.currentEffect?.id
                });
                return internal[key];
            },
            set(newValue) {
                const oldValue = internal[key];
                if (oldValue === newValue) {
                    StitchDebug.log("reactivity", `SET SKIPPED (no change): ${reactiveSystem._getObjectId(target)}.${String(key)} = ${newValue}`);
                    return;
                }
                StitchDebug.log("reactivity", `⬇️ SET: ${reactiveSystem._getObjectId(target)}.${String(key)}`, {
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
            StitchDebug.log("computed", `COMPUTED DESCRIPTOR CREATED for ${String(key)} with explicit deps`, {
                deps: explicitDeps
            });
        } else {
            StitchDebug.log("computed", `COMPUTED DESCRIPTOR CREATED for ${String(key)}`);
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
                StitchDebug.log("computed", `Found computed property at: ${childKey}`, {
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
            Object.defineProperty(target, "_changeHandlers", {
                value: new Set,
                writable: false,
                enumerable: false,
                configurable: false
            });
        }
        if (StitchDebug.enabled && !target.__stitchId) {
            Object.defineProperty(target, "__stitchId", {
                value: `obj_${Math.random().toString(36).substr(2, 9)}`,
                writable: false,
                enumerable: false,
                configurable: false
            });
        }
        attachParent(target, parent, key);
        Object.defineProperty(target, "__isReactive", {
            value: true,
            writable: false,
            enumerable: false,
            configurable: false
        });
        
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
            StitchDebug.log("computed", `Creating computed descriptor for: ${propKey}`, {
                hasExplicitDeps: !!computedMarker.__explicitDeps
            });
            
            // Extract function and explicit dependencies
            const computeFn = computedMarker.fn;
            const explicitDeps = computedMarker.__explicitDeps;
            
            // Resolve explicit dependencies if provided
            let resolvedDeps = null;
            if (explicitDeps) {
                resolvedDeps = resolveDependencies(explicitDeps, target);
                StitchDebug.log("computed", `Resolved dependencies for "${propKey}":`, {
                    declared: explicitDeps,
                    resolved: resolvedDeps
                });
            }
            
            // Create computed descriptor
            propertyDescriptors[propKey] = createComputedDescriptor(target, propKey, computeFn, resolvedDeps);
        });
        
        // Add helper methods
        propertyDescriptors.on = {
            value: addChangeHandler.bind(target),
            writable: false,
            enumerable: false,
            configurable: false
        };
        propertyDescriptors.off = {
            value: removeChangeHandler.bind(target),
            writable: false,
            enumerable: false,
            configurable: false
        };
        propertyDescriptors.set = {
            value: setProperty.bind(null, target),
            writable: false,
            enumerable: false,
            configurable: false
        };
        propertyDescriptors.get = {
            value: getProperty.bind(null, target),
            writable: false,
            enumerable: false,
            configurable: false
        };
        propertyDescriptors.toJSON = {
            value: toJSON.bind(target),
            writable: false,
            enumerable: false,
            configurable: false
        };
        propertyDescriptors.$set = {
            value: function (key, value) {
                if (this.hasOwnProperty(key) && Object.getOwnPropertyDescriptor(this, key).get) {
                    this[key] = value;
                } else {
                    const descriptor = createReactiveDescriptor(this, key, internal);
                    Object.defineProperty(this, key, descriptor);
                    this[key] = value;
                }
            },
            writable: false,
            enumerable: false,
            configurable: false
        };
        
        Object.defineProperties(target, propertyDescriptors);
        return target;
    }

    /**
     * Makes Map reactive using Proxy.
     * Intercepts set, delete, clear, and accessors.
     * 
     * @param {Map} target - Map to make reactive
     * @param {Object|null} [parent=null] - Parent object
     * @param {string|null} [key=null] - Property key in parent
     * @returns {Proxy} Reactive Map proxy
     */
    function createReactiveMap(target, parent = null, key = null) {
        const cachedProxy = proxyMap.get(target);
        if (cachedProxy) {
            attachParent(target, parent, key);
            return cachedProxy;
        }

        if (!target._changeHandlers) {
            Object.defineProperty(target, "_changeHandlers", {
                value: new Set,
                writable: false,
                enumerable: false,
                configurable: false
            });
        }
        attachParent(target, parent, key);

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
                    // Bind methods to target
                    if (prop === 'get') {
                        return function(key) {
                            reactiveSystem.track(target, key);
                            return target.get(key);
                        }
                    }
                    if (prop === 'has') {
                        return function(key) {
                            reactiveSystem.track(target, key);
                            return target.has(key);
                        }
                    }
                    if (prop === 'set') {
                        return function(key, val) {
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
                        }
                    }
                    if (prop === 'delete') {
                        return function(key) {
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
                    }
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
     * Makes Set reactive using Proxy.
     * Intercepts add, delete, clear, and accessors.
     * 
     * @param {Set} target - Set to make reactive
     * @param {Object|null} [parent=null] - Parent object
     * @param {string|null} [key=null] - Property key in parent
     * @returns {Proxy} Reactive Set proxy
     */
    function createReactiveSet(target, parent = null, key = null) {
        const cachedProxy = proxyMap.get(target);
        if (cachedProxy) {
            attachParent(target, parent, key);
            return cachedProxy;
        }

        if (!target._changeHandlers) {
            Object.defineProperty(target, "_changeHandlers", {
                value: new Set,
                writable: false,
                enumerable: false,
                configurable: false
            });
        }
        attachParent(target, parent, key);

        const proxy = new Proxy(target, {
            get(target, prop, receiver) {
                if (prop === "__isReactive") return true;
                if (prop === "_changeHandlers") return target._changeHandlers;
                if (prop === "_parent") return target._parent;
                if (prop === "on") return addChangeHandler.bind(target);
                if (prop === "off") return removeChangeHandler.bind(target);

                if (prop === "size") {
                    reactiveSystem.track(target, "size");
                    return Reflect.get(target, prop, target);
                }

                const value = Reflect.get(target, prop, receiver);

                if (typeof value === 'function') {
                    if (prop === 'has') {
                        return function(key) {
                            const normalizedKey = normalizeSetLookup(key);
                            reactiveSystem.track(target, normalizedKey);
                            return target.has(normalizedKey);
                        }
                    }
                    if (prop === 'add') {
                        return function(val) {
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
                        }
                    }
                    if (prop === 'delete') {
                        return function(val) {
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
                    }
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
            Object.defineProperty(target, "_changeHandlers", {
                value: new Set,
                writable: false,
                enumerable: false,
                configurable: false
            });
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

                        // V2.1.0 FIX: Trigger synchronously for immediate computed invalidation
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
        let fn, explicitDeps;
        if (typeof config === "function") {
            fn = config;
            explicitDeps = null;
        } else if (typeof config === "object" && config.get) {
            fn = config.get;
            explicitDeps = config.deps || null;
            if (explicitDeps && !Array.isArray(explicitDeps)) {
                throw new Error(`[Stitch.js ${Version}] Stitch.computed() deps must be an array of property names.\n` + `Example: Stitch.computed({ get() { ... }, deps: ['prop1', 'prop2'] })`);
            }
        } else {
            throw new Error(`[Stitch.js ${Version}] Stitch.computed() expects either:\n` + `  - A function: Stitch.computed(function() { ... })\n` + `  - An object: Stitch.computed({ get() { ... }, deps: [...] })`);
        }
        
        // ⭐ OPTION 7 KEY CHANGE: Return standardized marker
        // reactive() will detect this and handle it uniformly
        return {
            __isStitchComputed: true,
            fn: fn,
            __explicitDeps: explicitDeps
        };
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
module.exports = {
    createReactiveFactory
};

  };
  __stitchModuleFactories["packages/browser/index.js"] = function(module, exports, __stitchRequire){
"use strict";

const VERSION = "2.1.0";
const foreachRenderingDelegates = __stitchRequire("packages/browser/src/foreach-rendering-delegates.js");
const foreachBindingOrchestrator = __stitchRequire("packages/browser/src/foreach-binding-orchestrator.js");
const bindingScanHelpers = __stitchRequire("packages/browser/src/binding-scan-helpers.js");
const bindingRuntime = __stitchRequire("packages/browser/src/binding-runtime.js");
const dataBinderFactory = __stitchRequire("packages/browser/src/data-binder.js");
const runtimeHelpers = __stitchRequire("packages/utils/src/runtime-helpers.js");
const debugConfig = __stitchRequire("packages/utils/src/debug-config.js");
const attrValueHandlers = __stitchRequire("packages/utils/src/attr-value-handlers.js");
const valueBindingHelpers = __stitchRequire("packages/utils/src/value-binding-helpers.js");
const typeConverters = __stitchRequire("packages/utils/src/type-converters.js");
const foreachTemplateHelpers = __stitchRequire("packages/utils/src/foreach-template-helpers.js");
const foreachReconcileHelpers = __stitchRequire("packages/utils/src/foreach-reconcile-helpers.js");

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

const renderingDelegateBundle = foreachRenderingDelegates.createRenderingDelegates({
    stitchDebug,
    getProperty: runtimeHelpers.getProperty,
    getValueValidator,
    createItemContext: foreachReconcileHelpers.createItemContext,
    createTemplateElement: foreachTemplateHelpers.createTemplateElement,
    reconcileRows: foreachReconcileHelpers.reconcileRows,
    doc: typeof document !== "undefined" ? document : null
});
const foreachDelegates = renderingDelegateBundle.FOREACH_RENDERING_DELEGATES;

function resolveExternalForeachIntegration() {
    return {
        bindForeach: foreachBindingOrchestrator.bindForeach,
        getRenderingDelegate: foreachRenderingDelegates.getRenderingDelegate,
        delegates: foreachDelegates
    };
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
    getRenderingDelegate(element) {
        return foreachRenderingDelegates.getRenderingDelegate(element, foreachDelegates);
    },
    propertyExists: runtimeHelpers.propertyExists,
    findSimilarProperty: runtimeHelpers.findSimilarProperty,
    resolveExternalForeachIntegration
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
    ...foreachRenderingDelegates,
    ...foreachBindingOrchestrator,
    ...bindingScanHelpers,
    ...bindingRuntime,
    ...dataBinderFactory
};

  };
  __stitchModuleFactories["packages/browser/src/binding-runtime.js"] = function(module, exports, __stitchRequire){
"use strict";

const NOOP_DEBUG = {
    enabled: false,
    categories: Object.create(null),
    log() {},
    group() {},
    groupEnd() {}
};

function createBindingRuntime(deps = {}) {
    const Version = deps.version || "v2.1.0";
    const StitchDebug = deps.debug || NOOP_DEBUG;
    const getProperty = deps.getProperty;
    const setProperty = deps.setProperty;
    const getValueHandler = deps.getValueHandler;
    const getValueValidator = deps.getValueValidator;
    const getTypeConverter = deps.getTypeConverter;
    const getAttrHandler = deps.getAttrHandler;
    const getRenderingDelegate = deps.getRenderingDelegate;
    const propertyExists = deps.propertyExists;
    const findSimilarProperty = deps.findSimilarProperty;
    const resolveExternalForeachIntegration = deps.resolveExternalForeachIntegration || function () { return null; };

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
            StitchDebug.log("bindings", `BINDING: value binding (two-way) for "${path}"`, {
                element: element.tagName,
                type: element.type
            });
            const handler = getValueHandler(element);
            const eff = context.reactiveSystem.effect(() => {
                const value = getProperty(viewModel, path);
                StitchDebug.log("bindings", `VALUE BINDING UPDATE (Model→View): "${path}" = ${value}`);
                handler.modelToView(element, value, viewModel, path);
            }, { batch: true });
            context.binder._trackCleanup(element, () => context.reactiveSystem.cleanup(eff));
            const updateModel = () => {
                const value = handler.viewToModel(element);
                StitchDebug.log("bindings", `VALUE BINDING UPDATE (View→Model): "${path}" = ${value}`);
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
            StitchDebug.log("bindings", `EVENT BINDING: "${path}"`, {
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
                        StitchDebug.log("bindings", `  Registering: ${eventName} → ${handlerPath}`, {
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
            StitchDebug.log("bindings", `BINDING: class binding for "${path}"`, {
                element: element.tagName,
                initialClasses: Array.from(element.classList)
            });
            const eff = context.reactiveSystem.effect(() => {
                const value = getProperty(viewModel, path);
                StitchDebug.log("bindings", `CLASS BINDING UPDATE: "${path}"`, {
                    element: element.tagName,
                    valueType: typeof value,
                    value: value
                });
                if (typeof value === "string") {
                    element.className = value;
                    StitchDebug.log("bindings", `  → Set className to: "${value}"`);
                } else if (value && typeof value === "object") {
                    Object.keys(value).forEach(className => {
                        const shouldHaveClass = !!value[className];
                        element.classList.toggle(className, shouldHaveClass);
                        StitchDebug.log("bindings", `  → Toggle "${className}": ${shouldHaveClass}`);
                    });
                    StitchDebug.log("bindings", `  → Final classList: ${Array.from(element.classList).join(", ")}`);
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
     * foreach binding - Reactive list rendering with smart reconciliation.
     * Delegates to element-specific handlers for specialized rendering.
     * Provides $data, $index, $parent context variables.
     */
    foreach: {
        bind(element, viewModel, path, context) {
            const external = resolveExternalForeachIntegration();
            if (external && typeof external.bindForeach === "function") {
                return external.bindForeach(element, viewModel, path, context, {
                    validateBinding: validateBinding,
                    getProperty: getProperty,
                    getRenderingDelegate: external.getRenderingDelegate,
                    foreachRenderingDelegates: external.delegates
                });
            }

            validateBinding(viewModel, path, "foreach", element);
            const templateSource = context.binder._getTemplateSource(element);
            const delegate = getRenderingDelegate(element);
            const config = delegate.prepareConfig(element, templateSource);
            element.innerHTML = "";
            const eff = context.reactiveSystem.effect(() => {
                const items = getProperty(viewModel, path);
                delegate.render(element, items, config, context.binder, viewModel, path);
            }, { batch: true });
            context.binder._trackCleanup(element, () => context.reactiveSystem.cleanup(eff));
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
  __stitchModuleFactories["packages/browser/src/binding-scan-helpers.js"] = function(module, exports, __stitchRequire){
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
  __stitchModuleFactories["packages/browser/src/data-binder.js"] = function(module, exports, __stitchRequire){
"use strict";

const NOOP_DEBUG = {
    enabled: false,
    categories: Object.create(null),
    log() {},
    group() {},
    groupEnd() {}
};

function createDataBinderClass(deps = {}) {
    const Version = deps.version || "v2.1.0";
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
            StitchDebug.log("bindings", "Stopped at binding boundary: " + element.tagName);
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

        StitchDebug.log("bindings", `_applyTypedBinding called: type="${type}", path="${path}", fullPath="${fullPath}"`, {
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
            StitchDebug.log("bindings", `  → Using property hook onBind for "${fullPath}"`, {
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
            StitchDebug.log("bindings", `  → Setting up onChange reactive effect for "${fullPath}"`);

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
     * Extracts template for foreach binding.
     * Supports inline or external (data-template).
     * @private
     */
    _getTemplateSource(element) {
        const templateId = element.getAttribute("data-template");
        const useExternalTemplate = !!templateId;
        if (useExternalTemplate) {
            const templateElement = document.getElementById(templateId);
            if (!templateElement) {
                throw new Error(`Template '${templateId}' not found. Ensure <template id="${templateId}"> exists.`);
            }
            if (templateElement.tagName !== "TEMPLATE") {
                throw new Error(`Element '${templateId}' must be a <template> element, got <${templateElement.tagName.toLowerCase()}>.`);
            }
            const templateContent = templateElement.content.firstElementChild;
            if (!templateContent) {
                throw new Error(`Template '${templateId}' is empty. Add at least one child element inside <template>.`);
            }
            return templateContent.outerHTML;
        } else {
            return element.innerHTML;
        }
    }

    /**
     * Removes element from tracking (does NOT clean up effects).
     *
     * @param {string|HTMLElement} element - CSS selector or HTMLElement
     */
    unbind(element) {
        if (typeof element === "string") {
            element = document.querySelector(element);
        }
        if (element) {
            // 1. Remove from bound set
            if (this.boundElements.has(element)) {
                this.boundElements.delete(element);
            }
            
            // 2. Run cleanups
            const cleanups = this._elementCleanups.get(element);
            if (cleanups) {
                cleanups.forEach(fn => {
                    try { fn(); } catch(e) { console.error(e); }
                });
                this._elementCleanups.delete(element);
            }
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

        StitchDebug.log("bindings", "DataBinder disposed");
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
  __stitchModuleFactories["packages/browser/src/foreach-binding-orchestrator.js"] = function(module, exports, __stitchRequire){
"use strict";

/**
 * Orchestrates foreach binding lifecycle:
 * - validate binding path
 * - resolve template + rendering delegate
 * - install reactive effect
 * - track cleanup
 *
 * @param {HTMLElement} element
 * @param {Object} viewModel
 * @param {string} path
 * @param {Object} context
 * @param {Object} deps
 * @param {Function} deps.validateBinding
 * @param {Function} deps.getProperty
 * @param {Function} deps.getRenderingDelegate
 * @param {Object} deps.foreachRenderingDelegates
 * @returns {*}
 */
function bindForeach(element, viewModel, path, context, deps) {
    deps.validateBinding(viewModel, path, "foreach", element);

    const templateSource = context.binder._getTemplateSource(element);
    const delegate = deps.getRenderingDelegate(element, deps.foreachRenderingDelegates);
    const config = delegate.prepareConfig(element, templateSource);

    element.innerHTML = "";

    const eff = context.reactiveSystem.effect(() => {
        const items = deps.getProperty(viewModel, path);
        delegate.render(element, items, config, context.binder, viewModel, path);
    }, { batch: true });

    context.binder._trackCleanup(element, () => context.reactiveSystem.cleanup(eff));
    return eff;
}

/**
 * Builds a foreach binding handler compatible with BINDING_HANDLERS contract.
 *
 * @param {Object} deps
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
    createForeachBindingHandler
};

  };
  __stitchModuleFactories["packages/browser/src/foreach-rendering-delegates.js"] = function(module, exports, __stitchRequire){
"use strict";

/**
 * Standard item rendering with full re-render on every change.
 *
 * @param {HTMLElement} element
 * @param {Array} items
 * @param {string} templateSource
 * @param {Object} binder
 * @param {Object} viewModel
 * @param {Object} deps
 * @param {Function} deps.createItemContext
 * @param {Function} deps.createTemplateElement
 */
function renderItemsStandard(element, items, templateSource, binder, viewModel, deps) {
    const containerTag = element.tagName.toLowerCase();
    items.forEach((item, index) => {
        const itemContext = deps.createItemContext(item, index, viewModel);
        const templateEl = deps.createTemplateElement(templateSource, containerTag);
        binder._bindElement(templateEl, itemContext, []);
        element.appendChild(templateEl);
    });
}

/**
 * Smart item rendering with DOM reconciliation.
 *
 * @param {HTMLElement} element
 * @param {Array} items
 * @param {string} templateSource
 * @param {Object} binder
 * @param {Object} viewModel
 * @param {Object} deps
 * @param {Function} deps.reconcileRows
 * @param {Function} deps.createItemContext
 * @param {Object} deps.stitchDebug
 */
function renderItemsSmart(element, items, templateSource, binder, viewModel, deps) {
    const containerTag = element.tagName.toLowerCase();
    const stitchDebug = deps.stitchDebug;

    if (stitchDebug && stitchDebug.enabled && items.length > 0 && typeof items[0] === "object" && items[0] !== null) {
        const firstItem = items[0];
        if (!firstItem.hasOwnProperty("id") && !firstItem.hasOwnProperty("key")) {
            stitchDebug.log("warnings", `Performance Warning: foreach items in <${containerTag}> are objects but missing 'id' or 'key' property.`, {
                element: element,
                hint: "Add an 'id' or 'key' property to your items to enable smart DOM reconciliation."
            });
        }
    }

    const rows = deps.reconcileRows(element, items, templateSource, containerTag);
    items.forEach((item, index) => {
        const row = rows[index];
        const itemContext = deps.createItemContext(item, index, viewModel);
        if (!row._stitchItemContext) {
            binder._bindElement(row, itemContext, []);
            row._stitchItemContext = itemContext;
        } else {
            row._stitchItemContext = itemContext;
            row._stitchItemContext.$index = index;
        }
    });
}

/**
 * Builds foreach rendering delegates with injected dependencies.
 *
 * @param {Object} deps
 * @param {Object} [deps.stitchDebug]
 * @param {Function} deps.getProperty
 * @param {Function} deps.getValueValidator
 * @param {Function} deps.createItemContext
 * @param {Function} deps.createTemplateElement
 * @param {Function} deps.reconcileRows
 * @param {Document} [deps.doc]
 * @returns {Object}
 */
function createRenderingDelegates(deps) {
    const stitchDebug = deps.stitchDebug || { enabled: false, log: function () {} };
    const getProperty = deps.getProperty;
    const getValueValidator = deps.getValueValidator;
    const doc = deps.doc || (typeof document !== "undefined" ? document : null);

    const renderStandard = function (element, items, templateSource, binder, viewModel) {
        return renderItemsStandard(element, items, templateSource, binder, viewModel, deps);
    };
    const renderSmart = function (element, items, templateSource, binder, viewModel) {
        return renderItemsSmart(element, items, templateSource, binder, viewModel, {
            reconcileRows: deps.reconcileRows,
            createItemContext: deps.createItemContext,
            stitchDebug
        });
    };

    const SELECT_RENDERING_DELEGATE = {
        prepareConfig(element, templateSource) {
            return {
                templateSource: templateSource,
                placeholderText: element.getAttribute("data-default-text"),
                placeholderValue: element.getAttribute("data-default-value") || "",
                hasPlaceholder: !!element.getAttribute("data-default-text")
            };
        },
        render(element, items, config, binder, viewModel, path) {
            if (stitchDebug.enabled && Array.isArray(items) && items.length > 100) {
                stitchDebug.log("warnings", `Performance Warning: <select> with ${items.length} items triggers full re-render on every update.`, {
                    element: element,
                    hint: "Consider using a virtualization library or custom component for large dropdowns."
                });
            }

            const valuePath = element.getAttribute("data-value");
            const currentValue = valuePath ? getProperty(viewModel, valuePath) : element.value;
            element.innerHTML = "";

            if (config.hasPlaceholder) {
                if (!doc) {
                    throw new Error("createRenderingDelegates requires a document instance for select placeholder rendering.");
                }
                const placeholderOpt = doc.createElement("option");
                placeholderOpt.value = config.placeholderValue;
                placeholderOpt.textContent = config.placeholderText;
                element.appendChild(placeholderOpt);
            }

            if (Array.isArray(items)) {
                renderStandard(element, items, config.templateSource, binder, viewModel);
            }

            if (currentValue !== undefined && currentValue !== null) {
                if (valuePath) {
                    const validator = getValueValidator(element);
                    const validValue = validator.validate(element, currentValue, viewModel, valuePath, "render");
                    if (validValue !== undefined) {
                        element.value = validValue;
                    }
                } else if (config.hasPlaceholder) {
                    element.value = config.placeholderValue;
                }
            } else if (config.hasPlaceholder) {
                element.value = config.placeholderValue;
            }
        }
    };

    const LIST_RENDERING_DELEGATE = {
        prepareConfig(element, templateSource) {
            return {
                templateSource: templateSource
            };
        },
        render(element, items, config, binder, viewModel, path) {
            if (Array.isArray(items)) {
                renderSmart(element, items, config.templateSource, binder, viewModel);
            } else {
                element.innerHTML = "";
            }
        }
    };

    const TABLE_RENDERING_DELEGATE = {
        prepareConfig(element, templateSource) {
            return {
                templateSource: templateSource
            };
        },
        render(element, items, config, binder, viewModel, path) {
            if (Array.isArray(items)) {
                renderSmart(element, items, config.templateSource, binder, viewModel);
            } else {
                element.innerHTML = "";
            }
        }
    };

    const DEFAULT_RENDERING_DELEGATE = {
        prepareConfig(element, templateSource) {
            return {
                templateSource: templateSource
            };
        },
        render(element, items, config, binder, viewModel, path) {
            if (Array.isArray(items)) {
                renderSmart(element, items, config.templateSource, binder, viewModel);
            } else {
                element.innerHTML = "";
            }
        }
    };

    const FOREACH_RENDERING_DELEGATES = {
        select: SELECT_RENDERING_DELEGATE,
        ul: LIST_RENDERING_DELEGATE,
        ol: LIST_RENDERING_DELEGATE,
        tbody: TABLE_RENDERING_DELEGATE,
        thead: TABLE_RENDERING_DELEGATE,
        tfoot: TABLE_RENDERING_DELEGATE,
        default: DEFAULT_RENDERING_DELEGATE
    };

    return {
        SELECT_RENDERING_DELEGATE,
        LIST_RENDERING_DELEGATE,
        TABLE_RENDERING_DELEGATE,
        DEFAULT_RENDERING_DELEGATE,
        FOREACH_RENDERING_DELEGATES
    };
}

/**
 * Selects rendering delegate by tag name.
 *
 * @param {HTMLElement} element
 * @param {Object} delegates
 * @returns {Object}
 */
function getRenderingDelegate(element, delegates) {
    const tagName = element.tagName.toLowerCase();
    return delegates[tagName] || delegates.default;
}

module.exports = {
    renderItemsStandard,
    renderItemsSmart,
    createRenderingDelegates,
    getRenderingDelegate
};

  };
  __stitchModuleFactories["packages/core/index.js"] = function(module, exports, __stitchRequire){
"use strict";

const VERSION = "2.1.0";
const { MessageBus } = __stitchRequire("packages/core/src/message-bus.js");
const { BatchScheduler } = __stitchRequire("packages/core/src/batch-scheduler.js");
const { ComputedRef } = __stitchRequire("packages/core/src/computed-ref.js");
const { ReactiveSystem } = __stitchRequire("packages/core/src/reactive-system.js");

module.exports = {
    MessageBus,
    version: VERSION,
    CoreMessageBus: MessageBus,
    BatchScheduler,
    ComputedRef,
    ReactiveSystem
};

  };
  __stitchModuleFactories["packages/core/src/batch-scheduler.js"] = function(module, exports, __stitchRequire){
"use strict";

const NOOP_DEBUG = {
    enabled: false,
    categories: Object.create(null),
    log() {},
    group() {},
    groupEnd() {}
};

class BatchScheduler {
    constructor(options = {}) {
        this.version = options.version || "v2.1.0";
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

        this.debug.group("effects", `Flushing BatchScheduler (${this._pendingEffects.size} effects, depth: ${this.flushDepth})`);

        const effectsToRun = Array.from(this._pendingEffects);
        this._pendingEffects.clear();

        effectsToRun.forEach((effect) => {
            try {
                effect();
            } catch (error) {
                console.error(`[Stitch.js ${this.version} BatchScheduler] Error in effect:`, error);
            }
        });

        this.debug.groupEnd("effects");

        this.flushing = false;
        if (this._pendingEffects.size > 0) {
            this.debug.log("effects", `New effects queued during flush (${this._pendingEffects.size}), scheduling next flush`);
            this.scheduleFlush();
        } else {
            this.flushDepth = 0;
        }
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
  __stitchModuleFactories["packages/core/src/computed-ref.js"] = function(module, exports, __stitchRequire){
"use strict";

class ComputedRef {
    constructor(getter, reactiveSystem, context, explicitDeps = null) {
        this.getter = getter;
        this.reactiveSystem = reactiveSystem;
        this.context = context;
        this.explicitDeps = explicitDeps;
        this.value = undefined;
        this.dirty = true;
        this.dependents = new Set();
        this.deps = new Set();
        this.id = Math.random().toString(36).substr(2, 9);
        this.isComputedRef = true;

        this.reactiveSystem.debug.log("computed", `COMPUTED REF CREATED (id: ${this.id})`, {
            hasExplicitDeps: !!explicitDeps,
            explicitDeps
        });
    }

    markDirty() {
        if (this.dirty) {
            return;
        }

        this.reactiveSystem.debug.log("computed", `COMPUTED MARKED DIRTY (id: ${this.id})`);
        this.dirty = true;

        this.dependents.forEach((dependent) => {
            if (dependent.isComputedRef) {
                dependent.markDirty();
            } else if (dependent.options && dependent.options.batch) {
                this.reactiveSystem.batchScheduler.queue(dependent);
            } else {
                dependent();
            }
        });
    }

    evaluate() {
        this.reactiveSystem.debug.log("computed", `COMPUTING VALUE (id: ${this.id})`);
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

            this.reactiveSystem.debug.log("computed", `COMPUTED VALUE (id: ${this.id})`, {
                value: this.value,
                deps: this.deps.size
            });

            return this.value;
        } finally {
            this.reactiveSystem.effectStack.pop();
        }
    }

    get() {
        const currentEffect = this.reactiveSystem.currentEffect;
        if (currentEffect) {
            this.dependents.add(currentEffect);
            this.reactiveSystem.debug.log(
                "computed",
                `COMPUTED TRACKED (id: ${this.id}) by effect ${currentEffect.id || "unknown"}`
            );
        }

        if (this.dirty) {
            return this.evaluate();
        }

        this.reactiveSystem.debug.log("computed", `COMPUTED CACHED (id: ${this.id})`, {
            value: this.value
        });
        return this.value;
    }

    cleanup() {
        this.deps.forEach((dep) => {
            dep.delete(this);
        });
        this.deps.clear();
    }
}

module.exports = {
    ComputedRef
};

  };
  __stitchModuleFactories["packages/core/src/message-bus.js"] = function(module, exports, __stitchRequire){
"use strict";

const NOOP_DEBUG = {
    enabled: false,
    categories: Object.create(null),
    log() {},
    group() {},
    groupEnd() {}
};

class MessageBus {
    constructor(options = {}) {
        this.version = options.version || "v2.1.0";
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
        this.debug.log("messageBus", `Subscribed to event: "${event}"`, {
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
        this.debug.log("messageBus", `Published event: "${event}" (queued)`, {
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

        this.debug.group("messageBus", `Flushing Message Bus (${eventsToProcess.length} events, depth: ${this.flushDepth})`);
        eventsToProcess.forEach((eventData) => {
            this._executeEvent(eventData);
        });
        this.debug.groupEnd("messageBus");

        this.isFlushing = false;
        if (this.queue.length > 0) {
            this.debug.log(
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

        this.debug.log("messageBus", `Executing event: "${event}"`, {
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
  __stitchModuleFactories["packages/core/src/reactive-system.js"] = function(module, exports, __stitchRequire){
"use strict";

const { MessageBus, NOOP_DEBUG } = __stitchRequire("packages/core/src/message-bus.js");
const { BatchScheduler } = __stitchRequire("packages/core/src/batch-scheduler.js");

class ReactiveSystem {
    constructor(bubbleChangeUp = null, options = {}) {
        this.version = options.version || "v2.1.0";
        this.debug = options.debug || NOOP_DEBUG;
        this.effects = new Set();
        this.effectStack = [];
        this.depsMap = new WeakMap();

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

        if (!currentEffect) {
            this.debug.log("reactivity", `TRACK SKIPPED (no current effect): ${this._getObjectId(target)}.${String(key)}`);
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

        dep.add(currentEffect);
        if (currentEffect.deps) {
            currentEffect.deps.add(dep);
        }

        this.debug.log("reactivity", `TRACK: ${this._getObjectId(target)}.${String(key)} -> ${currentEffect.id || "unknown"}`, {
            effectId: currentEffect.id,
            isComputed: !!currentEffect.isComputedRef,
            dependencyCount: dep.size
        });
    }

    trigger(target, key, oldValue, newValue) {
        const deps = this.depsMap.get(target);
        const dep = deps?.get(key);

        if (!dep || dep.size === 0) {
            this.debug.log("reactivity", `TRIGGER SKIPPED (no deps): ${this._getObjectId(target)}.${String(key)}`);
            return;
        }

        this.debug.log("reactivity", `TRIGGER: ${this._getObjectId(target)}.${String(key)} (${dep.size} dependents)`, {
            oldValue,
            newValue
        });

        const effectsToRun = new Set(dep);
        effectsToRun.forEach((dependent) => {
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

    effect(fn, options = {}) {
        const effectId = Math.random().toString(36).substr(2, 9);

        const effect = () => {
            this.cleanup(effect);
            this.effectStack.push(effect);

            this.debug.log("effects", `EFFECT RUNNING (id: ${effectId})`, {
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

        this.debug.log("effects", `EFFECT CREATED (id: ${effectId})`, {
            lazy: !!options.lazy,
            batch: !!options.batch
        });

        if (!options.lazy) {
            effect();
        }

        return effect;
    }

    cleanup(effect) {
        effect.deps.forEach((dep) => {
            dep.delete(effect);
        });
        effect.deps.clear();
    }
}

module.exports = {
    ReactiveSystem
};

  };
  __stitchModuleFactories["packages/utils/index.js"] = function(module, exports, __stitchRequire){
"use strict";

const VERSION = "2.1.0";
const helpers = __stitchRequire("packages/utils/src/runtime-helpers.js");
const debugConfig = __stitchRequire("packages/utils/src/debug-config.js");
const attrValueHandlers = __stitchRequire("packages/utils/src/attr-value-handlers.js");
const valueBindingHelpers = __stitchRequire("packages/utils/src/value-binding-helpers.js");
const typeConverters = __stitchRequire("packages/utils/src/type-converters.js");
const foreachTemplateHelpers = __stitchRequire("packages/utils/src/foreach-template-helpers.js");
const foreachReconcileHelpers = __stitchRequire("packages/utils/src/foreach-reconcile-helpers.js");
const reactiveObjectHelpers = __stitchRequire("packages/utils/src/reactive-object-helpers.js");

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
    ...foreachTemplateHelpers,
    ...foreachReconcileHelpers,
    ...reactiveObjectHelpers
};

  };
  __stitchModuleFactories["packages/utils/src/attr-value-handlers.js"] = function(module, exports, __stitchRequire){
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
  __stitchModuleFactories["packages/utils/src/debug-config.js"] = function(module, exports, __stitchRequire){
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

module.exports = {
    DEFAULT_DEBUG_CATEGORIES,
    DEFAULT_DEBUG_COLORS,
    createDebugState,
    listDebugCategories,
    isKnownDebugCategory,
    formatUnknownCategoryWarning
};

  };
  __stitchModuleFactories["packages/utils/src/foreach-reconcile-helpers.js"] = function(module, exports, __stitchRequire){
"use strict";

const { createTemplateElement: defaultCreateTemplateElement } = __stitchRequire("packages/utils/src/foreach-template-helpers.js");

/**
 * Creates item context object with $data, $index, $parent for foreach templates.
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

/**
 * Generates a stable key for array reconciliation.
 *
 * @param {*} item
 * @param {number} index
 * @returns {string}
 */
function getItemKey(item, index) {
    if (typeof item === "object" && item !== null) {
        if (item.id !== undefined) return `item-${item.id}`;
        if (item.key !== undefined) return `item-${item.key}`;
    }
    return `item-${index}`;
}

/**
 * Reconciles container rows by keyed reuse and creation.
 *
 * @param {HTMLElement} container
 * @param {Array} newItems
 * @param {string} templateSource
 * @param {string} containerTag
 * @param {Object} [deps]
 * @param {Function} [deps.createTemplateElement]
 * @returns {HTMLElement[]}
 */
function reconcileRows(container, newItems, templateSource, containerTag, deps = {}) {
    const createTemplate = deps.createTemplateElement || defaultCreateTemplateElement;

    const existingRows = Array.from(container.children);
    const newRowElements = [];
    const existingRowsByKey = new Map();

    existingRows.forEach((row, index) => {
        const key = row.dataset.stitchKey || `item-${index}`;
        existingRowsByKey.set(key, row);
    });

    newItems.forEach((item, index) => {
        const key = getItemKey(item, index);
        if (existingRowsByKey.has(key)) {
            const existingRow = existingRowsByKey.get(key);
            newRowElements.push(existingRow);
            existingRowsByKey.delete(key);
        } else {
            const templateEl = createTemplate(templateSource, containerTag);
            templateEl.dataset.stitchKey = key;
            newRowElements.push(templateEl);
        }
    });

    existingRowsByKey.forEach(row => {
        row.remove();
    });

    newRowElements.forEach((row, index) => {
        if (container.children[index] !== row) {
            container.insertBefore(row, container.children[index] || null);
        }
    });

    return newRowElements;
}

module.exports = {
    createItemContext,
    getItemKey,
    reconcileRows
};

  };
  __stitchModuleFactories["packages/utils/src/foreach-template-helpers.js"] = function(module, exports, __stitchRequire){
"use strict";

/**
 * Configuration registry for HTML container-specific template parsing.
 */
const FOREACH_CONTAINER_HANDLERS = {
    tbody: {
        wrapperTag: "table",
        innerTag: "tbody",
        needsWrapper: true
    },
    thead: {
        wrapperTag: "table",
        innerTag: "thead",
        needsWrapper: true
    },
    tfoot: {
        wrapperTag: "table",
        innerTag: "tfoot",
        needsWrapper: true
    },
    ul: {
        containerTag: "ul",
        needsWrapper: false
    },
    ol: {
        containerTag: "ol",
        needsWrapper: false
    },
    select: {
        containerTag: "select",
        needsWrapper: false
    },
    default: {
        containerTag: "div",
        needsWrapper: false
    }
};

/**
 * Creates temporary DOM container for parsing template HTML strings.
 *
 * @param {string} template
 * @param {Object} handler
 * @param {Document} [doc]
 * @returns {{container: HTMLElement, inner: HTMLElement|null}}
 */
function createTempContainer(template, handler, doc = (typeof document !== "undefined" ? document : null)) {
    if (!doc) {
        throw new Error("createTempContainer requires a document instance.");
    }
    if (handler.needsWrapper) {
        const wrapper = doc.createElement(handler.wrapperTag);
        const inner = doc.createElement(handler.innerTag);
        inner.innerHTML = template;
        wrapper.appendChild(inner);
        return {
            container: wrapper,
            inner
        };
    }
    const container = doc.createElement(handler.containerTag);
    container.innerHTML = template;
    return {
        container,
        inner: null
    };
}

/**
 * Extracts template elements from a temporary container result.
 *
 * @param {{container: HTMLElement, inner: HTMLElement|null}} tempContainerResult
 * @returns {HTMLElement[]}
 */
function extractElements(tempContainerResult) {
    const source = tempContainerResult.inner || tempContainerResult.container;
    return Array.from(source.children);
}

/**
 * Creates template DOM element from HTML string.
 *
 * @param {string} templateSource
 * @param {string} containerTag
 * @param {Object} [options]
 * @param {Object} [options.handlers]
 * @param {Document} [options.doc]
 * @returns {HTMLElement|undefined}
 */
function createTemplateElement(templateSource, containerTag, options = {}) {
    const handlers = options.handlers || FOREACH_CONTAINER_HANDLERS;
    const handler = handlers[containerTag] || handlers.default;
    const tempResult = createTempContainer(templateSource, handler, options.doc);
    const templateElements = extractElements(tempResult);
    return templateElements[0];
}

module.exports = {
    FOREACH_CONTAINER_HANDLERS,
    createTempContainer,
    extractElements,
    createTemplateElement
};

  };
  __stitchModuleFactories["packages/utils/src/reactive-object-helpers.js"] = function(module, exports, __stitchRequire){
"use strict";

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
    addChangeHandler,
    removeChangeHandler,
    toJSON
};

  };
  __stitchModuleFactories["packages/utils/src/runtime-helpers.js"] = function(module, exports, __stitchRequire){
"use strict";

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
 * @param {string} [options.version='2.1.0']
 * @param {boolean} [options.debugEnabled=false]
 * @returns {*}
 */
function getProperty(target, path, options = {}) {
    const version = options.version || "2.1.0";
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
  __stitchModuleFactories["packages/utils/src/type-converters.js"] = function(module, exports, __stitchRequire){
"use strict";

const DEFAULT_VERSION = "2.1.0";

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
  __stitchModuleFactories["packages/utils/src/value-binding-helpers.js"] = function(module, exports, __stitchRequire){
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
  var __stitchModuleCache = Object.create(null);
  function __stitchNormalize(id){
    if (!id) return id;
    var normalized = String(id).replace(/\\/g, '/');
    if (normalized.indexOf('./') === 0) normalized = normalized.slice(2);
    return normalized;
  }
  function __stitchRequire(id){
    var normalized = __stitchNormalize(id);
    var factory = __stitchModuleFactories[normalized];
    if (!factory) throw new Error('Stitch assembly missing inline module: ' + normalized);
    if (__stitchModuleCache[normalized]) return __stitchModuleCache[normalized].exports;
    var module = { exports: {} };
    __stitchModuleCache[normalized] = module;
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
 * Stitch.js v2.1.0
 * Generated distribution entry. Source of truth is package modules under packages/*.
 */
(function () {
    "use strict";

    const api = (typeof __stitchInlineRequire === "function" ? (__stitchInlineRequire("./packages/api/index.js") || require("./packages/api/index.js")) : require("./packages/api/index.js"));
    const browser = (typeof __stitchInlineRequire === "function" ? (__stitchInlineRequire("./packages/browser/index.js") || require("./packages/browser/index.js")) : require("./packages/browser/index.js"));
    const core = (typeof __stitchInlineRequire === "function" ? (__stitchInlineRequire("./packages/core/index.js") || require("./packages/core/index.js")) : require("./packages/core/index.js"));
    const utils = (typeof __stitchInlineRequire === "function" ? (__stitchInlineRequire("./packages/utils/index.js") || require("./packages/utils/index.js")) : require("./packages/utils/index.js"));

    if (!api || !browser || !core || !utils) {
        throw new Error("Stitch.js bootstrap failed: one or more package modules could not be resolved.");
    }

    const Observable = api.Observable;
    const computed = api.computed || (Observable && Observable.computed);
    const DataBinder = browser.DataBinder;
    const MessageBus = core.MessageBus;
    const version = api.version || core.version || browser.version || utils.version || "2.1.0";
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
