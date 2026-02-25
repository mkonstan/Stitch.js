# Stitch.js Enhancement Plan

## Current State

- **stitch.js**: 156 KB (4,207 lines) across 23 modules
- **stitch.min.js**: 52 KB
- **Compression ratio**: 33% (Terser with 2-pass compress + mangle)
- **No unit tests** — validation is Playwright browser-based only
- **No production/development build split** — debug instrumentation ships in minified output

---

## Enhancement 1: Deduplicate `computed()` definition

### Problem
`computed()` is implemented twice with identical validation logic:
- `packages/api/src/observable.js:241-263` — `Observable.computed()` static method
- `packages/api/src/reactive-factory.js:784-806` — `computed()` inside `createReactiveFactory`

Both perform the same type checking, same error messages, return the same `{ __isStitchComputed, fn, __explicitDeps }` marker.

### Proposed Change
Remove the duplicated body from `Observable.computed()` and delegate to the factory version.

**In `observable.js`**, replace the full `static computed(config)` body with:

```js
static computed(config) {
    return createReactiveFactory().computed(config);
}
```

However, this creates a throwaway factory. Better approach — extract the shared logic into a standalone function in a shared location.

**Recommended approach**: Create a `createComputedMarker(config, version)` function in `reactive-factory.js` that both `Observable.computed()` and the factory's `computed()` call. Export it alongside `createReactiveFactory`.

### Files Changed
- `packages/api/src/reactive-factory.js` — extract `createComputedMarker()`, export it
- `packages/api/src/observable.js` — import and delegate to `createComputedMarker()`

### Estimated Size Impact
- ~30 lines removed from observable.js
- ~500 bytes saved in minified output

---

## Enhancement 2: Reduce `Object.defineProperty` boilerplate

### Problem
Repetitive `Object.defineProperty` calls with identical descriptor shapes appear throughout the codebase. Each call specifies `{ value, writable: false, enumerable: false, configurable: false }` — the most common pattern.

Worst offenders:
- `observable.js:67-144` — 6 consecutive blocks for `$on`, `$watch`, `$use`, `$off`, `$emit`, `$once`
- `reactive-factory.js:320-432` — `createReactiveObject` defines `_changeHandlers`, `__stitchId`, `__isReactive`, `on`, `off`, `set`, `get`, `toJSON`, `$set`

### Proposed Change
Add a small internal helper to `reactive-object-helpers.js`:

```js
function defineHidden(target, name, value) {
    Object.defineProperty(target, name, {
        value: value,
        writable: false,
        enumerable: false,
        configurable: false
    });
}
```

Replace all `Object.defineProperty(target, "name", { value: ..., writable: false, enumerable: false, configurable: false })` calls with `defineHidden(target, "name", value)`.

For the 6 consecutive Message Bus API methods in `observable.js`, collapse to a loop:

```js
const methods = {
    $on(event, cb) { return factory.reactiveSystem.messageBus.subscribe(event, cb); },
    $off(event, cb) { factory.reactiveSystem.messageBus.unsubscribe(event, cb); },
    $emit(event, payload) { factory.reactiveSystem.messageBus.publish(event, payload); },
    $use(middleware) { return factory.reactiveSystem.messageBus.use(middleware); },
    $once(event, cb) {
        const unsub = factory.reactiveSystem.messageBus.subscribe(event, payload => { cb(payload); unsub(); });
        return unsub;
    }
};
for (const [name, fn] of Object.entries(methods)) {
    defineHidden(reactiveData, name, fn);
}
```

`$watch` remains separate due to its closure over `previousValue`.

### Files Changed
- `packages/utils/src/reactive-object-helpers.js` — add `defineHidden()`
- `packages/api/src/observable.js` — replace 6 defineProperty blocks with loop + defineHidden
- `packages/api/src/reactive-factory.js` — replace defineProperty calls in `createReactiveObject`, `createReactiveMap`, `createReactiveSet`, `createReactiveArray`, `attachParent`

### Estimated Size Impact
- ~120 lines removed across both files
- ~1.5-2 KB saved in minified output

---

## Enhancement 3: Unify reactive Map and Set proxy handlers

### Problem
`createReactiveMap` (reactive-factory.js:444-545) and `createReactiveSet` (reactive-factory.js:556-650) share ~80% of their structure:
- Identical cache lookup and `_changeHandlers` setup
- Identical `__isReactive`, `_changeHandlers`, `_parent`, `on`, `off` proxy traps
- Identical `size` tracking, `clear`, `forEach`/`keys`/`values`/`entries`/`Symbol.iterator` handling
- Only differ in: `get`/`set` (Map) vs `has`/`add` (Set), and `normalizeSetLookup` usage

### Proposed Change
Extract a shared `createReactiveCollection(target, parent, key, methodOverrides)` function that handles:
- Cache lookup, `_changeHandlers` setup, `attachParent`
- Common proxy traps (`__isReactive`, `_changeHandlers`, `_parent`, `on`, `off`, `size`)
- Iteration method binding (`forEach`, `keys`, `values`, `entries`, `Symbol.iterator`)
- `clear` implementation

Then `createReactiveMap` and `createReactiveSet` become thin wrappers that only supply their unique method overrides:

```js
function createReactiveMap(target, parent, key) {
    return createReactiveCollection(target, parent, key, {
        get(target, key) { /* Map-specific get tracking */ },
        set(target, key, val) { /* Map-specific set + trigger */ },
        has(target, key) { /* Map-specific has tracking */ },
        delete(target, key) { /* Map-specific delete + trigger */ }
    });
}

function createReactiveSet(target, parent, key) {
    return createReactiveCollection(target, parent, key, {
        has(target, key) { /* Set-specific has with normalizeSetLookup */ },
        add(target, val) { /* Set-specific add + trigger */ },
        delete(target, val) { /* Set-specific delete + trigger */ }
    });
}
```

### Files Changed
- `packages/api/src/reactive-factory.js` — extract `createReactiveCollection`, simplify Map/Set

### Estimated Size Impact
- ~80 lines removed
- ~1-1.5 KB saved in minified output

### Risk
Medium. The proxy handler behavior is subtle. Each collection type's method interception has slightly different trigger semantics. Careful testing with the existing Playwright validation suite is critical.

---

## Enhancement 4: Strip debug instrumentation from production builds

### Problem
Every `track()`, `trigger()`, `get`, `set`, `effect()`, computed evaluation, binding application, and message bus operation calls `StitchDebug.log(...)` with template literal arguments. Even with `NOOP_DEBUG`, the string concatenation and object literal construction still execute at runtime before being discarded as no-ops.

Examples from hot paths:
```js
// reactive-system.js:103 — called on EVERY property access
this.debug.log("reactivity", `TRACK: ${this._getObjectId(target)}.${String(key)} -> ${currentEffect.id || "unknown"}`, { ... });

// reactive-factory.js:126 — called on EVERY reactive get
StitchDebug.log("reactivity", `⬆️ GET: ${reactiveSystem._getObjectId(target)}.${String(key)}`, { ... });
```

In the minified build, these calls survive and the template literal evaluation still happens at runtime.

### Proposed Change

**Option A (Recommended): Build-time stripping via Terser `pure_funcs`**

Add a wrapper that Terser can eliminate:

1. In each module, wrap debug calls with a guard:
```js
// Before
StitchDebug.log("reactivity", `TRACK: ...`, { ... });

// After
StitchDebug.enabled && StitchDebug.log("reactivity", `TRACK: ...`, { ... });
```

Since `NOOP_DEBUG.enabled = false`, Terser's `compress.dead_code` and `compress.booleans` will eliminate the entire expression including the template literal construction when using `pure_getters: true`.

2. Update `minify.js` to enable `pure_getters`:
```js
compress: {
    passes: 2,
    unsafe_arrows: false,
    pure_getters: true
}
```

**Option B: Dual build (dev + prod)**

Add a build step that strips all `StitchDebug.log(...)`, `this.debug.log(...)`, `this.debug.group(...)`, `this.debug.groupEnd(...)` calls entirely for production. This could be a simple regex pass in `build-stitch-assembly.js` or a separate `strip-debug.js` script.

Option A is preferred because it's simpler, doesn't require a second build pipeline, and still allows debug to be enabled at runtime in the minified build.

### Files Changed
- `packages/api/src/reactive-factory.js` — guard ~15 debug calls
- `packages/core/src/reactive-system.js` — guard ~8 debug calls
- `packages/core/src/computed-ref.js` — guard ~5 debug calls
- `packages/core/src/message-bus.js` — guard ~5 debug calls
- `packages/core/src/batch-scheduler.js` — guard ~3 debug calls
- `packages/browser/src/binding-runtime.js` — guard ~12 debug calls
- `packages/browser/src/data-binder.js` — guard ~5 debug calls
- `minify.js` — add `pure_getters: true` to compress options

### Estimated Size Impact
- ~2-3 KB saved in minified output (template literals, object literals, and method call overhead)
- Significant runtime performance improvement in hot paths (track/trigger)

---

## Enhancement 5: Use numeric module IDs in the assembly

### Problem
Module path strings like `"packages/api/src/reactive-factory.js"` appear 57 times across the minified output, totaling ~2.4 KB. These full paths also leak internal project structure to consumers.

### Proposed Change
Modify `_tools/build-stitch-assembly.js` to assign numeric IDs to modules and use those in the factory registry and `__stitchRequire` calls:

```js
// Before
__stitchModuleFactories["packages/api/src/reactive-factory.js"] = function(module, exports, __stitchRequire){
    const { ReactiveSystem } = __stitchRequire("packages/core/src/reactive-system.js");
    ...
};

// After
__stitchModuleFactories[0] = function(module, exports, __stitchRequire){
    const { ReactiveSystem } = __stitchRequire(1);
    ...
};
```

Add a `--module-ids=numeric` flag (default) with `--module-ids=path` for debug builds. Preserve a comment mapping in the metadata block for debugging:

```js
/* STITCH_ASSEMBLY_METADATA { ..., "moduleMap": { "0": "packages/api/src/reactive-factory.js", ... } } */
```

### Files Changed
- `_tools/build-stitch-assembly.js` — add numeric ID assignment and mapping
- `stitch.entry.js` — update entry requires (or handle in the patching step)

### Estimated Size Impact
- ~1.5-2 KB saved in minified output (57 string references replaced with single-digit numbers)

### Risk
Low. The module IDs are only used internally by `__stitchRequire`. The metadata comment preserves debuggability. Terser already strips the metadata comment.

---

## Enhancement 6: Shared ReactiveSystem singleton

### Problem
Every call to `Observable.create()` invokes `createReactiveFactory()` which instantiates a new `ReactiveSystem`, `BatchScheduler`, and `MessageBus`. This means:
- Two separately created observables cannot share effects or react to each other
- Each observable has its own batch queue, so updates across observables don't coalesce
- Memory overhead scales linearly with observable count

```js
// observable.js:59
const factory = createReactiveFactory();  // New system every time
```

### Proposed Change
Introduce a default shared `ReactiveSystem` instance that all `Observable.create()` calls use, while still allowing opt-in isolation.

1. In `packages/api/src/reactive-factory.js`, export a lazily-created default factory:

```js
let _defaultFactory = null;
function getDefaultFactory() {
    if (!_defaultFactory) {
        _defaultFactory = createReactiveFactory();
    }
    return _defaultFactory;
}
module.exports = { createReactiveFactory, getDefaultFactory };
```

2. In `Observable.create()`, use the shared factory by default:

```js
static create(data, options = {}) {
    const factory = options.isolated
        ? createReactiveFactory()
        : getDefaultFactory();
    // ... rest unchanged
}
```

3. Add `Observable.reset()` for testing (clears the default factory):

```js
static reset() {
    _defaultFactory = null;
}
```

### Behavioral Change
- `model1.on(...)` could now react to changes in objects shared with `model2`
- Batch scheduling coalesces across all observables
- Effects from one observable can track dependencies in another

### Files Changed
- `packages/api/src/reactive-factory.js` — add `getDefaultFactory()`, export it
- `packages/api/src/observable.js` — use `getDefaultFactory()` by default, add `isolated` option
- `packages/api/index.js` — export `reset` if needed

### Risk
High. This is a **semantic change** that affects how observables interact. Existing code that depends on observable isolation (separate effect systems) could break. Must be gated behind a major or minor version bump and thoroughly documented.

---

## Enhancement 7: Preserve license comment in minified output

### Problem
The `STITCH_ASSEMBLY_METADATA` comment and any future license/copyright comment are stripped during minification. The Terser config only preserves comments matching `/^!|@license|@preserve|@cc_on/i`, but no comments in the source use these markers.

### Proposed Change
1. In `_tools/build-stitch-assembly.js`, prefix the metadata comment with `/*!` :

```js
`/*! STITCH_ASSEMBLY_METADATA ${JSON.stringify(metadata)} */`
```

2. Add a license banner to the assembly output:

```js
`/*! Stitch.js v${version} | MIT License | https://github.com/user/Stitch.js */`
```

### Files Changed
- `_tools/build-stitch-assembly.js` — change comment prefix

### Estimated Size Impact
- +80-100 bytes (the preserved comment)

---

## Enhancement 8: Reduce `NOOP_DEBUG` duplication

### Problem
The `NOOP_DEBUG` object is defined identically in 5 separate files:
- `packages/api/src/reactive-factory.js:8-14`
- `packages/browser/src/binding-runtime.js:3-9`
- `packages/browser/src/data-binder.js:3-9`
- `packages/core/src/message-bus.js:3-9`
- `packages/core/src/batch-scheduler.js:3-9`

Each is the same 7-line object: `{ enabled: false, categories: Object.create(null), log(){}, group(){}, groupEnd(){} }`.

### Proposed Change
Export `NOOP_DEBUG` from a single location. It's already exported from `packages/core/src/message-bus.js`. Have all other files import it from there (or better, from a dedicated `packages/utils/src/debug-config.js` which already exists and manages debug state).

Add to `debug-config.js`:
```js
const NOOP_DEBUG = {
    enabled: false,
    categories: Object.create(null),
    log() {},
    group() {},
    groupEnd() {}
};
module.exports.NOOP_DEBUG = NOOP_DEBUG;
```

Replace the local definitions in the other 4 files with:
```js
const { NOOP_DEBUG } = require("../../utils/src/debug-config");
```

### Files Changed
- `packages/utils/src/debug-config.js` — export `NOOP_DEBUG`
- `packages/api/src/reactive-factory.js` — import from debug-config
- `packages/browser/src/binding-runtime.js` — import from debug-config
- `packages/browser/src/data-binder.js` — import from debug-config
- `packages/core/src/batch-scheduler.js` — import from debug-config
- `packages/core/src/message-bus.js` — import from debug-config (already exports it, consolidate)

### Estimated Size Impact
- ~400 bytes saved in minified output (4 duplicate object literals eliminated)

---

## Implementation Priority

| # | Enhancement | Size Saved | Risk | Effort |
|---|-------------|-----------|------|--------|
| 8 | Deduplicate NOOP_DEBUG | ~400 B | Low | Small |
| 7 | Preserve license comment | +100 B | None | Trivial |
| 1 | Deduplicate computed() | ~500 B | Low | Small |
| 2 | defineHidden helper | ~1.5-2 KB | Low | Medium |
| 5 | Numeric module IDs | ~1.5-2 KB | Low | Medium |
| 3 | Unify Map/Set handlers | ~1-1.5 KB | Medium | Medium |
| 4 | Strip debug instrumentation | ~2-3 KB | Low | Medium |
| 6 | Shared ReactiveSystem | 0 | High | Large |

**Recommended order**: 8 → 7 → 1 → 2 → 4 → 5 → 3 → 6

Enhancements 8, 7, 1, 2, and 4 are low-risk mechanical changes that can be validated with the existing Playwright suite. Enhancement 5 is a build-tool-only change. Enhancement 3 requires careful proxy behavior verification. Enhancement 6 is a semantic change that warrants its own version bump.

**Projected minified size after all enhancements (excluding 6)**: ~42-45 KB (down from 52 KB, ~15-20% reduction).
