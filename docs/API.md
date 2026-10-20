# Stitch.js API reference

Every public name in Stitch.js v3: what it takes, what it returns, and when it throws. For how to use
them together, read the [Guide](GUIDE.md); for every error message, its cause and its fix, read the
[error reference](ERRORS.md).

The test suite checks this page against the code in both directions: every public name has a
heading here, and every heading names something that exists. Every `run` and `throws` example is
executed.

**Names used on this page**

| Name | Means |
|---|---|
| `model` | an object returned by `Stitch.Observable.create()`, or any object, list, Map or Set inside it |
| `binder` | an instance of `Stitch.DataBinder` |
| `bus` | an instance of `Stitch.MessageBus` |
| `reactiveSystem` | the object a custom binding receives as `context.reactiveSystem` |
| path | a property path: names of letters, digits, `_` and `$` joined by dots (`user.name`, `items.0.title`, `$root.rate`) |

**Error messages** start with a stable code, `[Stitch E###]`, then name the element and binding
involved, for example `[Stitch E201] <span data-text="nmae">: "nmae" is not a property of the model.
...`. Codes are public API: a code keeps its meaning and is never reused. The
[error reference](ERRORS.md) is keyed by code. This page leaves the prefix out.

## Contents

- [The Stitch global](#the-stitch-global)
- [Models: Stitch.Observable](#models-stitchobservable)
- [Model helpers](#model-helpers)
- [Stitch.DataBinder](#stitchdatabinder)
- [Bindings](#bindings)
- [List attributes](#list-attributes)
- [Row context](#row-context)
- [Errors and the bind report](#errors-and-the-bind-report)
- [Diagnostics](#diagnostics)
- [Stitch.MessageBus](#stitchmessagebus)
- [ReactiveSystem (for custom bindings)](#reactivesystem-for-custom-bindings)

## The Stitch global

Loading `stitch.js` (or `stitch.min.js`) defines `window.Stitch` with exactly these members:
`Observable`, `DataBinder`, `MessageBus`, `computed`, `version`, `debug`, `onError`, `onBindReport`.
Under CommonJS, `require('./stitch.js')` returns the same object.

### `Stitch.version`

The library version: the `version` string of the release (major.minor.patch).

### `Stitch.computed(config)`

Makes a computed property for a model. Put the result in the data you pass to
`Stitch.Observable.create()` (at any depth, including inside list rows).

- `config`: a function, or `{ get: function, deps: [names] }`. The function is called with the
  object that holds the computed (the model, a nested object or a row) both as `this` and as its
  first argument, and returns the value. Use `this` with `function` / method syntax, or the
  argument with an arrow function (`m => m.price * m.qty`): an arrow function's `this` is never the
  model.
- Returns: a marker object that `Observable.create()` turns into a read-only property.
- Throws: if `config` is neither form, or `deps` is not an array.
- There is no setter: in the object form only `get` and `deps` are read (any other key, such as
  `set`, is ignored), and assigning to the property throws (E713).

The property is lazy (computed on first read, recomputed after a dependency changes and it is read
again), read-only (assigning throws `Cannot set computed property`), and a computed nothing reads
stops listening. Dependencies are tracked automatically; `deps` also reads the named properties
up front.

```js run
const model = Stitch.Observable.create({
    first: 'Ada', last: 'Lovelace',
    full: Stitch.computed(function () { return this.first + ' ' + this.last; }),
    initials: Stitch.computed(m => m.first[0] + m.last[0])
});
```
<!-- check: model.full === 'Ada Lovelace' && model.initials === 'AL' -->

## Models: Stitch.Observable

### `Stitch.Observable`

The namespace for creating and inspecting models. All members are static.

### `Stitch.Observable.create(data, options)`

Makes `data` a model and returns it.

- `data`: a plain object. It is converted in place (the returned model is `data` itself) together
  with everything inside it: nested objects, arrays, `Map`s, `Set`s, `Stitch.computed()` markers.
- `options` (optional): `{ isolated: true }` gives the model its own reactive system instead of the
  page-wide shared one. No other option exists.
- Returns: the model. It has the [model helpers](#model-helpers), including `$watch`.

Throws when:

- `data` is not an object, is already a model, or is an object inside a model ("already belongs to
  a model");
- `options` has an unknown key (there is no `debug` option);
- a method is an arrow function (write `name() {}`);
- a field uses a reserved name (`toJSON` or a `$` helper name);
- `data` contains another model, or an array, Map or Set that already belongs to another model;
- `data`, or an object inside it, is frozen, sealed or not extensible (E714: pass a copy, such as
  `structuredClone(data)`). The same check runs when such data is assigned, pushed or put in a
  Map or Set later.

Every property a binding reads must be in `data` from the start; `null` is a fine starting value.
Properties whose names start with `_` are not made reactive.

### `Stitch.Observable.createArray(items, options)`

Makes a model whose root is an array.

- `items`: an array; it is copied (`[...items]`), then converted.
- `options`: as for `create`.
- Returns: the reactive array. It has the event helpers (`$on`, `$emit`, ...) but no `$watch`.
- Throws: if `items` is not an array, or for the same content reasons as `create`.

### `Stitch.Observable.reactive(object, options)`

Makes `object` (an object, array, `Map` or `Set`) a model root in place, like `create` but without
`$watch`. Returns `object` (for a `Map`, `Set` or array, its reactive proxy). A root model passed in
is returned as is; an object that is inside a model throws ("already belongs to a model").

### `Stitch.Observable.computed(config)`

The same function as [`Stitch.computed(config)`](#stitchcomputedconfig).

### `Stitch.Observable.isReactive(value)`

Returns `true` for a model and for any object, array, `Map` or `Set` inside one, and `false` for
anything else (including `null` and `undefined`).

### `Stitch.Observable.toRaw(value)`

Returns a deep plain copy of a model or of any part of one: objects, arrays, `Map`s, `Set`s and
`Date`s are copied, computeds become their current values, fields starting with `_` are left out,
and class instances that are not model data are kept as they are. A value that is not reactive is
returned unchanged. Use it to send model data to a server, or to start a separate model from the
data of another one (`Stitch.Observable.create(Stitch.Observable.toRaw(cart))`).

### `Stitch.Observable.reset()`

Replaces the page-wide shared reactive system with a fresh one, for tests. Models created before
keep the old system; models created after use the new one. Do not bind models from before and after
a reset with the same binder.

## Model helpers

Stitch defines these on every object, list, `Map` and `Set` of a model. They are hidden: they do not
appear in `Object.keys()` or in JSON, and a binding cannot name them. Their names are reserved: a
data field called `toJSON` or `$`-anything from this list throws.

### `model.$onChange(fn)`

Calls `fn(change)` after every write to this object (or list, Map, Set).

- `change`: `{ field, oldValue, newValue, target }`. Writes to the object's own properties are
  reported synchronously. Writes further down are reported afterwards (in a microtask) with a dotted
  `field` (`'user.name'`) and `nestedChange: true`. A list mutation reports
  `{ field: 'items', action: 'push', args, target }` on the list, and `'<list>.items'` on its
  ancestors.
- Returns: a function that removes the handler (safe to call twice). `$offChange(fn)` removes it too.
- Throws: `fn` is not a function; a string is passed (use `$on` for events); more than one argument.
- An error thrown by `fn` goes to [`Stitch.onError`](#stitchonerrorfn); the write and the other
  handlers are not affected.

### `model.$offChange(fn)`

Removes a change handler added with `$onChange`. Throws if `fn` is missing, not a function, a string,
or not installed on this object. There is no "remove all".

### `model.$on(event, callback)`

Subscribes `callback(payload)` to the named event. **Root model only.**

- Returns: a function that unsubscribes (safe to call more than once).
- Throws: on anything but the root model ("events live on the root model"); a function as the first
  argument (use `$onChange` for change handlers); swapped arguments; not exactly two arguments; an
  empty event name; a callback that is not a function.

### `model.$off(event, callback)`

Unsubscribes `callback` from `event`, whether it was added with `$on` or `$once`. **Root model
only.** Throws if it is not subscribed, or without both arguments (`$offChange` removes change
handlers).

### `model.$emit(event, payload)`

Delivers `payload` to every subscriber of `event`, in a microtask. **Root model only.** An error in a
subscriber goes to `Stitch.onError` and does not stop the other subscribers.

### `model.$once(event, callback)`

Like `$on`, but the callback runs once, then is unsubscribed (even if it throws). Returns a
function that cancels it. **Root model only.**

### `model.$use(middleware)`

Adds a middleware to the root model's event channel; see [`bus.use`](#bususemiddleware).
**Root model only.**

### `model.$get(path)`

Returns the value at `path` (dots for nested properties). A `null` or `undefined` step gives
`undefined`. Throws if a name on the path is not a property of the object it is read from, or if
`path` is not a property path.

### `model.$set(path, value)`

Writes `value` at `path`.

- A single name that the object does not have yet becomes a new **reactive** property. This is the
  way to add a property after `Observable.create()` (plain assignment adds one that bindings cannot
  follow).
- An existing path is written like a plain assignment.
- Throws: `path` is not a non-empty string; a dotted path that does not exist; a reserved name.

### `model.$watch(path, callback, options)`

Calls `callback(newValue, oldValue, info)` whenever the value at `path` changes, where
`info = { key, newValue, oldValue, target }`. Only on the model `Observable.create()` returned.

- Runs synchronously after each change; with `options = { batch: true }`, once per batch (in a
  microtask) with the latest value.
- Returns: a function that stops the watch for good and releases it (safe to call twice).
- Throws: `path` names a property that does not exist or is not reactive; `callback` is not a
  function.

### `model.toJSON()`

Returns a plain object of the enumerable data (computeds included as values, `_` fields left out).
`JSON.stringify(model)` calls it. For a deep copy you can keep using, use
[`Stitch.Observable.toRaw`](#stitchobservabletorawvalue).

### v2 helper names

In v2 these helpers had plain names. In v3, where no data field has the name, calling (or assigning
to) the old name throws a `TypeError` that names the new one. A data field called `on`, `off`,
`get` or `set` is ordinary data. Note that `'on' in model` is `true` because of this hidden
migration helper.

#### `model.on()`

Now `model.$onChange(fn)`.

#### `model.off()`

Now `model.$offChange(fn)`.

#### `model.get()`

Now `model.$get(path)`. On a `Map`, `get` is the `Map`'s own method.

#### `model.set()`

Now `model.$set(path, value)`. On a `Map`, `set` is the `Map`'s own method.

```js throws
const model = Stitch.Observable.create({ count: 0 });
model.on(function (change) {});
```
Throws: `.on() is now .$onChange() in Stitch v3`

## Stitch.DataBinder

### `new Stitch.DataBinder(hooks)`

Creates a binder. One binder can bind several roots (each once).

`hooks` (optional) may contain only:

- `onBind(element, context, bindings)`: called after each element's bindings are applied, with
  `this` = the binder. `bindings` is `[{ type, path, attributeName }]`.
- `onChange(change, model, root)`: called for every change of the bound model (it is a model change
  handler; errors go to `Stitch.onError`).
- `properties`: `{ propertyName: { onBind, onChange } }`. Matched by the last name of a binding's
  path (or its full path). `onBind(element, value, binding, fullPath)` **replaces** the binding: the
  built-in behaviour is not applied, the hook renders instead. `onChange(element, newValue, oldValue,
  binding, fullPath)` runs once at bind and after every change of that property.

Throws on an unknown hook name, a hook that is not a function, or a malformed `properties` object.

### `binder.bind(root, model)`

Binds `root` and every element inside it to `model`.

- `root`: an element, or a CSS selector for one.
- `model`: a model from `Stitch.Observable.create()`.
- Returns: `undefined`. When it returns, the page shows the model (the first render is synchronous).

Before binding anything it checks every binding: the attribute syntax, that each path exists on the
model (row paths when each row renders), that handlers can be found, the list rules, and that no
element is already bound. If anything fails, it throws and releases everything this call created.
Elements inside a `data-foreach` element are bound per row by the list.

Throws: the binder was disposed; `root` matches nothing or is not an element; `model` is not a
model; `root` or an element inside it is already bound (by this or another binder; `unbind()`
first); any binding error (see [ERRORS.md](ERRORS.md)).

### `binder.unbind(element)`

Releases every binding on `element` and inside it: effects stop, listeners are removed, list rows are
released. The DOM is left as it is. `element` is an element or a selector. Every cleanup runs; if
one throws, the first error is thrown afterwards.

Throws: the binder was disposed; nothing matches; nothing inside `element` was bound by this binder.

### `binder.dispose()`

Releases everything this binder bound. Calling it again does nothing. Afterwards `bind()` and
`unbind()` throw: create a new binder. Every cleanup runs; if one throws, the first error is thrown
afterwards.

### `Stitch.DataBinder.registerBinding(name, handler)`

Adds the attribute `data-<name>` for every binder on the page.

- `name`: lowercase letters, digits and dashes (`tooltip`, `date-format`). Not a built-in binding,
  not already registered, not `key`, `template`, `default-text`, `default-value` or `type`.
- `handler.bind(element, model, value, context)`: called once per element at bind. `model` is the
  model, or the row context inside a list. `context` is `{ reactiveSystem, binder }`.
- `handler.value`: `'path'` (default) or `'literal'`. With `'path'`, the attribute value is a property
  path, checked like every binding (it must exist), and `value` is that path. With `'literal'`,
  `value` is the attribute text as written, and nothing is looked up.
- Must be called before the first `bind()` on the page.
- When a `'path'` binding's value is not a property path, or names a property the model does not
  have, the error ends with how to register it as `'literal'` (the usual cause is text such as
  `data-tooltip="Save changes"`).
- `type` is reserved too (`data-type` configures `data-value`).
- Throws if any rule above is broken.
- **Safety is yours.** A custom binding writes to the page with your code, so the checks of the
  built-in bindings do not cover it: text only, no `on...` / `srcdoc` / security-sensitive
  attributes, no `javascript:` or `data:` URLs, no binding on `<script>`, `<style>`, `<base>` or
  `<meta>` (see [data-attr](#data-attrpath)). Set text with `textContent`, styles with
  `element.style.setProperty`, and never assign data to `innerHTML`.

#### `binder._trackCleanup(element, fn)`

The supported way for a custom binding to register cleanup: `fn` runs when `element` (or an
ancestor) is unbound, its list row is released, or the binder is disposed. Call it as
`context.binder._trackCleanup(element, fn)`. After `dispose()`, new cleanups are ignored.

```html page
<span id="out" data-upper="name"></span>
```

```js run
Stitch.DataBinder.registerBinding('upper', {
    bind(element, model, path, context) {
        const effect = context.reactiveSystem.effect(function () {
            element.textContent = String(model[path]).toUpperCase();
        });
        context.binder._trackCleanup(element, function () { context.reactiveSystem.cleanup(effect); });
    }
});
new Stitch.DataBinder().bind('#out', Stitch.Observable.create({ name: 'ada' }));
```
<!-- check: text('#out') === 'ADA' -->

#### `binder.createHooks(hooks)`

Internal: validates the constructor's `hooks`. Not part of the API; do not call it.

## Bindings

A binding attribute holds exactly one value: a property path (or, for `data-click`, a handler
name). Expressions, calls, object literals and comma-separated options throw at `bind()`.
Every path must exist on the model (or row) when it is bound. Values are read when bound and after
every change; DOM updates run in a microtask.

### `data-text="path"`

Sets the element's `textContent`. `null` and `undefined` show as empty text.

- One-way (model to page). Never interprets HTML.
- Throws: the value is a function (bind a computed instead); the element contains other bound
  elements (their bindings would be destroyed); combined with `data-foreach` on one element.

### `data-value="path"`

Two-way binding for `input`, `textarea` and `select`. The page follows the model; the model follows
the user (on `input` and `change` events).

| Element | Model value |
|---|---|
| text-like inputs, textarea | string |
| `type="number"` | number; `null` when empty or not a number |
| `type="range"` | number (a range always has a value, so never `null`) |
| `type="checkbox"` | boolean |
| `type="radio"` | the checked radio's `value` (put `data-value` on each radio of the group) |
| `type="date"`, `type="datetime-local"` | `Date` or `null` |
| `select` | the selected option's value, always a string (even if the model held a number); use `data-type="int"` for numbers |
| `select multiple` | array of selected values |

If the model holds a value no option of a `select` has, the select shows its placeholder (or its
first option) and the model is left alone until the user picks.

On an `<option>` inside a `<select data-foreach>`, `data-value` sets the option's value. For options
from a list of plain values, leave it out and write `<option data-text="$data">`: an option without
a `value` uses its text. `data-value="$data"` throws (E313): a two-way binding cannot replace the
row itself.

Throws: the path is a computed, a getter without a setter, or a row-context value (`$data`,
`$index`, `$parent`, `$root`, at any depth). Writing through a `null` step (`address.city` while
`address` is `null`) throws when the user types (E314, to `Stitch.onError` if installed); the
input listens to both `input` and `change`, so one edit can report it twice.

### `data-visible="path"`

Shows the element when the value is truthy (`style.display = ''`), hides it otherwise
(`style.display = 'none'`). Showing restores the stylesheet's display, so an element hidden by your
CSS stays hidden.

### `data-enabled="path"`

Sets `element.disabled = !value`.

### `data-class="path"`

- A string: replaces the element's whole `className` (use only on elements with no other classes).
- An object `{ className: boolean }`: adds or removes each listed class; other classes are kept.
- `null` / `undefined`: no change.
- Anything else throws.

### `data-attr="path"`

The value is an object `{ attributeName: value }`. Only the listed attributes are managed:

| Attribute value | Result |
|---|---|
| `null`, `undefined`, `false` | the attribute is removed |
| `true` | the attribute is set to `""` |
| an array | joined with spaces for `class`, commas otherwise |
| an object for `style` | each property set through the CSSOM (`{ fontSize: '12px' }` sets `font-size: 12px`; `--name` custom properties and `!important` are kept); a property the next object no longer lists is removed, and `style: null` removes the ones `data-attr` wrote (others, such as `data-visible`'s `display`, are left alone) |
| any other object | written as JSON |
| anything else | `String(value)` |

A `null` / `undefined` value for the whole binding changes nothing; any other non-object throws.

**Values that could run script are refused.** The values come from data, so `data-attr` checks
every entry of its object before it writes any; if one is refused, it throws (from `bind()`, or to
`Stitch.onError` on a later change) and writes none of them, so the element keeps its last good
state:

| Refused | Code |
|---|---|
| an attribute name starting with `on`, in any case (`onclick`, `ONLOAD`, `onbegin`), whatever the value | E321 |
| `srcdoc` | E322 |
| a `javascript:` or `vbscript:` URL in a URL-bearing attribute | E323 |
| a `data:` URL in a URL-bearing attribute, except `data:image/...` in an `<img>` `src` | E324 |
| `style` as a string or an array (use an object) | E325 |
| a security-sensitive name, whatever the value (`null` too): `sandbox`, `allow`, `allowfullscreen`, `allowpaymentrequest`, `allowusermedia`, `csp`, `credentialless`, `http-equiv`, `integrity`, `crossorigin`, `nonce`, `referrerpolicy`, `is` | E327 |
| `rel` with the token `opener` (other `rel` values, such as `noopener noreferrer`, are written) | E328 |

The URL-bearing attributes are `href`, `src`, `action`, `formaction`, `xlink:href`, `xml:base`,
`poster`, `cite`, `background`, `data`, `codebase`, `classid`, `longdesc`, `lowsrc`, `dynsrc`,
`manifest`, `icon`, `profile`, `usemap`, `srcset`, `imagesrcset`, `ping` and `archive` on any element
(each URL of a `srcset` or `ping` list is checked), and `to`, `from`, `by` and `values` on an SVG
`<animate>` or `<set>`. A URL's scheme is read the way a browser reads it (any case; tabs, newlines
and control characters before or inside it), and also after decoding character references
(`&#106;`, `&#x6A`, `&colon;`) and percent-escapes and removing every invisible character, so the
known evasion forms are refused. Allowed: relative URLs, `#anchor`, `?query`, `http(s):`,
`mailto:`, `tel:`, and any URL whose scheme is not one of the three above. Attributes that are not
URLs (`title`, `aria-*`, `data-*`, ...) take any text. Built-in bindings are not allowed on
`<script>`, `<style>`, `<base>` or `<meta>` at all (E326).

The checks read URL **schemes** only: an `https:` URL to any host is written (a link, an image, a
stylesheet `href`, a form `action`). Which origins a page may load from, frame or submit to is the
page's Content-Security-Policy's job (see the README's browser support section). Attribute **names**
other than the refused ones are written as given (`id`, `name`, `target`, ...): keep the names in
your code (a computed), and let only the values come from data.

### `data-loading="path"`

While the value is truthy: `disabled`, class `loading`, `aria-busy="true"`; otherwise the reverse.

### `data-click="handler"`

Calls a method on click.

- `handler`: `name` (the current row's item; outside a list, the model), `$parent.name` (one level
  up) or `$root.name` (the root model). The name may be dotted (`$root.actions.save`).
- Called as `fn.call(owner, item, event)`: `this` is the object the method is on, `item` is the
  current row's item (outside a list, the model), `event` is the DOM event.
- Looked up at `bind()` (a miss throws and says where the name does exist) and again on every click,
  so a replaced method is used.
- An error in the handler goes to `Stitch.onError` if one is installed; otherwise it is an ordinary
  uncaught error of the click listener.

### `data-event="path"`

The value names a property holding `{ eventName: handler }`. Each `handler` is a handler name
(resolved exactly like `data-click`) or a function (called with `this` = the current item and
arguments `(item, event)`). The object is model data, so a function in it must not be an arrow
function (E707); a handler name is usually simpler. Replacing the object re-registers the listeners.
All entries are checked before any listener changes.

To handle a form's submit, put `data-event` on the `<form>` with `{ submit: 'save' }` and call
`event.preventDefault()` in `save(model, event)`; a `<button>` inside a form submits it (and reloads
the page) unless it has `type="button"`.

Throws: the value is not an object; an entry is neither a name nor a function; a name is not found.

### `data-foreach="path"`

Renders one row per item of the array at `path`. See [Lists in the Guide](GUIDE.md#lists).

- The row template is the element's content (exactly one root element), or the `<template>` named by
  `data-template`.
- Rows are keyed: an object by its `id` (or the field named by `data-key`), a plain value by itself.
  A missing, `null` or duplicate key throws, before the list changes.
- A row is reused when its key and its object are the same; otherwise it is rebuilt. Rows that leave
  are released.
- `null` / `undefined` renders no rows; any other non-array throws.
- Inside a row, paths resolve against the [row context](#row-context).
- On a `<select>`, the rows are the options; see `data-default-text` and `data-value`.
- Bindings on the list element itself are allowed except `data-text`.

## List attributes

These configure a `data-foreach` element. On any other element they throw.

### `data-key="field"`

The field that identifies a row in a list of objects (default `id`). Must not be empty; not allowed
on a list of plain values.

### `data-template="id"`

Takes the row template from `<template id="id">` instead of the element's content. The element
must then be empty (no child elements). The template must hold exactly one root element. A template
may contain a list that uses the same template (a recursive tree).

### `data-default-text="text"`

On a `<select data-foreach>` only: adds a first placeholder option with this text.

### `data-default-value="value"`

The value of the placeholder option (default `""`). Needs `data-default-text`.

### `data-type="type"`

On an element with `data-value`: the conversion between the control's text and the model value.
`int`, `float`, `bool` (or `boolean`), `string`, `date`, `datetime`. Without it, the type follows the
input type (see `data-value`); a `select` always writes back a string. A value that does not convert
becomes `null`.

## Row context

Inside a list row, a binding can name the item's own fields, and these:

### `$data`

The row's item itself. For a list of plain values, `data-text="$data"` (also for `<option>`s of a
`<select>`). It is read-only: `data-value="$data"` throws.

### `$index`

The row's position in the list. It is kept up to date when rows move. Read-only.

### `$parent`

One level up: the model for a top-level list, the enclosing row's context in a nested list. As a
path prefix (`$parent.total`) and as a handler prefix (`$parent.remove`).

### `$root`

The model the outermost list is bound to. As a path prefix (`$root.rate`) and as a handler prefix
(`$root.remove`).

## Errors and the bind report

### `Stitch.onError(fn)`

Installs the page-wide handler for errors raised inside updates (a binding re-rendering, a list
reconciling, a computed, a change handler, an event subscriber, a click or event handler), and
returns a function that removes it. `Stitch.onError(null)` also removes it.

- `fn(error, context)`. `context.source` is `binding`, `watch`, `change-handler`, `handler`,
  `messageBus`, `unbind`, `dispose`, `scheduler`, `effect`, or `unknown` when no context was
  recorded; bindings add `element` and `binding` (`'data-text="label"'`), change handlers add
  `field`, message-bus errors add `event`.
- With no handler installed, such errors are re-thrown uncaught (in a new task), so they reach
  `window.onerror` and the console.
- Errors during `bind()` and other direct calls are thrown to the caller, not passed here.
- Throws: `fn` is neither a function nor `null`; a different handler is already installed.

### `Stitch.onBindReport(fn)`

Installs the page-wide bind report and returns a function that removes it (`null` removes it too).
After every successful `bind()`, `fn({ bound, ignored })` receives every `data-*` attribute in the
bound root (rendered rows included), as `{ element, attribute, value }`: `bound` for Stitch's own
attributes (bindings, list attributes, and `data-type`), `ignored` for all others (a misspelled
`data-txt`, `data-testid`, `data-bs-*`). With no report installed, Stitch never looks at other
`data-*` attributes. Throws like `onError`.

## Diagnostics

### `Stitch.debug`

A frozen object with one member, `stats`. There is no debug mode and nothing to switch on.

### `Stitch.debug.stats()`

Returns a snapshot `{ effects, subscriptions, parentLinks }` of live counts for the whole page:

- `effects`: effects not yet released (about one per live binding, plus watches and custom-binding
  effects).
- `subscriptions`: links from reactive properties and computeds to the effects and computeds that
  read them. Links made by model computeds last as long as the model.
- `parentLinks`: links from model objects to the places that hold them.

The counts go down only through a release: `binder.dispose()`, `unbind()`, rows leaving a list, and
the removers of `$watch`, `$onChange` and custom-binding effects. Effects of a section that was
dropped and garbage-collected without them stay counted (the memory is freed; the count is not). On a
stable page the counts stay flat; counts that grow with every reload or show/hide cycle mean something
is not released, for example a custom binding that does not register its cleanup.

## Stitch.MessageBus

### `Stitch.MessageBus`

A standalone event channel (the same one the root model's `$on` / `$emit` use).
`const bus = new Stitch.MessageBus();`

### `bus.subscribe(event, callback)`

Subscribes `callback(payload)` to `event`. The event `"*"` receives every event as
`callback({ event, payload })`. Returns a function that unsubscribes (safe to call twice). Throws on
an empty event name or a callback that is not a function.

### `bus.unsubscribe(event, callback)`

Removes `callback`. Throws if it is not subscribed to `event`.

### `bus.publish(event, payload)`

Queues the event; subscribers run in a microtask, in order. An error in a subscriber goes to
`Stitch.onError` and does not stop the others. Events that keep publishing each other are stopped
after 100 rounds (reported to `Stitch.onError`).

### `bus.publishSync(event, payload)`

Delivers the event now, before returning. Subscriber errors still go to `Stitch.onError`.

### `bus.use(middleware)`

Adds `middleware(eventData)`, called for every event before delivery with
`{ event, payload, timestamp }`. Return a changed object to change the event, or nothing to keep it.
A middleware that throws drops that one event (the error goes to `Stitch.onError`).

### `bus.clear()`

Drops queued events that have not been delivered yet.

### `bus.flush()`

Delivers the queued events now. `publish` schedules this itself; you do not need to call it.

```js run
const bus = new Stitch.MessageBus();
const seen = [];
const stop = bus.subscribe('saved', function (payload) { seen.push(payload.id); });
bus.publishSync('saved', { id: 7 });
stop();
bus.publishSync('saved', { id: 8 });
```
<!-- check: seen.join(',') === '7' -->

## ReactiveSystem (for custom bindings)

A custom binding receives the model's reactive system as `context.reactiveSystem`.

### `reactiveSystem.effect(fn, options)`

Runs `fn` now and again whenever a reactive value it read changes. Returns the effect; release it
with `cleanup(effect)` (register that with `context.binder._trackCleanup`).

- `options.batch: true` re-runs it once per batch, in a microtask (bindings use this);
  otherwise it re-runs synchronously after each change.
- `options.lazy: true` does not run it now.
- If the first run throws, the effect is released and the error is thrown. Errors in later runs go
  to `Stitch.onError`.
- Throws if the system was disposed.

### `reactiveSystem.cleanup(effect)`

Releases the effect for good: it stops running and drops every subscription. Safe to call twice.

### `reactiveSystem.untracked(fn)`

Runs `fn` and returns its result without subscribing the running effect to what `fn` reads.

### `reactiveSystem.stats()`

`{ effects, subscriptions }` for this system only.

### `reactiveSystem.dispose()`

Releases this system's whole reactive graph: every effect stops, every subscription is dropped.
Models keep their values but nothing reacts any more, and `effect()` throws afterwards. It is
reachable only from a custom binding, on purpose: tearing down a page section is
`binder.dispose()`, plus the removers of any `$watch`, `$onChange` and `$on` you installed. After
that nothing outside the model refers to it, and it is garbage-collected when your code drops it.

### Internal members

These exist on the reactive system but are not part of the API. Do not use them.

#### `reactiveSystem.track()`

Internal: records that the running effect read a property.

#### `reactiveSystem.trigger()`

Internal: re-runs the effects that read a property.

#### `reactiveSystem.currentEffect`

Internal: the effect running now, or `null`.
