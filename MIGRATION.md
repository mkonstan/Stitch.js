# Migration guide

- [Stitch.js v2 to v3](#stitchjs-v2-to-v3) (current)
- [History: Stitch.js v1.0 to v2.0](#history-stitchjs-v10-to-v20)

## Stitch.js v2 to v3

v3 makes every mistake loud. In v2, a misspelled property, a list without keys, an expression in an
attribute or a handler that could not be found did nothing, or rendered the wrong rows, without an
error. In v3 each one throws (or reaches `Stitch.onError`), naming the element, the binding and the
fix. Most of the changes below turn a silent failure into an error; a few rename APIs.

How to migrate a page:

1. Load the v3 `stitch.js`, open the page, and fix each error it throws, top to bottom. The message
   names the fix; the [error reference](docs/ERRORS.md) explains each one.
2. Search your scripts for the renamed APIs below (`.on(`, `.off(`, `.get(`, `.set(`,
   `Stitch.debug.`, `{ debug: true }`) and for event handlers that take `event` first.
3. Install `Stitch.onError` on pages users depend on, so errors in later updates reach you.
4. Exercise the page (click, type, filter): some mistakes in list rows and handlers surface only when
   a row renders or a handler runs.

In each section below, **Before** is v2 code and **After** is the v3 equivalent. Where the v2 code
throws in v3, the block shows the message you will see. Every block is executed by the test suite
against v3.

### Model helpers are $-prefixed

`on`, `off`, `get` and `set` were model methods in v2, which made data fields with those names
impossible. In v3 the helpers are `$onChange`, `$offChange`, `$get` and `$set`, and `on`, `off`,
`get`, `set` are free for data. Calling an old name where no data field has it throws a message
that names the new one.

Before:

```js throws
const model = Stitch.Observable.create({ count: 0 });
model.on(function (change) { console.log(change.field); });
```
Throws: `.on() is now .$onChange() in Stitch v3`

After:

```js run
const model = Stitch.Observable.create({ count: 0 });
function log(change) { /* change.field, change.oldValue, change.newValue */ }
model.$onChange(log);
model.$offChange(log);
```

| v2 | v3 |
|---|---|
| `model.on(fn)` | `model.$onChange(fn)` |
| `model.off(fn)` | `model.$offChange(fn)` (always with the function; there is no "remove all") |
| `model.off()` | call `$offChange(fn)` once per handler |
| `model.get('a.b')` | `model.$get('a.b')` |
| `model.set('a.b', v)` | `model.$set('a.b', v)` |

`$on` takes an event name and a callback only; `$on(fn)` (a change handler) throws and points to
`$onChange`.

Change handlers now fire for every write. In v2 they did not fire for a property that nothing on
the page was reading.

### Events live on the root model

In v2 every nested object and list row had its own event channel, so `row.$emit('saved')` never
reached `model.$on('saved')`. In v3, `$on`, `$off`, `$emit`, `$once` and `$use` exist only on the
model `Observable.create()` returned; on anything inside it they throw.

Before:

```js throws
const model = Stitch.Observable.create({ user: { name: 'Ada' } });
model.user.$emit('renamed', 'Ada');
```
Throws: `events live on the root model`

After:

```js run
const model = Stitch.Observable.create({ user: { name: 'Ada' } });
model.$on('renamed', function (name) {});
model.$emit('renamed', 'Ada');
```

From inside a list row, call a root method with `data-click="$root.save"` and emit from there.

### No debug mode

`Stitch.debug.enable()`, `Stitch.debug.disable()`, debug categories and the `{ debug: true }` option
are gone. Stitch behaves the same in development and production: mistakes throw, errors in updates go
to `Stitch.onError`, and `Stitch.onBindReport` lists what `bind()` used and ignored.
`Stitch.debug.stats()` remains, read-only. Unknown options throw.

Before:

```js throws
const model = Stitch.Observable.create({ count: 0 }, { debug: true });
```
Throws: `unknown option "debug". Known options: isolated. There is no debug mode in v3`

After:

```js run
const model = Stitch.Observable.create({ count: 0 });
Stitch.onBindReport(function (report) { /* report.bound, report.ignored */ });
const counts = Stitch.debug.stats(); // { effects, subscriptions, parentLinks }
```

### Every list row needs a key

v2 fell back to the row position (or a `key` field) when a row had no `id`, so filtering or
reordering could show the wrong data in a row. v3 keys every object row by its `id`, or by the field
named with the new `data-key` attribute; a plain value is its own key. A missing or duplicate key
throws.

Before:

```html page
<ul id="app" data-foreach="stocks"><li data-text="name"></li></ul>
```

```js throws
const model = Stitch.Observable.create({ stocks: [{ ticker: 'ACME', name: 'Acme' }] });
new Stitch.DataBinder().bind('#app', model);
```
Throws: `row 0 has no "id"`

After:

```html page
<ul id="app" data-foreach="stocks" data-key="ticker"><li data-text="name"></li></ul>
```

```js run
const model = Stitch.Observable.create({ stocks: [{ ticker: 'ACME', name: 'Acme' }] });
new Stitch.DataBinder().bind('#app', model);
```
<!-- check: text('#app li') === 'Acme' -->

Related list changes:

- A row template must be exactly one element. v2 silently rendered only the first of several root
  elements (and dropped the rest, including nested lists). v3 throws; wrap them in one element.
- Replacing a row with a new object under the same key now shows the new object (v2 kept the old
  row bound to the old object).
- `data-foreach` on a value that is not an array (and not `null`/`undefined`) throws; v2 cleared the
  list silently.
- A `<select data-foreach>` without `data-value` keeps the user's choice when the list changes; v2
  reset it to the placeholder on every change.
- Rows that leave a list release their bindings (v2 leaked them on hide/show and filter cycles).

### Handlers receive (item, event)

In v2 a handler outside a list received the event first. In v3 every handler is called as
`handler(item, event)` with `this` set to the object the method is on, where `item` is the current
row's item, or the model outside a list. Handler names are a bare name (the current row; the model
outside a list), `$parent.name` or `$root.name`; a name that is not found throws at `bind()` and
says where it does exist.

Before (v2 handler signature, which no longer receives the event first):

```js fragment
addTodo(event) { event.preventDefault(); this.todos.push({ id: Date.now(), text: this.newTodo }); }
```

After:

```html page
<form id="app"><input data-value="newTodo"><button id="add" type="submit" data-click="addTodo">Add</button><span id="n" data-text="todos.length"></span></form>
```

```js run
let nextId = 1;
const model = Stitch.Observable.create({
    newTodo: 'milk',
    todos: [],
    addTodo(model, event) {
        event.preventDefault();
        this.todos.push({ id: nextId++, text: this.newTodo });
    }
});
new Stitch.DataBinder().bind('#app', model);
```
<!-- check: click('#add') -->
<!-- check: text('#n') === '1' -->

In a nested list, `data-click="$root.remove"` now reaches the root model (in v2 it did nothing).

### Bindings name one property; no expressions

v2 accepted some expressions and comma-separated options in attributes and rendered nothing for the
rest. In v3 a binding value is one property path. Expressions, calls, object literals and options
throw at `bind()`. Move the logic into computed properties.

Before:

```html page
<p id="app" data-visible="!isLoading">Loaded</p>
```

```js throws
const model = Stitch.Observable.create({ isLoading: false });
new Stitch.DataBinder().bind('#app', model);
```
Throws: `an expression is not supported`

After:

```html page
<p id="app" data-visible="isLoaded">Loaded</p>
```

```js run
const model = Stitch.Observable.create({
    isLoading: false,
    isLoaded: Stitch.computed(function () { return !this.isLoading; })
});
new Stitch.DataBinder().bind('#app', model);
```
<!-- check: visible('#app') -->

Write `data-value="city" data-visible="hasCity"` instead of `data-value="city, visible: hasCity"`.

### Every bound property must exist

v2 rendered an empty value for a binding to a property the model did not have. v3 throws, listing
the properties the model has. Declare every bound property in `Observable.create()` with a starting
value (`null` is fine), and add later properties with `$set` (plain assignment adds a property no
binding can follow). Bindings to properties starting with `_` throw too: they were never reactive.

Before:

```html page
<span id="app" data-text="user.nickname"></span>
```

```js throws
const model = Stitch.Observable.create({ user: { name: 'Ada' } });
new Stitch.DataBinder().bind('#app', model);
```
Throws: `"nickname" is not a property of "user"`

After:

```html page
<span id="app" data-text="user.nickname"></span>
```

```js run
const model = Stitch.Observable.create({ user: { name: 'Ada', nickname: null } });
new Stitch.DataBinder().bind('#app', model);
```

### Only Stitch's own attributes are read

v2 looked at every `data-*` attribute, so `data-testid` or `data-bs-toggle` could trip it, while a
misspelled binding was only reported in debug mode. v3 reads only its own attributes. A misspelled
binding (`data-txt`) is not Stitch's and is ignored; install `Stitch.onBindReport(fn)` to list
ignored attributes while you develop.

### Errors in updates are reported

v2 logged errors raised during an update (a list re-render, a computed, a change handler) with
`console.error` and carried on, leaving the page stale. v3 passes them to `Stitch.onError(fn)`, or,
with no handler installed, re-throws them as uncaught errors. The page keeps its last good state.
Stitch itself never logs to the console.

```js run
const remove = Stitch.onError(function (error, context) {
    // send to your error tracker: error.message, context.source, context.binding
});
```

### Custom bindings

- A custom binding's attribute value is a model path by default, and the path must exist. For a
  binding that takes text (`data-tooltip="Save changes"`), register it with `value: 'literal'`.
- `registerBinding` must be called before the first `bind()` on the page; later it throws.
- A name must be lowercase letters, digits and dashes; re-registering a built-in name throws (v2
  warned and replaced it).

Before:

```html page
<button id="app" data-tooltip="Save changes">Save</button>
```

```js throws
Stitch.DataBinder.registerBinding('tooltip', {
    bind(element, model, value) { element.title = value; }
});
new Stitch.DataBinder().bind('#app', Stitch.Observable.create({}));
```
Throws: `registerBinding("tooltip", { value: 'literal'`

The text is read as a property path; with a space in it, it is rejected as an expression (a
single word would be reported as a missing property). Because data-tooltip is a custom binding,
the message ends with the fix: register it with `value: 'literal'`.

After (the binding is declared literal):

```html page
<button id="app" data-tooltip="Save changes">Save</button>
```

```js run
Stitch.DataBinder.registerBinding('tooltip', {
    value: 'literal',
    bind(element, model, text) { element.title = text; }
});
new Stitch.DataBinder().bind('#app', Stitch.Observable.create({}));
```
<!-- check: attr('#app', 'title') === 'Save changes' -->

### A model cannot hold another model

In v2, assigning one model into another left it a separate root, so events, change handlers and
error paths ignored the outer model. v3 throws. Assign plain data, or a copy made with
`Observable.toRaw()`. Two models cannot share one array, `Map` or `Set` either: give each its own
copy (`[...list]`, `new Map(map)`, `new Set(set)`).

Before:

```js throws
const app = Stitch.Observable.create({ cart: null });
const cart = Stitch.Observable.create({ items: [] });
app.cart = cart;
```
Throws: `A model cannot be nested in another model`

After:

```js run
const app = Stitch.Observable.create({ cart: null });
const cart = Stitch.Observable.create({ items: [] });
app.cart = Stitch.Observable.toRaw(cart);
```

`Observable.toRaw()` now returns a deep plain copy for every model value; in v2 it returned the
reactive list itself for an array.

### Properties cannot be deleted

In v2, `delete model.x` removed the reactive accessor, and the page stopped following `x` without an
error. In v3 model properties cannot be deleted (strict-mode code gets a `TypeError`, sloppy-mode
code gets `false`), and `delete` on a list, `Map` or `Set` throws. Set the property to `null`; use
`splice` on lists and `delete(key)` on Maps and Sets.

Before:

```js throws
const model = Stitch.Observable.create({ rows: [{ id: 1 }] });
delete model.rows[0];
```
Throws: `use rows.splice(0, 1)`

After:

```js run
const model = Stitch.Observable.create({ rows: [{ id: 1 }], selected: { id: 1 } });
model.rows.splice(0, 1);
model.selected = null;
```

### data-attr refuses values that could run script

In v2, `data-attr` wrote whatever the data said: an `onclick` attribute, a `javascript:` link, a
`srcdoc` document, a `data:` URL, a style string, or removed a static `sandbox`. In v3 each of those
throws (E321-E325, E327-E329) and the
object writes nothing; built-in bindings on `<script>`, `<style>`, `<base>` and `<meta>` throw
(E326). The change most pages notice is `style`: a style string is refused (a strict
Content-Security-Policy would block it); give `style` an object, which is written through the
CSSOM, property by property. Behaviour belongs in `data-click` / `data-event`.

Security-sensitive names are refused whatever the value, which also catches legitimate v2 uses:
`crossorigin` on an `<img>` or `<video>` (for canvas or CORS media) and `allowfullscreen` on an
embedded video, set from data, now throw E327. Write them in the markup
(`<img crossorigin="anonymous" data-attr="imageAttrs">`). A `rel` from data may no longer drop a
`noopener` / `noreferrer` written in the markup (E329).

Before:

```html page
<div id="app" data-attr="box">Box</div>
```

```js throws
const model = Stitch.Observable.create({ box: { style: 'color: red; font-weight: bold', onclick: 'save()' } });
new Stitch.DataBinder().bind('#app', model);
```
Throws: `[Stitch E325]`

After:

```html page
<div id="app" data-attr="box" data-click="save">Box</div>
```

```js run
const model = Stitch.Observable.create({
    saved: false,
    box: { style: { color: 'red', fontWeight: 'bold' } },
    save() { this.saved = true; }
});
new Stitch.DataBinder().bind('#app', model);
```
<!-- check: document.getElementById('app').style.fontWeight === 'bold' && click('#app') -->
<!-- check: document.getElementById('app').getAttribute('onclick') === null -->

### Binding and unbinding are checked

v2 ignored a second `bind()` of the same element, or bound it twice, and a needless `unbind()` did
nothing. In v3 each of these throws:

- Binding an element that is already bound (by any binder) throws; `unbind()` it first.
- `unbind()` of an element with nothing bound by that binder throws, so a second `unbind()` throws.
- `bind()` and `unbind()` on a disposed binder throw.
- A `bind()` that throws leaves nothing bound.
- `new DataBinder(hooks)` rejects unknown hook names and hooks that are not functions.
- `data-key`, `data-template`, `data-default-text` and `data-default-value` outside the element
  they configure throw; so do `data-text` on an element containing bound elements and `data-text`
  together with `data-foreach`.
- `data-value` on a computed, a read-only getter or a row-context value (`$index`, `$data`, ...)
  throws.

Before (rebinding a section to new data):

```html page
<p id="app" data-text="title"></p>
```

```js throws
const binder = new Stitch.DataBinder();
binder.bind('#app', Stitch.Observable.create({ title: 'Draft' }));
binder.bind('#app', Stitch.Observable.create({ title: 'Final' }));
```
Throws: `is already bound by this DataBinder`

After (unbind first, or keep one model and change its data):

```html page
<p id="app" data-text="title"></p>
```

```js run
const binder = new Stitch.DataBinder();
binder.bind('#app', Stitch.Observable.create({ title: 'Draft' }));
binder.unbind('#app');
binder.bind('#app', Stitch.Observable.create({ title: 'Final' }));
```
<!-- check: text('#app') === 'Final' -->

Before (a "just in case" second unbind):

```html page
<p id="app" data-text="title"></p>
```

```js throws
const binder = new Stitch.DataBinder();
binder.bind('#app', Stitch.Observable.create({ title: 'Draft' }));
binder.unbind('#app');
binder.unbind('#app');
```
Throws: `nothing is bound by this DataBinder in that element`

After: unbind once (or call `binder.dispose()` once for everything the binder bound).

```html page
<p id="app" data-text="title"></p>
```

```js run
const binder = new Stitch.DataBinder();
binder.bind('#app', Stitch.Observable.create({ title: 'Draft' }));
binder.dispose();
binder.dispose(); // dispose() may be called again; it does nothing the second time
```

### Other names that now throw

- Data fields named `toJSON` or like a helper (`$on`, `$set`, `$watch`, ...) throw at creation.
- `$watch` on a property that does not exist (or is not reactive) throws; it never fired in v2.
- `MessageBus.unsubscribe` and `$off` of a callback that is not subscribed throw.
- `Observable.create()` / `Observable.reactive()` of an object inside a model throws.
- `$get('{...}')` (an object literal instead of a path) throws.

Before / after, one per line above:

```js throws
Stitch.Observable.create({ rows: [{ id: 1, toJSON: 'x' }] });
```
Throws: `"rows[0].toJSON" is reserved`

```js run
const fromServer = [{ id: 1, toJSON: 'x' }];
const model = Stitch.Observable.create({ rows: fromServer.map(r => ({ id: r.id, jsonValue: r.toJSON })) });
```

```js throws
const model = Stitch.Observable.create({ count: 0 });
model.$watch('cuont', function () {});
```
Throws: `"cuont" is not a property of the model`

```js run
const model = Stitch.Observable.create({ count: 0 });
const stop = model.$watch('count', function () {});
stop();
```

```js throws
const bus = new Stitch.MessageBus();
bus.subscribe('saved', function () {});
bus.unsubscribe('saved', function () {}); // a different function
```
Throws: `that callback is not subscribed to "saved"`

```js run
const bus = new Stitch.MessageBus();
const unsubscribe = bus.subscribe('saved', function () {});
unsubscribe();
```

```js throws
const model = Stitch.Observable.create({ user: { name: 'Ada' } });
Stitch.Observable.create(model.user);
```
Throws: `already belongs to a model`

```js run
const model = Stitch.Observable.create({ user: { name: 'Ada' } });
const copy = Stitch.Observable.create(Stitch.Observable.toRaw(model.user));
```

```js throws
const model = Stitch.Observable.create({ user: { name: 'Ada' } });
model.$get('{ user }');
```
Throws: `is not a property path`

```js run
const model = Stitch.Observable.create({ user: { name: 'Ada' } });
const name = model.$get('user.name');
```
<!-- check: name === 'Ada' -->

### Error messages start with a code

v2 messages started with the library version (`[Stitch.js v2.x.y] ...`). v3 messages start with a
stable code: `[Stitch E201] <span data-text="nmae">: "nmae" is not a property of the model. ...`.
The code keeps its meaning across releases, so code that inspects Stitch errors should match the
code, not the wording. The [error reference](docs/ERRORS.md) is keyed by code.

Before (v2: matching the wording):

```js fragment
if (/is not a property/.test(error.message)) { /* ... */ }
```

After:

```html page
<span id="app" data-text="nmae"></span>
```

```js run
const model = Stitch.Observable.create({ name: 'Ada' });
let code = null;
try {
    new Stitch.DataBinder().bind('#app', model);
} catch (error) {
    code = error.message.slice(1, 12); // "Stitch E201"
}
```
<!-- check: code === 'Stitch E201' -->

### Watches and change handlers return removers

In v2, `$watch` returned an internal object and a watch could not be stopped; `on(fn)` returned
nothing. In v3, `$watch(path, fn)` and `$onChange(fn)` both return a function that removes what they
installed (like `$on`). Call it when the listener should end; a stopped watch is released.

```js run
const model = Stitch.Observable.create({ count: 0 });
const calls = [];
const stopWatch = model.$watch('count', function (now) { calls.push('watch ' + now); });
const stopChanges = model.$onChange(function (change) { calls.push('change ' + change.field); });
model.count = 1;
stopWatch();
stopChanges();
model.count = 2;
```
<!-- check: calls.join('|') === 'watch 1|change count' -->

### Smaller changes

- `Observable.isReactive(value)` returns `true` or `false` (v2 returned the falsy value itself for
  `null`, `0` or `''`).
- Frozen or sealed data is refused with a Stitch error (E714) naming where it sits; v2 failed with
  the browser's own `TypeError`. Pass a copy.
- A computed's function also receives the object that holds it as its first argument, so
  `Stitch.computed(m => m.price * m.qty)` works. A v2 getter with an optional first parameter
  (`function (format = 'short') { ... }`) now receives that object instead, so its default no longer
  applies: move the option into the model. A v2 arrow computed that used `this` silently read
  the wrong object; it still does, so rewrite it to use the argument.

### New in v3

`data-key`, `$root.` handler and path prefixes, `Stitch.onError`, `Stitch.onBindReport`,
`Stitch.debug.stats()`, `$onChange` / `$offChange`, removers from `$watch` and `$onChange`,
`value: 'literal'` custom bindings, error codes. See the [API reference](docs/API.md).

<!-- history: the guide below describes the v1 to v2 upgrade and is not maintained -->

---

# History: Stitch.js v1.0 to v2.0

> This section is kept for reference. It describes v2 and is not maintained; its code is v2 code.

This guide helps you migrate from Stitch.js v1.0 to v2.0.

---

## Overview

**V2.0** fixes the core timing bug where computed properties returned stale values when accessed synchronously after dependency changes. The fix requires architectural changes that introduce some breaking changes to advanced APIs.

**Good News**: Most code works unchanged! Observable.create(), data bindings, and computed properties work as before.

---

## Breaking Changes

### 1. Custom Effects: `scheduler` → `batch` Option

**v1.0:**
```javascript
reactiveSystem.effect(() => {
    element.textContent = model.value;
}, {
    scheduler: () => {
        // Custom scheduling logic
    }
});
```

**v2.0:**
```javascript
// For DOM updates (batched for performance)
reactiveSystem.effect(() => {
    element.textContent = model.value;
}, { batch: true });

// For immediate execution (e.g., logging, non-DOM)
reactiveSystem.effect(() => {
    console.log('Value changed:', model.value);
}, { batch: false });  // Or omit for immediate
```

**Migration:**
- If your effect modifies the DOM → use `{ batch: true }`
- If your effect needs immediate execution → use `{ batch: false }` or omit the option
- Remove custom scheduler logic (batching is now automatic)

---

### 2. $watch API: Now Immediate by Default

**v1.0:**
```javascript
model.$watch('count', (newVal, oldVal) => {
    console.log(`Count: ${oldVal} → ${newVal}`);
});
// Callback always ran async (microtask queue)
```

**v2.0:**
```javascript
// Immediate execution (default)
model.$watch('count', (newVal, oldVal) => {
    console.log(`Count: ${oldVal} → ${newVal}`);
});

// Batched execution (opt-in)
model.$watch('count', (newVal, oldVal) => {
    console.log(`Count: ${oldVal} → ${newVal}`);
}, { batch: true });
```

**Why Changed:**
- v1.0: `$watch` used MessageBus (async)
- v2.0: `$watch` uses ReactiveSystem.effect() (immediate by default)

**Migration:**
- Most code works unchanged
- If you need batching behavior → add `{ batch: true }` as third parameter

---

### 3. Computed Properties: Synchronous Invalidation

**v1.0:**
```javascript
const model = Stitch.Observable.create({
    x: 1,
    doubled: Stitch.computed(function() {
        return this.x * 2;
    })
});

model.x = 5;
console.log(model.doubled); // ❌ 2 (stale - async invalidation)
```

**v2.0:**
```javascript
const model = Stitch.Observable.create({
    x: 1,
    doubled: Stitch.computed(function() {
        return this.x * 2;
    })
});

model.x = 5;
console.log(model.doubled); // ✅ 10 (fresh - sync invalidation)
```

**No Code Changes Required** - This is a fix, not a breaking change!

---

### 4. MessageBus Role Change

**v1.0:**
- MessageBus handled ALL reactivity (property changes, user events)
- `property-changed` event was core mechanism

**v2.0:**
- ReactiveSystem handles property change reactivity
- MessageBus handles user events only (`$emit`, `$on`)

**Migration:**
- If you subscribed to `property-changed` event → use `$watch` instead
- If you used `$emit`/`$on` for custom events → no changes needed

**Example:**

```javascript
// v1.0 (will still work but not recommended)
model.$on('property-changed', payload => {
    if (payload.key === 'count') {
        console.log('Count changed:', payload.newValue);
    }
});

// v2.0 (recommended)
model.$watch('count', (newVal, oldVal) => {
    console.log('Count changed:', newVal);
});
```

---

### 5. Middleware API: Continuation-Style → Transformation-Style

**v1.0:**
```javascript
model.$use((name, data, next) => {
    console.log('Event:', name);
    next(); // Continue middleware chain
});
```

**v2.0:**
```javascript
model.$use((eventData) => {
    console.log('Event:', eventData.event);
    return eventData; // Return to continue chain
});
```

**Why Changed:**
- v1.0: Continuation-style with separate parameters `(name, data, next)`
- v2.0: Transformation-style with single `eventData` object parameter
- Simpler API, easier to transform event data

**Migration:**
- Replace `(name, data, next)` with `(eventData)`
- Access event name via `eventData.event` instead of `name` parameter
- Access event data via `eventData.data` instead of `data` parameter
- Return `eventData` instead of calling `next()`
- To modify event data, mutate and return `eventData`

**Example:**

```javascript
// v1.0
model.$use((name, data, next) => {
    if (name === 'user-login') {
        data.timestamp = Date.now(); // Mutate data
    }
    next(); // Continue
});

// v2.0
model.$use((eventData) => {
    if (eventData.event === 'user-login') {
        eventData.data.timestamp = Date.now(); // Mutate data
    }
    return eventData; // Return to continue
});
```

---

## Non-Breaking Changes

These APIs work exactly the same in v1.0 and v2.0:

### ✅ Observable.create()
```javascript
const model = Stitch.Observable.create({
    name: 'Alice',
    age: 30
});
// Works identically in v1.0 and v2.0
```

### ✅ Computed Properties
```javascript
const model = Stitch.Observable.create({
    firstName: 'John',
    lastName: 'Doe',
    fullName: Stitch.computed(function() {
        return this.firstName + ' ' + this.lastName;
    })
});
// Syntax unchanged - just works correctly now!
```

### ✅ Data Bindings
```html
<div data-text="message"></div>
<input data-value="name">
<button data-click="handleClick">Click</button>
<!-- All bindings work unchanged -->
```

### ✅ Custom Events ($emit, $on)
```javascript
model.$emit('custom-event', { data: 'value' });
model.$on('custom-event', payload => {
    console.log(payload);
});
// Works identically in v1.0 and v2.0
```

---

## Compatibility Matrix

| Feature | v1.0 | v2.0 | Breaking? |
|---------|------|------|-----------|
| Observable.create() | ✅ | ✅ | ❌ No |
| Stitch.computed() | ✅ | ✅ | ❌ No |
| Data bindings (data-text, data-value, etc.) | ✅ | ✅ | ❌ No |
| $emit / $on | ✅ | ✅ | ❌ No |
| $watch() | ✅ Async | ✅ Immediate | ⚠️ Timing change |
| $use() middleware | ✅ (name, data, next) | ✅ (eventData) | ✅ Yes → API change |
| effect({ scheduler }) | ✅ | ❌ Removed | ✅ Yes → use { batch } |
| effect({ batch }) | ❌ | ✅ | ✅ Yes → new API |
| property-changed event | ✅ Core | ⚠️ Deprecated | ⚠️ Use $watch instead |

---

## Migration Checklist

### Step 1: Update Custom Bindings (if any)

If you registered custom bindings with `DataBinder.registerBinding()`:

```javascript
// v1.0
Stitch.DataBinder.registerBinding('tooltip', {
    bind(element, viewModel, path, context) {
        context.reactiveSystem.effect(() => {
            const value = getProperty(viewModel, path);
            element.title = value;
        });
    }
});

// v2.0 (add { batch: true } for DOM updates)
Stitch.DataBinder.registerBinding('tooltip', {
    bind(element, viewModel, path, context) {
        context.reactiveSystem.effect(() => {
            const value = getProperty(viewModel, path);
            element.title = value;
        }, { batch: true });  // ← Add this
    }
});
```

### Step 2: Update Direct effect() Calls (if any)

Search your codebase for `reactiveSystem.effect(` or `.effect(`:

```javascript
// v1.0
effect(() => {
    console.log(model.value);
});

// v2.0 (no change needed for immediate execution)
effect(() => {
    console.log(model.value);
});

// v2.0 (add { batch: true } for DOM updates)
effect(() => {
    element.textContent = model.value;
}, { batch: true });
```

### Step 3: Review $watch Usage (if any)

If timing is critical:

```javascript
// v1.0 (async)
model.$watch('count', callback);

// v2.0 (immediate by default)
model.$watch('count', callback);

// v2.0 (batched if needed)
model.$watch('count', callback, { batch: true });
```

### Step 4: Update Middleware ($use) (if any)

If you use middleware for event transformation:

```javascript
// v1.0
model.$use((name, data, next) => {
    console.log('Event:', name);
    data.modified = true;
    next();
});

// v2.0
model.$use((eventData) => {
    console.log('Event:', eventData.event);
    eventData.data.modified = true;
    return eventData;
});
```

### Step 5: Replace property-changed Subscriptions (if any)

```javascript
// v1.0
model.$on('property-changed', payload => {
    if (payload.key === 'count') {
        console.log('Count changed');
    }
});

// v2.0
model.$watch('count', (newVal, oldVal) => {
    console.log('Count changed');
});
```

### Step 6: Test Thoroughly

- Run your test suite
- Manually test computed properties
- Verify custom bindings work
- Check timing-sensitive code

---

## Known Issues

### Array-Dependent Computed Properties

**Status**: ✅ FIXED in v2.0.1 (known limitation in v2.0.0)

**Issue in v2.0.0**: Computed properties that depend on array contents do not automatically recalculate when items are added/removed via array mutation methods (`push`, `splice`, etc.).

**Example:**
```javascript
const cart = Stitch.Observable.create({
    items: [],
    subtotal: Stitch.computed(function() {
        return this.items.reduce((sum, item) => sum + item.total, 0);
    })
});

cart.items.push({ total: 100 });
console.log(cart.subtotal); // Still 0 ❌ (should be 100) - v2.0.0 only
```

**Fix in v2.0.1**: Array mutations now trigger synchronously. Upgrade to v2.0.1 to resolve this issue.

**Workarounds for v2.0.0 (not needed in v2.0.1):**

**Option 1: Manual Trigger**
```javascript
cart.items.push({ total: 100 });
cart.items = [...cart.items]; // Force trigger ✅
```

**Option 2: Explicit Dependencies**
```javascript
subtotal: Stitch.computed(function() {
    const _ = this.items.length; // Track length explicitly
    return this.items.reduce((sum, item) => sum + item.total, 0);
}, ['items'])
```

See [KNOWN-ISSUES.md](KNOWN-ISSUES.md) for implementation details of the v2.0.1 fix.

---

## Performance

**Good News**: v2.0 maintains the same performance characteristics as v1.0!

- DOM updates still batched efficiently (70-80% reduction)
- Computed properties still cached until invalidated
- No performance regressions

**What Changed:**
- v1.0: Batching via MessageBus (all effects async)
- v2.0: Batching via BatchScheduler (computed sync, DOM async)

---

## Need Help?

- 📖 See [stitch_documentation.md](docs/history/stitch_documentation.md) for complete API reference
- 🏗️ See [ARCHITECTURE.md](ARCHITECTURE.md) for technical implementation details
- 🐛 Report issues at: [GitHub Issues](https://github.com/mkonstan/Stitch.js/issues)
- 💡 Check [KNOWN-ISSUES.md](KNOWN-ISSUES.md) for documented limitations

---

*Last Updated: 2025-01-04 (V2.0.1)*
