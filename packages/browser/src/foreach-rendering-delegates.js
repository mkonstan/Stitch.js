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
