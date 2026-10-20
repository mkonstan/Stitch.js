# Stitch.js v3 grammar and API

Exact grammar of every attribute, what each binding accepts, when it is checked, and every function
signature. Error codes: look them up in `errors.md` (next to this file).

## Value grammar

| Kind | Grammar | Examples | Invalid (code) |
|---|---|---|---|
| path | names joined by dots; a name is `[A-Za-z_$][A-Za-z0-9_$]*` or digits (array index); surrounding spaces trimmed | `name`, `user.email`, `items.0.title`, `$data`, `$index`, `$parent.total`, `$root.rate`, `$data.name` | `""` (E101), `!done` / `a + b` / `n > 0` / `items[0]` (E102), `{ a: b }` (E103), `fmt(x)` (E104), `a, visible: b` / `x ? y : z` (E105), `a..b` (E106) |
| handler | `name`, `name.name`, `$parent.name`, `$root.name` (one prefix, once) | `save`, `$root.remove`, `$parent.rename`, `$root.actions.save` | `save()` / `remove(item)` / `!x` (E108), `$root` alone (E109), `$parent.$parent.x` / `$data.x` (E110) |
| literal | the attribute text, not looked up | `data-default-text="Choose..."`, a custom binding registered with `value: 'literal'` | none |

A path through `null` or `undefined` (`selected.name` while `selected` is `null`) is a value: it
renders empty; the rest of the path is checked when the object arrives (E201 then goes to
`Stitch.onError`). An index into an array checks the item: `items.0.title` with `items: []` throws
E201 at `bind()`.

## Bindings

"bind" = checked by `bind()` and thrown to the caller. "row" = checked when a row renders (thrown by
`bind()` for rows present at bind, else to `Stitch.onError`). "update" = later changes, to
`Stitch.onError` (uncaught without it). Every path binding checks syntax (E1xx) and that the path
exists and is reactive (E201, E202, E203) at bind (row paths: at row render). No built-in binding is
allowed on `<script>`, `<style>`, `<base>`, `<meta>` (E326, bind).

| Attribute | Value | The bound value must be | Two-way | Checked at bind | Checked later |
|---|---|---|---|---|---|
| `data-text` | path | anything but a function; `null`/`undefined` show as empty; written with `textContent` | no | function (E301); element contains bound elements (E535); with `data-foreach` (E534) | function (E301, update) |
| `data-value` | path | a writable property; on `input`, `textarea`, `select` (on other elements nothing happens, no error) | yes, on `input` and `change` | computed (E311); getter without setter (E312); a row-context value itself: `$data`, `$index`, `$parent`, `$root`, also behind a prefix (`$parent.$index`, `$root.$data`) (E313). `$data.name`, `$parent.name`, `$root.name` are writable | typing through a `null` object (E314, to `onError`, possibly twice per edit) |
| `data-visible` | path | truthy shows (`style.display = ''`: clears only the inline value, so a `hidden` attribute or a stylesheet `display: none` keeps the element hidden), falsy hides (`display: none`) | no | path only | none |
| `data-enabled` | path | truthy enables; `element.disabled = !value` | no | path only | none |
| `data-class` | path | a string (REPLACES all classes), `{ className: boolean }` (toggles only those), `null`/`undefined` (no change) | no | other kinds (E302) | other kinds (E302, update) |
| `data-attr` | path | `{ name: value }` or `null`/`undefined`; entry value `null`/`false` removes, `true` writes `""`, arrays join, `style` takes an object | no | not an object (E303); refused entries (E321-E325, E327-E329) | same, update; nothing from that object is written |
| `data-loading` | path | truthy: `disabled`, class `loading`, `aria-busy="true"` | no | path only | none |
| `data-click` | handler | a method; called as `fn.call(owner, item, event)` | no | not found / not a function outside lists (E401, E402); `$parent.` outside a list (E403); `$root.` in a row template (E406, E407); `$parent.` in a top-level row template (E404, E405) | bare names in rows and `$parent.` in nested lists (E401, row); looked up again on every click |
| `data-event` | path | an object `{ eventName: handlerName or function }` (names resolve like `data-click`; a function must not be an arrow, E707 at create) | no | not an object (E304); bad entry (E305); names not found (E401 ...) | same, update; replacing the object re-registers listeners |
| `data-foreach` | path | an array, `null` or `undefined` (no rows); other bindings may sit on the list element (applied after the rows), except `data-text` | no | not an array (E521); keys of present rows (E501-E505); template (E511-E516) | non-array (E521), keys of new rows (E501, E502, E503); the DOM keeps its last good rows |

A select bound with `data-value` shows exactly what the model holds: the matching option; the
placeholder for `null`, `""` or the placeholder's value; and with no placeholder, no option at all
(`selectedIndex` -1, re-applied after every options change) for `null` or a value no option has. On a
`<select data-foreach>`, when the chosen option leaves the list the choice is cleared: the model gets
the placeholder's value converted like a user pick (`""`, or `null` with `data-type="int"` / `"float"`),
or `null` when there is no placeholder; a multiple select drops the value from its array. The write is
an ordinary change (`$watch` / `$onChange` see it). A value no option has shown yet (options that
arrive later) is left alone.

## List attributes (only beside data-foreach)

| Attribute | Value | Rule | Code |
|---|---|---|---|
| `data-key` | literal field name | the field that identifies an object row (default `id`); not empty; not on a list of plain values | E505, E504, E531 |
| `data-template` | literal id | id of a `<template>` holding exactly one root element; the list element itself must be empty; may recurse | E514, E515, E516, E512, E511, E531 |
| `data-default-text` | literal text | `<select data-foreach>` only: first placeholder option | E532 |
| `data-default-value` | literal text | value of the placeholder (default `""`); needs `data-default-text` | E533 |
| `data-type` | `int`, `float`, `bool`, `boolean`, `string`, `date`, `datetime` | beside `data-value`: converts the control's text; a value that does not convert becomes `null` | none |

## Row context (inside a data-foreach row)

| Name | Is | Writable |
|---|---|---|
| a bare name (`title`) | a field of the row's item | yes (if the field is) |
| `$data` | the item itself; for plain values `data-text="$data"` | no (E313); `$data.name` is |
| `$index` | position, 0-based, follows moves | no (E313) |
| `$parent` | one level up: the model (top-level list) or the enclosing row | no (E313); `$parent.name` is |
| `$root` | the model bound by `bind()` | no (E313); `$root.name` is |

## Handlers

Called as `handler.call(owner, item, event)`: `owner` is the object the method is on (`this`), `item`
is the current row's item (outside a list: the model), `event` is the DOM event. An error thrown
synchronously goes to `Stitch.onError` (uncaught without it). When a handler returns a promise (an
`async` handler), its rejection goes to `Stitch.onError` the same way (source `handler`); without
`onError` it is re-thrown, so the browser reports an unhandled rejection.

## Stitch global

| Signature | Returns | Notes |
|---|---|---|
| `Stitch.Observable.create(data, options)` | the model (`data`, converted in place) | `options`: only `{ isolated: true }` (E705, E706); arrow methods E707; reserved names E709; frozen E714; another model inside E710; shared array/Map/Set E711 |
| `Stitch.Observable.createArray(items, options)` | a reactive array that is a model root (events, no `$watch`) | copies `items` |
| `Stitch.Observable.reactive(object, options)` | `object` made a model root in place (no `$watch`) | object inside a model E704 |
| `Stitch.Observable.toRaw(value)` | a deep plain copy (computeds as values, `_` fields left out) | use it to send data or to copy between models |
| `Stitch.Observable.isReactive(value)` | `true` / `false` | |
| `Stitch.Observable.computed(config)` | same as `Stitch.computed` | |
| `Stitch.Observable.reset()` | nothing | tests only: replaces the shared reactive system |
| `Stitch.computed(fn)` / `Stitch.computed({ get, deps })` | a marker for `create()` | `fn` gets the holder as `this` AND as its argument; lazy; read-only (assignment E713); `fn` may only read: a write (E724) or a list/Map/Set change (E725) inside it throws; E721, E722 |
| `new Stitch.DataBinder(hooks)` | a binder | `hooks` only `onBind`, `onChange`, `properties` (E611-E617) |
| `Stitch.DataBinder.registerBinding(name, { value, bind(element, model, value, context) })` | nothing | before the first `bind()` (E621); name lowercase-dashed (E622, E623), not reserved (E624) or taken (E627); `value` `'path'` (default) or `'literal'` (E626); `bind` required (E625); `context` is `{ reactiveSystem, binder }` |
| `Stitch.onError(fn)` | a remover | `fn(error, context)`; `context.source` is `binding`, `watch`, `change-handler`, `handler`, `messageBus`, `unbind`, `dispose`, `scheduler`, `effect` or `unknown`; `null` removes; second handler E902; not a function E901 |
| `Stitch.onBindReport(fn)` | a remover | after each successful `bind()`: `fn({ bound, ignored })`, entries `{ element, attribute, value }` |
| `Stitch.debug` | a frozen object with only `stats` | there is no debug mode |
| `Stitch.debug.stats()` | `{ effects, subscriptions, parentLinks }` | live counts for the page |
| `Stitch.version` | the version string | |
| `Stitch.MessageBus` | the event-bus class | `new Stitch.MessageBus()` |

## Binder

| Signature | Returns | Throws |
|---|---|---|
| `binder.bind(root, model)` | `undefined`; the first render is synchronous | selector matches nothing (E602, often: script runs before the element exists); not an element (E603); `model` not a model (E604); disposed (E605); element already bound by any binder (E601); any binding error; on any throw nothing of this call stays bound |
| `binder.unbind(element)` | `undefined`; the DOM is left as it is | disposed (E606); nothing bound inside by this binder (E607) |
| `binder.dispose()` | `undefined`; safe to call twice | never; afterwards `bind()`/`unbind()` throw |
| `binder._trackCleanup(element, fn)` | `undefined` | for custom bindings: `fn` runs on unbind, row release or dispose |
| `binder.createHooks(hooks)` | internal | do not call |

## Model helpers (hidden, reserved names)

On the root model unless noted. Every object, list, Map and Set of a model has `$onChange`,
`$offChange`, `$get`, `$set`.

| Signature | Returns | Notes |
|---|---|---|
| `model.$onChange(fn)` | a remover | `fn({ field, oldValue, newValue, target })`; own writes synchronously, nested writes later with dotted `field` and `nestedChange: true`; any object; a string first E803; two arguments E804 |
| `model.$offChange(fn)` | `undefined` | the same `fn`; no "remove all" (E807, E809) |
| `model.$watch(path, callback, options)` | a remover | root from `create()` only (`model.user.$watch` is not a function); `callback(newValue, oldValue, info)`; synchronous, `{ batch: true }` once per batch; a callback that keeps writing its own path is stopped after 100 nested runs (E912, to `onError`); missing path E204, `_` path E205, no callback E817 |
| `model.$get(path)` | the value | missing name E204; not a path E107 |
| `model.$set(path, value)` | `undefined` | a NEW single name becomes reactive; an existing path is assigned; a missing dotted path E204 |
| `model.$on(event, callback)` | an unsubscribe function | root only (E801); `$on(fn)` E811; swapped E810 |
| `model.$off(event, callback)` | `undefined` | root only; not subscribed E853 |
| `model.$emit(event, payload)` | `undefined` | root only; delivered in a microtask |
| `model.$once(event, callback)` | a cancel function | root only |
| `model.$use(middleware)` | `undefined` | root only; see `bus.use` |
| `model.toJSON()` | plain data | `JSON.stringify(model)` uses it |
| `model.on()`, `model.off()`, `model.get()`, `model.set()` | throw E802 | v2 names; fields named `on`, `off`, `get`, `set` are ordinary data |

## MessageBus

| Signature | Returns |
|---|---|
| `bus.subscribe(event, callback)` | an unsubscribe function; `"*"` receives `{ event, payload }` for every event |
| `bus.unsubscribe(event, callback)` | `undefined`; not subscribed E853 |
| `bus.publish(event, payload)` | `undefined`; delivered in a microtask; 100 rounds of re-publishing stops (E855) |
| `bus.publishSync(event, payload)` | `undefined`; delivered before it returns |
| `bus.use(middleware)` | `undefined`; `middleware({ event, payload, timestamp })` may return a changed object |
| `bus.clear()` | `undefined`; drops queued events |
| `bus.flush()` | `undefined`; delivers queued events now |

## ReactiveSystem (custom bindings: context.reactiveSystem)

| Signature | Returns |
|---|---|
| `reactiveSystem.effect(fn, options)` | an effect; runs `fn` now and after each change of what it read; `{ batch: true }` per batch, `{ lazy: true }` not now |
| `reactiveSystem.cleanup(effect)` | `undefined`; releases the effect for good |
| `reactiveSystem.untracked(fn)` | `fn()`'s result, without subscribing |
| `reactiveSystem.stats()` | `{ effects, subscriptions }` for this system |
| `reactiveSystem.dispose()` | `undefined`; releases the whole graph; later `effect()` throws E991 |
| `reactiveSystem.track()`, `reactiveSystem.trigger()`, `reactiveSystem.currentEffect` | internal; do not use |

## Timing

| Action | When the page shows it |
|---|---|
| `bind()` | before it returns |
| `model.x = v`, `push`, `splice` | the model at once; the page in a microtask (`await Promise.resolve()`) |
| `$watch` callback | synchronously, inside the write (`{ batch: true }`: in a microtask) |
| `$onChange` | own property: synchronously; nested property: in a microtask |
| `$emit`, `bus.publish` | subscribers run in a microtask |
| user typing in a `data-value` control | the model at once, inside the `input` / `change` event |
