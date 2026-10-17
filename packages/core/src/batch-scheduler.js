"use strict";

const { VERSION } = require("../../utils/src/version");
const { reportError } = require("../../utils/src/error-hook");

/** Runs a queued effect; an error goes to Stitch.onError (a flush is on no caller's stack). */
function runReportingErrors(effect) {
    try {
        effect();
    } catch (error) {
        reportError(error, effect.options && effect.options.errorContext
            ? effect.options.errorContext
            : { source: "effect" });
    }
}

class BatchScheduler {
    constructor(options = {}) {
        this.version = options.version || `v${VERSION}`;
        this._runEffect = options.runEffect || runReportingErrors;
        this._pendingEffects = new Set();
        this.flushing = false;
        this.flushScheduled = false;
        this.flushDepth = 0;
        this.MAX_FLUSH_DEPTH = 100;
    }

    queue(effect) {
        if (typeof effect !== "function") {
            throw new TypeError(
                `[Stitch.js ${this.version} BatchScheduler] queue() expects a function, got ${typeof effect}`
            );
        }
        this._pendingEffects.add(effect);
        this.scheduleFlush();
    }

    scheduleFlush() {
        if (!this.flushScheduled && !this.flushing) {
            this.flushScheduled = true;
            Promise.resolve().then(() => this.flush());
        }
    }

    flush() {
        if (this.flushing) return;

        if (this.flushDepth >= this.MAX_FLUSH_DEPTH) {
            const dropped = this._pendingEffects.size;
            this._pendingEffects.clear();
            this.flushDepth = 0;
            this.flushScheduled = false;
            reportError(new Error(
                `[Stitch.js ${this.version}] Stopped an infinite loop of updates: effects kept re-queuing each other ` +
                `for ${this.MAX_FLUSH_DEPTH} rounds (${dropped} still queued were dropped). An effect, computed or ` +
                "binding probably writes a value that it, or something it triggers, reads. Move the write out of " +
                "the effect, or guard it so the value stops changing."
            ), { source: "scheduler" });
            return;
        }

        this.flushing = true;
        this.flushScheduled = false;
        this.flushDepth++;

        const effectsToRun = Array.from(this._pendingEffects);
        this._pendingEffects.clear();

        effectsToRun.forEach((effect) => {
            this._runEffect(effect);
        });

        this.flushing = false;
        if (this._pendingEffects.size > 0) {
            this.scheduleFlush();
        } else {
            this.flushDepth = 0;
        }
    }

    /** Drops a queued effect (used when the effect is released before the flush). */
    dequeue(effect) {
        this._pendingEffects.delete(effect);
    }

    hasQueued() {
        return this._pendingEffects.size > 0;
    }

    clear() {
        this._pendingEffects.clear();
        this.flushScheduled = false;
    }
}

module.exports = {
    BatchScheduler
};
