"use strict";

const VERSION = "2.1.0";
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
