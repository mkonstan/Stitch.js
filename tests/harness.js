/*
 * Stitch.js test harness: the one reporting protocol every suite page uses.
 *
 * A page declares its tests up front with StitchTest.plan([...ids]) and then
 * reports each one exactly once. The runner (_tools/run-tests.js) reads
 * window.__stitchTestReport and fails the page when:
 *   - the plan is empty (zero tests),
 *   - a planned test never reports (counted as skipped),
 *   - a test reports twice, reports without being planned, or reports as skipped,
 *   - anything reports after the page has finished (a late result),
 *   - the page never finishes within the runner's timeout.
 * The page finishes on its own once every planned id has a result, or when it
 * calls StitchTest.done().
 *
 * Opened by hand in a browser, the page also shows a one-line summary banner.
 */
(function (global) {
    "use strict";

    var report = {
        protocol: 1,
        planned: null,
        results: [],
        done: false,
        late: [],
        problems: []
    };
    global.__stitchTestReport = report;

    function problem(message) {
        report.problems.push(String(message));
    }

    function hasResult(id) {
        for (var i = 0; i < report.results.length; i++) {
            if (report.results[i].id === id) return true;
        }
        return false;
    }

    function render() {
        if (!global.document || !document.body) return;
        var el = document.getElementById("stitch-test-summary");
        if (!el) {
            el = document.createElement("div");
            el.id = "stitch-test-summary";
            el.style.cssText = "font:14px monospace;padding:8px;margin:8px 0;border:2px solid #888";
            document.body.insertBefore(el, document.body.firstChild);
        }
        var counts = { pass: 0, fail: 0, skip: 0 };
        report.results.forEach(function (r) { counts[r.status]++; });
        var planned = report.planned ? report.planned.length : 0;
        el.textContent = "[harness] planned " + planned + " | passed " + counts.pass +
            " | failed " + counts.fail + " | skipped " + counts.skip +
            (report.done ? " | done" : " | running");
        el.style.borderColor = report.done && counts.fail === 0 && counts.skip === 0 &&
            counts.pass === planned && planned > 0 ? "#2e7d32" : "#c62828";
    }

    function finish() {
        if (report.done) return;
        report.done = true;
        render();
    }

    function maybeFinish() {
        if (!report.planned) return;
        for (var i = 0; i < report.planned.length; i++) {
            if (!hasResult(report.planned[i])) return;
        }
        finish();
    }

    function record(id, status, detail) {
        id = String(id);
        if (report.done) {
            report.late.push({ id: id, status: status });
            return;
        }
        if (!report.planned) {
            problem("result for '" + id + "' arrived before StitchTest.plan()");
        }
        report.results.push({ id: id, status: status, detail: detail == null ? "" : String(detail) });
        render();
        maybeFinish();
    }

    // Assertion collector used by StitchTest.test(). A test with zero
    // assertions fails: it would otherwise pass without checking anything.
    function makeAsserter() {
        var t = { count: 0, failures: [] };
        function check(pass, message) {
            t.count++;
            if (!pass) t.failures.push(String(message));
        }
        t.ok = function (cond, message) { check(cond === true, message + " (expected true, got " + fmt(cond) + ")"); };
        t.equal = function (actual, expected, message) {
            check(actual === expected, message + ": expected " + fmt(expected) + ", got " + fmt(actual));
        };
        t.deepEqual = function (actual, expected, message) {
            var a = safeJson(actual), e = safeJson(expected);
            check(a === e && a !== undefined, message + ": expected " + e + ", got " + a);
        };
        t.match = function (text, regex, message) {
            check(typeof text === "string" && regex.test(text),
                message + ": expected text matching " + regex + ", got " + fmt(text));
        };
        t.fail = function (message) { check(false, message); };
        return t;
    }

    function safeJson(value) {
        try { return JSON.stringify(value); } catch (e) { return "<unserializable>"; }
    }

    function fmt(value) {
        if (typeof value === "string") return JSON.stringify(value);
        var json = safeJson(value);
        return json === undefined ? String(value) : json;
    }

    var StitchTest = {
        /** Declare every test id this page will report. Call once, first. */
        plan: function (ids) {
            if (report.planned) {
                problem("StitchTest.plan() called more than once");
                return;
            }
            if (!Array.isArray(ids)) {
                problem("StitchTest.plan() needs an array of test ids");
                ids = [];
            }
            var seen = {};
            var clean = [];
            ids.forEach(function (id) {
                id = String(id);
                if (!id) { problem("empty test id in plan"); return; }
                if (seen[id]) { problem("duplicate test id in plan: '" + id + "'"); return; }
                seen[id] = true;
                clean.push(id);
            });
            report.planned = clean;
            render();
            maybeFinish();
        },

        /** Report one planned test. passed must be a real boolean. */
        result: function (id, passed, detail) {
            if (passed !== true && passed !== false) {
                problem("result for '" + id + "' is not a boolean: " + fmt(passed));
                passed = false;
            }
            record(id, passed ? "pass" : "fail", detail);
        },
        pass: function (id, detail) { record(id, "pass", detail); },
        fail: function (id, detail) { record(id, "fail", detail); },
        /** A skipped test always fails the runner; skip exists so a page can say why. */
        skip: function (id, reason) { record(id, "skip", reason); },

        /**
         * Adapter for the older suite pages, which collect
         * testResults = [{ name, passed }]: reports every entry not yet reported.
         */
        sync: function (entries) {
            (entries || []).forEach(function (entry) {
                var id = String(entry.name);
                if (!hasResult(id)) StitchTest.result(id, entry.passed);
            });
        },

        /**
         * Run one test. fn(t) may be async; it asserts through t.ok / t.equal /
         * t.deepEqual / t.match. The test fails on any failed assertion, any
         * thrown error, or zero assertions.
         */
        test: function (id, fn) {
            var t = makeAsserter();
            var settle = function (error) {
                if (error) {
                    t.failures.push("threw: " + (error && error.stack ? error.stack : String(error)));
                } else if (t.count === 0) {
                    t.failures.push("the test made no assertions");
                }
                if (t.failures.length === 0) {
                    record(id, "pass", t.count + " assertion(s)");
                } else {
                    record(id, "fail", t.failures.join("\n"));
                }
            };
            var outcome;
            try {
                outcome = fn(t);
            } catch (error) {
                settle(error);
                return Promise.resolve();
            }
            return Promise.resolve(outcome).then(function () { settle(null); }, settle);
        },

        /** Finish now. Planned tests without a result count as skipped. */
        done: function () { finish(); }
    };

    global.StitchTest = StitchTest;
})(typeof window !== "undefined" ? window : this);
