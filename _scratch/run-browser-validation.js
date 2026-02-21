const path = require("path");
const { pathToFileURL } = require("url");
const { chromium } = require("playwright");

const ROOT = process.cwd();

const SUITES = [
  "test-computed-properties.html",
  "test-array-reactivity.html",
  "test-core-reactivity.html",
  "test-messagebus.html",
  "test-all-bindings.html",
  "test-edge-cases.html",
  "test-dispose.html",
];

function fileUrl(file) {
  return pathToFileURL(path.join(ROOT, file)).href;
}

async function runSuite(browser, file) {
  const page = await browser.newPage();
  const consoleMessages = [];
  const pageErrors = [];

  page.on("console", (msg) => {
    consoleMessages.push({
      type: msg.type(),
      text: msg.text(),
    });
  });

  page.on("pageerror", (err) => {
    pageErrors.push(err.message || String(err));
  });

  await page.goto(fileUrl(file), { waitUntil: "load" });

  const summaryReadyPredicate = () => {
    const totalEl = document.getElementById("totalTests");
    const passedEl = document.getElementById("passedTests");
    const failedEl = document.getElementById("failedTests");
    if (!totalEl || !passedEl || !failedEl) return false;

    const total = Number(totalEl.textContent || "0");
    const passed = Number(passedEl.textContent || "0");
    const failed = Number(failedEl.textContent || "0");

    return total > 0 && passed + failed === total;
  };

  // Many suites auto-run; wait first.
  let summaryReady = false;
  try {
    await page.waitForFunction(summaryReadyPredicate, { timeout: 5000 });
    summaryReady = true;
  } catch {
    summaryReady = false;
  }

  // If not auto-run, attempt manual run.
  if (!summaryReady) {
    try {
      await page.evaluate(() => {
        if (typeof window.runAllTests === "function") {
          window.runAllTests();
        }
      });
    } catch (error) {
      pageErrors.push(error && error.message ? error.message : String(error));
    }

    try {
      await page.waitForFunction(summaryReadyPredicate, { timeout: 20000 });
      summaryReady = true;
    } catch {
      summaryReady = false;
    }
  }

  await page.waitForTimeout(summaryReady ? 100 : 500);

  const summary = await page.evaluate(() => {
    const total = Number(document.getElementById("totalTests")?.textContent || "0");
    const passed = Number(document.getElementById("passedTests")?.textContent || "0");
    const failed = Number(document.getElementById("failedTests")?.textContent || "0");

    const failedCases = Array.from(document.querySelectorAll(".test-case.fail .test-title"))
      .map((el) => el.textContent.trim());

    const failedAssertions = Array.from(document.querySelectorAll(".assertion.fail"))
      .map((el) => el.textContent.trim());

    return { total, passed, failed, failedCases, failedAssertions };
  });

  await page.close();
  return {
    file,
    ...summary,
    consoleErrors: consoleMessages.filter((m) => m.type === "error").map((m) => m.text),
    consoleWarnings: consoleMessages.filter((m) => m.type === "warning").map((m) => m.text),
    pageErrors,
  };
}

async function runTargetedChecks(browser) {
  const page = await browser.newPage();
  const consoleMessages = [];
  const pageErrors = [];

  page.on("console", (msg) => {
    consoleMessages.push({
      type: msg.type(),
      text: msg.text(),
    });
  });

  page.on("pageerror", (err) => {
    pageErrors.push(err.message || String(err));
  });

  await page.goto(fileUrl("test-core-reactivity.html"), { waitUntil: "load" });

  const checks = await page.evaluate(async () => {
    const out = {};

    // Finding 1: Map/Set size access
    out.mapSetSize = {};
    try {
      const model = Stitch.Observable.create({ m: new Map([["a", 1]]), s: new Set(["x"]) });
      out.mapSetSize.mapSize = model.m.size;
      out.mapSetSize.setSize = model.s.size;
      out.mapSetSize.ok = true;
    } catch (error) {
      out.mapSetSize.ok = false;
      out.mapSetSize.error = error && error.message ? error.message : String(error);
    }

    // Finding 2: Array mutators not invalidating index deps
    out.arrayIndexInvalidation = {};
    try {
      const model = Stitch.Observable.create({
        arr: [1, 2, 3],
        first: Stitch.computed(function () {
          return this.arr[0];
        }),
      });

      let watchCalls = 0;
      model.$watch("arr.0", () => {
        watchCalls++;
      });

      const initial = model.first;
      model.arr.reverse();
      const afterReverse = model.first;
      model.arr.shift();
      const afterShift = model.first;

      out.arrayIndexInvalidation = {
        initial,
        afterReverse,
        afterShift,
        watchCalls,
        expectedAfterReverse: 3,
        expectedAfterShift: 2,
      };
    } catch (error) {
      out.arrayIndexInvalidation.error = error && error.message ? error.message : String(error);
    }

    // Finding 3: Set identity behavior
    out.setIdentity = {};
    try {
      const raw = [];
      const model = Stitch.Observable.create({ s: new Set() });
      model.s.add(raw);
      const hasRawAfterAdd = model.s.has(raw);
      model.s.add(raw);
      const iterCountAfterSecondAdd = Array.from(model.s).length;
      const deleteRaw = model.s.delete(raw);
      const iterCountAfterDelete = Array.from(model.s).length;

      out.setIdentity = {
        hasRawAfterAdd,
        iterCountAfterSecondAdd,
        deleteRaw,
        iterCountAfterDelete,
      };
    } catch (error) {
      out.setIdentity.error = error && error.message ? error.message : String(error);
    }

    // Finding 4: event binding listener accumulation
    out.eventBindingDup = {};
    try {
      const host = document.createElement("div");
      host.innerHTML = '<button id="dup-btn" data-event="eventConfig">Click</button>';
      document.body.appendChild(host);

      let clickCount = 0;
      const model = Stitch.Observable.create({
        eventConfig: { click: "onClick" },
        onClick: function () {
          clickCount++;
        },
      });

      const binder = new Stitch.DataBinder();
      binder.bind(host, model);

      // Trigger effect reruns
      model.onClick = function () {
        clickCount++;
      };
      model.onClick = function () {
        clickCount++;
      };

      await Promise.resolve();
      await Promise.resolve();

      document.getElementById("dup-btn").dispatchEvent(new Event("click", { bubbles: true }));

      out.eventBindingDup = {
        clickCount,
      };
    } catch (error) {
      out.eventBindingDup.error = error && error.message ? error.message : String(error);
    }

    // Finding 5: global DataBinder hooks usage
    out.globalHooks = {};
    try {
      let onBindCalls = 0;
      let onChangeCalls = 0;

      const host = document.createElement("div");
      host.innerHTML = '<span id="hook-text" data-text="msg"></span>';
      document.body.appendChild(host);

      const model = Stitch.Observable.create({ msg: "a" });
      const binder = new Stitch.DataBinder({
        onBind: function () {
          onBindCalls++;
        },
        onChange: function () {
          onChangeCalls++;
        },
      });

      binder.bind(host, model);
      model.msg = "b";
      await Promise.resolve();
      await Promise.resolve();

      out.globalHooks = {
        onBindCalls,
        onChangeCalls,
        renderedText: document.getElementById("hook-text").textContent,
      };
    } catch (error) {
      out.globalHooks.error = error && error.message ? error.message : String(error);
    }

    // Finding 6: class binding with null
    out.classNull = {};
    try {
      const capturedErrors = [];
      const origError = console.error;
      console.error = (...args) => {
        capturedErrors.push(args.map((x) => String(x)).join(" "));
        origError.apply(console, args);
      };

      const host = document.createElement("div");
      host.innerHTML = '<div id="class-target" data-class="classState" class="base"></div>';
      document.body.appendChild(host);

      const model = Stitch.Observable.create({ classState: { active: true } });
      const binder = new Stitch.DataBinder();
      binder.bind(host, model);

      model.classState = null;
      await Promise.resolve();
      await Promise.resolve();

      console.error = origError;

      out.classNull = {
        className: document.getElementById("class-target").className,
        capturedErrors,
      };
    } catch (error) {
      out.classNull.error = error && error.message ? error.message : String(error);
    }

    return out;
  });

  await page.close();
  return {
    checks,
    consoleErrors: consoleMessages.filter((m) => m.type === "error").map((m) => m.text),
    consoleWarnings: consoleMessages.filter((m) => m.type === "warning").map((m) => m.text),
    pageErrors,
  };
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  try {
    const suiteResults = [];
    for (const file of SUITES) {
      suiteResults.push(await runSuite(browser, file));
    }
    const targeted = await runTargetedChecks(browser);
    const report = {
      generatedAt: new Date().toISOString(),
      suites: suiteResults,
      targeted,
    };
    process.stdout.write(JSON.stringify(report, null, 2));
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
