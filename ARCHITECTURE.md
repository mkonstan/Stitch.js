# Stitch.js - Architecture, Build, and Bootstrap Guide

This document is the source-of-truth technical map for both humans and cold AI instances.

Use this when you need to:
- understand where runtime behavior lives,
- build `stitch.js` and `stitch.min.js` from modular sources,
- run the test gate,
- make safe changes with minimal regression risk.

## 1. TL;DR

- Runtime source-of-truth is the modular workspace under `packages/*`.
- `stitch.js` and `stitch.min.js` are generated (do not hand-edit them).
- Build entrypoint is `stitch.entry.js`; builder is `_tools/build-stitch-assembly.js`; minifier is `minify.js`.
- The version has one source: the `version` field of the root `package.json`.
- Generated outputs (committed, and checked byte-for-byte by `npm test`):
  - `stitch.js`
  - `dist/stitch.assembled.js` (identical copy of `stitch.js`)
  - `stitch.min.js`
- Quality gate: `npm test` (static checks, every suite on both builds, gate self-tests).

## 2. Bootstrap in 5 Minutes

1. Install dependencies:
```bash
npm install
npx playwright install chromium firefox webkit
```

2. Build generated artifacts from modular sources:
```bash
npm run build
```

3. Run the gate:
```bash
npm test
```

`npm test` exits 0 only when everything in section 7 holds.

## 3. Runtime Architecture

### 3.1 Top-Level Runtime Surface

`stitch.entry.js` composes four packages:
- `@stitch/api` (`packages/api/index.js`)
- `@stitch/browser` (`packages/browser/index.js`)
- `@stitch/core` (`packages/core/index.js`)
- `@stitch/utils` (`packages/utils/index.js`)

It exposes:
- `Stitch.Observable`
- `Stitch.DataBinder`
- `Stitch.MessageBus`
- `Stitch.computed`
- `Stitch.version`
- `Stitch.debug`

### 3.2 Data and Effect Flow

1. `Observable.create()` (API layer) creates reactive objects via a **shared default factory** (`getDefaultFactory()`). All observables share a single `ReactiveSystem`, `BatchScheduler`, and `proxyMap` by default. Pass `{ isolated: true }` to `Observable.create()` for an independent system.
2. `ReactiveSystem` (core layer) tracks dependencies in `WeakMap -> Map -> Set`.
3. Property writes trigger synchronous dependency invalidation:
- computed refs are marked dirty immediately,
- non-batched effects run immediately,
- batched effects queue in `BatchScheduler`.
4. Because observables share a `ReactiveSystem` by default, effects can track dependencies across observable boundaries, and batched updates coalesce into a single microtask flush.
5. `DataBinder` (browser layer) installs binding handlers that create effects for DOM updates.
6. DOM effects are usually `{ batch: true }`, so updates flush on microtask boundaries.
7. `Observable.reset()` discards the shared factory for test isolation. Existing observables retain their old factory; new ones get a fresh system.

### 3.3 MessageBus Role

Each observable created via `Observable.create()` gets its own per-model `MessageBus` for the user-facing event API (`$on`, `$emit`, `$off`, `$once`, `$use`). Events do not leak across unrelated observables.

The shared `ReactiveSystem` has a separate internal `MessageBus` for framework events (`nested-change`, `array-mutation`), which are payload-scoped to specific targets. Subscribing to these internal events via `$on()` is deprecated since v2.0; use `$watch()` instead.

Core property dependency tracking is handled by `ReactiveSystem`, not MessageBus.

## 4. Package and Module Inventory (24 Reachable Modules)

### 4.1 API Package (`packages/api`)

| Module | Role | Used by |
|---|---|---|
| `packages/api/index.js` | API package entry exports Observable/computed/factory/version | `stitch.entry.js` |
| `packages/api/src/observable.js` | Public Observable API (`create`, `createArray`, `reactive`, `computed`, `reset`, watch/event helpers). Each `create()` call gets a per-model MessageBus. | app code, `stitch.entry.js` |
| `packages/api/src/reactive-factory.js` | Reactive object/array/map/set creation via `createReactiveFactory()`. Shared collection infrastructure via `createReactiveCollection()`. Default singleton via `getDefaultFactory()`/`resetDefaultFactory()`. Computed descriptor wiring, bubbling, proxy identity cache. | `Observable` |

### 4.2 Core Package (`packages/core`)

| Module | Role | Used by |
|---|---|---|
| `packages/core/index.js` | Core package entry exports scheduler/system/computed/message bus/version | `stitch.entry.js` |
| `packages/core/src/message-bus.js` | Async queued pub/sub + middleware + wildcard + depth guard | `ReactiveSystem`, app event usage |
| `packages/core/src/batch-scheduler.js` | Batched effect queue + dedupe + microtask flush + loop guard | `ReactiveSystem` |
| `packages/core/src/computed-ref.js` | ComputedRef dirty/evaluate/cache/dependent propagation | `ReactiveFactory` |
| `packages/core/src/reactive-system.js` | Track/trigger/effect engine; `cleanup(effect)` releases an effect for good, `dispose()` releases the whole system; live counts; nested change/array-mutation subscriptions | API + browser runtime |

### 4.3 Browser Package (`packages/browser`)

| Module | Role | Used by |
|---|---|---|
| `packages/browser/index.js` | Browser package entry; composes runtime dependencies and exports `DataBinder` + helpers | `stitch.entry.js` |
| `packages/browser/src/data-binder.js` | `DataBinder` class factory: finds Stitch's attributes by selector, checks each binding before binding it, hook dispatch, cleanup/dispose lifecycle, `registerBinding` rules, `onBindReport` | app code |
| `packages/browser/src/binding-runtime.js` | Built-in binding handler registry (strict reads; errors on re-runs go to `Stitch.onError`) | `DataBinder` |
| `packages/browser/src/binding-scan-helpers.js` | Binding discovery: the selector over registered names and internal attributes, per-element lookup, the opt-in bind report | `DataBinder` |
| `packages/browser/src/binding-paths.js` | The one grammar and lookup for binding values: property-path syntax, strict reads (missing property throws), `$parent.` / `$root.` handler lookup | `DataBinder`, binding runtime, foreach |
| `packages/browser/src/foreach-binding-orchestrator.js` | The one foreach implementation for every list element (`<select>` included): row template (one-root rule), keyed reconciliation, row release | `binding-runtime` |

### 4.4 Utils Package (`packages/utils`)

| Module | Role | Used by |
|---|---|---|
| `packages/utils/index.js` | Utils package entry: `Stitch.debug` (read-only `stats()`; there is no debug mode), `onError`, utility exports | `stitch.entry.js`, other packages |
| `packages/utils/src/runtime-helpers.js` | `getProperty`, `setProperty`, `assertPathExists`, arrow-function detection | API + browser |
| `packages/utils/src/error-hook.js` | `Stitch.onError`: where errors raised inside reactive updates go (re-thrown uncaught when no handler) | core, browser |
| `packages/utils/src/attr-value-handlers.js` | `data-attr` writes (style through the CSSOM) and the refusals for values that could run script (event-handler names, srcdoc, javascript:/vbscript:/data: URLs, style strings) | browser binding runtime |
| `packages/utils/src/value-binding-helpers.js` | value validators and value handlers (input/select/radio/number/range/default) | browser binding runtime |
| `packages/utils/src/type-converters.js` | converter registry (`int`, `float`, `boolean`, `string`, `date`, `datetime`, `auto`) | value binding helpers |
| `packages/utils/src/foreach-keys.js` | The list key rule (`id` / `data-key` / plain values; missing or duplicate keys throw) | foreach binding |
| `packages/utils/src/foreach-row-context.js` | Row binding context (`$data`, `$index`, `$parent`, `$root`) | foreach binding |
| `packages/utils/src/reactive-stats.js` | Live effect and subscription counts behind `Stitch.debug.stats()` | reactive system, utils debug facade |
| `packages/utils/src/version.js` | The release version: reads the root `package.json` when unbuilt; the build stamps it as a constant in the bundle | every package entry and versioned class |
| `packages/utils/src/reactive-object-helpers.js` | `defineHidden()` helper, change-handler add/remove, and `toJSON` serialization helpers | reactive factory, observable |

## 5. Repository Resource Map

### 5.1 Runtime Artifacts

| Path | Role |
|---|---|
| `stitch.entry.js` | canonical distribution entry that composes packages |
| `stitch.js` | generated single-file bundle |
| `dist/stitch.assembled.js` | generated; identical to `stitch.js` |
| `stitch.min.js` | generated; terser minification of `stitch.js` |

### 5.2 Build and Test Tooling

| Path | Role |
|---|---|
| `_tools/build-stitch-assembly.js` | assembly builder: module discovery, reachability graph, inline prelude, version stamping, metadata |
| `minify.js` | terser minification of `stitch.js` into `stitch.min.js` |
| `_tools/run-tests.js` | `npm test`: static checks, browser suites on three engines and both builds, gate self-tests |
| `_tools/check-repo.js` | static checks: version literal, stale version, local paths, missing references, build-match, no console, no random ids, bundle require, no HTML sinks, browser support, and the documentation checks |
| `_tools/doc-checks.js` | the documentation checks: doc-snippets, api-coverage, error-coverage, doc-hygiene |
| `tests/doc-snippets.js` | the doc-snippet parser and browser runner; `DOC_SET` lists the documents whose code blocks run |
| `test-doc-snippets.html` | the suite page that runs every runnable code block of `DOC_SET` |
| `test-strict-csp.html`, `tests/strict-csp.js` | the strict-CSP suite (served with the policy; see 7.4) |
| `test-attr-safety.html`, `tests/attr-safety.js`, `tests/xss-corpus.js` | the attribute XSS corpus: every payload refused with its code, legitimate values still work |
| `tests/suites.js` | THE suite list (read by the runner and by `run-tests.html`): suite pages, example pages, acceptance specs |
| `tests/acceptance/` | acceptance specs (Playwright, drive a page like a user), their helpers, and `TASKS.md` (what each page must do) |
| `tests/harness.js` | in-page reporting protocol every suite uses |
| `tests/known-failing.json` | tests that fail today because of a known defect, with the defect and the planned fix |
| `tests/gate-fixtures/` | gate self-test fixtures (pages plus `fixtures.js`) |
| `run-tests.html` | the suite list as links, for running pages by hand |

Generated reports go to `_scratch/` (gitignored): `_scratch/test-report.json` and the self-test trees.

### 5.3 Test Suites

The list lives in `tests/suites.js`; do not repeat it elsewhere. Every `test-*.html` or
`*-test.html` page, and every page that loads `tests/harness.js`, must be in that list or
`npm test` fails.

## 6. Build and Assembly Walkthrough (Detailed)

### 6.1 Preconditions

- Node.js 18+
- npm workspace install complete
- Playwright Chromium, Firefox and WebKit installed for the browser suites
  (`npx playwright install chromium firefox webkit`; CI adds `--with-deps`)

### 6.2 Build Commands

- Build everything (bundle, then minified bundle):
```bash
npm run build
```

- Bundle only, or minified only:
```bash
npm run build:assembly
npm run build:min
```

- Build with all modules inlined (diagnostic mode; do not commit its output):
```bash
npm run build:assembly:all
```

### 6.3 What the Builder Actually Does

`_tools/build-stitch-assembly.js`:
1. Reads `stitch.entry.js`.
2. Enumerates package module files (`packages/*/index.js` and `packages/*/src/*.js`).
3. Resolves internal module graph via `require()` pattern rewrite to `__stitchRequire()`.
4. Assigns **numeric module IDs** (0, 1, 2, ...) to replace path strings in the registry and require calls. A `moduleMap` in the metadata preserves path-to-ID mapping for debugging.
5. Selects modules by mode:
- `reachable`: only transitively reachable from entrypoint
- `all`: all discovered modules
6. Stamps the version: `packages/utils/src/version.js` is replaced in the bundle by a constant taken from `package.json`.
7. Emits inline module prelude + patched entry.
8. Stamps a `/*!` metadata comment (preserved through Terser minification):
- `source`, `mode`, `moduleCount`, `availableModuleCount`, `modules[]`, `moduleMap`.
- No timestamp: the output depends only on the sources, so a rebuild of unchanged sources is byte-identical.
9. Prepends a `/*!` license banner with the `package.json` version and the repository URL.
10. Writes output to both `dist/stitch.assembled.js` and `stitch.js`.

### 6.4 Output Integrity Expectations

- `stitch.js` and `dist/stitch.assembled.js` equal a fresh assembly of `packages/*`.
- `stitch.min.js` equals a fresh minification of that assembly.
- `npm test` (build-match) and CI (`npm run build`, then `git diff --exit-code`) both enforce this.

## 7. The Test Gate (`npm test`)

`node _tools/run-tests.js` runs, in order:

1. **Static checks** (`_tools/check-repo.js`, also `npm run test:static`):
   - version-literal: the `package.json` version string appears nowhere else (the generated bundles and npm's lock-file root fields are excepted, and checked);
   - stale-version: no other version is named as a Stitch version (`v` or `Version ` before x.y.z); history docs (`docs/history/`) are exempt, and so is the end of `MIGRATION.md` below its `<!-- history: ... -->` line;
   - local-path: no absolute local path (drive letters, home directories, file URLs) in any file;
   - missing-reference: every file a doc or page points to exists, every `#heading` a markdown link points to exists (GitHub anchor rules), and every `npm run` script mentioned exists;
   - build-match: see 6.4;
   - no-console, no-random-ids, bundle-require: the library never logs, ids are counters, the bundle never calls `require()`;
   - no-html-sinks: nothing the library ships (`packages/`, `stitch.entry.js`, the generated bundles; comments included) writes an HTML string (`innerHTML`, `outerHTML`, `insertAdjacentHTML`, `document.write`, `createContextualFragment`, `DOMParser`, `srcdoc`), a script string (`eval`, `new Function`, a string timer) or a style string (`cssText`, a `style` attribute, `element.style = ...`); so the library runs under Trusted Types and `style-src` without `'unsafe-inline'`;
   - browser-support: the newest JavaScript and DOM features the library uses (read from `packages/` with comments and strings removed) are each listed in README's "Browser support" table, and its minimum versions are the highest of theirs; no browser version is claimed anywhere else outside `docs/history/`. It sees only the features in its `FEATURES` table and reads `packages/`, not what terser emits; the minified build is run only on the three current engines, and the minimums are derived, never run on old browsers;
   - doc-snippets: every ```` ```html ```` / ```` ```js ```` block of a public markdown document carries a mode (`run`, `page`, `throws`, `fragment`), and every such document is in `DOC_SET` (see 7.1);
   - api-coverage: the public surface read from the code (`window.Stitch` and what hangs off it, the model helpers, the bindings and the attributes Stitch reads, the row-context names) and the `###` headings of `docs/API.md` match in both directions; code spans in the guides that name an API must name a real one;
   - error-coverage: by code, both ways. Every error built in `packages/` starts with a stable code (`[Stitch E###]`; an error without one fails); every code has one `### E###: title` entry in `docs/ERRORS.md` with a Cause, a Fix and a `**Message:**` line equal to the message's static text (`…` for run-time parts); every entry's code is thrown; two sites using one code for different messages fail. Codes are public API: grouped by area (first digit), numbered once, never reused;
   - doc-hygiene: public documents state rules, not private project history: no decision numbers, triage numbers or paths into private notes.
2. **Browser suites**: every page in `tests/suites.js`, on three engines (Playwright Chromium, Firefox and
   WebKit, which stand for Chrome and Edge, Firefox, and Safari), each served over its own local HTTP server.
   The engines run side by side; within an engine, pages run one at a time. Each page's `stitch.js` request is
   answered with the build under test: first `stitch.js`, then `stitch.min.js`. An engine that cannot be launched
   fails the run (Chromium alone may fall back to an installed Chrome or Edge).
3. **Acceptance specs**: every entry of `acceptance` in `tests/suites.js` that is not `pending`, on every engine and
   both builds (see 7.2).
4. **Gate self-tests**: each fixture in `tests/gate-fixtures/fixtures.js` re-runs the gate on a deliberately broken
   input and requires a non-zero exit with the stated reason (controls must pass).

A page fails the gate when it: never loads the build under test; logs an uncaught error or a console error; has a
failed request; never finishes; plans zero tests; reports a test twice, late, unplanned or skipped; or leaves a
planned test unreported; or makes an assertion after its test has settled; or violates a Content-Security-Policy
(every page, see 7.4). `window.Stitch` must expose exactly the public surface and the `package.json` version.

Per test, against `tests/known-failing.json`:
- failed and listed, with exactly the failures named in its `expect` list: counted as known-failing (not fatal).
  `expect` holds one assertion-message prefix per failed assertion, matched on a word boundary; each prefix must be
  at least 3 words and 15 characters, must match exactly one failure line, and may not start with `threw`,
  `precondition`, `control`, `harness` or another harness message (such prefixes are refused at load);
- failed and listed, but for any other reason (another assertion failed, it threw, or an expected failure is absent): FATAL;
- passed and listed: FATAL, remove the entry (each fix removes its own marker);
- failed and not listed: FATAL;
- a listed entry that matches no test: FATAL.

The summary prints `passed / known-failing / failed / skipped` per engine and build. The full report is
`_scratch/test-report.json` (with each engine's browser version and time).

CI (`.github/workflows/test.yml`) installs the three engines, runs `npm run build`, `git diff --exit-code`, then `npm test`.

### 7.1 Executable documentation

The public documents (README, AGENTS.md, CHANGELOG.md, MIGRATION.md, docs/GUIDE.md, docs/API.md,
docs/ERRORS.md, docs/ACCESSIBILITY.md: `DOC_SET` in `tests/doc-snippets.js`) are tests. `test-doc-snippets.html` runs every
`run` and `throws` block in its own iframe against the build under test:

- `run`: must not throw (now or in a later update) and must not log a console error;
- `page`: markup only, used as the page of the next `js` block;
- `throws`: must throw an error whose message contains the first code span of the `Throws:` line
  after the block;
- `fragment`: not run (signatures, partial lines), counted per document;
- hidden `<!-- check: expression -->` comments after a block must evaluate to `true` in the
  snippet's page (helpers: `text`, `texts`, `count`, `visible`, `checked`, `attr`, `click`,
  `type`, `tick`).

Gate fixtures prove that a snippet that throws, a `throws` block that does not throw or throws
another message, a false check, and an error raised later in an update each fail the run.

### 7.2 Acceptance specs

`tests/acceptance/*.spec.js` export `{ page, tests: { id: async ({ page, ui }) => {...} } }`. Each test
opens the page fresh and drives it through Playwright (`ui` is `tests/acceptance/helpers.js`:
lookups by `data-testid`, retrying checks, typing like a user). A test fails on a failed assertion,
a throw, a 15 s timeout, a missing page, or a page error, console error or failed request while it
runs. The pages are written from the documentation alone (`tests/acceptance/TASKS.md`), so an entry
stays pending until its page is committed: `pending: { reason, sprint }` (both required), and
`npm test` prints it as PENDING (and counts it under the summary) but does not run it;
`npm run test:acceptance` runs every entry, pending or not, on both builds. Guards, like the
known-failing flip guard: only specs under `tests/acceptance/` may be pending; a pending entry whose
page exists fails `npm test` ("remove pending"); a non-pending entry whose page does not exist fails
the suite list. Gate fixtures cover a failing spec, a console error, a missing page, and each guard.

### 7.3 What the documentation checks do not prove

`api-coverage` proves that the API headings and the code name the same members; it does not read
the signatures or the prose under a heading. `error-coverage` proves that codes and message texts
match; it does not read the Cause and Fix prose. Prose is verified only where an executed snippet
exercises it (`run` blocks with checks, `throws` blocks), so a new rule should come with one.

### 7.4 The strict-CSP suite

A page listed in `tests/suites.js` with `csp: true` is served with

```text
Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self';
  require-trusted-types-for 'script'; object-src 'none'; base-uri 'none'
```

(`STRICT_CSP` in `_tools/run-tests.js`): no inline script or style, no `eval`, Trusted Types
required for every script-bearing DOM sink. `test-strict-csp.html` is that page: it has no inline
script and no inline style (its tests are in `tests/strict-csp.js`) and exercises every binding,
keyed lists (reorder, filter, removal), a select list, recursive templates, path and literal custom
bindings, errors routed to `Stitch.onError`, coded errors from `bind()`, and the whole XSS corpus.

On every page (CSP or not) the runner installs a `securitypolicyviolation` recorder before any page
script runs (a Playwright init script, which the policy does not block); every recorded violation is
a page problem, and so is a CSP page whose response did not carry the policy. Gate fixtures prove,
on each engine, that an inline style, an inline script and a swallowed `eval` fail the run, and, on
Chromium and WebKit (WebKit 26; older Safari versions do not enforce Trusted Types), that a
swallowed `innerHTML` write does (Trusted Types). Firefox ignores
`require-trusted-types-for` (it logs "unknown directive"), so on Firefox the HTML-sink guarantee
rests on the `no-html-sinks` static check.

`test-doc-snippets.html` is NOT a CSP page, by design: it runs documentation snippets in `srcdoc`
iframes with inline scripts and evaluates their checks with `eval`. The library code those snippets
call is the same code the CSP suite runs under the policy. Most other suite pages also use inline
scripts and are not CSP pages: they test the library's behaviour, and the CSP suite tests that the
same behaviour holds under the policy.

## 8. Common Change Workflows

### 8.1 Modify Runtime Logic Safely

1. Edit module under `packages/*/src/*`.
2. Run:
```bash
npm run build
npm test
```
3. Commit the sources and the regenerated `stitch.js`, `dist/stitch.assembled.js` and `stitch.min.js` together.

### 8.2 Add New Binding Type

1. Extend `packages/browser/src/binding-runtime.js` handler registry.
2. If helper logic is generic, place it in `packages/utils/src/*`.
3. Ensure `DataBinder.registerBinding` contract remains stable.
4. Add tests to a suite page (or a new page, added to `tests/suites.js`).
5. Run `npm run build` and `npm test`.

### 8.3 Extend Reactivity Core

1. Prefer changes in `packages/core/src/*` + `packages/api/src/reactive-factory.js`.
2. Preserve computed invalidation semantics (sync dirty marking).
3. Preserve batching semantics for DOM effects.
4. Run `npm run build` and `npm test`.

### 8.4 Fix a Known Defect

1. Make the test listed in `tests/known-failing.json` pass.
2. Remove its entry; `npm test` fails until you do.
3. Update `KNOWN-ISSUES.md`.

### 8.5 Change the Public API or an Error Message

`npm test` fails until the documentation follows: a new or removed public name needs its heading in
`docs/API.md`; a new or changed error message needs its `**Message:**` line in `docs/ERRORS.md` (the
check prints the line to add). Rules that change also belong in `docs/GUIDE.md`, `AGENTS.md` and,
when they break existing pages, `MIGRATION.md` and `CHANGELOG.md`.

### 8.6 Release a New Version

Follow [RELEASE.md](RELEASE.md): bump the version at its single source (`npm version X.Y.Z --no-git-tag-version`), date the `CHANGELOG.md` heading, `npm run build`, `npm test`, commit, merge to `main`, tag.

## 9. Constraints and Invariants

- Keep public Stitch surface stable unless explicitly versioning a break.
- Keep `<script src="stitch.js">` usage working.
- Treat `stitch.js` and `stitch.min.js` as generated output, not primary authoring targets.
- Keep module dependency direction clean:
  - core/api/browser depend on utils where needed,
  - browser composes API/core behavior but should avoid cyclic package coupling.

## 10. Cold-Start Reading Order (Human or AI)

1. `ARCHITECTURE.md` (this file)
2. `stitch.entry.js`
3. `packages/*/index.js`
4. target `packages/*/src/*.js` area you intend to change
5. `_tools/build-stitch-assembly.js`
6. `_tools/run-tests.js` and `tests/harness.js`
7. `KNOWN-ISSUES.md`

## 11. Related Docs

- Quick start: `README.md`
- Guide: `docs/GUIDE.md`
- API reference: `docs/API.md`
- Error reference: `docs/ERRORS.md`
- Rules for AI agents: `AGENTS.md`
- Migration details: `MIGRATION.md`; changes: `CHANGELOG.md`
- The v2 documents, archived: `docs/history/`
- Known defects and their tests: `KNOWN-ISSUES.md`
