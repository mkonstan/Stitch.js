"use strict";

const { VERSION } = require("./src/version");
const helpers = require("./src/runtime-helpers");
const attrValueHandlers = require("./src/attr-value-handlers");
const valueBindingHelpers = require("./src/value-binding-helpers");
const typeConverters = require("./src/type-converters");
const foreachKeys = require("./src/foreach-keys");
const foreachRowContext = require("./src/foreach-row-context");
const reactiveObjectHelpers = require("./src/reactive-object-helpers");
const { readReactiveStats } = require("./src/reactive-stats");
const errorHook = require("./src/error-hook");

/**
 * Stitch.debug: read-only diagnostics. There is no debug mode to switch on or off (D26):
 * mistakes throw (or go to Stitch.onError), and Stitch.onBindReport lists what bind() did.
 */
const debug = Object.freeze({
    /**
     * Live reactive-graph counts across the page, read-only: { effects, subscriptions }.
     */
    stats() {
        return readReactiveStats();
    }
});

module.exports = {
    debug,
    onError: errorHook.onError,
    version: VERSION,
    ...helpers,
    ...attrValueHandlers,
    ...valueBindingHelpers,
    ...typeConverters,
    ...foreachKeys,
    ...foreachRowContext,
    ...reactiveObjectHelpers
};
