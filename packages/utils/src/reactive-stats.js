"use strict";

/**
 * Live counts of the reactive graph, summed over every ReactiveSystem in the page.
 * Read-only from outside: Stitch.debug.stats() returns a copy.
 *
 * - effects: effects created and not yet disposed (one per live effect-backed binding,
 *   plus any $watch or custom-binding effect).
 * - subscriptions: subscriber edges that a change can reach: an effect or computed
 *   subscribed to a reactive property, or an effect / computed subscribed to a computed.
 * - parentLinks: links from model objects to the places that hold them (B9: they must
 *   not outlive those places; on a live model, a count that only grows is a leak). Objects
 *   collected while still inside a discarded model are not subtracted.
 */
const REACTIVE_TOTALS = {
    effects: 0,
    subscriptions: 0,
    parentLinks: 0
};

function readReactiveStats() {
    return {
        effects: REACTIVE_TOTALS.effects,
        subscriptions: REACTIVE_TOTALS.subscriptions,
        parentLinks: REACTIVE_TOTALS.parentLinks
    };
}

module.exports = {
    REACTIVE_TOTALS,
    readReactiveStats
};
