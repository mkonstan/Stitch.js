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
    "listed-example-missing": { suites: [`${F}pass.html`], examples: [`${F}example-does-not-exist.html`], expect: FAIL("listed example does not exist") }
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
            // Bare triplets are not Stitch versions; archived history docs may name old versions.
            "notes.md": "Uses jquery-3.6.0.min.js on 127.0.0.1; devDependency ^1.58.2.\n",
            "MIGRATION.md": "Upgrading from " + OLD + " is described here.\n"
        }),
        expect: PASS
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
    }
};

module.exports = { browser, static: staticFixtures };
