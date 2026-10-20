# Stitch.js v3 gotchas

"About to write X → write Y instead, because Z." The last column is the error you get, and when:
**bind** = thrown by `bind()` (or the call you made); **row** = when the row renders (thrown by
`bind()` if the row exists then, else to `Stitch.onError`); **later** = to `Stitch.onError`, uncaught
without it; **silent** = no error, wrong result. Look codes up in `errors.md` (next to this file).

## Habits from other frameworks

| ID | About to write | Write instead | Because | Error |
|---|---|---|---|---|
| G1 | `<p>Hello {{ name }}</p>`, `{name}`, `${name}` in markup | `<p>Hello <span data-text="name"></span></p>` | Stitch never reads text content | silent: shows the braces |
| G2 | `data-text="{{name}}"` | `data-text="name"` | a binding value is a bare path | E103 bind |
| G3 | `v-if`, `x-if`, `*ngIf`, `data-if` | `data-visible="flag"`, or `data-foreach="ifX"` with a computed returning `[this]` or `[]` | there is no "if" binding; unknown attributes are ignored | silent |
| G4 | `v-show`, `x-show`, `data-show` | `data-visible="flag"` | not a Stitch attribute | silent |
| G5 | `v-model`, `x-model`, `data-model`, `ngModel` | `data-value="field"` | not a Stitch attribute | silent |
| G6 | `v-for="item in items"`, `x-for`, `data-for` | `data-foreach="items"` on the list element, ONE row element inside | not a Stitch attribute | silent |
| G7 | Knockout `data-bind="text: name"` | `data-text="name"` | `data-bind` is not a Stitch attribute | silent |
| G8 | `@click="count++"`, `x-on:click`, `data-click="count++"` | `data-click="increment"` and `increment() { this.count++; }` | a handler is a method name | E108 bind |
| G9 | `data-click="remove(item)"` | `data-click="$root.remove"`; `remove(item, event) { }` | handlers get `(item, event)`; no arguments in the attribute | E108 bind |
| G10 | `onclick="save()"` in markup, or `data-attr` with `onclick` | `data-click="save"` | inline handlers cannot see the model; `data-attr` refuses `on*` | E321 bind |
| G11 | `:class="{ active: on }"`, `data-class="{ active: on }"` | `rowClass: Stitch.computed(function () { return { active: this.on }; })` and `data-class="rowClass"` | no object literals in attributes | E103 bind |
| G12 | `data-visible="!done"`, `data-visible="items.length > 0"`, `data-text="a + b"` | a computed (`isOpen`, `hasItems`, `sum`) and bind its name | no expressions in attributes | E102 bind |
| G13 | `data-text="format(price)"`, `data-text="price.toFixed(2)"` | `priceText: Stitch.computed(function () { return this.price.toFixed(2); })` | no calls in attributes | E104 bind |
| G14 | `data-text="name \| upper"` (filters, pipes) | a computed | not a path | E102 bind |
| G15 | `data-value="city, visible: hasCity"` | `data-value="city" data-visible="hasCity"` | one binding per attribute | E105 bind |
| G16 | `v-html`, `data-html`, `element.innerHTML = data` | `data-text`, a list, or a custom binding that uses `document.createElement` | there is no HTML binding; HTML strings from data are script injection | silent (`data-html` ignored) |
| G17 | jQuery or DOM writes on bound elements (`.text()`, `.append()`, `textContent =`) | change the model; Stitch updates the DOM | the next update overwrites them; rows are rebuilt from the template | silent |
| G18 | `model = Stitch.Observable.create(newData)` to "re-render" | assign the bound model's properties (`model.rows = newRows`), or `binder.unbind(root)` then bind the new model | the page stays bound to the old object | silent |
| G19 | `total: Stitch.computed(() => this.price * this.qty)` | `Stitch.computed(function () { return this.price * this.qty; })` or `Stitch.computed(m => m.price * m.qty)` | an arrow's `this` is never the model | silent: `NaN` (TypeError in a module script) |
| G20 | `save: () => { this.saved = true; }` | `save() { this.saved = true; }` | arrow methods cannot see the model | E707 at create |
| G21 | `model.total()` | `model.total` | a computed is a property | TypeError |
| G22 | `model.total = 5` | change what it is computed from | computeds are read-only | E713 |
| G23 | `this.count++` (any write) inside a computed | computeds only read; write in a handler or `$watch` | a computed runs whenever it is read again | silent: wrong values |
| G24 | `return this.items.sort(...)` in a computed | `return this.items.slice().sort(...)` | `sort()` reorders the model's own array; the list stops following | silent: stale list |
| G25 | `model.newProp = 1` (Vue 2 habit), then `data-text="newProp"` | declare `newProp: null` in `create()`, or `model.$set('newProp', 1)` before `bind()` | a plain new property is not reactive | E203 bind |
| G26 | `items: [{ name: 'a' }]` (keyless rows), `:key="index"` | `items: [{ id: 1, name: 'a' }]`, or `data-key="field"` | rows are tracked by key, never by position | E501 bind |
| G27 | `save(event) { event.preventDefault(); }` | `save(item, event) { event.preventDefault(); }` | the event is the SECOND argument | TypeError: `preventDefault` is not a function |
| G28 | `this` in `$root.remove` meaning the row | the row is the first argument: `remove(row) { this.rows.splice(this.rows.indexOf(row), 1); }` | `this` is the object the method is on (the model) | silent |

## Model

| ID | About to write | Write instead | Because | Error |
|---|---|---|---|---|
| G29 | a binding to a misspelled or undeclared property | declare every bound property in `create()`, `null` if unknown | bindings check the path exists | E201 bind |
| G30 | rows from a server that sometimes lack a bound field | normalize: `rows.map(r => ({ id: r.id, email: r.email ?? null }))` | every row must have every field the template binds | E201 row |
| G31 | tree leaves without `children` | `children: []` on every node | the template binds `children` on every node | E201 row |
| G32 | binding `_count` | `count` | `_` names are never reactive | E203 bind |
| G33 | a data field named `toJSON`, `$on`, `$set`, `$watch`, ... | rename it when the data arrives (`jsonValue`) | reserved for model helpers | E709 at create |
| G34 | `model.on(fn)`, `model.off(fn)`, `model.get('a')`, `model.set('a', 1)` (v2) | `model.$onChange(fn)`, `model.$offChange(fn)`, `model.$get('a')`, `model.$set('a', 1)` | v2 names were renamed | E802 |
| G35 | `Stitch.Observable.create(data, { debug: true })` | `Stitch.Observable.create(data)`; `Stitch.onBindReport(fn)` | there is no debug mode; the only option is `isolated` | E706 |
| G36 | `Stitch.debug.enable()` | `Stitch.onBindReport(console.log)`, `Stitch.debug.stats()` | `Stitch.debug` has only `stats` | TypeError |
| G37 | `Stitch.Observable.create(initial)` twice (to reset) | a function returning fresh data: `create(blank())`; reset with `Object.assign(model, blank())` | `create()` converts its argument in place | E703 |
| G38 | `Stitch.Observable.create(model.user)` | `Stitch.Observable.create(Stitch.Observable.toRaw(model.user))` | the object already belongs to a model | E704 |
| G39 | `app.cart = cartModel` (a model per component) | `app.cart = Stitch.Observable.toRaw(cartModel)`, or one model | a model cannot be nested in another model | E710 |
| G40 | the same `countries` array in two models | `countries: [...countries]` per model (`new Map(m)`, `new Set(s)`) | an array, Map or Set belongs to one model | E711 |
| G41 | `Object.freeze` data, Redux/Immer state, frozen config | `Stitch.Observable.create(structuredClone(data))` | Stitch converts data in place | E714 |
| G42 | `delete model.selected` | `model.selected = null` | properties cannot be deleted | TypeError in strict mode; silently `false` otherwise |
| G43 | `delete model.rows[0]` | `model.rows.splice(0, 1)` | a list cannot have holes | E712 |
| G44 | `structuredClone(model)` to copy model data | `Stitch.Observable.toRaw(model)` | model lists are proxies | DataCloneError |
| G45 | `model.user.$emit('saved')`, `row.$on(...)` | call a `$root.` method; emit on the root model | events live on the root model | E801 |
| G46 | `model.user.$watch('name', fn)` | `model.$watch('user.name', fn)` | `$watch` exists only on the model `create()` returned | TypeError: not a function |
| G47 | `model.$on(fn)` for a change handler | `model.$onChange(fn)` | `$on` takes an event name | E811 |
| G48 | `model.$onChange('saved', fn)` | `model.$on('saved', fn)` | `$onChange` takes one function | E803 |
| G49 | `model.$off('saved', () => ...)` with a new function | keep the function, or call the remover `$on` returned | a new arrow is a different function | E853 |
| G50 | `model.$watch('a', v => { model.a = v + 1; })` | guard the write (`if (v !== wanted)`), or compute instead | a synchronous watch that writes its own path recurses until the stack overflows | stack overflow (engine error, not a Stitch code) |
| G51 | `$watch('_x', fn)`, `$watch('missing', fn)` | watch a declared, non-`_` property | the watch would never fire | E205, E204 |
| G52 | reading state right after `model.$emit(...)` | handle it in the subscriber, or `await Promise.resolve()` | events are delivered in a microtask | silent |
| G53 | expecting `binder.dispose()` to stop `$watch`, `$onChange`, `$on` | call the removers they return | they belong to the model, not the binder | silent |
| G54 | `Stitch.computed({ get() { ... }, set(v) { ... } })` | a plain property plus a handler that writes it | a computed has no setter: `set` is ignored | E713 on assignment |
| G55 | `data-text="selected.nmae"` while `selected` is `null` | check paths through `null` objects carefully | the rest of the path is checked only when the object arrives | E201 later |
| G56 | `data-text="items.0.title"` while `items` is `[]` | `firstTitle: Stitch.computed(function () { return this.items.length ? this.items[0].title : ''; })` | an index into an array must exist at bind | E201 bind |
| G57 | `Stitch.computed(function (format = 'short') { ... })` (v2 optional parameter) | read the option from the model: `this.format` | the first argument is the object that holds the computed | silent: the default never applies |
| G58 | one binder for two models created with `{ isolated: true }` | one binder per isolated model, or no `isolated` | rows added later to the first model stop updating | silent: stale rows |

## Markup and bindings

| ID | About to write | Write instead | Because | Error |
|---|---|---|---|---|
| G59 | `<label data-text="label"><input data-value="v"></label>` | `<label><span data-text="label"></span><input data-value="v"></label>` | `data-text` replaces the content and would destroy the bindings inside | E535 bind |
| G60 | `<ul data-foreach="rows" data-text="title">` | the title in its own element before the list | the text would replace the rows | E534 bind |
| G61 | `data-value="total"` where `total` is a computed | `data-text="total"`; `data-value` on a plain property | a computed cannot be written | E311 bind |
| G62 | `<option data-value="$data" data-text="$data">` | `<option data-text="$data"></option>` | a two-way binding cannot write `$data`; an option without a value uses its text | E313 bind |
| G63 | `data-value` on `<span>` / `<div>` | `data-text` for display; `data-value` on `input`, `textarea`, `select` | nothing reads or writes a span's value | silent |
| G64 | `selectedId: 2` with `<select data-value="selectedId">`, then `=== 2` | `<select data-value="selectedId" data-type="int">` | a select writes strings | silent: `"2" !== 2` |
| G65 | relying on the select to clear the model when its option leaves the list | reset the property when the list changes (`$watch` the source) | the select shows another option; the model keeps the old value | silent |
| G66 | a static `<option>` placeholder next to the option template in `<select data-foreach>` | `data-default-text="Choose..."` on the select | everything inside the list element is the row template | E511 bind |
| G67 | `data-class="active"` on an element with other classes | `data-class="classes"` with `{ active: bool }` from a computed | a string replaces every class | silent: static classes lost |
| G68 | `data-attr` with `{ 'aria-expanded': true }` | `{ 'aria-expanded': open ? 'true' : 'false' }` | `true` writes an empty attribute | silent: `aria-expanded=""` |
| G69 | `data-attr` with `{ style: 'color: red' }` | `{ style: { color: 'red' } }`, or `data-class` | style strings are refused | E325 bind |
| G70 | `data-attr` with an `href` from user data | build the URL in a computed (`'/u/' + encodeURIComponent(id)`) | `javascript:` and `vbscript:` URLs are refused | E323 bind or later |
| G71 | `data-attr` with `{ src: 'data:text/html,...' }` | serve from a URL; `data:image/...` only in `<img src>` | `data:` URLs are refused elsewhere | E324 |
| G72 | `data-attr` with `sandbox`, `crossorigin`, `integrity`, `allow`, `nonce`, `referrerpolicy` | write them in the markup; show variants with `data-visible` | data may not change security attributes | E327 bind |
| G73 | `data-attr` with `{ rel: 'nofollow' }` on a link whose markup has `rel="noopener"` | `{ rel: 'noopener nofollow' }`, or leave `rel` out | data may not drop `noopener`/`noreferrer` | E329 bind |
| G74 | `data-attr` with `{ rel: 'opener' }` | leave `rel` out, or `'noopener noreferrer'` | `opener` lets the linked page control this window | E328 |
| G75 | `data-attr` with `srcdoc` | `src` pointing at a page | `srcdoc` runs its own scripts | E322 |
| G76 | any binding on `<script>`, `<style>`, `<base>`, `<meta>` | bind an ordinary element (`<pre data-text>` for code) | their content is code | E326 bind |
| G77 | `data-attr` with attribute NAMES from user data (`{ [field]: value }`) | fixed names in a computed; only values from data | names other than the refused ones are written as given (`type`, `method`, `id`, `target`) | silent |
| G78 | inline `<script>` on a page with a strict Content-Security-Policy | the page script in its own `.js` file | the policy blocks inline scripts; Stitch itself needs nothing allowed | silent: nothing binds |
| G79 | `<p hidden data-visible="open">` | `<p data-visible="open">` (start hidden through the model) | `data-visible` clears only the inline `display`; `hidden` keeps it hidden | silent |
| G80 | `this.price * this.qty` with a number input bound to `qty` | `this.price * (this.qty \|\| 0)` | an empty or invalid number input writes `null` | silent: `0`/`NaN` |
| G81 | `data-text="due"` on a `Date` | `dueText: Stitch.computed(function () { return this.due ? this.due.toLocaleDateString() : ''; })` | `data-text` writes `String(value)` | silent: long date string |
| G82 | `data-text` on an object or array | a computed returning a string | objects print as `[object Object]`, arrays join with commas | silent |
| G83 | `data-enabled` on a `<div>`, `<a>` or `<span>` | a `<button>` or form control; for links, `data-class` plus `data-attr` with `'aria-disabled': 'true'` | `disabled` exists only on form controls | silent: still clickable |

## Lists

| ID | About to write | Write instead | Because | Error |
|---|---|---|---|---|
| G84 | two elements as the row (`<h4>` + `<p>`, `<dt>` + `<dd>`) | wrap them in one element | a row is exactly one element | E511 bind |
| G85 | "Loading..." text inside the list element | the message outside the list with `data-visible` | the list's content is the template (text-only throws; an element becomes the row) | E513 bind |
| G86 | `<table data-foreach="rows"><tr>...` | `<tbody data-foreach="rows">` (or a `<template>` row) | the parser inserts a `<tbody>`, which becomes the row | silent: one `<tbody>` per row |
| G87 | `data-foreach` on an object, a Map or a Set | a computed: `Object.values(this.byId)`, `Array.from(this.map.values())` | `data-foreach` needs an array | E521 bind or later |
| G88 | duplicate ids, or `['a', 'a']` | unique keys; repeated plain values as objects with ids | keys must be unique | E502 bind or later |
| G89 | `null` entries in a list | filter them out before assigning | a row cannot be `null` | E503 |
| G90 | `data-key="id"` on a list of strings | no `data-key` | plain values are their own key | E504 bind |
| G91 | `data-key=""` | `data-key="sku"` or no attribute | the key field is required | E505 bind |
| G92 | `data-key` or `data-template` on an element without `data-foreach` | put them on the list element | they configure a list | E531 bind |
| G93 | `data-template="row"` with inline children too | an empty list element | the inline content would be discarded | E516 bind |
| G94 | `data-template` naming a missing id, or a `<div>` | a `<template id="...">` with one root element | the template must exist and be a `<template>` | E514, E515 bind |
| G95 | an empty list element (`<ul data-foreach="rows"></ul>`) | one row element inside, or `data-template` | there is no row template | E512 bind |
| G96 | `data-default-text` on a `<ul>`; `data-default-value` alone | both on a `<select data-foreach>`, text first | placeholders are select options | E532, E533 bind |
| G97 | `data-click="save"` inside a row for a model method | `data-click="$root.save"` | a bare name is looked up on the row | E401 row (with an empty list: later, on the first row) |
| G98 | `data-click="$root.save"` where the model has no `save` | add the method to the root model | `$root.` handlers are checked at bind, even with no rows | E406 bind |
| G99 | `data-click="$parent.x"` outside any list | `data-click="x"` | there is no level above the model | E403 bind |
| G100 | `$parent.$parent.save` | `$root.save` | one prefix, once | E110 bind |
| G101 | `data-click="$root"` | `data-click="$root.save"` | the prefix needs a method name | E109 bind |
| G102 | `data-event="rowEvents"` inside a row for a model property | `data-event="$root.rowEvents"`, handler names inside with `$root.` | a bare path in a row is a row field | E201 row |
| G103 | `data-event="onInput"` naming a method | `data-event="inputEvents"` with `inputEvents: { input: 'onInput' }` | `data-event` names an object of event → handler | E304 bind |
| G104 | `{ input: () => this.touch() }` in an event map | `{ input: 'touch' }` | the map is model data; arrow functions are refused | E707 at create |
| G105 | `{ input: 'tuoch' }` (handler name typo) | the exact method name | handler names are looked up at bind | E401 bind |
| G106 | pushing a row whose key already exists | check before pushing, or replace: `rows[i] = newRow` | the list refuses the change; the DOM keeps its last rows while the model holds both | E502 later |
| G107 | replacing every row with fresh objects on each refresh (`this.rows = await load()`) while users edit rows | update changed fields in place (`Object.assign(row, fresh)`), keep the objects | a row is reused only for the same key AND the same object; a new object rebuilds the row (typed text, focus lost) | silent |
| G108 | sorting rows while the user types in one | sort on an explicit action | a moved row's input loses focus | silent |
| G109 | `$index + 1` for row numbers | an `<ol>`, or a CSS counter | a binding cannot compute | E102 bind |

## Forms

| ID | About to write | Write instead | Because | Error |
|---|---|---|---|---|
| G110 | `<button data-click="save">` inside a `<form>` | `<button type="button" data-click="save">` | a button without `type` submits the form and reloads the page | silent: reload |
| G111 | a `<form>` with no `submit` handler (Enter in a field) | `data-event="formEvents"` with `{ submit: 'save' }` and `event.preventDefault()` | Enter in a field submits the form | silent: reload |
| G112 | `required` / `type="email"` without `novalidate` when Stitch validates | `<form novalidate ...>` | the browser blocks the `submit` event while a field is invalid | silent: handler never runs |
| G113 | `change` or `blur` as the "touched" event | `{ input: 'touch' }` | `input` fires on every user edit of every control; `change` waits for leaving a text field | silent: late errors |
| G114 | `<input data-value="address.city">` while `address` is `null` | `address: { city: '' }`, or hide the input while `address` is `null` | Stitch does not create the missing object | E314 later (on typing) |
| G115 | an `async` handler without `try`/`catch` | `try { await ... } catch (e) { this.error = e.message; }` | Stitch ignores the promise a handler returns: a rejection goes to `unhandledrejection`, not `onError` | silent for `onError` |
| G116 | `<input type="date" data-value="due">` relying on the input type alone | add `data-type="date"` (or `datetime`) | in an engine without a date control the input is a text field and writes a string | silent: string, not `Date` |

## Binding, timing, lifecycle

| ID | About to write | Write instead | Because | Error |
|---|---|---|---|---|
| G117 | `bind()` in a `<head>` script | the script at the end of `<body>`, or inside `DOMContentLoaded` | the element does not exist yet | E602 bind |
| G118 | `binder.bind('.card', model)` expecting every match | one root around them, or bind each element: `document.querySelectorAll('.card').forEach(el => binder.bind(el, cardModel(el)))` | a selector binds its FIRST match | silent: the others stay empty |
| G119 | `bind('#app', m)` again with new data | change the data of the bound model, or `binder.unbind('#app')` first | an element is bound once | E601 bind |
| G120 | a root bound inside another bound root (widget in a bound page) | sibling roots, one model each | the outer bind reads the inner bindings as its own | E601 or E201 bind |
| G121 | `binder.unbind(el)` "just in case" | unbind only what this binder bound | unbinding nothing is a mistake | E607 |
| G122 | `binder.bind()` after `binder.dispose()` | `new Stitch.DataBinder()` | a disposed binder is finished | E605 |
| G123 | `bind(root, { ...plain })` | `bind(root, Stitch.Observable.create({ ... }))` | `bind()` needs a model | E604 |
| G124 | reading the DOM right after `model.x = 1` (tests, measurements) | `await Promise.resolve()` first | the page updates in a microtask | silent: old text |
| G125 | clicking a button in the same tick as the write that enables it | `await Promise.resolve()` between them | it is still disabled | silent: click ignored |
| G126 | `registerBinding` in a widget script loaded after the page's `bind()` | register every custom binding before the first `bind()` | elements bound earlier would miss it | E621 |
| G127 | `data-tooltip="Save changes"` with a default (path) custom binding | `registerBinding('tooltip', { value: 'literal', bind(element, model, text) { } })` | a path binding reads its value as a property path | E102 or E201 bind, with a literal hint |
| G128 | `registerBinding('myTooltip', ...)` | `registerBinding('my-tooltip', ...)` | HTML lowercases attribute names | E623 |
| G129 | registering a name twice (script included twice), or a built-in name | register once; choose a new name | names are unique | E627 |
| G130 | a custom binding effect without cleanup | `context.binder._trackCleanup(element, () => context.reactiveSystem.cleanup(effect))` | otherwise it runs forever; `Stitch.debug.stats()` keeps growing | silent |
| G131 | `element.innerHTML = value` in a custom binding | `textContent`, `document.createElement` | built-in safety checks do not cover custom bindings | silent: injection risk |
| G132 | a second `Stitch.onError(fn)` (two widgets) | one page-wide handler; remove the first (`remove()` / `onError(null)`) first | one handler per page | E902 |
| G133 | `try { binder.bind(...) } catch (e) {}` | fix the page; let the error show | the message names the fix | none |
| G134 | `if (/is not a property/.test(error.message))` | `error.message.startsWith('[Stitch E201]')` | codes are stable, wording is not | none |
