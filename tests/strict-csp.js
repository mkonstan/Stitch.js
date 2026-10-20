/*
 * test-strict-csp.html: the library under the strict policy the runner serves it with
 * (STRICT_CSP in _tools/run-tests.js). No inline script, no inline style, no eval, Trusted
 * Types required. The runner fails the page on any securitypolicyviolation event (recorded
 * from before the first script) and on any uncaught Trusted Types error; the last test also
 * checks the recorder from inside the page.
 */
(function () {
    "use strict";

    StitchTest.plan([
        "value-bindings",
        "handlers",
        "keyed-list-reorder-and-filter",
        "select-list",
        "templates-and-nested-lists",
        "custom-bindings",
        "later-errors-go-to-onerror",
        "bind-errors-throw-with-codes",
        "xss-corpus-refused-under-the-policy",
        "no-policy-violation"
    ]);

    // Custom bindings are registered before the first bind() on the page.
    Stitch.DataBinder.registerBinding("tip", {
        bind: function (element, model, path, context) {
            var effect = context.reactiveSystem.effect(function () { element.title = String(model[path]); });
            context.binder._trackCleanup(element, function () { context.reactiveSystem.cleanup(effect); });
        }
    });
    Stitch.DataBinder.registerBinding("note", {
        value: "literal",
        bind: function (element, model, text) { element.setAttribute("aria-description", text); }
    });

    function tick(ms) { return new Promise(function (resolve) { setTimeout(resolve, ms || 20); }); }
    function $(id) { return document.getElementById(id); }
    function texts(selector) {
        return Array.prototype.map.call(document.querySelectorAll(selector), function (e) { return e.textContent.trim(); });
    }
    function thrown(fn) {
        try { fn(); } catch (error) { return String(error && error.message); }
        return null;
    }
    function input(element, value) {
        element.value = value;
        element.dispatchEvent(new Event("input", { bubbles: true }));
    }

    StitchTest.test("value-bindings", async function (t) {
        var model = Stitch.Observable.create({
            name: "Ada",
            agree: false,
            qty: 2,
            showDetails: false,
            loading: false,
            greeting: Stitch.computed(function () { return "Hello, " + this.name; }),
            canSave: Stitch.computed(function () { return this.agree && this.name.length > 0; }),
            saveClass: Stitch.computed(function () { return { primary: this.agree }; }),
            linkAttrs: Stitch.computed(function () { return { href: "/people/" + encodeURIComponent(this.name), title: this.name }; }),
            styleAttrs: Stitch.computed(function () { return { style: { color: this.agree ? "green" : "red", fontWeight: "bold" } }; })
        });
        new Stitch.DataBinder().bind("#values", model);
        t.equal($("greeting").textContent, "Hello, Ada", "data-text");
        t.equal($("name").value, "Ada", "data-value writes the input");
        t.equal($("shown").style.display, "none", "data-visible hides through the CSSOM");
        t.equal($("save").disabled, true, "data-enabled");
        t.equal($("link").getAttribute("href"), "/people/Ada", "data-attr href");
        t.equal($("styled").style.color, "red", "data-attr style object through the CSSOM");
        input($("name"), "Grace");
        $("agree").click();
        input($("qty"), "5");
        model.showDetails = true;
        model.loading = true;
        await tick();
        t.equal(model.name, "Grace", "typing writes the model");
        t.equal(model.agree, true, "a checkbox writes a boolean");
        t.equal(model.qty, 5, "a number input writes a number");
        t.equal($("greeting").textContent, "Hello, Grace", "the text follows");
        t.equal($("shown").style.display, "", "data-visible shows");
        t.equal($("save").disabled, false, "data-enabled follows");
        t.equal($("save").classList.contains("primary"), true, "data-class object");
        t.equal($("styled").style.color, "green", "the style follows");
        t.equal($("busy").getAttribute("aria-busy"), "true", "data-loading sets aria-busy");
        t.equal($("busy").disabled, true, "data-loading disables");
    });

    StitchTest.test("handlers", async function (t) {
        var model = Stitch.Observable.create({
            count: 0,
            typedCount: 0,
            typedEvents: { input: "typed" },
            increment: function () { this.count++; },
            typed: function () { this.typedCount++; }
        });
        new Stitch.DataBinder().bind("#handlers", model);
        $("inc").click();
        $("inc").click();
        input($("typed"), "a");
        await tick();
        t.equal($("count").textContent, "2", "data-click");
        t.equal($("typed-count").textContent, "1", "data-event");
    });

    var listModel;
    StitchTest.test("keyed-list-reorder-and-filter", async function (t) {
        listModel = Stitch.Observable.create({
            rows: [{ sku: "a", label: "Alpha" }, { sku: "b", label: "Beta" }, { sku: "c", label: "Gamma" }],
            filter: "",
            options: ["red", "green"],
            picked: null,
            nodes: [{ id: 1, name: "root", children: [{ id: 2, name: "child", children: [{ id: 3, name: "grandchild", children: [] }] }] }],
            visibleRows: Stitch.computed(function () {
                var f = this.filter;
                return this.rows.filter(function (row) { return row.label.toLowerCase().indexOf(f) !== -1; });
            }),
            remove: function (row) { this.rows.splice(this.rows.indexOf(row), 1); }
        });
        new Stitch.DataBinder().bind("#lists", listModel);
        t.deepEqual(texts("#rows li span"), ["Alpha", "Beta", "Gamma"], "rows render");
        var gamma = document.querySelectorAll("#rows li")[2];
        listModel.rows.reverse();
        await tick();
        t.deepEqual(texts("#rows li span"), ["Gamma", "Beta", "Alpha"], "reorder");
        t.equal(document.querySelectorAll("#rows li")[0], gamma, "a moved row keeps its element");
        listModel.filter = "a";
        await tick();
        t.deepEqual(texts("#rows li span"), ["Gamma", "Beta", "Alpha"], "filter keeps matches");
        listModel.filter = "al";
        await tick();
        t.deepEqual(texts("#rows li span"), ["Alpha"], "filter removes rows");
        document.querySelector("#rows li button").click();
        await tick();
        t.equal(document.querySelectorAll("#rows li").length, 0, "a $root. handler removes a row");
        t.deepEqual(texts("#table td:first-child"), ["c", "b"], "the template list follows the same rows");
        t.deepEqual(texts("#table td:last-child"), ["0", "1"], "$index");
    });

    StitchTest.test("select-list", async function (t) {
        var select = $("pick");
        t.deepEqual(Array.prototype.map.call(select.options, function (o) { return o.textContent; }),
            ["Choose...", "red", "green"], "options and the placeholder");
        select.value = "green";
        select.dispatchEvent(new Event("change", { bubbles: true }));
        await tick();
        t.equal(listModel.picked, "green", "the choice is written back");
    });

    StitchTest.test("templates-and-nested-lists", function (t) {
        t.deepEqual(texts("#tree span"), ["root", "child", "grandchild"], "a recursive template renders every level");
    });

    StitchTest.test("custom-bindings", async function (t) {
        var model = Stitch.Observable.create({ tipText: "first" });
        new Stitch.DataBinder().bind("#custom", model);
        t.equal($("tip").title, "first", "a path custom binding");
        t.equal($("note").getAttribute("aria-description"), "Saved", "a literal custom binding");
        model.tipText = "second";
        await tick();
        t.equal($("tip").title, "second", "the custom binding follows the model");
    });

    StitchTest.test("later-errors-go-to-onerror", async function (t) {
        var errors = [];
        var remove = Stitch.onError(function (error) { errors.push(String(error.message)); });
        try {
            var model = Stitch.Observable.create({ attrs: { href: "/ok" }, cls: "a", items: [{ id: 1, name: "one" }] });
            new Stitch.DataBinder().bind("#later", model);
            model.attrs = { href: "javascript:top.__xss(9)" };
            await tick();
            model.cls = 42;
            await tick();
            model.items = [{ name: "no id" }];
            await tick();
            t.equal(errors.length, 3, "three later errors reached Stitch.onError: " + errors.join(" | "));
            t.ok(/^\[Stitch E323\]/.test(errors[0] || ""), "E323 (a javascript: URL)");
            t.ok(/^\[Stitch E302\]/.test(errors[1] || ""), "E302 (data-class of the wrong kind)");
            t.ok(/^\[Stitch E501\]/.test(errors[2] || ""), "E501 (a row without a key)");
            t.equal($("later-link").getAttribute("href"), "/ok", "the link keeps its last good value");
            t.deepEqual(texts("#later-list li"), ["one"], "the list keeps its last good rows");
        } finally {
            remove();
        }
    });

    StitchTest.test("bind-errors-throw-with-codes", function (t) {
        function host(tag, attribute, value) {
            var root = document.createElement("div");
            var element = document.createElement(tag);
            element.setAttribute(attribute, value);
            root.appendChild(element);
            return root;
        }
        var bind = function (root, data) { return thrown(function () { new Stitch.DataBinder().bind(root, Stitch.Observable.create(data)); }); };
        t.match(bind(host("span", "data-text", "nmae"), { name: "x" }) || "", /^\[Stitch E201\]/, "a missing property: E201");
        t.match(bind(host("span", "data-text", "a + b"), { a: 1, b: 2 }) || "", /^\[Stitch E102\]/, "an expression: E102");
        t.match(bind(host("span", "data-click", "nothing"), { a: 1 }) || "", /^\[Stitch E401\]/, "a missing handler: E401");
        t.match(bind(host("script", "data-text", "code"), { code: "top.__xss(8)" }) || "", /^\[Stitch E326\]/, "a script element: E326");
        t.match(bind(host("a", "data-attr", "a"), { a: { onclick: "top.__xss(8)" } }) || "", /^\[Stitch E321\]/, "an event handler: E321");
        t.match(bind(host("div", "data-attr", "a"), { a: { style: "color: red" } }) || "", /^\[Stitch E325\]/, "a style string: E325");
        var list = document.createElement("ul");
        list.setAttribute("data-foreach", "items");
        list.appendChild(document.createElement("li"));
        var root = document.createElement("div");
        root.appendChild(list);
        t.match(bind(root, { items: [{ name: "no id" }] }) || "", /^\[Stitch E501\]/, "a row without a key: E501");
    });

    StitchTest.test("xss-corpus-refused-under-the-policy", function (t) {
        var corpus = window.STITCH_XSS_CORPUS;
        var SVG = "http://www.w3.org/2000/svg";
        var wrong = 0;
        corpus.refused.forEach(function (entry) {
            var tag = entry.element;
            var element = tag.indexOf("svg:") === 0 ? document.createElementNS(SVG, tag.slice(4))
                : tag === "math" ? document.createElementNS("http://www.w3.org/1998/Math/MathML", "math")
                    : document.createElement(tag);
            element.setAttribute("data-attr", "attrs");
            var attrs = {};
            attrs[entry.attribute] = entry.value;
            var message = thrown(function () { new Stitch.DataBinder().bind(element, Stitch.Observable.create({ attrs: attrs })); });
            if (!message || message.indexOf("[Stitch " + entry.code + "]") !== 0) wrong++;
        });
        t.equal(wrong, 0, "every one of the " + corpus.refused.length + " corpus payloads is refused with its code");
    });

    StitchTest.test("no-policy-violation", async function (t) {
        await tick(50);
        t.ok(Array.isArray(window.__stitchCspViolations), "the runner's violation recorder is installed");
        t.deepEqual(window.__stitchCspViolations || null, [], "no policy violation so far");
    });

    // A payload that ever ran would throw (an uncaught error fails the page).
    window.__xss = function () { throw new Error("an XSS payload ran"); };
})();
