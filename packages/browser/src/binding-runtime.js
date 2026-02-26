"use strict";

const { NOOP_DEBUG } = require("../../utils/src/debug-config");

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
