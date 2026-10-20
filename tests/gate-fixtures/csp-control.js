// Gate self-test fixture (see fixtures.js): one real passing test, from an external script.
StitchTest.plan(["ok"]);
StitchTest.test("ok", function (t) {
    var model = Stitch.Observable.create({ n: 1 });
    model.n = 2;
    t.equal(model.n, 2, "an observable holds a written value");
});
