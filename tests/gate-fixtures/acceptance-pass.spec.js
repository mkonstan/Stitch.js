"use strict";

// Gate self-test fixture (see tests/gate-fixtures/fixtures.js): an acceptance spec.
module.exports = {
    page: "tests/gate-fixtures/acceptance-page.html",
    tests: {
        "click-increments": async ({ page, ui }) => {
            await page.locator('[data-testid="inc"]').click();
            await ui.expectText("count", "1");
        }
    }
};
