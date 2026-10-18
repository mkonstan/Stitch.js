"use strict";

const { VERSION } = require("../../utils/src/version");
const { runAllThenThrow, reportError } = require("../../utils/src/error-hook");
const paths = require("./binding-paths");
const discovery = require("./binding-scan-helpers");
const { createHookSlot } = require("../../utils/src/hook-slot");

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
        if (isList && element.hasAttribute("data-template") && element.firstElementChild) {
            throw new Error(
                `[Stitch.js ${Version}] ${paths.describeBinding(element, "data-template", element.getAttribute("data-template"))}: ` +
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
                `[Stitch.js ${Version}] ${describeElement(element)} has data-foreach="${element.getAttribute("data-foreach")}" ` +
                `and data-text="${element.getAttribute("data-text")}": data-text would replace the list's rows. ` +
                `Put the text on another element (e.g. a heading before the list).`
            );
        }
        for (const binding of bindings) {
            if (CONTENT_REPLACING.indexOf(binding.type) !== -1) {
                const inner = element.querySelector(selector());
                if (inner) {
                    throw new Error(
                        `[Stitch.js ${Version}] ${paths.describeBinding(element, binding.attributeName, binding.path)} contains ` +
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
            const path = paths.checkPathSyntax(element, binding.attributeName, binding.path);
            if (binding.type === "value") {
                const segments = path.split(".");
                // Any read-only context value, at any depth: $parent.$index, $root.$data, ...
                if (ROW_NAMES.indexOf(segments[segments.length - 1]) !== -1 || segments.indexOf("$index") !== -1) {
                    throw new Error(
                        `[Stitch.js ${Version}] ${paths.describeBinding(element, binding.attributeName, binding.path)}: ` +
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
            `[Stitch.js ${Version}] ${describeOurs(element)}${asRoot ? " (a bind() root)" : ""} is already bound by ` +
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
                throw new Error(`[Stitch.js ${Version}] ${method}("${selectorText}"): no element matches that selector.`);
            }
        }
        if (!element || typeof element.querySelectorAll !== "function" || typeof element.matches !== "function") {
            throw new Error(`[Stitch.js ${Version}] ${method}(element): element must be a DOM element or a selector, got ${element === null ? "null" : typeof element}.`);
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
            throw new Error(`[Stitch.js ${Version}] bind(): this DataBinder was disposed. Create a new DataBinder to bind again.`);
        }
        element = this._resolveElement(element, "bind");
        if (!viewModel || !viewModel._factory || !viewModel._factory.reactiveSystem) {
            throw new Error(`[Stitch.js ${Version}] bind(element, model): model must be created with Stitch.Observable.create().`);
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
                viewModel.$on(onChangeHandler);
                this._trackCleanup(element, () => viewModel.$off(onChangeHandler));
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
            throw new TypeError(`[Stitch.js ${Version}] new DataBinder(hooks): hooks must be an object, got ${userHooks === null ? "null" : typeof userHooks}.`);
        }
        for (const name of Object.keys(userHooks)) {
            if (KNOWN_HOOKS.indexOf(name) === -1) {
                throw new Error(`[Stitch.js ${Version}] new DataBinder(hooks): unknown hook "${name}". Known hooks: ${KNOWN_HOOKS.join(", ")}.`);
            }
        }
        for (const name of ["onBind", "onChange"]) {
            if (userHooks[name] !== undefined && userHooks[name] !== null && typeof userHooks[name] !== "function") {
                throw new TypeError(`[Stitch.js ${Version}] new DataBinder(hooks): ${name} must be a function, got ${typeof userHooks[name]}.`);
            }
        }
        if (userHooks.properties !== undefined && (userHooks.properties === null || typeof userHooks.properties !== "object")) {
            throw new TypeError(`[Stitch.js ${Version}] new DataBinder(hooks): properties must be an object of { propertyName: { onBind, onChange } }.`);
        }
        for (const [property, hooks] of Object.entries(userHooks.properties || {})) {
            if (hooks === null || typeof hooks !== "object") {
                throw new TypeError(`[Stitch.js ${Version}] new DataBinder(hooks): properties.${property} must be an object of { onBind, onChange }.`);
            }
            for (const name of Object.keys(hooks)) {
                if (name !== "onBind" && name !== "onChange") {
                    throw new Error(`[Stitch.js ${Version}] new DataBinder(hooks): unknown hook "properties.${property}.${name}". Known: onBind, onChange.`);
                }
                if (typeof hooks[name] !== "function") {
                    throw new TypeError(`[Stitch.js ${Version}] new DataBinder(hooks): properties.${property}.${name} must be a function.`);
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
                throw new Error(`[Stitch.js ${Version}] ${where}: handler "${ref.text}" was not found on ${label}. ` +
                    "If it is a method of each row, use the bare name; if it is on the root model, use $root.name.");
            }
            if (typeof hit.value !== "function") {
                throw new Error(`[Stitch.js ${Version}] ${where}: "${ref.text}" on ${label} is ${hit.value === null ? "null" : typeof hit.value}, not a function.`);
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
                            throw new Error(`[Stitch.js ${Version}] ${where}: handler "${ref.text}" was not found on the root model. ` +
                                "If it is a method of each row, use the bare name; if it is on the enclosing row, use $parent.name.");
                        }
                        if (typeof hit.value !== "function") {
                            throw new Error(`[Stitch.js ${Version}] ${where}: "${ref.text}" on the root model is ` +
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
            path = paths.checkPathSyntax(element, attribute, rawPath);
            value = paths.readPath(viewModel, path, () => paths.describeBinding(element, attribute, path));
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
            throw new Error(`[Stitch.js ${Version}] unbind(): this DataBinder was disposed; everything it bound is already released.`);
        }
        element = this._resolveElement(element, "unbind");
        const roots = Array.from(this._roots).filter(root => root === element || element.contains(root));
        const hasBound = this._elementCleanups.has(element) || this.boundElements.has(element) ||
            Array.from(element.querySelectorAll("*")).some(el => this._elementCleanups.has(el) || this.boundElements.has(el));
        if (!hasBound && roots.length === 0) {
            throw new Error(
                `[Stitch.js ${Version}] unbind(${describeElement(element)}): nothing is bound by this DataBinder in that element. ` +
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
    if (handler.value !== undefined && handler.value !== "path" && handler.value !== "literal") {
        throw new Error(
            `[Stitch.js ${Version}] registerBinding("${name}"): value must be "path" or "literal": "path" (the default) when the ` +
            `attribute names a model property, "literal" when the attribute text is passed as is. Got ${JSON.stringify(handler.value)}.`
        );
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
