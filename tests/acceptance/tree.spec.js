"use strict";

// Acceptance test for task 1 (tests/acceptance/TASKS.md): the file tree.
const { assert } = require("./helpers");

const TOP = ["src", "docs", "README.md"];

/** The toggle of the node whose name is `name` (not a toggle of one of its child nodes). */
async function toggleOf(page, name) {
    const handle = await page.evaluateHandle((wanted) => {
        const names = Array.from(document.querySelectorAll('[data-testid="node-name"]'))
            .filter((el) => el.textContent.trim() === wanted);
        if (names.length !== 1) return null;
        const node = names[0].closest('[data-testid="node"]');
        if (!node) return null;
        return Array.from(node.querySelectorAll('[data-testid="node-toggle"]'))
            .find((toggle) => toggle.closest('[data-testid="node"]') === node) || null;
    }, name);
    const element = handle.asElement();
    assert.ok(element, `the folder "${name}" has a toggle ([data-testid="node-toggle"] inside its [data-testid="node"])`);
    return element;
}

async function clickToggle(page, name) {
    await (await toggleOf(page, name)).click();
}

async function clickName(page, name) {
    const names = page.locator('[data-testid="node-name"]', { hasText: name });
    const exact = [];
    for (let i = 0; i < await names.count(); i++) {
        if ((await names.nth(i).textContent()).trim() === name) exact.push(names.nth(i));
    }
    assert.strictEqual(exact.length, 1, `one node named "${name}"`);
    await exact[0].click();
}

module.exports = {
    page: "tests/acceptance/pages/tree.html",
    tests: {
        "starts-with-top-level-nodes-collapsed": async ({ ui }) => {
            await ui.expectTexts("node-name", TOP, "only the top-level nodes are visible");
            await ui.expectText("selected", "Nothing selected");
        },

        "only-folders-have-a-toggle": async ({ ui }) => {
            await ui.expectTexts("node-toggle", ["+", "+"], "src and docs show a collapsed toggle; README.md has none");
            await ui.expectVisible("node", true);
            await ui.eventually(async () => {
                assert.strictEqual(await ui.all("node").count() >= 3, true, "each node is a [data-testid=node] element");
            });
        },

        "toggle-expands-and-collapses-a-folder": async ({ page, ui }) => {
            await clickToggle(page, "src");
            await ui.expectTexts("node-name", ["src", "app.js", "lib", "styles", "docs", "README.md"], "src shows its children in data order");
            await ui.eventually(async () => assert.strictEqual(await (await toggleOf(page, "src")).textContent().then((t) => t.trim()), "-"));
            await clickToggle(page, "src");
            await ui.expectTexts("node-name", TOP, "collapsing src hides its children");
            await ui.eventually(async () => assert.strictEqual(await (await toggleOf(page, "src")).textContent().then((t) => t.trim()), "+"));
        },

        "subfolders-keep-their-state": async ({ page, ui }) => {
            await clickToggle(page, "src");
            await ui.expectTexts("node-name", ["src", "app.js", "lib", "styles", "docs", "README.md"]);
            await clickToggle(page, "lib");
            await ui.expectTexts("node-name", ["src", "app.js", "lib", "format.js", "parse.js", "styles", "docs", "README.md"]);
            await clickToggle(page, "src");
            await ui.expectTexts("node-name", TOP, "collapsing src hides everything inside it");
            await clickToggle(page, "src");
            await ui.expectTexts("node-name", ["src", "app.js", "lib", "format.js", "parse.js", "styles", "docs", "README.md"],
                "lib is still expanded after src is collapsed and expanded again");
        },

        "selecting-a-node-shows-its-path": async ({ page, ui }) => {
            await clickToggle(page, "src");
            await ui.expectTexts("node-name", ["src", "app.js", "lib", "styles", "docs", "README.md"]);
            await clickToggle(page, "lib");
            await ui.expectTexts("node-name", ["src", "app.js", "lib", "format.js", "parse.js", "styles", "docs", "README.md"]);
            await clickName(page, "format.js");
            await ui.expectText("selected", "src/lib/format.js");
            await clickName(page, "docs");
            await ui.expectText("selected", "docs");
            await clickName(page, "README.md");
            await ui.expectText("selected", "README.md");
        },

        "expand-all-and-collapse-all": async ({ page, ui }) => {
            await page.locator('[data-testid="expand-all"]').click();
            await ui.expectTexts("node-name",
                ["src", "app.js", "lib", "format.js", "parse.js", "styles", "main.css", "docs", "guide.md", "README.md"],
                "every node is visible after expand-all");
            await ui.expectTexts("node-toggle", ["-", "-", "-", "-"], "every folder shows an expanded toggle");
            await page.locator('[data-testid="collapse-all"]').click();
            await ui.expectTexts("node-name", TOP, "only the top-level nodes after collapse-all");
            await clickToggle(page, "src");
            await ui.expectTexts("node-name", ["src", "app.js", "lib", "styles", "docs", "README.md"], "collapse-all also collapsed the subfolders");
        }
    }
};
