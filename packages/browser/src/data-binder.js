"use strict";

const { VERSION } = require("../../utils/src/version");
const { runAllThenThrow, reportError } = require("../../utils/src/error-hook");
const paths = require("./binding-paths");
const discovery = require("./binding-scan-helpers");

// The report function installed with Stitch.onBindReport(fn), or null (the default:
// then bind() never looks at data-* attributes that are not Stitch's).
let bindReporter = null;

/**
 * Installs (or, with null, removes) the page-wide bind report. When installed, every
 * bind() that succeeds calls fn({ bound, ignored }): each data-* attribute in the bound
 * element, as { element, attribute, value }, split into Stitch's own (bound) and the
 * others (ignored, e.g. a misspelled data-txt, data-testid, data-bs-*).
 * @param {Function|null} fn
 */
function onBindReport(fn) {
    if (fn !== null && typeof fn !== "function") {
        throw new TypeError(`[Stitch.js v${VERSION}] Stitch.onBindReport(fn): fn must be a function (or null to remove it), got ${typeof fn}.`);
    }
    bindReporter = fn;
}

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

    /**
     * Stitch's internal attributes configure a list; on any other element they would do
     * nothing, silently, so they throw.
     */
    function checkInternalAttributes(element) {
        const isList = element.hasAttribute("data-foreach");
        for (const attribute of ["data-key", "data-template"]) {
            if (element.hasAttribute(attribute) && !isList) {
                throw new Error(
                    `[Stitch.js ${Version}] ${paths.describeBinding(element, attribute, element.getAttribute(attribute))}: ` +
                    `${attribute} only works on an element with data-foreach (it configures the list's rows). ` +
                    `Add data-foreach to this element, or remove ${attribute}.`
                );
            }
        }
        const hasDefaultText = element.hasAttribute("data-default-text");
        for (const attribute of ["data-default-text", "data-default-value"]) {
            if (element.hasAttribute(attribute) && !(isList && element.tagName === "SELECT")) {
                throw new Error(
                    `[Stitch.js ${Version}] ${paths.describeBinding(element, attribute, element.getAttribute(attribute))}: ` +
                    `${attribute} only works on a <select> with data-foreach (it adds a placeholder option). ` +
                    `Move it to the <select data-foreach>, or remove it.`
                );
            }
        }
        if (element.hasAttribute("data-default-value") && !hasDefaultText) {
            throw new Error(
                `[Stitch.js ${Version}] ${paths.describeBinding(element, "data-default-value", element.getAttribute("data-default-value"))}: ` +
                `data-default-value is the value of the placeholder option, which data-default-text creates. ` +
                `Add data-default-text="Choose..." or remove data-default-value.`
            );
        }
    }

    /** Bindings that cannot work together on one element throw. */
    function checkCombination(element, bindings) {
        const types = bindings.map(binding => binding.type);
        if (types.indexOf("foreach") !== -1 && types.indexOf("text") !== -1) {
            throw new Error(
                `[Stitch.js ${Version}] ${describeElement(element)} has data-foreach="${element.getAttribute("data-foreach")}" ` +
                `and data-text="${element.getAttribute("data-text")}": data-text would replace the list's rows. ` +
                `Put the text on another element (e.g. a heading before the list).`
            );
        }
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
     * Every binding is checked first: valid syntax, a property the model has (or, for
     * data-click, a handler that exists). A mistake throws, naming the element, the binding
     * and the fix, and leaves nothing bound.
     *
     * @param {string|HTMLElement} element - CSS selector or HTMLElement
     * @param {Object} viewModel - Reactive view model (must be from Observable.create())
     * @throws {Error} If viewModel not reactive, element invalid, or a binding is wrong
     * @example
     * const model = Stitch.Observable.create({ count: 0 });
     * binder.bind('#app', model);
     */
    bind(element, viewModel) {
        if (typeof element === "string") {
            const selectorText = element;
            element = document.querySelector(selectorText);
            if (!element) {
                throw new Error(`[Stitch.js ${Version}] bind("${selectorText}"): no element matches that selector.`);
            }
        }
        if (!element || typeof element.querySelectorAll !== "function" || typeof element.matches !== "function") {
            throw new Error(`[Stitch.js ${Version}] bind(element, model): element must be a DOM element or a selector, got ${element === null ? "null" : typeof element}.`);
        }
        if (!viewModel || !viewModel._factory || !viewModel._factory.reactiveSystem) {
            throw new Error(`[Stitch.js ${Version}] bind(element, model): model must be created with Stitch.Observable.create().`);
        }
        bindStarted = true;
        this.reactiveSystem = viewModel._factory.reactiveSystem;

        // Global onChange hook: subscribe once per root bind and route model change events.
        // It runs as a model change handler, so an error in it goes to Stitch.onError.
        if (typeof this.hooks.onChange === "function") {
            const onChangeHandler = change => {
                this.hooks.onChange.call(this, change, viewModel, element);
            };
            viewModel.on(onChangeHandler);
            this._trackCleanup(element, () => viewModel.off(onChangeHandler));
        }

        try {
            this._bindElement(element, viewModel, []);
        } catch (error) {
            // A wrong binding leaves nothing of this bind() behind.
            try {
                this._unbindTree(element);
            } catch (cleanupError) {
                reportError(cleanupError, { source: "unbind", element });
            }
            throw error;
        }

        if (bindReporter) {
            bindReporter(discovery.collectBindReport(element, bindingNames()));
        }
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
     * Binds root and the elements inside it that carry Stitch's attributes, found by
     * selector (D24), in document order. A foreach element is a boundary: its rows are
     * bound by the list itself, so nothing inside it is bound here.
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
        for (const element of targets) {
            // An earlier binding may have replaced this element's ancestor's content
            // (data-text): what is no longer inside root is not bound.
            if (element !== root && !root.contains(element)) {
                continue;
            }
            this._processBindings(element, context, contextPath);
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
    _processBindings(element, context, contextPath) {
        if (this.boundElements.has(element)) {
            return;
        }
        checkInternalAttributes(element);
        const bindings = discovery.readElementBindings(element, bindingNames());
        if (bindings.length === 0) {
            return;
        }
        checkCombination(element, bindings);
        bindings.forEach(binding => {
            this._applyTypedBinding(element, context, binding.type, binding.path, contextPath);
        });
        this.boundElements.add(element);

        // On the bind() stack an error here throws to the caller; for a row rendered
        // later it is part of the list's re-render and goes to Stitch.onError.
        if (typeof this.hooks.onBind === "function") {
            this.hooks.onBind.call(this, element, context, bindings);
        }
    }

    /**
     * Checks one binding (syntax, and that its path exists: D24/D25), then delegates to its
     * handler. Property-specific hooks (onBind) replace the handler.
     * @private
     */
    _applyTypedBinding(element, viewModel, type, rawPath, contextPath = []) {
        const handler = getBindingHandler(type);
        const attribute = `data-${type}`;
        let path;
        let value;
        if (handler.kind === "handler" && BUILT_IN_NAMES.has(type)) {
            // A handler reference: the binding parses and looks it up itself (D12).
            path = String(rawPath).trim();
        } else {
            path = paths.checkPathSyntax(element, attribute, rawPath);
            value = paths.readPath(viewModel, path, () => paths.describeBinding(element, attribute, path));
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
        if (propertyHooks && propertyHooks.onChange) {
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
        this.boundElements.clear();
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
 * - it is registered BEFORE the first bind() on the page: elements bound earlier would
 *   silently miss it.
 * The binding's value is checked like any other: a property path the model has.
 *
 * @static
 * @param {string} name - Binding name (e.g., 'tooltip' for data-tooltip)
 * @param {BindingHandler} handler - Handler object with bind() method
 * @throws {Error} If a rule above is broken
 * @example
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
DataBinder.registerBinding = function (name, handler) {
    if (typeof name !== "string") {
        throw new Error(`[Stitch.js ${Version}] registerBinding: name must be a string`);
    }
    if (!discovery.BINDING_NAME.test(name)) {
        throw new Error(
            `[Stitch.js ${Version}] registerBinding("${name}"): a binding name must be lowercase letters, digits and dashes ` +
            `(e.g. "tooltip" or "date-format"): it becomes the attribute data-${name.toLowerCase()}, and HTML lowercases attribute names.`
        );
    }
    if (discovery.INTERNAL_ATTRIBUTES.indexOf(`data-${name}`) !== -1) {
        throw new Error(`[Stitch.js ${Version}] registerBinding("${name}"): data-${name} is reserved by Stitch (it configures foreach lists). Choose another name.`);
    }
    if (!handler || typeof handler.bind !== "function") {
        throw new Error(`[Stitch.js ${Version}] registerBinding: handler must have a bind() method`);
    }
    if (Object.prototype.hasOwnProperty.call(BINDING_HANDLERS, name)) {
        throw new Error(
            `[Stitch.js ${Version}] registerBinding("${name}"): data-${name} is already registered` +
            `${BUILT_IN_NAMES.has(name) ? " (a built-in binding)" : ""}. Choose another name.`
        );
    }
    if (bindStarted) {
        throw new Error(
            `[Stitch.js ${Version}] registerBinding("${name}") was called after bind(): elements bound before it would ` +
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
