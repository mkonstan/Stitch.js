"use strict";

const { VERSION } = require("../utils/src/version");
const { createReactiveFactory } = require("./src/reactive-factory");
const { Observable, computed } = require("./src/observable");

module.exports = {
    Observable,
    computed,
    version: VERSION,
    createReactiveFactory,
    ExtractedObservable: Observable,
    extractedComputed: computed
};
