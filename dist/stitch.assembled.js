/*! Stitch.js v2.1.0 | MIT License | https://github.com/user/Stitch.js */

/*! STITCH_ASSEMBLY_METADATA {"source":"stitch.entry.js","mode":"reachable","availableModuleCount":26,"moduleCount":26,"modules":["packages/api/index.js","packages/api/src/observable.js","packages/api/src/reactive-factory.js","packages/browser/index.js","packages/browser/src/binding-paths.js","packages/browser/src/binding-runtime.js","packages/browser/src/binding-scan-helpers.js","packages/browser/src/data-binder.js","packages/browser/src/foreach-binding-orchestrator.js","packages/core/index.js","packages/core/src/batch-scheduler.js","packages/core/src/computed-ref.js","packages/core/src/message-bus.js","packages/core/src/reactive-system.js","packages/utils/index.js","packages/utils/src/attr-value-handlers.js","packages/utils/src/error-hook.js","packages/utils/src/foreach-keys.js","packages/utils/src/foreach-row-context.js","packages/utils/src/hook-slot.js","packages/utils/src/reactive-object-helpers.js","packages/utils/src/reactive-stats.js","packages/utils/src/runtime-helpers.js","packages/utils/src/type-converters.js","packages/utils/src/value-binding-helpers.js","packages/utils/src/version.js"],"moduleMap":{"0":"packages/api/index.js","1":"packages/api/src/observable.js","2":"packages/api/src/reactive-factory.js","3":"packages/browser/index.js","4":"packages/browser/src/binding-paths.js","5":"packages/browser/src/binding-runtime.js","6":"packages/browser/src/binding-scan-helpers.js","7":"packages/browser/src/data-binder.js","8":"packages/browser/src/foreach-binding-orchestrator.js","9":"packages/core/index.js","10":"packages/core/src/batch-scheduler.js","11":"packages/core/src/computed-ref.js","12":"packages/core/src/message-bus.js","13":"packages/core/src/reactive-system.js","14":"packages/utils/index.js","15":"packages/utils/src/attr-value-handlers.js","16":"packages/utils/src/error-hook.js","17":"packages/utils/src/foreach-keys.js","18":"packages/utils/src/foreach-row-context.js","19":"packages/utils/src/hook-slot.js","20":"packages/utils/src/reactive-object-helpers.js","21":"packages/utils/src/reactive-stats.js","22":"packages/utils/src/runtime-helpers.js","23":"packages/utils/src/type-converters.js","24":"packages/utils/src/value-binding-helpers.js","25":"packages/utils/src/version.js"}} */

(function(){
  var __stitchModuleFactories = Object.create(null);
  __stitchModuleFactories[0] = function(module, exports, __stitchRequire){
"use strict";

const { VERSION } = __stitchRequire(25);
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
const runtimeHelpers = __stitchRequire(22);
const { defineHidden } = __stitchRequire(20);

const { VERSION } = __stitchRequire(25);

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
            `[Stitch E704] ${method}(): "${modelPathOf(obj) || "this object"}" already belongs to a model; use the root model ` +
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
        throw new TypeError(`[Stitch E705] ${method}(data, options): options must be an object, got ${options === null ? "null" : typeof options}.`);
    }
    for (const key of Object.keys(options)) {
        if (KNOWN_OPTIONS.indexOf(key) === -1) {
            const hint = key === "debug"
                ? " There is no debug mode in v3: mistakes throw (or go to Stitch.onError), and Stitch.onBindReport lists what bind() did."
                : "";
            throw new Error(`[Stitch E706] ${method}(): unknown option "${key}". Known options: ${KNOWN_OPTIONS.join(", ")}.${hint}`);
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
            throw new Error("[Stitch E701] Observable.create() requires an object as input");
        }
        checkOptions("Observable.create", options);
        if (data.__isReactive && Object.prototype.hasOwnProperty.call(data, "_factory")) {
            throw new Error("[Stitch E703] Observable.create() received an already-reactive object. Use the existing proxy or pass a plain object.");
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
                throw new TypeError(`[Stitch E817] $watch("${property}", callback): callback must be a function, got ${typeof callback}.`);
            }
            let previousValue = getProperty(reactiveData, property);

            // Create effect that tracks the property
            const effect = factory.reactiveSystem.effect(() => {
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
            // The remover: stops the watch for good and releases its effect (safe to call twice).
            return function stop() {
                factory.reactiveSystem.cleanup(effect);
            };
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
            throw new Error("[Stitch E702] Observable.createArray() requires an array as input");
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
        return !!obj && typeof obj === "object" && obj.__isReactive === true;
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

  };
  __stitchModuleFactories[2] = function(module, exports, __stitchRequire){
"use strict";

const { ReactiveSystem } = __stitchRequire(13);
const { ComputedRef } = __stitchRequire(11);
const { MessageBus } = __stitchRequire(12);
const { REACTIVE_TOTALS } = __stitchRequire(21);
const runtimeHelpers = __stitchRequire(22);
const objectHelpers = __stitchRequire(20);
const { VERSION } = __stitchRequire(25);
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
            throw new Error(`[Stitch E722] Stitch.computed() deps must be an array of property names.\n` + `Example: Stitch.computed({ get() { ... }, deps: ['prop1', 'prop2'] })`);
        }
    } else {
        throw new Error(`[Stitch E721] Stitch.computed() expects either:\n` + `  - A function: Stitch.computed(function() { ... })\n` + `  - An object: Stitch.computed({ get() { ... }, deps: [...] })`);
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
            `[Stitch E709] "${formatPath(parts)}" is reserved: ${why}, so a data field with that name would be ` +
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

    /**
     * Stitch converts data in place (it defines accessors and hidden fields on the object), so
     * frozen, sealed or non-extensible data cannot become a model. Throws a Stitch error naming
     * where the object sits and the fix, instead of the browser's own TypeError.
     */
    function refuseLocked(obj, parts) {
        if (!obj || typeof obj !== "object" || Object.isExtensible(obj)) return;
        const state = Object.isFrozen(obj) ? "frozen" : Object.isSealed(obj) ? "sealed" : "not extensible";
        const where = formatPath(typeof parts === "function" ? parts() : parts);
        throw new TypeError(
            `[Stitch E714] ${where ? `"${where}"` : "The data"} is ${state} (Object.freeze, Object.seal or ` +
            `Object.preventExtensions): Stitch makes data reactive in place, which ${state} data does not allow. ` +
            "Pass a copy instead, e.g. structuredClone(data) or { ...data }."
        );
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
            if (!Object.isExtensible(item)) refuseLocked(item, parts);
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
            if (!parentLink || !parentLink.obj) return (current._parentLinks && current._parentLinks.homeRoot) || null;
            current = parentLink.obj;
        }
        return null;
    }

    function nestingError(parts, what) {
        const last = parts[parts.length - 1];
        const name = typeof last === "string" && !/^\d+$/.test(last) ? last : "value";
        return new Error(
            `[Stitch E710] cannot put ${what} at "${formatPath(parts) || "(the model)"}": A model cannot be nested in ` +
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
                `[Stitch E711] "${formatPath(parts) || name}" already belongs to a model; give each model its own copy (${copy}). ` +
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
            `[Stitch E802] .${name}() is now .${NEW_NAMES[name]}() in Stitch v3: the helpers are $-prefixed, so that ` +
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

    /** D31: deleting from a list, Map or Set proxy throws, naming the method that removes. */
    function deleteError(target, key) {
        const where = formatPath(pathParts(target)) || "list";
        const name = where.split(/[.[]/).pop().replace(/]$/, "") || "list";
        const fix = target instanceof Map ? `${where}.delete(key) removes an entry`
            : target instanceof Set ? `${where}.delete(value) removes a member`
            : /^\d+$/.test(String(key)) ? `use ${where}.splice(${key}, 1)`
            : "model lists cannot lose properties; set a value instead";
        return new TypeError(
            `[Stitch E712] delete ${where}${/^\d+$/.test(String(key)) ? `[${String(key)}]` : `.${String(key)}`}: ${fix}. ` +
            `Model data cannot be deleted (it would leave a hole the screen does not see; set it to null instead).`
        );
    }

    function eventBusOf(target) {
        if (!target._eventBus) {
            defineHidden(target, "_eventBus", new MessageBus({ version: Version }));
        }
        return target._eventBus;
    }

    function helperError(code, message) {
        return new TypeError(`[Stitch ${code}] ${message}`);
    }

    /**
     * D29: events live on the root model only (the object Observable.create / createArray /
     * reactive returned; it alone carries _factory). Nested objects, list rows, arrays, Maps
     * and Sets have no event bus: their event methods throw.
     */
    function requireRoot(target, method, event) {
        if (!Object.prototype.hasOwnProperty.call(target, "_factory")) {
            const name = typeof event === "string" && event ? event : "saved";
            throw helperError("E801",
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
                    throw helperError("E803", "$onChange(fn) registers a change handler; for events use $on(event, callback).");
                }
                if (args.length !== 1) {
                    throw helperError("E804", `$onChange(fn) takes one argument (the change handler), got ${args.length}.`);
                }
                return addChangeHandler.call(target, args[0]);
            },
            $offChange(...args) {
                if (typeof args[0] === "string") {
                    throw helperError("E806", "$offChange(fn) removes a change handler; for events use $off(event, callback).");
                }
                return removeChangeHandler.apply(target, args);
            },
            $on(...args) {
                const [event, callback] = args;
                requireRoot(target, "$on", event);
                if (typeof event === "function" && typeof callback === "string") {
                    throw helperError("E810", "$on(fn, event): the arguments are swapped. Use $on(event, callback).");
                }
                if (typeof event === "function") {
                    throw helperError("E811", "$on(fn): $on needs an event name; for change handlers use $onChange(fn).");
                }
                if (args.length !== 2) {
                    throw helperError("E812", `$on(event, callback) takes two arguments, got ${args.length}; for change handlers use $onChange(fn).`);
                }
                return eventBusOf(target).subscribe(event, callback);
            },
            $off(...args) {
                const [event, callback] = args;
                requireRoot(target, "$off", event);
                if (args.length !== 2 || typeof event !== "string") {
                    throw helperError("E813",
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
                    throw helperError("E814", "$once(fn): $once needs an event name: $once(event, callback).");
                }
                if (typeof callback !== "function") {
                    throw helperError("E815", `$once(event, callback): callback must be a function, got ${typeof callback}.`);
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
     * B8 + B9: an object can be held in several places of one model (aliases, e.g. a
     * "selected" row). It keeps one link per place that holds it, and its parent (_parent)
     * is the FIRST link whose slot still holds it; an alias never takes over.
     * Links never outlive their holders (B9):
     * - resolving the parent prunes links whose slot no longer holds the object (if none
     *   holds, only the newest stays: the slot being written right now);
     * - every removal point (a property or index overwritten, pop / shift / splice / fill /
     *   a shorter length, Map.set over a value, Map/Set delete and clear) releases the
     *   object's link to that container at once;
     * - an object held nowhere is detached: it drops all its links (remembering its model
     *   in its links' homeRoot, so D30 still refuses it elsewhere) and releases its children's links
     *   to it, recursively. Assigning it back links its children again.
     * Stitch.debug.stats().parentLinks counts links added minus links removed. Objects that
     * are garbage-collected while still inside a discarded model are not subtracted (a
     * FinalizationRegistry would, but it measurably slowed list re-renders), so compare the
     * count on a model that is still alive.
     */

    function countLinks(delta) {
        REACTIVE_TOTALS.parentLinks = (REACTIVE_TOTALS.parentLinks || 0) + delta;
    }

    // proxy -> raw target, so a slot can be read without the proxy converting or tracking.
    const rawOfProxy = new WeakMap();
    function rawOf(value) {
        return rawOfProxy.get(value) || value;
    }

    function isReactiveObject(value) {
        return !!value && typeof value === "object" && value.__isReactive === true;
    }

    function linksOf(target) {
        if (!Object.prototype.hasOwnProperty.call(target, "_parentLinks")) {
            const links = [];
            defineHidden(target, "_parentLinks", links);
            Object.defineProperty(target, "_parent", {
                enumerable: false,
                configurable: false,
                get() {
                    return primaryLink(target);
                }
            });
            // Detached state lives on the links array itself (no extra properties per object).
            links.detached = false;
            links.homeRoot = null;
        }
        return target._parentLinks;
    }

    function addLink(target, parent, key) {
        target = rawOf(target);
        const links = linksOf(target);
        if (!links.some(link => link.obj === parent && link.key === key)) {
            links.push({ obj: parent, key: key });
            countLinks(1);
        }
        if (links.detached) {
            // Back in a model: its children link to it again (they were released when it left).
            links.detached = false;
            links.homeRoot = null;
            const holder = proxyMap.get(target) && Array.isArray(target) ? proxyMap.get(target) : target;
            for (const [child, childKey] of childrenOf(target)) {
                addLink(child, holder, childKey);
            }
        }
    }

    function removeLinkAt(links, index) {
        links.splice(index, 1);
        countLinks(-1);
    }

    function slotHolds(link, target) {
        const obj = rawOf(link.obj);
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
        let first = null;
        for (let i = links.length - 1; i >= 0; i--) {
            if (slotHolds(links[i], target)) {
                first = links[i];
            }
        }
        if (first) {
            // Prune: a link whose slot no longer holds the object is gone for good.
            for (let i = links.length - 1; i >= 0; i--) {
                if (links[i] !== first && !slotHolds(links[i], target)) removeLinkAt(links, i);
            }
            return first;
        }
        while (links.length > 1) removeLinkAt(links, 0);
        return links[0];
    }

    /** The reactive objects a holder holds, with the key each sits under. */
    function childrenOf(holder) {
        const raw = rawOf(holder);
        const out = [];
        const add = (value, key) => { if (isReactiveObject(value)) out.push([value, key]); };
        if (Array.isArray(raw)) {
            raw.forEach((value, index) => add(value, index));
        } else if (raw instanceof Map) {
            raw.forEach((value, key) => add(value, typeof key === "string" || typeof key === "number" ? key : "value"));
        } else if (raw instanceof Set) {
            raw.forEach(value => add(value, "value"));
        } else {
            for (const key of Object.keys(raw)) {
                const descriptor = Object.getOwnPropertyDescriptor(raw, key);
                if (!descriptor || !descriptor.get || (descriptor.set && descriptor.set.stitchReadOnlyComputed)) continue;
                add(reactiveSystem.untracked(() => raw[key]), key);
            }
        }
        return out;
    }

    /** value no longer sits where holder had it: drop that link; detach value if it is held nowhere. */
    function releaseFrom(value, holder) {
        if (!isReactiveObject(value)) return;
        const target = rawOf(value);
        const links = target._parentLinks;
        if (!links) return;
        // Its model, found while the link to the place it just left still exists.
        const homeRoot = rootOfObject(target);
        const holderRaw = rawOf(holder);
        for (let i = links.length - 1; i >= 0; i--) {
            if (rawOf(links[i].obj) === holderRaw && !slotHolds(links[i], target)) removeLinkAt(links, i);
        }
        if (!Object.prototype.hasOwnProperty.call(target, "_factory") && !links.some(link => slotHolds(link, target))) {
            detach(target, homeRoot);
        }
    }

    /** target is held nowhere: it drops its links and releases its children's links to it. */
    function detach(target, homeRoot) {
        const links = linksOf(target);
        if (links.detached) return;
        while (links.length) removeLinkAt(links, links.length - 1);
        links.detached = true;
        links.homeRoot = homeRoot;
        for (const [child] of childrenOf(target)) {
            const childTarget = rawOf(child);
            const childLinks = childTarget._parentLinks;
            if (!childLinks) continue;
            for (let i = childLinks.length - 1; i >= 0; i--) {
                if (rawOf(childLinks[i].obj) === target) removeLinkAt(childLinks, i);
            }
            if (!childLinks.some(link => slotHolds(link, childTarget))) {
                detach(childTarget, homeRoot);
            }
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
            // D31: a model property cannot be deleted (set it to null instead). Non-configurable,
            // so delete is refused and the accessor (and every binding on it) survives.
            configurable: false,
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
                    throw new Error(`[Stitch E708] Cannot set arrow function on property '${String(key)}'\n\n` + `Arrow functions cannot access reactive properties via 'this'.\n` + `Use regular function or ES6 method shorthand instead.`);
                }
                newValue = makeDeepReactive(newValue, target, key);
                internal[key] = newValue;
                releaseFrom(oldValue, target);
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
            throw new Error(`[Stitch E713] Cannot set computed property '${String(key)}'`);
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
        if (!Object.isExtensible(obj)) refuseLocked(obj, parent ? pathParts(parent).concat([key]) : []);
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
                throw new Error(`[Stitch E707] Arrow function detected in property '${childKey}'\n\n` + `Arrow functions cannot access reactive properties via 'this'.\n` + `They use lexical 'this' binding which cannot be changed.\n\n` + `Convert to regular function or ES6 method shorthand:\n` + `  ❌ ${childKey}: () => { return this.someValue; }\n` + `  ✅ ${childKey}() { return this.someValue; }\n` + `  ✅ ${childKey}: function() { return this.someValue; }\n\n` + `Learn more: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Functions/Arrow_functions`);
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
                throw new TypeError(`[Stitch E816] $set(key, value): key must be a non-empty string, got ${typeof path}.`);
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
        if (!Object.isExtensible(target)) refuseLocked(target, parent ? pathParts(parent).concat([key]) : []);

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
            deleteProperty(target, prop) {
                throw deleteError(target, prop);
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
                                const removed = Array.from(target.values());
                                target.clear();
                                removed.forEach(value => releaseFrom(value, target));
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
                    if (oldValue !== val) releaseFrom(oldValue, target);
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
                    releaseFrom(oldValue, target);
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
                    releaseFrom(normalizedVal, target);
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

        if (!Object.isExtensible(target)) refuseLocked(target, parent ? pathParts(parent).concat([key]) : []);
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
                        const overwritten = key === "fill" ? target.slice() : null;
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

                        // Items that left the list release their link to it (B9).
                        const removed = key === "pop" || key === "shift" ? [result]
                            : key === "splice" ? result
                            : overwritten || [];
                        removed.forEach(item => releaseFrom(item, target));

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
            deleteProperty(target, key) {
                throw deleteError(target, key);
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
                const cut = key === "length" && typeof value === "number" && value < target.length ? target.slice(value) : null;
                const result = Reflect.set(target, key, value, receiver);
                if (cut) cut.forEach(item => releaseFrom(item, target));
                else if (oldValue !== value) releaseFrom(oldValue, target);
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
                throw new Error(`[Stitch E723] Stitch.computed() deps form a cycle: ${Array.from(visited).join(" → ")} → ${depKey}. ` +
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

  };
  __stitchModuleFactories[3] = function(module, exports, __stitchRequire){
"use strict";

const { VERSION } = __stitchRequire(25);
const foreachBindingOrchestrator = __stitchRequire(8);
const bindingScanHelpers = __stitchRequire(6);
const bindingRuntime = __stitchRequire(5);
const dataBinderFactory = __stitchRequire(7);
const runtimeHelpers = __stitchRequire(22);
const attrValueHandlers = __stitchRequire(15);
const valueBindingHelpers = __stitchRequire(24);
const typeConverters = __stitchRequire(23);
const foreachKeys = __stitchRequire(17);
const foreachRowContext = __stitchRequire(18);
const bindingPaths = __stitchRequire(4);
const errorHook = __stitchRequire(16);

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
    setProperty: runtimeHelpers.setProperty,
    getValueHandler,
    getValueValidator,
    getAttrHandler: attrValueHandlers.getAttrHandler,
    bindForeach(element, viewModel, path, context) {
        return foreachBindingOrchestrator.bindForeach(element, viewModel, path, context, {
            pathReader: bindingPaths.pathReader,
            getValueValidator,
            createItemContext: foreachRowContext.createItemContext,
            resolveRowKeys: foreachKeys.resolveRowKeys,
            runAllThenThrow: errorHook.runAllThenThrow,
            reportError: errorHook.reportError,
            version: `v${VERSION}`,
            doc: typeof document !== "undefined" ? document : null
        });
    }
});

const DataBinder = dataBinderFactory.createDataBinderClass({
    version: `v${VERSION}`,
    getBindingHandler: runtimeBinding.getBindingHandler,
    bindingHandlers: runtimeBinding.BINDING_HANDLERS
});

module.exports = {
    DataBinder,
    version: VERSION,
    ...foreachBindingOrchestrator,
    ...bindingScanHelpers,
    ...bindingRuntime,
    ...dataBinderFactory,
    ...bindingPaths
};

  };
  __stitchModuleFactories[4] = function(module, exports, __stitchRequire){
"use strict";

/**
 * The one grammar and the one lookup for the values of Stitch's own bindings.
 *
 * Value bindings (text, value, visible, enabled, class, attr, foreach, loading, event's
 * config, custom bindings) name a PROPERTY PATH: names of letters, digits, _ and $, joined
 * by dots (`name`, `user.name`, `items.0.title`, `$parent.total`, `$root.rate`). Anything
 * else is invalid syntax and throws, naming the element, the binding, the value and the fix.
 *
 * A path must exist on the model (D25): a name the model (or the object the path walks
 * through) does not have throws, listing what it does have. A null or undefined step on
 * the way is a value (the binding shows nothing), not a missing property.
 *
 * Handler bindings (click, and the handler names inside event's config) name a HANDLER
 * (D12): a bare name on the current row (the model, outside a list), `$parent.name` on the
 * row or model one level up, or `$root.name` on the root model. Nothing else. The handler
 * is called with `this` = the object it was found on, and (rowItem, event), where rowItem
 * is the current row's item (the model, outside a list). A miss throws, saying where the
 * name was looked up and where it does exist.
 */

const { isRowContext } = __stitchRequire(18);

const NAME = /^[A-Za-z_$][\w$]*$/;
const INDEX = /^\d+$/;
const ROW_NAMES = ["$data", "$index", "$parent", "$root"];
const MAX_LISTED = 25;

function tagOf(element) {
    return element && element.tagName ? element.tagName.toLowerCase() : "element";
}

/** `<span id="x" data-text="name">`: the element and the one binding in question. */
function describeBinding(element, attribute, value) {
    const id = element && element.id ? ` id="${element.id}"` : "";
    return `<${tagOf(element)}${id} ${attribute}="${value}">`;
}

/** An error about one binding, with its stable code: `[Stitch E###] <span data-text="x">: message`. */
function bindingError(code, where, message) {
    return new Error(`[Stitch ${code}] ${where}: ${message}`);
}

/** Why a value is not what a binding needs: a stable code and the reason with its fix. */
function problem(code, text) {
    return { code, text };
}

// ---------------------------------------------------------------------------
// Syntax

/**
 * Why a value is not a property path ({ code, text }: the reason with the fix); null if it is one.
 * @param {string} value - already trimmed
 */
function pathSyntaxProblem(value) {
    if (value === "") {
        return problem("E101", "the value is empty. Give the name of a model property, e.g. data-text=\"name\".");
    }
    if (value[0] === "{") {
        return problem("E103", "an inline object is not supported; a binding names a property. Put the object on the model " +
            "(a computed if it changes), e.g. rowClasses: Stitch.computed(function () { return { active: this.on }; }), " +
            "and bind its name: data-class=\"rowClasses\".");
    }
    if (value.indexOf("(") !== -1) {
        return problem("E104", "a call is not supported; a binding names a property. Make the value a computed and bind its name.");
    }
    if (/[,:;]/.test(value)) {
        return problem("E105", "an attribute holds exactly one binding with no options. Split it into separate attributes, " +
            "e.g. data-value=\"city\" data-visible=\"hasCity\".");
    }
    if (/[\s!=<>+\-*/%&|?'"`[\]]/.test(value)) {
        return problem("E102", "an expression is not supported; a binding names a property. Put the expression in a computed, " +
            "e.g. isOpen: Stitch.computed(function () { return !this.closed; }), and bind data-visible=\"isOpen\".");
    }
    const segments = value.split(".");
    for (const segment of segments) {
        if (!NAME.test(segment) && !INDEX.test(segment)) {
            return problem("E106", "this is not a property path. Use names of letters, digits, _ and $ joined by dots, " +
                "e.g. user.name or items.0.title.");
        }
    }
    return null;
}

/**
 * Checks the syntax of a value binding; returns the trimmed path.
 * @throws {Error} invalid syntax: element, binding, value and the fix
 */
function checkPathSyntax(element, attribute, rawValue) {
    const value = String(rawValue).trim();
    const found = pathSyntaxProblem(value);
    if (found) {
        // Relays the code and text made by problem() above.
        throw bindingError(found.code, describeBinding(element, attribute, rawValue), found.text);
    }
    return value;
}

// ---------------------------------------------------------------------------
// Scopes: the model, or a foreach row context

function rowItemOf(scope) {
    return isRowContext(scope) ? scope.$data : scope;
}

function rootOf(scope) {
    return isRowContext(scope) ? scope.$root : scope;
}

/**
 * Whether `key` is something a binding can follow on `holder` (B5, S6):
 * - "bindable": a reactive property (own accessor) of a model object; an own property of a
 *   plain object (e.g. a computed's value); an index or length of an array; size of a Map /
 *   Set; an own property of a string; on a row context, $data / $index / $parent / $root
 *   or a bindable property of the row item;
 * - "not-reactive": an own enumerable data property of a model object: a name starting with
 *   _ (never made reactive) or a property added after Observable.create();
 * - "missing": anything else, including inherited names (toString, constructor) and
 *   Stitch's hidden helpers (on, toJSON, $watch, ...).
 */
function memberStatus(holder, key) {
    if (isRowContext(holder)) {
        if (ROW_NAMES.indexOf(key) !== -1) return "bindable";
        const item = holder.$data;
        return item !== null && typeof item === "object" ? memberStatus(item, key) : "missing";
    }
    if (holder === null || holder === undefined) {
        return "missing";
    }
    if (typeof holder !== "object" && typeof holder !== "function") {
        return Object.prototype.hasOwnProperty.call(Object(holder), key) ? "bindable" : "missing";
    }
    if (Array.isArray(holder)) {
        return key === "length" || (INDEX.test(key) && Object.prototype.hasOwnProperty.call(holder, key)) ? "bindable" : "missing";
    }
    if (holder instanceof Map || holder instanceof Set) {
        return key === "size" ? "bindable" : "missing";
    }
    const descriptor = Object.getOwnPropertyDescriptor(holder, key);
    if (!descriptor) {
        // A class instance: a getter its class defines (on the prototype chain, not
        // Object.prototype) was bindable in v2 and stays bindable, read-only.
        return inheritedGetter(holder, key) ? "bindable" : "missing";
    }
    if (holder.__isReactive === true) {
        if (descriptor.get) return descriptor.enumerable ? "bindable" : "missing";
        return descriptor.enumerable ? "not-reactive" : "missing";
    }
    return "bindable";
}

/** A getter defined by holder's class (anywhere on its prototype chain above Object.prototype). */
function inheritedGetter(holder, key) {
    let proto = Object.getPrototypeOf(holder);
    while (proto && proto !== Object.prototype && proto !== Array.prototype) {
        const descriptor = Object.getOwnPropertyDescriptor(proto, key);
        if (descriptor) {
            return descriptor.get ? descriptor : null;
        }
        proto = Object.getPrototypeOf(proto);
    }
    return null;
}

/**
 * Throws when a two-way binding's path ends on something that cannot be written: a getter
 * without a setter (a class's computed-like property). A null step is checked on write.
 */
function checkWritable(scope, path, describe) {
    const segments = path.split(".");
    let holder = scope;
    for (let i = 0; i < segments.length - 1; i++) {
        if (holder === null || holder === undefined) return;
        holder = holder[segments[i]];
    }
    if (holder === null || holder === undefined || typeof holder !== "object") return;
    const key = segments[segments.length - 1];
    // A bare name in a row is the row item's property (the context inherits it).
    if (isRowContext(holder) && ROW_NAMES.indexOf(key) === -1) {
        holder = holder.$data;
        if (holder === null || typeof holder !== "object") return;
    }
    const own = Object.getOwnPropertyDescriptor(holder, key);
    if (own && own.set && own.set.stitchReadOnlyComputed) {
        throw bindingError("E311", describe(),
            `"${path}" is a computed (read-only), so a two-way binding cannot write it. ` +
            "Bind it one-way (data-text), or bind the plain property it is computed from.");
    }
    const descriptor = own || inheritedGetter(holder, key);
    if (descriptor && descriptor.get && !descriptor.set) {
        throw bindingError("E312", describe(),
            `"${path}" is read-only (a getter without a setter), so a two-way binding cannot write it. ` +
            "Bind it one-way (data-text) or bind a writable property.");
    }
}

/** The names a binding can follow on holder, and the declared names it cannot. */
function memberLists(holder, isRowScope) {
    const target = isRowScope ? holder.$data : holder;
    const bindable = [];
    const notBindable = [];
    if (target !== null && typeof target === "object" && !Array.isArray(target)
        && !(target instanceof Map) && !(target instanceof Set)) {
        for (const name of Object.keys(target)) {
            const status = memberStatus(target, name);
            if (status === "bindable") bindable.push(name);
            else if (status === "not-reactive") notBindable.push(name);
        }
    }
    if (isRowScope) bindable.push(...ROW_NAMES);
    return { bindable, notBindable };
}

function listNames(names) {
    if (names.length === 0) return "no properties";
    const shown = names.slice(0, MAX_LISTED).join(", ");
    return names.length > MAX_LISTED ? `${shown}, ... (${names.length - MAX_LISTED} more)` : shown;
}

function describeMembers(holder, isRowScope) {
    if (Array.isArray(holder)) return { text: "an array: an index (0, 1, ...) or length", bindable: [], notBindable: [] };
    if (holder instanceof Map || holder instanceof Set) return { text: "size (it is a Map / Set)", bindable: [], notBindable: [] };
    const lists = memberLists(holder, isRowScope);
    let text = listNames(lists.bindable);
    if (lists.notBindable.length) {
        text += `. Not bindable: ${listNames(lists.notBindable)} (not reactive: names starting with _ are never made ` +
            "reactive, and properties added after Observable.create() are not either)";
    }
    return Object.assign({ text }, lists);
}

function editDistance(a, b) {
    const row = Array.from({ length: b.length + 1 }, (_, j) => j);
    for (let i = 1; i <= a.length; i++) {
        let previous = row[0];
        row[0] = i;
        for (let j = 1; j <= b.length; j++) {
            const current = row[j];
            row[j] = Math.min(row[j] + 1, row[j - 1] + 1, previous + (a[i - 1] === b[j - 1] ? 0 : 1));
            previous = current;
        }
    }
    return row[b.length];
}

/** A close bindable name (for the error message only), or null. */
function closeName(names, wanted) {
    const lower = wanted.toLowerCase();
    let best = null;
    let bestDistance = 3;
    for (const name of names) {
        const distance = name.toLowerCase() === lower ? 0 : editDistance(name.toLowerCase(), lower);
        if (distance < bestDistance) {
            best = name;
            bestDistance = distance;
        }
    }
    return best;
}

function describeHolder(segments, index, isRowScope) {
    if (index === 0) {
        return isRowScope ? "the current row" : "the model";
    }
    return `"${segments.slice(0, index).join(".")}"`;
}

function missingPropertyError(where, segments, index, holder) {
    const isRowScope = index === 0 && isRowContext(holder);
    const name = segments[index];
    const owner = describeHolder(segments, index, isRowScope);
    if (holder === null || typeof holder !== "object" && typeof holder !== "function") {
        return bindingError("E202", where,
            `"${name}" is not a property of ${owner}, which is ${typeof holder} ${JSON.stringify(holder)}. ` +
            "Fix the path, or make that value an object.");
    }
    const members = describeMembers(holder, isRowScope);
    const close = closeName(members.bindable, name);
    const suggestion = close ? `Did you mean "${segments.slice(0, index).concat(close).join(".")}"? ` : "";
    return bindingError("E201", where,
        `"${name}" is not a property of ${owner}. ${owner[0].toUpperCase() + owner.slice(1)} has: ` +
        `${members.text}. ${suggestion}` +
        "Declare every bound property in Observable.create() with a starting value (null is fine): a property " +
        "added later is not reactive. Or fix the binding.");
}

function notReactiveError(where, segments, index) {
    const name = segments[index];
    const why = name[0] === "_"
        ? "Stitch never makes properties whose names start with _ reactive, so a binding could not follow it. " +
          `Rename it without the _ (e.g. "${name.replace(/^_+/, "") || "value"}"), or keep it out of bindings.`
        : "it was added after Observable.create(), so it has no reactive accessor and a binding could not follow it. " +
          "Declare it in Observable.create() with a starting value (null is fine).";
    return bindingError("E203", where, `"${segments.slice(0, index + 1).join(".")}" is not reactive: ${why}`);
}

/**
 * Reads a property path strictly: a name that is not a bindable property throws (D25, B5);
 * a null or undefined step ends the read with undefined.
 * @param {Object} scope - the model or a row context
 * @param {string} path - a valid path (see checkPathSyntax)
 * @param {Function} describe - () => the element/binding description, used only on error
 */
function readPath(scope, path, describe) {
    const segments = path.split(".");
    let current = scope;
    for (let i = 0; i < segments.length; i++) {
        if (current === null || current === undefined) {
            return undefined;
        }
        const key = segments[i];
        const status = memberStatus(current, key);
        if (status === "missing") {
            throw missingPropertyError(describe(), segments, i, current);
        }
        if (status === "not-reactive") {
            throw notReactiveError(describe(), segments, i);
        }
        current = current[key];
    }
    return current;
}

/** A reader bound to one element and binding, for use inside that binding's effect. */
function pathReader(element, attribute, path) {
    const describe = () => describeBinding(element, attribute, path);
    return scope => readPath(scope, path, describe);
}

// ---------------------------------------------------------------------------
// Handlers (D12)

/**
 * Parses a handler reference: `name`, `$parent.name` or `$root.name`
 * (name may be dotted: `$root.actions.save`).
 * @returns {{level: "row"|"parent"|"root", segments: string[], text: string}}
 */
function parseHandlerRef(where, rawValue) {
    const text = String(rawValue).trim();
    const found = pathSyntaxProblem(text);
    const fix = "A handler is a bare name (on the current row; the model outside a list), $parent.name or $root.name; " +
        "it is called with the row item and the event.";
    if (found) {
        throw bindingError("E108", where, `${found.text.split(". ")[0]}. ${fix}`);
    }
    let segments = text.split(".");
    let level = "row";
    if (segments[0] === "$parent" || segments[0] === "$root") {
        level = segments[0] === "$parent" ? "parent" : "root";
        segments = segments.slice(1);
    }
    if (segments.length === 0) {
        throw bindingError("E109", where, `"${text}" names a scope but no handler. ${fix}`);
    }
    const scoped = segments.find(segment => segment[0] === "$");
    if (scoped) {
        throw bindingError("E110", where,
            `"${text}": only one scope prefix is allowed, and only $parent. or $root. ` +
            "For a handler more than one level up, put it on the root model and use $root.name. " + fix);
    }
    return { level, segments, text };
}

/** Finds a dotted name on an object: { found, value, owner } (owner holds the last name). */
function lookUp(data, segments) {
    let owner = data;
    for (let i = 0; i < segments.length; i++) {
        // Own model members only (no inherited or hidden names); a handler need not be
        // reactive, so a _name method or one added later still counts.
        if (owner === null || owner === undefined || memberStatus(owner, segments[i]) === "missing") {
            return { found: false };
        }
        if (i === segments.length - 1) {
            return { found: true, value: owner[segments[i]], owner };
        }
        owner = owner[segments[i]];
    }
    return { found: false };
}

/** The scopes a handler can name from here, nearest first. */
function handlerLevels(scope) {
    const levels = [];
    const inRow = isRowContext(scope);
    levels.push({ level: "row", prefix: "", data: rowItemOf(scope), label: inRow ? "the current row" : "the model" });
    if (inRow) {
        const parent = scope.$parent;
        levels.push({ level: "parent", prefix: "$parent.", data: rowItemOf(parent), label: isRowContext(parent) ? "the parent row" : "the model" });
        levels.push({ level: "root", prefix: "$root.", data: scope.$root, label: "the root model" });
    } else {
        levels.push({ level: "root", prefix: "$root.", data: scope, label: "the model" });
    }
    return levels;
}

/** Rows above the parent that are not the root: a handler cannot name them. */
function unreachableAncestors(scope) {
    const found = [];
    if (!isRowContext(scope)) return found;
    let current = scope.$parent;
    let depth = 1;
    while (isRowContext(current) && isRowContext(current.$parent)) {
        current = current.$parent;
        depth++;
        found.push({ depth, data: rowItemOf(current) });
    }
    return found;
}

/**
 * Resolves a handler reference in a scope.
 * @returns {{fn: Function, owner: Object, item: *}}
 * @throws {Error} the name is missing (with where it does exist), or not a function
 */
function resolveHandler(scope, ref, where) {
    const levels = handlerLevels(scope);
    const target = levels.find(level => level.level === ref.level);
    const name = ref.segments.join(".");
    if (ref.level === "parent" && !isRowContext(scope)) {
        throw bindingError("E403", where,
            `"$parent." is only available inside a foreach row; here the handler is on the model itself. ` +
            `Use data-${where.includes("data-event") ? "event" : "click"} with the bare name "${name}".`);
    }
    const hit = lookUp(target.data, ref.segments);
    if (!hit.found) {
        const elsewhere = levels
            .filter(level => level !== target && level.data !== target.data && lookUp(level.data, ref.segments).found)
            .map(level => `${level.prefix}${name} (on ${level.label})`);
        const unreachable = unreachableAncestors(scope)
            .filter(ancestor => lookUp(ancestor.data, ref.segments).found);
        let hint = "";
        if (elsewhere.length) {
            hint = ` It exists as ${elsewhere.join(" and as ")}: did you mean "${elsewhere[0].split(" ")[0]}"?`;
        } else if (unreachable.length) {
            hint = ` It exists on a row ${unreachable[0].depth} levels up, which a handler cannot name: ` +
                `move it to the root model and use "$root.${name}".`;
        } else {
            hint = " It exists nowhere a handler can reach (the current row, $parent., $root.). Add it to the model.";
        }
        throw bindingError("E401", where, `handler "${ref.text}" was not found on ${target.label}.${hint}`);
    }
    if (typeof hit.value !== "function") {
        throw bindingError("E402", where,
            `"${ref.text}" on ${target.label} is ${hit.value === null ? "null" : typeof hit.value}, not a function. ` +
            "A handler must be a method of the model or row.");
    }
    return { fn: hit.value, owner: hit.owner, item: rowItemOf(scope) };
}

module.exports = {
    memberStatus,
    checkWritable,
    lookUp,
    describeBinding,
    checkPathSyntax,
    pathSyntaxProblem,
    readPath,
    pathReader,
    parseHandlerRef,
    resolveHandler,
    rowItemOf,
    rootOf
};

  };
  __stitchModuleFactories[5] = function(module, exports, __stitchRequire){
"use strict";

const paths = __stitchRequire(4);
const { reportError, hasErrorHandler } = __stitchRequire(16);

function createBindingRuntime(deps = {}) {
    const setProperty = deps.setProperty;
    const getValueHandler = deps.getValueHandler;
    const getValueValidator = deps.getValueValidator;
    const getAttrHandler = deps.getAttrHandler;
    const bindForeach = deps.bindForeach;

/**
 * Runs an event handler. An error in it (or in looking it up again) goes to Stitch.onError
 * when a handler is installed, like every other error Stitch catches; with none it stays
 * an ordinary uncaught error of the event listener.
 */
function runHandler(element, type, path, run) {
    try {
        run();
    } catch (error) {
        if (!hasErrorHandler()) {
            throw error;
        }
        reportError(error, { source: "handler", element, binding: `data-${type}="${path}"` });
    }
}

/** What onError is told when a binding's update throws: the element and the binding. */
function bindingErrorContext(element, type, path) {
    return { source: "binding", element, binding: `data-${type}="${path}"` };
}

/** An error about one binding, with its stable code: `[Stitch E###] <span data-text="x">: message`. */
function bindingError(code, element, type, path, message) {
    return new Error(`[Stitch ${code}] ${paths.describeBinding(element, `data-${type}`, path)}: ${message}`);
}

function describeValue(value) {
    if (value === null) return "null";
    if (Array.isArray(value)) return "an array";
    return typeof value === "string" ? `the string ${JSON.stringify(value)}` : `${typeof value} ${String(value)}`;
}

/**
 * Creates a binding effect that reads the binding's path strictly (a missing property
 * throws: from bind() on the first run, to Stitch.onError on a later one) and applies it.
 */
function valueEffect(element, viewModel, type, path, context, apply) {
    const read = paths.pathReader(element, `data-${type}`, path);
    const eff = context.reactiveSystem.effect(() => {
        apply(read(viewModel));
    }, { batch: true, errorContext: bindingErrorContext(element, type, path) });
    context.binder._trackCleanup(element, () => context.reactiveSystem.cleanup(eff));
    return eff;
}

/**
 * @typedef {Object} BindingHandler
 * @property {Function} bind - Establishes reactive binding
 * @property {string} [kind] - "handler" when the value names an event handler (D12)
 *   instead of a property path; the binder then leaves the lookup to the binding.
 */

/**
 * BINDING_HANDLERS - Registry of built-in binding handlers implementing Strategy Pattern.
 *
 * Every value is checked by the binder before bind() is called: valid property-path
 * syntax, and a path that exists on the model (see binding-paths.js). Click names a
 * handler instead (kind: "handler").
 * Supports custom binding registration via DataBinder.registerBinding().
 *
 * @const {Object.<string, BindingHandler>}
 * @example
 * // Custom binding registration (PUBLIC API)
 * Stitch.DataBinder.registerBinding('tooltip', {
 *     bind(element, viewModel, path, context) {
 *         const effect = context.reactiveSystem.effect(() => {
 *             element.setAttribute('title', viewModel[path] || '');
 *         });
 *         context.binder._trackCleanup(element, () => context.reactiveSystem.cleanup(effect));
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
            valueEffect(element, viewModel, "text", path, context, value => {
                if (typeof value === "function") {
                    throw bindingError("E301", element, "text", path,
                        `"${path}" is a function; data-text shows a value. Make it a computed ` +
                        "(Stitch.computed(function () { ... })) and bind that, or bind the property it returns.");
                }
                element.textContent = value != null ? value : "";
            });
        }
    },
    /**
     * value binding - Two-way data binding for form inputs with automatic type conversion.
     * Model changes update view, view changes update model.
     */
    value: {
        bind(element, viewModel, path, context) {
            const handler = getValueHandler(element);
            valueEffect(element, viewModel, "value", path, context, value => {
                handler.modelToView(element, value, viewModel, path);
            });
            const updateModel = () => runHandler(element, "value", path, () => {
                const value = handler.viewToModel(element);
                const validator = getValueValidator(element);
                const validValue = validator.validate(element, value, viewModel, path, "user-input");
                setProperty(viewModel, path, validValue);
            });
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
            valueEffect(element, viewModel, "visible", path, context, value => {
                element.style.display = value ? "" : "none";
            });
        }
    },
    /**
     * enabled binding - Enables/disables element by setting disabled attribute.
     * One-way binding from model to view.
     */
    enabled: {
        bind(element, viewModel, path, context) {
            valueEffect(element, viewModel, "enabled", path, context, value => {
                element.disabled = !value;
            });
        }
    },
    /**
     * click binding - Calls a handler on click (D12).
     * The value is a bare name (the current row; the model outside a list), $parent.name
     * (one level up) or $root.name (the root model). The handler is called with this = the
     * object it is on, and (rowItem, event). A name that is not found throws from bind().
     */
    click: {
        kind: "handler",
        bind(element, viewModel, path, context) {
            const where = paths.describeBinding(element, "data-click", path);
            const ref = paths.parseHandlerRef(where, path);
            paths.resolveHandler(viewModel, ref, where);
            const clickHandler = e => {
                runHandler(element, "click", path, () => {
                    // Looked up again on every click: the model may have replaced the method.
                    const target = paths.resolveHandler(viewModel, ref, where);
                    target.fn.call(target.owner, target.item, e);
                });
            };
            element.addEventListener("click", clickHandler);
            context.binder._trackCleanup(element, () => element.removeEventListener("click", clickHandler));
        }
    },
    /**
     * event binding - Handlers for any DOM events.
     * The value names a model property holding an object that maps event names to handler
     * names (resolved like data-click: bare, $parent.name or $root.name) or functions,
     * e.g. { input: "validate", blur: "$root.save" }. Each handler is called with
     * this = the object it is on, and (rowItem, event).
     */
    event: {
        bind(element, viewModel, path, context) {
            const where = paths.describeBinding(element, "data-event", path);
            const read = paths.pathReader(element, "data-event", path);
            // Track active listeners so each effect run can replace prior registrations.
            const eventListeners = [];
            const removeEventListeners = () => {
                eventListeners.forEach(({ eventName, listener }) => {
                    element.removeEventListener(eventName, listener);
                });
                eventListeners.length = 0;
            };
            const eff = context.reactiveSystem.effect(() => {
                const eventConfig = read(viewModel);
                if (!eventConfig || typeof eventConfig !== "object" || Array.isArray(eventConfig)) {
                    throw bindingError("E304", element, "event", path,
                        `the value must be an object that maps event names to handlers, e.g. { input: "validate" }; ` +
                        `got ${describeValue(eventConfig)}.`);
                }
                // Resolve every entry first: if one is wrong, the listeners stay as they were.
                const next = Object.keys(eventConfig).map(eventName => {
                    const entry = eventConfig[eventName];
                    const entryWhere = `${where} (event "${eventName}")`;
                    if (typeof entry === "function") {
                        const item = paths.rowItemOf(viewModel);
                        return { eventName, listener: e => runHandler(element, "event", path, () => entry.call(item, item, e)) };
                    }
                    if (typeof entry !== "string") {
                        throw new Error(`[Stitch E305] ${entryWhere}: the handler must be a handler name ` +
                            `(e.g. "validate" or "$root.save") or a function; got ${describeValue(entry)}.`);
                    }
                    const ref = paths.parseHandlerRef(entryWhere, entry);
                    paths.resolveHandler(viewModel, ref, entryWhere);
                    return {
                        eventName,
                        listener: e => runHandler(element, "event", path, () => {
                            const target = paths.resolveHandler(viewModel, ref, entryWhere);
                            target.fn.call(target.owner, target.item, e);
                        })
                    };
                });
                removeEventListeners();
                next.forEach(({ eventName, listener }) => {
                    element.addEventListener(eventName, listener);
                    eventListeners.push({ eventName, listener });
                });
            }, { batch: true, errorContext: bindingErrorContext(element, "event", path) });
            context.binder._trackCleanup(element, () => {
                removeEventListeners();
                context.reactiveSystem.cleanup(eff);
            });
        }
    },
    /**
     * class binding - Dynamic CSS class management.
     *
     * The value names a property (an inline object literal is invalid syntax and throws).
     *
     * Two modes:
     * - String mode: `element.className = value` (replaces ALL classes, framework CSS included).
     *   Use it only on elements with no static classes.
     * - Object mode: `element.classList.toggle()` for each listed class name; classes not
     *   listed are left untouched.
     * null / undefined: no change. Any other value throws.
     *
     * @example
     * // HTML: <div class="foo bar baz" data-class="classes">
     * // Model: { classes: { bar: false, qux: true } }
     * // Result: class="foo baz qux"
     */
    class: {
        bind(element, viewModel, path, context) {
            valueEffect(element, viewModel, "class", path, context, value => {
                if (typeof value === "string") {
                    element.className = value;
                } else if (value && typeof value === "object" && !Array.isArray(value)) {
                    Object.keys(value).forEach(className => {
                        element.classList.toggle(className, !!value[className]);
                    });
                } else if (value !== null && value !== undefined) {
                    throw bindingError("E302", element, "class", path,
                        `the value must be a class string or an object of { className: boolean }; got ${describeValue(value)}.`);
                }
            });
        }
    },
    /**
     * attr binding - Dynamic HTML attribute management with type-aware handling.
     *
     * The value names a property holding an object of { attributeName: value }; only the
     * attributes it lists are managed (static attributes stay; a listed one is overwritten).
     * Supports strings, numbers, booleans, objects (style), arrays (class), null/undefined
     * (removes the attribute). A null / undefined object: no change. Any other value throws.
     *
     * @example
     * // Model: { linkAttrs: { href: url, target: "_blank", 'aria-disabled': false } }
     * // HTML: <a data-attr="linkAttrs">
     */
    attr: {
        bind(element, viewModel, path, context) {
            valueEffect(element, viewModel, "attr", path, context, value => {
                if (typeof value === "object" && value !== null && !Array.isArray(value)) {
                    Object.keys(value).forEach(attrName => {
                        const attrValue = value[attrName];
                        const handler = getAttrHandler(attrValue);
                        handler.apply(element, attrName, attrValue);
                    });
                } else if (value !== null && value !== undefined) {
                    throw bindingError("E303", element, "attr", path,
                        `the value must be an object of { attributeName: value }, e.g. { href: url, target: "_blank" }; ` +
                        `got ${describeValue(value)}.`);
                }
            });
        }
    },
    /**
     * foreach binding - Keyed list rendering (see foreach-binding-orchestrator.js).
     * One implementation for every list element, <select> included.
     * Provides $data, $index, $parent and $root to the rows.
     */
    foreach: {
        bind(element, viewModel, path, context) {
            if (typeof bindForeach !== "function") {
                throw new Error(`[Stitch E993] foreach binding is not available: createBindingRuntime() was given no bindForeach.`);
            }
            return bindForeach(element, viewModel, path, context);
        }
    },
    /**
     * loading binding - Composite binding for loading states.
     * Sets/removes disabled, toggles 'loading' class, sets aria-busy.
     */
    loading: {
        bind(element, viewModel, path, context) {
            valueEffect(element, viewModel, "loading", path, context, isLoading => {
                element.disabled = !!isLoading;
                element.classList.toggle("loading", !!isLoading);
                element.setAttribute("aria-busy", isLoading ? "true" : "false");
            });
        }
    }
};

/**
 * Retrieves a binding handler by name (e.g. 'text' for data-text), or null.
 *
 * @param {string} type
 * @returns {BindingHandler|null}
 */
function getBindingHandler(type) {
    return Object.prototype.hasOwnProperty.call(BINDING_HANDLERS, type) ? BINDING_HANDLERS[type] : null;
}

    return {
        BINDING_HANDLERS,
        getBindingHandler
    };
}

module.exports = {
    createBindingRuntime
};

  };
  __stitchModuleFactories[6] = function(module, exports, __stitchRequire){
"use strict";

/**
 * Binding discovery (D24). Stitch looks only for its OWN attributes, by selector:
 *   - the registered binding names (built-ins + DataBinder.registerBinding names): data-<name>;
 *   - the internal attributes that configure a list: data-key, data-template,
 *     data-default-text, data-default-value.
 * No other data-* attribute is ever read in the default path; there is no fuzzy matching
 * (data-txt is not "almost data-text": it is simply not Stitch's). Only when a report
 * function is installed with Stitch.onBindReport(fn) does bind() also look at the other
 * data-* attributes, to list them as ignored.
 */

// Attributes Stitch reads that are not bindings. Each one belongs on a data-foreach element.
const INTERNAL_ATTRIBUTES = ["data-key", "data-template", "data-default-text", "data-default-value"];
// Attributes a binding reads on its own element (data-value reads data-type). They are
// Stitch's (the bind report lists them as bound) but they do not make an element a target.
const READ_ATTRIBUTES = ["data-type"];

// A binding name becomes the attribute data-<name>; HTML lowercases attribute names, so
// a name must be lowercase to ever match.
const BINDING_NAME = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;

/** The selector that finds every element carrying one of our attributes. */
function bindingSelector(names) {
    return names.map(name => `[data-${name}]`)
        .concat(INTERNAL_ATTRIBUTES.map(attribute => `[${attribute}]`))
        .join(",");
}

/**
 * The bindings on one element, by asking for each registered name (the element's other
 * attributes are not looked at). foreach comes first: on a <select>, the options exist
 * before data-value is applied.
 * @returns {Array<{type: string, path: string, attributeName: string}>}
 */
function readElementBindings(element, names) {
    const bindings = [];
    for (const name of names) {
        const attributeName = `data-${name}`;
        const value = element.getAttribute(attributeName);
        if (value !== null) {
            const binding = { type: name, path: value, attributeName };
            if (name === "foreach") bindings.unshift(binding); else bindings.push(binding);
        }
    }
    return bindings;
}

/** True for an attribute Stitch acts on: a registered binding or an internal attribute. */
function isOurAttribute(attributeName, names) {
    if (INTERNAL_ATTRIBUTES.indexOf(attributeName) !== -1 || READ_ATTRIBUTES.indexOf(attributeName) !== -1) return true;
    return attributeName.startsWith("data-") && names.indexOf(attributeName.slice(5)) !== -1;
}

/**
 * The opt-in report (Stitch.onBindReport): every data-* attribute in root, split into
 * bound (ours: a binding or an internal attribute) and ignored (not ours).
 * @returns {{bound: Array<{element, attribute, value}>, ignored: Array<{element, attribute, value}>}}
 */
function collectBindReport(root, names) {
    const bound = [];
    const ignored = [];
    const elements = [root].concat(Array.from(root.querySelectorAll("*")));
    for (const element of elements) {
        for (const attribute of Array.from(element.attributes)) {
            if (!attribute.name.startsWith("data-")) continue;
            const entry = { element, attribute: attribute.name, value: attribute.value };
            (isOurAttribute(attribute.name, names) ? bound : ignored).push(entry);
        }
    }
    return { bound, ignored };
}

module.exports = {
    INTERNAL_ATTRIBUTES,
    READ_ATTRIBUTES,
    BINDING_NAME,
    bindingSelector,
    readElementBindings,
    isOurAttribute,
    collectBindReport
};

  };
  __stitchModuleFactories[7] = function(module, exports, __stitchRequire){
"use strict";

const { VERSION } = __stitchRequire(25);
const { runAllThenThrow, reportError } = __stitchRequire(16);
const paths = __stitchRequire(4);
const discovery = __stitchRequire(6);
const { createHookSlot } = __stitchRequire(19);

// The report function installed with Stitch.onBindReport(fn), or none (the default:
// then bind() never looks at data-* attributes that are not Stitch's).
const reportSlot = createHookSlot("Stitch.onBindReport");

/**
 * Installs (or, with null, removes) the page-wide bind report. When installed, every
 * bind() that succeeds calls fn({ bound, ignored }): each data-* attribute in the bound
 * element, as { element, attribute, value }, split into Stitch's own (bound) and the
 * others (ignored, e.g. a misspelled data-txt, data-testid, data-bs-*). Returns a function
 * that removes it; installing while another one is installed throws.
 * @param {Function|null} fn
 * @returns {Function} remove
 */
function onBindReport(fn) {
    return reportSlot.install(fn);
}

// Page-wide ownership, across every DataBinder: an element carrying bindings belongs to
// the binder that bound it, and a bound root to the binder that bound it. A second bind of
// either throws instead of silently doing nothing or binding twice (B1, S2).
const BOUND_BY = new WeakMap();
const ROOT_OF = new WeakMap();

// Bindings that replace their element's whole content: a bound element inside would be
// destroyed by the first render (B2).
const CONTENT_REPLACING = ["text"];

// Row-context values a two-way binding cannot write back to (B4).
const ROW_NAMES = ["$data", "$index", "$parent", "$root"];

const KNOWN_HOOKS = ["onBind", "onChange", "properties"];

function createDataBinderClass(deps = {}) {
    const Version = deps.version || `v${VERSION}`;
    const getBindingHandler = deps.getBindingHandler;
    const BINDING_HANDLERS = deps.bindingHandlers || Object.create(null);
    // Built-in names: only these may declare kind "handler" (a value that names a handler,
    // checked by the binding itself; every other value is a property path the binder checks).
    const BUILT_IN_NAMES = new Set(Object.keys(BINDING_HANDLERS));
    // Set by the first bind(): custom bindings must be registered before it.
    let bindStarted = false;
    // The selector over the registered names, rebuilt when a binding is registered.
    let cachedNames = null;
    let cachedSelector = null;
    function bindingNames() {
        if (!cachedNames) {
            cachedNames = Object.keys(BINDING_HANDLERS);
            cachedSelector = discovery.bindingSelector(cachedNames);
        }
        return cachedNames;
    }
    function selector() {
        bindingNames();
        return cachedSelector;
    }

    function describeElement(element) {
        const id = element.id ? ` id="${element.id}"` : "";
        return `<${element.tagName.toLowerCase()}${id}>`;
    }

    /** `<b id="x" data-text="name">`: an element with its first Stitch attribute. */
    function describeOurs(element) {
        const bindings = discovery.readElementBindings(element, bindingNames());
        if (bindings.length) {
            return paths.describeBinding(element, bindings[0].attributeName, bindings[0].path);
        }
        const internal = discovery.INTERNAL_ATTRIBUTES.find(attribute => element.hasAttribute(attribute));
        return internal ? paths.describeBinding(element, internal, element.getAttribute(internal)) : describeElement(element);
    }

    function isHandlerBinding(type) {
        const handler = getBindingHandler(type);
        return handler.kind === "handler" && BUILT_IN_NAMES.has(type);
    }

    function isLiteralBinding(type) {
        return getBindingHandler(type).value === "literal";
    }

    /**
     * A custom binding reads its value as a property path unless it was registered with
     * value: "literal". When the value is not a path, or names nothing on the model, the error
     * also says how to declare the binding literal (the likely intent: data-tooltip="Save").
     */
    function withLiteralHint(type, check) {
        try {
            return check();
        } catch (error) {
            if (error && typeof error.message === "string") {
                error.message += ` data-${type} is a custom binding, which reads its value as a property path. If the value ` +
                    `is text, register it as literal: registerBinding("${type}", { value: 'literal', bind(element, model, text) { ... } }).`;
            }
            throw error;
        }
    }

    /**
     * Stitch's internal attributes configure a list; on any other element they would do
     * nothing, silently, so they throw.
     */
    function checkInternalAttributes(element) {
        const isList = element.hasAttribute("data-foreach");
        for (const attribute of ["data-key", "data-template"]) {
            if (element.hasAttribute(attribute) && !isList) {
                throw new Error(
                    `[Stitch E531] ${paths.describeBinding(element, attribute, element.getAttribute(attribute))}: ` +
                    `${attribute} only works on an element with data-foreach (it configures the list's rows). ` +
                    `Add data-foreach to this element, or remove ${attribute}.`
                );
            }
        }
        const hasDefaultText = element.hasAttribute("data-default-text");
        for (const attribute of ["data-default-text", "data-default-value"]) {
            if (element.hasAttribute(attribute) && !(isList && element.tagName === "SELECT")) {
                throw new Error(
                    `[Stitch E532] ${paths.describeBinding(element, attribute, element.getAttribute(attribute))}: ` +
                    `${attribute} only works on a <select> with data-foreach (it adds a placeholder option). ` +
                    `Move it to the <select data-foreach>, or remove it.`
                );
            }
        }
        if (element.hasAttribute("data-default-value") && !hasDefaultText) {
            throw new Error(
                `[Stitch E533] ${paths.describeBinding(element, "data-default-value", element.getAttribute("data-default-value"))}: ` +
                `data-default-value is the value of the placeholder option, which data-default-text creates. ` +
                `Add data-default-text="Choose..." or remove data-default-value.`
            );
        }
        if (isList && element.hasAttribute("data-template") && element.firstElementChild) {
            throw new Error(
                `[Stitch E516] ${paths.describeBinding(element, "data-template", element.getAttribute("data-template"))}: ` +
                `the list takes its rows from the <template>, so the elements written inside it (${describeOurs(element.firstElementChild)}) ` +
                `would be discarded. Remove them, or remove data-template to use them as the row template.`
            );
        }
    }

    /**
     * The checks that need no model: internal attributes, combinations, content-replacing
     * bindings over bound elements (B2), and the syntax of every value (D24, B4).
     */
    function checkStatically(element, bindings) {
        checkInternalAttributes(element);
        const types = bindings.map(binding => binding.type);
        if (types.indexOf("foreach") !== -1 && types.indexOf("text") !== -1) {
            throw new Error(
                `[Stitch E534] ${describeElement(element)} has data-foreach="${element.getAttribute("data-foreach")}" ` +
                `and data-text="${element.getAttribute("data-text")}": data-text would replace the list's rows. ` +
                `Put the text on another element (e.g. a heading before the list).`
            );
        }
        for (const binding of bindings) {
            if (CONTENT_REPLACING.indexOf(binding.type) !== -1) {
                const inner = element.querySelector(selector());
                if (inner) {
                    throw new Error(
                        `[Stitch E535] ${paths.describeBinding(element, binding.attributeName, binding.path)} contains ` +
                        `${describeOurs(inner)}: ${binding.attributeName} would replace the element's content, destroying the ` +
                        "binding inside it. Put the text in its own element (e.g. a <span>) next to the bound elements."
                    );
                }
            }
            if (isLiteralBinding(binding.type)) {
                continue;
            }
            if (isHandlerBinding(binding.type)) {
                paths.parseHandlerRef(paths.describeBinding(element, binding.attributeName, binding.path), binding.path);
                continue;
            }
            const path = BUILT_IN_NAMES.has(binding.type)
                ? paths.checkPathSyntax(element, binding.attributeName, binding.path)
                : withLiteralHint(binding.type, () => paths.checkPathSyntax(element, binding.attributeName, binding.path));
            if (binding.type === "value") {
                const segments = path.split(".");
                // Any read-only context value, at any depth: $parent.$index, $root.$data, ...
                if (ROW_NAMES.indexOf(segments[segments.length - 1]) !== -1 || segments.indexOf("$index") !== -1) {
                    throw new Error(
                        `[Stitch E313] ${paths.describeBinding(element, binding.attributeName, binding.path)}: ` +
                        `a two-way binding cannot write to ${path} (it is the row's own context value, so writing it ` +
                        "would not change the list); bind a property instead, e.g. data-value=\"$data.name\" with a list " +
                        "of objects, or data-value=\"$root.selected\"."
                    );
                }
            }
        }
    }

    /** Throws if element (or root) is already bound, by this binder or another one. */
    function alreadyBoundError(element, owner, self, asRoot) {
        return new Error(
            `[Stitch E601] ${describeOurs(element)}${asRoot ? " (a bind() root)" : ""} is already bound by ` +
            `${owner === self ? "this DataBinder" : "another DataBinder"}. Binding it again would leave it on the first ` +
            "model or bind it twice. Call unbind() on the root that bound it first (or dispose() that binder), then bind again."
        );
    }

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
        /** @type {Set<HTMLElement>} Roots this binder bound with bind() */
        this._roots = new Set;
        /** @type {Object} Lifecycle hooks */
        this.hooks = this.createHooks(hooks);
        /** @type {Map<HTMLElement, Set<Function>>} Cleanup functions per element for unbind */
        this._elementCleanups = new Map();
        /** @type {boolean} Whether binder has been disposed */
        this._disposed = false;
        /** What the bind() in progress created, so a failure releases exactly that. */
        this._bindLog = null;
    }

    /**
     * Resolves a selector or element argument of a public method, or throws.
     * @private
     */
    _resolveElement(element, method) {
        if (typeof element === "string") {
            const selectorText = element;
            element = typeof document !== "undefined" ? document.querySelector(selectorText) : null;
            if (!element) {
                throw new Error(`[Stitch E602] ${method}("${selectorText}"): no element matches that selector.`);
            }
        }
        if (!element || typeof element.querySelectorAll !== "function" || typeof element.matches !== "function") {
            throw new Error(`[Stitch E603] ${method}(element): element must be a DOM element or a selector, got ${element === null ? "null" : typeof element}.`);
        }
        return element;
    }

    /**
     * Binds DOM element (and children) to reactive view model.
     *
     * Every binding is checked first: valid syntax, a property the model has (or, for
     * data-click, a handler that exists). A mistake throws, naming the element, the binding
     * and the fix, and leaves nothing of this bind() behind. A root (or element) that is
     * already bound throws: unbind() it first.
     *
     * @param {string|HTMLElement} element - CSS selector or HTMLElement
     * @param {Object} viewModel - Reactive view model (must be from Observable.create())
     * @throws {Error} If viewModel not reactive, element invalid or bound, or a binding is wrong
     * @example
     * const model = Stitch.Observable.create({ count: 0 });
     * binder.bind('#app', model);
     */
    bind(element, viewModel) {
        if (this._disposed) {
            throw new Error(`[Stitch E605] bind(): this DataBinder was disposed. Create a new DataBinder to bind again.`);
        }
        element = this._resolveElement(element, "bind");
        if (!viewModel || !viewModel._factory || !viewModel._factory.reactiveSystem) {
            throw new Error(`[Stitch E604] bind(element, model): model must be created with Stitch.Observable.create().`);
        }
        const rootOwner = ROOT_OF.get(element);
        if (rootOwner) {
            throw alreadyBoundError(element, rootOwner, this, true);
        }
        bindStarted = true;
        this.reactiveSystem = viewModel._factory.reactiveSystem;

        const outer = this._bindLog;
        const log = { cleanups: [], elements: [] };
        this._bindLog = log;
        try {
            // Global onChange hook: subscribe once per root bind and route model change events.
            // It runs as a model change handler, so an error in it goes to Stitch.onError.
            if (typeof this.hooks.onChange === "function") {
                const onChangeHandler = change => {
                    this.hooks.onChange.call(this, change, viewModel, element);
                };
                viewModel.$onChange(onChangeHandler);
                this._trackCleanup(element, () => viewModel.$offChange(onChangeHandler));
            }
            this._bindElement(element, viewModel, []);
        } catch (error) {
            this._bindLog = outer;
            this._rollback(log);
            throw error;
        }
        this._bindLog = outer;
        ROOT_OF.set(element, this);
        this._roots.add(element);

        const reporter = reportSlot.get();
        if (reporter) {
            reporter(discovery.collectBindReport(element, bindingNames()));
        }
    }

    /**
     * Releases exactly what a failed bind() created (its cleanups, its element marks),
     * newest first; nothing an earlier bind() made is touched.
     * @private
     */
    _rollback(log) {
        const runs = [];
        for (let i = log.cleanups.length - 1; i >= 0; i--) {
            const [element, fn] = log.cleanups[i];
            runs.push(() => {
                const set = this._elementCleanups.get(element);
                if (set && set.has(fn)) {
                    set.delete(fn);
                    if (set.size === 0) this._elementCleanups.delete(element);
                    fn();
                }
            });
        }
        for (const element of log.elements) {
            this.boundElements.delete(element);
            if (BOUND_BY.get(element) === this) BOUND_BY.delete(element);
        }
        try {
            runAllThenThrow(runs, { source: "unbind" });
        } catch (cleanupError) {
            // The bind() error is the one thrown; a cleanup error on the way is not lost.
            reportError(cleanupError, { source: "unbind" });
        }
    }

    /**
     * Creates hooks object with defaults. Unknown hook names and non-function hooks throw.
     * @private
     */
    createHooks(userHooks = {}) {
        if (userHooks === null || typeof userHooks !== "object") {
            throw new TypeError(`[Stitch E611] new DataBinder(hooks): hooks must be an object, got ${userHooks === null ? "null" : typeof userHooks}.`);
        }
        for (const name of Object.keys(userHooks)) {
            if (KNOWN_HOOKS.indexOf(name) === -1) {
                throw new Error(`[Stitch E612] new DataBinder(hooks): unknown hook "${name}". Known hooks: ${KNOWN_HOOKS.join(", ")}.`);
            }
        }
        for (const name of ["onBind", "onChange"]) {
            if (userHooks[name] !== undefined && userHooks[name] !== null && typeof userHooks[name] !== "function") {
                throw new TypeError(`[Stitch E613] new DataBinder(hooks): ${name} must be a function, got ${typeof userHooks[name]}.`);
            }
        }
        if (userHooks.properties !== undefined && (userHooks.properties === null || typeof userHooks.properties !== "object")) {
            throw new TypeError(`[Stitch E614] new DataBinder(hooks): properties must be an object of { propertyName: { onBind, onChange } }.`);
        }
        for (const [property, hooks] of Object.entries(userHooks.properties || {})) {
            if (hooks === null || typeof hooks !== "object") {
                throw new TypeError(`[Stitch E615] new DataBinder(hooks): properties.${property} must be an object of { onBind, onChange }.`);
            }
            for (const name of Object.keys(hooks)) {
                if (name !== "onBind" && name !== "onChange") {
                    throw new Error(`[Stitch E616] new DataBinder(hooks): unknown hook "properties.${property}.${name}". Known: onBind, onChange.`);
                }
                if (typeof hooks[name] !== "function") {
                    throw new TypeError(`[Stitch E617] new DataBinder(hooks): properties.${property}.${name} must be a function.`);
                }
            }
        }
        return {
            onBind: userHooks.onBind || null,
            onChange: userHooks.onChange || null,
            properties: userHooks.properties || {}
        };
    }

    /**
     * Binds root and the elements inside it that carry Stitch's attributes, found by
     * selector (D24), in document order. A foreach element is a boundary: its rows are
     * bound by the list itself, so nothing inside it is bound here. Every element is
     * checked (static rules, not already bound) before any is bound.
     *
     * @private
     * @param {HTMLElement} root - Element to bind
     * @param {Object} context - Binding context (the model or a row context)
     * @param {string[]} contextPath - Current path in view model
     */
    _bindElement(root, context, contextPath) {
        const ours = selector();
        const targets = root.matches(ours) ? [root] : [];
        if (!this._isBindingBoundary(root)) {
            // Collected before anything is bound, while the DOM is as written.
            const found = root.querySelectorAll(ours);
            let boundary = null;
            for (let i = 0; i < found.length; i++) {
                const element = found[i];
                if (boundary && boundary.contains(element)) {
                    continue;
                }
                targets.push(element);
                boundary = this._isBindingBoundary(element) ? element : null;
            }
        }
        const names = bindingNames();
        const planned = targets.map(element => {
            const owner = BOUND_BY.get(element);
            if (owner) {
                throw alreadyBoundError(element, owner, this, false);
            }
            const bindings = discovery.readElementBindings(element, names);
            checkStatically(element, bindings);
            return { element, bindings };
        });
        for (const { element, bindings } of planned) {
            this._processBindings(element, context, contextPath, bindings);
        }
    }

    /**
     * Checks a foreach row template at bind(), before (and whether or not) any row exists
     * (B3): every rule that does not depend on a row's data, plus $root. paths and
     * handlers, which the root model can answer. Row property names are checked when a row
     * is rendered.
     * @private
     * @param {HTMLElement} template - a detached copy of the row template
     * @param {Object} listScope - the scope the list is bound in (model or row context)
     */
    _checkTemplate(template, listScope) {
        const root = paths.rootOf(listScope);
        const names = bindingNames();
        // $parent of a row of this list is listScope (the model, for a top-level list); inside
        // a nested list it is that list's row, which does not exist yet.
        const parentData = paths.rowItemOf(listScope);
        const elements = (template.matches(selector()) ? [template] : []).concat(Array.from(template.querySelectorAll(selector())));
        const insideNestedList = element => {
            let current = element === template ? null : element.parentElement;
            while (current) {
                if (current.hasAttribute("data-foreach")) return true;
                if (current === template) return false;
                current = current.parentElement;
            }
            return false;
        };
        const checkHandlerName = (ref, where, ownLevel) => {
            const data = ref.level === "root" ? root : ref.level === "parent" && ownLevel ? parentData : undefined;
            if (data === undefined) return;
            const label = ref.level === "root" ? "the root model" : (paths.rowItemOf(listScope) === root ? "the model ($parent of a top-level row)" : "the parent row");
            const hit = paths.lookUp(data, ref.segments);
            if (!hit.found) {
                throw new Error(`[Stitch E404] ${where}: handler "${ref.text}" was not found on ${label}. ` +
                    "If it is a method of each row, use the bare name; if it is on the root model, use $root.name.");
            }
            if (typeof hit.value !== "function") {
                throw new Error(`[Stitch E405] ${where}: "${ref.text}" on ${label} is ${hit.value === null ? "null" : typeof hit.value}, not a function.`);
            }
        };
        for (const element of elements) {
            const bindings = discovery.readElementBindings(element, names);
            checkStatically(element, bindings);
            const ownLevel = !insideNestedList(element);
            for (const binding of bindings) {
                if (isLiteralBinding(binding.type)) continue;
                const where = paths.describeBinding(element, binding.attributeName, binding.path);
                if (isHandlerBinding(binding.type)) {
                    const ref = paths.parseHandlerRef(where, binding.path);
                    if (ref.level === "parent" && ownLevel) {
                        checkHandlerName(ref, where, ownLevel);
                    }
                    if (ref.level === "root") {
                        // No row exists yet, so only the root model can be asked.
                        const hit = paths.lookUp(root, ref.segments);
                        if (!hit.found) {
                            throw new Error(`[Stitch E406] ${where}: handler "${ref.text}" was not found on the root model. ` +
                                "If it is a method of each row, use the bare name; if it is on the enclosing row, use $parent.name.");
                        }
                        if (typeof hit.value !== "function") {
                            throw new Error(`[Stitch E407] ${where}: "${ref.text}" on the root model is ` +
                                `${hit.value === null ? "null" : typeof hit.value}, not a function.`);
                        }
                    }
                    continue;
                }
                const path = binding.path.trim();
                let scopeData;
                let rest = null;
                if (path.indexOf("$root.") === 0) {
                    scopeData = root;
                    rest = path.slice("$root.".length);
                } else if (path.indexOf("$parent.") === 0 && ownLevel) {
                    scopeData = listScope;
                    rest = path.slice("$parent.".length);
                }
                if (rest === null) continue;
                const value = paths.readPath(scopeData, rest, () => where);
                if (binding.type === "event" && value && typeof value === "object") {
                    // The handler names inside the map: $root. ones (and $parent. ones at this
                    // level) can be checked now; bare names belong to the row.
                    for (const eventName of Object.keys(value)) {
                        if (typeof value[eventName] !== "string") continue;
                        const entryWhere = `${where} (event "${eventName}")`;
                        checkHandlerName(paths.parseHandlerRef(entryWhere, value[eventName]), entryWhere, ownLevel);
                    }
                }
            }
        }
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
        return element.hasAttribute("data-foreach");
    }

    /**
     * Applies the bindings of a single element (once).
     * @private
     */
    _processBindings(element, context, contextPath, bindings) {
        if (bindings.length === 0) {
            return;
        }
        BOUND_BY.set(element, this);
        this.boundElements.add(element);
        if (this._bindLog) {
            this._bindLog.elements.push(element);
        }
        bindings.forEach(binding => {
            this._applyTypedBinding(element, context, binding.type, binding.path, contextPath);
        });

        // On the bind() stack an error here throws to the caller; for a row rendered
        // later it is part of the list's re-render and goes to Stitch.onError.
        if (typeof this.hooks.onBind === "function") {
            this.hooks.onBind.call(this, element, context, bindings);
        }
    }

    /**
     * Checks one binding (syntax, and that its path exists: D24/D25), then delegates to its
     * handler. Property-specific hooks (onBind) replace the handler. A custom binding
     * registered with value: "literal" gets the raw attribute text and no lookup (D27).
     * @private
     */
    _applyTypedBinding(element, viewModel, type, rawPath, contextPath = []) {
        const handler = getBindingHandler(type);
        const attribute = `data-${type}`;
        let path;
        let value;
        if (isLiteralBinding(type)) {
            path = rawPath;
            value = rawPath;
        } else if (isHandlerBinding(type)) {
            // A handler reference: the binding parses and looks it up itself (D12).
            path = String(rawPath).trim();
        } else {
            if (BUILT_IN_NAMES.has(type)) {
                path = paths.checkPathSyntax(element, attribute, rawPath);
                value = paths.readPath(viewModel, path, () => paths.describeBinding(element, attribute, path));
            } else {
                path = withLiteralHint(type, () => paths.checkPathSyntax(element, attribute, rawPath));
                value = withLiteralHint(type, () => paths.readPath(viewModel, path, () => paths.describeBinding(element, attribute, path)));
            }
            if (type === "value") {
                paths.checkWritable(viewModel, path, () => paths.describeBinding(element, attribute, path));
            }
        }

        // Construct full path from context
        const fullPath = contextPath.length > 0 ? `${contextPath.join('.')}.${path}` : path;

        // Check for property-specific hooks
        // Try property name first, then full path (matches historical behavior)
        const propertyName = path.split('.').pop();
        const propertyHooks = this.hooks.properties[propertyName] || this.hooks.properties[fullPath] || this.hooks.properties[path];

        if (propertyHooks && propertyHooks.onBind) {
            // Create binding object for hook (matches historical signature)
            const binding = { type, path, attributeName: attribute };
            // Call onBind hook with DataBinder as 'this'
            propertyHooks.onBind.call(this, element, value, binding, fullPath);
        } else {
            handler.bind(element, viewModel, path, {
                reactiveSystem: this.reactiveSystem,
                binder: this
            });
        }

        // Set up onChange hook if it exists (always, even if onBind exists)
        if (propertyHooks && propertyHooks.onChange && !isLiteralBinding(type)) {
            const binding = { type, path, attributeName: attribute };
            const read = paths.pathReader(element, attribute, path);
            let oldValue = value;
            const eff = this.reactiveSystem.effect(() => {
                const newValue = read(viewModel);
                // Call onChange hook with DataBinder as 'this'
                propertyHooks.onChange.call(this, element, newValue, oldValue, binding, fullPath);
                oldValue = newValue;
            }, { errorContext: { source: "binding", element, binding: `${attribute}="${path}"` } });
            this._trackCleanup(element, () => this.reactiveSystem.cleanup(eff));
        }
    }

    /**
     * Unbinds an element AND every element inside it: runs all their cleanups (effects
     * released, listeners removed) and forgets them. The DOM is left as it is.
     * Every cleanup runs; if one threw, the first error is thrown afterwards.
     * A selector that matches nothing, or an element with nothing bound by this binder in
     * it, throws.
     *
     * @param {string|HTMLElement} element - CSS selector or HTMLElement
     */
    unbind(element) {
        if (this._disposed) {
            throw new Error(`[Stitch E606] unbind(): this DataBinder was disposed; everything it bound is already released.`);
        }
        element = this._resolveElement(element, "unbind");
        const roots = Array.from(this._roots).filter(root => root === element || element.contains(root));
        const hasBound = this._elementCleanups.has(element) || this.boundElements.has(element) ||
            Array.from(element.querySelectorAll("*")).some(el => this._elementCleanups.has(el) || this.boundElements.has(el));
        if (!hasBound && roots.length === 0) {
            throw new Error(
                `[Stitch E607] unbind(${describeElement(element)}): nothing is bound by this DataBinder in that element. ` +
                "Pass the element (or an ancestor of the elements) given to bind(), with the binder that bound it."
            );
        }
        for (const root of roots) {
            this._roots.delete(root);
            if (ROOT_OF.get(root) === this) ROOT_OF.delete(root);
        }
        this._unbindTree(element);
    }

    /**
     * Releases the bindings of root and all of its descendants.
     * @private
     */
    _unbindTree(root) {
        const elements = [root];
        if (typeof root.querySelectorAll === "function" && root.firstElementChild) {
            elements.push(...root.querySelectorAll("*"));
        }
        // Every cleanup runs, even after one throws; then the first error is thrown.
        runAllThenThrow(elements.map(element => () => this._releaseElement(element)), { source: "unbind" });
    }

    /**
     * Runs one element's cleanups and forgets the element. Every cleanup runs; the first
     * error is thrown afterwards.
     * @private
     */
    _releaseElement(element) {
        this.boundElements.delete(element);
        if (BOUND_BY.get(element) === this) {
            BOUND_BY.delete(element);
        }
        const cleanups = this._elementCleanups.get(element);
        if (cleanups) {
            this._elementCleanups.delete(element);
            runAllThenThrow(cleanups, { source: "unbind", element });
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
            if (this._bindLog) {
                this._bindLog.cleanups.push([element, cleanupFn]);
            }
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

        // Run all cleanup functions (effects + event listeners); every one runs, then the
        // first error (if any) is thrown.
        const cleanups = [];
        this._elementCleanups.forEach(set => set.forEach(fn => cleanups.push(fn)));
        this._elementCleanups.clear();
        this.boundElements.forEach(element => {
            if (BOUND_BY.get(element) === this) BOUND_BY.delete(element);
        });
        this.boundElements.clear();
        this._roots.forEach(root => {
            if (ROOT_OF.get(root) === this) ROOT_OF.delete(root);
        });
        this._roots.clear();
        this.reactiveSystem = null;
        runAllThenThrow(cleanups, { source: "dispose" });
    }
}

/**
 * Registers a custom binding handler (PUBLIC API).
 * Extends framework without modifying core code.
 *
 * Rules (each one throws when broken):
 * - name is lowercase letters, digits and dashes (it becomes the attribute data-<name>,
 *   and HTML lowercases attribute names), not an existing binding, not one of Stitch's
 *   internal attributes (key, template, default-text, default-value);
 * - handler has a bind() method;
 * - handler.value, if set, is "path" (the default: the attribute names a model property,
 *   checked like any other binding) or "literal" (the raw attribute text is passed to
 *   bind() and nothing is looked up) (D27);
 * - it is registered BEFORE the first bind() on the page: elements bound earlier would
 *   silently miss it.
 *
 * @static
 * @param {string} name - Binding name (e.g., 'tooltip' for data-tooltip)
 * @param {BindingHandler} handler - Handler object with bind() method
 * @throws {Error} If a rule above is broken
 * @example
 * // A path binding (the default): data-tooltip="helpText" follows model.helpText.
 * Stitch.DataBinder.registerBinding('tooltip', {
 *     bind(element, viewModel, path, context) {
 *         const effect = context.reactiveSystem.effect(() => {
 *             element.setAttribute('title', viewModel[path] || '');
 *         });
 *         context.binder._trackCleanup(element, () => context.reactiveSystem.cleanup(effect));
 *     }
 * });
 * // A literal binding: data-hint="Shown as is" passes the text itself.
 * Stitch.DataBinder.registerBinding('hint', {
 *     value: 'literal',
 *     bind(element, viewModel, text) { element.setAttribute('title', text); }
 * });
 */
DataBinder.registerBinding = function (name, handler) {
    if (typeof name !== "string") {
        throw new Error(`[Stitch E622] registerBinding: name must be a string`);
    }
    if (!discovery.BINDING_NAME.test(name)) {
        throw new Error(
            `[Stitch E623] registerBinding("${name}"): a binding name must be lowercase letters, digits and dashes ` +
            `(e.g. "tooltip" or "date-format"): it becomes the attribute data-${name.toLowerCase()}, and HTML lowercases attribute names.`
        );
    }
    if (discovery.INTERNAL_ATTRIBUTES.concat(discovery.READ_ATTRIBUTES).indexOf(`data-${name}`) !== -1) {
        throw new Error(`[Stitch E624] registerBinding("${name}"): data-${name} is reserved by Stitch (it configures lists or form-value conversion). Choose another name.`);
    }
    if (!handler || typeof handler.bind !== "function") {
        throw new Error(`[Stitch E625] registerBinding: handler must have a bind() method`);
    }
    if (handler.value !== undefined && handler.value !== "path" && handler.value !== "literal") {
        throw new Error(
            `[Stitch E626] registerBinding("${name}"): value must be "path" or "literal": "path" (the default) when the ` +
            `attribute names a model property, "literal" when the attribute text is passed as is. Got ${JSON.stringify(handler.value)}.`
        );
    }
    if (Object.prototype.hasOwnProperty.call(BINDING_HANDLERS, name)) {
        throw new Error(
            `[Stitch E627] registerBinding("${name}"): data-${name} is already registered` +
            `${BUILT_IN_NAMES.has(name) ? " (a built-in binding)" : ""}. Choose another name.`
        );
    }
    if (bindStarted) {
        throw new Error(
            `[Stitch E621] registerBinding("${name}") was called after bind(): elements bound before it would ` +
            "not get the binding. Register every custom binding before the first bind() on the page."
        );
    }
    BINDING_HANDLERS[name] = handler;
    cachedNames = null;
};
    return DataBinder;
}

module.exports = {
    createDataBinderClass,
    onBindReport
};

  };
  __stitchModuleFactories[8] = function(module, exports, __stitchRequire){
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
            `[Stitch E505] ${describeList(element, path)}: data-key is empty. ` +
            `Set it to the field that identifies a row (e.g. data-key="sku"), or remove it to use "id".`
        );
    }
    return field;
}

/**
 * Reads the row template from the list element (inline) or from the <template> named
 * by data-template, enforcing the one-root rule. Returns a detached copy that is
 * cloned for every row; it is never bound itself. Changes nothing in the DOM.
 */
function readRowTemplate(element, path, version, doc) {
    const templateId = element.getAttribute("data-template");
    const where = describeList(element, path);
    let nodes;
    let source;
    if (templateId) {
        const templateElement = doc.getElementById(templateId);
        if (!templateElement) {
            throw new Error(`[Stitch E514] ${where}: data-template="${templateId}" names no element. Add <template id="${templateId}"> with one row element inside.`);
        }
        if (templateElement.tagName !== "TEMPLATE") {
            throw new Error(`[Stitch E515] ${where}: data-template="${templateId}" must name a <template> element, got <${templateElement.tagName.toLowerCase()}>.`);
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
            `[Stitch E512] ${where}: ${source} is empty. ` +
            (templateId
                ? `Put one row element inside <template id="${templateId}">.`
                : `Put one row element inside the list element, e.g. <li data-text="name"></li>, or point data-template at a <template>.`)
        );
    }
    if (roots.length > 1) {
        const kind = roots.every(node => node.nodeType === 1) ? "root elements" : "root nodes";
        throw new Error(
            `[Stitch E511] ${where}: ${source} has ${roots.length} ${kind} (${roots.map(describeNode).join(", ")}), ` +
            `but a row must be exactly one element. Wrap them in one element, e.g. <div>...</div>.`
        );
    }
    if (roots[0].nodeType !== 1) {
        throw new Error(
            `[Stitch E513] ${where}: ${source} is ${describeNode(roots[0])}, but a row must be one element. ` +
            `Wrap it in an element, e.g. <span data-text="$data"></span>.`
        );
    }

    // A detached copy: the list element's own children are left in place here (bindForeach
    // takes them out, and puts them back if the first render throws).
    return templateId ? doc.importNode(roots[0], true) : roots[0].cloneNode(true);
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
 * @param {Function} deps.pathReader - (element, attribute, path) => strict reader (binding-paths.js)
 * @param {Function} deps.getValueValidator
 * @param {Function} deps.createItemContext
 * @param {Function} deps.resolveRowKeys
 * @param {Function} deps.runAllThenThrow
 * @param {Function} deps.reportError
 * @param {string} deps.version
 * @param {Document} [deps.doc]
 * @returns {Function} the list's effect
 */
function bindForeach(element, viewModel, path, context, deps) {
    const version = deps.version;
    const doc = deps.doc || element.ownerDocument;
    const binder = context.binder;
    const reactiveSystem = context.reactiveSystem;

    // Strict reads (D25): the binder checked the path at bind(); a later change that
    // makes it missing throws inside the re-render, so it goes to Stitch.onError.
    const readList = deps.pathReader(element, "data-foreach", path);

    const list = {
        name: path,
        keyField: readKeyField(element, path, version),
        tagName: element.tagName
    };
    const rowTemplate = readRowTemplate(element, path, version, doc);

    // B3: check the row template now, even if the list is empty: syntax, placement and
    // $root. names (binder._checkTemplate), and the one-root rule of every nested list
    // (data-template ones followed once each, so a recursive tree template terminates).
    // A row's own property names can only be checked when a row is rendered.
    const seenTemplates = new Set(element.getAttribute("data-template") ? [element.getAttribute("data-template")] : []);
    (function checkTemplate(template) {
        binder._checkTemplate(template, viewModel);
        const lists = (template.hasAttribute("data-foreach") ? [template] : [])
            .concat(Array.from(template.querySelectorAll("[data-foreach]")));
        for (const nested of lists) {
            const nestedTemplate = readRowTemplate(nested, nested.getAttribute("data-foreach"), version, doc);
            const nestedId = nested.getAttribute("data-template");
            if (nestedId && !seenTemplates.has(nestedId)) {
                seenTemplates.add(nestedId);
                checkTemplate(nestedTemplate);
            }
        }
    })(rowTemplate);

    // The list element's original children (inline template, whitespace). They were never
    // bound (foreach is a binding boundary), so they are simply taken out; if the first
    // render throws they are put back, so the element can be bound again once fixed.
    const originalChildren = Array.from(element.childNodes);
    originalChildren.forEach(node => element.removeChild(node));

    const isSelect = element.tagName === "SELECT";
    const valuePath = isSelect && element.hasAttribute("data-value") ? element.getAttribute("data-value").trim() : null;
    const readValue = valuePath ? deps.pathReader(element, "data-value", valuePath) : null;
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
            releaseAfterFailure(el);
            throw error;
        }
        return row;
    }

    // Releases rows built by a render that is failing. The render's own error is the one
    // thrown; a cleanup error on the way is reported separately, not lost.
    function releaseAfterFailure(el) {
        try {
            binder._unbindTree(el);
        } catch (cleanupError) {
            deps.reportError(cleanupError, { source: "unbind", element: el });
        }
    }

    function releaseRow(row) {
        try {
            binder._unbindTree(row.el);
        } finally {
            // Even if a cleanup threw, the row leaves the list.
            if (row.el.parentNode === element) {
                element.removeChild(row.el);
            }
        }
    }

    function readItems() {
        const value = readList(viewModel);
        if (value === undefined || value === null) {
            return [];
        }
        if (!Array.isArray(value)) {
            throw new TypeError(
                `[Stitch E521] ${describeList(element, path)}: "${path}" must be an array (or null/undefined for no rows), ` +
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
            created.forEach(row => releaseAfterFailure(row.el));
            throw error;
        }

        // 3. Release every old row that is not reused (key gone, or a new object). A cleanup
        //    that throws does not stop the render; its error is thrown once the list is done.
        const releases = [];
        rows.forEach((row, key) => {
            if (next.get(key) !== row) {
                releases.push(() => releaseRow(row));
            }
        });
        let releaseError = null;
        try {
            deps.runAllThenThrow(releases, { source: "binding", element, binding: `data-foreach="${path}"` });
        } catch (error) {
            releaseError = { error };
        }

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
        if (releaseError) {
            throw releaseError.error;
        }
    }

    function restoreSelectValue() {
        if (valuePath) {
            const currentValue = readValue(viewModel);
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

    let effect;
    try {
        effect = reactiveSystem.effect(() => {
            reconcile(readItems());
            if (isSelect) {
                restoreSelectValue();
            }
        }, { batch: true, errorContext: { source: "binding", element, binding: `data-foreach="${path}"` } });
    } catch (error) {
        // The first render threw (effect() has released the effect, and reconcile has
        // released any rows it built): restore the element as it was before bind().
        while (element.firstChild) {
            element.removeChild(element.firstChild);
        }
        originalChildren.forEach(node => element.appendChild(node));
        throw error;
    }

    binder._trackCleanup(element, () => {
        reactiveSystem.cleanup(effect);
        const released = rows;
        rows = new Map();
        deps.runAllThenThrow(Array.from(released.values(), row => () => binder._unbindTree(row.el)),
            { source: "unbind", element });
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
  __stitchModuleFactories[9] = function(module, exports, __stitchRequire){
"use strict";

const { VERSION } = __stitchRequire(25);
const { MessageBus } = __stitchRequire(12);
const { BatchScheduler } = __stitchRequire(10);
const { ComputedRef } = __stitchRequire(11);
const { ReactiveSystem } = __stitchRequire(13);

module.exports = {
    MessageBus,
    version: VERSION,
    CoreMessageBus: MessageBus,
    BatchScheduler,
    ComputedRef,
    ReactiveSystem
};

  };
  __stitchModuleFactories[10] = function(module, exports, __stitchRequire){
"use strict";

const { VERSION } = __stitchRequire(25);
const { reportError } = __stitchRequire(16);

/** Runs a queued effect; an error goes to Stitch.onError (a flush is on no caller's stack). */
function runReportingErrors(effect) {
    try {
        effect();
    } catch (error) {
        reportError(error, effect.options && effect.options.errorContext
            ? effect.options.errorContext
            : { source: "effect" });
    }
}

class BatchScheduler {
    constructor(options = {}) {
        this.version = options.version || `v${VERSION}`;
        this._runEffect = options.runEffect || runReportingErrors;
        this._pendingEffects = new Set();
        this.flushing = false;
        this.flushScheduled = false;
        this.flushDepth = 0;
        this.MAX_FLUSH_DEPTH = 100;
    }

    queue(effect) {
        if (typeof effect !== "function") {
            throw new TypeError(
                `[Stitch E992] queue() expects a function, got ${typeof effect}`
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
            const dropped = this._pendingEffects.size;
            this._pendingEffects.clear();
            this.flushDepth = 0;
            this.flushScheduled = false;
            reportError(new Error(
                `[Stitch E911] Stopped an infinite loop of updates: effects kept re-queuing each other ` +
                `for ${this.MAX_FLUSH_DEPTH} rounds (${dropped} still queued were dropped). An effect, computed or ` +
                "binding probably writes a value that it, or something it triggers, reads. Move the write out of " +
                "the effect, or guard it so the value stops changing."
            ), { source: "scheduler" });
            return;
        }

        this.flushing = true;
        this.flushScheduled = false;
        this.flushDepth++;

        const effectsToRun = Array.from(this._pendingEffects);
        this._pendingEffects.clear();

        effectsToRun.forEach((effect) => {
            this._runEffect(effect);
        });

        this.flushing = false;
        if (this._pendingEffects.size > 0) {
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
  __stitchModuleFactories[11] = function(module, exports, __stitchRequire){
"use strict";

// The dependency key under which readers of a computed subscribe to it. Readers live in
// the system's dependency map like any other subscription, so releasing a reader
// (ReactiveSystem.cleanup) removes it from every computed it read.
const COMPUTED_VALUE_KEY = "value";

// Ids are labels only: a counter (a label needs no randomness).
let nextComputedId = 0;

class ComputedRef {
    constructor(getter, reactiveSystem, context, explicitDeps = null) {
        this.getter = getter;
        this.reactiveSystem = reactiveSystem;
        this.context = context;
        this.explicitDeps = explicitDeps;
        this.value = undefined;
        this.dirty = true;
        // True after an evaluation threw (the computed stays dirty, see markDirty).
        this.failed = false;
        this.deps = new Set();
        this._generation = reactiveSystem._generation;
        this.id = ++nextComputedId;
        this.isComputedRef = true;

    }

    markDirty() {
        // Already dirty: readers were told. Except after a failed evaluation: then the
        // readers that saw the error must hear about the change that may fix it.
        if (this.dirty && !this.failed) {
            return;
        }
        this.failed = false;

        this.dirty = true;

        // Notify readers (effects and computeds) through the system's dependency map.
        this.reactiveSystem.trigger(this, COMPUTED_VALUE_KEY);

        // Read only imperatively (no reader subscribed): stop listening until the next read.
        if (!this.hasReaders()) {
            this.release();
        }
    }

    /** True while an effect or another computed is subscribed to this computed. */
    hasReaders() {
        const deps = this.reactiveSystem.depsMap.get(this);
        const readers = deps && deps.get(COMPUTED_VALUE_KEY);
        return !!readers && readers.size > 0;
    }

    /**
     * Stops listening to every source; the next read recomputes and subscribes again.
     * Releases, in turn, computeds that only this one was reading.
     */
    release() {
        this.dirty = true;
        this.reactiveSystem._releaseUnread(this.reactiveSystem._untrack(this));
    }

    evaluate() {
        const unread = this.reactiveSystem._untrack(this);
        this.reactiveSystem.effectStack.push(this);

        try {
            if (this.explicitDeps && this.context) {
                for (const depKey of this.explicitDeps) {
                    void this.context[depKey];
                }
            }

            try {
                // this AND the first argument are the object that holds the computed, so an
                // arrow function can read it too: total: m => m.price * m.qty.
                this.value = this.getter.call(this.context, this.context);
            } catch (error) {
                this.failed = true;
                throw error;
            }
            this.dirty = false;
            this.failed = false;


            return this.value;
        } finally {
            this.reactiveSystem.effectStack.pop();
            this.reactiveSystem._releaseUnread(unread);
        }
    }

    get() {
        this.reactiveSystem.track(this, COMPUTED_VALUE_KEY);

        // A disposed system no longer invalidates computeds, so never serve a cached value.
        if (this.dirty || this.reactiveSystem.disposed) {
            return this.evaluate();
        }

        return this.value;
    }

    cleanup() {
        this.release();
    }
}

module.exports = {
    ComputedRef,
    COMPUTED_VALUE_KEY
};

  };
  __stitchModuleFactories[12] = function(module, exports, __stitchRequire){
"use strict";

const { VERSION } = __stitchRequire(25);
const { reportError } = __stitchRequire(16);

function checkEvent(version, method, event) {
    if (typeof event !== "string" || event === "") {
        throw new TypeError(`[Stitch E851] MessageBus.${method}(event, ...): the event name must be a non-empty string, got ${event === "" ? "an empty string" : typeof event}.`);
    }
}

function checkCallback(version, method, callback) {
    if (typeof callback !== "function") {
        throw new TypeError(`[Stitch E852] MessageBus.${method}(event, callback): callback must be a function, got ${callback === null ? "null" : typeof callback}.`);
    }
}

class MessageBus {
    constructor(options = {}) {
        this.version = options.version || `v${VERSION}`;
        this.subscribers = new Map();
        this.queue = [];
        this.isFlushing = false;
        this.middleware = [];
        this.flushDepth = 0;
        this.MAX_FLUSH_DEPTH = 100;
    }

    /**
     * Subscribes callback to event ("*" receives every event). Returns a function that
     * unsubscribes it (safe to call more than once).
     */
    subscribe(event, callback) {
        checkEvent(this.version, "subscribe", event);
        checkCallback(this.version, "subscribe", callback);
        if (!this.subscribers.has(event)) {
            this.subscribers.set(event, new Set());
        }
        this.subscribers.get(event).add(callback);
        return () => this._remove(event, callback);
    }

    /** Unsubscribes callback from event; a callback that is not subscribed throws. */
    unsubscribe(event, callback) {
        checkEvent(this.version, "unsubscribe", event);
        checkCallback(this.version, "unsubscribe", callback);
        if (!this._remove(event, callback)) {
            throw new Error(
                `[Stitch E853] MessageBus.unsubscribe("${event}", callback): that callback is not subscribed to "${event}". ` +
                "Pass the same function that was subscribed (or call the function subscribe() returned)."
            );
        }
    }

    /** @private */
    _remove(event, callback) {
        const subscribers = this.subscribers.get(event);
        return !!subscribers && subscribers.delete(callback);
    }

    publish(event, payload) {
        checkEvent(this.version, "publish", event);
        this.queue.push({
            event,
            payload,
            timestamp: Date.now()
        });
        if (!this.isFlushing) {
            Promise.resolve().then(() => this.flush());
        }
    }

    publishSync(event, payload) {
        checkEvent(this.version, "publishSync", event);
        this._executeEvent({
            event,
            payload,
            timestamp: Date.now()
        });
    }

    flush() {
        if (this.isFlushing || this.queue.length === 0) return;
        if (this.flushDepth >= this.MAX_FLUSH_DEPTH) {
            const dropped = this.queue.map((e) => e.event);
            this.flushDepth = 0;
            this.queue = [];
            reportError(new Error(
                `[Stitch E855] MessageBus stopped an infinite loop: events kept publishing each other for ` +
                `${this.MAX_FLUSH_DEPTH} rounds; the queued events were dropped (${dropped.join(", ")}). ` +
                "A subscriber probably publishes an event that leads back to itself."
            ), { source: "messageBus", event: dropped[0] });
            return;
        }

        this.isFlushing = true;
        this.flushDepth++;
        const eventsToProcess = [...this.queue];
        this.queue = [];

        eventsToProcess.forEach((eventData) => {
            this._executeEvent(eventData);
        });

        this.isFlushing = false;
        if (this.queue.length > 0) {
            Promise.resolve().then(() => this.flush());
        } else {
            this.flushDepth = 0;
        }
    }

    _executeEvent(eventData) {
        let processedData = eventData;
        for (const middlewareFn of this.middleware) {
            try {
                processedData = middlewareFn(processedData) || processedData;
            } catch (error) {
                // A failing middleware drops this one event; the bus keeps working.
                reportError(error, { source: "messageBus", event: eventData.event, middleware: true });
                return;
            }
        }

        const event = processedData.event;
        const payload = processedData.payload;
        const subscribers = this.subscribers.get(event);


        if (subscribers) {
            subscribers.forEach((callback) => {
                try {
                    callback(payload);
                } catch (error) {
                    // A subscriber error must not stop delivery to the other subscribers.
                    reportError(error, { source: "messageBus", event });
                }
            });
        }

        const wildcardSubscribers = this.subscribers.get("*");
        if (wildcardSubscribers) {
            wildcardSubscribers.forEach((callback) => {
                try {
                    callback({ event, payload });
                } catch (error) {
                    reportError(error, { source: "messageBus", event, wildcard: true });
                }
            });
        }
    }

    use(middlewareFn) {
        if (typeof middlewareFn !== "function") {
            throw new TypeError(`[Stitch E854] MessageBus.use(middleware): middleware must be a function, got ${typeof middlewareFn}.`);
        }
        this.middleware.push(middlewareFn);
    }

    clear() {
        this.queue = [];
    }
}

module.exports = {
    MessageBus
};

  };
  __stitchModuleFactories[13] = function(module, exports, __stitchRequire){
"use strict";

const { MessageBus } = __stitchRequire(12);
const { BatchScheduler } = __stitchRequire(10);
const { VERSION } = __stitchRequire(25);
const { REACTIVE_TOTALS } = __stitchRequire(21);
const { reportError } = __stitchRequire(16);

// Effect ids: a counter (an id is only a label; it needs no randomness).
let nextEffectId = 0;

/**
 * Calls every change handler of target (model.on()). A handler that throws goes to
 * Stitch.onError; it does not stop the other handlers or the write that caused the change.
 */
function notifyChangeHandlers(target, change) {
    const handlers = target && target._changeHandlers;
    if (!handlers || handlers.size === 0) {
        return;
    }
    Array.from(handlers).forEach((handler) => {
        try {
            handler(change);
        } catch (error) {
            reportError(error, { source: "change-handler", field: change.field, target });
        }
    });
}

class ReactiveSystem {
    constructor(bubbleChangeUp = null, options = {}) {
        this.version = options.version || `v${VERSION}`;
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
            runEffect: (effect) => this._rerun(effect)
        });
        this.messageBus = new MessageBusCtor({
            version: this.version
        });
        this.bubbleChangeUp = bubbleChangeUp;

        this.messageBus.subscribe("nested-change", (payload) => {
            const parent = payload.parent;
            const fullPath = payload.fullPath;
            const oldValue = payload.oldValue;
            const newValue = payload.newValue;
            notifyChangeHandlers(parent, {
                field: fullPath,
                oldValue,
                newValue,
                target: parent,
                nestedChange: true
            });
        });

        this.messageBus.subscribe("array-mutation", (payload) => {
            const target = payload.target;
            const method = payload.method;
            const args = payload.args;
            const oldLength = payload.oldLength;
            const newLength = payload.newLength;

            notifyChangeHandlers(target, {
                field: "items",
                action: method,
                args,
                target
            });

            if (this.bubbleChangeUp) {
                this.bubbleChangeUp(target, "items", oldLength, newLength);
            }
        });
    }

    get currentEffect() {
        return this.effectStack[this.effectStack.length - 1] || null;
    }

    track(target, key) {
        const currentEffect = this.currentEffect;

        if (!currentEffect || this.disposed) {
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
            if (target && target.isComputedRef) {
                // The readers of a computed: when the last one leaves, the computed is released.
                dep.computed = target;
            }
            deps.set(key, dep);
        }

        if (!dep.has(currentEffect)) {
            dep.add(currentEffect);
            currentEffect.deps.add(dep);
            this._countSubscriptions(1);
        }

    }

    trigger(target, key, oldValue, newValue) {
        const deps = this.depsMap.get(target);
        const dep = deps?.get(key);

        if (dep && dep.size > 0) {

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
                    this._rerun(dependent);
                }
            });
        }

        // Change handlers (model.$onChange(handler)) fire for every write, whether or not anything
        // reactive reads the property.
        notifyChangeHandlers(target, {
            field: key,
            oldValue,
            newValue,
            target
        });
    }

    /**
     * Re-runs an effect because something it read changed. This is never on the stack of
     * the code that created the effect, so an error goes to Stitch.onError (or is re-thrown
     * uncaught) instead of breaking the write that triggered it.
     * @private
     */
    _rerun(effect) {
        try {
            effect();
        } catch (error) {
            reportError(error, effect.options && effect.options.errorContext
                ? effect.options.errorContext
                : { source: "effect" });
        }
    }

    /**
     * Creates an effect: runs fn now (unless options.lazy) and again whenever a
     * reactive value it read changes. Release it with cleanup(effect).
     * If the first run throws, the effect is released and the error is rethrown.
     */
    effect(fn, options = {}) {
        if (this.disposed) {
            throw new Error(`[Stitch E991] effect(): this ReactiveSystem was disposed; create a new model to bind again.`);
        }
        const effectId = ++nextEffectId;

        const effect = () => {
            if (effect.disposed || this.disposed) {
                return undefined;
            }
            const unread = this._untrack(effect);
            this.effectStack.push(effect);


            try {
                return fn();
            } finally {
                this.effectStack.pop();
                // Only computeds the re-run did not read again are released.
                this._releaseUnread(unread);
            }
        };

        effect.deps = new Set();
        effect.options = options;
        effect.id = effectId;
        effect.disposed = false;
        effect._generation = this._generation;
        this._countEffects(1);


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
        this._releaseUnread(this._untrack(effect));
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
     * Returns the reader sets of computeds this subscriber was the last reader of
     * (or null); pass them to _releaseUnread once the subscriber has re-read what it needs.
     * @private
     */
    _untrack(subscriber) {
        const live = subscriber._generation === this._generation;
        let removed = 0;
        let unread = null;
        subscriber.deps.forEach((dep) => {
            if (dep.delete(subscriber)) {
                removed++;
                if (dep.computed && dep.size === 0) {
                    (unread || (unread = [])).push(dep);
                }
            }
        });
        subscriber.deps.clear();
        if (live && removed > 0) {
            this._countSubscriptions(-removed);
        }
        return unread;
    }

    /**
     * A computed that nobody reads any more stops listening to its sources (and so
     * stops being reachable from them); it recomputes on its next read. Without this a
     * computed on a removed list row, reading a long-lived property, stayed subscribed
     * to it, and kept the row alive, for the life of the page.
     * @private
     */
    _releaseUnread(readerSets) {
        if (!readerSets) {
            return;
        }
        for (const readers of readerSets) {
            if (readers.size === 0) {
                readers.computed.release();
            }
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
  __stitchModuleFactories[14] = function(module, exports, __stitchRequire){
"use strict";

const { VERSION } = __stitchRequire(25);
const helpers = __stitchRequire(22);
const attrValueHandlers = __stitchRequire(15);
const valueBindingHelpers = __stitchRequire(24);
const typeConverters = __stitchRequire(23);
const foreachKeys = __stitchRequire(17);
const foreachRowContext = __stitchRequire(18);
const reactiveObjectHelpers = __stitchRequire(20);
const { readReactiveStats } = __stitchRequire(21);
const errorHook = __stitchRequire(16);

/**
 * Stitch.debug: read-only diagnostics. There is no debug mode to switch on or off (D26):
 * mistakes throw (or go to Stitch.onError), and Stitch.onBindReport lists what bind() did.
 */
const debug = Object.freeze({
    /**
     * Live reactive-graph counts across the page, read-only: { effects, subscriptions }.
     */
    stats() {
        return readReactiveStats();
    }
});

module.exports = {
    debug,
    onError: errorHook.onError,
    version: VERSION,
    ...helpers,
    ...attrValueHandlers,
    ...valueBindingHelpers,
    ...typeConverters,
    ...foreachKeys,
    ...foreachRowContext,
    ...reactiveObjectHelpers
};

  };
  __stitchModuleFactories[15] = function(module, exports, __stitchRequire){
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
  __stitchModuleFactories[16] = function(module, exports, __stitchRequire){
"use strict";

const { createHookSlot } = __stitchRequire(19);

/**
 * Where errors raised inside reactive updates go (D23).
 *
 * An effect re-run, a list re-render, a change handler or a MessageBus subscriber runs
 * outside the caller's stack, so its error cannot be thrown to anyone. It is passed to
 * the handler installed with Stitch.onError(fn) as fn(error, context). With no handler
 * it is re-thrown uncaught on a fresh task, so it reaches window.onerror and the console
 * like any other uncaught error. A handler that throws has its own error re-thrown the
 * same way. Errors on the synchronous bind() stack are thrown to the caller instead.
 */
const slot = createHookSlot("Stitch.onError");

/**
 * Installs the one page-wide handler for errors raised inside reactive updates and
 * returns a function that removes it; null removes the installed one. Installing while
 * another handler is installed throws.
 * @param {Function|null} fn - called as fn(error, context)
 * @returns {Function} remove
 */
function onError(fn) {
    return slot.install(fn);
}

/** True while a Stitch.onError handler is installed. */
function hasErrorHandler() {
    return slot.get() !== null;
}

function rethrowUncaught(error) {
    setTimeout(() => {
        throw error;
    }, 0);
}

/**
 * Hands an error raised inside a reactive update to Stitch.onError, or re-throws it
 * uncaught when no handler is installed.
 * @param {*} error
 * @param {Object} [context] - what was running: { source, element?, binding?, event?, field? }
 */
function reportError(error, context) {
    const handler = slot.get();
    if (!handler) {
        rethrowUncaught(error);
        return;
    }
    try {
        handler(error, context || { source: "unknown" });
    } catch (handlerError) {
        rethrowUncaught(handlerError);
    }
}

/**
 * Runs every function, even when one throws, then throws the first error (if any).
 * Any further errors go to reportError, so none is lost.
 * Used where several independent cleanups must all run.
 * @param {Iterable<Function>} fns
 * @param {Object} [context] - passed to reportError for the second and later errors
 */
function runAllThenThrow(fns, context) {
    let first = null;
    for (const fn of fns) {
        try {
            fn();
        } catch (error) {
            if (first === null) {
                first = { error };
            } else {
                reportError(error, context);
            }
        }
    }
    if (first !== null) {
        throw first.error;
    }
}

module.exports = {
    onError,
    hasErrorHandler,
    reportError,
    runAllThenThrow
};

  };
  __stitchModuleFactories[17] = function(module, exports, __stitchRequire){
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
        `[Stitch E501] ${where}: row ${index} has no "${field}" (${which}). ` +
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
                `[Stitch E503] ${describeList(list)}: row ${index} is ${row}. ` +
                `A list row must be an object with a key, or a plain value (string, number, boolean). ` +
                `Remove the empty row from the list.`
            );
        } else if (list.keyField) {
            throw new Error(
                `[Stitch E504] ${describeList(list)}: row ${index} is a plain ${typeof row} (${formatKey(row)}), ` +
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
                `[Stitch E502] ${describeList(list)}: rows ${first} and ${index} have ${what}. ` +
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
  __stitchModuleFactories[18] = function(module, exports, __stitchRequire){
"use strict";

// Every row context created by createItemContext (so a scope can be told from a model).
const ROW_CONTEXTS = new WeakSet();

/** True when scope is a foreach row context (not a model). */
function isRowContext(scope) {
    return scope !== null && typeof scope === "object" && ROW_CONTEXTS.has(scope);
}

/**
 * Creates the binding context of one foreach row: the row's own fields (through the
 * prototype chain, so two-way bindings write to the row object), plus $data (the row
 * itself), $index, $parent (the list's view model: the model, or the enclosing row's
 * context) and $root (the model the outermost list belongs to).
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
    Object.defineProperty(context, "$root", {
        value: isRowContext(viewModel) ? viewModel.$root : viewModel,
        writable: false,
        enumerable: false
    });
    ROW_CONTEXTS.add(context);
    return context;
}

module.exports = {
    createItemContext,
    isRowContext
};

  };
  __stitchModuleFactories[19] = function(module, exports, __stitchRequire){
"use strict";


/**
 * A page-wide slot for one handler (Stitch.onError, Stitch.onBindReport).
 * install(fn) puts fn in the slot and returns a function that removes it. Installing while
 * another handler is in the slot throws: replacing it silently would re-route the first
 * handler's calls to the second without anyone knowing. install(null) empties the slot.
 */
function createHookSlot(apiName) {
    let current = null;
    function install(fn) {
        if (fn === null) {
            current = null;
            return () => {};
        }
        if (typeof fn !== "function") {
            throw new TypeError(`[Stitch E901] ${apiName}(fn): fn must be a function (or null to remove the handler), got ${typeof fn}.`);
        }
        if (current !== null && current !== fn) {
            throw new Error(
                `[Stitch E902] ${apiName}(fn): a handler is already installed. Remove it first with ` +
                `${apiName}(null) or the function the first ${apiName}() call returned, then install the new one.`
            );
        }
        current = fn;
        return function remove() {
            if (current === fn) {
                current = null;
            }
        };
    }
    return {
        install,
        get() {
            return current;
        }
    };
}

module.exports = {
    createHookSlot
};

  };
  __stitchModuleFactories[20] = function(module, exports, __stitchRequire){
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
    if (typeof handler !== "function") {
        throw new TypeError(`[Stitch E805] $onChange(handler): handler must be a function, got ${handler === null ? "null" : typeof handler}.`);
    }
    const handlers = this._changeHandlers;
    handlers.add(handler);
    // The remover, like the one $on returns (safe to call twice).
    return function remove() {
        handlers.delete(handler);
    };
}

/**
 * off(handler) removes one change handler; a handler that is not installed (or a value
 * that is not a function, e.g. an undefined variable) throws. off() with no argument at
 * all removes every handler.
 */
function removeChangeHandler(handler) {
    if (arguments.length !== 1) {
        throw new TypeError(
            `[Stitch E807] $offChange(handler) needs the handler to remove (exactly one argument, got ${arguments.length}). ` +
            "Removing is explicit: call it once per handler given to $onChange()."
        );
    }
    if (typeof handler !== "function") {
        throw new TypeError(
            `[Stitch E808] $offChange(handler): handler is ${handler === null ? "null" : typeof handler}, not a function. ` +
            "Pass the handler given to $onChange()."
        );
    }
    if (!this._changeHandlers.delete(handler)) {
        throw new Error(`[Stitch E809] $offChange(handler): that function is not a change handler of this object. Pass the function given to $onChange().`);
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
  __stitchModuleFactories[21] = function(module, exports, __stitchRequire){
"use strict";

/**
 * Live counts of the reactive graph, summed over every ReactiveSystem in the page.
 * Read-only from outside: Stitch.debug.stats() returns a copy.
 *
 * - effects: effects created and not yet disposed (one per live effect-backed binding,
 *   plus any $watch or custom-binding effect).
 * - subscriptions: subscriber edges that a change can reach: an effect or computed
 *   subscribed to a reactive property, or an effect / computed subscribed to a computed.
 * - parentLinks: links from model objects to the places that hold them (B9: they must
 *   not outlive those places; on a live model, a count that only grows is a leak). Objects
 *   collected while still inside a discarded model are not subtracted.
 */
const REACTIVE_TOTALS = {
    effects: 0,
    subscriptions: 0,
    parentLinks: 0
};

function readReactiveStats() {
    return {
        effects: REACTIVE_TOTALS.effects,
        subscriptions: REACTIVE_TOTALS.subscriptions,
        parentLinks: REACTIVE_TOTALS.parentLinks
    };
}

module.exports = {
    REACTIVE_TOTALS,
    readReactiveStats
};

  };
  __stitchModuleFactories[22] = function(module, exports, __stitchRequire){
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
        const next = current[keys[i]];
        if (next === null || next === undefined || typeof next !== "object") {
            // Creating the missing object here would make a non-reactive property: refuse.
            const step = keys.slice(0, i + 1).join(".");
            throw new Error(
                `[Stitch E314] cannot write "${path}": "${step}" is ${next === null ? "null" : next === undefined ? "undefined" : typeof next}. ` +
                `Give "${step}" an object first (e.g. ${step}: { ${keys[i + 1]}: "" }), or hide the input while it is empty (data-visible).`
            );
        }
        current = next;
    }
    current[keys[keys.length - 1]] = value;
}

/**
 * Reads a dot-notation path (model.get(path)). A missing name or a null/undefined step
 * gives undefined. An inline object literal is not a path and throws.
 *
 * @param {Object} target
 * @param {string} path
 * @returns {*}
 */
function getProperty(target, path) {
    if (typeof path !== "string" || path.trim().startsWith("{")) {
        throw new Error(
            `[Stitch E107] "${path}" is not a property path. Use a dot-separated name such as "user.name"; ` +
            "an inline object is not supported."
        );
    }
    const keys = path.split(".");
    let current = target;
    for (let i = 0; i < keys.length; i++) {
        const key = keys[i];
        if (current == null || !(key in Object(current))) {
            return undefined;
        }
        current = current[key];
    }
    return current;
}

/**
 * Throws when a path names a property that does not exist (a null/undefined step is fine),
 * listing what the object on the path does have. Used where a misspelled name would
 * otherwise do nothing, silently ($watch).
 *
 * @param {Object} target
 * @param {string} path
 * @param {string} where - e.g. '$watch("nmae")'
 */
function assertPathExists(target, path, where) {
    getProperty(undefined, path); // throws first for a value that is not a path at all
    const keys = String(path).split(".");
    let current = target;
    for (let i = 0; i < keys.length; i++) {
        if (current == null) {
            return;
        }
        const own = Object.prototype.hasOwnProperty.call(Object(current), keys[i]) ||
            (keys[i] === "size" && (current instanceof Map || current instanceof Set));
        if (own && current.__isReactive === true && typeof current === "object" && !Array.isArray(current)) {
            const descriptor = Object.getOwnPropertyDescriptor(current, keys[i]);
            if (descriptor && !descriptor.get && descriptor.enumerable) {
                throw new Error(
                    `[Stitch E205] ${where}: "${keys.slice(0, i + 1).join(".")}" is not reactive (${keys[i][0] === "_"
                        ? "names starting with _ are never made reactive" : "it was added after Observable.create()"}), so it could never be followed.`
                );
            }
        }
        if (!own) {
            const owner = i === 0 ? "the model" : `"${keys.slice(0, i).join(".")}"`;
            const names = typeof current === "object" ? Object.keys(current).filter(k => k[0] !== "_").join(", ") : typeof current;
            throw new Error(
                `[Stitch E204] ${where}: "${keys[i]}" is not a property of ${owner} (it has: ${names || "no properties"}). ` +
                "Declare it in Observable.create() with a starting value (a property added later is not reactive), or fix the name."
            );
        }
        current = current[keys[i]];
    }
}

module.exports = {
    isArrowFunction,
    setProperty,
    getProperty,
    assertPathExists
};

  };
  __stitchModuleFactories[23] = function(module, exports, __stitchRequire){
"use strict";

const { VERSION: DEFAULT_VERSION } = __stitchRequire(25);

/**
 * Builds the type converter registry with Stitch-compatible behavior.
 *
 * @param {Object} [options]
 * @param {string} [options.version]
 * @returns {Object}
 */
function createTypeConverters(options = {}) {
    // A typed value that does not convert ("abc" in a data-type="int" input) becomes null:
    // that is user input, handled by the page's validation, not a page mistake to report.

    return {
        int: {
            canHandle(value, element) {
                return element?.getAttribute("data-type") === "int" || element?.type === "number" && value !== null && Number.isInteger(value);
            },
            toModel(value) {
                if (value === "" || value === null || value === undefined) return null;
                const parsed = parseInt(value, 10);
                if (isNaN(parsed)) {
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
  __stitchModuleFactories[24] = function(module, exports, __stitchRequire){
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
  __stitchModuleFactories[25] = function(module, exports, __stitchRequire){
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

/**
 * Stitch.js distribution entry. The version comes from package.json (stamped by the build). Source of truth is package modules under packages/*.
 */
(function () {
    "use strict";

    const api = __stitchRequire(0);
    const browser = __stitchRequire(3);
    const core = __stitchRequire(9);
    const utils = __stitchRequire(14);

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
    // Read-only diagnostics (stats()); there is no debug mode to switch.
    const debug = utils.debug;

    const Stitch = {
        Observable,
        DataBinder,
        MessageBus,
        computed,
        version,
        debug,
        onError: utils.onError,
        onBindReport: browser.onBindReport
    };

    if (typeof window !== "undefined") {
        window.Stitch = Stitch;
    } else if (typeof module !== "undefined" && module.exports) {
        module.exports = Stitch;
    }
})();


})();