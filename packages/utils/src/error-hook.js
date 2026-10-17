"use strict";

const { createHookSlot } = require("./hook-slot");

/**
 * Where errors raised inside reactive updates go (D23).
 *
 * An effect re-run, a list re-render, a change handler or a MessageBus subscriber runs
 * outside the caller's stack, so its error cannot be thrown to anyone. It is passed to
 * the handler installed with Stitch.onError(fn) as fn(error, context). With no handler
 * it is re-thrown uncaught on a fresh task, so it reaches window.onerror and the console
 * like any other uncaught error. A handler that throws has its own error re-thrown the
 * same way. Errors on the synchronous bind() stack are thrown to the caller instead.
 */
const slot = createHookSlot("Stitch.onError");

/**
 * Installs the one page-wide handler for errors raised inside reactive updates and
 * returns a function that removes it; null removes the installed one. Installing while
 * another handler is installed throws.
 * @param {Function|null} fn - called as fn(error, context)
 * @returns {Function} remove
 */
function onError(fn) {
    return slot.install(fn);
}

/** True while a Stitch.onError handler is installed. */
function hasErrorHandler() {
    return slot.get() !== null;
}

function rethrowUncaught(error) {
    setTimeout(() => {
        throw error;
    }, 0);
}

/**
 * Hands an error raised inside a reactive update to Stitch.onError, or re-throws it
 * uncaught when no handler is installed.
 * @param {*} error
 * @param {Object} [context] - what was running: { source, element?, binding?, event?, field? }
 */
function reportError(error, context) {
    const handler = slot.get();
    if (!handler) {
        rethrowUncaught(error);
        return;
    }
    try {
        handler(error, context || { source: "unknown" });
    } catch (handlerError) {
        rethrowUncaught(handlerError);
    }
}

/**
 * Runs every function, even when one throws, then throws the first error (if any).
 * Any further errors go to reportError, so none is lost.
 * Used where several independent cleanups must all run.
 * @param {Iterable<Function>} fns
 * @param {Object} [context] - passed to reportError for the second and later errors
 */
function runAllThenThrow(fns, context) {
    let first = null;
    for (const fn of fns) {
        try {
            fn();
        } catch (error) {
            if (first === null) {
                first = { error };
            } else {
                reportError(error, context);
            }
        }
    }
    if (first !== null) {
        throw first.error;
    }
}

module.exports = {
    onError,
    hasErrorHandler,
    reportError,
    runAllThenThrow
};
