# Stitch.js v3 recipes

Each recipe is a complete, working fragment: markup plus script. Every block is executed by the
library's test suite, so it is correct as written. Copy the closest one, then change names and data.
Load `stitch.js` before the script (as in the page in `SKILL.md`).

| Task | Recipe |
|---|---|
| List of objects: add, edit in place, remove | [1](#1-keyed-list-add-edit-remove) |
| Rows keyed by another field | [2](#2-rows-keyed-by-another-field-data-key) |
| Table body, row computeds, totals | [3](#3-table-body-from-a-template-with-totals) |
| Recursive tree with expand/collapse | [4](#4-recursive-tree-with-expand-and-collapse) |
| Search, filter and sort | [5](#5-search-filter-and-sort) |
| Master-detail selection | [6](#6-master-detail-selection) |
| Form with validation | [7](#7-form-with-validation-inside-a-form) |
| Selects: objects, plain values, numbers, multiple | [8](#8-selects-over-objects-plain-values-and-numbers) |
| Cascading selects | [9](#9-cascading-selects) |
| Every input type, two-way | [10](#10-two-way-inputs-by-type) |
| Handlers in nested lists, keyboard events | [11](#11-handlers-in-nested-lists-and-keyboard-events) |
| Events between parts of the page | [12](#12-events-root-only-emit-and-on) |
| Error reporting | [13](#13-error-reporting-with-onerror) |
| Custom bindings (path and literal) | [14](#14-custom-bindings-path-and-literal) |
| Links, images, ARIA, styles from data | [15](#15-attributes-from-data-links-images-aria-style) |
| Loading data from a server | [16](#16-loading-data-from-a-server) |
| An element only for some rows | [17](#17-an-element-only-for-some-rows) |
| Tabs and wizard steps | [18](#18-tabs-and-wizard-steps) |
| Teardown, rebind, removers | [19](#19-lifecycle-rebind-teardown-removers) |

## 1. Keyed list: add, edit, remove

Rows need a unique `id`. Model methods are called from rows with `$root.`. A handler receives
`(item, event)`. Use `<ol>` for 1-based numbers (`$index` is 0-based and cannot be computed on).

```html run
<div id="people">
    <ol data-foreach="people">
        <li>
            <input data-value="name">
            <button type="button" data-click="$root.remove">Remove</button>
        </li>
    </ol>
    <button id="add-person" type="button" data-click="add">Add</button>
    <p>Total: <span id="total" data-text="people.length"></span></p>
</div>
<script>
    let nextId = 3;
    const model = Stitch.Observable.create({
        people: [{ id: 1, name: 'Ann' }, { id: 2, name: 'Bob' }],
        add(model, event) { this.people.push({ id: nextId++, name: '' }); },
        remove(person, event) { this.people.splice(this.people.indexOf(person), 1); }
    });
    new Stitch.DataBinder().bind('#people', model);
</script>
```
<!-- check: count('#people li') === 2 && text('#total') === '2' -->
<!-- check: click('#add-person') -->
<!-- check: count('#people li') === 3 -->
<!-- check: type('#people li:first-child input', 'Anna') && model.people[0].name === 'Anna' -->
<!-- check: click('#people li:nth-child(2) button') -->
<!-- check: texts('#people li').length === 2 && model.people.map(p => p.id).join(',') === '1,3' && text('#total') === '2' -->

Change a list only through the model: `push`, `splice`, `unshift`, index writes (`rows[0] = {...}`),
or assign a new array (`this.people = [...]`). A row is reused while it keeps its key AND stays the
same object; a new object under the same key gets a fresh row.

## 2. Rows keyed by another field: data-key

```html run
<ul id="products" data-foreach="products" data-key="sku">
    <li><span data-text="sku"></span>: <span data-text="name"></span></li>
</ul>
<script>
    const model = Stitch.Observable.create({
        products: [{ sku: 'A1', name: 'Pen' }, { sku: 'B2', name: 'Ink' }]
    });
    new Stitch.DataBinder().bind('#products', model);
    model.products.unshift({ sku: 'C3', name: 'Pad' });
</script>
```
<!-- check: texts('#products li').join('|') === 'C3: Pad|A1: Pen|B2: Ink' -->

Keys compare as JavaScript values: `1` and `'1'` are different keys. Rows with no natural key need
one added before `create()`: `rows.map((r, i) => ({ id: i + 1, ...r }))`.

## 3. Table body from a template, with totals

Put `data-foreach` on the `<tbody>` and the row in a `<template>`. Row computeds go into each row
object before it reaches the model. Format numbers in computeds.

```html run
<table id="cart">
    <thead><tr><th>Item</th><th>Qty</th><th>Subtotal</th></tr></thead>
    <tbody data-foreach="lines" data-key="sku" data-template="cart-row"></tbody>
    <tfoot><tr><td colspan="2">Total</td><td id="cart-total" data-text="totalText"></td></tr></tfoot>
</table>
<template id="cart-row">
    <tr>
        <td data-text="name"></td>
        <td><input type="number" min="0" data-value="qty"></td>
        <td data-text="subtotalText"></td>
    </tr>
</template>
<script>
    function line(raw) {
        return Object.assign({}, raw, {
            subtotal: Stitch.computed(function () { return this.price * (this.qty || 0); }),
            subtotalText: Stitch.computed(function () { return this.subtotal.toFixed(2); })
        });
    }
    const model = Stitch.Observable.create({
        lines: [{ sku: 'A1', name: 'Pen', price: 1.5, qty: 2 }, { sku: 'B2', name: 'Ink', price: 4, qty: 1 }].map(line),
        totalText: Stitch.computed(function () {
            return this.lines.reduce((sum, l) => sum + l.subtotal, 0).toFixed(2);
        })
    });
    new Stitch.DataBinder().bind('#cart', model);
</script>
```
<!-- check: text('#cart-total') === '7.00' && texts('#cart tbody td:last-child').join(',') === '3.00,4.00' -->
<!-- check: type('#cart tbody tr:first-child input', '4') -->
<!-- check: model.lines[0].qty === 4 && text('#cart-total') === '10.00' -->
<!-- check: (model.lines.push(line({ sku: 'C3', name: 'Pad', price: 2, qty: 1 })), true) -->
<!-- check: count('#cart tbody tr') === 3 && text('#cart-total') === '12.00' -->

A number input gives `null` while empty or invalid; guard with `(this.qty || 0)`.

## 4. Recursive tree with expand and collapse

A `<template>` whose row contains a list using the same template. Normalize every node so it has
every field the template binds (`children: []` on leaves). `data-visible` may sit on a list element.

```html run
<ul id="tree" data-foreach="nodes" data-template="tree-node"></ul>
<template id="tree-node">
    <li>
        <button type="button" class="toggle" data-visible="isFolder" data-click="$root.toggle" data-text="toggleLabel"></button>
        <span class="name" data-text="name"></span>
        <ul data-visible="expanded" data-foreach="children" data-template="tree-node"></ul>
    </li>
</template>
<script>
    function node(raw) {
        return {
            id: raw.id,
            name: raw.name,
            expanded: false,
            children: (raw.children || []).map(node),
            isFolder: Stitch.computed(function () { return this.children.length > 0; }),
            toggleLabel: Stitch.computed(function () { return this.expanded ? '-' : '+'; })
        };
    }
    const model = Stitch.Observable.create({
        nodes: [
            { id: 1, name: 'src', children: [
                { id: 2, name: 'app.js' },
                { id: 3, name: 'lib', children: [{ id: 4, name: 'util.js' }] }
            ] },
            { id: 5, name: 'README.md' }
        ].map(node),
        toggle(item, event) { item.expanded = !item.expanded; }
    });
    new Stitch.DataBinder().bind('#tree', model);
</script>
```
<!-- check: texts('#tree .name').join(',') === 'src,app.js,lib,util.js,README.md' && count('#tree button.toggle') === 5 -->
<!-- check: visible('#tree > li:first-child > ul') === false && visible('#tree > li:nth-child(2) > button') === false -->
<!-- check: click('#tree > li:first-child > button') -->
<!-- check: visible('#tree > li:first-child > ul') && model.nodes[0].expanded === true && text('#tree > li:first-child > button') === '-' -->

Keys must be unique within each list, not across the tree. To leave the button out of leaf rows
entirely (instead of hiding it), use [recipe 17](#17-an-element-only-for-some-rows).

## 5. Search, filter and sort

Bind the list to a computed that returns a NEW array. Copy before sorting.

```html run
<div id="finder">
    <input id="q" data-value="query" placeholder="Search">
    <select id="order" data-value="order">
        <option value="name">Name</option>
        <option value="price">Price</option>
    </select>
    <ul data-foreach="shown"><li data-text="name"></li></ul>
    <p id="none" data-visible="noMatches">No matches.</p>
</div>
<script>
    const model = Stitch.Observable.create({
        query: '',
        order: 'name',
        items: [{ id: 1, name: 'Pear', price: 3 }, { id: 2, name: 'Apple', price: 5 }, { id: 3, name: 'Plum', price: 1 }],
        shown: Stitch.computed(function () {
            const q = this.query.trim().toLowerCase();
            const key = this.order;
            return this.items
                .filter(i => i.name.toLowerCase().includes(q))
                .sort((a, b) => key === 'price' ? a.price - b.price : a.name.localeCompare(b.name));
        }),
        noMatches: Stitch.computed(function () { return this.shown.length === 0; })
    });
    new Stitch.DataBinder().bind('#finder', model);
</script>
```
<!-- check: texts('#finder li').join(',') === 'Apple,Pear,Plum' -->
<!-- check: type('#order', 'price') -->
<!-- check: texts('#finder li').join(',') === 'Plum,Pear,Apple' && model.items[0].name === 'Pear' -->
<!-- check: type('#q', 'zz') -->
<!-- check: count('#finder li') === 0 && visible('#none') -->

`filter()` already returns a new array, so sorting its result is safe. Sort `this.items` itself only
through `this.items.slice().sort(...)`.

## 6. Master-detail selection

Keep the selected row object in a property that starts as `null`. A path through `null`
(`selected.name`) shows nothing. Hide inputs that write through `selected` while it is `null`. A row
computed may read the model through the `model` variable (computeds are lazy).

```html run
<div id="md">
    <ul data-foreach="people">
        <li data-class="rowClass"><button type="button" data-click="$root.select" data-text="name"></button></li>
    </ul>
    <section id="detail" data-visible="hasSelection">
        <h2 id="detail-name" data-text="selected.name"></h2>
        <input id="detail-email" data-value="selected.email">
        <button id="clear" type="button" data-click="clearSelection">Close</button>
    </section>
</div>
<script>
    const people = [
        { id: 1, name: 'Ann', email: 'ann@example.com' },
        { id: 2, name: 'Bob', email: null }
    ].map(p => Object.assign(p, {
        rowClass: Stitch.computed(function () { return { selected: model.selected === this }; })
    }));
    const model = Stitch.Observable.create({
        people,
        selected: null,
        hasSelection: Stitch.computed(function () { return this.selected !== null; }),
        select(person, event) { this.selected = person; },
        clearSelection(model, event) { this.selected = null; }
    });
    new Stitch.DataBinder().bind('#md', model);
</script>
```
<!-- check: visible('#detail') === false && text('#detail-name') === '' -->
<!-- check: click('#md li:nth-child(2) button') -->
<!-- check: visible('#detail') && text('#detail-name') === 'Bob' && document.querySelector('#md li:nth-child(2)').className === 'selected' -->
<!-- check: type('#detail-email', 'bob@example.com') && model.people[1].email === 'bob@example.com' -->
<!-- check: click('#clear') -->
<!-- check: visible('#detail') === false && document.querySelector('#md li:nth-child(2)').className === '' -->

Selecting by id from a `<select>` instead: `<select data-value="selectedId" data-type="int">` and
`selected: Stitch.computed(function () { return this.people.find(p => p.id === this.selectedId) || null; })`.
Without `data-type="int"` the select writes the string `"2"` and `=== 2` never matches.

## 7. Form with validation inside a form

`novalidate` stops the browser's own validation; the form's `submit` goes to a handler that calls
`event.preventDefault()`. One `input` handler marks fields as touched by their `name`. Errors show
after a field is touched or after a submit attempt.

```html run
<form id="signup" novalidate data-event="formEvents">
    <input id="f-name" name="name" data-value="name" data-event="touchEvents">
    <p id="e-name" data-visible="showNameError" data-text="nameError"></p>
    <input id="f-email" name="email" type="email" data-value="email" data-event="touchEvents">
    <p id="e-email" data-visible="showEmailError" data-text="emailError"></p>
    <input id="f-age" name="age" type="number" data-value="age" data-event="touchEvents">
    <p id="e-age" data-visible="showAgeError" data-text="ageError"></p>
    <label><input id="f-agree" name="agree" type="checkbox" data-value="agree" data-event="touchEvents"> I agree</label>
    <button id="send" type="submit">Sign up</button>
    <button id="reset" type="button" data-click="reset">Reset</button>
    <p id="status" data-text="status"></p>
</form>
<script>
    function blank() {
        return { name: '', email: '', age: null, agree: false, submitted: false, status: '',
            touched: { name: false, email: false, age: false, agree: false } };
    }
    const model = Stitch.Observable.create(Object.assign(blank(), {
        formEvents: { submit: 'save' },
        touchEvents: { input: 'touch' },
        nameError: Stitch.computed(function () { return this.name.trim() ? '' : 'Enter your name'; }),
        emailError: Stitch.computed(function () {
            return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(this.email) ? '' : 'Enter a valid email';
        }),
        ageError: Stitch.computed(function () {
            return this.age !== null && this.age >= 18 ? '' : 'You must be 18 or older';
        }),
        valid: Stitch.computed(function () {
            return !this.nameError && !this.emailError && !this.ageError && this.agree;
        }),
        showNameError: Stitch.computed(function () { return (this.touched.name || this.submitted) && this.nameError !== ''; }),
        showEmailError: Stitch.computed(function () { return (this.touched.email || this.submitted) && this.emailError !== ''; }),
        showAgeError: Stitch.computed(function () { return (this.touched.age || this.submitted) && this.ageError !== ''; }),
        touch(model, event) { this.touched[event.target.name] = true; },
        save(model, event) {
            event.preventDefault();
            this.submitted = true;
            this.status = this.valid ? 'Saved ' + this.name : 'Fix the errors above';
        },
        reset(model, event) { Object.assign(this, blank()); }
    }));
    new Stitch.DataBinder().bind('#signup', model);
</script>
```
<!-- check: visible('#e-name') === false && visible('#e-email') === false -->
<!-- check: type('#f-email', 'ada@') -->
<!-- check: visible('#e-email') && text('#e-email') === 'Enter a valid email' && visible('#e-name') === false -->
<!-- check: click('#send') -->
<!-- check: visible('#e-name') && text('#status') === 'Fix the errors above' && location.href === 'about:srcdoc' -->
<!-- check: type('#f-name', 'Ada') && type('#f-email', 'ada@example.com') && type('#f-age', '36') && click('#f-agree') -->
<!-- check: click('#send') -->
<!-- check: text('#status') === 'Saved Ada' && model.age === 36 && model.agree === true -->
<!-- check: click('#reset') -->
<!-- check: document.getElementById('f-name').value === '' && visible('#e-name') === false && text('#status') === '' -->

- Every `<button>` in the form has a `type`. A `type="submit"` button and Enter in a field fire the
  form's `submit` event; the handler must call `event.preventDefault()` or the page reloads.
- `input` fires on every user edit of every control type; `blur` means "visited"; values written
  from code fire no events.
- Reset by assigning the declared fields (`Object.assign(this, blank())`), not by creating a new
  model (the page stays bound to the old one).

## 8. Selects over objects, plain values and numbers

`data-foreach` goes on the `<select>`; the template is one `<option>`. `data-default-text` adds a
placeholder whose value is `data-default-value` (default `""`).

```html run
<div id="selects">
    <select id="country" data-foreach="countries" data-key="code" data-value="country" data-default-text="Choose a country">
        <option data-value="code" data-text="name"></option>
    </select>
    <select id="sector" data-foreach="sectors" data-value="sector" data-default-text="All sectors">
        <option data-text="$data"></option>
    </select>
    <select id="qty" data-value="qty" data-type="int">
        <option value="1">1</option><option value="2">2</option><option value="3">3</option>
    </select>
    <select id="tags" multiple data-value="tags">
        <option value="new">new</option><option value="sale">sale</option><option value="eco">eco</option>
    </select>
</div>
<script>
    const model = Stitch.Observable.create({
        country: '',
        countries: [{ code: 'FR', name: 'France' }, { code: 'JP', name: 'Japan' }],
        sector: '',
        sectors: ['Energy', 'Financials', 'Technology'],
        qty: 2,
        tags: ['sale']
    });
    new Stitch.DataBinder().bind('#selects', model);
</script>
```
<!-- check: count('#country option') === 3 && document.getElementById('country').value === '' && document.getElementById('qty').value === '2' -->
<!-- check: type('#country', 'JP') && type('#sector', 'Financials') && type('#qty', '3') -->
<!-- check: model.country === 'JP' && model.sector === 'Financials' && model.qty === 3 -->
<!-- check: (document.querySelector('#tags option[value="eco"]').selected = true, document.getElementById('tags').dispatchEvent(new Event('change')), true) -->
<!-- check: model.tags.join(',') === 'sale,eco' -->

- Plain values: `<option data-text="$data">` and NO `data-value` (an option without a value uses its
  text). `<option data-value="$data">` throws E313.
- A select writes strings. Numbers need `data-type="int"` (or `float`).
- A select WITHOUT `data-value` keeps the user's choice while its list changes.
- When the selected option leaves the list, the select shows another option but the model keeps
  the old value: reset the property yourself (recipe 9).

## 9. Cascading selects

The second list is a computed of the first choice. Reset the second choice when the first changes,
with `$watch` (synchronous; it returns a remover).

```html run
<div id="cascade">
    <select id="c-country" data-foreach="countries" data-key="code" data-value="country" data-default-text="Country">
        <option data-value="code" data-text="name"></option>
    </select>
    <select id="c-city" data-foreach="cities" data-value="city" data-enabled="hasCountry" data-default-text="City">
        <option data-value="id" data-text="name"></option>
    </select>
    <p id="c-out" data-text="summary"></p>
</div>
<script>
    const model = Stitch.Observable.create({
        country: '',
        city: '',
        countries: [{ code: 'FR', name: 'France' }, { code: 'JP', name: 'Japan' }],
        allCities: [
            { id: 'par', country: 'FR', name: 'Paris' }, { id: 'lyo', country: 'FR', name: 'Lyon' },
            { id: 'tyo', country: 'JP', name: 'Tokyo' }
        ],
        cities: Stitch.computed(function () { return this.allCities.filter(c => c.country === this.country); }),
        hasCountry: Stitch.computed(function () { return this.country !== ''; }),
        summary: Stitch.computed(function () { return this.country + '/' + this.city; })
    });
    model.$watch('country', function () { model.city = ''; });
    new Stitch.DataBinder().bind('#cascade', model);
</script>
```
<!-- check: document.getElementById('c-city').disabled === true && count('#c-city option') === 1 -->
<!-- check: type('#c-country', 'FR') -->
<!-- check: count('#c-city option') === 3 && document.getElementById('c-city').disabled === false -->
<!-- check: type('#c-city', 'lyo') -->
<!-- check: text('#c-out') === 'FR/lyo' -->
<!-- check: type('#c-country', 'JP') -->
<!-- check: model.city === '' && texts('#c-city option').join(',') === 'City,Tokyo' && document.getElementById('c-city').value === '' -->

## 10. Two-way inputs by type

| Control | Model value |
|---|---|
| text, email, password, search, `textarea` | string |
| `type="number"` | number, `null` when empty or invalid |
| `type="range"` | number (never `null`) |
| `type="checkbox"` | boolean |
| `type="radio"` (same `name`, each with `value` and the same `data-value`) | the checked radio's `value` (string) |
| `type="date"`, `type="datetime-local"` | `Date` or `null` (add `data-type="date"` / `"datetime"`) |
| `select` | string (`data-type="int"` / `float` / `bool` / `date` converts) |
| `select multiple` | array of strings |

```html run
<div id="inputs">
    <input id="i-text" data-value="text">
    <textarea id="i-notes" data-value="notes"></textarea>
    <input id="i-num" type="number" data-value="count">
    <input id="i-range" type="range" min="0" max="10" data-value="level">
    <input id="i-check" type="checkbox" data-value="subscribed">
    <label><input type="radio" name="size" value="S" data-value="size"> S</label>
    <label><input id="i-size-m" type="radio" name="size" value="M" data-value="size"> M</label>
    <input id="i-date" type="date" data-type="date" data-value="due">
    <p id="i-due" data-text="dueText"></p>
</div>
<script>
    const model = Stitch.Observable.create({
        text: 'hi', notes: '', count: 1, level: 5, subscribed: false, size: 'S', due: null,
        dueText: Stitch.computed(function () { return this.due ? this.due.toISOString().slice(0, 10) : 'no date'; })
    });
    new Stitch.DataBinder().bind('#inputs', model);
</script>
```
<!-- check: type('#i-num', '') && model.count === null -->
<!-- check: type('#i-num', '12') && type('#i-range', '7') && click('#i-check') && click('#i-size-m') -->
<!-- check: model.count === 12 && model.level === 7 && model.subscribed === true && model.size === 'M' -->
<!-- check: type('#i-date', '2024-05-06') && model.due instanceof Date -->
<!-- check: text('#i-due') !== 'no date' -->

Add `data-type="date"` to a date input: where the engine has no date control the input is a text
field and would write a string. Show a `Date` through a computed that formats it; `data-text` on a
`Date` prints `String(date)`.

## 11. Handlers in nested lists and keyboard events

In a nested list, `$parent.` is the enclosing row and `$root.` the model. Only one prefix is
allowed. A `data-event` map is model data: inside a row name it with `$root.`, and write its
handler names with `$root.` too. Check `event.key` for keys.

```html run
<div id="board">
    <section data-foreach="groups">
        <div>
            <h3 data-text="title"></h3>
            <ul data-foreach="cards">
                <li>
                    <input class="card" data-value="text" data-event="$root.cardEvents">
                    <button type="button" data-click="$parent.clearCards">Clear group</button>
                    <button type="button" class="pick" data-click="$root.pick">Pick</button>
                </li>
            </ul>
        </div>
    </section>
    <p id="picked" data-text="picked"></p>
</div>
<script>
    const model = Stitch.Observable.create({
        picked: '',
        cardEvents: { keydown: '$root.onCardKey' },
        groups: [
            { id: 1, title: 'Todo', cards: [{ id: 11, text: 'Plan' }, { id: 12, text: 'Build' }],
              clearCards(item, event) { this.cards = []; } }
        ],
        pick(card, event) { this.picked = card.text; },
        onCardKey(card, event) { if (event.key === 'Enter') this.picked = 'enter on ' + card.text; }
    });
    new Stitch.DataBinder().bind('#board', model);
</script>
```
<!-- check: click('#board li:nth-child(2) .pick') -->
<!-- check: text('#picked') === 'Build' -->
<!-- check: (document.querySelector('#board .card').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })), true) -->
<!-- check: text('#picked') === 'enter on Plan' -->
<!-- check: click('#board li button') -->
<!-- check: count('#board li') === 0 -->

`this` inside a handler is the object the method is on: the group for `$parent.clearCards`, the
model for `$root.pick`. The first argument is always the current row's item.

## 12. Events: root-only $emit and $on

Events live on the root model. A row cannot emit; it calls a `$root.` method that emits. Delivery
is asynchronous (a microtask). `$on` returns an unsubscribe function.

```html run
<div id="inbox">
    <ul data-foreach="messages">
        <li><span data-text="subject"></span> <button type="button" data-click="$root.archive">Archive</button></li>
    </ul>
    <p id="log" data-text="log"></p>
</div>
<script>
    const model = Stitch.Observable.create({
        log: '',
        messages: [{ id: 1, subject: 'Invoice' }, { id: 2, subject: 'Lunch' }],
        archive(message, event) {
            this.messages.splice(this.messages.indexOf(message), 1);
            this.$emit('archived', { subject: message.subject });
        }
    });
    const stop = model.$on('archived', function (payload) { model.log = 'Archived ' + payload.subject; });
    new Stitch.DataBinder().bind('#inbox', model);
</script>
```
<!-- check: click('#inbox li button') -->
<!-- check: text('#log') === 'Archived Invoice' && count('#inbox li') === 1 -->

For code without a model: `const bus = new Stitch.MessageBus(); bus.subscribe('x', fn); bus.publish('x', data);`.

## 13. Error reporting with onError

Install one handler per page, before `bind()`. It receives errors from later updates (computeds,
list re-renders, click handlers, change handlers). `bind()` errors are thrown to the caller. The DOM
keeps its last good state.

```html run
<div id="report">
    <p id="ratio" data-text="ratio"></p>
    <input id="divisor" type="number" data-value="divisor">
    <p id="error-banner" data-visible="hasError" data-text="lastError"></p>
</div>
<script>
    const model = Stitch.Observable.create({
        amount: 10,
        divisor: 2,
        lastError: '',
        hasError: Stitch.computed(function () { return this.lastError !== ''; }),
        ratio: Stitch.computed(function () {
            if (!this.divisor) throw new Error('Divisor must not be zero');
            return String(this.amount / this.divisor);
        })
    });
    const removeHandler = Stitch.onError(function (error, context) {
        // context.source: 'binding', 'handler', 'change-handler', 'watch', 'messageBus', ...
        model.lastError = context.source + ': ' + error.message;
    });
    new Stitch.DataBinder().bind('#report', model);
</script>
```
<!-- check: text('#ratio') === '5' && visible('#error-banner') === false -->
<!-- check: type('#divisor', '0') -->
<!-- check: tick().then(() => text('#error-banner') === 'binding: Divisor must not be zero' && text('#ratio') === '5') -->

- A second `Stitch.onError(fn)` while one is installed throws E902; call the remover first.
- An `async` handler's rejected promise does NOT reach `onError`: catch inside the handler.

## 14. Custom bindings: path and literal

Register before the first `bind()`. A `'path'` binding (default) gets a checked model path; follow
it with an effect and register its cleanup. A `'literal'` binding gets the attribute text. Write
text with `textContent`, build elements with `document.createElement`, never `innerHTML`.

```html run
<div id="custom">
    <p id="price" data-currency="price"></p>
    <button id="help" type="button" data-hint="Opens the help page">?</button>
    <p id="hl" data-highlight="sentence"></p>
    <input id="term" data-value="term">
</div>
<script>
    Stitch.DataBinder.registerBinding('currency', {
        bind(element, model, path, context) {
            const effect = context.reactiveSystem.effect(function () {
                element.textContent = '$' + Number(model[path]).toFixed(2);
            });
            context.binder._trackCleanup(element, function () { context.reactiveSystem.cleanup(effect); });
        }
    });
    Stitch.DataBinder.registerBinding('hint', {
        value: 'literal',
        bind(element, model, text) { element.setAttribute('title', text); }
    });
    // Builds <mark> elements for the search term: DOM API only, no HTML strings.
    Stitch.DataBinder.registerBinding('highlight', {
        bind(element, model, path, context) {
            const effect = context.reactiveSystem.effect(function () {
                const text = String(model[path]);
                const term = model.term;
                element.replaceChildren();
                if (!term) { element.textContent = text; return; }
                text.split(term).forEach(function (part, i) {
                    if (i > 0) {
                        const mark = document.createElement('mark');
                        mark.textContent = term;
                        element.appendChild(mark);
                    }
                    element.appendChild(document.createTextNode(part));
                });
            });
            context.binder._trackCleanup(element, function () { context.reactiveSystem.cleanup(effect); });
        }
    });
    const model = Stitch.Observable.create({ price: 3.5, sentence: 'a cat and a cat', term: '' });
    new Stitch.DataBinder().bind('#custom', model);
</script>
```
<!-- check: text('#price') === '$3.50' && attr('#help', 'title') === 'Opens the help page' -->
<!-- check: (model.price = 12, true) -->
<!-- check: text('#price') === '$12.00' -->
<!-- check: type('#term', 'cat') -->
<!-- check: count('#hl mark') === 2 && text('#hl') === 'a cat and a cat' -->

- Inside a list row, `model` is the row context: read `model[path]` the same way.
- Name: lowercase letters, digits, dashes; not a built-in; not `key`, `template`, `default-text`,
  `default-value`, `type`.
- The built-in safety checks do not cover your binding: never write `on*` attributes, `srcdoc` or
  `javascript:` URLs from data.

## 15. Attributes from data: links, images, ARIA, style

`data-attr` takes an object `{ name: value }`: `null`/`false` removes, `true` writes `""`. Keep
security attributes (`rel`, `target`, `sandbox`, `crossorigin`) in the markup; give data only the
values. ARIA states must be the strings `'true'`/`'false'`. `style` must be an object.

```html run
<div id="attrs">
    <a id="profile" target="_blank" rel="noopener noreferrer" data-attr="profileLink">Profile</a>
    <img id="avatar" alt="" data-attr="avatarAttrs">
    <button id="more" type="button" data-attr="moreAttrs" data-click="toggle">More</button>
    <p id="details" data-visible="open" data-attr="detailsAttrs">Details</p>
</div>
<script>
    const model = Stitch.Observable.create({
        userId: 'a b',
        open: false,
        warn: true,
        profileLink: Stitch.computed(function () {
            return { href: '/users/' + encodeURIComponent(this.userId), title: 'Profile of ' + this.userId };
        }),
        avatarAttrs: Stitch.computed(function () {
            return { src: 'data:image/gif;base64,R0lGODlhAQABAAAAACw=', width: 16 };
        }),
        moreAttrs: Stitch.computed(function () {
            return { 'aria-expanded': this.open ? 'true' : 'false', 'aria-controls': 'details' };
        }),
        detailsAttrs: Stitch.computed(function () {
            return { style: { color: this.warn ? 'darkred' : null, fontWeight: 'bold' } };
        }),
        toggle(model, event) { this.open = !this.open; }
    });
    new Stitch.DataBinder().bind('#attrs', model);
</script>
```
<!-- check: attr('#profile', 'href') === '/users/a%20b' && attr('#profile', 'rel') === 'noopener noreferrer' && attr('#avatar', 'width') === '16' -->
<!-- check: attr('#more', 'aria-expanded') === 'false' && click('#more') -->
<!-- check: attr('#more', 'aria-expanded') === 'true' && visible('#details') && document.getElementById('details').style.fontWeight === 'bold' -->

Refused (throws, writes nothing from that object): `on*` names (E321), `srcdoc` (E322),
`javascript:`/`vbscript:` URLs (E323), `data:` URLs except `data:image/...` in `<img src>` (E324),
`style` as a string (E325), sensitive names such as `sandbox`, `allow`, `integrity`, `crossorigin`,
`nonce`, `referrerpolicy`, `http-equiv`, `is` (E327), `rel` containing `opener` (E328), a `rel`
that drops the markup's `noopener`/`noreferrer` (E329). No built-in binding may sit on `<script>`,
`<style>`, `<base>`, `<meta>` (E326). Classes: prefer `data-class="{...}"` from a computed.

## 16. Loading data from a server

Declare the list and the state flags up front. Normalize each row (key, every bound field) before it
reaches the model. `data-loading` disables the button and sets `aria-busy` while true. Catch errors
inside the `async` method: a rejected handler promise does not reach `Stitch.onError`.

```html run
<div id="loader">
    <button id="reload" type="button" data-click="load" data-loading="loading">Reload</button>
    <p id="load-error" data-visible="hasError" data-text="error"></p>
    <ul data-foreach="users"><li><span data-text="name"></span> <span data-text="email"></span></li></ul>
</div>
<script>
    // Stands in for: fetch('/api/users').then(r => r.json())
    function fetchUsers() {
        return Promise.resolve([{ userId: 7, name: 'Ann', email: 'ann@example.com' }, { userId: 9, name: 'Bob' }]);
    }
    const model = Stitch.Observable.create({
        users: [],
        loading: false,
        error: null,
        hasError: Stitch.computed(function () { return this.error !== null; }),
        async load(model, event) {
            this.loading = true;
            this.error = null;
            try {
                const rows = await fetchUsers();
                this.users = rows.map(u => ({ id: u.userId, name: u.name, email: u.email || null }));
            } catch (e) {
                this.error = 'Could not load users: ' + e.message;
            } finally {
                this.loading = false;
            }
        }
    });
    new Stitch.DataBinder().bind('#loader', model);
    model.load(model, null);
</script>
```
<!-- check: tick().then(() => count('#loader li') === 2 && document.getElementById('reload').disabled === false && visible('#load-error') === false) -->

Assigning a new array (`this.users = rows`) replaces the list; rows that keep their key and object
are reused. Map field names to the template's names (`userId` → `id`) in the normalizer.

## 17. An element only for some rows

There is no "if" binding. `data-visible` hides an element but keeps it bound (its paths must exist on
every row). To leave it out of the page, bind `data-foreach` to a row computed returning `[this]`
or `[]`, with the element as the template.

```html run
<ul id="files" data-foreach="files">
    <li>
        <span class="name" data-text="name"></span>
        <span data-foreach="ifFolder"><button type="button" data-click="$root.open">open</button></span>
        <em data-visible="isLarge">large</em>
    </li>
</ul>
<script>
    const model = Stitch.Observable.create({
        opened: '',
        files: [
            { id: 1, name: 'src', folder: true, size: 0 },
            { id: 2, name: 'app.js', folder: false, size: 90000 }
        ].map(f => Object.assign(f, {
            ifFolder: Stitch.computed(function () { return this.folder ? [this] : []; }),
            isLarge: Stitch.computed(function () { return this.size > 50000; })
        })),
        open(file, event) { this.opened = file.name; }
    });
    new Stitch.DataBinder().bind('#files', model);
</script>
```
<!-- check: count('#files button') === 1 && count('#files em') === 2 && !visible('#files li:first-child em') -->
<!-- check: click('#files button') -->
<!-- check: model.opened === 'src' -->

Do not combine `data-visible` with a static `hidden` attribute: `data-visible` clears only the
inline `display`, so `hidden` keeps the element hidden.

## 18. Tabs and wizard steps

One string property for the current step; computeds for each panel's visibility and each tab's class.

```html run
<div id="wizard">
    <nav>
        <button id="t-1" type="button" data-class="tab1Class" data-click="goAccount">Account</button>
        <button id="t-2" type="button" data-class="tab2Class" data-click="goConfirm" data-enabled="accountDone">Confirm</button>
    </nav>
    <section id="p-1" data-visible="onAccount"><input id="w-user" data-value="user"></section>
    <section id="p-2" data-visible="onConfirm">Create <span id="w-who" data-text="user"></span>?</section>
</div>
<script>
    const model = Stitch.Observable.create({
        step: 'account',
        user: '',
        onAccount: Stitch.computed(function () { return this.step === 'account'; }),
        onConfirm: Stitch.computed(function () { return this.step === 'confirm'; }),
        accountDone: Stitch.computed(function () { return this.user.trim() !== ''; }),
        tab1Class: Stitch.computed(function () { return { active: this.step === 'account' }; }),
        tab2Class: Stitch.computed(function () { return { active: this.step === 'confirm' }; }),
        goAccount(model, event) { this.step = 'account'; },
        goConfirm(model, event) { if (this.accountDone) this.step = 'confirm'; }
    });
    new Stitch.DataBinder().bind('#wizard', model);
</script>
```
<!-- check: visible('#p-1') && !visible('#p-2') && document.getElementById('t-2').disabled === true -->
<!-- check: type('#w-user', 'ada') -->
<!-- check: click('#t-2') -->
<!-- check: visible('#p-2') && text('#w-who') === 'ada' && document.getElementById('t-2').className === 'active' -->

`data-class` with an object toggles only the listed classes; with a string it REPLACES every class
on the element.

## 19. Lifecycle: rebind, teardown, removers

Bind a root once. To bind it to another model, `unbind` first (or change the data of the one model).
`dispose()` releases everything a binder bound; the binder cannot bind again. Watches, change
handlers and event subscriptions belong to the model: only their removers stop them.

```html run
<div id="panel"><h2 id="panel-title" data-text="title"></h2></div>
<script>
    const binder = new Stitch.DataBinder();
    const draft = Stitch.Observable.create({ title: 'Draft' });
    binder.bind('#panel', draft);

    binder.unbind('#panel');                  // release, then bind another model
    const final = Stitch.Observable.create({ title: 'Final' });
    binder.bind('#panel', final);

    const seen = [];
    const stopWatch = final.$watch('title', function (now, before) { seen.push(before + '->' + now); });
    const stopChange = final.$onChange(function (change) { seen.push('change ' + change.field); });
    const stopEvent = final.$on('saved', function () { seen.push('saved'); });

    final.title = 'Final 2';
    stopWatch(); stopChange(); stopEvent();
    final.title = 'Final 3';                  // not seen: removed
    binder.dispose();                         // the page section goes away
    final.title = 'Final 4';                  // the page no longer follows
</script>
```
<!-- check: text('#panel-title') === 'Final' && seen.join('|') === 'Final->Final 2|change title' -->

- `bind()` on an already bound element throws E601; `unbind()` of an element with nothing bound
  throws E607; `bind()` after `dispose()` throws E605.
- Never bind a root inside another bound root; bind sibling roots, one model each.
- `Stitch.debug.stats()` returns `{ effects, subscriptions, parentLinks }`; counts that grow with every
  show/hide cycle mean something is not released.
