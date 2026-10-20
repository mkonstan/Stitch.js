/*
 * THE suite list. One list, read by:
 *   - _tools/run-tests.js (`npm test`), which runs every page in `suites`
 *     against stitch.js and stitch.min.js, and fails if a test page exists
 *     that is not listed here, or an example page exists that is not in
 *     `examples`;
 *   - run-tests.html, which links each page for running by hand;
 *   - test-examples.html, which loads every page in `examples` and fails on
 *     any error.
 * Each suite page reports through tests/harness.js. Paths are relative to the
 * repository root.
 */
(function (root, factory) {
    var lists = factory();
    if (typeof module !== "undefined" && module.exports) {
        module.exports = lists;
    } else {
        root.STITCH_SUITES = lists.suites;
        root.STITCH_EXAMPLES = lists.examples;
    }
})(this, function () {
    "use strict";
    var suites = [
        { page: "test-core-reactivity.html", title: "Core reactivity", about: "Property updates, nested objects, text binding" },
        { page: "test-computed-properties.html", title: "Computed properties", about: "Top-level, nested, array-dependent and chained computeds" },
        { page: "test-array-reactivity.html", title: "Array reactivity", about: "Mutators, index writes, nested arrays, foreach rendering" },
        { page: "test-map-set-reactivity.html", title: "Map and Set reactivity", about: "Map/Set size, get, has and iteration through computeds and bindings" },
        { page: "test-messagebus.html", title: "MessageBus", about: "Events, wildcards, middleware, once/off" },
        { page: "test-all-bindings.html", title: "Bindings", about: "text, value, visible, enabled, class, attr, click, event" },
        { page: "test-edge-cases.html", title: "Edge cases", about: "Null/undefined values, circular references, rapid updates" },
        { page: "test-dispose.html", title: "Dispose", about: "DataBinder.dispose and listener cleanup" },
        { page: "test-custom-bindings.html", title: "Custom bindings", about: "DataBinder.registerBinding: arguments, effects, cleanup on unbind/dispose, rows" },
        { page: "test-foreach-rendering.html", title: "Foreach rendering", about: "Nested lists, computed-filtered lists, replaced lists, hide/show" },
        { page: "test-foreach-keys.html", title: "Foreach keys", about: "The key rule (id / data-key / plain values, missing and duplicate keys throw) and the one-root rule, on every list path" },
        { page: "test-foreach-lifecycle.html", title: "Foreach lifecycle", about: "Removed rows release their bindings (filter, hide/show, select, replacement, nested); same key + same object reuses the row" },
        { page: "test-reactive-lifecycle.html", title: "Reactive lifecycle", about: "Released effects stop and drop every subscription (computeds included); ReactiveSystem.dispose(); Stitch.debug.stats()" },
        { page: "test-strict-bindings.html", title: "Strict bindings", about: "Bindings found by selector over registered names; invalid syntax, missing properties and misplaced internal attributes throw; Stitch.onBindReport; registerBinding rules" },
        { page: "test-handler-paths.html", title: "Handler paths", about: "data-click / data-event handlers: bare name (current row), $parent., $root.; called with (rowItem, event); a miss throws with where it exists" },
        { page: "test-api-arguments.html", title: "API arguments", about: "Every entry point that takes a selector, element, handler or event name throws on an invalid argument or no match" },
        { page: "test-error-routing.html", title: "Error routing", about: "Errors in reactive updates go to Stitch.onError or are re-thrown uncaught; the DOM keeps its last good state; model.on() fires without readers" },
        { page: "test-unbind-memory.html", title: "Unbind", about: "An unbound element stops updating" },
        { page: "test-foreach-context.html", title: "Foreach context", about: "Row context ($index, $parent) does not leak between lists" },
        { page: "test-bubble-perf.html", title: "Deep bubbling", about: "Change bubbling through 100 nesting levels stays correct and bounded" },
        { page: "property-hooks-test.html", title: "Property hooks", about: "onBind / onChange / onUnbind hooks" },
        { page: "test-v3-defects.html", title: "v3 defects", about: "The known v2 defects, asserted at their v3 target behaviour" },
        { page: "test-examples.html", title: "Examples smoke", about: "Every public example page loads with no page error, console error or failed request" },
        { page: "test-api-contracts.html", title: "API contracts", about: "Removers from $watch/$onChange, boolean isReactive, computed argument, frozen data refused, bind report covers data-type, custom-binding literal hint, error codes" },
        { page: "test-attr-safety.html", title: "Attribute safety", about: "data-attr refuses every value that could run script (the XSS corpus), with its code, writing nothing; legitimate values work; style through the CSSOM; code elements are not bound" },
        { page: "test-strict-csp.html", csp: true, title: "Strict CSP", about: "Every binding, keyed lists, templates, custom bindings, onError, error paths and the XSS corpus, served with a strict Content-Security-Policy (no inline script or style, Trusted Types); any violation fails" },
        { page: "test-doc-snippets.html", title: "Executable docs", about: "Every html/js code block in the docs runs; mistakes throw their documented message" }
    ];
    // Every public example page (example*.html at the root). The runner fails if one is missing.
    var examples = [
        "example-17-cascading-dropdowns.html",
        "example-18-dynamic-validation.html",
        "example-19-shopping-cart.html",
        "example-20-editable-table.html",
        "example-21-conditional-forms.html",
        "example-22-search-filter.html",
        "example-23-wizard.html",
        "example-24-nested-computed.html",
        "example-25-event-binding.html",
        "example-26-dropdown-without-value.html",
        "example-27-attr-class-bindings.html",
        "example-basic-demo.html",
        "example-nested-computed.html"
    ];
    // Acceptance tests (tests/acceptance/*.spec.js): Playwright specs that drive a page like a
    // user, against the page path each spec names. The pages are built from the docs alone by an
    // agent that has never seen Stitch (tests/acceptance/TASKS.md), so they do not exist until
    // then. pending is false (npm test runs the spec) or { reason, sprint }: npm test lists it as
    // PENDING and does not run it; `npm run test:acceptance` runs every entry on both builds.
    // Guards: only specs under tests/acceptance/ may be pending, and a pending spec whose page
    // exists fails `npm test` (set pending to false once the page is committed).
    // The three pages below were written by an agent that had only the docs and TASKS.md (the
    // fresh-agent gate); they passed these specs on the first try and are kept unedited.
    var acceptance = [
        { spec: "tests/acceptance/tree.spec.js", pending: false },
        { spec: "tests/acceptance/list.spec.js", pending: false },
        { spec: "tests/acceptance/form.spec.js", pending: false }
    ];
    return { suites: suites, examples: examples, acceptance: acceptance };
});
