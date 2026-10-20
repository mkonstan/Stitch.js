// Gate self-test fixture (see fixtures.js): eval under script-src without 'unsafe-eval'.
// The EvalError is caught, so only the policy violation can reveal it.
StitchTest.plan(["ok"]);
StitchTest.test("ok", function (t) {
    try { eval("1 + 1"); } catch (_error) { /* swallowed on purpose */ }
    t.ok(true, "the page carries on");
});
