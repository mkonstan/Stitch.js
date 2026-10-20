# Changelog

## Unreleased

### Added

- `skills/stitch/`: a Claude skill for building pages with Stitch.js v3. `SKILL.md` holds the rules
  ranked by how often they bite, a page to start from, what is checked when, and a routing table;
  `references/` holds recipes, gotchas (habits from other frameworks included) with the error each
  one produces, the attribute grammar and API, and a table of every error code generated from
  `docs/ERRORS.md`. Every code block in it is run by the test suite, every error code a gotcha
  and every gotcha row is executed both ways by `tests/skill-proofs.md` (the mistake fails as stated,
  the advice works), and a static check (`skill`) keeps its names, codes, error table, recipe index
  and gotcha proofs in step with the library. Install: see README, "AI agents".
- `npm run build:skill` (part of `npm run build`) regenerates the skill's error table.
- Error codes E724 (a computed wrote to the model), E725 (a computed changed a list, Map or Set) and
  E912 (an effect re-running itself), with entries in `docs/ERRORS.md`.

### Changed

- A computed only reads: a write inside it throws E724, a method that changes a model list, Map or
  Set inside it (`sort`, `push`, `set`, ...) throws E725, before anything changes. Before, the write
  was accepted and a list sorted in place inside a computed could stop updating, silently.
- A `$watch` callback (or a custom binding's effect) that keeps re-running itself by writing what
  it reads is stopped after 100 nested runs with E912, reported to `Stitch.onError`, on every
  engine. Before, it overflowed the call stack (uncaught in Firefox).
- A handler (`data-click`, `data-event`) that returns a promise: a rejection goes to
  `Stitch.onError` with `source: "handler"`, or is re-thrown as an unhandled rejection when none is
  installed. Before, the promise was ignored.
- Arrow-function methods are refused (E707) wherever data enters a model, including rows given to a
  list at create, `push`, `unshift`, `splice` and `fill`, at any depth, before anything is added.
  Before, such a row was accepted and threw only when first read, which stopped the list rendering.
- `<select data-foreach data-value>`: when the chosen option leaves the list, the model is cleared
  to the placeholder's value (or `null`, with nothing selected, without a placeholder; a multiple
  select drops the value). Before, the select showed another option while the model kept the old
  value.

### Fixed

- A list row that holds the focus keeps it when the list reorders (the other rows move around it).
- `$watch`: a callback that writes the watched path now sees the right old value on the nested call,
  and the outer call no longer overwrites the stored value with a stale one.
- The test runner accepts a per-page `timeoutMs` (tests/suites.js) for pages that run many frames.

## 3.0.0 (2026-10-20)

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
- `data-attr` refuses, with a coded error and without writing anything, every value that could run
  script: an attribute name starting with `on`, `srcdoc`, a `javascript:` / `vbscript:` URL (in its
  filter-evasion forms too), a `data:` URL other than `data:image/...` in an `<img>` `src`, and a
  `style` string (give `style` an object; it is written through the CSSOM), and security-sensitive
  names (`sandbox`, `allow`, `csp`, `integrity`, `crossorigin`, `nonce`, `referrerpolicy`,
  `is`, ...) whatever the value, `rel="opener"`, and a `rel` value that drops a
  `noopener` / `noreferrer` written in the markup. Built-in bindings on
  `<script>`, `<style>`, `<base>` and `<meta>` throw.
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
- docs/ACCESSIBILITY.md: what Stitch does and does not do for assistive technology, with runnable
  patterns (labels, ARIA states, live regions, loading, validation, focus after list changes).
- Tested on Chromium, Firefox and WebKit, both builds, including a page served with a strict
  Content-Security-Policy with Trusted Types. The supported browsers, and the minimum versions
  derived from the APIs the library uses (not tested on those versions), are in the README.

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
- `data-attr` with a `style` object replaced the whole `style` attribute, which also cleared the
  `display: none` of `data-visible` on the same element; it now sets and removes only its own
  properties.
- The license banner names the real repository.
- A radio group whose `name` held a quote broke its own selector; the name is now escaped.

Earlier versions: see the [v1 to v2 section of MIGRATION.md](MIGRATION.md#history-stitchjs-v10-to-v20)
and the archived v2 documents in `docs/history/`.
