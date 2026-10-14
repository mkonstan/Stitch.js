"use strict";

const { MessageBus, NOOP_DEBUG } = require("./message-bus");
const { BatchScheduler } = require("./batch-scheduler");
const { VERSION } = require("../../utils/src/version");
const { REACTIVE_TOTALS } = require("../../utils/src/reactive-stats");

class ReactiveSystem {
    constructor(bubbleChangeUp = null, options = {}) {
        this.version = options.version || `v${VERSION}`;
        this.debug = options.debug || NOOP_DEBUG;
        this.effectStack = [];
        this.depsMap = new WeakMap();
        // Live counts for this system (Stitch.debug.stats() sums every system).
        this._stats = { effects: 0, subscriptions: 0 };
        // Bumped by dispose(): subscribers of an older generation sit in dependency
        // sets that no longer exist, so releasing them changes no live count.
        this._generation = 0;
        this.disposed = false;

        const BatchSchedulerCtor = options.BatchScheduler || BatchScheduler;
        const MessageBusCtor = options.MessageBus || MessageBus;

        this.batchScheduler = new BatchSchedulerCtor({
            version: this.version,
            debug: this.debug
        });
        this.messageBus = new MessageBusCtor({
            version: this.version,
            debug: this.debug
        });
        this.bubbleChangeUp = bubbleChangeUp;

        this.messageBus.subscribe("nested-change", (payload) => {
            const parent = payload.parent;
            const fullPath = payload.fullPath;
            const oldValue = payload.oldValue;
            const newValue = payload.newValue;
            if (parent._changeHandlers && parent._changeHandlers.size > 0) {
                parent._changeHandlers.forEach((handler) => {
                    handler({
                        field: fullPath,
                        oldValue,
                        newValue,
                        target: parent,
                        nestedChange: true
                    });
                });
            }
        });

        this.messageBus.subscribe("array-mutation", (payload) => {
            const target = payload.target;
            const method = payload.method;
            const args = payload.args;
            const oldLength = payload.oldLength;
            const newLength = payload.newLength;

            if (target._changeHandlers) {
                target._changeHandlers.forEach((handler) => {
                    handler({
                        field: "items",
                        action: method,
                        args,
                        target
                    });
                });
            }

            if (this.bubbleChangeUp) {
                this.bubbleChangeUp(target, "items", oldLength, newLength);
            }
        });
    }

    get currentEffect() {
        return this.effectStack[this.effectStack.length - 1] || null;
    }

    _getObjectId(obj) {
        if (!obj) return "null";
        return obj.__stitchId || obj.constructor?.name || "unknown";
    }

    track(target, key) {
        const currentEffect = this.currentEffect;

        if (!currentEffect || this.disposed) {
            this.debug.enabled && this.debug.log("reactivity", `TRACK SKIPPED (no current effect): ${this._getObjectId(target)}.${String(key)}`);
            return;
        }

        let deps = this.depsMap.get(target);
        if (!deps) {
            deps = new Map();
            this.depsMap.set(target, deps);
        }

        let dep = deps.get(key);
        if (!dep) {
            dep = new Set();
            deps.set(key, dep);
        }

        if (!dep.has(currentEffect)) {
            dep.add(currentEffect);
            currentEffect.deps.add(dep);
            this._countSubscriptions(1);
        }

        this.debug.enabled && this.debug.log("reactivity", `TRACK: ${this._getObjectId(target)}.${String(key)} -> ${currentEffect.id || "unknown"}`, {
            effectId: currentEffect.id,
            isComputed: !!currentEffect.isComputedRef,
            dependencyCount: dep.size
        });
    }

    trigger(target, key, oldValue, newValue) {
        const deps = this.depsMap.get(target);
        const dep = deps?.get(key);

        if (!dep || dep.size === 0) {
            this.debug.enabled && this.debug.log("reactivity", `TRIGGER SKIPPED (no deps): ${this._getObjectId(target)}.${String(key)}`);
            return;
        }

        this.debug.enabled && this.debug.log("reactivity", `TRIGGER: ${this._getObjectId(target)}.${String(key)} (${dep.size} dependents)`, {
            oldValue,
            newValue
        });

        const effectsToRun = new Set(dep);
        effectsToRun.forEach((dependent) => {
            if (dependent.disposed) {
                return;
            }
            if (dependent.isComputedRef) {
                dependent.markDirty();
            } else if (dependent.options && dependent.options.batch) {
                this.batchScheduler.queue(dependent);
            } else {
                dependent();
            }
        });

        if (target._changeHandlers) {
            target._changeHandlers.forEach((handler) => {
                handler({
                    field: key,
                    oldValue,
                    newValue,
                    target
                });
            });
        }
    }

    /**
     * Creates an effect: runs fn now (unless options.lazy) and again whenever a
     * reactive value it read changes. Release it with cleanup(effect).
     * If the first run throws, the effect is released and the error is rethrown.
     */
    effect(fn, options = {}) {
        if (this.disposed) {
            throw new Error(`[Stitch.js ${this.version}] effect(): this ReactiveSystem was disposed; create a new model to bind again.`);
        }
        const effectId = Math.random().toString(36).substr(2, 9);

        const effect = () => {
            if (effect.disposed || this.disposed) {
                return undefined;
            }
            this._untrack(effect);
            this.effectStack.push(effect);

            this.debug.enabled && this.debug.log("effects", `EFFECT RUNNING (id: ${effectId})`, {
                stackDepth: this.effectStack.length,
                batch: !!options.batch
            });

            try {
                return fn();
            } finally {
                this.effectStack.pop();
            }
        };

        effect.deps = new Set();
        effect.options = options;
        effect.id = effectId;
        effect.disposed = false;
        effect._generation = this._generation;
        this._countEffects(1);

        this.debug.enabled && this.debug.log("effects", `EFFECT CREATED (id: ${effectId})`, {
            lazy: !!options.lazy,
            batch: !!options.batch
        });

        if (!options.lazy) {
            try {
                effect();
            } catch (error) {
                this.cleanup(effect);
                throw error;
            }
        }

        return effect;
    }

    /**
     * Runs fn without subscribing the current effect to anything fn reads.
     * Effects created inside fn still track their own reads.
     */
    untracked(fn) {
        this.effectStack.push(null);
        try {
            return fn();
        } finally {
            this.effectStack.pop();
        }
    }

    /**
     * Releases an effect for good: it leaves every dependency set it joined
     * (reactive properties and computeds), leaves the batch queue, and never runs again.
     * Safe to call more than once.
     */
    cleanup(effect) {
        this._untrack(effect);
        if (effect.disposed) {
            return;
        }
        effect.disposed = true;
        if (this.batchScheduler && typeof this.batchScheduler.dequeue === "function") {
            this.batchScheduler.dequeue(effect);
        }
        if (effect._generation === this._generation) {
            this._countEffects(-1);
        }
    }

    /**
     * Removes a subscriber (effect or computed) from every dependency set it joined.
     * Used before each re-run (dependencies are collected afresh) and on release.
     * @private
     */
    _untrack(subscriber) {
        const live = subscriber._generation === this._generation;
        let removed = 0;
        subscriber.deps.forEach((dep) => {
            if (dep.delete(subscriber)) {
                removed++;
            }
        });
        subscriber.deps.clear();
        if (live && removed > 0) {
            this._countSubscriptions(-removed);
        }
    }

    /**
     * Releases the whole reactive graph of this system: every effect stops for good,
     * every subscription is dropped, the batch queue is cleared. Models keep their
     * plain values (computeds recompute on each read) but nothing reacts any more.
     */
    dispose() {
        if (this.disposed) {
            return;
        }
        this.disposed = true;
        REACTIVE_TOTALS.effects -= this._stats.effects;
        REACTIVE_TOTALS.subscriptions -= this._stats.subscriptions;
        this._stats.effects = 0;
        this._stats.subscriptions = 0;
        this._generation++;
        this.depsMap = new WeakMap();
        this.batchScheduler.clear();
    }

    /** Live counts for this system: { effects, subscriptions }. */
    stats() {
        return { effects: this._stats.effects, subscriptions: this._stats.subscriptions };
    }

    /** @private */
    _countEffects(delta) {
        this._stats.effects += delta;
        REACTIVE_TOTALS.effects += delta;
    }

    /** @private */
    _countSubscriptions(delta) {
        this._stats.subscriptions += delta;
        REACTIVE_TOTALS.subscriptions += delta;
    }
}

module.exports = {
    ReactiveSystem
};
