"use strict";

const VERSION = "2.1.0";
const { MessageBus } = require("./src/message-bus");
const { BatchScheduler } = require("./src/batch-scheduler");
const { ComputedRef } = require("./src/computed-ref");
const { ReactiveSystem } = require("./src/reactive-system");

module.exports = {
    MessageBus,
    version: VERSION,
    CoreMessageBus: MessageBus,
    BatchScheduler,
    ComputedRef,
    ReactiveSystem
};
