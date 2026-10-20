---
name: stitch
description: Build, edit or debug a web page that uses Stitch.js v3, the no-build data binding library loaded with one script tag (stitch.js or stitch.min.js). Use when a page calls Stitch.Observable.create, new Stitch.DataBinder().bind, Stitch.computed or Stitch.DataBinder.registerBinding, or uses data-text, data-value, data-foreach, data-key, data-template, data-click, data-event, data-visible, data-enabled, data-class, data-attr or data-loading attributes, or when an error starting with [Stitch E (such as [Stitch E201]) must be fixed. Also use when porting a Vue, Alpine, Knockout or jQuery page to Stitch.
---

# Stitch.js v3

Stitch binds plain HTML to one JavaScript model object. `data-*` attributes name model properties;
`Stitch.Observable.create(data)` makes the model; `new Stitch.DataBinder().bind(root, model)` binds
them. Load it with a plain `<script src="stitch.js"></script>`: no build, no import, one global
`Stitch`. Most mistakes throw an error whose message starts with a stable code, `[Stitch E###]`,
and names the element, the binding and the fix. The rules marked "none" fail silently: follow them
exactly.

## Rules, ranked by how often they bite

| # | Do | Never | Code |
|---|---|---|---|
| 1 | A binding value is ONE property path: `name`, `user.email`, `items.0.title`, `$root.total`. Put logic in a computed and bind its name. | `!done`, `a + b`, `items[0]` (E102), `fmt(price)` (E104), `{ active: on }`, `{{name}}` (E103), `x ? y : z`, `text: name`, `a, visible: b` (E105) | E102-E106 |
| 2 | Declare EVERY bound property in `Observable.create()`, `null` if unknown. Add missing fields to server rows before `create()`. Add one later only with `model.$set('x', v)`, before binding it. | Assign a new property later; bind a `_name` | E201 E203 |
| 3 | Give every object row a unique `id`, or name the key field: `data-key="sku"`. Plain values are their own key and must be unique. | Rows without keys, duplicate keys, `data-key` on plain values | E501 E502 E504 |
| 4 | Inside a row, a bare name is a field of the ROW. Call model methods with `data-click="$root.save"`; read model values with `$root.x`. | `data-click="save"` inside a row for a model method | E401 E406 |
| 5 | Write handlers as `save(item, event) { ... }`: `item` is the row (the model outside a list), the event is SECOND, `this` is the object the method is on. | `save(event)`; arguments in the attribute: `save(item)` | E108 |
| 6 | A row template is exactly ONE root element. Wrap siblings in one `<li>`, `<tr>` or `<div>`. | Two root elements, or text beside the root | E511 E513 |
| 7 | Use only these bindings: `data-text`, `data-value`, `data-visible`, `data-enabled`, `data-class`, `data-attr`, `data-loading`, `data-click`, `data-event`, `data-foreach`; list attributes `data-key`, `data-template`, `data-default-text`, `data-default-value`; `data-type` beside `data-value`. For a `v-if`, use `data-visible`. | `data-if`, `data-show`, `data-html`, `data-bind`, `data-model`, `data-for`, `v-if`, `x-show`: never read, no error | none |
| 8 | Methods: `name() { }`, also in rows you push later. Computeds: `Stitch.computed(function () { return this.a * this.b; })` or `Stitch.computed(m => m.a * m.b)` (use the ARGUMENT). A computed only reads: no assignment, no `sort`/`push`/`splice` on model lists. | Arrow methods; `this` inside an arrow computed (silently `NaN`); writes in a computed | E707 E724 E725 |
| 9 | Every `<button>` in a `<form>` gets `type="button"`, or put `data-event="formEvents"` on the form with `{ submit: 'save' }` and call `event.preventDefault()`. Add `novalidate` when Stitch validates. | A bare `<button>` in a form: it submits and RELOADS the page | none |
| 10 | Options from plain values: `<option data-text="$data"></option>` only. From objects: `<option data-value="code" data-text="name">`. A `<select>` writes STRINGS: add `data-type="int"` for numeric values. | `<option data-value="$data">`; comparing a select's value to a number id | E313 |
| 11 | `data-value` needs a writable property, on `input`, `textarea` or `select`. | `data-value` on a computed, `$data`, `$index`, `$parent`, `$root` | E311 E313 |
| 12 | Put text in its own `<span data-text>`; keep `data-text` off any element that contains bound elements or carries `data-foreach`. | `<label data-text="x"><input data-value="y"></label>` | E535 E534 |
| 13 | Filter and sort in a computed that returns a NEW array: `this.items.slice().sort(...)`. React to a change with `model.$watch('path', fn)`, writing only when the value must change. | `this.items.sort()` in a computed; a `$watch` that always writes its own path | E725 E912 |
| 14 | Never `delete` model data. Set properties to `null`; remove rows with `splice`; Map/Set with `.delete(key)`. | `delete model.x`, `delete rows[0]` | E712 |
| 15 | One model per root. Assign plain data, or `Stitch.Observable.toRaw(other)`. Copy shared lookup lists per model (`[...list]`, `new Map(m)`). Copy frozen data (`structuredClone(data)`). | A model inside a model; one array in two models; `Object.freeze` data | E710 E711 E714 |
| 16 | `$on`, `$off`, `$emit`, `$once`, `$use` only on the root model. From a row, call a `$root.` method and emit there. | `row.$emit(...)`, `model.user.$on(...)` | E801 |
| 17 | Install `Stitch.onError(fn)` once, before `bind()`. Errors in later updates go there (uncaught without it). Errors in `bind()` are thrown to the caller. | A second `onError`; swallowing Stitch errors | E902 |
| 18 | Register custom bindings BEFORE the first `bind()`. Use `value: 'literal'` when the attribute holds text. | `registerBinding` after `bind()` | E621 |
| 19 | Run the script after the elements exist (end of `<body>`). Bind each root once; `bind()` binds the FIRST element a selector matches. | Script in `<head>` without `DOMContentLoaded`; nested or repeated roots | E602 E601 |
| 20 | After a change in code, the page updates in a microtask: `await Promise.resolve()` before reading the DOM. `bind()` itself renders synchronously. | Reading the DOM right after `model.x = ...` | none |

## The page to start from

Copy this. Replace the data, keep the structure: `onError` first, one model, one `bind()`, script last.

```html run
<!doctype html>
<html>
<head>
    <meta charset="utf-8">
    <title>Tasks</title>
    <script src="stitch.js"></script>
</head>
<body>
    <div id="app">
        <form id="add-form" novalidate data-event="formEvents">
            <input id="draft" data-value="draft" placeholder="New task">
            <button id="add" type="submit" data-enabled="canAdd">Add</button>
        </form>
        <p><span id="left" data-text="remaining"></span> left</p>
        <ul id="list" data-foreach="visibleTasks">
            <li>
                <input type="checkbox" data-value="done">
                <span data-text="title"></span>
                <button type="button" data-click="$root.remove">Remove</button>
            </li>
        </ul>
        <p id="empty" data-visible="isEmpty">Nothing to do.</p>
    </div>
    <script>
        Stitch.onError(function (error, context) {
            document.title = 'Error: ' + error.message; // replace with your error reporting
        });

        let nextId = 3;
        const model = Stitch.Observable.create({
            draft: '',
            tasks: [
                { id: 1, title: 'Write the report', done: false },
                { id: 2, title: 'Send the invoice', done: true }
            ],
            formEvents: { submit: 'add' },
            canAdd: Stitch.computed(function () { return this.draft.trim() !== ''; }),
            remaining: Stitch.computed(function () { return this.tasks.filter(t => !t.done).length; }),
            visibleTasks: Stitch.computed(function () {
                return this.tasks.slice().sort((a, b) => Number(a.done) - Number(b.done));
            }),
            isEmpty: Stitch.computed(function () { return this.tasks.length === 0; }),
            add(model, event) {
                event.preventDefault();
                if (!this.canAdd) return;
                this.tasks.push({ id: nextId++, title: this.draft.trim(), done: false });
                this.draft = '';
            },
            remove(task, event) {
                this.tasks.splice(this.tasks.indexOf(task), 1);
            }
        });

        new Stitch.DataBinder().bind('#app', model);
    </script>
</body>
</html>
```
<!-- check: text('#left') === '1' && count('#list li') === 2 && visible('#empty') === false -->
<!-- check: type('#draft', 'Call the bank') -->
<!-- check: click('#add') -->
<!-- check: count('#list li') === 3 && text('#left') === '2' && document.getElementById('draft').value === '' -->
<!-- check: click('#list li button') -->
<!-- check: count('#list li') === 2 && location.href === 'about:srcdoc' -->

## What is checked when

| Moment | Checked | Where the error goes |
|---|---|---|
| `Observable.create()`, assignment, `$set`, `push`/`splice`/index write | arrow methods (at any depth), reserved names (`toJSON`, `$on`, ...), frozen data, model inside model, shared arrays, `delete` | thrown to your code; nothing changes |
| `bind()` | attribute syntax; every path exists on the model; handlers outside lists; `$root.` paths and handlers in row templates (and `$parent.` in a top-level list); list attributes; one-root templates; keys of the rows present now; `data-attr` values; element already bound | thrown by `bind()`; nothing stays bound |
| first render of each row (an empty list defers it) | row field paths, bare handler names inside rows, `$parent.` inside nested lists | thrown by `bind()` if the row exists at bind; else `Stitch.onError` |
| reading a computed | a write or a list/Map/Set change inside it (E724, E725) | to whoever read it: your code, `bind()`, or `Stitch.onError` for a binding |
| later update (push, assignment, recompute, click, a handler's rejected promise) | keys of new rows, `data-foreach` gets a non-array, refused `data-attr` values, a computed or handler that throws or rejects, a `$watch` re-running itself (E912) | `Stitch.onError`; uncaught (or an unhandled rejection) without it; the DOM keeps its last good state |
| user typing | writing through a `null` object (`address.city` while `address` is `null`) | `Stitch.onError`, E314 |

A `<select data-value>` whose chosen option leaves its list clears the choice: the model gets the
placeholder's value (or `null`). Not errors (silent): an unknown `data-*` attribute; `data-visible`
on an element also hidden by `hidden` or a stylesheet class (stays hidden); `data-value` on a
non-form element.

## Where to read more

| Doing | Read |
|---|---|
| Building a list, table, tree, filter or sort, master-detail, form, select, cascading selects, inputs of any type, nested lists with group subtotals, handlers in nested lists, events, error handling, custom binding, links and attributes, loading data, teardown | `references/recipes.md` (its index gives each recipe's line; read only that one) |
| Writing anything from memory of Vue, Alpine, Knockout, React or jQuery; reviewing a page before shipping; a silent wrong result (nothing on screen, stale list, page reload) | `references/gotchas.md` |
| Fixing an error `[Stitch E###]` | `references/errors.md` (look up the code) |
| Exact attribute grammar, which value each binding accepts, model helpers, `Stitch.*` signatures | `references/grammar.md` |

## When something throws

1. Read the code after `[Stitch` and the element shown after it (`<span data-text="nmae">`).
2. Look the code up in `references/errors.md`; apply the fix the message names.
3. Never wrap `bind()` in `try`/`catch` to hide errors. Match errors by code
   (`error.message.startsWith('[Stitch E201]')`), never by wording.
