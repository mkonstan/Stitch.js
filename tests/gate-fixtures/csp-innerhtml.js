// Gate self-test fixture (see fixtures.js): an HTML-string sink under Trusted Types. The
// TypeError is caught, so only the policy violation can reveal it.
StitchTest.plan(["ok"]);
StitchTest.test("ok", function (t) {
    var div = document.createElement("div");
    try { div.innerHTML = "<b>injected</b>"; } catch (_error) { /* swallowed on purpose */ }
    t.ok(true, "the page carries on");
});
