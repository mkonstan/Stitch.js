/**
 * Stitch.js v2.1.0
 * Generated distribution entry. Source of truth is package modules under packages/*.
 */
(function () {
    "use strict";

    const api = require("./packages/api/index.js");
    const browser = require("./packages/browser/index.js");
    const core = require("./packages/core/index.js");
    const utils = require("./packages/utils/index.js");

    if (!api || !browser || !core || !utils) {
        throw new Error("Stitch.js bootstrap failed: one or more package modules could not be resolved.");
    }

    const Observable = api.Observable;
    const computed = api.computed || (Observable && Observable.computed);
    const DataBinder = browser.DataBinder;
    const MessageBus = core.MessageBus;
    const version = api.version || core.version || browser.version || utils.version || "2.1.0";
    const debug = utils.debug || {
        enable() {},
        disable() {},
        enableCategory() {},
        disableCategory() {},
        categories() {}
    };

    const Stitch = {
        Observable,
        DataBinder,
        MessageBus,
        computed,
        version,
        debug
    };

    if (typeof window !== "undefined") {
        window.Stitch = Stitch;
    } else if (typeof module !== "undefined" && module.exports) {
        module.exports = Stitch;
    }
})();
