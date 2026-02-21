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
