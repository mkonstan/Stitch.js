"use strict";

class ComputedRef {
    constructor(getter, reactiveSystem, context, explicitDeps = null) {
        this.getter = getter;
        this.reactiveSystem = reactiveSystem;
        this.context = context;
        this.explicitDeps = explicitDeps;
        this.value = undefined;
        this.dirty = true;
        this.dependents = new Set();
        this.deps = new Set();
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

        this.dependents.forEach((dependent) => {
            if (dependent.isComputedRef) {
                dependent.markDirty();
            } else if (dependent.options && dependent.options.batch) {
                this.reactiveSystem.batchScheduler.queue(dependent);
            } else {
                dependent();
            }
        });
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
        const currentEffect = this.reactiveSystem.currentEffect;
        if (currentEffect) {
            this.dependents.add(currentEffect);
            this.reactiveSystem.debug.enabled && this.reactiveSystem.debug.log(
                "computed",
                `COMPUTED TRACKED (id: ${this.id}) by effect ${currentEffect.id || "unknown"}`
            );
        }

        if (this.dirty) {
            return this.evaluate();
        }

        this.reactiveSystem.debug.enabled && this.reactiveSystem.debug.log("computed", `COMPUTED CACHED (id: ${this.id})`, {
            value: this.value
        });
        return this.value;
    }

    cleanup() {
        this.deps.forEach((dep) => {
            dep.delete(this);
        });
        this.deps.clear();
    }
}

module.exports = {
    ComputedRef
};
