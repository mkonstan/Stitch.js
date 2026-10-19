"use strict";

// Acceptance test for task 3 (tests/acceptance/TASKS.md): the sign-up form.
const { assert } = require("./helpers");

const ERRORS = ["name-error", "email-error", "age-error", "password-error", "confirm-error", "terms-error"];

async function expectNoErrors(ui, except = []) {
    for (const id of ERRORS) {
        if (except.indexOf(id) === -1) await ui.expectVisible(id, false, `${id} is not visible`);
    }
}

async function fillValid(page, ui) {
    await ui.type("name", "  Ada  ");
    await ui.type("email", "ada@example.com");
    await ui.type("age", "36");
    await ui.type("password", "analytical");
    await ui.type("confirm", "analytical");
    await page.locator('[data-testid="terms"]').check();
}

module.exports = {
    page: "tests/acceptance/pages/form.html",
    tests: {
        "no-errors-when-the-page-opens": async ({ ui }) => {
            await ui.expectVisible("form", true);
            await expectNoErrors(ui);
            await ui.expectVisible("success", false);
        },

        "an-error-appears-only-after-the-field-is-changed": async ({ ui }) => {
            await ui.type("name", "a");
            await expectNoErrors(ui);
            await ui.type("name", "");
            await ui.expectText("name-error", "Name is required");
            await expectNoErrors(ui, ["name-error"]);
            await ui.type("name", "   ");
            await ui.expectText("name-error", "Name is required", "spaces only is still empty");
            await ui.type("name", "Ada");
            await ui.expectVisible("name-error", false);
        },

        "email-rules": async ({ ui }) => {
            await ui.type("email", "ada@");
            await ui.expectText("email-error", "Enter a valid email address");
            await ui.type("email", "ada lovelace@example.com");
            await ui.expectText("email-error", "Enter a valid email address", "no spaces allowed");
            await ui.type("email", "");
            await ui.expectText("email-error", "Email is required");
            await ui.type("email", "ada@example.com");
            await ui.expectVisible("email-error", false);
        },

        "age-rules": async ({ ui }) => {
            await ui.type("age", "17");
            await ui.expectText("age-error", "Age must be between 18 and 120");
            await ui.type("age", "121");
            await ui.expectText("age-error", "Age must be between 18 and 120");
            await ui.type("age", "18");
            await ui.expectVisible("age-error", false);
            await ui.type("age", "120");
            await ui.expectVisible("age-error", false);
            await ui.type("age", "");
            await ui.expectText("age-error", "Age is required");
        },

        "password-and-confirmation": async ({ ui }) => {
            await ui.type("password", "short");
            await ui.expectText("password-error", "Password must be at least 8 characters");
            await ui.type("password", "longenough");
            await ui.expectVisible("password-error", false);
            await ui.type("confirm", "different");
            await ui.expectText("confirm-error", "Passwords do not match");
            await ui.type("confirm", "longenough");
            await ui.expectVisible("confirm-error", false);
            await ui.type("password", "longenough2");
            await ui.expectText("confirm-error", "Passwords do not match", "changing the password re-checks the confirmation");
        },

        "terms-checkbox": async ({ page, ui }) => {
            const terms = page.locator('[data-testid="terms"]');
            await terms.check();
            await ui.expectVisible("terms-error", false);
            await terms.uncheck();
            await ui.expectText("terms-error", "You must accept the terms");
        },

        "submit-with-errors-shows-every-error": async ({ page, ui }) => {
            await page.locator('[data-testid="submit"]').click();
            await ui.expectText("name-error", "Name is required");
            await ui.expectText("email-error", "Email is required");
            await ui.expectText("age-error", "Age is required");
            await ui.expectText("password-error", "Password must be at least 8 characters");
            await ui.expectText("terms-error", "You must accept the terms");
            await ui.expectVisible("success", false);
            await ui.expectVisible("form", true);
            // The confirmation equals the (empty) password, so it has no error yet.
            await ui.expectVisible("confirm-error", false);
            await ui.type("password", "longenough");
            await ui.expectText("confirm-error", "Passwords do not match", "after submit, every field is checked");
        },

        "submit-when-valid-shows-the-welcome": async ({ page, ui }) => {
            await fillValid(page, ui);
            await expectNoErrors(ui);
            await ui.expectVisible("success", false);
            await page.locator('[data-testid="submit"]').click();
            await ui.expectVisible("form", false);
            await ui.expectText("success", "Welcome, Ada!");
            await ui.eventually(async () => assert.strictEqual(await ui.isVisible("success"), true));
        }
    }
};
