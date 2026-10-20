"use strict";

const paths = require("./binding-paths");
const { reportError, hasErrorHandler } = require("../../utils/src/error-hook");

function createBindingRuntime(deps = {}) {
    const setProperty = deps.setProperty;
    const getValueHandler = deps.getValueHandler;
    const getValueValidator = deps.getValueValidator;
    const attrWrites = deps.attrWrites;
    const bindForeach = deps.bindForeach;

/**
 * Runs an event handler. An error in it (or in looking it up again) goes to Stitch.onError
 * when a handler is installed, like every other error Stitch catches; with none it stays
 * an ordinary uncaught error of the event listener.
 */
function runHandler(element, type, path, run) {
    const context = { source: "handler", element, binding: `data-${type}="${path}"` };
    let result;
    try {
        result = run();
    } catch (error) {
        if (!hasErrorHandler()) {
            throw error;
        }
        reportError(error, context);
        return;
    }
    // An async handler (or one returning a promise): its rejection goes to Stitch.onError like
    // a synchronous throw. With no handler installed it is re-thrown, so the browser reports
    // an ordinary unhandled rejection. Never swallowed.
    if (result !== null && (typeof result === "object" || typeof result === "function") &&
        typeof result.then === "function") {
        Promise.resolve(result).then(undefined, (error) => {
            if (!hasErrorHandler()) {
                throw error;
            }
            reportError(error, context);
        });
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

/** The coded error for a data-attr entry that could run script (see attrRefusal). */
function attrRefusalError(element, path, attrName, refusal) {
    switch (refusal.kind) {
        case "event-handler":
            return bindingError("E321", element, "attr", path,
                `"${attrName}" is an event-handler attribute, whose value runs as script, so data may not set it. ` +
                "Attach behaviour with data-click or data-event instead.");
        case "sensitive":
            return bindingError("E327", element, "attr", path,
                `"${attrName}" decides what the page or an embedded document may do (or vouches for what it loads), ` +
                "so data may neither set nor remove it. Write it in the markup.");
        case "opener":
            return bindingError("E328", element, "attr", path,
                "rel \"opener\" gives the linked page a reference back to this window, so data may not set it. " +
                "Leave it out (a link opened in a new tab gets noopener by default) or use \"noopener noreferrer\".");
        case "rel-protection":
            return bindingError("E329", element, "attr", path,
                `the markup's rel has ${refusal.missing.join(" and ")}, which data may not drop: a bound rel may only add ` +
                "tokens. Keep them in the value (e.g. \"noopener noreferrer nofollow\"), or leave rel out of the object.");
        case "srcdoc":
            return bindingError("E322", element, "attr", path,
                "srcdoc holds a whole HTML document, scripts included, so data may not set it. " +
                "Point src at a page instead, or show the text with data-text.");
        case "script-url":
            return bindingError("E323", element, "attr", path,
                `"${attrName}" would get a ${refusal.scheme}: URL, which runs script when it is followed, so it is refused. ` +
                "Use an http(s), mailto, tel, #anchor or relative URL.");
        case "data-url":
            return bindingError("E324", element, "attr", path,
                `"${attrName}" would get a data: URL, which can carry a document with scripts. Only data:image/... in an <img> src ` +
                "is allowed; serve anything else from a URL.");
        case "style-string":
        default:
            return bindingError("E325", element, "attr", path,
                "style must be an object of { property: value }, written through the CSSOM, e.g. { style: { color: \"red\" } }; " +
                "a style string is refused (a strict Content-Security-Policy blocks it).");
    }
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
                    return target.fn.call(target.owner, target.item, e);
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
                            return target.fn.call(target.owner, target.item, e);
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
     * Supports strings, numbers, booleans, objects (style, written through the CSSOM),
     * arrays (class), null/undefined/false (removes the attribute). A null / undefined
     * object: no change. Any other value throws.
     *
     * The values come from data, so a write that could run script is refused, with a coded
     * error, before anything is written (attr-value-handlers.js): event-handler names, srcdoc,
     * javascript:/vbscript: URLs, data: URLs (except data:image/ in an <img> src) and style
     * strings.
     *
     * @example
     * // Model: { linkAttrs: { href: url, target: "_blank", 'aria-disabled': false } }
     * // HTML: <a data-attr="linkAttrs">
     */
    attr: {
        bind(element, viewModel, path, context) {
            valueEffect(element, viewModel, "attr", path, context, value => {
                if (typeof value === "object" && value !== null && !Array.isArray(value)) {
                    // Plan and check every entry first: a refused object writes nothing.
                    const writes = Object.keys(value).map(attrName => {
                        const write = attrWrites.planAttrWrite(attrName, value[attrName]);
                        const refusal = attrWrites.attrRefusal(element, write);
                        if (refusal) {
                            throw attrRefusalError(element, path, write.name, refusal);
                        }
                        return write;
                    });
                    writes.forEach(write => attrWrites.applyAttrWrite(element, write));
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
