# AGENTS.md: building pages with Stitch.js v3

Rules for an AI agent (or a person in a hurry) writing a page with Stitch.js. Follow them exactly.
Each rule is enforced: breaking one throws an error that names the element, the binding and the
fix. Details: [docs/GUIDE.md](docs/GUIDE.md), [docs/API.md](docs/API.md),
[docs/ERRORS.md](docs/ERRORS.md).

## A minimal correct page

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
        <input id="new-task" data-value="draft">
        <button id="add" data-click="add" data-enabled="canAdd">Add</button>
        <p><span id="left" data-text="remaining"></span> left</p>
        <ul data-foreach="tasks">
            <li>
                <input type="checkbox" data-value="done">
                <span data-text="title"></span>
                <button data-click="$root.remove">x</button>
            </li>
        </ul>
        <p id="empty" data-visible="isEmpty">Nothing to do.</p>
    </div>
    <script>
        Stitch.onError(function (error, context) {
            // Errors raised during later updates arrive here (with no handler they are uncaught).
            document.title = 'Error: ' + error.message;
        });

        let nextId = 3;
        const model = Stitch.Observable.create({
            draft: '',
            tasks: [
                { id: 1, title: 'Write the report', done: false },
                { id: 2, title: 'Send the invoice', done: true }
            ],
            canAdd: Stitch.computed(function () { return this.draft.trim() !== ''; }),
            remaining: Stitch.computed(function () { return this.tasks.filter(t => !t.done).length; }),
            isEmpty: Stitch.computed(function () { return this.tasks.length === 0; }),
            add(model, event) {
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
<!-- check: text('#left') === '1' && count('#app li') === 2 && visible('#empty') === false -->
<!-- check: type('#new-task', 'Call the bank') -->
<!-- check: click('#add') -->
<!-- check: count('#app li') === 3 && text('#left') === '2' && document.getElementById('new-task').value === '' -->
<!-- check: click('#app li button') -->
<!-- check: count('#app li') === 2 -->

## Rules

### Model

1. Create the model with `Stitch.Observable.create({ ... })` and bind it once:
   `new Stitch.DataBinder().bind('#root', model)`. Load `stitch.js` before your script, and run your
   script after the elements exist.
2. Declare every property any binding reads, in `Observable.create()`, with a starting value. Use
   `null` when there is no value yet. A binding to a missing property throws.
3. Normalize data you did not write before creating the model: if some rows lack a field the
   template binds (for example leaves of a tree without `children`), add it (`children: []`,
   `email: null`).
4. Add a property after creation only with `model.$set('name', value)`. Plain assignment of a new
   property is not reactive.
5. Never `delete` a model property: set it to `null`. Remove list items with `splice`, Map/Set
   entries with `.delete(key)`.
6. Write methods as `name() { ... }`, never as arrow functions. In a method, `this` is the object
   the method is on.
7. Do not name data fields `toJSON` or `$on`, `$off`, `$onChange`, `$offChange`, `$get`, `$set`,
   `$emit`, `$once`, `$use`, `$watch`. Fields named `on`, `off`, `get`, `set` are fine.
8. One model is one root. Never put a model inside another model: assign plain data, or
   `Stitch.Observable.toRaw(otherModel)` (a deep plain copy).
9. Never give two models the same array, Map or Set. Copy shared lookup data per model:
   `[...countries]`, `new Map(rates)`, `new Set(codes)`.
10. Do not pass frozen objects to `Observable.create()`; it converts data in place. Copy first.

### Bindings

11. Only these bindings exist: `data-text`, `data-value`, `data-visible`, `data-enabled`,
    `data-class`, `data-attr`, `data-loading`, `data-click`, `data-event`, `data-foreach`, plus the
    list attributes `data-key`, `data-template`, `data-default-text`, `data-default-value` and the
    input conversion `data-type`. Do not invent others (`data-if`, `data-show`, `data-html`,
    `data-for`, `data-model` do not exist; they are silently ignored as not Stitch's).
12. A binding value is ONE property path: `name`, `user.email`, `items.0.title`, `$root.total`.
    Never an expression, a call, a comparison, a negation, a template or an object literal. Put any
    logic in a computed: `isOpen: Stitch.computed(function () { return !this.closed; })`, then
    `data-visible="isOpen"`.
13. One binding per attribute. Two bindings on one element use two attributes.
14. There is no HTML binding. `data-text` sets text only. Build structure with `data-foreach`, or
    with a custom binding that creates elements; never insert HTML strings built from data.
15. `data-text` must not be on an element that contains other bound elements; put the text in its
    own `<span>`.
16. `data-value` must name a writable property: not a computed, not `$index` / `$data` / `$parent` /
    `$root`. To write through a nested object (`address.city`), that object must not be `null`.
17. `data-class` takes a class string (replaces all classes) or `{ className: boolean }`.
    `data-attr` takes `{ attributeName: value }`. Both usually come from a computed.
18. Number inputs give numbers (`null` when empty or invalid). A `<select>` gives strings; add
    `data-type="int"` for numbers. Checkboxes give booleans.

### Lists

19. Every object row needs a unique `id`. If the identifying field has another name, put
    `data-key="thatField"` on the list element. Plain values (strings, numbers) are their own key and
    must be unique. Missing or duplicate keys throw.
20. A row template is exactly ONE root element. Wrap several elements in one `<div>`, `<li>` or
    `<tr>`.
21. Inside a row, a bare name is a field of the row's item. Use `$root.name` for the model,
    `$parent.name` for one level up, `$data` for the item itself, `$index` for its position.
22. For a recursive tree, use `data-template="tpl-id"` on the list and a `<template id="tpl-id">`
    whose root element contains another list with the same `data-template`. Every node needs every
    field the template binds (including `children: []` on leaves).
23. Filter and sort with a computed that returns a new array. Copy before sorting:
    `this.items.slice().sort(...)`; `sort()` on the model's own array reorders the model.
24. `data-foreach` takes an array, `null` or `undefined`. Anything else throws.
25. For a `<select>`, put `data-foreach` on the select, `<option data-value="code" data-text="name">`
    in the template, `data-value` on the select for the selection, and optionally
    `data-default-text` for a placeholder.

### Handlers

26. `data-click="name"` looks the name up on the current row's item (outside a list: the model).
    Methods live on the model, so from inside a row write `data-click="$root.name"`.
27. A handler is called as `handler(item, event)`, with `this` = the object it is on. `item` is the
    row's item; outside a list it is the model itself. The event is the SECOND argument.
28. `data-event="prop"` names a model property holding `{ eventName: 'handlerName' }`, e.g.
    `{ input: 'touch', blur: 'validate' }`. Handler names resolve like `data-click`.

### Events, changes, errors

29. `$on(event, callback)`, `$off(event, callback)`, `$emit(event, payload)` and `$once` exist only on
    the root model. Never call them on a nested object or a row.
30. `obj.$onChange(fn)` reports writes to `obj`; remove with `obj.$offChange(fn)`. `model.$watch(path, fn)`
    watches one path and cannot be stopped; prefer computeds and bindings.
31. Install `Stitch.onError(fn)` once per page. Errors in later updates (list re-renders, computeds,
    handlers) go there; without it they are uncaught. Errors in `bind()` are thrown to your code.
32. There is no debug mode. `Stitch.onBindReport(fn)` lists bound and ignored `data-*` attributes;
    `Stitch.debug.stats()` gives live counts.
33. Register custom bindings with `Stitch.DataBinder.registerBinding(name, handler)` BEFORE the first
    `bind()`. Use `value: 'literal'` when the attribute holds text, not a property path.

### Timing

34. `bind()` renders synchronously. After that, a model change reaches the page in a microtask.
    To read the page after a change in code or a test, `await Promise.resolve()` (or a
    `setTimeout(..., 0)`) first.
35. Bind each element once. To rebind, `binder.unbind(root)` first; when the section goes away,
    `binder.dispose()`.

## When something throws

Read the message: it names the element (`<span data-text="nmae">`), what is wrong, what exists, and
the fix. Look it up in [docs/ERRORS.md](docs/ERRORS.md) by a few words of the message. Do not catch
and hide Stitch errors.
