"use strict";

function defineHidden(target, name, value) {
    Object.defineProperty(target, name, {
        value: value,
        writable: false,
        enumerable: false,
        configurable: false
    });
}

const { VERSION } = require("./version");

function addChangeHandler(handler) {
    if (typeof handler !== "function") {
        throw new TypeError(`[Stitch.js v${VERSION}] $on(handler): handler must be a function, got ${handler === null ? "null" : typeof handler}.`);
    }
    this._changeHandlers.add(handler);
}

/**
 * off(handler) removes one change handler; a handler that is not installed (or a value
 * that is not a function, e.g. an undefined variable) throws. off() with no argument at
 * all removes every handler.
 */
function removeChangeHandler(handler) {
    if (arguments.length === 0) {
        this._changeHandlers.clear();
        return;
    }
    if (typeof handler !== "function") {
        throw new TypeError(
            `[Stitch.js v${VERSION}] $off(handler): handler is ${handler === null ? "null" : typeof handler}, not a function. ` +
            "Pass the handler given to $on(); to remove every handler, call $off() with no argument."
        );
    }
    if (!this._changeHandlers.delete(handler)) {
        throw new Error(`[Stitch.js v${VERSION}] $off(handler): that function is not a change handler of this object. Pass the function given to $on().`);
    }
}

function toJSON() {
    const result = {};
    for (const [key, value] of Object.entries(this)) {
        if (key.startsWith("_")) continue;
        if (value && typeof value === "object" && value.toJSON) {
            result[key] = value.toJSON();
        } else if (Array.isArray(value)) {
            result[key] = value.map((item) => item && typeof item === "object" && item.toJSON ? item.toJSON() : item);
        } else {
            result[key] = value;
        }
    }
    return result;
}

module.exports = {
    defineHidden,
    addChangeHandler,
    removeChangeHandler,
    toJSON
};
