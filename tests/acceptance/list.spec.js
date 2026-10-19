"use strict";

// Acceptance test for task 2 (tests/acceptance/TASKS.md): the stock list.
const { assert } = require("./helpers");

const ALL = ["AAPL", "BAC", "CVX", "JNJ", "JPM", "MSFT", "PFE", "XOM"];

/** The row whose ticker is `ticker`, and a control inside it. */
function rowOf(page, ticker) {
    return page.locator('[data-testid="row"]').filter({
        has: page.locator('[data-testid="row-ticker"]', { hasText: new RegExp(`^\\s*${ticker}\\s*$`) })
    });
}

async function control(page, ticker, testId) {
    const row = rowOf(page, ticker);
    assert.strictEqual(await row.count(), 1, `one row for ${ticker}`);
    const found = row.locator(`[data-testid="${testId}"]`);
    assert.strictEqual(await found.count(), 1, `the ${ticker} row has one [data-testid="${testId}"]`);
    return found;
}

async function selectSector(page, label) {
    await page.locator('[data-testid="sector"]').selectOption({ label });
}

module.exports = {
    page: "tests/acceptance/pages/list.html",
    tests: {
        "shows-every-stock-in-ticker-order": async ({ page, ui }) => {
            await ui.expectTexts("row-ticker", ALL);
            await ui.expectText("count", "Showing 8 of 8");
            await ui.expectText("watched-count", "0 watched");
            await ui.expectVisible("empty", false);
            await ui.eventually(async () => {
                const price = await control(page, "AAPL", "row-price");
                assert.strictEqual((await price.textContent()).trim(), "189.50", "prices show two decimals");
                const name = await control(page, "JNJ", "row-name");
                assert.strictEqual((await name.textContent()).trim(), "Johnson & Johnson");
            });
        },

        "search-filters-by-ticker-or-name-ignoring-case": async ({ ui }) => {
            await ui.type("search", "an");
            await ui.expectTexts("row-ticker", ["BAC", "JPM"], "Bank of America and JPMorgan Chase contain \"an\"");
            await ui.expectText("count", "Showing 2 of 8");
            await ui.type("search", "msft");
            await ui.expectTexts("row-ticker", ["MSFT"], "the ticker matches, ignoring case");
            await ui.type("search", "");
            await ui.expectTexts("row-ticker", ALL, "an empty search shows every row");
            await ui.expectText("count", "Showing 8 of 8");
        },

        "sector-filter-combines-with-search": async ({ page, ui }) => {
            await ui.eventually(async () => {
                const options = await page.locator('[data-testid="sector"] option').allTextContents();
                assert.deepStrictEqual(options.map((o) => o.trim()), ["All sectors", "Energy", "Financials", "Health Care", "Technology"]);
            });
            await selectSector(page, "Energy");
            await ui.expectTexts("row-ticker", ["CVX", "XOM"]);
            await ui.expectText("count", "Showing 2 of 8");
            await ui.type("search", "ex");
            await ui.expectTexts("row-ticker", ["XOM"], "Energy and \"ex\" leaves Exxon Mobil");
            await selectSector(page, "All sectors");
            await ui.expectTexts("row-ticker", ["XOM"], "search alone: only Exxon Mobil contains \"ex\"");
        },

        "empty-message-when-nothing-matches": async ({ ui }) => {
            await ui.type("search", "zzz");
            await ui.expectTexts("row-ticker", []);
            await ui.expectVisible("empty", true);
            await ui.expectText("empty", "No matching stocks");
            await ui.expectText("count", "Showing 0 of 8");
            await ui.type("search", "");
            await ui.expectVisible("empty", false);
        },

        "watched-mark-survives-filtering": async ({ page, ui }) => {
            await (await control(page, "MSFT", "row-watch")).check();
            await ui.expectText("watched-count", "1 watched");
            await ui.type("search", "apple");
            await ui.expectTexts("row-ticker", ["AAPL"]);
            await ui.type("search", "");
            await ui.expectTexts("row-ticker", ALL);
            await ui.eventually(async () => {
                assert.strictEqual(await (await control(page, "MSFT", "row-watch")).isChecked(), true, "MSFT is still watched");
                assert.strictEqual(await (await control(page, "AAPL", "row-watch")).isChecked(), false, "AAPL is not watched");
            });
            await ui.expectText("watched-count", "1 watched");
        },

        "remove-takes-a-stock-out-of-the-list": async ({ page, ui }) => {
            await (await control(page, "JPM", "row-watch")).check();
            await ui.expectText("watched-count", "1 watched");
            await (await control(page, "JPM", "row-remove")).click();
            await ui.expectTexts("row-ticker", ["AAPL", "BAC", "CVX", "JNJ", "MSFT", "PFE", "XOM"]);
            await ui.expectText("count", "Showing 7 of 7");
            await ui.expectText("watched-count", "0 watched");
            await ui.type("search", "chase");
            await ui.expectTexts("row-ticker", [], "the removed stock does not come back");
            await ui.expectText("count", "Showing 0 of 7");
        }
    }
};
