"use strict";

/*
 * `npm test`: the one test entry point.
 *
 *   1. Static checks (_tools/check-repo.js): version literal, local paths,
 *      missing references, build-match (stitch.js and stitch.min.js equal a
 *      fresh build of packages/*).
 *   2. Every page in tests/suites.js, in three browser engines (Playwright
 *      Chromium, Firefox and WebKit), against stitch.js AND stitch.min.js. The
 *      page's own <script src="stitch.js"> is answered with the build under test.
 *      Pages report through tests/harness.js. A page listed with csp: true is
 *      served with the strict Content-Security-Policy header (STRICT_CSP); any
 *      policy violation on any page is a page problem.
 *   3. Acceptance specs (tests/acceptance/*.spec.js) listed in tests/suites.js and
 *      not pending, on both builds: Playwright drives the spec's page like a user.
 *   4. Gate self-tests: each fixture in tests/gate-fixtures/fixtures.js is a way
 *      a broken suite could look green; the runner is re-run on it and must exit
 *      non-zero for the stated reason (controls must exit 0).
 *
 * Exit 0 only when: static checks pass; every listed page exists, finishes, and
 * reports a non-empty plan with one result per planned test; no page logs an
 * uncaught error or console error, fails a request or violates its Content
 * Security Policy; failed = 0 and skipped = 0 on every engine and both builds;
 * every tests/known-failing.json entry names a real test that FAILED on every
 * engine and both builds; no test page is missing from the list; and every
 * self-test behaves as expected.
 *
 * Usage:
 *   node _tools/run-tests.js                  full run (what CI and `npm test` do)
 *   node _tools/run-tests.js --fixture <name> run one gate fixture (used by the self-tests)
 *   node _tools/run-tests.js --acceptance     run every acceptance spec, pending or not, on
 *                                             both builds (npm run test:acceptance)
 * The JSON report goes to _scratch/test-report.json (gitignored).
 */

const fs = require("fs");
const path = require("path");
const http = require("http");
const { spawn } = require("child_process");
const { runChecks, printResults, listFiles } = require("./check-repo");

const ROOT = path.resolve(__dirname, "..");
const SUITES_FILE = "tests/suites.js";
const KNOWN_FAILING_FILE = "tests/known-failing.json";
const FIXTURES_FILE = "tests/gate-fixtures/fixtures.js";
const FIXTURE_DIR = "tests/gate-fixtures/";
const REPORT_FILE = "_scratch/test-report.json";
const BUILDS = ["stitch.js", "stitch.min.js"];
// Every supported browser family has its engine here: Chrome and Edge (Chromium), Firefox,
// Safari (WebKit). A failure on any engine fails the run.
const ENGINES = ["chromium", "firefox", "webkit"];
// The policy a csp: true suite page is served with: no inline script or style, no eval, no
// plugins, no <base>, and Trusted Types required for every script-bearing DOM sink.
const STRICT_CSP = "default-src 'self'; script-src 'self'; style-src 'self'; " +
    "require-trusted-types-for 'script'; object-src 'none'; base-uri 'none'";
const PAGE_TIMEOUT_MS = 20000;
const MAX_PAGE_TIMEOUT_MS = 60000;
const ACCEPTANCE_TEST_TIMEOUT_MS = 15000;
const ACCEPTANCE_HELPERS = "tests/acceptance/helpers.js";
// Only acceptance specs (whose pages are written later, by the fresh-agent gate) may be pending.
const PENDING_DIR = "tests/acceptance/";
const SETTLE_MS = 300;
const SELF_TEST_CONCURRENCY = 4;
const LIBRARY_PATH = /^\/(?:.*\/)?stitch(?:\.min)?\.js$/;
// The public window.Stitch surface. Changing it is a deliberate API change: update here.
const PUBLIC_EXPORTS = ["DataBinder", "MessageBus", "Observable", "computed", "debug", "onBindReport", "onError", "version"];

const PKG = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));

// ---------------------------------------------------------------------------
// Configuration

function mainConfig() {
    const lists = require(path.join(ROOT, SUITES_FILE));
    return {
        name: "main",
        suites: loadSuites(lists.suites),
        examples: loadExamples(lists.examples),
        acceptance: loadAcceptance(lists.acceptance || [], PENDING_DIR, SUITES_FILE),
        runPendingAcceptance: false,
        knownFailing: loadKnownFailing(path.join(ROOT, KNOWN_FAILING_FILE)),
        knownFailingLabel: KNOWN_FAILING_FILE,
        discoverDir: "",
        excludeDirs: [FIXTURE_DIR],
        engines: ENGINES,
        builds: BUILDS,
        pageTimeoutMs: PAGE_TIMEOUT_MS,
        staticChecks: true,
        selfTests: true
    };
}

function fixtureConfig(name) {
    const fixtures = require(path.join(ROOT, FIXTURES_FILE)).browser;
    const fixture = fixtures[name];
    if (!fixture) throw new Error(`unknown fixture "${name}" (see ${FIXTURES_FILE})`);
    return {
        name: `fixture:${name}`,
        suites: loadSuites(fixture.suites.map((page) => (typeof page === "string" ? { page } : page))),
        examples: loadExamples(fixture.examples || []),
        acceptance: loadAcceptance(fixture.acceptance || [], fixture.pendingDir || PENDING_DIR, `${FIXTURES_FILE}#${name}`),
        runPendingAcceptance: false,
        knownFailing: validateKnownFailing(fixture.knownFailing || {}, `${FIXTURES_FILE}#${name}`),
        knownFailingLabel: `${FIXTURES_FILE}#${name}`,
        discoverDir: fixture.discoverDir || null,
        excludeDirs: [],
        // Fixtures test the gate, not the library: one engine, unless the fixture is about
        // what each engine enforces (the CSP fixtures run on every engine).
        engines: fixture.engines || ["chromium"],
        builds: ["stitch.js"],
        pageTimeoutMs: fixture.pageTimeoutMs || PAGE_TIMEOUT_MS,
        staticChecks: false,
        selfTests: false
    };
}

/** `npm run test:acceptance`: every acceptance spec, pending or not, on both builds. */
function acceptanceConfig() {
    const lists = require(path.join(ROOT, SUITES_FILE));
    const acceptance = loadAcceptance(lists.acceptance || [], PENDING_DIR, SUITES_FILE);
    if (acceptance.length === 0) throw new Error(`${SUITES_FILE} lists no acceptance specs`);
    return {
        name: "acceptance",
        suites: [],
        examples: [],
        acceptance,
        runPendingAcceptance: true,
        knownFailing: loadKnownFailing(path.join(ROOT, KNOWN_FAILING_FILE)),
        knownFailingLabel: KNOWN_FAILING_FILE,
        discoverDir: null,
        excludeDirs: [],
        engines: ENGINES,
        builds: BUILDS,
        pageTimeoutMs: PAGE_TIMEOUT_MS,
        staticChecks: false,
        selfTests: false
    };
}

/**
 * Acceptance entries: { spec, pending }. The spec module names its page. pending is false (the
 * spec runs in npm test) or { reason, sprint }: why it cannot run yet and the sprint that will
 * make it run. Like a known-failing entry, a pending entry is guarded: only specs under
 * pendingDir may be pending, and one whose page exists fails the suite list (it must run).
 */
function loadAcceptance(list, pendingDir, label) {
    if (!Array.isArray(list)) throw new Error(`${label}: "acceptance" must be an array`);
    const seen = new Set();
    return list.map((entry) => {
        if (!entry || typeof entry.spec !== "string") throw new Error(`${label}: acceptance entry without a spec: ${JSON.stringify(entry)}`);
        const spec = entry.spec.replace(/\\/g, "/");
        if (seen.has(spec)) throw new Error(`${label}: acceptance spec listed twice: ${spec}`);
        seen.add(spec);
        const pending = entry.pending;
        if (pending === false) return { spec, pending: false };
        if (!pending || typeof pending !== "object" || Array.isArray(pending)) {
            throw new Error(`${label}: acceptance entry ${spec} needs "pending": false, or { reason, sprint } saying why it cannot run yet`);
        }
        if (typeof pending.reason !== "string" || pending.reason.trim().split(/\s+/).length < 4) {
            throw new Error(`${label}: acceptance entry ${spec} is pending without a reason (pending.reason: at least 4 words)`);
        }
        if (typeof pending.sprint !== "string" || !/^T\d+$/.test(pending.sprint)) {
            throw new Error(`${label}: acceptance entry ${spec} needs pending.sprint like "T3": the sprint that makes it run`);
        }
        if (!spec.startsWith(pendingDir)) {
            throw new Error(`${label}: ${spec} may not be pending: only acceptance specs under ${pendingDir} (whose pages are not written yet) may be`);
        }
        return { spec, pending: { reason: pending.reason, sprint: pending.sprint } };
    });
}

/** Loads an acceptance spec module: { page, tests: { id: async ({ page, ui }) => {} } }. */
function loadSpec(rel) {
    const file = path.join(ROOT, rel);
    delete require.cache[require.resolve(file)];
    const spec = require(file);
    if (!spec || typeof spec.page !== "string" || !spec.tests || typeof spec.tests !== "object" || Object.keys(spec.tests).length === 0) {
        throw new Error(`${rel} must export { page: "<path>", tests: { id: async ({ page, ui }) => {...} } } with at least one test`);
    }
    return spec;
}

function loadSuites(list) {
    if (!Array.isArray(list) || list.length === 0) {
        throw new Error(`${SUITES_FILE} must export a non-empty array`);
    }
    const seen = new Set();
    return list.map((entry) => {
        if (!entry || typeof entry.page !== "string") throw new Error(`suite entry without a page: ${JSON.stringify(entry)}`);
        if (seen.has(entry.page)) throw new Error(`suite listed twice: ${entry.page}`);
        seen.add(entry.page);
        if (entry.csp !== undefined && typeof entry.csp !== "boolean") throw new Error(`suite ${entry.page}: "csp" must be true or false`);
        // A page that runs many frames (the executable docs) may need longer than the default;
        // the override is explicit, bounded and per page.
        if (entry.timeoutMs !== undefined && !(Number.isInteger(entry.timeoutMs) && entry.timeoutMs > PAGE_TIMEOUT_MS && entry.timeoutMs <= MAX_PAGE_TIMEOUT_MS)) {
            throw new Error(`suite ${entry.page}: "timeoutMs" must be an integer above ${PAGE_TIMEOUT_MS} and at most ${MAX_PAGE_TIMEOUT_MS}`);
        }
        return { page: entry.page.replace(/\\/g, "/"), csp: entry.csp === true, timeoutMs: entry.timeoutMs || null };
    });
}

function loadExamples(list) {
    if (!Array.isArray(list) || list.some((page) => typeof page !== "string")) {
        throw new Error(`${SUITES_FILE} must export an "examples" array of page paths`);
    }
    if (new Set(list).size !== list.length) throw new Error(`${SUITES_FILE}: an example is listed twice`);
    return list.map((page) => page.replace(/\\/g, "/"));
}

function loadKnownFailing(file) {
    const data = JSON.parse(fs.readFileSync(file, "utf8"));
    if (!data || typeof data.tests !== "object") throw new Error(`${KNOWN_FAILING_FILE} needs a "tests" object`);
    return validateKnownFailing(data.tests, KNOWN_FAILING_FILE);
}

function validateKnownFailing(tests, label) {
    for (const [id, entry] of Object.entries(tests)) {
        if (!/^[^#]+\.html#.+$/.test(id)) throw new Error(`${label}: "${id}" is not "<page>.html#<test id>"`);
        if (!entry || !Number.isInteger(entry.defect)) throw new Error(`${label}: "${id}" needs an integer "defect"`);
        if (typeof entry.sprint !== "string" || !/^T\d+$/.test(entry.sprint)) throw new Error(`${label}: "${id}" needs "sprint" like "T1"`);
        if (!Array.isArray(entry.expect) || entry.expect.length === 0 ||
            !entry.expect.every((prefix) => typeof prefix === "string" && prefix.trim() !== "")) {
            throw new Error(`${label}: "${id}" needs "expect": the failed-assertion messages (prefixes) it must fail with`);
        }
        for (const prefix of entry.expect) {
            const why = tooBroad(prefix);
            if (why) throw new Error(`${label}: "${id}" expect prefix ${JSON.stringify(prefix)} is too broad: ${why}`);
        }
    }
    return tests;
}

// An expect prefix must name ONE specific assertion. These rules stop a prefix
// from legitimising unrelated failures (any throw, any precondition, ...).
const EXPECT_MIN_CHARS = 15;
const EXPECT_MIN_WORDS = 3;
// Failure lines that are never a defect's own assertion: a throw, the harness's
// own messages, and the precondition/control assertions every defect test uses.
const EXPECT_FORBIDDEN_STARTS = ["threw", "the test made no assertions", "assertion after", "harness", "precondition", "control"];

function tooBroad(prefix) {
    const text = prefix.trim();
    if (text !== prefix) return "leading or trailing whitespace";
    if (text.length < EXPECT_MIN_CHARS) return `shorter than ${EXPECT_MIN_CHARS} characters`;
    if (text.split(/\s+/).length < EXPECT_MIN_WORDS) return `fewer than ${EXPECT_MIN_WORDS} words`;
    const lower = text.toLowerCase();
    const forbidden = EXPECT_FORBIDDEN_STARTS.find((start) => lower.startsWith(start));
    if (forbidden) return `it starts with "${forbidden}", which names no defect assertion`;
    return null;
}

/** prefix matches line at a word boundary: the next character is not a letter or digit. */
function prefixMatches(prefix, line) {
    if (!line.startsWith(prefix)) return false;
    const next = line.charAt(prefix.length);
    return next === "" || !/[A-Za-z0-9_]/.test(next);
}

// ---------------------------------------------------------------------------
// Suite-list integrity: every listed page exists; every test page is listed.

function isTestPage(rel) {
    if (!rel.endsWith(".html")) return false;
    const base = path.posix.basename(rel);
    if (/^test-.+\.html$/.test(base) || /-test\.html$/.test(base)) return true;
    return /tests\/harness\.js|["']harness\.js["']/.test(fs.readFileSync(path.join(ROOT, rel), "utf8"));
}

function isExamplePage(rel) {
    return /^example[^/]*\.html$/.test(path.posix.basename(rel));
}

function checkSuiteList(config) {
    const problems = [];
    for (const { page } of config.suites) {
        if (!fs.existsSync(path.join(ROOT, page))) problems.push(`listed page does not exist: ${page}`);
    }
    for (const page of config.examples) {
        if (!fs.existsSync(path.join(ROOT, page))) problems.push(`listed example does not exist: ${page}`);
    }
    for (const entry of config.acceptance) {
        if (!fs.existsSync(path.join(ROOT, entry.spec))) {
            problems.push(`listed acceptance spec does not exist: ${entry.spec}`);
            continue;
        }
        let spec;
        try {
            spec = loadSpec(entry.spec);
        } catch (error) {
            problems.push(`acceptance spec ${entry.spec}: ${error.message}`);
            continue;
        }
        // A pending spec's page is written later (the fresh-agent gate); a running one must exist.
        const pageExists = fs.existsSync(path.join(ROOT, spec.page));
        if (!entry.pending && !pageExists) {
            problems.push(`acceptance page does not exist: ${spec.page} (${entry.spec} is not pending)`);
        }
        // The flip guard: once the page exists the spec must run (mirror of a FLIPPED known-failing).
        if (entry.pending && pageExists && !config.runPendingAcceptance) {
            problems.push(`acceptance page exists: ${spec.page}. Remove pending from ${entry.spec} in ${SUITES_FILE} so it runs`);
        }
    }
    if (config.discoverDir !== null) {
        const listed = new Set(config.suites.map((s) => s.page));
        const files = listFiles(ROOT).filter((rel) =>
            rel.startsWith(config.discoverDir) && !config.excludeDirs.some((dir) => rel.startsWith(dir)));
        for (const rel of files.filter(isTestPage)) {
            if (!listed.has(rel)) problems.push(`test page not in ${SUITES_FILE}: ${rel} (add it to the list)`);
        }
        const examples = new Set(config.examples);
        for (const rel of files.filter(isExamplePage)) {
            if (!examples.has(rel)) problems.push(`example page not in ${SUITES_FILE} examples: ${rel} (add it, so the examples smoke suite loads it)`);
        }
    }
    return problems;
}

// ---------------------------------------------------------------------------
// Static file server. /stitch.js and /stitch.min.js (at any depth) answer with
// the build under test, so every page runs the same bytes.

const CONTENT_TYPES = { ".html": "text/html; charset=utf-8", ".js": "application/javascript; charset=utf-8", ".json": "application/json", ".css": "text/css" };

function startServer() {
    // buildBytes: the build under test; cspPages: page paths served with STRICT_CSP.
    const state = { buildBytes: null, cspPages: new Set() };
    const server = http.createServer((req, res) => {
        const urlPath = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
        if (urlPath === "/favicon.ico") { res.writeHead(204); res.end(); return; }
        if (LIBRARY_PATH.test(urlPath) && state.buildBytes) {
            res.writeHead(200, { "Content-Type": CONTENT_TYPES[".js"], "Cache-Control": "no-store" });
            res.end(state.buildBytes);
            return;
        }
        const file = path.join(ROOT, urlPath);
        if (!file.startsWith(ROOT) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
            res.writeHead(404); res.end("not found"); return;
        }
        const headers = { "Content-Type": CONTENT_TYPES[path.extname(file)] || "application/octet-stream", "Cache-Control": "no-store" };
        if (state.cspPages.has(urlPath.replace(/^\//, ""))) headers["Content-Security-Policy"] = STRICT_CSP;
        res.writeHead(200, headers);
        res.end(fs.readFileSync(file));
    });
    return new Promise((resolve) => {
        server.listen(0, "127.0.0.1", () => {
            resolve({ state, server, baseUrl: `http://127.0.0.1:${server.address().port}` });
        });
    });
}

// ---------------------------------------------------------------------------
// Browser

async function launchBrowser(engine) {
    const playwright = require("playwright");
    // Chromium may fall back to an installed Chrome or Edge; Firefox and WebKit have no
    // fallback: an engine that cannot start fails the run (its coverage is never faked).
    const attempts = engine === "chromium"
        ? [
            { label: "playwright chromium", options: {} },
            { label: "installed Chrome (channel chrome)", options: { channel: "chrome" } },
            { label: "installed Edge (channel msedge)", options: { channel: "msedge" } }
        ]
        : [{ label: `playwright ${engine}`, options: {} }];
    const errors = [];
    for (const attempt of attempts) {
        try {
            const browser = await playwright[engine].launch({ headless: true, ...attempt.options });
            return { browser, label: `${attempt.label} ${browser.version()}` };
        } catch (error) {
            errors.push(`${attempt.label}: ${String(error.message || error).split("\n")[0]}`);
        }
    }
    throw new Error(`no ${engine} browser could be launched:\n  ${errors.join("\n  ")}\nRun: npx playwright install chromium firefox webkit`);
}

// Installed before any page script (Playwright init scripts are not subject to the page's
// policy): every Content-Security-Policy violation on any page is recorded, so the runner
// sees violations that happen before the harness loads, or that a browser does not log.
function recordViolations() {
    window.__stitchCspViolations = [];
    document.addEventListener("securitypolicyviolation", (event) => {
        window.__stitchCspViolations.push(`${event.effectiveDirective || event.violatedDirective} blocked ${event.blockedURI || "inline"}` +
            (event.sourceFile ? ` at ${event.sourceFile.replace(/^.*\//, "")}:${event.lineNumber}` : "") +
            (event.sample ? ` (${event.sample.slice(0, 60)})` : ""));
    }, true);
}

async function runPage(browser, baseUrl, page, timeoutMs, csp) {
    const context = await browser.newContext();
    await context.addInitScript(recordViolations);
    const tab = await context.newPage();
    const observed = { consoleErrors: [], pageErrors: [], failedRequests: [], libraryLoads: 0 };
    tab.on("console", (msg) => { if (msg.type() === "error") observed.consoleErrors.push(msg.text()); });
    tab.on("pageerror", (error) => observed.pageErrors.push(String(error && error.message || error)));
    tab.on("requestfailed", (req) => observed.failedRequests.push(`${req.url()} (${req.failure() && req.failure().errorText})`));
    tab.on("response", (res) => {
        const pathname = new URL(res.url()).pathname;
        if (res.status() >= 400) observed.failedRequests.push(`${res.status()} ${pathname}`);
        else if (LIBRARY_PATH.test(pathname)) observed.libraryLoads++;
    });

    let navigationError = null;
    let servedPolicy = null;
    try {
        const response = await tab.goto(`${baseUrl}/${page}`, { waitUntil: "load", timeout: timeoutMs });
        servedPolicy = response ? (response.headers()["content-security-policy"] || null) : null;
    } catch (error) {
        navigationError = String(error.message || error).split("\n")[0];
    }
    let finished = false;
    if (!navigationError) {
        try {
            await tab.waitForFunction(() => window.__stitchTestReport && window.__stitchTestReport.done === true, null, { timeout: timeoutMs });
            finished = true;
        } catch (_error) {
            finished = false;
        }
    }
    // Let anything still queued run, so a late result or late error is seen.
    await tab.waitForTimeout(SETTLE_MS);
    const snapshot = await tab.evaluate(() => ({
        report: window.__stitchTestReport ? JSON.parse(JSON.stringify(window.__stitchTestReport)) : null,
        version: window.Stitch ? window.Stitch.version : undefined,
        exports: window.Stitch ? Object.keys(window.Stitch).sort() : null,
        violations: window.__stitchCspViolations || null
    })).catch((error) => ({ report: null, version: undefined, violations: null, evalError: String(error.message || error) }));
    await context.close();
    return { page, csp, servedPolicy, navigationError, finished, ...observed, ...snapshot };
}

/** Turn one page run into per-test statuses plus page-level problems. */
// Chromium reports net::ERR_CONNECTION_FAILED when the TCP connect itself fails with an
// OS error it has no specific code for: the request never reaches the runner's server.
// Seen locally on Windows in about 1 run in 4 (a random page, a random resource, while
// the same server answered the page's other requests in the same moment); not
// reproduced by 320 page loads through an identical server outside `npm test`. It is
// not a page result, so it earns one re-run, announced on the console and in the report.
const CONNECT_FAILURE = /net::ERR_CONNECTION_FAILED/;
function connectionFailure(raw) {
    const failures = raw.failedRequests.concat(raw.navigationError ? [raw.navigationError] : []);
    const hit = failures.find((text) => CONNECT_FAILURE.test(text));
    return hit ? `connection-level failure before the server was reached (${hit})` : null;
}

function analysePage(raw, timeoutMs) {
    const problems = [];
    const tests = [];
    if (raw.navigationError) problems.push(`navigation failed: ${raw.navigationError}`);
    if (raw.csp && !raw.navigationError && raw.servedPolicy !== STRICT_CSP) {
        problems.push(`the page was not served under the strict Content-Security-Policy (got ${JSON.stringify(raw.servedPolicy)})`);
    }
    if (raw.violations === null && !raw.navigationError) problems.push("the policy-violation recorder did not run on this page");
    for (const violation of raw.violations || []) problems.push(`CSP violation: ${violation}`);
    for (const message of raw.pageErrors) problems.push(`uncaught page error: ${message}`);
    for (const message of raw.consoleErrors) problems.push(`console error: ${message}`);
    for (const message of raw.failedRequests) problems.push(`failed request: ${message}`);
    if (raw.libraryLoads === 0) problems.push("the page never loaded stitch.js, so it did not test the build under test");
    else {
        if (raw.version !== PKG.version) problems.push(`Stitch.version is ${JSON.stringify(raw.version)}, package.json says ${PKG.version}`);
        if (JSON.stringify(raw.exports) !== JSON.stringify(PUBLIC_EXPORTS)) {
            problems.push(`window.Stitch exports ${JSON.stringify(raw.exports)}, expected ${JSON.stringify(PUBLIC_EXPORTS)}`);
        }
    }

    const report = raw.report;
    if (!report) {
        problems.push("no harness report: tests/harness.js was not loaded, or the page died before loading it");
        return { page: raw.page, tests, problems };
    }
    if (!raw.finished) problems.push(`did not finish within ${timeoutMs} ms (a planned test never reported)`);
    for (const message of report.problems || []) problems.push(`harness: ${message}`);
    if (!Array.isArray(report.planned)) {
        problems.push("never called StitchTest.plan()");
        return { page: raw.page, tests, problems };
    }
    if (report.planned.length === 0) problems.push("zero tests: the page planned no tests");

    const byId = new Map();
    for (const result of report.results) {
        if (!report.planned.includes(result.id)) problems.push(`result "${result.id}" is not in its plan`);
        if (byId.has(result.id)) problems.push(`test "${result.id}" reported more than once`);
        else byId.set(result.id, result);
    }
    if (report.late && report.late.length) {
        problems.push(`result(s) reported after the page finished: ${report.late.map((r) => r.id).join(", ")}`);
    }
    for (const id of report.planned) {
        const result = byId.get(id);
        if (!result) tests.push({ id, status: "skip", detail: "planned but never reported" });
        else tests.push({ id, status: result.status, detail: result.detail });
    }
    return { page: raw.page, tests, problems };
}

function logRun(build, label, analysed) {
    const counts = analysed.tests.reduce((acc, t) => { acc[t.status] = (acc[t.status] || 0) + 1; return acc; }, {});
    console.log(`  [${build}] ${label}: ${analysed.tests.length} test(s), pass ${counts.pass || 0}, fail ${counts.fail || 0}, skip ${counts.skip || 0}${analysed.problems.length ? `, ${analysed.problems.length} page problem(s)` : ""}`);
}

// ---------------------------------------------------------------------------
// Acceptance specs: Playwright drives the spec's page like a user, one fresh page per test.
// A test fails on a failed assertion, a thrown error, a timeout, or anything the page does
// wrong while it runs (uncaught error, console error, failed request, the library not loaded
// or the wrong version). Results use the page path as their id prefix, like suite pages.

async function runAcceptance(browser, baseUrl, specRel) {
    const spec = loadSpec(specRel);
    const { createUi } = require(path.join(ROOT, ACCEPTANCE_HELPERS));
    const tests = [];
    for (const [id, fn] of Object.entries(spec.tests)) {
        const context = await browser.newContext();
        await context.addInitScript(recordViolations);
        const tab = await context.newPage();
        const observed = { consoleErrors: [], pageErrors: [], failedRequests: [], libraryLoads: 0 };
        tab.on("console", (msg) => { if (msg.type() === "error") observed.consoleErrors.push(msg.text()); });
        tab.on("pageerror", (error) => observed.pageErrors.push(String(error && error.message || error)));
        tab.on("requestfailed", (req) => observed.failedRequests.push(`${req.url()} (${req.failure() && req.failure().errorText})`));
        tab.on("response", (res) => {
            const pathname = new URL(res.url()).pathname;
            if (res.status() >= 400) observed.failedRequests.push(`${res.status()} ${pathname}`);
            else if (LIBRARY_PATH.test(pathname)) observed.libraryLoads++;
        });
        const failures = [];
        try {
            const response = await tab.goto(`${baseUrl}/${spec.page}`, { waitUntil: "load", timeout: PAGE_TIMEOUT_MS });
            if (!response || response.status() >= 400) {
                failures.push(`page not found: ${spec.page} (HTTP ${response ? response.status() : "no response"})`);
            } else {
                const version = await tab.evaluate(() => window.Stitch ? window.Stitch.version : undefined);
                if (observed.libraryLoads === 0 || version !== PKG.version) {
                    failures.push(`the page did not load the build under test (Stitch.version ${JSON.stringify(version)}, expected ${PKG.version})`);
                }
                let timer;
                const timeout = new Promise((_, reject) => {
                    timer = setTimeout(() => reject(new Error(`timed out after ${ACCEPTANCE_TEST_TIMEOUT_MS} ms`)), ACCEPTANCE_TEST_TIMEOUT_MS);
                });
                try {
                    await Promise.race([fn({ page: tab, ui: createUi(tab) }), timeout]);
                } finally {
                    clearTimeout(timer);
                }
                await tab.waitForTimeout(SETTLE_MS);
                const violations = await tab.evaluate(() => window.__stitchCspViolations || []);
                for (const violation of violations) failures.push(`CSP violation: ${violation}`);
            }
        } catch (error) {
            failures.push(String(error && error.message || error).split("\n").slice(0, 8).join(" | "));
        }
        for (const message of observed.pageErrors) failures.push(`uncaught page error: ${message}`);
        for (const message of observed.consoleErrors) failures.push(`console error: ${message}`);
        for (const message of observed.failedRequests) failures.push(`failed request: ${message}`);
        await context.close();
        tests.push({ id, status: failures.length ? "fail" : "pass", detail: failures.join("\n") });
    }
    return { page: spec.page, tests, problems: [] };
}

// ---------------------------------------------------------------------------
// Classification

/** Every engine x build pair a config runs, labelled "chromium stitch.js". */
function targetsOf(config) {
    const targets = [];
    for (const engine of config.engines) {
        for (const build of config.builds) targets.push({ engine, build, label: `${engine} ${build}` });
    }
    return targets;
}

function classify(config, runs) {
    const known = config.knownFailing;
    const summary = {};
    const fatal = [];
    const seenIds = new Set();

    for (const { label: build } of targetsOf(config)) {
        const counts = { passed: 0, knownFailing: 0, failed: 0, skipped: 0, flipped: 0, pageProblems: 0 };
        for (const run of runs[build]) {
            for (const problem of run.problems) {
                counts.pageProblems++;
                fatal.push(`PAGE    ${run.page} [${build}]: ${problem}`);
            }
            for (const test of run.tests) {
                const fullId = `${run.page}#${test.id}`;
                seenIds.add(fullId);
                const entry = known[fullId];
                if (test.status === "skip") {
                    counts.skipped++;
                    fatal.push(`SKIPPED ${fullId} [${build}]: ${firstLine(test.detail) || "skipped"}`);
                } else if (test.status === "pass" && entry) {
                    counts.flipped++;
                    fatal.push(`FLIPPED ${fullId} [${build}]: passed but listed in ${config.knownFailingLabel} (defect ${entry.defect}, ${entry.sprint}). Remove it from known-failing.`);
                } else if (test.status === "pass") {
                    counts.passed++;
                } else if (entry) {
                    const reason = wrongReason(entry, test.detail);
                    if (reason) {
                        counts.failed++;
                        fatal.push(`WRONG   ${fullId} [${build}]: listed in ${config.knownFailingLabel} (defect ${entry.defect}) but failed for a different reason: ${reason}`);
                    } else {
                        counts.knownFailing++;
                    }
                } else {
                    counts.failed++;
                    fatal.push(`FAILED  ${fullId} [${build}]: ${firstLine(test.detail) || "failed"}`);
                }
            }
        }
        summary[build] = counts;
    }
    for (const id of Object.keys(known)) {
        if (!seenIds.has(id)) fatal.push(`STALE   ${id}: listed in ${config.knownFailingLabel} but matches no test that ran (fix or remove the entry)`);
    }
    return { summary, fatal };
}

/**
 * A parked test must fail for its own reason. Each line of its failure detail
 * (one per failed assertion; "threw: ..." when it threw) must start with one of
 * the entry's expect prefixes, and each prefix must match at least one line.
 * Returns null when the failure is the expected one, else a description.
 */
function wrongReason(entry, detail) {
    const lines = String(detail || "").split("\n").map((line) => line.trim()).filter(Boolean);
    const unexpected = lines.filter((line) => !entry.expect.some((prefix) => prefixMatches(prefix, line)));
    const absent = entry.expect.filter((prefix) => !lines.some((line) => prefixMatches(prefix, line)));
    // One prefix per failed assertion: a prefix matching several lines is a catch-all.
    const shared = entry.expect
        .map((prefix) => ({ prefix, count: lines.filter((line) => prefixMatches(prefix, line)).length }))
        .filter((m) => m.count > 1);
    if (unexpected.length === 0 && absent.length === 0 && shared.length === 0) return null;
    const parts = [];
    if (shared.length) parts.push(`expect prefix matches several failure lines (one prefix per assertion): ${shared.map((m) => `${JSON.stringify(m.prefix)} x${m.count}`).join("; ")}`);
    if (unexpected.length) parts.push(`unexpected failure(s): ${unexpected.map((l) => JSON.stringify(l.slice(0, 160))).join("; ")}`);
    if (absent.length) parts.push(`expected failure(s) absent: ${absent.map((l) => JSON.stringify(l)).join("; ")}`);
    return parts.join(" | ");
}

function firstLine(text) {
    return String(text || "").split("\n").filter(Boolean).slice(0, 2).join(" | ");
}

function printSummary(config, summary) {
    const header = "engine build".padEnd(24) + "passed".padStart(8) + "known-failing".padStart(15) + "failed".padStart(8) + "skipped".padStart(9) + "flipped".padStart(9) + "page-problems".padStart(15);
    console.log(header);
    for (const { label: build } of targetsOf(config)) {
        const c = summary[build];
        console.log(build.padEnd(24) + String(c.passed).padStart(8) + String(c.knownFailing).padStart(15) + String(c.failed).padStart(8) +
            String(c.skipped).padStart(9) + String(c.flipped).padStart(9) + String(c.pageProblems).padStart(15));
    }
}

// ---------------------------------------------------------------------------
// One engine: launch it, run every build's pages and acceptance specs. Returns null, or why
// the engine could not run (which fails the run: no engine is ever skipped).

async function runEngine(config, engine, runs, report) {
    const started = Date.now();
    let launched;
    try {
        launched = await launchBrowser(engine);
    } catch (error) {
        for (const build of config.builds) runs[`${engine} ${build}`] = [];
        return String(error.message || error);
    }
    const { browser, label } = launched;
    console.log(`  [${engine}] ${label}`);
    report.browsers[engine] = label;
    const server = await startServer();
    for (const { page, csp } of config.suites) if (csp) server.state.cspPages.add(page);
    try {
        for (const build of config.builds) {
            const target = `${engine} ${build}`;
            server.state.buildBytes = fs.readFileSync(path.join(ROOT, build));
            runs[target] = [];
            for (const { page, csp, timeoutMs } of config.suites) {
                if (!fs.existsSync(path.join(ROOT, page))) continue;
                const pageTimeoutMs = timeoutMs || config.pageTimeoutMs;
                let raw = await runPage(browser, server.baseUrl, page, pageTimeoutMs, csp);
                const connectFailure = connectionFailure(raw);
                if (connectFailure) {
                    // Retry ONCE, only for a connect-phase failure (the request never reached
                    // this server; see connectionFailure). The second run is judged on its own;
                    // anything it gets wrong, including the same failure, is fatal.
                    // Say what the discarded run got wrong, so a retry never hides a real failure
                    // that happened to coincide with the connect failure.
                    const discarded = analysePage(raw, pageTimeoutMs);
                    const discardedFailures = discarded.tests.filter((t) => t.status !== "pass")
                        .map((t) => `${t.status} ${t.id}: ${String(t.detail).split("\n")[0]}`);
                    console.log(`RETRY   ${page} [${target}]: ${connectFailure}. Re-running the page once. ` +
                        `The discarded run had ${discarded.problems.length} page problem(s) and ${discardedFailures.length} non-passing test(s):`);
                    for (const line of discarded.problems.concat(discardedFailures)) console.log(`        discarded: ${line}`);
                    report.retries.push({ page, build: target, reason: connectFailure, discardedProblems: discarded.problems, discardedFailures });
                    raw = await runPage(browser, server.baseUrl, page, pageTimeoutMs, csp);
                }
                const analysed = analysePage(raw, pageTimeoutMs);
                runs[target].push(analysed);
                logRun(target, page, analysed);
            }
            for (const entry of config.acceptance) {
                if (entry.pending && !config.runPendingAcceptance) continue;
                if (!fs.existsSync(path.join(ROOT, entry.spec))) continue;
                const analysed = await runAcceptance(browser, server.baseUrl, entry.spec);
                runs[target].push(analysed);
                logRun(target, `${entry.spec} -> ${analysed.page}`, analysed);
            }
        }
    } finally {
        server.server.close();
        await browser.close();
    }
    report.timing[engine] = Math.round((Date.now() - started) / 1000);
    console.log(`  [${engine}] done in ${report.timing[engine]} s`);
    return null;
}

// ---------------------------------------------------------------------------
// Self-tests

function runProcess(args) {
    return new Promise((resolve) => {
        const child = spawn(process.execPath, args, { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"] });
        let output = "";
        child.stdout.on("data", (d) => { output += d; });
        child.stderr.on("data", (d) => { output += d; });
        child.on("close", (code) => resolve({ code, output }));
    });
}

async function mapLimit(items, limit, fn) {
    const results = new Array(items.length);
    let next = 0;
    const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
        while (next < items.length) {
            const index = next++;
            results[index] = await fn(items[index]);
        }
    });
    await Promise.all(workers);
    return results;
}

function judge(name, kind, expect, outcome) {
    const wantFail = expect.exitCode !== 0;
    const exitOk = wantFail ? outcome.code !== 0 : outcome.code === 0;
    // output: one text, or several that must all appear (e.g. one per engine).
    const texts = expect.output ? [].concat(expect.output) : [];
    const textOk = texts.every((text) => outcome.output.includes(text));
    const ok = exitOk && textOk;
    const why = wantFail
        ? `runner must exit non-zero and say ${texts.map((text) => `"${text}"`).join(" and ")}`
        : "control: runner must exit 0";
    return { name, kind, ok, code: outcome.code, why, output: outcome.output };
}

async function runSelfTests() {
    const fixtures = require(path.join(ROOT, FIXTURES_FILE));
    const jobs = [];
    for (const [name, fixture] of Object.entries(fixtures.browser)) {
        jobs.push({ name, kind: "browser", args: [__filename, "--fixture", name], expect: fixture.expect });
    }
    const scratch = path.join(ROOT, "_scratch", "self-test");
    fs.rmSync(scratch, { recursive: true, force: true });
    for (const [name, fixture] of Object.entries(fixtures.static)) {
        const dir = path.join(scratch, name);
        fixture.create(dir, { ROOT, copyTree });
        jobs.push({ name, kind: "static", args: [path.join(__dirname, "check-repo.js"), "--root", dir, "--only", fixture.check], expect: fixture.expect });
    }
    const results = await mapLimit(jobs, SELF_TEST_CONCURRENCY, async (job) => judge(job.name, job.kind, job.expect, await runProcess(job.args)));
    return results;
}

function copyTree(fromRel, toDir) {
    const from = path.join(ROOT, fromRel);
    const to = path.join(toDir, fromRel);
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.cpSync(from, to, { recursive: true });
}

// ---------------------------------------------------------------------------

async function main() {
    const args = process.argv.slice(2);
    let fixtureName = null;
    let acceptanceMode = false;
    for (let i = 0; i < args.length; i++) {
        if (args[i] === "--fixture") fixtureName = args[++i];
        else if (args[i] === "--acceptance") acceptanceMode = true;
        else throw new Error(`unknown argument "${args[i]}"`);
    }
    const config = fixtureName ? fixtureConfig(fixtureName) : acceptanceMode ? acceptanceConfig() : mainConfig();
    const verdict = [];
    const report = { config: config.name, version: PKG.version, retries: [] };

    if (config.staticChecks) {
        console.log("== Static checks");
        const outcome = await runChecks({ root: ROOT });
        printResults(outcome);
        report.static = outcome.results;
        if (!outcome.ok) verdict.push("static checks failed");
    }

    const listProblems = checkSuiteList(config);
    for (const problem of listProblems) console.log(`LIST    ${problem}`);
    if (listProblems.length) verdict.push(`${listProblems.length} suite-list problem(s)`);

    // The engines run side by side, each with its own server (the server answers
    // /stitch.js with that engine's build under test); within an engine, pages run one at a time.
    console.log(`== Browser suites: ${config.suites.length} page(s) x ${config.builds.length} build(s) x ${config.engines.length} engine(s) (${config.engines.join(", ")})`);
    report.browsers = {};
    report.timing = {};
    const runs = {};
    const engineOutcomes = await Promise.all(config.engines.map((engine) => runEngine(config, engine, runs, report)));
    for (const failure of engineOutcomes.filter(Boolean)) {
        console.log(`ENGINE  ${failure}`);
        verdict.push(failure);
    }

    for (const entry of config.acceptance) {
        if (entry.pending && !config.runPendingAcceptance) {
            console.log(`PENDING ${entry.spec} (${entry.pending.sprint}): ${entry.pending.reason}. Not run by npm test; npm run test:acceptance runs it`);
        }
    }
    const { summary, fatal } = classify(config, runs);
    for (const line of fatal) console.log(line);
    printSummary(config, summary);
    const pendingCount = config.acceptance.filter((entry) => entry.pending && !config.runPendingAcceptance).length;
    if (pendingCount) console.log(`pending acceptance specs (not run): ${pendingCount}`);
    if (report.retries.length) {
        console.log(`RETRIED ${report.retries.length} page run(s) after a connection-level failure (listed above as RETRY; details in the report).`);
    }
    report.summary = summary;
    report.fatal = fatal;
    report.runs = runs;
    if (fatal.length) verdict.push(`${fatal.length} fatal result(s) in the browser suites`);

    if (config.selfTests) {
        console.log("== Gate self-tests");
        const results = await runSelfTests();
        for (const r of results) {
            console.log(`[${r.ok ? "PASS" : "FAIL"}] ${r.kind} ${r.name}: exit ${r.code}; ${r.why}`);
            if (!r.ok) console.log(r.output.split("\n").map((line) => `       | ${line}`).join("\n"));
        }
        report.selfTests = results.map(({ output, ...rest }) => rest);
        const failed = results.filter((r) => !r.ok).length;
        if (failed) verdict.push(`${failed} gate self-test(s) did not behave as expected`);
    }

    if (config.name === "main") {
        fs.mkdirSync(path.join(ROOT, path.dirname(REPORT_FILE)), { recursive: true });
        fs.writeFileSync(path.join(ROOT, REPORT_FILE), JSON.stringify(report, null, 2));
        console.log(`Report: ${REPORT_FILE}`);
    }
    if (verdict.length) {
        console.log(`RESULT: FAIL - ${verdict.join("; ")}`);
        process.exitCode = 1;
    } else {
        console.log("RESULT: PASS");
        process.exitCode = 0;
    }
}

main().catch((error) => {
    console.error(`RESULT: FAIL - runner error: ${error && error.stack ? error.stack : error}`);
    process.exitCode = 1;
});
