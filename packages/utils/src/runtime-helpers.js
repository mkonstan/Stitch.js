"use strict";

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
 * Safely retrieves property values using dot-notation paths.
 *
 * @param {Object} target
 * @param {string} path
 * @param {Object} [options]
 * @param {string} [options.version='2.1.0']
 * @param {boolean} [options.debugEnabled=false]
 * @returns {*}
 */
function getProperty(target, path, options = {}) {
    const version = options.version || "2.1.0";
    const debugEnabled = !!options.debugEnabled;

    if (path.trim().startsWith("{")) {
        console.error(
            `[Stitch.js ${version}] Invalid binding syntax: "${path}"\n` +
            `\n` +
            `Inline object literals are not supported in bindings.\n` +
            `Use a property path reference instead.`
        );
        return undefined;
    }

    const keys = path.split(".");
    let current = target;
    for (let i = 0; i < keys.length; i++) {
        const key = keys[i];
        if (current == null) {
            if (debugEnabled) {
                const pathSoFar = keys.slice(0, i).join(".");
                console.warn(`[Stitch.js ${version}] Property path "${path}" is null/undefined at "${pathSoFar}"`);
            }
            return undefined;
        }
        if (!(key in current)) {
            if (debugEnabled) {
                const pathSoFar = keys.slice(0, i).join(".");
                console.warn(`[Stitch.js ${version}] Property "${key}" does not exist on object at path "${pathSoFar}". Full path: "${path}"`);
            }
            return undefined;
        }
        current = current[key];
    }
    return current;
}

/**
 * Checks if a property path exists on an object using dot notation.
 *
 * @param {Object} obj
 * @param {string} path
 * @returns {boolean}
 */
function propertyExists(obj, path) {
    if (!obj || !path) return false;
    const keys = path.split(".");
    let current = obj;
    for (const key of keys) {
        if (current == null || !(key in current)) {
            return false;
        }
        current = current[key];
    }
    return true;
}

/**
 * Finds similar top-level property names for typo hints.
 *
 * @param {Object} obj
 * @param {string} targetPath
 * @returns {string|null}
 */
function findSimilarProperty(obj, targetPath) {
    if (!obj || !targetPath) return null;
    const targetKey = targetPath.split(".").pop();
    const available = Object.keys(obj).filter(k => !k.startsWith("_"));
    const similar = available.find(key => {
        const lower1 = key.toLowerCase();
        const lower2 = targetKey.toLowerCase();
        return (lower1.includes(lower2) || lower2.includes(lower1)) && lower1 !== lower2;
    });
    return similar ? `Did you mean "${similar}"?` : null;
}

module.exports = {
    isArrowFunction,
    setProperty,
    getProperty,
    propertyExists,
    findSimilarProperty
};
