"use strict";

/**
 * Live counts of the reactive graph, summed over every ReactiveSystem in the page.
 * Read-only from outside: Stitch.debug.stats() returns a copy.
 *
 * - effects: effects created and not yet disposed (one per live effect-backed binding,
 *   plus any $watch or custom-binding effect).
 * - subscriptions: subscriber edges that a change can reach: an effect or computed
 *   subscribed to a reactive property, or an effect / computed subscribed to a computed.
 */
const REACTIVE_TOTALS = {
    effects: 0,
    subscriptions: 0
};

function readReactiveStats() {
    return {
        effects: REACTIVE_TOTALS.effects,
        subscriptions: REACTIVE_TOTALS.subscriptions
    };
}

module.exports = {
    REACTIVE_TOTALS,
    readReactiveStats
};
