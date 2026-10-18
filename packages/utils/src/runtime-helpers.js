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
        const next = current[keys[i]];
        if (next === null || next === undefined || typeof next !== "object") {
            // Creating the missing object here would make a non-reactive property: refuse.
            const step = keys.slice(0, i + 1).join(".");
            throw new Error(
                `[Stitch.js v${VERSION}] cannot write "${path}": "${step}" is ${next === null ? "null" : next === undefined ? "undefined" : typeof next}. ` +
                `Give "${step}" an object first (e.g. ${step}: { ${keys[i + 1]}: "" }), or hide the input while it is empty (data-visible).`
            );
        }
        current = next;
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
    getProperty(undefined, path); // throws first for a value that is not a path at all
    const keys = String(path).split(".");
    let current = target;
    for (let i = 0; i < keys.length; i++) {
        if (current == null) {
            return;
        }
        const own = Object.prototype.hasOwnProperty.call(Object(current), keys[i]) ||
            (keys[i] === "size" && (current instanceof Map || current instanceof Set));
        if (own && current.__isReactive === true && typeof current === "object" && !Array.isArray(current)) {
            const descriptor = Object.getOwnPropertyDescriptor(current, keys[i]);
            if (descriptor && !descriptor.get && descriptor.enumerable) {
                throw new Error(
                    `[Stitch.js v${VERSION}] ${where}: "${keys.slice(0, i + 1).join(".")}" is not reactive (${keys[i][0] === "_"
                        ? "names starting with _ are never made reactive" : "it was added after Observable.create()"}), so it could never be followed.`
                );
            }
        }
        if (!own) {
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
