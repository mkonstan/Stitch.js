"use strict";

const { MessageBus, NOOP_DEBUG } = require("./message-bus");
const { BatchScheduler } = require("./batch-scheduler");

class ReactiveSystem {
    constructor(bubbleChangeUp = null, options = {}) {
        this.version = options.version || "v2.1.0";
        this.debug = options.debug || NOOP_DEBUG;
        this.effects = new Set();
        this.effectStack = [];
        this.depsMap = new WeakMap();

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

        if (!currentEffect) {
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

        dep.add(currentEffect);
        if (currentEffect.deps) {
            currentEffect.deps.add(dep);
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

    effect(fn, options = {}) {
        const effectId = Math.random().toString(36).substr(2, 9);

        const effect = () => {
            this.cleanup(effect);
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

        this.debug.enabled && this.debug.log("effects", `EFFECT CREATED (id: ${effectId})`, {
            lazy: !!options.lazy,
            batch: !!options.batch
        });

        if (!options.lazy) {
            effect();
        }

        return effect;
    }

    cleanup(effect) {
        effect.deps.forEach((dep) => {
            dep.delete(effect);
        });
        effect.deps.clear();
    }
}

module.exports = {
    ReactiveSystem
};
