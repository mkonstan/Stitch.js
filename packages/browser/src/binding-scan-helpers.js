"use strict";

/**
 * Retrieves a binding handler by type from a handlers registry.
 *
 * @param {string} type
 * @param {Object} handlers
 * @returns {Object|null}
 */
function getBindingHandler(type, handlers) {
    return handlers[type] || null;
}

/**
 * Scans element attributes and returns recognized data-* bindings.
 *
 * @param {HTMLElement} element
 * @param {Object} handlers
 * @returns {Array<{type: string, path: string, attributeName: string}>}
 */
function scanCustomAttributes(element, handlers) {
    const bindings = [];
    for (const attr of element.attributes) {
        if (attr.name.startsWith("data-")) {
            const type = attr.name.substring(5);
            const handler = getBindingHandler(type, handlers);
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

/**
 * Creates bound helper functions for a specific handlers registry.
 *
 * @param {Object} handlers
 * @returns {{getBindingHandler: Function, scanCustomAttributes: Function}}
 */
function createBindingScanner(handlers) {
    return {
        getBindingHandler(type) {
            return getBindingHandler(type, handlers);
        },
        scanCustomAttributes(element) {
            return scanCustomAttributes(element, handlers);
        }
    };
}

module.exports = {
    getBindingHandler,
    scanCustomAttributes,
    createBindingScanner
};
