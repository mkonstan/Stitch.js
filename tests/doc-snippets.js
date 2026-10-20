/*
 * Executable documentation: the code blocks in the docs are tests.
 *
 * Every ```html or ```js block in a document of DOC_SET carries a mode after the
 * language (```js run). The static check (_tools/doc-checks.js, run by `npm test`)
 * fails on a block without one, and on a markdown file with html/js blocks that is
 * not in DOC_SET. test-doc-snippets.html runs every runnable block in the browser,
 * against stitch.js and stitch.min.js.
 *
 *   run       Runs in a fresh iframe with Stitch loaded. It must not throw (now or
 *             later: errors in reactive updates are caught too) and must not call
 *             console.error. An html block is a page fragment (markup and <script>s);
 *             a js block is a script.
 *   page      An html block of markup only. It is the page the NEXT js block of the
 *             same file runs in (that js block must be `run` or `throws`).
 *   throws    Shows a mistake. It must throw, and the error message must contain the
 *             text of the first code span on the "Throws:" line that follows the block:
 *                 Throws: `"nmae" is not a property of the model`
 *   fragment  Not runnable on its own (a signature, a partial line). Not executed;
 *             counted, so the number stays small and visible.
 *
 * Optional hidden checks follow a run/throws block as HTML comments, one per line:
 *     <!-- check: text('#greeting') === 'Hello, Ada' -->
 * Each is a JavaScript expression evaluated in the snippet's page after it ran (and
 * after pending updates), in order; each must be true. Helpers available to checks:
 * text(sel), texts(sel), count(sel), visible(sel), checked(sel), attr(sel, name),
 * click(sel), type(sel, value), tick() (await pending updates).
 *
 * Fences must start at column 0. In a file listed in HISTORY_SECTIONS, a line
 *     <!-- history: ... -->
 * starts a history section: nothing below it is run or checked (old-version code).
 *
 * Usable from Node (require) for the static check, and in the browser
 * (window.StitchDocSnippets) for the runner.
 */
(function (root, factory) {
    var api = factory();
    if (typeof module !== "undefined" && module.exports) {
        module.exports = api;
    } else {
        root.StitchDocSnippets = api;
    }
})(this, function () {
    "use strict";

    // The documents whose code blocks are executed. The static check fails if a markdown
    // file with html/js blocks exists outside this list (docs/history/ excepted).
    var DOC_SET = [
        "README.md",
        "AGENTS.md",
        "CHANGELOG.md",
        "MIGRATION.md",
        "docs/GUIDE.md",
        "docs/API.md",
        "docs/ERRORS.md",
        "docs/ACCESSIBILITY.md",
        "skills/stitch/SKILL.md",
        "skills/stitch/references/recipes.md",
        "skills/stitch/references/gotchas.md",
        "skills/stitch/references/grammar.md",
        "skills/stitch/references/errors.md",
        "tests/skill-proofs.md"
    ];
    // The part of DOC_SET that test-skill-snippets.html runs (the Claude skill and its proofs);
    // test-doc-snippets.html runs the rest. Two pages keep each within the runner's page timeout.
    var SKILL_SET = DOC_SET.filter(function (file) {
        return file.indexOf("skills/") === 0 || file === "tests/skill-proofs.md";
    });
    // Files that may end with a history section (old-version code, not run).
    var HISTORY_SECTIONS = ["MIGRATION.md"];
    var MODES = ["run", "page", "throws", "fragment"];
    var LANGS = { html: "html", js: "js", javascript: "js" };
    var HISTORY_MARKER = /^<!-- history\b.*-->\s*$/;
    var FENCE = /^(`{3,}|~{3,})(.*)$/;
    var INDENTED_FENCE = /^\s+(`{3,}|~{3,})\s*(html|js|javascript)\b/i;
    var CHECK = /^<!-- check: ([\s\S]*?) -->\s*$/;
    var THROWS = /^(?:>\s*)?(?:\*\*)?Throws:?(?:\*\*)?:?\s.*?`([^`]+)`/;

    /** The line index where the history section starts in text, or -1. */
    function historyStart(lines) {
        for (var i = 0; i < lines.length; i++) {
            if (HISTORY_MARKER.test(lines[i])) return i;
        }
        return -1;
    }

    /**
     * Parses one markdown document.
     * @returns {{snippets: Array, problems: string[], fragments: number, historyLine: number}}
     */
    function parse(text, file) {
        var lines = String(text).replace(/\r\n/g, "\n").split("\n");
        var problems = [];
        var snippets = [];
        var fragments = 0;
        var hist = historyStart(lines);
        if (hist !== -1 && HISTORY_SECTIONS.indexOf(file) === -1) {
            problems.push(file + ":" + (hist + 1) + ": a history marker is only allowed in " + HISTORY_SECTIONS.join(", "));
            hist = -1;
        }
        var end = hist === -1 ? lines.length : hist;
        var pendingPage = null;
        var i = 0;
        while (i < end) {
            var line = lines[i];
            if (INDENTED_FENCE.test(line)) {
                problems.push(file + ":" + (i + 1) + ": an html/js code block must start at column 0 (not indented)");
            }
            var open = FENCE.exec(line);
            if (!open) { i++; continue; }
            var fence = open[1];
            var info = open[2].trim().split(/\s+/);
            var lang = LANGS[(info[0] || "").toLowerCase()];
            var mode = info[1] || "";
            var startLine = i + 1;
            var body = [];
            i++;
            while (i < lines.length && !(lines[i].indexOf(fence) === 0 && lines[i].slice(fence.length).trim() === "")) {
                body.push(lines[i]);
                i++;
            }
            if (i >= lines.length) {
                problems.push(file + ":" + startLine + ": code block is never closed");
                break;
            }
            i++; // past the closing fence
            if (!lang) continue; // other languages (bash, json, text) are not ours
            var where = file + ":" + startLine;
            if (MODES.indexOf(mode) === -1) {
                problems.push(where + ": ```" + info[0] + " block needs a mode after the language: " + MODES.join(", ") +
                    (mode ? " (got \"" + mode + "\")" : ""));
                continue;
            }
            // What follows the block: blank lines, check comments, a Throws: line.
            var checks = [];
            var expect = null;
            var j = i;
            while (j < end) {
                var next = lines[j];
                if (next.trim() === "") { j++; continue; }
                var check = CHECK.exec(next.trim());
                if (check) { checks.push(check[1]); j++; continue; }
                var thrown = THROWS.exec(next.trim());
                if (thrown && expect === null) { expect = thrown[1]; j++; continue; }
                break;
            }
            var code = body.join("\n");
            if (mode === "fragment") {
                fragments++;
                if (checks.length) problems.push(where + ": a fragment is not run, so it cannot have checks");
                continue;
            }
            if (mode === "page") {
                if (lang !== "html") problems.push(where + ": mode page is for html blocks (the markup a js block runs in)");
                if (pendingPage) problems.push(pendingPage.where + ": this page block is not followed by a js block that uses it");
                pendingPage = { code: code, where: where };
                continue;
            }
            if (mode === "throws" && expect === null) {
                problems.push(where + ": a throws block must be followed by a line \"Throws: `<text the error message contains>`\"");
            }
            if (mode === "run" && expect !== null) {
                problems.push(where + ": a run block must not be followed by a Throws: line (use mode throws)");
            }
            var page = null;
            if (lang === "js" && pendingPage) {
                page = pendingPage.code;
                pendingPage = null;
            } else if (lang === "html" && pendingPage) {
                problems.push(pendingPage.where + ": this page block is followed by an html block, not a js block");
                pendingPage = null;
            }
            snippets.push({
                id: file + ":" + startLine,
                file: file,
                line: startLine,
                lang: lang,
                mode: mode,
                code: code,
                page: page,
                expect: expect,
                checks: checks
            });
        }
        if (pendingPage) problems.push(pendingPage.where + ": this page block is not followed by a js block that uses it");
        return { snippets: snippets, problems: problems, fragments: fragments, historyLine: hist === -1 ? -1 : hist + 1 };
    }

    /** True when the markdown text (outside a history section) has an html/js code block. */
    function hasOurBlocks(text, file) {
        var lines = String(text).replace(/\r\n/g, "\n").split("\n");
        var hist = HISTORY_SECTIONS.indexOf(file) !== -1 ? historyStart(lines) : -1;
        var end = hist === -1 ? lines.length : hist;
        for (var i = 0; i < end; i++) {
            var open = FENCE.exec(lines[i]) || /^\s+(`{3,}|~{3,})(.*)$/.exec(lines[i]);
            if (open && LANGS[(open[2].trim().split(/\s+/)[0] || "").toLowerCase()]) return true;
        }
        return false;
    }

    // ------------------------------------------------------------------------------
    // Browser runner

    var CAPTURE = [
        "window.__snip = { errors: [], consoleErrors: [] };",
        "addEventListener('error', function (e) { __snip.errors.push(e.error || new Error(e.message)); e.preventDefault(); });",
        "addEventListener('unhandledrejection', function (e) { __snip.errors.push(e.reason); e.preventDefault(); });",
        "console.error = function () { __snip.consoleErrors.push(Array.prototype.map.call(arguments, String).join(' ')); };",
        "function __el(s) { var e = document.querySelector(s); if (!e) throw new Error('check: no element matches ' + s); return e; }",
        "function text(s) { return __el(s).textContent.trim(); }",
        "function texts(s) { return Array.prototype.map.call(document.querySelectorAll(s), function (e) { return e.textContent.trim(); }); }",
        "function count(s) { return document.querySelectorAll(s).length; }",
        "function visible(s) { var e = __el(s); return e.getClientRects().length > 0; }",
        "function checked(s) { return __el(s).checked; }",
        "function attr(s, n) { return __el(s).getAttribute(n); }",
        "function click(s) { __el(s).click(); return true; }",
        "function type(s, v) { var e = __el(s); e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); return true; }",
        "function tick() { return new Promise(function (r) { setTimeout(r, 0); }); }"
    ].join("\n");

    var LIBRARY_TAG = /<script\b[^>]*\bsrc\s*=\s*["'][^"']*stitch(?:\.min)?\.js["']/i;

    function escapeScript(code) {
        return code.replace(/<\/script/gi, "<\\/script");
    }

    /** The srcdoc of a snippet's page. */
    function buildDocument(snippet, library) {
        var head = "<meta charset=\"utf-8\"><script>" + CAPTURE + "</script>";
        var lib = "<script src=\"" + library + "\"></script>";
        if (snippet.lang === "js") {
            return "<!doctype html><html><head>" + head + "</head><body>" + (snippet.page || "") +
                lib + "<script>" + escapeScript(snippet.code) + "\n</script></body></html>";
        }
        var code = snippet.code;
        var withLib = LIBRARY_TAG.test(code) ? code : lib + code;
        if (/<head[^>]*>/i.test(withLib)) {
            return withLib.replace(/<head[^>]*>/i, function (tag) { return tag + head; });
        }
        return "<!doctype html><html><head>" + head + "</head><body>" + withLib + "</body></html>";
    }

    function delay(ms) {
        return new Promise(function (resolve) { setTimeout(resolve, ms); });
    }

    function messageOf(error) {
        if (error && typeof error.message === "string") return error.message;
        return String(error);
    }

    /** Runs one snippet in a fresh iframe; resolves to { ok, detail }. */
    function runOne(snippet, options) {
        var library = options.library || "stitch.js";
        var host = options.host || document.body;
        return new Promise(function (resolve) {
            var frame = document.createElement("iframe");
            frame.style.cssText = "width:400px;height:200px;border:1px solid #ccc";
            var settled = false;
            var finish = function (ok, detail) {
                if (settled) return;
                settled = true;
                setTimeout(function () { if (frame.parentNode) frame.parentNode.removeChild(frame); }, 0);
                resolve({ ok: ok, detail: detail });
            };
            var guard = setTimeout(function () { finish(false, "timed out (the snippet page did not load and settle)"); }, options.timeoutMs || 8000);
            frame.addEventListener("load", function () {
                var win = frame.contentWindow;
                var state = win.__snip;
                if (!state) { clearTimeout(guard); finish(false, "the snippet page did not start"); return; }
                judge(snippet, win, state).then(function (result) {
                    clearTimeout(guard);
                    finish(result.ok, result.detail);
                }, function (error) {
                    clearTimeout(guard);
                    finish(false, "runner error: " + messageOf(error));
                });
            });
            frame.srcdoc = buildDocument(snippet, library);
            host.appendChild(frame);
        });
    }

    async function settle(win) {
        // Pending updates run on microtasks; uncaught errors from them on a timer.
        await delay(0);
        await new Promise(function (r) { win.setTimeout(r, 0); });
        await delay(30);
    }

    async function judge(snippet, win, state) {
        var failures = [];
        await settle(win);
        if (snippet.mode === "throws") {
            var waited = 0;
            while (state.errors.length === 0 && waited < 400) {
                await delay(20);
                waited += 20;
            }
            if (state.errors.length === 0) {
                failures.push("expected the snippet to throw an error containing " + JSON.stringify(snippet.expect) + ", but nothing was thrown");
            } else {
                var message = messageOf(state.errors[0]);
                if (message.indexOf(snippet.expect) === -1) {
                    failures.push("the error message does not contain the documented text " + JSON.stringify(snippet.expect) + ": got " + JSON.stringify(message));
                }
            }
        }
        var errorsBeforeChecks = snippet.mode === "throws" ? 1 : 0;
        for (var c = 0; c < snippet.checks.length; c++) {
            var expr = snippet.checks[c];
            var value;
            try {
                value = await win.eval("(" + expr + ")");
            } catch (error) {
                failures.push("check threw: " + expr + " -> " + messageOf(error));
                continue;
            }
            await settle(win);
            if (value !== true) failures.push("check is not true: " + expr + " (got " + safe(value) + ")");
        }
        await settle(win);
        state.errors.slice(errorsBeforeChecks).forEach(function (error) {
            failures.push((snippet.mode === "throws" ? "a further error was thrown: " : "the snippet threw: ") + messageOf(error));
        });
        state.consoleErrors.forEach(function (text) { failures.push("console.error: " + text); });
        return { ok: failures.length === 0, detail: failures.length ? failures.join("\n") : "ran" + (snippet.checks.length ? ", " + snippet.checks.length + " check(s)" : "") };
    }

    function safe(value) {
        try { return JSON.stringify(value); } catch (e) { return String(value); }
    }

    /**
     * Fetches the documents, plans one test per runnable snippet (plus one parse test per
     * document) and runs them, a few at a time, reporting through StitchTest.
     */
    async function run(files, options) {
        options = options || {};
        var test = window.StitchTest;
        var docs = [];
        for (var f = 0; f < files.length; f++) {
            var response = await fetch(files[f], { cache: "no-store" });
            if (!response.ok) throw new Error("doc-snippets: cannot fetch " + files[f] + " (" + response.status + ")");
            docs.push(parse(await response.text(), files[f]));
        }
        var ids = [];
        var all = [];
        docs.forEach(function (doc, index) {
            ids.push(files[index] + ":parse");
            doc.snippets.forEach(function (s) { ids.push(s.id); all.push(s); });
        });
        test.plan(ids);
        docs.forEach(function (doc, index) {
            test.result(files[index] + ":parse", doc.problems.length === 0,
                doc.problems.length ? doc.problems.join("\n") : doc.snippets.length + " runnable, " + doc.fragments + " fragment(s)");
        });
        var summary = document.getElementById("snippet-summary");
        if (summary) {
            summary.textContent = all.length + " runnable snippets in " + files.length + " documents; fragments: " +
                docs.reduce(function (n, d) { return n + d.fragments; }, 0);
        }
        var next = 0;
        var concurrency = options.concurrency || 6;
        async function worker() {
            while (next < all.length) {
                var snippet = all[next++];
                var result = await runOne(snippet, options);
                test.result(snippet.id, result.ok, result.detail);
            }
        }
        var workers = [];
        for (var w = 0; w < concurrency; w++) workers.push(worker());
        await Promise.all(workers);
    }

    return {
        DOC_SET: DOC_SET,
        SKILL_SET: SKILL_SET,
        HISTORY_SECTIONS: HISTORY_SECTIONS,
        MODES: MODES,
        parse: parse,
        hasOurBlocks: hasOurBlocks,
        historyStart: historyStart,
        buildDocument: buildDocument,
        run: run
    };
});
