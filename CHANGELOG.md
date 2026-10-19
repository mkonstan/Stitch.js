# Changelog

## 3.0.0 (unreleased)

v3 makes every mistake loud and fixes the list defects of v2. Upgrading: see
[MIGRATION.md](MIGRATION.md), which lists every breaking change with before and after code.

### Breaking

- Model helpers are `$`-prefixed: `$onChange` / `$offChange` (change handlers), `$get`, `$set`.
  The v2 names `on`, `off`, `get`, `set` throw a message naming the new one, and are free for data
  fields. `$on` / `$off` take an event name and a callback only.
- Events (`$on`, `$off`, `$emit`, `$once`, `$use`) live on the root model only.
- No debug mode: `Stitch.debug.enable()` / `disable()` and the `debug` option are gone;
  `Stitch.debug.stats()` remains. Unknown options to `Observable.create()` throw.
- Every list row needs a unique key (`id`, or the field named by `data-key`); a missing or duplicate
  key throws. There is no fallback to the row position.
- A row template must be exactly one root element.
- `data-foreach` on a value that is not an array (or `null` / `undefined`) throws.
- Handlers are called as `(item, event)`; outside a list `item` is the model. Handler names are a
  bare name, `$parent.name` or `$root.name`; a name that is not found throws at `bind()`.
- A binding value is one property path. Expressions, calls, object literals and comma-separated
  options throw.
- A binding to a property the model does not have (or that is not reactive) throws.
- Errors raised during updates go to `Stitch.onError`, or are re-thrown uncaught; the library never
  logs to the console.
- Custom bindings: the value is a model path unless registered with `value: 'literal'`;
  `registerBinding` after the first `bind()` throws; names must be lowercase; built-in names cannot
  be replaced.
- A model cannot be put inside another model, and two models cannot share an array, Map or Set.
- Model properties cannot be deleted (set them to `null`); `delete` on a list, Map or Set throws.
- Data fields named `toJSON` or like a `$` helper throw.
- `bind()` of an already-bound element, `unbind()` of an element with nothing bound, and `bind()` /
  `unbind()` after `dispose()` throw. A `bind()` that throws leaves nothing bound.
- `data-value` on a computed, a read-only getter or a row-context value throws.
- `Observable.toRaw()` returns a deep plain copy for every value.
- Every error message starts with a stable code, `[Stitch E###]`, instead of the library version.
  Codes are public API, documented in docs/ERRORS.md.
- `$watch` returns a function that stops the watch (it returned an internal object).
- `Observable.isReactive()` returns `true` or `false` (it returned falsy inputs as they were).
- Frozen or sealed data is refused with a Stitch error (E714) instead of the browser's `TypeError`.

### Added

- `data-key` (the key field of a list), `$root.` (paths and handlers).
- `Stitch.onError(fn)`, `Stitch.onBindReport(fn)`, `Stitch.debug.stats()`.
- `$onChange` / `$offChange`; `$onChange` returns a remover; `value: 'literal'` for custom bindings.
- A computed's function receives the object that holds it as its first argument as well as
  `this`, so `Stitch.computed(m => m.price * m.qty)` works.
- Documentation: Guide, API reference, error reference and AGENTS.md, with every code example
  executed by the test suite.

### Fixed

- Lists without keys rendered rows by position and could show the wrong data after filtering.
- Reloading a list with new objects under the same ids kept showing the old values.
- Rows removed by filtering or hide/show leaked their bindings; each later change ran once per leaked
  binding.
- `$root.handler` in a nested list did nothing.
- A misspelled binding or a missing property rendered nothing, silently.
- An effect that read a computed kept running after it was released.
- A row template with several roots silently rendered only the first.
- Change handlers did not fire for properties nothing on the page was reading.
- A `<select>` without `data-value` lost the user's choice whenever its list changed.
- Initial `Map` values were not reactive.
- `Stitch.onBindReport` listed `data-type` as ignored although `data-value` reads it.
- A path-type custom binding given text (`data-tooltip="Save changes"`) now says how to register
  it as literal.

Earlier versions: see the [v1 to v2 section of MIGRATION.md](MIGRATION.md#history-stitchjs-v10-to-v20)
and the archived v2 documents in `docs/history/`.
