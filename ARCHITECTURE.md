# Stitch.js v2.1.0 - Architecture, Build, and Bootstrap Guide

This document is the source-of-truth technical map for both humans and cold AI instances.

Use this when you need to:
- understand where runtime behavior lives,
- build `stitch.js` from modular sources,
- validate source vs assembled artifacts,
- make safe changes with minimal regression risk.

## 1. TL;DR

- Runtime source-of-truth is the modular workspace under `packages/*`.
- `stitch.js` is generated (do not hand-edit it as source-of-truth).
- Build entrypoint is `stitch.entry.js`.
- Builder is `_tools/build-stitch-assembly.js`.
- Generated outputs:
  - `dist/stitch.assembled.js`
  - `stitch.js` (synced generated artifact)
- Quality gates:
  - browser suites (`_scratch/run-browser-validation.js`)
  - assembly validation + KPI gate (`npm run validate:assembly`)
  - source-vs-assembly parity pipeline (`npm run pipeline:build-compare`)

## 2. Bootstrap in 5 Minutes

1. Install dependencies:
```bash
npm install
npx playwright install chromium
```

2. Build generated artifacts from modular sources:
```bash
npm run build:assembly
```

3. Validate browser suites against generated `stitch.js`:
```bash
npm run validate:browser
```

4. Validate assembled artifact + KPI gate:
```bash
npm run validate:assembly
```

5. Verify source/assembly parity end-to-end:
```bash
npm run pipeline:build-compare
```

If step 5 passes, behavior parity between generated source artifact and release-candidate assembly is intact.

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

1. `Observable.create()` (API layer) creates reactive objects through `createReactiveFactory()`.
2. `ReactiveSystem` (core layer) tracks dependencies in `WeakMap -> Map -> Set`.
3. Property writes trigger synchronous dependency invalidation:
- computed refs are marked dirty immediately,
- non-batched effects run immediately,
- batched effects queue in `BatchScheduler`.
4. `DataBinder` (browser layer) installs binding handlers that create effects for DOM updates.
5. DOM effects are usually `{ batch: true }`, so updates flush on microtask boundaries.

### 3.3 MessageBus Role

`MessageBus` is retained for eventing and compatibility paths (user events + internal bus events), while core property dependency tracking is handled by `ReactiveSystem`.

## 4. Package and Module Inventory (23 Reachable Modules)

### 4.1 API Package (`packages/api`)

| Module | Role | Used by |
|---|---|---|
| `packages/api/index.js` | API package entry exports Observable/computed/factory/version | `stitch.entry.js` |
| `packages/api/src/observable.js` | Public Observable API (`create`, `createArray`, `reactive`, `computed`, watch/event helpers) | app code, `stitch.entry.js` |
| `packages/api/src/reactive-factory.js` | Reactive object/array/map/set creation, computed descriptor wiring, bubbling, proxy identity cache | `Observable` |

### 4.2 Core Package (`packages/core`)

| Module | Role | Used by |
|---|---|---|
| `packages/core/index.js` | Core package entry exports scheduler/system/computed/message bus/version | `stitch.entry.js` |
| `packages/core/src/message-bus.js` | Async queued pub/sub + middleware + wildcard + depth guard | `ReactiveSystem`, app event usage |
| `packages/core/src/batch-scheduler.js` | Batched effect queue + dedupe + microtask flush + loop guard | `ReactiveSystem` |
| `packages/core/src/computed-ref.js` | ComputedRef dirty/evaluate/cache/dependent propagation | `ReactiveFactory` |
| `packages/core/src/reactive-system.js` | Track/trigger/effect/cleanup engine + nested change/array-mutation subscriptions | API + browser runtime |

### 4.3 Browser Package (`packages/browser`)

| Module | Role | Used by |
|---|---|---|
| `packages/browser/index.js` | Browser package entry; composes runtime dependencies and exports `DataBinder` + helpers | `stitch.entry.js` |
| `packages/browser/src/data-binder.js` | `DataBinder` class factory, bind traversal, hook dispatch, cleanup/dispose lifecycle | app code |
| `packages/browser/src/binding-runtime.js` | Built-in binding handler registry + validation + runtime integrations | `DataBinder` |
| `packages/browser/src/binding-scan-helpers.js` | Attribute scan and binding handler lookup helpers | `binding-runtime`, `DataBinder` |
| `packages/browser/src/foreach-binding-orchestrator.js` | Foreach binding orchestration (effect setup and cleanup wiring) | `binding-runtime` |
| `packages/browser/src/foreach-rendering-delegates.js` | Container-specific foreach rendering strategies (select/list/table/default) | foreach runtime |

### 4.4 Utils Package (`packages/utils`)

| Module | Role | Used by |
|---|---|---|
| `packages/utils/index.js` | Utils package entry + debug facade + utility exports | `stitch.entry.js`, other packages |
| `packages/utils/src/runtime-helpers.js` | `getProperty`, `setProperty`, arrow-function detection, path diagnostics | API + browser |
| `packages/utils/src/debug-config.js` | canonical debug category/color config and helpers | browser/utils debug wiring |
| `packages/utils/src/attr-value-handlers.js` | `data-attr` value-type strategy handlers | browser binding runtime |
| `packages/utils/src/value-binding-helpers.js` | value validators and value handlers (input/select/radio/number/range/default) | browser binding runtime |
| `packages/utils/src/type-converters.js` | converter registry (`int`, `float`, `boolean`, `string`, `date`, `datetime`, `auto`) | value binding helpers |
| `packages/utils/src/foreach-template-helpers.js` | foreach template parsing/container handling | foreach render/reconcile |
| `packages/utils/src/foreach-reconcile-helpers.js` | keyed row reconciliation and item context creation | foreach rendering |
| `packages/utils/src/reactive-object-helpers.js` | change-handler add/remove and `toJSON` serialization helpers | reactive factory |

## 5. Repository Resource Map

### 5.1 Runtime Artifacts

| Path | Role |
|---|---|
| `stitch.entry.js` | canonical distribution entry that composes packages |
| `stitch.js` | generated single-file artifact synced by builder |
| `dist/stitch.assembled.js` | generated assembled release candidate |

### 5.2 Build/Validation Tooling

| Path | Role |
|---|---|
| `_tools/build-stitch-assembly.js` | assembly builder: module discovery, reachability graph, inline prelude, metadata stamping |
| `_tools/check-kpi-gate.js` | KPI enforcement (validation, module count, mode, size growth, smoke exports) |
| `_tools/compare-build-output.js` | compares suite results + targeted checks + export shape between source and assembled artifacts |
| `_tools/run-build-compare-pipeline.js` | orchestrates build -> validate source -> validate assembled -> compare |
| `_tools/clean-scratch-reports.js` | retention-policy cleanup for generated `_scratch` JSON reports |
| `_tools/scratch-report-retention.json` | canonical retention policy for report pruning |
| `_tools/phase2_kpi_gate.json` | KPI thresholds and required exports |
| `_scratch/run-browser-validation.js` | Playwright runner against current `stitch.js` |
| `_scratch/run-browser-validation-release-candidate.js` | Playwright runner that swaps `stitch.js` with assembled artifact |

### 5.3 Test Suites

Primary browser suites:
- `test-computed-properties.html`
- `test-array-reactivity.html`
- `test-core-reactivity.html`
- `test-messagebus.html`
- `test-all-bindings.html`
- `test-edge-cases.html`
- `test-dispose.html`

### 5.4 State/Process Docs

| Path | Role |
|---|---|
| `MODULARIZATION_PHASE2.md` | phase history and extraction progress log |
| `CODE_REVIEW_FINDINGS.md` | stabilization findings and fix tracking |
| `BROWSER_VALIDATION_REPORT*.md` | validation snapshots |
| `_state/gpt_state.md`, `_state/gpt_todo.md` | continuity/checkpoint files |
| `_tools/context_dump_protocol_v2.4s.md` | checkpoint protocol used for context snapshots |

## 6. Build and Assembly Walkthrough (Detailed)

### 6.1 Preconditions

- Node.js 18+
- npm workspace install complete
- Playwright Chromium installed for validation runners

```bash
npm install
npx playwright install chromium
```

### 6.2 Build Commands

- Build generated artifacts (default reachable mode):
```bash
npm run build:assembly
```

- Equivalent alias:
```bash
npm run build:stitch
```

- Build with all modules inlined (diagnostic mode):
```bash
npm run build:assembly:all
```

- Build package profiles:
```bash
npm run package:runtime
npm run package:contributor
```

### 6.3 What the Builder Actually Does

`_tools/build-stitch-assembly.js`:
1. Reads `stitch.entry.js`.
2. Enumerates package module files (`index.js` + `src/*.js`).
3. Resolves internal module graph via `require()` pattern rewrite to `__stitchRequire()`.
4. Selects modules by mode:
- `reachable`: only transitively reachable from entrypoint
- `all`: all discovered modules
5. Emits inline module prelude + patched entry.
6. Stamps metadata comment:
- `generatedAt`, `mode`, `moduleCount`, `availableModuleCount`, `modules[]`.
7. Writes output to both:
- `dist/stitch.assembled.js`
- `stitch.js`

### 6.4 Output Integrity Expectations

- `stitch.js` and `dist/stitch.assembled.js` are both generated from the same source graph.
- Size delta vs entrypoint is expected (inlined modules).
- Reachability and growth thresholds are enforced by KPI gate.

## 7. Validation and KPI Gates

### 7.1 Browser Validation (Source Artifact)

```bash
npm run validate:browser
```

Runs Playwright suites against `stitch.js` and emits JSON report to stdout (typically redirected in scripted pipelines).

### 7.2 Assembly Validation + KPI Gate

```bash
npm run validate:assembly
```

Pipeline:
1. build assembly,
2. run browser validation report to `_scratch/browser-validation-report-assembly.json`,
3. run KPI checks in `_tools/check-kpi-gate.js`.

Current KPI source config: `_tools/phase2_kpi_gate.json`.

### 7.3 Source vs Assembled Parity

```bash
npm run pipeline:build-compare
```

This orchestrator:
1. builds artifact,
2. validates source artifact,
3. validates assembled artifact,
4. compares suites/targeted checks/export surface.

Primary delta output:
- `_scratch/build-output-delta.json`

Expected pass condition:
- `suiteDiffs = 0`
- `targetedDiffs = 0`
- `export mismatches = none`

## 8. Common Change Workflows

### 8.1 Modify Runtime Logic Safely

1. Edit module under `packages/*/src/*`.
2. Run:
```bash
npm run build:assembly
npm run validate:assembly
npm run pipeline:build-compare
```
3. If all pass, update docs/changelog as needed.

### 8.2 Add New Binding Type

1. Extend `packages/browser/src/binding-runtime.js` handler registry.
2. If helper logic is generic, place it in `packages/utils/src/*`.
3. Ensure `DataBinder.registerBinding` contract remains stable.
4. Add/adjust test HTML suite.
5. Run full validation pipeline.

### 8.3 Extend Reactivity Core

1. Prefer changes in `packages/core/src/*` + `packages/api/src/reactive-factory.js`.
2. Preserve computed invalidation semantics (sync dirty marking).
3. Preserve batching semantics for DOM effects.
4. Re-run browser + parity pipeline.

## 9. Constraints and Invariants

- Keep public Stitch surface stable unless explicitly versioning a break.
- Keep `<script src="stitch.js">` usage working.
- Treat `stitch.js` as generated output, not primary authoring target.
- Keep module dependency direction clean:
  - core/api/browser depend on utils where needed,
  - browser composes API/core behavior but should avoid cyclic package coupling.

## 10. Cold-Start Reading Order (Human or AI)

1. `ARCHITECTURE.md` (this file)
2. `stitch.entry.js`
3. `packages/*/index.js`
4. target `packages/*/src/*.js` area you intend to change
5. `_tools/build-stitch-assembly.js`
6. `_scratch/run-browser-validation.js`
7. `_tools/check-kpi-gate.js` + `_tools/compare-build-output.js`
8. `MODULARIZATION_PHASE2.md` for historical rationale

## 11. Related Docs

- User-facing API and usage guide: `stitch_documentation.md`
- Migration details: `MIGRATION.md`
- Ongoing modularization log: `MODULARIZATION_PHASE2.md`
- Findings history: `CODE_REVIEW_FINDINGS.md`

---

**Last Updated:** 2026-02-13
**Maintainers:** Stitch.js modularization contributors
