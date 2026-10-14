"use strict";

/*
 * `npm test`: the one test entry point.
 *
 *   1. Static checks (_tools/check-repo.js): version literal, local paths,
 *      missing references, build-match (stitch.js and stitch.min.js equal a
 *      fresh build of packages/*).
 *   2. Every page in tests/suites.js, in Chromium, against stitch.js AND
 *      stitch.min.js. The page's own <script src="stitch.js"> is answered with
 *      the build under test. Pages report through tests/harness.js.
 *   3. Gate self-tests: each fixture in tests/gate-fixtures/fixtures.js is a way
 *      a broken suite could look green; the runner is re-run on it and must exit
 *      non-zero for the stated reason (controls must exit 0).
 *
 * Exit 0 only when: static checks pass; every listed page exists, finishes, and
 * reports a non-empty plan with one result per planned test; no page logs an
 * uncaught error or console error or fails a request; failed = 0 and
 * skipped = 0 on both builds; every tests/known-failing.json entry names a real
 * test that FAILED on both builds; no test page is missing from the list; and
 * every self-test behaves as expected.
 *
 * Usage:
 *   node _tools/run-tests.js                  full run (what CI and `npm test` do)
 *   node _tools/run-tests.js --fixture <name> run one gate fixture (used by the self-tests)
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
const PAGE_TIMEOUT_MS = 20000;
const SETTLE_MS = 300;
const SELF_TEST_CONCURRENCY = 4;
const LIBRARY_PATH = /^\/(?:.*\/)?stitch(?:\.min)?\.js$/;
// The public window.Stitch surface. Changing it is a deliberate API change: update here.
const PUBLIC_EXPORTS = ["DataBinder", "MessageBus", "Observable", "computed", "debug", "version"];

const PKG = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));

// ---------------------------------------------------------------------------
// Configuration

function mainConfig() {
    return {
        name: "main",
        suites: loadSuites(require(path.join(ROOT, SUITES_FILE))),
        knownFailing: loadKnownFailing(path.join(ROOT, KNOWN_FAILING_FILE)),
        knownFailingLabel: KNOWN_FAILING_FILE,
        discoverDir: "",
        excludeDirs: [FIXTURE_DIR],
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
        suites: loadSuites(fixture.suites.map((page) => ({ page }))),
        knownFailing: validateKnownFailing(fixture.knownFailing || {}, `${FIXTURES_FILE}#${name}`),
        knownFailingLabel: `${FIXTURES_FILE}#${name}`,
        discoverDir: fixture.discoverDir || null,
        excludeDirs: [],
        builds: ["stitch.js"],
        pageTimeoutMs: fixture.pageTimeoutMs || PAGE_TIMEOUT_MS,
        staticChecks: false,
        selfTests: false
    };
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
        return { page: entry.page.replace(/\\/g, "/") };
    });
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
    }
    return tests;
}

// ---------------------------------------------------------------------------
// Suite-list integrity: every listed page exists; every test page is listed.

function isTestPage(rel) {
    if (!rel.endsWith(".html")) return false;
    const base = path.posix.basename(rel);
    if (/^test-.+\.html$/.test(base) || /-test\.html$/.test(base)) return true;
    return /tests\/harness\.js|["']harness\.js["']/.test(fs.readFileSync(path.join(ROOT, rel), "utf8"));
}

function checkSuiteList(config) {
    const problems = [];
    for (const { page } of config.suites) {
        if (!fs.existsSync(path.join(ROOT, page))) problems.push(`listed page does not exist: ${page}`);
    }
    if (config.discoverDir !== null) {
        const listed = new Set(config.suites.map((s) => s.page));
        const files = listFiles(ROOT).filter((rel) =>
            rel.startsWith(config.discoverDir) && !config.excludeDirs.some((dir) => rel.startsWith(dir)));
        for (const rel of files.filter(isTestPage)) {
            if (!listed.has(rel)) problems.push(`test page not in ${SUITES_FILE}: ${rel} (add it to the list)`);
        }
    }
    return problems;
}

// ---------------------------------------------------------------------------
// Static file server. /stitch.js and /stitch.min.js (at any depth) answer with
// the build under test, so every page runs the same bytes.

const CONTENT_TYPES = { ".html": "text/html; charset=utf-8", ".js": "application/javascript; charset=utf-8", ".json": "application/json", ".css": "text/css" };

function startServer() {
    const state = { buildBytes: null };
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
        res.writeHead(200, { "Content-Type": CONTENT_TYPES[path.extname(file)] || "application/octet-stream", "Cache-Control": "no-store" });
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

async function launchBrowser() {
    const { chromium } = require("playwright");
    const attempts = [
        { label: "playwright chromium", options: {} },
        { label: "installed Chrome (channel chrome)", options: { channel: "chrome" } },
        { label: "installed Edge (channel msedge)", options: { channel: "msedge" } }
    ];
    const errors = [];
    for (const attempt of attempts) {
        try {
            const browser = await chromium.launch({ headless: true, ...attempt.options });
            return { browser, label: attempt.label };
        } catch (error) {
            errors.push(`${attempt.label}: ${String(error.message || error).split("\n")[0]}`);
        }
    }
    throw new Error(`no browser could be launched:\n  ${errors.join("\n  ")}\nRun: npx playwright install chromium`);
}

async function runPage(browser, baseUrl, page, timeoutMs) {
    const context = await browser.newContext();
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
    try {
        await tab.goto(`${baseUrl}/${page}`, { waitUntil: "load", timeout: timeoutMs });
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
        exports: window.Stitch ? Object.keys(window.Stitch).sort() : null
    })).catch((error) => ({ report: null, version: undefined, evalError: String(error.message || error) }));
    await context.close();
    return { page, navigationError, finished, ...observed, ...snapshot };
}

/** Turn one page run into per-test statuses plus page-level problems. */
function analysePage(raw, timeoutMs) {
    const problems = [];
    const tests = [];
    if (raw.navigationError) problems.push(`navigation failed: ${raw.navigationError}`);
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

// ---------------------------------------------------------------------------
// Classification

function classify(config, runs) {
    const known = config.knownFailing;
    const summary = {};
    const fatal = [];
    const seenIds = new Set();

    for (const build of config.builds) {
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
    const unexpected = lines.filter((line) => !entry.expect.some((prefix) => line.startsWith(prefix)));
    const absent = entry.expect.filter((prefix) => !lines.some((line) => line.startsWith(prefix)));
    if (unexpected.length === 0 && absent.length === 0) return null;
    const parts = [];
    if (unexpected.length) parts.push(`unexpected failure(s): ${unexpected.map((l) => JSON.stringify(l.slice(0, 160))).join("; ")}`);
    if (absent.length) parts.push(`expected failure(s) absent: ${absent.map((l) => JSON.stringify(l)).join("; ")}`);
    return parts.join(" | ");
}

function firstLine(text) {
    return String(text || "").split("\n").filter(Boolean).slice(0, 2).join(" | ");
}

function printSummary(config, summary) {
    const header = "build".padEnd(16) + "passed".padStart(8) + "known-failing".padStart(15) + "failed".padStart(8) + "skipped".padStart(9) + "flipped".padStart(9) + "page-problems".padStart(15);
    console.log(header);
    for (const build of config.builds) {
        const c = summary[build];
        console.log(build.padEnd(16) + String(c.passed).padStart(8) + String(c.knownFailing).padStart(15) + String(c.failed).padStart(8) +
            String(c.skipped).padStart(9) + String(c.flipped).padStart(9) + String(c.pageProblems).padStart(15));
    }
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
    const textOk = !expect.output || outcome.output.includes(expect.output);
    const ok = exitOk && textOk;
    const why = wantFail
        ? `runner must exit non-zero and say "${expect.output}"`
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
    for (let i = 0; i < args.length; i++) {
        if (args[i] === "--fixture") fixtureName = args[++i];
        else throw new Error(`unknown argument "${args[i]}"`);
    }
    const config = fixtureName ? fixtureConfig(fixtureName) : mainConfig();
    const verdict = [];
    const report = { config: config.name, version: PKG.version };

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

    const { browser, label } = await launchBrowser();
    console.log(`== Browser suites (${label}): ${config.suites.length} page(s) x ${config.builds.length} build(s)`);
    report.browser = label;
    const server = await startServer();
    const runs = {};
    try {
        for (const build of config.builds) {
            server.state.buildBytes = fs.readFileSync(path.join(ROOT, build));
            runs[build] = [];
            for (const { page } of config.suites) {
                if (!fs.existsSync(path.join(ROOT, page))) continue;
                const raw = await runPage(browser, server.baseUrl, page, config.pageTimeoutMs);
                const analysed = analysePage(raw, config.pageTimeoutMs);
                runs[build].push(analysed);
                const counts = analysed.tests.reduce((acc, t) => { acc[t.status] = (acc[t.status] || 0) + 1; return acc; }, {});
                console.log(`  [${build}] ${page}: ${analysed.tests.length} test(s), pass ${counts.pass || 0}, fail ${counts.fail || 0}, skip ${counts.skip || 0}${analysed.problems.length ? `, ${analysed.problems.length} page problem(s)` : ""}`);
            }
        }
    } finally {
        server.server.close();
        await browser.close();
    }

    const { summary, fatal } = classify(config, runs);
    for (const line of fatal) console.log(line);
    printSummary(config, summary);
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
