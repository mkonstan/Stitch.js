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
