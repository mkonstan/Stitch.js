# Stitch.js Guide

This guide shows how to build a page with Stitch.js v3, from the first binding to lists, forms,
errors and custom bindings. Every `run` and `throws` code block on this page is executed by the
test suite, so the examples work as written.

Related documents: [README](../README.md) (quick start), [API reference](API.md) (every name,
signature and rule), [error reference](ERRORS.md) (every message, its cause and fix),
[AGENTS.md](../AGENTS.md) (the short rule list), [MIGRATION.md](../MIGRATION.md) (v2 to v3).

## Contents

1. [What Stitch is](#what-stitch-is)
2. [The model](#the-model)
3. [Binding a page](#binding-a-page)
4. [Bindings](#bindings)
5. [Lists](#lists)
6. [Handlers](#handlers)
7. [Forms and validation](#forms-and-validation)
8. [Computed properties](#computed-properties)
9. [Change handlers, watches and events](#change-handlers-watches-and-events)
10. [Errors](#errors)
11. [The bind report](#the-bind-report)
12. [Custom bindings](#custom-bindings)
13. [Lifecycle and diagnostics](#lifecycle-and-diagnostics)
14. [Do this, not that](#do-this-not-that)

## What Stitch is

Stitch connects HTML to a JavaScript object. You write plain HTML with `data-*` attributes that name
properties of a model, create the model with `Stitch.Observable.create()`, and bind the two with a
`Stitch.DataBinder`. When a property changes, every element bound to it updates; when the user types
into a bound input, the property changes.

Stitch is one script file with no dependencies and no build step:

```html fragment
<script src="stitch.js"></script>
```

It defines one global, `Stitch`. Stitch is strict: a binding to a property that does not exist, a
list row without a key, an expression in an attribute, or a handler that cannot be found throws an
error that names the element, the binding and the fix. Nothing fails silently.

## The model

A model is the object your page binds to. Create it with `Stitch.Observable.create(data)`:

```html page
<p id="app">Hello, <span data-text="name"></span>! You have <span data-text="count"></span> messages.</p>
```

```js run
const model = Stitch.Observable.create({ name: 'Ada', count: 3 });
new Stitch.DataBinder().bind('#app', model);
model.count = 4; // the page shows 4 after the pending update runs
```
<!-- check: text('#app') === 'Hello, Ada! You have 4 messages.' -->

### Declare every property you bind

Every property a binding reads must exist when the model is created. Give it a starting value;
`null` is fine. A property added later by plain assignment is not reactive, and a binding to a
property the model does not have throws:

```html page
<span id="app" data-text="nickname"></span>
```

```js throws
const model = Stitch.Observable.create({ name: 'Ada' });
new Stitch.DataBinder().bind('#app', model);
```
Throws: `"nickname" is not a property of the model. The model has: name.`

The fix is to declare it, with `null` until you have a value:

```js run
const model = Stitch.Observable.create({ name: 'Ada', nickname: null });
```

The same applies to data you did not write yourself. If rows from a server sometimes lack a field
that your template binds (for example `children` on the leaves of a tree, or `email`), add the
field before you create the model:

```js run
const fromServer = [{ id: 1, name: 'Ann', email: 'ann@example.com' }, { id: 2, name: 'Bob' }];
const people = fromServer.map(p => ({ id: p.id, name: p.name, email: p.email || null }));
const model = Stitch.Observable.create({ people });
```

To add a property after creation, use `model.$set(name, value)`. It defines a new reactive
property (plain assignment does not):

```html page
<p id="app" data-text="title"></p>
```

```js run
const model = Stitch.Observable.create({ name: 'Ada' });
model.$set('title', 'Countess');
new Stitch.DataBinder().bind('#app', model); // a binding to it works
model.title = 'Lady';                          // and follows later writes
```
<!-- check: text('#app') === 'Lady' -->

Names starting with `_` are never reactive; keep them out of bindings.

### What the model can hold

- Plain values, nested objects, arrays, `Map` and `Set`. All of them are reactive at any depth.
- Methods, written as `name() { ... }` or `name: function () { ... }`. Arrow functions are
  rejected as methods, because they cannot see the model through `this`.
- Computed properties, made with `Stitch.computed(...)` (see [Computed properties](#computed-properties)).
  A computed's function gets the object as its argument as well as `this`, so it may be an arrow
  function that uses the argument: `total: Stitch.computed(m => m.price * m.qty)`. An arrow
  function's `this` is never the model.

```js throws
Stitch.Observable.create({ count: 0, increment: () => this.count++ });
```
Throws: `Arrow function detected in property 'increment'`

`Observable.create(data)` converts `data` in place: the object you pass becomes the model. Do not
keep using it as plain data elsewhere. If you need an untouched copy, pass a copy, or take one
later with `Stitch.Observable.toRaw(model)`, which returns a deep plain copy (computeds become
their current values; `_` fields are left out):

```js run
const model = Stitch.Observable.create({ user: { name: 'Ada' }, tags: ['x'] });
const plain = Stitch.Observable.toRaw(model);
plain.user.name = 'Grace'; // a copy: the model is unchanged
```
<!-- check: model.user.name === 'Ada' && Stitch.Observable.isReactive(plain) === false -->

Do not pass frozen or sealed objects (`Object.freeze`, `Object.seal`): Stitch converts the data in
place, so it refuses them with an error naming where the object sits. Copy frozen data first (for
example with `structuredClone(data)`):

```js throws
const fromCache = Object.freeze({ name: 'Ada' });
Stitch.Observable.create(fromCache);
```
Throws: `The data is frozen`

```js run
const fromCache = Object.freeze({ name: 'Ada' });
const model = Stitch.Observable.create(structuredClone(fromCache));
```

A few names are reserved on every model object, because Stitch defines them there: `toJSON` and the
`$` helpers (`$on`, `$off`, `$onChange`, `$offChange`, `$get`, `$set`, `$emit`, `$once`, `$use`,
`$watch`). A data field with one of these names throws. Fields named `on`, `off`, `get` or `set`
are ordinary data.

### Set properties to null; never delete them

Deleting a model property would remove its reactive accessor, and the page would stop following it.
So a model property cannot be deleted: in strict-mode code `delete` throws, and in sloppy-mode code it
does nothing and returns `false`. Set the property to `null` instead. On a list, use
`splice`; on a `Map` or `Set`, use `delete(key)`:

```js throws
const model = Stitch.Observable.create({ rows: [{ id: 1 }, { id: 2 }] });
delete model.rows[0];
```
Throws: `use rows.splice(0, 1)`

### One model per root

A model is one tree with one root: the object `Observable.create()` returned. Events, change
handlers and bindings belong to that root. You cannot put one model inside another; assign plain
data instead:

```js throws
const app = Stitch.Observable.create({ cart: null });
const cart = Stitch.Observable.create({ items: [] });
app.cart = cart;
```
Throws: `A model cannot be nested in another model`

```js run
const app = Stitch.Observable.create({ cart: null });
app.cart = { items: [] }; // plain data becomes part of app
```

Moving an object within one model is fine (for example, a row from one list to another, or a row
also held as `selected`).

Two models cannot share one array, `Map` or `Set` either. A lookup list used by several models
needs a copy per model:

```js run
const countries = [{ code: 'FR', name: 'France' }, { code: 'JP', name: 'Japan' }];
const billing = Stitch.Observable.create({ countries: [...countries] });
const shipping = Stitch.Observable.create({ countries: [...countries] });
```

The same holds for a `Map` (`new Map(rates)`) and a `Set` (`new Set(codes)`). Passing the same
array to both models throws, naming the copy to make.

## Binding a page

`new Stitch.DataBinder().bind(root, model)` binds the element `root` (an element or a CSS selector)
and everything inside it. Bind each part of the page once; binding an already-bound element again
throws (call `unbind()` first).

`bind()` checks every binding before it binds anything: the attribute syntax, that each property
exists, that each handler can be found. If anything is wrong it throws, and leaves nothing of that
`bind()` behind. Fix the page and bind again.

### A binding names one property

The value of a binding attribute is a property path: names joined by dots, such as `name`,
`user.email`, `items.0.title`, `$parent.total` or `$root.rate`. It is never an expression, a call
or an object literal. Put the logic in a computed property and bind its name:

```html page
<p id="app" data-visible="!done">Still working...</p>
```

```js throws
const model = Stitch.Observable.create({ done: false });
new Stitch.DataBinder().bind('#app', model);
```
Throws: `an expression is not supported; a binding names a property`

```html page
<p id="app" data-visible="working">Still working...</p>
```

```js run
const model = Stitch.Observable.create({
    done: false,
    working: Stitch.computed(function () { return !this.done; })
});
new Stitch.DataBinder().bind('#app', model);
```
<!-- check: visible('#app') -->

An attribute holds exactly one binding. To bind two things on one element, use two attributes
(`data-value="city" data-visible="hasCity"`).

A path that passes through `null` or `undefined` is a value, not an error: `data-text="selected.name"`
shows nothing while `selected` is `null`, and shows the name once `selected` is an object.

### Updates are batched

Writing a property updates the model at once; the page follows in a microtask, after your code
finishes. So in a script that reads the page right after a change, wait for the pending update
first:

```html page
<span id="out" data-text="count"></span>
```

```js run
(async function () {
    const model = Stitch.Observable.create({ count: 1 });
    new Stitch.DataBinder().bind('#out', model);
    model.count = 2;
    const before = document.getElementById('out').textContent; // still "1"
    await Promise.resolve();
    const after = document.getElementById('out').textContent;  // "2"
    window.result = before + ' -> ' + after;
})();
```
<!-- check: window.result === '1 -> 2' -->

`bind()` itself renders synchronously: when it returns, the page shows the model.

## Bindings

| Attribute | Value | What it does |
|---|---|---|
| `data-text` | a path | Sets the element's text. `null`/`undefined` show as empty. |
| `data-value` | a path | Two-way: form control value and the property follow each other. |
| `data-visible` | a path | Shows the element when the value is truthy, hides it (`display: none`) otherwise. |
| `data-enabled` | a path | Enables the element when truthy, disables it otherwise. |
| `data-class` | a path | A class string (replaces all classes) or `{ className: boolean }` (toggles only those). |
| `data-attr` | a path | `{ attributeName: value }`; `null`/`false` removes the attribute, `true` sets it empty. |
| `data-loading` | a path | While truthy: disabled, class `loading`, `aria-busy="true"`. |
| `data-click` | a handler | Calls a method on click. See [Handlers](#handlers). |
| `data-event` | a path | An object mapping event names to handlers, e.g. `{ input: 'validate' }`. |
| `data-foreach` | a path | Renders one row per item of an array. See [Lists](#lists). |

Every attribute is described in full in the [API reference](API.md#bindings).

```html page
<div id="app">
    <input id="name" data-value="name">
    <p data-text="greeting"></p>
    <button id="save" data-enabled="canSave" data-class="saveClasses">Save</button>
    <a id="link" data-attr="linkAttrs">Profile</a>
</div>
```

```js run
const model = Stitch.Observable.create({
    name: 'Ada',
    greeting: Stitch.computed(function () { return 'Hello, ' + this.name; }),
    canSave: Stitch.computed(function () { return this.name.length > 0; }),
    saveClasses: Stitch.computed(function () { return { primary: this.name.length > 0 }; }),
    linkAttrs: Stitch.computed(function () { return { href: '/people/' + encodeURIComponent(this.name), title: this.name }; })
});
new Stitch.DataBinder().bind('#app', model);
```
<!-- check: text('#app p') === 'Hello, Ada' && attr('#link', 'href') === '/people/Ada' -->
<!-- check: type('#name', '') -->
<!-- check: document.getElementById('save').disabled === true && text('#app p') === 'Hello,' -->

### Text only; no HTML binding

`data-text` sets text, never markup, so data cannot inject HTML into the page. There is no binding
that inserts an HTML string. If you need structure, build it with a list (`data-foreach`) or write
a [custom binding](#custom-bindings) that creates elements with the DOM API.

### Attributes from data

`data-attr` writes the attributes your data names, so it refuses every value that could make the
page run script, and writes nothing from that object (the element keeps its last good state): an
attribute name starting with `on` (E321), `srcdoc` (E322), a `javascript:` or `vbscript:` URL in a
URL attribute such as `href` or `src` (E323), a `data:` URL there, except `data:image/...` in an
`<img>` `src` (E324), and `style` as a string (E325). Ordinary links (relative, `#anchor`,
`https:`, `mailto:`, `tel:`) and ordinary attributes (`title`, `aria-*`, `data-*`) work. Give `style`
an object; each property is set through the CSSOM, so it works under a strict
Content-Security-Policy. Built-in bindings are refused on `<script>`, `<style>`, `<base>` and
`<meta>` (E326). The full rules are in the [API reference](API.md#data-attrpath).

```html page
<div id="app">
    <a id="profile" data-attr="link">Profile</a>
    <p id="note" data-attr="note">Note</p>
</div>
```

```js run
const model = Stitch.Observable.create({
    link: { href: '/people/42', title: 'Open the profile' },
    note: { style: { color: 'darkred', fontWeight: 'bold' }, 'aria-live': 'polite' }
});
new Stitch.DataBinder().bind('#app', model);
```
<!-- check: attr('#profile', 'href') === '/people/42' && document.getElementById('note').style.fontWeight === 'bold' -->

A link that came from somewhere else with a `javascript:` URL, in any of its disguises, is refused:

```html page
<a id="app" data-attr="link">Open</a>
```

```js throws
const model = Stitch.Observable.create({ link: { href: 'java\tscript:alert(1)' } });
new Stitch.DataBinder().bind('#app', model);
```
Throws: `[Stitch E323]`

### Form controls

`data-value` works on `input`, `textarea` and `select`. The model gets a value of the right type:

| Control | Model value |
|---|---|
| text, email, password, textarea | string |
| `type="number"` | number (`null` when the input is empty or not a number) |
| `type="range"` | number (a range always has a value; never `null`) |
| `type="checkbox"` | boolean (`checked`) |
| `type="radio"` (one input per option, same `name`, each with `data-value`) | the checked input's `value` |
| `type="date"` / `type="datetime-local"` | a `Date` (or `null`) |
| `select` | the selected option's value, always a string unless `data-type` says otherwise |
| `select multiple` | an array of the selected values |

`data-type` on the control sets the conversion explicitly: `int`, `float`, `bool` (or `boolean`),
`string`, `date`, `datetime`. A `select` writes back strings even when the model held a number, so
use `data-type="int"` for a `select` whose values are numbers:

```html page
<div id="app">
    <select id="qty" data-value="quantity" data-type="int">
        <option value="1">1</option><option value="2">2</option><option value="3">3</option>
    </select>
    <input id="agree" type="checkbox" data-value="agreed">
</div>
```

```js run
const model = Stitch.Observable.create({ quantity: 1, agreed: false });
new Stitch.DataBinder().bind('#app', model);
```
<!-- check: type('#qty', '3') && model.quantity === 3 -->
<!-- check: click('#agree') && model.agreed === true -->

A two-way binding can only write to a writable property: binding `data-value` to a computed, to a
getter without a setter, or to a row-context value (`$data`, `$index`, `$parent`, `$root`) throws.

## Lists

`data-foreach="items"` renders one copy of the element's content (the row template) per item:

```html page
<ul id="app" data-foreach="people">
    <li data-text="name"></li>
</ul>
```

```js run
const model = Stitch.Observable.create({
    people: [{ id: 1, name: 'Ann' }, { id: 2, name: 'Bob' }]
});
new Stitch.DataBinder().bind('#app', model);
model.people.push({ id: 3, name: 'Cy' });
```
<!-- check: texts('#app li').join(',') === 'Ann,Bob,Cy' -->

Change the list with the array methods (`push`, `splice`, `sort`, ...), by index
(`model.people[0] = {...}`), or by assigning a new array. Inside a row, bindings resolve against the
row's item: `name` is the item's `name`.

### Every row needs a key

Stitch tracks rows by key, so that filtering, sorting and reloading keep each row on the right item.

- A row that is an object is keyed by its `id` field.
- If the identifying field has another name, say so with `data-key` on the list element:
  `data-key="sku"`.
- A row that is a plain value (string, number, boolean) is its own key.

A row without its key, or two rows with the same key, throw (before the list changes):

```html page
<ul id="app" data-foreach="products"><li data-text="name"></li></ul>
```

```js throws
const model = Stitch.Observable.create({ products: [{ sku: 'A1', name: 'Pen' }] });
new Stitch.DataBinder().bind('#app', model);
```
Throws: `row 0 has no "id" (the default key field). Every row of a list needs a unique key. This row has "sku": if that identifies a row, add data-key="sku"`

```html page
<ul id="app" data-foreach="products" data-key="sku"><li data-text="name"></li></ul>
```

```js run
const model = Stitch.Observable.create({ products: [{ sku: 'A1', name: 'Pen' }, { sku: 'B2', name: 'Ink' }] });
new Stitch.DataBinder().bind('#app', model);
```
<!-- check: texts('#app li').join(',') === 'Pen,Ink' -->

Keys compare as JavaScript values: `1` and `"1"` are different keys. A list of rows that have no
natural key needs one added before you create the model (for example from an index or a counter).

A row is reused only when it keeps the same key AND is the same object. Rows that stay keep their
DOM state (focus, typed text, scroll). If you replace an item with a new object under the same key
(for example after reloading data from a server), its row is rebuilt for the new object, so the page
shows the new values.

### One root element per row

The row template must be exactly one element. Whitespace and comments around it do not count. Two
or more elements throw; wrap them in one:

```html page
<div id="app" data-foreach="groups">
    <h4 data-text="title"></h4>
    <p data-text="note"></p>
</div>
```

```js throws
const model = Stitch.Observable.create({ groups: [{ id: 1, title: 'A', note: 'n' }] });
new Stitch.DataBinder().bind('#app', model);
```
Throws: `has 2 root elements (<h4>, <p>), but a row must be exactly one element. Wrap them in one element`

```html page
<div id="app" data-foreach="groups">
    <section>
        <h4 data-text="title"></h4>
        <p data-text="note"></p>
    </section>
</div>
```

```js run
const model = Stitch.Observable.create({ groups: [{ id: 1, title: 'A', note: 'n' }] });
new Stitch.DataBinder().bind('#app', model);
```
<!-- check: count('#app section') === 1 -->

### Row context: $data, $index, $parent, $root

Inside a row, besides the item's own fields, a binding can name:

| Name | Is |
|---|---|
| `$data` | the item itself (use it for lists of plain values: `data-text="$data"`) |
| `$index` | the row's position, kept up to date when rows move |
| `$parent` | one level up: the model for a top-level list, the enclosing row in a nested list |
| `$root` | the model the outermost list is bound to |

```html page
<ol id="app" data-foreach="tags">
    <li><span data-text="$index"></span>: <span data-text="$data"></span> of <span data-text="$root.title"></span></li>
</ol>
```

```js run
const model = Stitch.Observable.create({ title: 'Tags', tags: ['red', 'green'] });
new Stitch.DataBinder().bind('#app', model);
```
<!-- check: texts('#app li').join('|') === '0: red of Tags|1: green of Tags' -->

### Templates, nested lists and trees

The row template can sit inside the list element (inline, as above), or in a `<template>` named by
`data-template`. A list with `data-template` must have nothing else inside it. A `<template>` is the
way to write rows for a `<table>` body and to make a recursive tree, where a row contains a list of
the same rows:

```html page
<ul id="tree" data-foreach="nodes" data-template="node-row"></ul>
<template id="node-row">
    <li>
        <span data-text="name"></span>
        <ul data-foreach="children" data-template="node-row"></ul>
    </li>
</template>
```

```js run
const model = Stitch.Observable.create({
    nodes: [
        { id: 1, name: 'src', children: [
            { id: 2, name: 'app.js', children: [] },
            { id: 3, name: 'lib', children: [{ id: 4, name: 'util.js', children: [] }] }
        ] }
    ]
});
new Stitch.DataBinder().bind('#tree', model);
```
<!-- check: texts('#tree span').join(',') === 'src,app.js,lib,util.js' -->

Every node binds `children`, so every node needs a `children` array, even an empty one (see
[Declare every property you bind](#declare-every-property-you-bind)). Keys need only be unique
within each list.

### A keyed list from a template

`data-key` and `data-template` combine: the template gives the row, the key field identifies it. This
is the usual shape for a table body:

```html page
<table>
    <tbody id="stocks" data-foreach="stocks" data-key="ticker" data-template="stock-row"></tbody>
</table>
<template id="stock-row">
    <tr><td data-text="ticker"></td><td data-text="name"></td></tr>
</template>
```

```js run
const model = Stitch.Observable.create({
    stocks: [{ ticker: 'AAPL', name: 'Apple' }, { ticker: 'MSFT', name: 'Microsoft' }]
});
new Stitch.DataBinder().bind('#stocks', model);
model.stocks.unshift({ ticker: 'ACME', name: 'Acme' });
```
<!-- check: texts('#stocks td:first-child').join(',') === 'ACME,AAPL,MSFT' -->

### Other bindings on the list element

The list element itself may carry other bindings: `data-visible`, `data-class`, `data-attr`,
`data-enabled`, and `data-value` on a `<select>`. The list renders its rows first, then those bindings
apply to the element. Only `data-text` is refused there, because it would replace the rows. In a row
template, `<ul data-visible="expanded" data-foreach="children">` shows a row's children only while
the row is expanded (the tree pattern).

### Showing an element only for some rows

There is no "if" binding. Two honest options, depending on whether the element may stay in the page:

- **`data-visible`**: the element is always rendered and only hidden. Its bindings stay live, so
  every property they name must exist on every row (declare it, `null` is fine).
- **A list of zero or one item**: the element exists only when the list has an item. Bind
  `data-foreach` to a computed that returns `[this]` (the row itself, keyed by its `id`) or `[]`, with
  the element as the template. Inside it, names resolve against that item as usual. Use this when the
  element must not be in the page (for example a button that tests count, or markup that would bind
  to fields only some rows have).

```html page
<ul id="files" data-foreach="files">
    <li>
        <span data-foreach="ifFolder"><button data-click="$root.open">open</button></span>
        <span class="name" data-text="name"></span>
        <em data-visible="isLarge">large</em>
    </li>
</ul>
```

```js run
const model = Stitch.Observable.create({
    files: [
        { id: 1, name: 'src', folder: true, size: 0 },
        { id: 2, name: 'app.js', folder: false, size: 90000 }
    ].map(f => Object.assign(f, {
        ifFolder: Stitch.computed(function () { return this.folder ? [this] : []; }),
        isLarge: Stitch.computed(function () { return this.size > 50000; })
    })),
    opened: '',
    open(file) { this.opened = file.name; }
});
new Stitch.DataBinder().bind('#files', model);
```
<!-- check: count('#files button') === 1 && count('#files em') === 2 -->
<!-- check: texts('#files em').length === 2 && visible('#files li:nth-child(2) em') && !visible('#files li:first-child em') -->
<!-- check: click('#files button') -->
<!-- check: model.opened === 'src' -->

### Filtering and sorting

Bind the list to a computed that returns the rows to show. Copy before sorting: `sort()` on the
model's own array reorders the model.

```html page
<div id="app">
    <input id="q" data-value="query">
    <ul data-foreach="visiblePeople"><li data-text="name"></li></ul>
</div>
```

```js run
const model = Stitch.Observable.create({
    query: '',
    people: [{ id: 1, name: 'Cy' }, { id: 2, name: 'Ann' }, { id: 3, name: 'Bob' }],
    visiblePeople: Stitch.computed(function () {
        const q = this.query.toLowerCase();
        return this.people
            .filter(p => p.name.toLowerCase().includes(q))
            .slice()
            .sort((a, b) => a.name.localeCompare(b.name));
    })
});
new Stitch.DataBinder().bind('#app', model);
```
<!-- check: texts('#app li').join(',') === 'Ann,Bob,Cy' -->
<!-- check: type('#q', 'b') -->
<!-- check: texts('#app li').join(',') === 'Bob' -->

### Lists that are empty, missing or wrong

- An empty array, `null` or `undefined` renders no rows.
- Any other value (an object, a string) throws: `data-foreach` needs an array.
- A path with an index (`items.0.title`) needs that item to exist when you bind.

### Select options from a list

Put `data-foreach` on the `<select>` itself and `<option data-value="..." data-text="...">` in the
template. `data-default-text` adds a first placeholder option (`data-default-value` sets its value,
default `""`). With `data-value` on the select, the selection is two-way. Without it, the user's
choice stays selected while the list changes, as long as its option is still in the list.

```html page
<select id="country" data-foreach="countries" data-key="code" data-value="selected" data-default-text="Choose...">
    <option data-value="code" data-text="name"></option>
</select>
```

```js run
const model = Stitch.Observable.create({
    selected: 'JP',
    countries: [{ code: 'FR', name: 'France' }, { code: 'JP', name: 'Japan' }]
});
new Stitch.DataBinder().bind('#country', model);
```
<!-- check: document.getElementById('country').value === 'JP' && count('#country option') === 3 -->
<!-- check: type('#country', 'FR') && model.selected === 'FR' -->

Options from a list of **plain values** (strings or numbers) need no `data-value` on the option: an
`<option>` without a `value` attribute uses its text as its value. Write only
`<option data-text="$data"></option>`:

```html page
<select id="sector" data-foreach="sectors" data-value="sector" data-default-text="All sectors">
    <option data-text="$data"></option>
</select>
```

```js run
const model = Stitch.Observable.create({ sector: '', sectors: ['Energy', 'Financials', 'Technology'] });
new Stitch.DataBinder().bind('#sector', model);
```
<!-- check: texts('#sector option').join(',') === 'All sectors,Energy,Financials,Technology' -->
<!-- check: type('#sector', 'Financials') && model.sector === 'Financials' -->

`<option data-value="$data">` throws: `data-value` is a two-way binding, and `$data` is the row
itself, which a binding cannot replace in the list. Use `data-text="$data"` as above, or a list of
objects with a key field and `<option data-value="code" data-text="name">`.

```html page
<select id="sector" data-foreach="sectors" data-value="sector">
    <option data-value="$data" data-text="$data"></option>
</select>
```

```js throws
const model = Stitch.Observable.create({ sector: '', sectors: ['Energy', 'Financials'] });
new Stitch.DataBinder().bind('#sector', model);
```
Throws: `a two-way binding cannot write to $data`

## Handlers

`data-click="name"` calls a method when the element is clicked. `data-event` does the same for any
DOM event (see [below](#data-event)).

### Where a handler is looked up

| Written as | Looked up on |
|---|---|
| `remove` | the current row's item; outside a list, the model |
| `$parent.remove` | one level up: the model (top-level list) or the enclosing row (nested list) |
| `$root.remove` | the root model |

Methods usually live on the model, so a button inside a list row names them with `$root.`
(`$parent.` works too in a top-level list). A name that is not found throws at `bind()`, and says
where the name does exist:

```html page
<ul id="app" data-foreach="items"><li><button data-click="remove">x</button></li></ul>
```

```js throws
const model = Stitch.Observable.create({
    items: [{ id: 1 }],
    remove(item) { this.items.splice(this.items.indexOf(item), 1); }
});
new Stitch.DataBinder().bind('#app', model);
```
Throws: `did you mean "$parent.remove"?`

Only these two prefixes exist, once each. For a method more than one level up, put it on the root
model and use `$root.`.

### What a handler receives

A handler is called as `handler(item, event)` with `this` set to the object the method is on:

- `item` is the current row's item (the same object as in the model's list). Outside a list it is
  the model itself, so a root-level handler gets the model first and the event second.
- `event` is the DOM event.

```html page
<div id="app">
    <ul data-foreach="items">
        <li><span data-text="name"></span> <button data-click="$root.remove">remove</button></li>
    </ul>
    <button id="clear" data-click="clear">clear</button>
    <span id="count" data-text="items.length"></span>
</div>
```

```js run
const model = Stitch.Observable.create({
    items: [{ id: 1, name: 'Pen' }, { id: 2, name: 'Ink' }],
    remove(item, event) {
        // this === model, item === the clicked row's object
        this.items.splice(this.items.indexOf(item), 1);
    },
    clear(model, event) {
        // root-level handler: the first argument is the model
        model.items = [];
    }
});
new Stitch.DataBinder().bind('#app', model);
```
<!-- check: click('#app li button') -->
<!-- check: texts('#app li span').join(',') === 'Ink' && text('#count') === '1' -->
<!-- check: click('#clear') -->
<!-- check: text('#count') === '0' -->

### data-event

`data-event="name"` names a model property holding an object that maps DOM event names to handler
names (looked up exactly like `data-click`) or to functions:

```html page
<input id="field" data-event="fieldEvents" data-value="text">
<span id="log" data-text="log"></span>
```

```js run
const model = Stitch.Observable.create({
    text: '',
    log: '',
    fieldEvents: { focus: 'onFocus', blur: 'onBlur' },
    onFocus() { this.log = 'focused'; },
    onBlur() { this.log = 'left'; }
});
new Stitch.DataBinder().bind('#field', model);
new Stitch.DataBinder().bind('#log', model);
```
<!-- check: (document.getElementById('field').dispatchEvent(new FocusEvent('focus')), true) -->
<!-- check: text('#log') === 'focused' -->

## Forms and validation

A form is a model with one property per field, computeds for the error messages and for "can
submit", and a submit handler. Show an error only after the user has touched the field: keep a
`touched` flag per field and set it from an `input` (or `blur`) event.

```html page
<form id="signup">
    <input id="email" data-value="email" data-event="emailEvents">
    <p id="email-error" data-visible="showEmailError" data-text="emailError"></p>
    <button id="submit" type="button" data-enabled="canSubmit" data-click="submit">Sign up</button>
    <p id="done" data-visible="submitted">Thanks!</p>
</form>
```

```js run
const model = Stitch.Observable.create({
    email: '',
    emailTouched: false,
    submitted: false,
    emailEvents: { input: 'touchEmail' },
    touchEmail() { this.emailTouched = true; },
    emailError: Stitch.computed(function () {
        if (this.email.trim() === '') return 'Email is required';
        return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(this.email) ? '' : 'Enter a valid email';
    }),
    showEmailError: Stitch.computed(function () { return this.emailTouched && this.emailError !== ''; }),
    canSubmit: Stitch.computed(function () { return this.emailError === ''; }),
    submit(model) { model.submitted = true; }
});
new Stitch.DataBinder().bind('#signup', model);
```
<!-- check: visible('#email-error') === false && document.getElementById('submit').disabled === true -->
<!-- check: type('#email', 'ada@') -->
<!-- check: visible('#email-error') && text('#email-error') === 'Enter a valid email' -->
<!-- check: type('#email', 'ada@example.com') -->
<!-- check: visible('#email-error') === false && document.getElementById('submit').disabled === false -->
<!-- check: click('#submit') -->
<!-- check: visible('#done') -->

Notes:

- A computed that another computed reads (here `emailError`) is fine; dependencies are tracked
  automatically.
- A typed input that does not convert (letters in a number input) gives `null`; validate for it.
- A two-way binding through a `null` object (`data-value="address.city"` while `address` is `null`)
  throws when the user types. Give the object a value first, or hide the input while it is empty.

### Which events mark a field as touched

`data-value` keeps the model in step on both `input` and `change`. For "touched" or "dirty"
flags, map the event that matches what you want to know, with `data-event` (verified in Chromium):

| Control | `input` fires | `change` fires |
|---|---|---|
| text, email, password, `textarea` | on every keystroke | when the user leaves the field after changing it |
| `type="number"` | on every keystroke and arrow step | when the user leaves after typing, or at once for an arrow step |
| `type="checkbox"`, `type="radio"` | on each click | on each click (together with `input`) |
| `select` | when an option is picked | when an option is picked (together with `input`) |

`input` therefore means "the user changed it", for every control, so `{ input: 'touchEmail' }` is the
simplest touched flag. Use `blur` (fires on leaving, changed or not) for "the user visited it".
Values written from the model fire no events, so a model change never marks a field as touched.

### Buttons inside a form

A `<button>` inside a `<form>` is a submit button by default: clicking it runs your `data-click`
handler and then submits the form, which reloads the page. Either give the button
`type="button"` (as in the example above), or handle the form's `submit` event with `data-event`
and call `event.preventDefault()` (the event is the handler's second argument):

```html page
<form id="search" data-event="formEvents">
    <input id="q" data-value="query">
    <button id="go" type="submit">Search</button>
    <p id="result" data-text="result"></p>
</form>
```

```js run
const model = Stitch.Observable.create({
    query: 'stitch',
    result: '',
    formEvents: { submit: 'search' },
    search(model, event) {
        event.preventDefault(); // stay on the page
        this.result = 'Searched for ' + this.query;
    }
});
new Stitch.DataBinder().bind('#search', model);
```
<!-- check: click('#go') -->
<!-- check: text('#result') === 'Searched for stitch' && location.href === 'about:srcdoc' -->

A `type="submit"` button (or Enter in a field) fires the form's `submit` event, which `data-event` on
the `<form>` receives as above. When Stitch does the validation, add `novalidate` to the form: without
it, the browser's own validation (`required`, `type="email"`, `min`/`max`) blocks the `submit`
event while a field is invalid, so your handler never runs and the browser shows its own messages.

```html page
<form id="join" novalidate data-event="formEvents">
    <input id="mail" type="email" required data-value="email">
    <button id="send" type="submit">Join</button>
    <p id="msg" data-text="message"></p>
</form>
```

```js run
const model = Stitch.Observable.create({
    email: 'ada@',          // invalid for the browser, but novalidate lets the submit through
    message: '',
    formEvents: { submit: 'join' },
    join(model, event) {
        event.preventDefault();
        this.message = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(this.email) ? 'Joined' : 'Enter a valid email address';
    }
});
new Stitch.DataBinder().bind('#join', model);
```
<!-- check: click('#send') -->
<!-- check: text('#msg') === 'Enter a valid email address' -->

## Computed properties

`Stitch.computed(function () { ... })` defines a read-only property whose value is computed from
other properties. The function receives the object that holds the computed (the model, or a nested
object or row) both as `this` and as its first argument, so it can read sibling properties either
way:

```js run
const model = Stitch.Observable.create({
    price: 10,
    qty: 2,
    total: Stitch.computed(function () { return this.price * this.qty; }),
    lines: [{ id: 1, price: 5, qty: 3, subtotal: Stitch.computed(function () { return this.price * this.qty; }) }]
});
model.qty = 3;
```
<!-- check: model.total === 30 && model.lines[0].subtotal === 15 -->

An arrow function has no `this` of its own (it would read `this` from the surrounding script, never
the model), so an arrow computed must use its argument:

```js run
const model = Stitch.Observable.create({
    price: 10,
    qty: 2,
    total: Stitch.computed(m => m.price * m.qty),
    lines: [{ id: 1, price: 5, qty: 3, subtotal: Stitch.computed(line => line.price * line.qty) }]
});
model.qty = 4;
```
<!-- check: model.total === 40 && model.lines[0].subtotal === 15 -->

- Read it as a property (`model.total`), never call it.
- It is lazy: it runs when first read, and again only after something it read has changed and it is
  read again. A computed that nothing reads stops listening to its sources.
- It is read-only: assigning to it throws, and so does a two-way binding to it.
- If it throws while updating the page, the error goes to [`Stitch.onError`](#errors).
- Rows can carry computeds too: put `Stitch.computed(...)` in the row object before you add it.

The object form `Stitch.computed({ get() { ... }, deps: ['a', 'b'] })` also reads the listed
properties up front; dependencies are tracked automatically either way.

## Change handlers, watches and events

### $onChange: every write to an object

`obj.$onChange(fn)` calls `fn(change)` after every write to `obj`. `change` has `field`, `oldValue`,
`newValue` and `target`. Writes to the object's own properties are reported synchronously. Writes
deeper down are reported to each ancestor afterwards (in a microtask), with a dotted `field`
(`'user.name'`) and `nestedChange: true`; a list mutation reports field `'<list>.items'`.
`$onChange` returns a function that removes the handler; `obj.$offChange(fn)` (with the same
function) does the same:

```js run
const model = Stitch.Observable.create({ name: 'Ada', user: { city: 'London' } });
const fields = [];
const stop = model.$onChange(function (change) { fields.push(change.field); });
model.name = 'Grace';
model.user.city = 'Paris';
setTimeout(function () {
    stop();
    model.name = 'Lin'; // not recorded: the handler is removed
    window.result = fields.join(',');
}, 0);
```
<!-- check: window.result === 'name,user.city' -->

### $watch: one property

`model.$watch(path, callback)` calls `callback(newValue, oldValue, info)` when the value at `path`
changes, synchronously (pass `{ batch: true }` as a third argument to run it once per batch instead).
`$watch` exists on the model `Observable.create()` returned, not on nested objects. It returns a
function that stops the watch for good (and releases it); call it when the watch is no longer needed.

```js run
const model = Stitch.Observable.create({ country: 'FR', city: 'Paris' });
const seen = [];
const stop = model.$watch('country', function (now, before, info) {
    seen.push(before + '->' + now + ' (' + info.key + ')');
    model.city = null;
});
model.country = 'JP';
stop();
model.country = 'DE'; // not seen: the watch is stopped
```
<!-- check: seen.join('|') === 'FR->JP (country)' && model.city === null -->

### Events: $emit, $on, $off, $once

Events belong to the root model. `model.$emit(name, payload)` delivers the payload to every
`model.$on(name, callback)` subscriber, in a microtask. `$on` returns a function that unsubscribes;
`model.$off(name, callback)` does the same. `$once` subscribes for one delivery.

```js run
const model = Stitch.Observable.create({ saved: 0 });
const stop = model.$on('saved', function (payload) { model.saved = payload.count; });
model.$emit('saved', { count: 2 });
setTimeout(function () { stop(); }, 0);
```
<!-- check: model.saved === 2 -->

Nested objects, rows, arrays, Maps and Sets have no events: `$emit`, `$on`, `$off` and `$once` on them
throw. From inside a list row, call a root method with `data-click="$root.save"`, and emit from there:

```js throws
const model = Stitch.Observable.create({ user: { name: 'Ada' } });
model.user.$emit('saved');
```
Throws: `events live on the root model`

`$on` takes an event name and a callback, `$onChange` takes one function. Mixing them up throws,
naming the right method.

`Stitch.MessageBus` is the same event channel as a standalone object, for code that has no model:
`const bus = new Stitch.MessageBus(); bus.subscribe('x', fn); bus.publish('x', data);`.

## Errors

Stitch reports every mistake. Every message starts with a stable code, `[Stitch E###]`, followed by
the element and binding involved and the fix: `[Stitch E201] <span data-text="nmae">: "nmae" is not a
property of the model. ...`. Codes never change meaning, so code that handles errors can match
`error.message.startsWith('[Stitch E201]')`; the [error reference](ERRORS.md) is keyed by code.

Where an error goes depends on when it happens:

- **During `bind()`** (and any other call you make): the error is thrown to your code. Nothing of
  the failed `bind()` stays bound.
- **Later, inside an update** (a binding re-rendering, a list reconciling, a computed recomputing, a
  change handler, an event subscriber, a click handler): there is no caller to throw to. The error
  goes to the handler installed with `Stitch.onError(fn)`, called as `fn(error, context)`. With no
  handler, it is re-thrown as an uncaught error, so it shows in the console and reaches
  `window.onerror`. The page keeps its last good state.

`context` says what was running: `context.source` is one of `binding`, `watch`, `change-handler`,
`handler`, `messageBus`, `unbind`, `dispose`, `scheduler`, `effect` (or `unknown` when Stitch has no
more to say), plus the `element` and `binding` text for bindings, or the `event` name for the
message bus.

```html page
<p id="out" data-text="label"></p>
```

```js run
const errors = [];
Stitch.onError(function (error, context) { errors.push(context.source + ': ' + error.message); });
const model = Stitch.Observable.create({
    n: 1,
    label: Stitch.computed(function () {
        if (this.n > 1) throw new Error('too big');
        return 'n=' + this.n;
    })
});
new Stitch.DataBinder().bind('#out', model);
model.n = 2;
setTimeout(function () { window.result = errors.join('|'); }, 0);
```
<!-- check: window.result === 'binding: too big' && text('#out') === 'n=1' -->

There is one page-wide handler. `Stitch.onError(fn)` returns a function that removes it;
`Stitch.onError(null)` removes it too. Installing a second handler while one is installed throws.
A handler that throws has its own error re-thrown uncaught.

There is no debug mode to switch on: Stitch behaves the same in development and production. For
messages, causes and fixes, see the [error reference](ERRORS.md).

## The bind report

Stitch only looks at its own attributes: the bindings listed above, custom bindings you register,
the list attributes `data-key`, `data-template`, `data-default-text` and `data-default-value`, and
`data-type` (read by `data-value`).
Every other `data-*` attribute (`data-testid`, `data-bs-toggle`, `data-id`) is left alone. This also
means a misspelled binding name such as `data-txt` is not an error: it is simply not Stitch's.

To see what `bind()` used and what it ignored, install a report function. After each successful
`bind()` it receives `{ bound, ignored }`, each a list of `{ element, attribute, value }`:

```html page
<div id="app"><span data-txt="name" data-testid="greeting"></span><b data-text="name"></b></div>
```

```js run
let report = null;
const remove = Stitch.onBindReport(function (r) { report = r; });
new Stitch.DataBinder().bind('#app', Stitch.Observable.create({ name: 'Ada' }));
remove();
window.result = report.ignored.map(e => e.attribute).join(',') + ' / ' + report.bound.map(e => e.attribute).join(',');
```
<!-- check: window.result === 'data-txt,data-testid / data-text' -->

In development, `Stitch.onBindReport(console.log)` (or `console.table`) is often enough. Like
`onError`, there is one report function per page; installing a second throws.

## Custom bindings

`Stitch.DataBinder.registerBinding(name, handler)` adds the attribute `data-<name>`. Register every
custom binding before the first `bind()` on the page; registering later throws. The name is
lowercase letters, digits and dashes, and must not be taken.

The handler declares how its attribute value is read:

- `value: 'path'` (the default): the value names a model property, checked like any binding
  (it must exist). `bind(element, model, path, context)` receives the path.
- `value: 'literal'`: the attribute text itself is passed as `bind(element, model, text, context)`;
  nothing is looked up.

To follow a property, create an effect with `context.reactiveSystem.effect(fn)` and register its
cleanup with `context.binder._trackCleanup(element, cleanupFn)`, so `unbind()` and `dispose()`
release it. Despite the underscore, `_trackCleanup` is the supported way for a custom binding to
register cleanup.

A path binding whose attribute holds text instead (`data-tooltip="Save changes"`) throws, and for
a custom binding the message ends with how to register it as literal:
`registerBinding("tooltip", { value: 'literal', ... })`.

```html page
<div id="app">
    <button id="help" data-tooltip="helpText">?</button>
    <button id="save" data-hint="Saves the form">Save</button>
</div>
```

```js run
Stitch.DataBinder.registerBinding('tooltip', {
    bind(element, model, path, context) {
        const effect = context.reactiveSystem.effect(function () {
            element.setAttribute('title', model[path] || '');
        });
        context.binder._trackCleanup(element, function () { context.reactiveSystem.cleanup(effect); });
    }
});
Stitch.DataBinder.registerBinding('hint', {
    value: 'literal',
    bind(element, model, text) { element.setAttribute('title', text); }
});
const model = Stitch.Observable.create({ helpText: 'Opens help' });
new Stitch.DataBinder().bind('#app', model);
model.helpText = 'Opens the help page';
```
<!-- check: attr('#help', 'title') === 'Opens the help page' && attr('#save', 'title') === 'Saves the form' -->

A custom binding can build DOM (for example, render a small chart, or highlight search terms by
creating `<mark>` elements with `document.createElement` and `textContent`). Do not insert HTML
strings that contain data: that is how script injection happens.

## Lifecycle and diagnostics

- `binder.unbind(element)` releases every binding inside `element` (effects stop, listeners are
  removed). The DOM is left as it is. Unbinding an element with nothing bound by that binder throws.
- `binder.dispose()` releases everything that binder bound. After it, the binder cannot bind again;
  create a new one. Call it when a part of the page that Stitch manages goes away.
- Rows that leave a list are released automatically.

`dispose()` and `unbind()` release **bindings only**. Watches (`$watch`), change handlers
(`$onChange`) and event subscriptions (`$on`) belong to the model, not to a binder: they keep running
after the binder is disposed, and only their removers stop them. `$watch` and `$onChange` return a
remover; `$on` returns an unsubscribe function.

```html page
<p id="app" data-text="count"></p>
```

```js run
const model = Stitch.Observable.create({ count: 0 });
const binder = new Stitch.DataBinder();
binder.bind('#app', model);
const heard = [];
const stopWatch = model.$watch('count', function () { heard.push('watch'); });
const stopChange = model.$onChange(function () { heard.push('change'); });
const stopEvent = model.$on('saved', function () { heard.push('event'); });

binder.dispose();
model.count = 1;          // the binding is gone, but the watch and the change handler still run
model.$emit('saved');     // and so does the event subscriber
setTimeout(function () {
    window.afterDispose = heard.join(',');
    stopWatch(); stopChange(); stopEvent();
    model.count = 2;
    model.$emit('saved');
    setTimeout(function () { window.afterRemovers = heard.join(','); }, 0);
}, 0);
```
<!-- check: tick().then(() => tick()).then(() => window.afterDispose === 'watch,change,event' && window.afterRemovers === 'watch,change,event' && text('#app') === '0') -->

There is no separate "dispose the model" call, and none is needed: nothing in Stitch keeps a model
alive. When your code drops a section (its elements, its binder and its model), all of it is
garbage-collected, even if you did not call `dispose()` or the removers. Call them when the model
stays alive but should stop updating that section, or stop listening.

`Stitch.debug.stats()` returns live counts for the page: `effects` (running effects, about one per
live binding, plus watches and custom-binding effects), `subscriptions` (links from properties to the
effects and computeds that read them) and `parentLinks` (links from model objects to the places that
hold them). The counts go down only when something is released: `dispose()`, `unbind()`, rows leaving
a list, and the removers. A section that was dropped and garbage-collected without them keeps its
counts, so a count that grows is a sign to check, not proof of a memory leak: it means something was
not released, and if the page still holds it, that is a leak. `subscriptions` also counts the links of
model computeds, which last as long as the model.

```html page
<ul id="app" data-foreach="items"><li data-text="name"></li></ul>
```

```js run
const before = Stitch.debug.stats().effects;
const model = Stitch.Observable.create({ items: [{ id: 1, name: 'a' }] });
const binder = new Stitch.DataBinder();
binder.bind('#app', model);
binder.dispose();
window.result = Stitch.debug.stats().effects === before;
```
<!-- check: window.result === true -->

## Do this, not that

| Do | Not |
|---|---|
| Declare every bound property in `Observable.create()`, with `null` if unknown | Add properties later by assignment (`model.x = 1` on a missing `x`) |
| Add a later property with `model.$set('x', value)` | `delete model.x`; set it to `null` instead |
| Give every list row an `id`, or name the key field with `data-key` | Rely on row position |
| Write one root element per row template | Put several sibling elements in a row template |
| Put logic in computeds and bind their names | Write expressions, calls or object literals in attributes |
| One binding per attribute | `data-value="a, visible: b"` |
| Name root methods from rows with `$root.name` | Expect a bare name in a row to find a model method |
| Write handlers as `fn(item, event)` | Expect the event as the first argument |
| Write methods as `name() {}` | Use arrow functions as model methods |
| Write computeds as `function () { return this.x; }`, or as `m => m.x` using the argument | Use `this` inside an arrow computed |
| Give buttons inside a `<form>` `type="button"`, or handle `submit` and call `event.preventDefault()` | Leave a plain `<button>` in a form (it submits and reloads the page) |
| Build options from plain values with `<option data-text="$data">` | Put `data-value="$data"` on an option |
| Add `novalidate` to a form Stitch validates | Let the browser's validation block the submit event |
| Show an element for some rows with `data-visible`, or a computed list of `[this]` / `[]` | Look for an "if" binding |
| Match errors by their code, `[Stitch E###]` | Match errors by their wording |
| Emit and listen on the root model | `$emit` / `$on` on nested objects or rows |
| Copy shared lookup lists per model: `[...list]`, `new Map(map)` | Give two models the same array, Map or Set |
| Assign plain data, or `Observable.toRaw(other)` | Put one model inside another |
| Register custom bindings before the first `bind()` | Register them later |
| Install `Stitch.onError` early on pages users depend on | Assume errors in updates are thrown to your code |
| Use `data-text` or DOM-building custom bindings | Insert HTML strings |
| `binder.dispose()` when the bound section goes away | Bind the same element twice |
