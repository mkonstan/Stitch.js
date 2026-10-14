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
        knownFailing: { [`${F}fail.html#broken`]: { defect: 99, sprint: "T9" } },
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
        knownFailing: { [`${F}pass.html#ok`]: { defect: 99, sprint: "T9" } },
        expect: FAIL("Remove it from known-failing")
    },
    "known-failing-stale": {
        suites: [`${F}pass.html`],
        knownFailing: { [`${F}pass.html#no-such-test`]: { defect: 99, sprint: "T9" } },
        expect: FAIL("matches no test that ran")
    },
    "page-missing-from-list": {
        suites: [`${F}pass.html`],
        discoverDir: `${F}orphan/`,
        expect: FAIL(`test page not in tests/suites.js: ${F}orphan/test-orphan.html`)
    },
    "listed-page-missing": { suites: [`${F}does-not-exist.html`], expect: FAIL("listed page does not exist") }
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
    }
};

module.exports = { browser, static: staticFixtures };
