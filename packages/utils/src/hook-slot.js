"use strict";


/**
 * A page-wide slot for one handler (Stitch.onError, Stitch.onBindReport).
 * install(fn) puts fn in the slot and returns a function that removes it. Installing while
 * another handler is in the slot throws: replacing it silently would re-route the first
 * handler's calls to the second without anyone knowing. install(null) empties the slot.
 */
function createHookSlot(apiName) {
    let current = null;
    function install(fn) {
        if (fn === null) {
            current = null;
            return () => {};
        }
        if (typeof fn !== "function") {
            throw new TypeError(`[Stitch E901] ${apiName}(fn): fn must be a function (or null to remove the handler), got ${typeof fn}.`);
        }
        if (current !== null && current !== fn) {
            throw new Error(
                `[Stitch E902] ${apiName}(fn): a handler is already installed. Remove it first with ` +
                `${apiName}(null) or the function the first ${apiName}() call returned, then install the new one.`
            );
        }
        current = fn;
        return function remove() {
            if (current === fn) {
                current = null;
            }
        };
    }
    return {
        install,
        get() {
            return current;
        }
    };
}

module.exports = {
    createHookSlot
};
