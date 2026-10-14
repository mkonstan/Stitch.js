"use strict";

// The dependency key under which readers of a computed subscribe to it. Readers live in
// the system's dependency map like any other subscription, so releasing a reader
// (ReactiveSystem.cleanup) removes it from every computed it read.
const COMPUTED_VALUE_KEY = "value";

class ComputedRef {
    constructor(getter, reactiveSystem, context, explicitDeps = null) {
        this.getter = getter;
        this.reactiveSystem = reactiveSystem;
        this.context = context;
        this.explicitDeps = explicitDeps;
        this.value = undefined;
        this.dirty = true;
        this.deps = new Set();
        this._generation = reactiveSystem._generation;
        this.id = Math.random().toString(36).substr(2, 9);
        this.isComputedRef = true;

        this.reactiveSystem.debug.enabled && this.reactiveSystem.debug.log("computed", `COMPUTED REF CREATED (id: ${this.id})`, {
            hasExplicitDeps: !!explicitDeps,
            explicitDeps
        });
    }

    markDirty() {
        if (this.dirty) {
            return;
        }

        this.reactiveSystem.debug.enabled && this.reactiveSystem.debug.log("computed", `COMPUTED MARKED DIRTY (id: ${this.id})`);
        this.dirty = true;

        // Notify readers (effects and computeds) through the system's dependency map.
        this.reactiveSystem.trigger(this, COMPUTED_VALUE_KEY);
    }

    evaluate() {
        this.reactiveSystem.debug.enabled && this.reactiveSystem.debug.log("computed", `COMPUTING VALUE (id: ${this.id})`);
        this.cleanup();
        this.reactiveSystem.effectStack.push(this);

        try {
            if (this.explicitDeps && this.context) {
                for (const depKey of this.explicitDeps) {
                    void this.context[depKey];
                }
            }

            this.value = this.getter.call(this.context);
            this.dirty = false;

            this.reactiveSystem.debug.enabled && this.reactiveSystem.debug.log("computed", `COMPUTED VALUE (id: ${this.id})`, {
                value: this.value,
                deps: this.deps.size
            });

            return this.value;
        } finally {
            this.reactiveSystem.effectStack.pop();
        }
    }

    get() {
        this.reactiveSystem.track(this, COMPUTED_VALUE_KEY);

        // A disposed system no longer invalidates computeds, so never serve a cached value.
        if (this.dirty || this.reactiveSystem.disposed) {
            return this.evaluate();
        }

        this.reactiveSystem.debug.enabled && this.reactiveSystem.debug.log("computed", `COMPUTED CACHED (id: ${this.id})`, {
            value: this.value
        });
        return this.value;
    }

    cleanup() {
        this.reactiveSystem._untrack(this);
    }
}

module.exports = {
    ComputedRef,
    COMPUTED_VALUE_KEY
};
