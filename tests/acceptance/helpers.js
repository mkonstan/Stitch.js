"use strict";

/*
 * Helpers for the acceptance specs (tests/acceptance/*.spec.js). A spec drives a page the
 * way a user does, through Playwright, and finds elements only by the data-testid values
 * that tests/acceptance/TASKS.md names. Every check retries for a short while, because a
 * Stitch page updates in a microtask after each change.
 */

const assert = require("assert");

const WAIT_MS = 2000;

function byTestId(id) {
    return `[data-testid="${id}"]`;
}

function createUi(page) {
    const ui = {
        /** A Playwright locator for every element with this test id. */
        all(id) {
            return page.locator(byTestId(id));
        },

        /** Text of every VISIBLE element with this test id, trimmed, in document order. */
        async visibleTexts(id) {
            return page.$$eval(byTestId(id), (elements) => elements
                .filter((el) => el.getClientRects().length > 0 && getComputedStyle(el).visibility !== "hidden")
                .map((el) => el.textContent.trim()));
        },

        /** Whether at least one element with this test id is visible. */
        async isVisible(id) {
            return (await ui.visibleTexts(id)).length > 0;
        },

        /** The trimmed text of the single visible element with this test id. */
        async text(id) {
            const texts = await ui.visibleTexts(id);
            assert.strictEqual(texts.length, 1, `expected exactly one visible [data-testid="${id}"], found ${texts.length}`);
            return texts[0];
        },

        /** Types into a field like a user: replaces its value, then leaves the field. */
        async type(id, value) {
            const field = page.locator(byTestId(id));
            assert.strictEqual(await field.count(), 1, `expected one [data-testid="${id}"]`);
            await field.fill(value);
            await field.dispatchEvent("change");
            await field.evaluate((el) => el.blur());
        },

        /** Retries fn (which asserts) until it passes or WAIT_MS has passed; then rethrows. */
        async eventually(fn) {
            const until = Date.now() + WAIT_MS;
            for (;;) {
                try {
                    return await fn();
                } catch (error) {
                    if (Date.now() > until) throw error;
                    await page.waitForTimeout(25);
                }
            }
        },

        /** Asserts the visible texts of a test id equal expected (retrying). */
        async expectTexts(id, expected, message) {
            await ui.eventually(async () => {
                assert.deepStrictEqual(await ui.visibleTexts(id), expected, message || `visible [data-testid="${id}"]`);
            });
        },

        /** Asserts the single visible element's text (retrying). */
        async expectText(id, expected, message) {
            await ui.eventually(async () => {
                assert.strictEqual(await ui.text(id), expected, message || `text of [data-testid="${id}"]`);
            });
        },

        /** Asserts whether any element with this test id is visible (retrying). */
        async expectVisible(id, visible, message) {
            await ui.eventually(async () => {
                assert.strictEqual(await ui.isVisible(id), visible, message || `[data-testid="${id}"] is ${visible ? "visible" : "not visible"}`);
            });
        }
    };
    return ui;
}

module.exports = { createUi, assert, byTestId };
