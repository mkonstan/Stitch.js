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
