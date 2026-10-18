"use strict";

const { ReactiveSystem } = require("../../core/src/reactive-system");
const { ComputedRef } = require("../../core/src/computed-ref");
const { MessageBus } = require("../../core/src/message-bus");
const runtimeHelpers = require("../../utils/src/runtime-helpers");
const objectHelpers = require("../../utils/src/reactive-object-helpers");
const { VERSION } = require("../../utils/src/version");
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
    const ReactiveSystemClass = options.ReactiveSystem || ReactiveSystem;
    const ComputedRefClass = options.ComputedRef || ComputedRef;
    const isArrowFunction = options.isArrowFunction || runtimeHelpers.isArrowFunction;
    const setProperty = options.setProperty || runtimeHelpers.setProperty;
    const getProperty = options.getProperty || runtimeHelpers.getProperty;
    const assertPathExists = runtimeHelpers.assertPathExists;
    // D28: the helpers Stitch puts on every model object are $-prefixed, so data fields may be
    // named on, off, get or set. toJSON stays reserved (JSON.stringify calls it), and so do
    // the $-names: a data field with one of them would be overwritten by the helper.
    const RESERVED_NAMES = ["toJSON", "$on", "$off", "$get", "$set", "$emit", "$once", "$use", "$watch"];
    // The v2 helper names: where no data field has the name, calling it throws a pointer to
    // the $-name instead of "undefined is not a function".
    const OLD_HELPERS = ["on", "off", "get", "set"];

    /** The keys from the model down to obj (array indexes as numbers). */
    function pathParts(obj) {
        const parts = [];
        const seen = new Set();
        let current = obj;
        while (current && current._parent && current._parent.obj && !seen.has(current)) {
            seen.add(current);
            parts.unshift(current._parent.key);
            current = current._parent.obj;
        }
        return parts;
    }

    function formatPath(parts) {
        return parts.reduce((text, part) => {
            if (typeof part === "number" || /^\d+$/.test(String(part))) return `${text}[${part}]`;
            return text ? `${text}.${part}` : String(part);
        }, "");
    }

    function reservedError(parts) {
        const name = String(parts[parts.length - 1]);
        const why = name === "toJSON"
            ? "JSON.stringify calls a property named toJSON, and Stitch defines toJSON() on every model object to serialise it"
            : `Stitch defines ${name}() on every model object`;
        return new Error(
            `[Stitch.js ${Version}] "${formatPath(parts)}" is reserved: ${why}, so a data field with that name would be ` +
            `overwritten. Rename the field when the data arrives (e.g. to "${name.replace(/^\$/, "")}Value").`
        );
    }

    function checkReservedKeys(obj, parts) {
        for (const name of Object.keys(obj)) {
            if (RESERVED_NAMES.indexOf(name) !== -1) {
                throw reservedError(parts.concat(name));
            }
        }
    }

    /** Array items are made reactive when first read; their keys are checked when they arrive. */
    function checkArrayItems(items, arrayParts, firstIndex) {
        items.forEach((item, i) => {
            if (item && typeof item === "object" && !item.__isReactive && !Array.isArray(item)
                && !(item instanceof Map) && !(item instanceof Set)) {
                checkReservedKeys(item, arrayParts.concat(firstIndex + i));
            }
        });
    }

    function oldHelperStub(name) {
        return function () {
            throw new TypeError(
                `[Stitch.js ${Version}] .${name}() is now .$${name}() in Stitch v3: the helpers are $-prefixed, so that data ` +
                "fields can be named on, off, get or set."
            );
        };
    }

    function eventBusOf(target) {
        if (!target._eventBus) {
            defineHidden(target, "_eventBus", new MessageBus({ version: Version }));
        }
        return target._eventBus;
    }

    /**
     * $on / $off / $emit / $once / $use for one model object (or collection).
     * $on(handler): a change handler (every write); $on(event, callback): an event.
     * $off(handler) / $off(event, callback) remove them (removing what is not there throws);
     * $off() with no argument removes every change handler. $off(event, callback) also removes
     * a pending $once(event, callback).
     */
    function createHelpers(target) {
        const pendingOnce = new Map(); // event -> Map(callback -> unsubscribe)
        return {
            $on(eventOrHandler, callback) {
                if (typeof eventOrHandler === "string") {
                    return eventBusOf(target).subscribe(eventOrHandler, callback);
                }
                return addChangeHandler.call(target, eventOrHandler);
            },
            $off(...args) {
                if (args.length === 0) {
                    return removeChangeHandler.call(target);
                }
                const [eventOrHandler, callback] = args;
                if (typeof eventOrHandler === "string") {
                    const once = pendingOnce.get(eventOrHandler);
                    if (once && once.has(callback)) {
                        const unsubscribe = once.get(callback);
                        once.delete(callback);
                        unsubscribe();
                        return undefined;
                    }
                    return eventBusOf(target).unsubscribe(eventOrHandler, callback);
                }
                return removeChangeHandler.call(target, eventOrHandler);
            },
            $emit(event, payload) {
                eventBusOf(target).publish(event, payload);
            },
            $once(event, callback) {
                if (typeof callback !== "function") {
                    throw new TypeError(`[Stitch.js ${Version}] $once(event, callback): callback must be a function, got ${typeof callback}.`);
                }
                const bus = eventBusOf(target);
                if (!pendingOnce.has(event)) pendingOnce.set(event, new Map());
                const once = pendingOnce.get(event);
                const unsubscribe = bus.subscribe(event, payload => {
                    // Unsubscribe first: "once" holds even when the callback throws.
                    unsubscribe();
                    once.delete(callback);
                    callback(payload);
                });
                once.set(callback, unsubscribe);
                return () => {
                    once.delete(callback);
                    unsubscribe();
                };
            },
            $use(middleware) {
                return eventBusOf(target).use(middleware);
            }
        };
    }
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
    reactiveSystem = new ReactiveSystemClass(bubbleChangeUp, { version: Version });

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
                return internal[key];
            },
            set(newValue) {
                const oldValue = internal[key];
                if (oldValue === newValue) {
                    return;
                }
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
        } else {
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
        // Known before the children are converted, so a nested error can name its full path.
        attachParent(obj, parent, key);
        
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
        // Names Stitch defines on every model object: a field with one of them would be
        // overwritten by the helper, silently.
        const ownParts = parent ? pathParts(parent).concat([key]) : [];
        checkReservedKeys(target, ownParts);
        computedProps.forEach((_marker, name) => {
            if (RESERVED_NAMES.indexOf(name) !== -1) throw reservedError(ownParts.concat(name));
        });
        // Add metadata
        if (!target._changeHandlers) {
            defineHidden(target, "_changeHandlers", new Set);
        }
        attachParent(target, parent, key);
        defineHidden(target, "__isReactive", true);
        
        const internal = {};
        const propertyDescriptors = {};
        
        // Process regular properties
        const keys = Object.keys(target).filter(k => !computedProps.has(k));
        keys.forEach(propKey => {
            const value = target[propKey];
            if (propKey.startsWith("_")) {
                return;
            }
            
            internal[propKey] = value;
            propertyDescriptors[propKey] = createReactiveDescriptor(target, propKey, internal);
        });
        
        // ⭐ OPTION 7 KEY CHANGE: Process computed properties
        computedProps.forEach((computedMarker, propKey) => {
            
            // Extract function and explicit dependencies
            const computeFn = computedMarker.fn;
            const explicitDeps = computedMarker.__explicitDeps;
            
            // Resolve explicit dependencies if provided
            let resolvedDeps = null;
            if (explicitDeps) {
                resolvedDeps = resolveDependencies(explicitDeps, target);
            }
            
            // Create computed descriptor
            propertyDescriptors[propKey] = createComputedDescriptor(target, propKey, computeFn, resolvedDeps);
        });
        
        Object.defineProperties(target, propertyDescriptors);

        // Add helper methods
        const helpers = createHelpers(target);
        for (const name of Object.keys(helpers)) {
            defineHidden(target, name, helpers[name]);
        }
        defineHidden(target, "$get", function (path) {
            assertPathExists(target, path, `$get("${path}")`);
            return getProperty(target, path);
        });
        defineHidden(target, "toJSON", toJSON.bind(target));
        // $set(path, value): writes an existing path; a single new key becomes a new reactive
        // property (the way to add one after create).
        defineHidden(target, "$set", function (path, value) {
            if (typeof path !== "string" || path === "") {
                throw new TypeError(`[Stitch.js ${Version}] $set(key, value): key must be a non-empty string, got ${typeof path}.`);
            }
            if (path.indexOf(".") === -1) {
                const descriptor = Object.getOwnPropertyDescriptor(target, path);
                if (descriptor && descriptor.get) {
                    target[path] = value;
                } else {
                    if (RESERVED_NAMES.indexOf(path) !== -1) throw reservedError(pathParts(target).concat(path));
                    Object.defineProperty(target, path, createReactiveDescriptor(target, path, internal));
                    target[path] = value;
                }
                return;
            }
            assertPathExists(target, path, `$set("${path}")`);
            setProperty(target, path, value);
        });
        for (const name of OLD_HELPERS) {
            if (!Object.prototype.hasOwnProperty.call(target, name)) {
                Object.defineProperty(target, name, { value: oldHelperStub(name), enumerable: false, configurable: true, writable: false });
            }
        }

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
        const helpers = createHelpers(target);

        const proxy = new Proxy(target, {
            get(target, prop, receiver) {
                if (prop === "__isReactive") return true;
                if (prop === "_changeHandlers") return target._changeHandlers;
                if (prop === "_parent") return target._parent;
                if (Object.prototype.hasOwnProperty.call(helpers, prop)) return helpers[prop];
                if (prop === "on" || prop === "off") return oldHelperStub(prop);

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
        checkArrayItems(target, parent ? pathParts(parent).concat([key]) : [], 0);
        if (!target._changeHandlers) {
            defineHidden(target, "_changeHandlers", new Set);
        }
        attachParent(target, parent, key);
        const helpers = createHelpers(target);

        const proxy = new Proxy(target, {
            get(target, key, receiver) {
                if (key === "__isReactive") return true;
                if (key === "_changeHandlers") return target._changeHandlers;
                if (key === "_parent") return target._parent;
                if (typeof key === "string" && Object.prototype.hasOwnProperty.call(helpers, key)) return helpers[key];
                if (key === "on" || key === "off" || key === "get" || key === "set") return oldHelperStub(key);
                reactiveSystem.track(target, key);
                if (arrayMethods.includes(key)) {
                    return function (...args) {
                        // New items: their keys are checked now, with the index they will take.
                        const arrayParts = pathParts(target);
                        if (key === "push") checkArrayItems(args, arrayParts, target.length);
                        else if (key === "unshift") checkArrayItems(args, arrayParts, 0);
                        else if (key === "splice") {
                            const start = args[0] < 0 ? Math.max(target.length + args[0], 0) : Math.min(args[0] || 0, target.length);
                            checkArrayItems(args.slice(2), arrayParts, start);
                        } else if (key === "fill") checkArrayItems([args[0]], arrayParts, 0);
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
                throw new Error(`[Stitch.js ${Version}] Stitch.computed() deps form a cycle: ${Array.from(visited).join(" → ")} → ${depKey}. ` +
                    "Remove the computed from its own dependency chain.");
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
