/*
 * test-attr-safety.html: data-attr refuses every value that could run script (the corpus in
 * tests/xss-corpus.js), with its code, writing nothing; legitimate values keep working; style
 * objects go through the CSSOM; code elements (<script>, <style>, <base>, <meta>) cannot be
 * bound. External script, no inline style: the strict-CSP suite loads the corpus half too.
 */
(function () {
    "use strict";

    var corpus = window.STITCH_XSS_CORPUS;
    var SVG = "http://www.w3.org/2000/svg";
    var MATHML = "http://www.w3.org/1998/Math/MathML";
    var ran = [];
    window.__xss = function (n) { ran.push(n); };

    StitchTest.plan([
        "every-corpus-payload-is-refused-at-bind",
        "a-payload-arriving-later-goes-to-onerror-and-writes-nothing",
        "a-refused-object-writes-none-of-its-entries",
        "legitimate-values-work",
        "style-objects-are-written-through-the-cssom",
        "style-updates-remove-only-their-own-properties",
        "code-elements-cannot-be-bound",
        "a-static-sandbox-cannot-be-removed-by-data",
        "a-radio-group-name-with-quotes-still-binds",
        "no-payload-ever-ran"
    ]);

    function tick(ms) { return new Promise(function (resolve) { setTimeout(resolve, ms || 20); }); }

    function make(tag) {
        if (tag.indexOf("svg:") === 0) return document.createElementNS(SVG, tag.slice(4));
        if (tag === "math") return document.createElementNS(MATHML, "math");
        return document.createElement(tag);
    }

    function thrown(fn) {
        try { fn(); } catch (error) { return error; }
        return null;
    }

    function hasAttr(element, name) {
        return element.hasAttribute(name) || element.hasAttribute(name.toLowerCase());
    }

    function bindAttrs(tag, attrs, extra) {
        var element = make(tag);
        element.setAttribute("data-attr", "attrs");
        var data = { attrs: attrs };
        if (extra) Object.keys(extra).forEach(function (key) { data[key] = extra[key]; });
        var model = Stitch.Observable.create(data);
        var binder = new Stitch.DataBinder();
        var error = thrown(function () { binder.bind(element, model); });
        return { element: element, model: model, binder: binder, error: error };
    }

    function one(name, value) {
        var attrs = {};
        attrs[name] = value;
        return attrs;
    }

    function label(entry) {
        return entry.label + " " + JSON.stringify(entry.value);
    }

    StitchTest.test("every-corpus-payload-is-refused-at-bind", function (t) {
        t.ok(corpus.refused.length >= 900, "the corpus has at least 900 refusal cases (has " + corpus.refused.length + ")");
        var wrong = [];
        corpus.refused.forEach(function (entry) {
            var run = bindAttrs(entry.element, one(entry.attribute, entry.value));
            var prefix = "[Stitch " + entry.code + "]";
            if (!run.error) {
                wrong.push("not refused: " + label(entry));
            } else if (String(run.error.message).indexOf(prefix) !== 0) {
                wrong.push("refused with the wrong error (" + String(run.error.message).slice(0, 80) + "): " + label(entry));
            } else if (entry.value !== null && hasAttr(run.element, entry.attribute)) {
                wrong.push("refused but the attribute was written: " + label(entry));
            }
        });
        t.equal(wrong.length, 0, "every payload is refused with its code and nothing is written" +
            (wrong.length ? " (" + wrong.length + " wrong; first: " + wrong.slice(0, 5).join(" | ") + ")" : ""));
    });

    StitchTest.test("a-payload-arriving-later-goes-to-onerror-and-writes-nothing", async function (t) {
        var errors = [];
        var remove = Stitch.onError(function (error) { errors.push(String(error.message)); });
        try {
            var cases = [
                { tag: "a", safe: { href: "/safe" }, bad: { onclick: "top.__xss(2)" }, code: "E321", keep: ["href", "/safe"] },
                { tag: "iframe", safe: { title: "frame" }, bad: { srcdoc: "<script>top.__xss(2)</script>" }, code: "E322", keep: ["title", "frame"] },
                { tag: "a", safe: { href: "/safe" }, bad: { href: " JaVa\tScRiPt:top.__xss(2)" }, code: "E323", keep: ["href", "/safe"] },
                { tag: "iframe", safe: { src: "about:blank" }, bad: { src: "data:text/html,<script>top.__xss(2)</script>" }, code: "E324", keep: ["src", "about:blank"] },
                { tag: "div", safe: { title: "x" }, bad: { style: "color: red" }, code: "E325", keep: ["title", "x"] }
            ];
            for (var i = 0; i < cases.length; i++) {
                var c = cases[i];
                var run = bindAttrs(c.tag, c.safe);
                t.equal(run.error, null, c.code + ": the safe value binds");
                var before = errors.length;
                run.model.attrs = c.bad;
                await tick();
                t.equal(errors.length - before, 1, c.code + ": the later payload goes to Stitch.onError once");
                t.ok(String(errors[errors.length - 1]).indexOf("[Stitch " + c.code + "]") === 0, c.code + ": with its code");
                t.equal(run.element.getAttribute(c.keep[0]), c.keep[1], c.code + ": the element keeps its last good value");
                var badName = Object.keys(c.bad)[0];
                if (badName !== c.keep[0]) t.equal(hasAttr(run.element, badName), false, c.code + ": the refused attribute is not written");
                run.binder.dispose();
            }
        } finally {
            remove();
        }
    });

    StitchTest.test("a-refused-object-writes-none-of-its-entries", function (t) {
        var run = bindAttrs("a", { title: "first", "aria-label": "second", href: "javascript:top.__xss(3)" });
        t.ok(run.error && run.error.message.indexOf("[Stitch E323]") === 0, "the object is refused (E323)");
        t.equal(run.element.hasAttribute("title"), false, "the entry before the refused one is not written");
        t.equal(run.element.hasAttribute("aria-label"), false, "nor the one after it");
        t.ok(/<a data-attr="attrs">/.test(run.error.message) && /"href"/.test(run.error.message),
            "the message names the element, the binding and the attribute: " + run.error.message);
        t.equal(run.error.message.indexOf("__xss"), -1, "the message does not repeat the payload");
    });

    StitchTest.test("legitimate-values-work", function (t) {
        corpus.allowed.forEach(function (entry) {
            var element;
            var run = bindAttrs(entry.element, one(entry.attribute, entry.value));
            element = run.element;
            if (run.error) {
                t.fail("refused a legitimate value: " + entry.attribute + " on <" + entry.element + "> " + JSON.stringify(entry.value) + ": " + run.error.message);
                return;
            }
            t.equal(element.getAttribute(entry.attribute), entry.expected,
                entry.attribute + " on <" + entry.element + "> " + JSON.stringify(entry.value));
            run.binder.dispose();
        });
        // Removal: a listed attribute set to null is removed.
        var removed = make("a");
        removed.setAttribute("href", "/before");
        removed.setAttribute("data-attr", "attrs");
        var model = Stitch.Observable.create({ attrs: { href: "/after" } });
        new Stitch.DataBinder().bind(removed, model);
        t.equal(removed.getAttribute("href"), "/after", "a URL is written");
        model.attrs = { href: null };
        return tick().then(function () {
            t.equal(removed.hasAttribute("href"), false, "null removes it");
        });
    });

    StitchTest.test("style-objects-are-written-through-the-cssom", function (t) {
        var run = bindAttrs("div", { style: { color: "red", fontSize: "12px", "--accent": "blue", marginTop: "1px !important" } });
        t.equal(run.error, null, "a style object binds");
        var style = run.element.style;
        t.equal(style.color, "red", "color");
        t.equal(style.fontSize, "12px", "fontSize becomes font-size");
        t.equal(style.getPropertyValue("--accent").trim(), "blue", "a custom property keeps its name");
        t.equal(style.getPropertyValue("margin-top"), "1px", "an !important value");
        t.equal(style.getPropertyPriority("margin-top"), "important", "keeps its priority");
    });

    StitchTest.test("style-updates-remove-only-their-own-properties", async function (t) {
        var element = make("div");
        element.setAttribute("data-attr", "attrs");
        element.setAttribute("data-visible", "shown");
        var model = Stitch.Observable.create({ attrs: { style: { color: "red", fontSize: "12px" } }, shown: false });
        new Stitch.DataBinder().bind(element, model);
        t.equal(element.style.display, "none", "data-visible hid the element");
        t.equal(element.style.color, "red", "the style object is written");
        model.attrs = { style: { color: "blue" } };
        await tick();
        t.equal(element.style.color, "blue", "a changed property is updated");
        t.equal(element.style.fontSize, "", "a property no longer listed is removed");
        t.equal(element.style.display, "none", "data-visible's display is left alone");
        model.attrs = { style: null };
        await tick();
        t.equal(element.style.color, "", "style: null removes the properties data-attr wrote");
        t.equal(element.style.display, "none", "and only those");
    });

    StitchTest.test("code-elements-cannot-be-bound", function (t) {
        var cases = [
            ["script", "data-text", "code", { code: "top.__xss(4)" }],
            ["script", "data-attr", "attrs", { attrs: { src: "/evil.js" } }],
            ["svg:script", "data-text", "code", { code: "top.__xss(4)" }],
            ["style", "data-text", "css", { css: "body { background: red }" }],
            ["base", "data-attr", "attrs", { attrs: { href: "https://example.com/" } }],
            ["meta", "data-attr", "attrs", { attrs: { content: "0; url=https://example.com/" } }],
            ["script", "data-visible", "shown", { shown: true }]
        ];
        cases.forEach(function (c) {
            var element = make(c[0]);
            element.setAttribute(c[1], c[2]);
            var host = document.createElement("div");
            host.appendChild(element);
            var error = thrown(function () { new Stitch.DataBinder().bind(host, Stitch.Observable.create(c[3])); });
            t.ok(error && String(error.message).indexOf("[Stitch E326]") === 0,
                c[1] + " on <" + c[0] + "> throws E326 (got " + (error ? String(error.message).slice(0, 60) : "no error") + ")");
            t.equal(element.textContent, "", c[1] + " on <" + c[0] + "> wrote no text");
            t.equal(element.hasAttribute("src") || element.hasAttribute("href") || element.hasAttribute("content"), false,
                c[1] + " on <" + c[0] + "> wrote no attribute");
        });
    });

    StitchTest.test("a-static-sandbox-cannot-be-removed-by-data", function (t) {
        var frame = make("iframe");
        frame.setAttribute("sandbox", "");
        frame.setAttribute("data-attr", "attrs");
        var error = thrown(function () { new Stitch.DataBinder().bind(frame, Stitch.Observable.create({ attrs: { title: "Report", sandbox: null } })); });
        t.ok(error && String(error.message).indexOf("[Stitch E327]") === 0, "sandbox: null is refused with E327 (got " + (error ? String(error.message).slice(0, 60) : "no error") + ")");
        t.equal(frame.getAttribute("sandbox"), "", "the static sandbox stays");
        t.equal(frame.hasAttribute("title"), false, "and nothing else in the object is written");
    });

    StitchTest.test("a-radio-group-name-with-quotes-still-binds", async function (t) {
        var host = document.createElement("div");
        ["a", "b"].forEach(function (v) {
            var radio = document.createElement("input");
            radio.type = "radio";
            radio.name = "pick\"one";
            radio.value = v;
            radio.setAttribute("data-value", "choice");
            host.appendChild(radio);
        });
        document.body.appendChild(host);
        // No onError handler here (another test holds it): an error in an update would be an
        // uncaught page error, which fails the page.
        try {
            var model = Stitch.Observable.create({ choice: "a" });
            var error = thrown(function () { new Stitch.DataBinder().bind(host, model); });
            t.equal(error && String(error.message), null, "a group whose name holds a quote binds");
            model.choice = "b";
            await tick();
            t.equal(host.querySelectorAll("input")[1].checked, true, "a model change checks the matching radio");
            var clickError = thrown(function () { host.querySelectorAll("input")[0].click(); });
            await tick();
            t.equal(clickError, null, "a click does not throw");
            t.equal(model.choice, "a", "and writes its value");
        } finally {
            host.remove();
        }
    });

    StitchTest.test("no-payload-ever-ran", async function (t) {
        await tick(100);
        t.deepEqual(ran, [], "top.__xss was never called");
    });
})();
