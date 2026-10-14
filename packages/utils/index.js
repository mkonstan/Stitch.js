"use strict";

const { VERSION } = require("./src/version");
const helpers = require("./src/runtime-helpers");
const debugConfig = require("./src/debug-config");
const attrValueHandlers = require("./src/attr-value-handlers");
const valueBindingHelpers = require("./src/value-binding-helpers");
const typeConverters = require("./src/type-converters");
const foreachKeys = require("./src/foreach-keys");
const foreachRowContext = require("./src/foreach-row-context");
const reactiveObjectHelpers = require("./src/reactive-object-helpers");
const { readReactiveStats } = require("./src/reactive-stats");

const debugState = debugConfig.createDebugState(`v${VERSION}`);
const debug = {
    enable() {
        debugState.enabled = true;
        console.log("[Stitch.js Debug] Enabled");
    },
    disable() {
        debugState.enabled = false;
        console.log("[Stitch.js Debug] Disabled");
    },
    enableCategory(category) {
        if (debugConfig.isKnownDebugCategory(debugState.categories, category)) {
            debugState.categories[category] = true;
            console.log(`[Stitch.js Debug] Enabled category: ${category}`);
        } else {
            console.warn(debugConfig.formatUnknownCategoryWarning(category, debugState.categories));
        }
    },
    disableCategory(category) {
        if (debugConfig.isKnownDebugCategory(debugState.categories, category)) {
            debugState.categories[category] = false;
            console.log(`[Stitch.js Debug] Disabled category: ${category}`);
        } else {
            console.warn(debugConfig.formatUnknownCategoryWarning(category, debugState.categories));
        }
    },
    categories() {
        console.log("[Stitch.js Debug] Available categories:");
        console.table(debugState.categories);
    },
    /**
     * Live reactive-graph counts across the page, read-only: { effects, subscriptions }.
     * Works whether or not debug output is enabled.
     */
    stats() {
        return readReactiveStats();
    }
};

module.exports = {
    debug,
    version: VERSION,
    ...helpers,
    ...debugConfig,
    ...attrValueHandlers,
    ...valueBindingHelpers,
    ...typeConverters,
    ...foreachKeys,
    ...foreachRowContext,
    ...reactiveObjectHelpers
};
