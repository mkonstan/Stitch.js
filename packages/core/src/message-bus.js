"use strict";

const { VERSION } = require("../../utils/src/version");
const { reportError } = require("../../utils/src/error-hook");

function checkEvent(version, method, event) {
    if (typeof event !== "string" || event === "") {
        throw new TypeError(`[Stitch E851] MessageBus.${method}(event, ...): the event name must be a non-empty string, got ${event === "" ? "an empty string" : typeof event}.`);
    }
}

function checkCallback(version, method, callback) {
    if (typeof callback !== "function") {
        throw new TypeError(`[Stitch E852] MessageBus.${method}(event, callback): callback must be a function, got ${callback === null ? "null" : typeof callback}.`);
    }
}

class MessageBus {
    constructor(options = {}) {
        this.version = options.version || `v${VERSION}`;
        this.subscribers = new Map();
        this.queue = [];
        this.isFlushing = false;
        this.middleware = [];
        this.flushDepth = 0;
        this.MAX_FLUSH_DEPTH = 100;
    }

    /**
     * Subscribes callback to event ("*" receives every event). Returns a function that
     * unsubscribes it (safe to call more than once).
     */
    subscribe(event, callback) {
        checkEvent(this.version, "subscribe", event);
        checkCallback(this.version, "subscribe", callback);
        if (!this.subscribers.has(event)) {
            this.subscribers.set(event, new Set());
        }
        this.subscribers.get(event).add(callback);
        return () => this._remove(event, callback);
    }

    /** Unsubscribes callback from event; a callback that is not subscribed throws. */
    unsubscribe(event, callback) {
        checkEvent(this.version, "unsubscribe", event);
        checkCallback(this.version, "unsubscribe", callback);
        if (!this._remove(event, callback)) {
            throw new Error(
                `[Stitch E853] MessageBus.unsubscribe("${event}", callback): that callback is not subscribed to "${event}". ` +
                "Pass the same function that was subscribed (or call the function subscribe() returned)."
            );
        }
    }

    /** @private */
    _remove(event, callback) {
        const subscribers = this.subscribers.get(event);
        return !!subscribers && subscribers.delete(callback);
    }

    publish(event, payload) {
        checkEvent(this.version, "publish", event);
        this.queue.push({
            event,
            payload,
            timestamp: Date.now()
        });
        if (!this.isFlushing) {
            Promise.resolve().then(() => this.flush());
        }
    }

    publishSync(event, payload) {
        checkEvent(this.version, "publishSync", event);
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
                `[Stitch E855] MessageBus stopped an infinite loop: events kept publishing each other for ` +
                `${this.MAX_FLUSH_DEPTH} rounds; the queued events were dropped (${dropped.join(", ")}). ` +
                "A subscriber probably publishes an event that leads back to itself."
            ), { source: "messageBus", event: dropped[0] });
            return;
        }

        this.isFlushing = true;
        this.flushDepth++;
        const eventsToProcess = [...this.queue];
        this.queue = [];

        eventsToProcess.forEach((eventData) => {
            this._executeEvent(eventData);
        });

        this.isFlushing = false;
        if (this.queue.length > 0) {
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
        if (typeof middlewareFn !== "function") {
            throw new TypeError(`[Stitch E854] MessageBus.use(middleware): middleware must be a function, got ${typeof middlewareFn}.`);
        }
        this.middleware.push(middlewareFn);
    }

    clear() {
        this.queue = [];
    }
}

module.exports = {
    MessageBus
};
