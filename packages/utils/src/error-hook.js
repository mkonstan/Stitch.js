"use strict";

const { VERSION } = require("./version");

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
let errorHandler = null;

/**
 * Installs the one page-wide handler for errors raised inside reactive updates;
 * null removes it.
 * @param {Function|null} fn - called as fn(error, context)
 */
function onError(fn) {
    if (fn !== null && typeof fn !== "function") {
        throw new TypeError(
            `[Stitch.js v${VERSION}] Stitch.onError(fn): fn must be a function (or null to remove the handler), got ${typeof fn}.`
        );
    }
    errorHandler = fn;
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
    const handler = errorHandler;
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
    reportError,
    runAllThenThrow
};
