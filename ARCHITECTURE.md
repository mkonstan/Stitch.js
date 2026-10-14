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
npx playwright install chromium
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
| `packages/browser/src/data-binder.js` | `DataBinder` class factory, bind traversal, hook dispatch, cleanup/dispose lifecycle | app code |
| `packages/browser/src/binding-runtime.js` | Built-in binding handler registry + validation + runtime integrations | `DataBinder` |
| `packages/browser/src/binding-scan-helpers.js` | Attribute scan and binding handler lookup helpers | `binding-runtime`, `DataBinder` |
| `packages/browser/src/foreach-binding-orchestrator.js` | The one foreach implementation for every list element (`<select>` included): row template (one-root rule), keyed reconciliation, row release | `binding-runtime` |

### 4.4 Utils Package (`packages/utils`)

| Module | Role | Used by |
|---|---|---|
| `packages/utils/index.js` | Utils package entry + debug facade + utility exports | `stitch.entry.js`, other packages |
| `packages/utils/src/runtime-helpers.js` | `getProperty`, `setProperty`, arrow-function detection, path diagnostics | API + browser |
| `packages/utils/src/debug-config.js` | Canonical debug category/color config, helpers, and `NOOP_DEBUG` singleton (shared across all packages) | browser/utils debug wiring, all packages |
| `packages/utils/src/attr-value-handlers.js` | `data-attr` value-type strategy handlers | browser binding runtime |
| `packages/utils/src/value-binding-helpers.js` | value validators and value handlers (input/select/radio/number/range/default) | browser binding runtime |
| `packages/utils/src/type-converters.js` | converter registry (`int`, `float`, `boolean`, `string`, `date`, `datetime`, `auto`) | value binding helpers |
| `packages/utils/src/foreach-keys.js` | The list key rule (`id` / `data-key` / plain values; missing or duplicate keys throw) | foreach binding |
| `packages/utils/src/foreach-row-context.js` | Row binding context (`$data`, `$index`, `$parent`) | foreach binding |
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
| `_tools/run-tests.js` | `npm test`: static checks, browser suites on both builds, gate self-tests |
| `_tools/check-repo.js` | static checks: version literal, local paths, missing references, build-match |
| `tests/suites.js` | THE suite list (read by the runner and by `run-tests.html`) |
| `tests/harness.js` | in-page reporting protocol every suite uses |
| `tests/known-failing.json` | tests that fail today because of a known defect, with the defect and the sprint that fixes it |
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
- Playwright Chromium installed for the browser suites

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
9. Prepends a `/*!` license banner with the `package.json` version.
10. Writes output to both `dist/stitch.assembled.js` and `stitch.js`.

### 6.4 Output Integrity Expectations

- `stitch.js` and `dist/stitch.assembled.js` equal a fresh assembly of `packages/*`.
- `stitch.min.js` equals a fresh minification of that assembly.
- `npm test` (build-match) and CI (`npm run build`, then `git diff --exit-code`) both enforce this.

## 7. The Test Gate (`npm test`)

`node _tools/run-tests.js` runs, in order:

1. **Static checks** (`_tools/check-repo.js`, also `npm run test:static`):
   - version-literal: the `package.json` version string appears nowhere else (the generated bundles and npm's lock-file root fields are excepted, and checked);
   - stale-version: no other version is named as a Stitch version (`v` or `Version ` before x.y.z); history docs listed in `ARCHIVE_PATHS` are exempt;
   - local-path: no absolute local path (drive letters, home directories, file URLs) in any file;
   - missing-reference: every file a doc or page points to exists, and every `npm run` script mentioned exists;
   - build-match: see 6.4.
2. **Browser suites**: every page in `tests/suites.js`, in headless Chromium, served over a local HTTP server.
   Each page's `stitch.js` request is answered with the build under test: first `stitch.js`, then `stitch.min.js`.
3. **Gate self-tests**: each fixture in `tests/gate-fixtures/fixtures.js` re-runs the gate on a deliberately broken
   input and requires a non-zero exit with the stated reason (controls must pass).

A page fails the gate when it: never loads the build under test; logs an uncaught error or a console error; has a
failed request; never finishes; plans zero tests; reports a test twice, late, unplanned or skipped; or leaves a
planned test unreported; or makes an assertion after its test has settled. `window.Stitch` must expose exactly the public surface and the `package.json` version.

Per test, against `tests/known-failing.json`:
- failed and listed, with exactly the failures named in its `expect` list: counted as known-failing (not fatal).
  `expect` holds one assertion-message prefix per failed assertion, matched on a word boundary; each prefix must be
  at least 3 words and 15 characters, must match exactly one failure line, and may not start with `threw`,
  `precondition`, `control`, `harness` or another harness message (such prefixes are refused at load);
- failed and listed, but for any other reason (another assertion failed, it threw, or an expected failure is absent): FATAL;
- passed and listed: FATAL, remove the entry (each fix removes its own marker);
- failed and not listed: FATAL;
- a listed entry that matches no test: FATAL.

The summary prints `passed / known-failing / failed / skipped` per build. The full report is `_scratch/test-report.json`.

CI (`.github/workflows/test.yml`) runs `npm run build`, `git diff --exit-code`, then `npm test`.

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

### 8.5 Release a New Version

Change `version` in the root `package.json` only, run `npm install` (for the lock file) and `npm run build`, then `npm test`.

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

- User-facing API and usage guide: `stitch_documentation.md`
- API reference: `STITCH_API.md`
- Migration details: `MIGRATION.md`
- Known defects and their tests: `KNOWN-ISSUES.md`
