"use strict";

const { NOOP_DEBUG } = require("../../utils/src/debug-config");

class MessageBus {
    constructor(options = {}) {
        this.version = options.version || "v2.1.0";
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
            console.error(
                `[Stitch.js ${this.version} MessageBus] Maximum flush depth (${this.MAX_FLUSH_DEPTH}) exceeded.\n` +
                "Possible infinite loop detected. Event queue has been cleared."
            );
            this.flushDepth = 0;
            this.queue = [];
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
            if (this.flushDepth > 5) {
                console.warn(`[Stitch.js ${this.version} MessageBus] Flush depth > 5. Queued events:`, this.queue.map((e) => e.event).join(", "));
            }
            Promise.resolve().then(() => this.flush());
        } else {
            this.flushDepth = 0;
        }
    }

    _executeEvent(eventData) {
        let processedData = eventData;
        for (const middlewareFn of this.middleware) {
            processedData = middlewareFn(processedData) || processedData;
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
                    console.error(`[Stitch.js ${this.version} MessageBus] Error in subscriber for event "${event}":`, error);
                }
            });
        }

        const wildcardSubscribers = this.subscribers.get("*");
        if (wildcardSubscribers) {
            wildcardSubscribers.forEach((callback) => {
                try {
                    callback({ event, payload });
                } catch (error) {
                    console.error(`[Stitch.js ${this.version} MessageBus] Error in wildcard subscriber:`, error);
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
