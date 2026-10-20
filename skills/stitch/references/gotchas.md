# Stitch.js v3 gotchas

"About to write X → write Y instead, because Z." The last column is the error you get, and when:
**bind** = thrown by `bind()` (or the call you made); **row** = when the row renders (thrown by
`bind()` if the row exists then, else to `Stitch.onError`); **later** = to `Stitch.onError`, uncaught
without it; **silent** = no error, wrong result. Look codes up in `errors.md` (next to this file).
Every row is executed by the library's tests: the code in "About to write" is shown failing, the
code in "Write instead" is shown working.

## Habits from other frameworks

| ID | About to write | Write instead | Because | Error |
|---|---|---|---|---|
| G1 | `<p>Hello {{ name }}</p>` | `<p>Hello <span data-text="name"></span></p>` | Stitch never reads text content | silent: shows the braces |
| G2 | `data-text="{{name}}"` | `data-text="name"` | a binding value is a bare path | E103 bind |
| G3 | `v-if="open"`, `x-if="open"`, `data-if="open"` on a page element | `data-visible="open"` | there is no "if" binding; unknown attributes are ignored | silent: always shown |
| G4 | `data-foreach="ifOpen"` returning `[this]` OUTSIDE a list (the model has no `id`) | `data-visible="open"`, or a list of one keyed object: `this.open ? [{ id: 'panel' }] : []` | `[this]` works only for a row (recipe 17), whose key is its `id` | E501 bind |
| G5 | `v-show="open"`, `x-show="open"`, `data-show="open"` | `data-visible="open"` | not a Stitch attribute | silent |
| G6 | `v-model="name"`, `x-model="name"`, `data-model="name"` | `data-value="name"` | not a Stitch attribute | silent |
| G7 | `v-model.number="qty"` on a select | `data-value="qty" data-type="int"` | a select writes strings | silent: `"2"`, not `2` |
| G8 | `v-for="item in items"`, `data-for="items"` | `data-foreach="items"` on the list element, one row element inside | not a Stitch attribute | silent |
| G9 | Knockout `data-bind="text: name"` | `data-text="name"` | `data-bind` is not a Stitch attribute | silent |
| G10 | `:href="url"`, `v-bind:title="tip"` | `data-attr="linkAttrs"` with `linkAttrs: Stitch.computed(function () { return { href: this.url, title: this.tip }; })` | not Stitch attributes | silent |
| G11 | `:disabled="busy"` | `data-enabled="idle"` with `idle: Stitch.computed(function () { return !this.busy; })`, or `data-loading="busy"` | not a Stitch attribute | silent |
| G12 | `@click="count++"`, `data-click="count++"` | `data-click="increment"` and `increment() { this.count++; }` | a handler is a method name | E108 bind |
| G13 | `@keyup.enter="save"` | `data-event="keyEvents"` with `keyEvents: { keydown: 'onKey' }` and `if (event.key === 'Enter')` in `onKey(item, event)` | Stitch has no key modifiers | silent |
| G14 | `data-click="remove(item)"` | `data-click="$root.remove"` and `remove(item, event)` taking the row first | handlers get `(item, event)`; no arguments in the attribute | E108 bind |
| G15 | `data-attr` with `{ onclick: 'save()' }` | `data-click="save"` | inline script from data is refused | E321 bind |
| G16 | `:class="{ active: on }"`, `data-class="{ active: on }"` | `rowClass: Stitch.computed(function () { return { active: this.on }; })` and `data-class="rowClass"` | no object literals in attributes | E103 bind |
| G17 | `watch: { query(value) { this.log = value; } }` (a Vue option) | `model.$watch('query', function (now) { model.log = now; })` | a field named `watch` is ordinary data | silent: never called |
| G18 | `data-visible="!done"`, `data-visible="items.length > 0"` | `notDone: Stitch.computed(function () { return !this.done; })` and `data-visible="notDone"` | no expressions in attributes | E102 bind |
| G19 | `data-text="price.toFixed(2)"` | `priceText: Stitch.computed(function () { return this.price.toFixed(2); })` | no calls in attributes | E104 bind |
| G20 | `data-text="name \| upper"` (filters, pipes) | `upperName: Stitch.computed(function () { return this.name.toUpperCase(); })` | not a path | E102 bind |
| G21 | `data-value="city, visible: hasCity"` | `data-value="city" data-visible="hasCity"` | one binding per attribute | E105 bind |
| G22 | `v-html="html"`, `data-html="html"` | `data-text="html"` (shows it as text), a list, or a custom binding that builds elements with the DOM API | there is no HTML binding; HTML from data is script injection | silent: ignored |
| G23 | jQuery or DOM writes on a bound element (`textContent =`) | change the model: `model.title = 'New'` | the next update overwrites them | silent: lost |
| G24 | `model = Stitch.Observable.create(newData)` to re-render | assign the bound model's properties: `model.title = 'new'` | the page stays bound to the old object | silent |
| G25 | `total: Stitch.computed(() => this.price * this.qty)` | `total: Stitch.computed(m => m.price * m.qty)` or `function () { return this.price * this.qty; }` | an arrow's `this` is never the model | silent: `NaN` (TypeError in a module script) |
| G26 | `save: () => { this.saved = true; }` | `save() { this.saved = true; }` | arrow methods cannot see the model | E707 at create |
| G27 | `model.total()` | `model.total` | a computed is a property | TypeError |
| G28 | `model.total = 5` | change what it is computed from: `model.price = 5` | computeds are read-only | E713 |
| G29 | `this.reads++` (any write) inside a computed | write in a handler or a `$watch` callback | a computed only reads | E724 where it is read |
| G30 | `return this.items.sort((a, b) => a.id - b.id)` in a computed | `return this.items.slice().sort((a, b) => a.id - b.id)` | `sort()` would reorder the model itself | E725 where it is read |
| G31 | `model.newProp = 1` (Vue 2 habit), then `data-text="newProp"` | `model.$set('newProp', 1)` before binding, or declare `newProp: null` | a plain new property is not reactive | E203 bind |
| G32 | `items: [{ name: 'a' }]` (keyless rows) | `items: [{ id: 1, name: 'a' }]`, or `data-key="field"` | rows are tracked by key, never by position | E501 bind |
| G33 | `save(event) { event.preventDefault(); }` | `save(item, event) { event.preventDefault(); }` | the event is the SECOND argument | TypeError: `preventDefault` is not a function |
| G34 | `this.rows.splice(this.rows.indexOf(this), 1)` in `$root.remove` (`this` as the row) | `remove(row) { this.rows.splice(this.rows.indexOf(row), 1); }` | `this` is the object the method is on (the model); the row is the first argument | silent: wrong row |

## Model

| ID | About to write | Write instead | Because | Error |
|---|---|---|---|---|
| G35 | `data-text="nmae"` (a typo, or an undeclared property) | declare every bound property in `Stitch.Observable.create`, `null` if unknown: `nickname: null` | bindings check the path exists | E201 bind |
| G36 | rows from a server that sometimes lack a bound field | normalize: `rows.map(r => ({ id: r.id, email: r.email ?? null }))` | every row needs every field the template binds | E201 row |
| G37 | tree leaves without `children` | `children: []` on every node | the template binds `children` on every node | E201 row |
| G38 | `data-text="_count"` | `data-text="count"` | `_` names are never reactive | E203 bind |
| G39 | a data field named `toJSON` (or another model helper name) | rename it when the data arrives: `jsonValue: r.toJSON` | reserved for model helpers | E709 at create |
| G40 | `model.on(fn)`, `model.get('a')` (v2) | `model.$onChange(fn)`, `model.$get('a')` | v2 names were renamed | E802 |
| G41 | `Stitch.Observable.create(data, { debug: true })` | `Stitch.Observable.create(data)` and `Stitch.onBindReport(fn)` | there is no debug mode; the only option is `isolated` | E706 |
| G42 | `Stitch.debug.enable()` | `Stitch.debug.stats()` | `Stitch.debug` has only `stats` | TypeError |
| G43 | `Stitch.Observable.create(initial)` twice (to reset) | `Stitch.Observable.create(blank())`; reset with `Object.assign(model, blank())` | `create()` converts its argument in place | E703 |
| G44 | `Stitch.Observable.create(model.user)` | `Stitch.Observable.create(Stitch.Observable.toRaw(model.user))` | the object already belongs to a model | E704 |
| G45 | `app.cart = cartModel` (a model per component) | `app.cart = Stitch.Observable.toRaw(cartModel)` | a model cannot be nested in another model | E710 |
| G46 | the same `countries` array in two models | `countries: [...countries]` per model | an array, Map or Set belongs to one model | E711 |
| G47 | `Object.freeze` data, Redux/Immer state | `Stitch.Observable.create(structuredClone(data))` | Stitch converts data in place | E714 |
| G48 | `delete model.selected` | `model.selected = null` | properties cannot be deleted | silent `false` (TypeError in strict mode) |
| G49 | `delete model.rows[0]` | `model.rows.splice(0, 1)` | a list cannot have holes | E712 |
| G50 | `structuredClone(model)` to copy model data | `Stitch.Observable.toRaw(model)` | model lists are proxies | DataCloneError |
| G51 | `model.user.$emit('saved')` | `model.$emit('saved')` on the root model; from a row, call a `$root.` method that emits | events live on the root model | E801 |
| G52 | `model.user.$watch('name', fn)` | `model.$watch('user.name', fn)` | `$watch` exists only on the model `create()` returned | TypeError: not a function |
| G53 | `model.$on(fn)` for a change handler | `model.$onChange(fn)` | `$on` takes an event name | E811 |
| G54 | `model.$onChange('saved', fn)` | `model.$on('saved', fn)` | `$onChange` takes one function | E803 |
| G55 | `model.$off('saved', () => {})` with a new function | call the remover `$on` returned: `stop()` | a new arrow is a different function | E853 |
| G56 | `model.$watch('a', function (v) { model.a = v + 1; })` | write only when needed: `if (v > 10) model.a = 10;` | a synchronous watch that writes its path re-runs itself | E912 later |
| G57 | `$watch('_x', fn)`, `$watch('missing', fn)` | watch a declared property whose name does not start with an underscore | the watch would never fire | E205, E204 |
| G58 | reading state right after `model.$emit('ping')` | handle it in the subscriber, or `await Promise.resolve()` | events are delivered in a microtask | silent: not yet |
| G59 | expecting `binder.dispose()` to stop `$watch`, `$onChange`, `$on` | call the removers they return: `stopWatch()` | they belong to the model, not the binder | silent: still running |
| G60 | `Stitch.computed({ get() { return this.first; }, set(value) { this.first = value; } })` | a plain property, written by a handler: `rename(model, event) { this.first = 'Grace'; }` | a computed has no setter: `set` is ignored | E713 on assignment |
| G61 | `data-text="selected.nmae"` while `selected` is `null` | `data-text="selected.name"` (check paths through `null` objects carefully) | the rest of the path is checked only when the object arrives | E201 later |
| G62 | `data-text="items.0.title"` while `items` is `[]` | `firstTitle: Stitch.computed(function () { return this.items.length ? this.items[0].title : ''; })` | an index into an array must exist at bind | E201 bind |
| G63 | `function (format = 'short')` as a computed's function (v2 optional parameter) | read the option from the model: `this.format` | the first argument is the object that holds the computed | silent: the default never applies |
| G64 | one binder for two models created with `{ isolated: true }` | one binder per isolated model: `new Stitch.DataBinder().bind('#b', B)` | rows added later to the first model stop updating | silent: stale rows |
| G65 | `rows.push({ id: 3, go: () => 1 })` | `rows.push({ id: 3, go() { return 1; } })` | arrow methods are refused wherever data enters a model | E707 at the push |

## Markup and bindings

| ID | About to write | Write instead | Because | Error |
|---|---|---|---|---|
| G66 | `<label data-text="label"><input data-value="v"></label>` | `<label><span data-text="label"></span><input data-value="v"></label>` | `data-text` replaces the content and would destroy the bindings inside | E535 bind |
| G67 | `<ul data-foreach="rows" data-text="title">` | `<h3 data-text="title"></h3>` before the list | the text would replace the rows | E534 bind |
| G68 | `data-value="total"` where `total` is a computed | `data-text="total"`; `data-value` on a plain property | a computed cannot be written | E311 bind |
| G69 | `<option data-value="$data" data-text="$data">` | `<option data-text="$data"></option>` | a two-way binding cannot write `$data`; an option without a value uses its text | E313 bind |
| G70 | `<span data-value="name">` | `<span data-text="name">` to show it; `<input data-value="name">` to edit it | nothing reads or writes a span's value | silent: empty |
| G71 | `<select data-value="selectedId">` over numeric ids, then `=== 2` | `<select data-value="selectedId" data-type="int">` | a select writes strings | silent: `"2" !== 2` |
| G72 | `this.cities = []` while reloading, then `this.cities = loaded` | assign the new list in one step: `this.cities = loaded` | a chosen option that leaves the list clears the choice (to the placeholder value, or `null`) | silent: choice cleared |
| G73 | `<option value="">Pick</option>` next to the option template in a select list | `data-default-text="Pick"` on the select | everything inside the list element is the row template | E511 bind |
| G74 | `data-class="state"` (a string) on an element with other classes | `data-class="classes"` with `{ active: this.on }` from a computed | a string replaces every class | silent: static classes lost |
| G75 | `data-attr` with `{ 'aria-expanded': true }` | `{ 'aria-expanded': this.open ? 'true' : 'false' }` | `true` writes an empty attribute | silent: `aria-expanded=""` |
| G76 | `data-attr` with `{ style: 'color: red' }` | `{ style: { color: 'red' } }`, or `data-class` | style strings are refused | E325 bind |
| G77 | `data-attr` with `{ href: userInput }` | a computed: `'/u/' + encodeURIComponent(this.userId)` | `javascript:` and `vbscript:` URLs are refused | E323 bind or later |
| G78 | `data-attr` with `{ href: 'data:text/html,hi' }` | a URL the server serves: `{ href: '/files/report.html' }` | `data:` URLs are refused, except `data:image/...` in an `<img>` `src` | E324 |
| G79 | `data-attr` with `{ sandbox: null }` (or another security attribute) | write them in the markup: `sandbox=""` | data may not change security attributes (`sandbox`, `crossorigin`, `integrity`, `allow`, `nonce`, `referrerpolicy`, ...) | E327 bind |
| G80 | `data-attr` with `{ rel: 'nofollow' }` on a link whose markup has `rel="noopener"` | `{ rel: 'noopener nofollow' }`, or leave `rel` out | data may not drop `noopener`/`noreferrer` | E329 bind |
| G81 | `data-attr` with `{ rel: 'opener' }` | `{ rel: 'noopener noreferrer' }`, or leave `rel` out | `opener` lets the linked page control this window | E328 |
| G82 | `data-attr` with `{ srcdoc: '<p>hi</p>' }` on an iframe | a page URL instead: a link with `{ href: '/files/report.html' }`, or the frame's src in the markup | `srcdoc` runs its own scripts | E322 |
| G83 | `<style data-text="css">` (any binding on a script, style, base or meta element) | `<pre data-text="css">` | their content is code | E326 bind |
| G84 | `data-attr` with names from data (`{ [field]: value }`) | fixed names in a computed: `{ placeholder: this.hint }` | names other than the refused ones are written as given (`type`, `method`, `id`) | silent: a password field became a text field |
| G85 | inline `<script>` on a page with a strict Content-Security-Policy | the page script in its own `.js` file | the policy blocks inline scripts; Stitch itself needs nothing allowed | silent: nothing binds |
| G86 | `<p hidden data-visible="open">` | `<p data-visible="open">` (start hidden through the model) | `data-visible` clears only the inline `display`; `hidden` keeps it hidden | silent: never shown |
| G87 | `<p class="hid" data-visible="open">` with `.hid { display: none; }` | no hiding class: `<p data-visible="open">` | `data-visible` clears only the inline `display`; the stylesheet keeps it hidden | silent: never shown |
| G88 | `this.price * this.qty` with a number input bound to `qty` | `this.price * (this.qty \|\| 0)` | an empty or invalid number input writes `null` | silent: `0`/`NaN` |
| G89 | `data-text="due"` on a `Date` | `dueText: Stitch.computed(function () { return this.due ? this.due.toISOString().slice(0, 10) : ''; })` | `data-text` writes `String(value)` | silent: long date string |
| G90 | `data-text="obj"` on an object or array | a computed returning a string: `JSON.stringify(this.obj)`, `this.tags.join(', ')` | objects print as `[object Object]`, arrays join with commas | silent |
| G91 | `<a data-enabled="ok" data-click="go">` | `<button type="button" data-enabled="ok" data-click="go">` | `disabled` exists only on form controls | silent: still clickable |

## Lists

| ID | About to write | Write instead | Because | Error |
|---|---|---|---|---|
| G92 | two elements as the row (a dt and a dd) | wrap them in one element: `<div><dt data-text="term"></dt><dd data-text="meaning"></dd></div>` | a row is exactly one element | E511 bind |
| G93 | `Loading...` text inside the list element | `<p data-visible="loading">Loading...</p>` outside the list | the list's content is the template | E513 bind |
| G94 | `<table data-foreach="rows">` | `<tbody data-foreach="rows">` (or a template row) | the parser inserts a `<tbody>`, which becomes the row | silent: one `<tbody>` per row |
| G95 | `data-foreach="byId"` on an object (or a Map, a Set) | `rows: Stitch.computed(function () { return Object.values(this.byId); })` | `data-foreach` needs an array | E521 bind or later |
| G96 | `['a', 'a']`, or two rows with one `id` | objects with unique ids: `[{ id: 1, tag: 'a' }, { id: 2, tag: 'a' }]` | keys must be unique | E502 bind or later |
| G97 | `null` entries in a list | filter them out: `rows.filter(r => r !== null)` | a row cannot be `null` | E503 |
| G98 | `data-key="id"` on a list of strings | no data-key: `<ul data-foreach="tags">` | plain values are their own key | E504 bind |
| G99 | `data-key=""` | `data-key="sku"` | the key field must be named | E505 bind |
| G100 | `data-key="sku"` on an element without data-foreach | `data-foreach="rows" data-key="sku"` on the list element | it configures a list | E531 bind |
| G101 | `data-template="row"` with inline children too | an empty list element: `<ul data-foreach="rows" data-template="row"></ul>` | the inline content would be discarded | E516 bind |
| G102 | `data-template` naming a missing id, or a div | `<template id="row">` with one root element | the template must exist and be a `<template>` | E514, E515 bind |
| G103 | `<ul data-foreach="rows"></ul>` (no row element) | `<ul data-foreach="rows"><li data-text="$data"></li></ul>` | there is no row template | E512 bind |
| G104 | `data-default-text` on a list that is not a select; `data-default-value` alone | both on a select list, with `data-default-text` | placeholders are select options | E532, E533 bind |
| G105 | `data-click="save"` inside a row for a model method | `data-click="$root.save"` | a bare name is looked up on the row | E401 row (with an empty list: later, on the first row) |
| G106 | `data-click="$root.save"` where the model has no `save` | add `save()` to the root model | `$root.` handlers are checked at bind, even with no rows | E406 bind |
| G107 | `data-click="$parent.save"` outside any list | `data-click="save"` | there is no level above the model | E403 bind |
| G108 | `data-click="$parent.$parent.save"` | `data-click="$root.save"` | one prefix, once | E110 bind |
| G109 | `data-click="$root"` | `data-click="$root.save"` | the prefix needs a method name | E109 bind |
| G110 | `data-event="rowEvents"` inside a row for a model property | `data-event="$root.rowEvents"`, with names inside like `'$root.touch'` | a bare path in a row is a row field | E201 row |
| G111 | `data-event="onInput"` naming a method | `data-event="inputEvents"` with `inputEvents: { input: 'onInput' }` | `data-event` names an object of event → handler | E304 bind |
| G112 | `{ input: () => {} }` in an event map | `{ input: 'touch' }` | the map is model data; arrow functions are refused | E707 at create |
| G113 | `{ input: 'tuoch' }` (a handler name typo) | `{ input: 'touch' }`, the exact method name | handler names are looked up at bind | E401 bind |
| G114 | `rows.push({ id: 1, name: 'again' })` when id 1 exists | replace it: `rows[0] = { id: 1, name: 'again' }` | keys must stay unique; the model keeps both, the page keeps its last rows | E502 later |
| G115 | `this.rows = fresh` on every refresh while users edit rows | update fields in place: `Object.assign(this.rows[0], fresh[0])` | a row is reused only for the same key AND the same object; a new object rebuilds the row (typed text, focus lost) | silent: rows rebuilt |
| G116 | `data-text="$index + 1"` for row numbers | `<ol data-foreach="rows">` (the list numbers itself), or a CSS counter | a binding cannot compute | E102 bind |

## Forms

| ID | About to write | Write instead | Because | Error |
|---|---|---|---|---|
| G117 | `<button data-click="go">` inside a form | `<button type="button" data-click="go">` | a button without `type` submits the form and reloads the page | silent: reload |
| G118 | a form with no submit handler (Enter in a field submits it) | `data-event="formEvents"` with `formEvents: { submit: 'save' }` and `event.preventDefault()` | Enter in a field submits the form | silent: reload |
| G119 | `required` / `type="email"` without novalidate when Stitch validates | `<form novalidate data-event="formEvents">` | the browser blocks the `submit` event while a field is invalid | silent: handler never runs |
| G120 | `{ change: 'touch' }` (or blur) as the "touched" event | `{ input: 'touch' }` | `input` fires on every user edit; `change` waits for leaving a text field | silent: late errors |
| G121 | `data-value="address.city"` while `address` is `null` | `address: { city: '' }`, or hide the input while `address` is null | Stitch does not create the missing object | E314 later (on typing) |
| G122 | `async save() { await api(); }` with no catch, expecting the page to show the failure | `try { await api(); } catch (e) { this.error = e.message; }` | a rejected handler promise goes to `Stitch.onError` (an unhandled rejection without it), not into the page | later: `Stitch.onError` |
| G123 | `<input type="date" data-value="due">` relying on the input type alone | `<input type="date" data-type="date" data-value="due">` | an engine without a date control treats it as a text field, which writes a string | silent: string, not `Date` |

## Binding, timing, lifecycle

| ID | About to write | Write instead | Because | Error |
|---|---|---|---|---|
| G124 | binding in a script that runs before the element | the script at the end of the body, or inside `DOMContentLoaded` | the element does not exist yet | E602 bind |
| G125 | `binder.bind('.card', model)` expecting every match | bind each element: `document.querySelectorAll('.card').forEach(el => binder.bind(el, cardModel(el)))` | a selector binds its FIRST match | silent: the others stay empty |
| G126 | `binder.bind('#p', model)` again with new data | `binder.unbind('#p')` first, or change the bound model's data | an element is bound once | E601 bind |
| G127 | a root bound inside another bound root (a widget in a bound page) | sibling roots, one model each | the outer bind reads the inner bindings as its own | E601 or E201 bind |
| G128 | `binder.unbind('#p')` "just in case" | unbind once, only what this binder bound | unbinding nothing is a mistake | E607 |
| G129 | binding after `binder.dispose()` | `new Stitch.DataBinder()` | a disposed binder is finished | E605 |
| G130 | `bind('#p', { t: 1 })` (plain data) | `bind('#p', Stitch.Observable.create({ t: 1 }))` | `bind()` needs a model | E604 |
| G131 | reading the DOM right after `model.t = 'new'` | `await Promise.resolve()` first | the page updates in a microtask | silent: old text |
| G132 | clicking a button in the same tick as the write that enables it | `await Promise.resolve()` between them | it is still disabled | silent: click ignored |
| G133 | `registerBinding` in a widget script loaded after the page's first bind | register every custom binding before the first bind | elements bound earlier would miss it | E621 |
| G134 | `data-tooltip="Save changes"` with a default (path) custom binding | `registerBinding('tooltip', { value: 'literal', bind(element, model, text) { element.title = text; } })` | a path binding reads its value as a property path | E102 or E201 bind, with a literal hint |
| G135 | `registerBinding('myTooltip', { bind() {} })` | `registerBinding('my-tooltip', { bind() {} })` | HTML lowercases attribute names | E623 |
| G136 | registering a name twice (a script included twice), or a built-in name | register once, under a new name | names are unique | E627 |
| G137 | a custom binding effect without cleanup | `context.binder._trackCleanup(element, () => context.reactiveSystem.cleanup(effect))` | otherwise it runs forever; `Stitch.debug.stats()` keeps growing | silent: leak |
| G138 | `element.innerHTML = value` in a custom binding | `element.textContent = value` | built-in safety checks do not cover custom bindings | silent: data becomes markup |
| G139 | a second `Stitch.onError(fn)` (two widgets) | one page-wide handler; call the remover the first returned: `remove()` | one handler per page | E902 |
| G140 | `try { binder.bind('#p', model); } catch (e) {}` | let it throw: `binder.bind('#p', model);` and fix what the message names | the message names the fix; a swallowed bind leaves the page empty | silent: blank page |
| G141 | `if (/is not a property/.test(error.message))` | `error.message.startsWith('[Stitch E201]')` | codes are stable, wording is not | silent: breaks on rewording |
