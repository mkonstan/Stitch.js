"use strict";

const { VERSION } = require("./version");

/**
 * Detects arrow functions. Mirrors Stitch runtime behavior for reactive function guards.
 *
 * @param {*} fn
 * @returns {boolean}
 */
function isArrowFunction(fn) {
    if (typeof fn !== "function") {
        return false;
    }
    if (fn.prototype !== undefined) {
        return false;
    }
    const fnStr = fn.toString();
    if (fnStr.includes("[native code]")) {
        return false;
    }
    if (fn.name && fn.name.startsWith("bound ")) {
        return false;
    }
    const arrowPattern = /^\s*(\([^)]*\)|[a-zA-Z_$][\w$]*)\s*=>/;
    return arrowPattern.test(fnStr);
}

/**
 * Sets property values using dot-notation paths, creating intermediate objects as needed.
 *
 * @param {Object} target
 * @param {string} path
 * @param {*} value
 */
function setProperty(target, path, value) {
    const keys = path.split(".");
    let current = target;
    for (let i = 0; i < keys.length - 1; i++) {
        if (!current[keys[i]] || typeof current[keys[i]] !== "object") {
            current[keys[i]] = {};
        }
        current = current[keys[i]];
    }
    current[keys[keys.length - 1]] = value;
}

/**
 * Reads a dot-notation path (model.get(path)). A missing name or a null/undefined step
 * gives undefined. An inline object literal is not a path and throws.
 *
 * @param {Object} target
 * @param {string} path
 * @returns {*}
 */
function getProperty(target, path) {
    if (typeof path !== "string" || path.trim().startsWith("{")) {
        throw new Error(
            `[Stitch.js v${VERSION}] "${path}" is not a property path. Use a dot-separated name such as "user.name"; ` +
            "an inline object is not supported."
        );
    }
    const keys = path.split(".");
    let current = target;
    for (let i = 0; i < keys.length; i++) {
        const key = keys[i];
        if (current == null || !(key in Object(current))) {
            return undefined;
        }
        current = current[key];
    }
    return current;
}

/**
 * Throws when a path names a property that does not exist (a null/undefined step is fine),
 * listing what the object on the path does have. Used where a misspelled name would
 * otherwise do nothing, silently ($watch).
 *
 * @param {Object} target
 * @param {string} path
 * @param {string} where - e.g. '$watch("nmae")'
 */
function assertPathExists(target, path, where) {
    const keys = String(path).split(".");
    let current = target;
    for (let i = 0; i < keys.length; i++) {
        if (current == null) {
            return;
        }
        if (!(keys[i] in Object(current))) {
            const owner = i === 0 ? "the model" : `"${keys.slice(0, i).join(".")}"`;
            const names = typeof current === "object" ? Object.keys(current).filter(k => k[0] !== "_").join(", ") : typeof current;
            throw new Error(
                `[Stitch.js v${VERSION}] ${where}: "${keys[i]}" is not a property of ${owner} (it has: ${names || "no properties"}). ` +
                "Declare it in Observable.create() with a starting value (a property added later is not reactive), or fix the name."
            );
        }
        current = current[keys[i]];
    }
}

module.exports = {
    isArrowFunction,
    setProperty,
    getProperty,
    assertPathExists
};
