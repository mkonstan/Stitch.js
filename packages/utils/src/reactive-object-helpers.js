"use strict";

function addChangeHandler(handler) {
    this._changeHandlers.add(handler);
}

function removeChangeHandler(handler) {
    if (handler) {
        this._changeHandlers.delete(handler);
    } else {
        this._changeHandlers.clear();
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
    addChangeHandler,
    removeChangeHandler,
    toJSON
};
