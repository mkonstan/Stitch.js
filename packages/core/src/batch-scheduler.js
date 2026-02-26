"use strict";

const NOOP_DEBUG = {
    enabled: false,
    categories: Object.create(null),
    log() {},
    group() {},
    groupEnd() {}
};

class BatchScheduler {
    constructor(options = {}) {
        this.version = options.version || "v2.1.0";
        this.debug = options.debug || NOOP_DEBUG;
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
            console.error(
                `[Stitch.js ${this.version} BatchScheduler] Maximum flush depth exceeded.\n` +
                "Possible infinite loop detected. Queue cleared."
            );
            this._pendingEffects.clear();
            this.flushDepth = 0;
            this.flushScheduled = false;
            return;
        }

        this.flushing = true;
        this.flushScheduled = false;
        this.flushDepth++;

        this.debug.enabled && this.debug.group("effects", `Flushing BatchScheduler (${this._pendingEffects.size} effects, depth: ${this.flushDepth})`);

        const effectsToRun = Array.from(this._pendingEffects);
        this._pendingEffects.clear();

        effectsToRun.forEach((effect) => {
            try {
                effect();
            } catch (error) {
                console.error(`[Stitch.js ${this.version} BatchScheduler] Error in effect:`, error);
            }
        });

        this.debug.enabled && this.debug.groupEnd("effects");

        this.flushing = false;
        if (this._pendingEffects.size > 0) {
            this.debug.enabled && this.debug.log("effects", `New effects queued during flush (${this._pendingEffects.size}), scheduling next flush`);
            this.scheduleFlush();
        } else {
            this.flushDepth = 0;
        }
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
