"use strict";

const DEFAULT_VERSION = "2.1.0";

/**
 * Builds the type converter registry with Stitch-compatible behavior.
 *
 * @param {Object} [options]
 * @param {string} [options.version]
 * @returns {Object}
 */
function createTypeConverters(options = {}) {
    const version = options.version || DEFAULT_VERSION;

    return {
        int: {
            canHandle(value, element) {
                return element?.getAttribute("data-type") === "int" || element?.type === "number" && value !== null && Number.isInteger(value);
            },
            toModel(value) {
                if (value === "" || value === null || value === undefined) return null;
                const parsed = parseInt(value, 10);
                if (isNaN(parsed)) {
                    console.warn(`[Stitch.js ${version}] Failed to convert "${value}" to int. Returning null.`);
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
                    console.warn(`[Stitch.js ${version}] Failed to convert "${value}" to float. Returning null.`);
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
                    console.warn(`[Stitch.js ${version}] Failed to convert "${value}" to date. Returning null.`);
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
                    console.warn(`[Stitch.js ${version}] Failed to convert "${value}" to datetime. Returning null.`);
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
