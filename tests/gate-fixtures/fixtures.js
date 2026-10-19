"use strict";

/*
 * Gate self-tests. Each entry is one way a broken suite could look green.
 * `npm test` re-runs the gate on each one and requires the stated outcome:
 * exit non-zero AND print the stated reason, or (controls) exit 0. A fixture
 * that fails for the wrong reason does not count.
 *
 * browser: run as `node _tools/run-tests.js --fixture <name>` against stitch.js.
 * static:  a throwaway tree is generated under _scratch/self-test/<name>/ and
 *          checked with `node _tools/check-repo.js --root <dir> --only <check>`.
 *          Trees are generated, not committed, so the repository itself stays
 *          clean for the same checks. Strings are split where needed so this
 *          file does not trip the checks it tests.
 */

const fs = require("fs");
const path = require("path");

const F = "tests/gate-fixtures/";
const FAIL = (output) => ({ exitCode: 1, output });
const PASS = { exitCode: 0 };
const QUICK = 3000; // ms: fixtures that are meant to time out do so quickly

const browser = {
    // Controls: the gate must pass these, or every "must fail" below proves nothing.
    "control-pass": { suites: [`${F}pass.html`], expect: PASS },
    "control-known-failing": {
        suites: [`${F}fail.html`],
        knownFailing: { [`${F}fail.html#broken`]: { defect: 99, sprint: "T9", expect: ["deliberately wrong arithmetic"] } },
        expect: PASS
    },

    // Each must make the gate fail, for the stated reason.
    "zero-tests": { suites: [`${F}empty.html`], expect: FAIL("zero tests") },
    "never-reports": { suites: [`${F}no-report.html`], pageTimeoutMs: QUICK, expect: FAIL("did not finish within") },
    "no-harness": { suites: [`${F}no-harness.html`], pageTimeoutMs: QUICK, expect: FAIL("no harness report") },
    "throws-before-report": { suites: [`${F}throws.html`], pageTimeoutMs: QUICK, expect: FAIL("uncaught page error: fixture: thrown before reporting") },
    "page-error-during-pass": { suites: [`${F}page-error.html`], expect: FAIL("uncaught page error: fixture: uncaught error during a passing test") },
    "console-error-during-pass": { suites: [`${F}console-error.html`], expect: FAIL("console error: fixture: console error during a passing test") },
    "skipped-test": { suites: [`${F}skip.html`], expect: FAIL(`SKIPPED ${F}skip.html#b`) },
    "planned-never-reported": { suites: [`${F}missing-result.html`], expect: FAIL("planned but never reported") },
    "late-result": { suites: [`${F}late.html`], expect: FAIL("reported after the page finished: b") },
    "duplicate-result": { suites: [`${F}duplicate.html`], expect: FAIL('test "a" reported more than once') },
    "unplanned-result": { suites: [`${F}unplanned.html`], expect: FAIL('result "extra" is not in its plan') },
    "no-assertions": { suites: [`${F}no-assertions.html`], expect: FAIL("the test made no assertions") },
    "library-not-loaded": { suites: [`${F}no-library.html`], expect: FAIL("never loaded stitch.js") },
    "failed-request": { suites: [`${F}failed-request.html`], expect: FAIL("failed request: 404") },
    "unlisted-failure": { suites: [`${F}fail.html`], expect: FAIL(`FAILED  ${F}fail.html#broken`) },
    "known-failing-passes": {
        suites: [`${F}pass.html`],
        knownFailing: { [`${F}pass.html#ok`]: { defect: 99, sprint: "T9", expect: ["an observable holds a written value"] } },
        expect: FAIL("Remove it from known-failing")
    },
    "known-failing-stale": {
        suites: [`${F}pass.html`],
        knownFailing: { [`${F}pass.html#no-such-test`]: { defect: 99, sprint: "T9", expect: ["an assertion that never ran"] } },
        expect: FAIL("matches no test that ran")
    },
    "known-failing-extra-failure": {
        suites: [`${F}fail-precondition.html`],
        knownFailing: { [`${F}fail-precondition.html#broken`]: { defect: 99, sprint: "T9", expect: ["deliberately wrong arithmetic"] } },
        expect: FAIL('failed for a different reason: unexpected failure(s): "precondition: setup works')
    },
    "known-failing-threw": {
        suites: [`${F}fail-throws.html`],
        knownFailing: { [`${F}fail-throws.html#broken`]: { defect: 99, sprint: "T9", expect: ["deliberately wrong arithmetic"] } },
        expect: FAIL('failed for a different reason: unexpected failure(s): "threw: Error: fixture: setup exploded')
    },
    "known-failing-expected-failure-absent": {
        suites: [`${F}fail.html`],
        knownFailing: { [`${F}fail.html#broken`]: { defect: 99, sprint: "T9", expect: ["deliberately wrong arithmetic", "another expected failure here"] } },
        expect: FAIL('expected failure(s) absent: "another expected failure here"')
    },
    "known-failing-without-expect": {
        suites: [`${F}fail.html`],
        knownFailing: { [`${F}fail.html#broken`]: { defect: 99, sprint: "T9" } },
        expect: FAIL('needs "expect"')
    },
    "control-known-failing-precise": {
        suites: [`${F}fail-two.html`],
        knownFailing: { [`${F}fail-two.html#broken`]: { defect: 99, sprint: "T9", expect: ["the value is wrong in step one", "the value is wrong in step two"] } },
        expect: PASS
    },
    "expect-too-short": {
        suites: [`${F}fail-throws.html`],
        knownFailing: { [`${F}fail-throws.html#broken`]: { defect: 99, sprint: "T9", expect: ["t", "a"] } },
        expect: FAIL('expect prefix "t" is too broad')
    },
    "expect-generic-throw": {
        suites: [`${F}fail-throws.html`],
        knownFailing: { [`${F}fail-throws.html#broken`]: { defect: 99, sprint: "T9", expect: ["threw: Error: fixture"] } },
        expect: FAIL('is too broad: it starts with "threw"')
    },
    "expect-generic-precondition": {
        suites: [`${F}fail-precondition.html`],
        knownFailing: { [`${F}fail-precondition.html#broken`]: { defect: 99, sprint: "T9", expect: ["precondition: setup works", "deliberately wrong arithmetic"] } },
        expect: FAIL('is too broad: it starts with "precondition"')
    },
    "expect-shared-prefix": {
        suites: [`${F}fail-two.html`],
        knownFailing: { [`${F}fail-two.html#broken`]: { defect: 99, sprint: "T9", expect: ["the value is wrong in step"] } },
        expect: FAIL('expect prefix matches several failure lines')
    },
    "expect-partial-word": {
        suites: [`${F}fail-two.html`],
        knownFailing: { [`${F}fail-two.html#broken`]: { defect: 99, sprint: "T9", expect: ["the value is wrong in step o", "the value is wrong in step two"] } },
        expect: FAIL('expected failure(s) absent: "the value is wrong in step o"')
    },
    "late-assertion": { suites: [`${F}late-assertion.html`], expect: FAIL("harness: assertion after test 'a' settled (failed): fixture: late assertion") },
    "page-missing-from-list": {
        suites: [`${F}pass.html`],
        discoverDir: `${F}orphan/`,
        expect: FAIL(`test page not in tests/suites.js: ${F}orphan/test-orphan.html`)
    },
    "listed-page-missing": { suites: [`${F}does-not-exist.html`], expect: FAIL("listed page does not exist") },
    "example-missing-from-list": {
        suites: [`${F}pass.html`],
        discoverDir: `${F}orphan-example/`,
        expect: FAIL(`example page not in tests/suites.js examples: ${F}orphan-example/example-orphan.html`)
    },
    "listed-example-missing": { suites: [`${F}pass.html`], examples: [`${F}example-does-not-exist.html`], expect: FAIL("listed example does not exist") },

    // Executable documentation (tests/doc-snippets.js): a broken snippet must fail the run.
    "control-doc-snippets": { suites: [`${F}doc-snippets-control.html`], expect: PASS },
    "doc-snippet-run-throws": {
        suites: [`${F}doc-snippets-run-throws.html`],
        expect: FAIL(`FAILED  ${F}doc-snippets-run-throws.html#doc-snippets-run-throws.md:3 [stitch.js]: the snippet threw`)
    },
    "doc-snippet-throw-absent": {
        suites: [`${F}doc-snippets-throw-absent.html`],
        expect: FAIL("but nothing was thrown")
    },
    "doc-snippet-wrong-message": {
        suites: [`${F}doc-snippets-wrong-message.html`],
        expect: FAIL("does not contain the documented text")
    },
    "doc-snippet-check-false": {
        suites: [`${F}doc-snippets-check-false.html`],
        expect: FAIL("check is not true: text('#out') === 'Grace'")
    },
    "doc-snippet-async-error": {
        suites: [`${F}doc-snippets-async-error.html`],
        expect: FAIL("the snippet threw: fixture: late failure")
    },

    // Acceptance specs (tests/acceptance/): a failing spec, a missing page, a console error
    // and a missing page of a spec that is no longer pending must each fail the run.
    "control-acceptance": {
        suites: [`${F}pass.html`],
        acceptance: [{ spec: `${F}acceptance-pass.spec.js`, pending: false }],
        expect: PASS
    },
    "control-acceptance-pending-not-run": {
        suites: [`${F}pass.html`],
        acceptance: [{ spec: `${F}acceptance-missing.spec.js`, pending: true }],
        expect: PASS
    },
    "acceptance-assertion-fails": {
        suites: [`${F}pass.html`],
        acceptance: [{ spec: `${F}acceptance-fail.spec.js`, pending: false }],
        expect: FAIL(`FAILED  ${F}acceptance-page.html#click-increments [stitch.js]: text of [data-testid="count"]`)
    },
    "acceptance-console-error": {
        suites: [`${F}pass.html`],
        acceptance: [{ spec: `${F}acceptance-console.spec.js`, pending: false }],
        expect: FAIL("console error: fixture: logged during an acceptance test")
    },
    "acceptance-page-missing": {
        suites: [`${F}pass.html`],
        acceptance: [{ spec: `${F}acceptance-missing.spec.js`, pending: false }],
        expect: FAIL(`acceptance page does not exist: ${F}no-such-acceptance-page.html`)
    }
};

function write(dir, files) {
    for (const [rel, content] of Object.entries(files)) {
        const file = path.join(dir, rel);
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, content);
    }
}

const PKG = JSON.stringify({ name: "fixture", version: "9.8.7", scripts: { build: "echo build" } }, null, 2);
const DRIVE = "C" + ":";
const OLD = "v" + "1.0.0";
const CONSOLE = "con" + "sole";
const BUILD_TREE = ["package.json", "stitch.entry.js", "packages", "stitch.js", "stitch.min.js", "dist"];

const staticFixtures = {
    "version-literal-control": {
        check: "version-literal",
        create: (dir) => write(dir, { "package.json": PKG, "lib.js": "const { VERSION } = require('./version');\n" }),
        expect: PASS
    },
    "version-literal": {
        check: "version-literal",
        create: (dir) => write(dir, { "package.json": PKG, "lib.js": "const VERSION = \"9.8.7\";\n" }),
        expect: FAIL('lib.js:1: version literal "9.8.7"')
    },
    "version-literal-workspace": {
        check: "version-literal",
        create: (dir) => write(dir, { "package.json": PKG, "packages/core/package.json": "{ \"name\": \"core\", \"version\": \"9.8.7\" }\n" }),
        expect: FAIL("packages/core/package.json:1: version literal")
    },
    "stale-version-control": {
        check: "stale-version",
        create: (dir) => write(dir, {
            "package.json": PKG,
            // Bare triplets are not Stitch versions; archived history docs may name old versions,
            // and so may the history section at the end of MIGRATION.md.
            "notes.md": "Uses jquery-3.6.0.min.js on 127.0.0.1; devDependency ^1.58.2.\n",
            "docs/history/old.md": "Upgrading from " + OLD + " is described here.\n",
            "MIGRATION.md": "# Migration\n\nCurrent guide.\n\n<!-- history: older guides -->\n\nUpgrading from " + OLD + " is described here.\n"
        }),
        expect: PASS
    },
    "stale-version-above-history": {
        check: "stale-version",
        create: (dir) => write(dir, {
            "package.json": PKG,
            "MIGRATION.md": "# Migration\n\nUpgrading from " + OLD + " is described here.\n\n<!-- history: older guides -->\n"
        }),
        expect: FAIL('MIGRATION.md:3: stale version "' + OLD + '"')
    },
    "stale-version-no-history-marker": {
        check: "stale-version",
        create: (dir) => write(dir, { "package.json": PKG, "MIGRATION.md": "# Migration\n\nUpgrading from " + OLD + " is described here.\n" }),
        expect: FAIL('MIGRATION.md:3: stale version "' + OLD + '"')
    },
    "stale-version": {
        check: "stale-version",
        create: (dir) => write(dir, { "package.json": PKG, "example.html": "<title>Demo - Stitch.js " + OLD + "</title>\n" }),
        expect: FAIL('example.html:1: stale version "' + OLD + '"')
    },
    "stale-version-word": {
        check: "stale-version",
        create: (dir) => write(dir, { "package.json": PKG, "README.md": "Version " + "2.0.1 is current.\n" }),
        expect: FAIL('README.md:1: stale version "Version ' + "2.0.1\"")
    },
    "local-path-control": {
        check: "local-path",
        create: (dir) => write(dir, { "package.json": PKG, "notes.md": "Paths are relative: `packages/core/index.js`.\n" }),
        expect: PASS
    },
    "local-path-windows": {
        check: "local-path",
        create: (dir) => write(dir, { "package.json": PKG, "notes.md": `Built in ${DRIVE}\\Users\\someone\\project\n` }),
        expect: FAIL("notes.md:1: Windows drive path")
    },
    "local-path-windows-json": {
        check: "local-path",
        create: (dir) => write(dir, { "package.json": PKG, "manifest.json": JSON.stringify({ sourceRoot: `${DRIVE}\\Projects\\Thing` }) }),
        expect: FAIL("manifest.json:1: Windows drive path")
    },
    "local-path-home": {
        check: "local-path",
        create: (dir) => write(dir, { "package.json": PKG, "notes.md": "see /" + "home/someone/project\n" }),
        expect: FAIL("notes.md:1: Linux home path")
    },
    "local-path-mac": {
        check: "local-path",
        create: (dir) => write(dir, { "package.json": PKG, "notes.md": "see /" + "Users/someone/project\n" }),
        expect: FAIL("notes.md:1: macOS home path")
    },
    "missing-reference-control": {
        check: "missing-reference",
        create: (dir) => write(dir, {
            "package.json": PKG,
            "docs/guide.md": "# Guide\n",
            "README.md": "See [the guide](./docs/guide.md), `docs/guide.md` and run `npm run build`.\n",
            "page.html": "<script src=\"docs/app.js\"></script>\n",
            "docs/app.js": "\n"
        }),
        expect: PASS
    },
    "missing-reference-link": {
        check: "missing-reference",
        create: (dir) => write(dir, { "package.json": PKG, "README.md": "See [the guide](./docs/missing-guide.md).\n" }),
        expect: FAIL('README.md:1: link points to missing file "./docs/missing-guide.md"')
    },
    "missing-reference-code-span": {
        check: "missing-reference",
        create: (dir) => write(dir, { "package.json": PKG, "README.md": "Findings live in `CODE_REVIEW_FINDINGS.md`.\n" }),
        expect: FAIL('README.md:1: code span points to missing file "CODE_REVIEW_FINDINGS.md"')
    },
    "missing-reference-npm-script": {
        check: "missing-reference",
        create: (dir) => write(dir, { "package.json": PKG, "README.md": "Run `npm run build:stitch`.\n" }),
        expect: FAIL('"npm run build:stitch" but package.json has no such script')
    },
    "missing-reference-html": {
        check: "missing-reference",
        create: (dir) => write(dir, { "package.json": PKG, "page.html": "<script src=\"lib/missing.js\"></script>\n" }),
        expect: FAIL('page.html:1: attribute points to missing file "lib/missing.js"')
    },
    "no-console-control": {
        check: "no-console",
        create: (dir) => write(dir, {
            "package.json": PKG,
            // Comments may show console use; code outside packages/ may log.
            "packages/core/src/a.js": "/**\n * @example\n * " + CONSOLE + ".log(model.total);\n */\nfunction a() { throw new Error('x'); } // not " + CONSOLE + ".log(a)\n",
            "tools/script.js": CONSOLE + ".log('fine outside the library');\n"
        }),
        expect: PASS
    },
    "no-console-warn": {
        check: "no-console",
        create: (dir) => write(dir, { "package.json": PKG, "packages/core/src/a.js": "function a() {\n    " + CONSOLE + ".warn('swallowed');\n}\n" }),
        expect: FAIL("packages/core/src/a.js:2: " + CONSOLE + ".warn/error in the library")
    },
    "no-console-error-in-comment": {
        check: "no-console",
        create: (dir) => write(dir, { "package.json": PKG, "packages/core/src/a.js": "// " + CONSOLE + ".error(e) here\n" }),
        expect: FAIL("packages/core/src/a.js:1: " + CONSOLE + ".warn/error in the library")
    },
    "no-console-log": {
        check: "no-console",
        create: (dir) => write(dir, { "package.json": PKG, "packages/utils/index.js": "const x = 1; " + CONSOLE + ".log('debug on');\n" }),
        expect: FAIL("packages/utils/index.js:1: console call in the library")
    },
    "no-random-ids-control": {
        check: "no-random-ids",
        create: (dir) => write(dir, { "package.json": PKG, "packages/core/src/a.js": "let next = 0;\nconst id = ++next;\n" }),
        expect: PASS
    },
    "no-random-ids": {
        check: "no-random-ids",
        create: (dir) => write(dir, { "package.json": PKG, "packages/core/src/a.js": "const id = Math." + "random().toString(36).substr(2, 9);\n" }),
        expect: FAIL("packages/core/src/a.js:1: Math.random in the library")
    },
    "bundle-require-control": {
        check: "bundle-require",
        create: (dir) => write(dir, { "package.json": PKG, "stitch.js": "var m = __stitchRequire(0); x.require(1);\n", "stitch.min.js": "var m=a(0);\n" }),
        expect: PASS
    },
    "bundle-require": {
        check: "bundle-require",
        create: (dir) => write(dir, { "package.json": PKG, "stitch.js": "var ok = 1;\nvar m = (function(){ try { return re" + "quire(\"./packages/x\"); } catch (e) {} })();\n", "stitch.min.js": "var m=1;\n" }),
        expect: FAIL("stitch.js:2: require() in the bundle")
    },
    "build-match-control": {
        check: "build-match",
        create: (dir, { copyTree }) => BUILD_TREE.forEach((rel) => copyTree(rel, dir)),
        expect: PASS
    },
    "build-match-stale-min": {
        check: "build-match",
        create: (dir, { copyTree }) => {
            BUILD_TREE.forEach((rel) => copyTree(rel, dir));
            fs.appendFileSync(path.join(dir, "stitch.min.js"), "\n;window.__tampered=1;\n");
        },
        expect: FAIL("stitch.min.js differs from a fresh minification")
    },
    "build-match-stale-bundle": {
        check: "build-match",
        create: (dir, { copyTree }) => {
            BUILD_TREE.forEach((rel) => copyTree(rel, dir));
            fs.appendFileSync(path.join(dir, "packages/core/src/reactive-system.js"), "\n// changed without rebuilding\n");
        },
        expect: FAIL("stitch.js differs from a fresh assembly of packages/*")
    },

    // doc-snippets: every html/js block in the docs has a mode, and every doc with such
    // blocks is executed (DOC_SET in tests/doc-snippets.js).
    "doc-snippets-control": {
        check: "doc-snippets",
        create: (dir) => write(dir, Object.assign({ "package.json": PKG }, docSetFiles({
            "README.md": "# Readme\n\n```html run\n<p>hi</p>\n```\n\n```bash\nnpm test\n```\n",
            "MIGRATION.md": "# Migration\n\n```js run\nvar a = 1;\n```\n\n<!-- history: old -->\n\n```javascript\nmodel.on(fn);\n```\n",
            "docs/history/old.md": "```js\nold();\n```\n"
        }))),
        expect: PASS
    },
    "doc-snippets-untagged": {
        check: "doc-snippets",
        create: (dir) => write(dir, Object.assign({ "package.json": PKG }, docSetFiles({ "README.md": "# Readme\n\n```js\nvar a = 1;\n```\n" }))),
        expect: FAIL("README.md:3: ```js block needs a mode after the language")
    },
    "doc-snippets-not-in-doc-set": {
        check: "doc-snippets",
        create: (dir) => write(dir, Object.assign({ "package.json": PKG }, docSetFiles({ "docs/EXTRA.md": "```html run\n<p>hi</p>\n```\n" }))),
        expect: FAIL("docs/EXTRA.md: has html/js code blocks but is not in DOC_SET")
    },
    "doc-snippets-throws-without-message": {
        check: "doc-snippets",
        create: (dir) => write(dir, Object.assign({ "package.json": PKG }, docSetFiles({ "README.md": "# Readme\n\n```js throws\nx();\n```\n\nIt fails.\n" }))),
        expect: FAIL("README.md:3: a throws block must be followed by a line")
    },
    "doc-snippets-indented": {
        check: "doc-snippets",
        create: (dir) => write(dir, Object.assign({ "package.json": PKG }, docSetFiles({ "README.md": "# Readme\n\n1. Step\n   ```js run\n   var a = 1;\n   ```\n" }))),
        expect: FAIL("README.md:4: an html/js code block must start at column 0")
    },
    "doc-snippets-history-elsewhere": {
        check: "doc-snippets",
        create: (dir) => write(dir, Object.assign({ "package.json": PKG }, docSetFiles({ "README.md": "# Readme\n\n<!-- history: hide -->\n\n```js\nx();\n```\n" }))),
        expect: FAIL("README.md:3: a history marker is only allowed in MIGRATION.md")
    },

    // api-coverage: docs/API.md and the code name the same public API, both ways.
    "api-coverage-control": {
        check: "api-coverage",
        create: (dir, { copyTree }) => API_TREE.forEach((rel) => copyTree(rel, dir)),
        expect: PASS
    },
    "api-coverage-undocumented-export": {
        check: "api-coverage",
        create: (dir, { copyTree }) => {
            API_TREE.forEach((rel) => copyTree(rel, dir));
            fs.appendFileSync(path.join(dir, "stitch.js"), "\nmodule.exports.undocumentedExport = function () {};\n");
        },
        expect: FAIL("Stitch.undocumentedExport exists in the code but has no heading")
    },
    "api-coverage-documents-missing-api": {
        check: "api-coverage",
        create: (dir, { copyTree }) => {
            API_TREE.forEach((rel) => copyTree(rel, dir));
            fs.appendFileSync(path.join(dir, "docs/API.md"), "\n### `Stitch.Observable.freeze(model)`\n\nFreezes a model.\n");
        },
        expect: FAIL("names Stitch.Observable.freeze, which does not exist in the code")
    },
    "api-coverage-guide-names-missing-api": {
        check: "api-coverage",
        create: (dir, { copyTree }) => {
            API_TREE.forEach((rel) => copyTree(rel, dir));
            fs.appendFileSync(path.join(dir, "docs/GUIDE.md"), "\nTurn on logging with `Stitch.debug.enable()`.\n");
        },
        expect: FAIL("names Stitch.debug.enable, which is not part of the API")
    },

    // error-coverage: docs/ERRORS.md and packages/ name the same error messages, both ways.
    "error-coverage-control": {
        check: "error-coverage",
        create: (dir, { copyTree }) => API_TREE.forEach((rel) => copyTree(rel, dir)),
        expect: PASS
    },
    "error-coverage-undocumented-error": {
        check: "error-coverage",
        create: (dir, { copyTree }) => {
            API_TREE.forEach((rel) => copyTree(rel, dir));
            fs.appendFileSync(path.join(dir, "packages/core/src/batch-scheduler.js"),
                "\nfunction fixture() { throw new Error(`[Stitch.js v${VERSION}] a brand new mistake nobody documented`); }\n");
        },
        expect: FAIL("error message not in docs/ERRORS.md (add **Message:** `a brand new mistake nobody documented`)")
    },
    "error-coverage-documents-missing-error": {
        check: "error-coverage",
        create: (dir, { copyTree }) => {
            API_TREE.forEach((rel) => copyTree(rel, dir));
            fs.appendFileSync(path.join(dir, "docs/ERRORS.md"),
                "\n### A mistake the code never reports\n\n**Message:** `a message no code throws`\n\n**Cause:** none.\n\n**Fix:** none.\n");
        },
        expect: FAIL("no error in packages/ has this message: a message no code throws")
    },
    "error-coverage-entry-without-fix": {
        check: "error-coverage",
        create: (dir, { copyTree }) => {
            API_TREE.forEach((rel) => copyTree(rel, dir));
            const file = path.join(dir, "docs/ERRORS.md");
            fs.writeFileSync(file, fs.readFileSync(file, "utf8").replace(/^\*\*Fix:\*\*.*$/m, "(fix removed)"));
        },
        expect: FAIL("needs a **Cause:** line and a **Fix:** line")
    },
    "error-coverage-unreadable-message": {
        check: "error-coverage",
        create: (dir, { copyTree }) => {
            API_TREE.forEach((rel) => copyTree(rel, dir));
            fs.appendFileSync(path.join(dir, "packages/core/src/batch-scheduler.js"),
                "\nfunction fixture(text) { throw new Error(text); }\n");
        },
        expect: FAIL("cannot read the message of this error")
    },

    // doc-hygiene: public docs state rules, not private history.
    "doc-hygiene-control": {
        check: "doc-hygiene",
        create: (dir) => write(dir, { "package.json": PKG, "README.md": "Keys are required.\n", "docs/history/old.md": "Decided in " + "D" + "12.\n" }),
        expect: PASS
    },
    "doc-hygiene-decision-number": {
        check: "doc-hygiene",
        create: (dir) => write(dir, { "package.json": PKG, "docs/GUIDE.md": "Keys are required (" + "D" + "10).\n" }),
        expect: FAIL('docs/GUIDE.md:1: "' + "D" + '10" is a decision number')
    }
};

// A tree in which every DOC_SET file exists (empty), plus the given files.
function docSetFiles(files) {
    const out = {};
    for (const rel of require("../doc-snippets.js").DOC_SET) out[rel] = "# " + rel + "\n";
    return Object.assign(out, files);
}

// What api-coverage and error-coverage read: the bundle, the packages and the docs.
const API_TREE = BUILD_TREE.concat(["docs/API.md", "docs/ERRORS.md", "docs/GUIDE.md", "README.md", "AGENTS.md"]);

module.exports = { browser, static: staticFixtures };
