"use strict";

const { NOOP_DEBUG } = require("../../utils/src/debug-config");
const { VERSION } = require("../../utils/src/version");
const { reportError } = require("../../utils/src/error-hook");

class MessageBus {
    constructor(options = {}) {
        this.version = options.version || `v${VERSION}`;
        this.debug = options.debug || NOOP_DEBUG;
        this.subscribers = new Map();
        this.queue = [];
        this.isFlushing = false;
        this.middleware = [];
        this.flushDepth = 0;
        this.MAX_FLUSH_DEPTH = 100;
    }

    subscribe(event, callback) {
        if (!this.subscribers.has(event)) {
            this.subscribers.set(event, new Set());
        }
        this.subscribers.get(event).add(callback);
        this.debug.enabled && this.debug.log("messageBus", `Subscribed to event: "${event}"`, {
            subscriberCount: this.subscribers.get(event).size
        });
        return () => this.unsubscribe(event, callback);
    }

    unsubscribe(event, callback) {
        const subscribers = this.subscribers.get(event);
        if (subscribers) {
            subscribers.delete(callback);
        }
    }

    publish(event, payload) {
        this.queue.push({
            event,
            payload,
            timestamp: Date.now()
        });
        this.debug.enabled && this.debug.log("messageBus", `Published event: "${event}" (queued)`, {
            payload,
            queueLength: this.queue.length
        });
        if (!this.isFlushing) {
            Promise.resolve().then(() => this.flush());
        }
    }

    publishSync(event, payload) {
        this._executeEvent({
            event,
            payload,
            timestamp: Date.now()
        });
    }

    flush() {
        if (this.isFlushing || this.queue.length === 0) return;
        if (this.flushDepth >= this.MAX_FLUSH_DEPTH) {
            const dropped = this.queue.map((e) => e.event);
            this.flushDepth = 0;
            this.queue = [];
            reportError(new Error(
                `[Stitch.js ${this.version}] MessageBus stopped an infinite loop: events kept publishing each other for ` +
                `${this.MAX_FLUSH_DEPTH} rounds; the queued events were dropped (${dropped.join(", ")}). ` +
                "A subscriber probably publishes an event that leads back to itself."
            ), { source: "messageBus", event: dropped[0] });
            return;
        }

        this.isFlushing = true;
        this.flushDepth++;
        const eventsToProcess = [...this.queue];
        this.queue = [];

        this.debug.enabled && this.debug.group("messageBus", `Flushing Message Bus (${eventsToProcess.length} events, depth: ${this.flushDepth})`);
        eventsToProcess.forEach((eventData) => {
            this._executeEvent(eventData);
        });
        this.debug.enabled && this.debug.groupEnd("messageBus");

        this.isFlushing = false;
        if (this.queue.length > 0) {
            this.debug.enabled && this.debug.log(
                "messageBus",
                `New events queued during flush (${this.queue.length}), scheduling next flush (depth: ${this.flushDepth})`
            );
            Promise.resolve().then(() => this.flush());
        } else {
            this.flushDepth = 0;
        }
    }

    _executeEvent(eventData) {
        let processedData = eventData;
        for (const middlewareFn of this.middleware) {
            try {
                processedData = middlewareFn(processedData) || processedData;
            } catch (error) {
                // A failing middleware drops this one event; the bus keeps working.
                reportError(error, { source: "messageBus", event: eventData.event, middleware: true });
                return;
            }
        }

        const event = processedData.event;
        const payload = processedData.payload;
        const subscribers = this.subscribers.get(event);

        this.debug.enabled && this.debug.log("messageBus", `Executing event: "${event}"`, {
            payload,
            subscriberCount: subscribers ? subscribers.size : 0
        });

        if (subscribers) {
            subscribers.forEach((callback) => {
                try {
                    callback(payload);
                } catch (error) {
                    // A subscriber error must not stop delivery to the other subscribers.
                    reportError(error, { source: "messageBus", event });
                }
            });
        }

        const wildcardSubscribers = this.subscribers.get("*");
        if (wildcardSubscribers) {
            wildcardSubscribers.forEach((callback) => {
                try {
                    callback({ event, payload });
                } catch (error) {
                    reportError(error, { source: "messageBus", event, wildcard: true });
                }
            });
        }
    }

    use(middlewareFn) {
        this.middleware.push(middlewareFn);
    }

    clear() {
        this.queue = [];
    }
}

module.exports = {
    MessageBus,
    NOOP_DEBUG
};
