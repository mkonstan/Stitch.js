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
    const RESERVED_NAMES = ["toJSON", "$on", "$off", "$onChange", "$offChange", "$get", "$set", "$emit", "$once", "$use", "$watch"];
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

    // parts: the path to obj, or a function returning it (built only for the error).
    function checkReservedKeys(obj, parts) {
        for (const name of Object.keys(obj)) {
            if (RESERVED_NAMES.indexOf(name) !== -1) {
                throw reservedError((typeof parts === "function" ? parts() : parts).concat(name));
            }
        }
    }

    /** Array items are made reactive when first read; their keys are checked when they arrive. */
    function checkArrayItems(items, arrayParts, firstIndex, container) {
        items.forEach((item, i) => {
            const parts = arrayParts.concat(firstIndex + i);
            if (!item || typeof item !== "object") return;
            if (item.__isReactive) {
                checkIncoming(item, container, parts);
                return;
            }
            if (!Array.isArray(item) && !(item instanceof Map) && !(item instanceof Set)) {
                checkReservedKeys(item, parts);
                // A model one level down in a plain row is caught now, not when the row is read.
                for (const name of Object.keys(item)) {
                    checkIncoming(item[name], container, parts.concat(name));
                }
            }
        });
    }

    // ---- D30: one model = one root -------------------------------------------------

    /** The root model obj belongs to (the object carrying _factory up its _parent chain), or null. */
    function rootOfObject(obj) {
        const seen = new Set();
        let current = obj;
        while (current && typeof current === "object" && !seen.has(current)) {
            seen.add(current);
            if (Object.prototype.hasOwnProperty.call(current, "_factory")) return current;
            const parentLink = current._parent;
            if (!parentLink || !parentLink.obj) return null;
            current = parentLink.obj;
        }
        return null;
    }

    function nestingError(parts, what) {
        const last = parts[parts.length - 1];
        const name = typeof last === "string" && !/^\d+$/.test(last) ? last : "value";
        return new Error(
            `[Stitch.js ${Version}] cannot put ${what} at "${formatPath(parts) || "(the model)"}": A model cannot be nested in ` +
            `another model: assign plain data, or Observable.toRaw(${name}). One page model is one root; events, change ` +
            "handlers and bindings follow that root only."
        );
    }

    /**
     * D30: throws when value (already reactive) may not go into container: it is a model of
     * its own (a root), or it belongs to a different model. An object of the same model (or
     * one that belongs to none) may move.
     */
    function checkIncoming(value, container, parts) {
        if (!value || typeof value !== "object" || !value.__isReactive) return;
        if (Object.prototype.hasOwnProperty.call(value, "_factory")) {
            throw nestingError(parts, "a model");
        }
        const ownRoot = rootOfObject(value);
        if (ownRoot && ownRoot !== rootOfObject(container)) {
            const from = formatPath(pathParts(value));
            throw nestingError(parts, `an object that belongs to a different model${from ? ` (its "${from}")` : ""}`);
        }
    }

    /**
     * B7: a raw array / Map / Set that was already converted for a model (it carries
     * _changeHandlers) may only be reused within that same model (or if it belongs to none,
     * in the same factory). Otherwise two models would share one live object.
     */
    function claimRaw(target, parent, key) {
        if (!Object.prototype.hasOwnProperty.call(target, "_changeHandlers")) return;
        const ownRoot = rootOfObject(target);
        const sameFactory = proxyMap.has(target);
        if (!sameFactory || (ownRoot && ownRoot !== rootOfObject(parent))) {
            const parts = parent ? pathParts(parent).concat([key]) : [key];
            const last = parts[parts.length - 1];
            const name = typeof last === "string" && !/^\d+$/.test(last) ? last : "list";
            const copy = target instanceof Map ? `new Map(${name})` : target instanceof Set ? `new Set(${name})` : `[...${name}]`;
            throw new Error(
                `[Stitch.js ${Version}] "${formatPath(parts) || name}" already belongs to a model; give each model its own copy (${copy}). ` +
                "The same array, Map or Set in two models would be one live object with two owners: it belongs to a different model."
            );
        }
    }

    /** Points a raw (array / Map / Set) target's parent link at its new place. */
    function repointRaw(target, parent, key) {
        if (!parent) return;
        addLink(target, parent, key);
    }

    /** A moved object's parent link follows it, so writes bubble from (and errors name) its new place. */
    function repoint(value, parentObj, key) {
        if (!value || typeof value !== "object" || !value.__isReactive || !parentObj) return;
        addLink(value, parentObj, key);
    }

    // v2 name -> v3 name (on() registered a change handler in v2).
    const NEW_NAMES = { on: "$onChange", off: "$offChange", get: "$get", set: "$set" };

    function migrationError(name) {
        return new TypeError(
            `[Stitch.js ${Version}] .${name}() is now .${NEW_NAMES[name]}() in Stitch v3: the helpers are $-prefixed, so that ` +
            "data fields can be named on, off, get or set. Events: $on(event, callback) / $off(event, callback)."
        );
    }

    function oldHelperStub(name) {
        return function () {
            throw migrationError(name);
        };
    }

    /** A hidden accessor: calling it, or assigning to it, throws the migration message. */
    function defineOldHelperStub(target, name) {
        const stub = oldHelperStub(name);
        Object.defineProperty(target, name, {
            enumerable: false,
            configurable: true,
            get() { return stub; },
            set() { throw migrationError(name); }
        });
    }

    function eventBusOf(target) {
        if (!target._eventBus) {
            defineHidden(target, "_eventBus", new MessageBus({ version: Version }));
        }
        return target._eventBus;
    }

    function helperError(message) {
        return new TypeError(`[Stitch.js ${Version}] ${message}`);
    }

    /**
     * D29: events live on the root model only (the object Observable.create / createArray /
     * reactive returned; it alone carries _factory). Nested objects, list rows, arrays, Maps
     * and Sets have no event bus: their event methods throw.
     */
    function requireRoot(target, method, event) {
        if (!Object.prototype.hasOwnProperty.call(target, "_factory")) {
            const name = typeof event === "string" && event ? event : "saved";
            throw helperError(
                `${method}(): events live on the root model: use model.$emit('${name}') / model.$on('${name}', callback). ` +
                "From a list row, call a root handler with $root.handler (data-click / data-event)."
            );
        }
    }

    /**
     * The helpers of one model object (or collection). No overloads (R3-1):
     * - $onChange(fn) / $offChange(fn): change handlers (every write);
     * - $on(event, callback) / $off(event, callback): events; $off also removes a pending
     *   $once(event, callback);
     * - $emit / $once / $use: events.
     * Every wrong arity or argument type throws and names the right method. Removing is
     * always explicit (no "remove all").
     */
    function createHelpers(target) {
        const pendingOnce = new Map(); // event -> Map(callback -> unsubscribe)
        return {
            $onChange(...args) {
                if (typeof args[0] === "string") {
                    throw helperError("$onChange(fn) registers a change handler; for events use $on(event, callback).");
                }
                if (args.length !== 1) {
                    throw helperError(`$onChange(fn) takes one argument (the change handler), got ${args.length}.`);
                }
                return addChangeHandler.call(target, args[0]);
            },
            $offChange(...args) {
                if (typeof args[0] === "string") {
                    throw helperError("$offChange(fn) removes a change handler; for events use $off(event, callback).");
                }
                return removeChangeHandler.apply(target, args);
            },
            $on(...args) {
                const [event, callback] = args;
                requireRoot(target, "$on", event);
                if (typeof event === "function" && typeof callback === "string") {
                    throw helperError("$on(fn, event): the arguments are swapped. Use $on(event, callback).");
                }
                if (typeof event === "function") {
                    throw helperError("$on(fn): $on needs an event name; for change handlers use $onChange(fn).");
                }
                if (args.length !== 2) {
                    throw helperError(`$on(event, callback) takes two arguments, got ${args.length}; for change handlers use $onChange(fn).`);
                }
                return eventBusOf(target).subscribe(event, callback);
            },
            $off(...args) {
                const [event, callback] = args;
                requireRoot(target, "$off", event);
                if (args.length !== 2 || typeof event !== "string") {
                    throw helperError(
                        "$off needs an event name and the callback: $off(event, callback) for events, " +
                        "$offChange(fn) for change handlers."
                    );
                }
                const once = pendingOnce.get(event);
                if (once && once.has(callback)) {
                    const unsubscribe = once.get(callback);
                    once.delete(callback);
                    unsubscribe();
                    return undefined;
                }
                return eventBusOf(target).unsubscribe(event, callback);
            },
            $emit(event, payload) {
                requireRoot(target, "$emit", event);
                eventBusOf(target).publish(event, payload);
            },
            $once(event, callback) {
                requireRoot(target, "$once", event);
                if (typeof event === "function") {
                    throw helperError("$once(fn): $once needs an event name: $once(event, callback).");
                }
                if (typeof callback !== "function") {
                    throw helperError(`$once(event, callback): callback must be a function, got ${typeof callback}.`);
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
                requireRoot(target, "$use");
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
        if (parent && key !== null && key !== undefined) {
            addLink(target, parent, key);
        }
    }

    /**
     * B8: an object can be held in several places of one model (aliases, e.g. a "selected"
     * row). It keeps one link per place, and its parent (_parent) is the FIRST link whose
     * slot still holds it; an alias never takes over. When the first place lets go (the
     * row is removed or replaced), the next place that holds it becomes the parent. If no
     * slot holds it (it is being written right now, or it was detached), the newest link
     * answers.
     */
    function linksOf(target) {
        if (!Object.prototype.hasOwnProperty.call(target, "_parentLinks")) {
            defineHidden(target, "_parentLinks", []);
            Object.defineProperty(target, "_parent", {
                enumerable: false,
                configurable: false,
                get() {
                    return primaryLink(target);
                }
            });
        }
        return target._parentLinks;
    }

    function addLink(target, parent, key) {
        const links = linksOf(target);
        if (!links.some(link => link.obj === parent && link.key === key)) {
            links.push({ obj: parent, key: key });
        }
    }

    // proxy -> raw target, so a slot can be read without the proxy converting or tracking.
    const rawOfProxy = new WeakMap();

    function slotHolds(link, target) {
        const obj = rawOfProxy.get(link.obj) || link.obj;
        const proxy = proxyMap.get(target);
        if (obj instanceof Set) {
            return obj.has(target) || (!!proxy && obj.has(proxy));
        }
        const held = obj instanceof Map ? obj.get(link.key)
            : Array.isArray(obj) ? obj[link.key]
            : reactiveSystem.untracked(() => obj[link.key]);
        return held === target || (held !== undefined && held !== null && proxy === held);
    }

    function primaryLink(target) {
        const links = target._parentLinks;
        if (!links || links.length === 0) return undefined;
        for (const link of links) {
            if (slotHolds(link, target)) return link;
        }
        return links[links.length - 1];
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

        const computedSetter = function () {
            throw new Error(`[Stitch.js ${Version}] Cannot set computed property '${String(key)}'`);
        };
        computedSetter.stitchReadOnlyComputed = true;
        return {
            enumerable: true,
            configurable: false,
            get() {
                // Delegate to ComputedRef
                return computedRef.get();
            },
            set: computedSetter
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
            // D30: a model, or an object of another model, cannot come in; one of this
            // model's own objects moves here.
            checkIncoming(value, parent, parent ? pathParts(parent).concat([key]) : [key]);
            repoint(value, parent, key);
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
        claimRaw(obj, parent, key);
        const cachedProxy = proxyMap.get(obj);
        if (cachedProxy) {
            repointRaw(obj, parent, key);
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
        
        // Make nested objects reactive (only regular properties). An already-reactive value
        // goes through makeDeepReactive too, so D30 refuses a model or a foreign object here.
        for (const [childKey, value] of Object.entries(regularProps)) {
            if (value && typeof value === "object") {
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
        const ownParts = () => (parent ? pathParts(parent).concat([key]) : []);
        checkReservedKeys(target, ownParts);
        computedProps.forEach((_marker, name) => {
            if (RESERVED_NAMES.indexOf(name) !== -1) throw reservedError(ownParts().concat(name));
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
                // An enumerable accessor is a reactive (or computed) property; a hidden one is
                // an old-name stub, which a new data field replaces.
                if (descriptor && descriptor.get && descriptor.enumerable) {
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
                defineOldHelperStub(target, name);
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
        claimRaw(target, parent, key);
        const cachedProxy = proxyMap.get(target);
        if (cachedProxy) {
            repointRaw(target, parent, key);
            return cachedProxy;
        }

        if (!target._changeHandlers) {
            defineHidden(target, "_changeHandlers", new Set);
        }
        attachParent(target, parent, key);

        // The initial content is made reactive exactly like values added later (Map.set /
        // Set.add): plain objects convert (in place), and D30 refuses a model or a foreign
        // object. Before, initial Map values stayed plain and writes to them never reached a
        // binding.
        const ownParts = parent ? pathParts(parent).concat([key]) : [];
        if (target instanceof Map) {
            for (const [entryKey, value] of Array.from(target.entries())) {
                if (!value || typeof value !== "object") continue;
                const name = typeof entryKey === "string" || typeof entryKey === "number" ? entryKey : "value";
                if (value.__isReactive) {
                    checkIncoming(value, parent, ownParts.concat([name]));
                    repoint(value, target, name);
                } else {
                    const converted = reactive(value, new WeakSet, target, name);
                    if (converted !== value) target.set(entryKey, converted);
                }
            }
        } else {
            for (const value of Array.from(target)) {
                if (!value || typeof value !== "object") continue;
                if (value.__isReactive) {
                    checkIncoming(value, parent, ownParts.concat(["value"]));
                    repoint(value, target, "value");
                } else {
                    const converted = reactive(value, new WeakSet, target, "value");
                    if (converted !== value) {
                        target.delete(value);
                        target.add(converted);
                    }
                }
            }
        }

        const overrides = methodOverrides(target);
        const helpers = createHelpers(target);

        const proxy = new Proxy(target, {
            set(target, prop, value) {
                if (prop === "on" || prop === "off") {
                    throw migrationError(prop);
                }
                return Reflect.set(target, prop, value);
            },
            get(target, prop, receiver) {
                if (prop === "__isReactive") return true;
                if (prop === "_changeHandlers") return target._changeHandlers;
                if (prop === "_parent") return target._parent;
                if (prop === "_parentLinks") return target._parentLinks;
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
        rawOfProxy.set(proxy, target);
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
                    const keyName = typeof key === "string" || typeof key === "number" ? key : "value";
                    // Make value reactive if object (D30: never another model)
                    if (val && typeof val === "object" && val.__isReactive) {
                        checkIncoming(val, target, pathParts(target).concat([keyName]));
                        repoint(val, target, keyName);
                    } else if (val && typeof val === "object") {
                        val = reactive(val, new WeakSet, target, keyName);
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
                    if (val && typeof val === "object" && val.__isReactive) {
                        checkIncoming(val, target, pathParts(target).concat(["value"]));
                        repoint(val, target, "value");
                    } else if (val && typeof val === "object") {
                        // A parent link: the member belongs to this model (it cannot move to another).
                        val = reactive(val, new WeakSet, target, "value");
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
        claimRaw(target, parent, key);
        const cachedProxy = proxyMap.get(target);
        if (cachedProxy) {
            repointRaw(target, parent, key);
            return cachedProxy;
        }

        const arrayMethods = ["push", "pop", "shift", "unshift", "splice", "sort", "reverse", "fill"];
        checkArrayItems(target, parent ? pathParts(parent).concat([key]) : [], 0, parent);
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
                if (key === "_parentLinks") return target._parentLinks;
                if (typeof key === "string" && Object.prototype.hasOwnProperty.call(helpers, key)) return helpers[key];
                if (key === "on" || key === "off" || key === "get" || key === "set") return oldHelperStub(key);
                reactiveSystem.track(target, key);
                if (arrayMethods.includes(key)) {
                    return function (...args) {
                        // New items: their keys are checked now, with the index they will take.
                        const arrayParts = pathParts(target);
                        if (key === "push") checkArrayItems(args, arrayParts, target.length, receiver);
                        else if (key === "unshift") checkArrayItems(args, arrayParts, 0, receiver);
                        else if (key === "splice") {
                            const start = args[0] < 0 ? Math.max(target.length + args[0], 0) : Math.min(args[0] || 0, target.length);
                            checkArrayItems(args.slice(2), arrayParts, start, receiver);
                        } else if (key === "fill") checkArrayItems([args[0]], arrayParts, 0, receiver);
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

                        // Rows of this list (and reactive rows just put in) point at their index.
                        const indexFrom = key === "push" ? oldLength : 0;
                        if (key !== "pop") {
                            for (let i = indexFrom; i < target.length; i++) {
                                const item = target[i];
                                if (!item || typeof item !== "object" || !item.__isReactive) continue;
                                const links = item._parentLinks || [];
                                const own = links.find(link => link.obj === receiver || link.obj === target);
                                if (own) {
                                    own.key = i;
                                } else {
                                    repoint(item, receiver, i);
                                }
                            }
                        }

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
                if (key === "on" || key === "off" || key === "get" || key === "set") {
                    throw migrationError(key);
                }
                const oldValue = target[key];
                if (value && typeof value === "object" && value.__isReactive) {
                    checkIncoming(value, receiver, pathParts(target).concat([key]));
                    repoint(value, receiver, key);
                } else if (value && typeof value === "object") {
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
        rawOfProxy.set(proxy, target);
        for (let i = 0; i < target.length; i++) repoint(target[i], proxy, i);
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
