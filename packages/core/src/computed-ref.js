"use strict";

// The dependency key under which readers of a computed subscribe to it. Readers live in
// the system's dependency map like any other subscription, so releasing a reader
// (ReactiveSystem.cleanup) removes it from every computed it read.
const COMPUTED_VALUE_KEY = "value";

// Ids are labels only: a counter (a label needs no randomness).
let nextComputedId = 0;

// How many computed getters are running right now (page-wide, every reactive system). A
// computed only reads: while depth > 0, every write to a model is refused (E724, E725).
const COMPUTING = { depth: 0 };

class ComputedRef {
    constructor(getter, reactiveSystem, context, explicitDeps = null) {
        this.getter = getter;
        this.reactiveSystem = reactiveSystem;
        this.context = context;
        this.explicitDeps = explicitDeps;
        this.value = undefined;
        this.dirty = true;
        // True after an evaluation threw (the computed stays dirty, see markDirty).
        this.failed = false;
        this.deps = new Set();
        this._generation = reactiveSystem._generation;
        this.id = ++nextComputedId;
        this.isComputedRef = true;

    }

    markDirty() {
        // Already dirty: readers were told. Except after a failed evaluation: then the
        // readers that saw the error must hear about the change that may fix it.
        if (this.dirty && !this.failed) {
            return;
        }
        this.failed = false;

        this.dirty = true;

        // Notify readers (effects and computeds) through the system's dependency map.
        this.reactiveSystem.trigger(this, COMPUTED_VALUE_KEY);

        // Read only imperatively (no reader subscribed): stop listening until the next read.
        if (!this.hasReaders()) {
            this.release();
        }
    }

    /** True while an effect or another computed is subscribed to this computed. */
    hasReaders() {
        const deps = this.reactiveSystem.depsMap.get(this);
        const readers = deps && deps.get(COMPUTED_VALUE_KEY);
        return !!readers && readers.size > 0;
    }

    /**
     * Stops listening to every source; the next read recomputes and subscribes again.
     * Releases, in turn, computeds that only this one was reading.
     */
    release() {
        this.dirty = true;
        this.reactiveSystem._releaseUnread(this.reactiveSystem._untrack(this));
    }

    evaluate() {
        const unread = this.reactiveSystem._untrack(this);
        this.reactiveSystem.effectStack.push(this);

        try {
            if (this.explicitDeps && this.context) {
                for (const depKey of this.explicitDeps) {
                    void this.context[depKey];
                }
            }

            COMPUTING.depth++;
            try {
                // this AND the first argument are the object that holds the computed, so an
                // arrow function can read it too: total: m => m.price * m.qty.
                this.value = this.getter.call(this.context, this.context);
            } catch (error) {
                this.failed = true;
                throw error;
            } finally {
                COMPUTING.depth--;
            }
            this.dirty = false;
            this.failed = false;


            return this.value;
        } finally {
            this.reactiveSystem.effectStack.pop();
            this.reactiveSystem._releaseUnread(unread);
        }
    }

    get() {
        this.reactiveSystem.track(this, COMPUTED_VALUE_KEY);

        // A disposed system no longer invalidates computeds, so never serve a cached value.
        if (this.dirty || this.reactiveSystem.disposed) {
            return this.evaluate();
        }

        return this.value;
    }

    cleanup() {
        this.release();
    }
}

module.exports = {
    ComputedRef,
    COMPUTED_VALUE_KEY,
    COMPUTING
};
