# Stitch.js error reference

Every error Stitch.js v3 throws, keyed by its code, with its cause and its fix. The test suite checks
this page against the code in both directions: every code thrown by the library has an entry here,
every entry's code is thrown, a code is never used for two different errors, and each entry's
Message line is the message the library builds. The examples are executed.

**Codes.** Every Stitch error message starts with a stable code: `[Stitch E201] <span
data-text="nmae">: "nmae" is not a property of the model. ...`. Codes are public API: they are grouped
by area (the first digit), numbered once and never reused. Match on the code, not on the wording:
`error.message.startsWith('[Stitch E201]')`. Errors about a binding name the element and the
attribute after the code.

**Message lines** below leave out the code prefix and the element, and write `…` for every part
that is filled in at run time (a name, a value, a list). Search this page for the code, or for a
few words of the message.

**When a message appears.** Mistakes found by a call you make (`bind()`, `Observable.create()`,
`$on()`, ...) are thrown to your code. Mistakes found later, inside an update (a list re-rendering,
a computed, a change handler, an event subscriber, a click handler), go to the handler installed
with `Stitch.onError(fn)`; with none installed they are re-thrown as uncaught errors. See
[Errors in the Guide](GUIDE.md#errors).

One error comes from the browser, not from Stitch: a `TypeError` from `delete model.x` in
strict-mode code. Its text depends on the browser: `Cannot delete property '…' of #<Object>`
(Chrome, Edge), `property "…" is non-configurable and can't be deleted` (Firefox), `Unable to
delete property.` (Safari). Model properties cannot be deleted; set them to `null` instead.

## Contents

- [E1xx: Binding syntax](#e1xx-binding-syntax)
- [E2xx: Missing and non-reactive properties](#e2xx-missing-and-non-reactive-properties)
- [E3xx: Binding values and two-way bindings](#e3xx-binding-values-and-two-way-bindings)
- [E4xx: Handlers](#e4xx-handlers)
- [E5xx: Lists](#e5xx-lists)
- [E6xx: DataBinder and custom bindings](#e6xx-databinder-and-custom-bindings)
- [E7xx: Models and computed properties](#e7xx-models-and-computed-properties)
- [E8xx: Model helpers, events and the message bus](#e8xx-model-helpers-events-and-the-message-bus)
- [E9xx: Error hooks, update loops and internal errors](#e9xx-error-hooks-update-loops-and-internal-errors)

## E1xx: Binding syntax

A binding attribute names one property path (or, for `data-click`, one handler). Thrown by `bind()`, naming the element and the attribute. For a custom binding (registered with `registerBinding`), every E1xx path error ends with how to register the binding as literal, since text in the attribute is the usual cause.

[E101](#e101-empty-binding-value) · [E102](#e102-expression-in-a-binding) · [E103](#e103-object-literal-in-a-binding) · [E104](#e104-function-call-in-a-binding) · [E105](#e105-several-bindings-in-one-attribute) · [E106](#e106-not-a-property-path) · [E107](#e107-not-a-property-path-model-helpers) · [E108](#e108-handler-is-not-a-name) · [E109](#e109-handler-prefix-without-a-name) · [E110](#e110-two-scope-prefixes-in-a-handler)

### E101: Empty binding value

**Message:** `the value is empty. Give the name of a model property, e.g. data-text="name".`

**Cause:** The attribute has no value (`data-text=""`).

**Fix:** Write the name of a model property, or remove the attribute.

### E102: Expression in a binding

**Message:** `an expression is not supported; a binding names a property. Put the expression in a computed, e.g. isOpen: Stitch.computed(function () { return !this.closed; }), and bind data-visible="isOpen".`

**Cause:** The value is an expression (`!done`, `a + b`, `x ? y : z`, `count > 0`). Bindings name properties; they do not evaluate code. For a custom binding (one registered with `registerBinding`), the message adds how to register it as literal, because text such as `data-tooltip="Save changes"` is the usual cause.

**Fix:** Make a computed property that returns the value and bind its name.

```html page
<p id="app" data-visible="!done">Working</p>
```

```js throws
const model = Stitch.Observable.create({ done: false });
new Stitch.DataBinder().bind('#app', model);
```
Throws: `[Stitch E102]`

### E103: Object literal in a binding

**Message:** `an inline object is not supported; a binding names a property. Put the object on the model (a computed if it changes), e.g. rowClasses: Stitch.computed(function () { return { active: this.on }; }), and bind its name: data-class="rowClasses".`

**Cause:** The value is an object literal (`data-class="{ active: isActive }"`).

**Fix:** Put the object on the model, as a computed if it changes, and bind its name: `data-class="rowClasses"`.

### E104: Function call in a binding

**Message:** `a call is not supported; a binding names a property. Make the value a computed and bind its name.`

**Cause:** The value calls a function (`data-text="format(price)"`).

**Fix:** Make a computed that returns the formatted value and bind its name.

### E105: Several bindings in one attribute

**Message:** `an attribute holds exactly one binding with no options. Split it into separate attributes, e.g. data-value="city" data-visible="hasCity".`

**Cause:** The value holds options or more bindings (`data-value="city, visible: hasCity"`), a v2 style.

**Fix:** Use one attribute per binding: `data-value="city" data-visible="hasCity"`.

### E106: Not a property path

**Message:** `this is not a property path. Use names of letters, digits, _ and $ joined by dots, e.g. user.name or items.0.title.`

**Cause:** The value contains characters a path cannot have (`user..name`, `items[0]`).

**Fix:** Use names of letters, digits, `_` and `$` joined by dots: `items.0.title`.

### E107: Not a property path (model helpers)

**Message:** `"…" is not a property path. Use a dot-separated name such as "user.name"; an inline object is not supported.`

**Cause:** `$get()`, `$set()` or `$watch()` received something that is not a property path, such as an object literal.

**Fix:** Pass a dotted name such as `"user.name"`.

### E108: Handler is not a name

**Message:** `…. A handler is a bare name (on the current row; the model outside a list), $parent.name or $root.name; it is called with the row item and the event.`

**Cause:** The handler value is not a name. One code covers every such case; the first sentence of the message says which one, using the same wording as the path-syntax errors: an empty value (E101), an expression such as `!ok` (E102), an object literal (E103), a call such as `save()` or `remove(item)` (E104), several values or options (E105), or characters a name cannot have (E106).

**Fix:** Name the method only: `data-click="save"`. It is called with `(item, event)`, so it does not need arguments in the attribute.

### E109: Handler prefix without a name

**Message:** `"…" names a scope but no handler. A handler is a bare name (on the current row; the model outside a list), $parent.name or $root.name; it is called with the row item and the event.`

**Cause:** The value is only `$parent` or `$root`.

**Fix:** Add the method name: `$root.save`.

### E110: Two scope prefixes in a handler

**Message:** `"…": only one scope prefix is allowed, and only $parent. or $root. For a handler more than one level up, put it on the root model and use $root.name. A handler is a bare name (on the current row; the model outside a list), $parent.name or $root.name; it is called with the row item and the event.`

**Cause:** The handler uses `$parent.$parent.name`, `$data.name` or another `$` name after the prefix. Only one `$parent.` or `$root.` is allowed.

**Fix:** Put the method on the root model and use `$root.name`.

## E2xx: Missing and non-reactive properties

Every property a binding reads must exist on the model (or row) when it is bound. A property added later by plain assignment is not reactive, so a binding could never follow it. For a custom binding, these errors also end with how to register the binding as literal.

[E201](#e201-a-binding-names-a-property-the-model-does-not-have) · [E202](#e202-a-path-walks-through-a-plain-value) · [E203](#e203-a-binding-names-a-property-that-is-not-reactive) · [E204](#e204-watch-get-or-set-names-a-property-the-model-does-not-have) · [E205](#e205-watch-names-a-property-that-is-not-reactive)

### E201: A binding names a property the model does not have

**Message:** `"…" is not a property of …. … has: …. …Declare every bound property in Observable.create() with a starting value (null is fine): a property added later is not reactive. Or fix the binding.`

**Cause:** The path names a property that the model (or the object the path walks through, or the current row) does not have. Often a typo, or a field that some data rows lack. The message lists the names that do exist and suggests a close one. For a custom binding, the message adds how to register it as literal (a one-word text such as `data-tooltip="Save"` is reported as a missing property).

**Fix:** Fix the name, or declare the property in `Observable.create()` with a starting value (`null` is fine). For rows from a server, add missing fields before creating the model.

```html page
<span id="app" data-text="nmae"></span>
```

```js throws
const model = Stitch.Observable.create({ name: 'Ada' });
new Stitch.DataBinder().bind('#app', model);
```
Throws: `[Stitch E201]`

### E202: A path walks through a plain value

**Message:** `"…" is not a property of …, which is …. Fix the path, or make that value an object.`

**Cause:** A step of the path is a string, number or boolean, so it has no properties (`data-text="name.first"` where `name` is a string).

**Fix:** Fix the path, or make that value an object.

### E203: A binding names a property that is not reactive

**Message:** `"…" is not reactive: …`

**Cause:** The property exists but has no reactive accessor: its name starts with `_` (never made reactive), or it was added after `Observable.create()` by plain assignment.

**Fix:** Rename it without the `_`, or declare it in `Observable.create()`, or add it with `model.$set(name, value)`.

### E204: $watch, $get or $set names a property the model does not have

**Message:** `…: "…" is not a property of … (it has: …). Declare it in Observable.create() with a starting value (a property added later is not reactive), or fix the name.`

**Cause:** The path given to `$watch()`, `$get()` or `$set()` (dotted form) names a property that does not exist.

**Fix:** Fix the name, or declare the property in `Observable.create()`. To add a new property, call `$set(name, value)` with a single name.

### E205: $watch names a property that is not reactive

**Message:** `…: "…" is not reactive (…), so it could never be followed.`

**Cause:** `$watch()` names a property that starts with `_` or was added after `Observable.create()`; the watch would never fire.

**Fix:** Declare the property in `Observable.create()` (or add it with `$set`), without a leading `_`.

## E3xx: Binding values and two-way bindings

Thrown by `bind()` when the first value is wrong, and passed to `Stitch.onError` when a later value is wrong (the page keeps its last good state). `data-value` writes the user's input back, so its path must be writable. E321-E327 are the values that could make the page run script or lift a restriction: `data-attr` checks every entry of its object first and writes none of them if one is refused.

[E301](#e301-data-text-bound-to-a-function) · [E302](#e302-data-class-value-of-the-wrong-kind) · [E303](#e303-data-attr-value-of-the-wrong-kind) · [E304](#e304-data-event-value-of-the-wrong-kind) · [E305](#e305-data-event-entry-of-the-wrong-kind) · [E311](#e311-data-value-on-a-computed) · [E312](#e312-data-value-on-a-read-only-getter) · [E313](#e313-data-value-on-a-row-context-value) · [E314](#e314-writing-through-a-null-object) · [E321](#e321-event-handler-attribute-from-data) · [E322](#e322-srcdoc-from-data) · [E323](#e323-javascript-or-vbscript-url-from-data) · [E324](#e324-data-url-from-data) · [E325](#e325-style-string-from-data) · [E326](#e326-binding-on-a-script-style-base-or-meta-element) · [E327](#e327-security-sensitive-attribute-from-data) · [E328](#e328-relopener-from-data) · [E329](#e329-rel-protection-from-the-markup-dropped-by-data)

### E301: data-text bound to a function

**Message:** `"…" is a function; data-text shows a value. Make it a computed (Stitch.computed(function () { ... })) and bind that, or bind the property it returns.`

**Cause:** `data-text` names a method. It shows values, it does not call functions.

**Fix:** Make the value a computed (`Stitch.computed(function () { ... })`) and bind that.

### E302: data-class value of the wrong kind

**Message:** `the value must be a class string or an object of { className: boolean }; got ….`

**Cause:** The bound value is neither a string, an object of `{ className: boolean }`, `null` nor `undefined` (for example an array or a number).

**Fix:** Return a class string or an object from a computed.

### E303: data-attr value of the wrong kind

**Message:** `the value must be an object of { attributeName: value }, e.g. { href: url, target: "_blank" }; got ….`

**Cause:** The bound value is not an object of attributes (for example a string).

**Fix:** Bind an object such as `{ href: url, target: "_blank" }`, usually a computed.

### E304: data-event value of the wrong kind

**Message:** `the value must be an object that maps event names to handlers, e.g. { input: "validate" }; got ….`

**Cause:** `data-event` names a property that is not an object of `{ eventName: handler }`.

**Fix:** Put an object such as `{ input: "validate", blur: "$root.save" }` on the model and bind its name.

### E305: data-event entry of the wrong kind

**Message:** `… (event "…"): the handler must be a handler name (e.g. "validate" or "$root.save") or a function; got ….`

**Cause:** An entry of the `data-event` object is neither a handler name (string) nor a function.

**Fix:** Map each event to a handler name or a function.

### E311: data-value on a computed

**Message:** `"…" is a computed (read-only), so a two-way binding cannot write it. Bind it one-way (data-text), or bind the plain property it is computed from.`

**Cause:** A computed is read-only; the input could not write to it.

**Fix:** Bind the computed one-way (`data-text`), or bind `data-value` to the plain property it is computed from.

### E312: data-value on a read-only getter

**Message:** `"…" is read-only (a getter without a setter), so a two-way binding cannot write it. Bind it one-way (data-text) or bind a writable property.`

**Cause:** The path ends on a getter with no setter (for example a class getter).

**Fix:** Bind it one-way, or bind a writable property.

### E313: data-value on a row-context value

**Message:** `…: a two-way binding cannot write to … (it is the row's own context value, so writing it would not change the list); bind a property instead, e.g. data-value="$data.name" with a list of objects, or data-value="$root.selected".`

**Cause:** The path ends on `$data`, `$index`, `$parent` or `$root` (or passes through `$index`). Writing those would not change the list.

**Fix:** Bind a property of the row (`data-value="name"` or `data-value="$data.name"` in a list of objects) or of the model (`data-value="$root.selected"`). For a `<select>` whose options come from a list of plain values, write `<option data-text="$data"></option>` without `data-value`: an option without a value uses its text as its value.

### E314: Writing through a null object

**Message:** `cannot write "…": "…" is …. Give "…" an object first (e.g. …: { …: "" }), or hide the input while it is empty (data-visible).`

**Cause:** The user typed into an input bound to `a.b` while `a` is `null` or not an object. Stitch does not create the missing object (it would not be reactive). Reported to `Stitch.onError` (or uncaught). The input listens to both `input` and `change`, so one edit can report it twice.

**Fix:** Give the object a value first (`address: { city: "" }`), or hide the input while it is `null` (`data-visible="address"`).

### E321: Event-handler attribute from data

**Message:** `"…" is an event-handler attribute, whose value runs as script, so data may not set it. Attach behaviour with data-click or data-event instead.`

**Cause:** A `data-attr` object lists an attribute whose name starts with `on` (any case: `onclick`, `ONLOAD`, `onbegin`, even plain `on`). Its value would run as script, so data may never name one, whatever the value (`null` included). Nothing in the object is written.

**Fix:** Attach behaviour with `data-click` or `data-event`, which call a handler on the model.

```html page
<a id="app" data-attr="link">Open</a>
```

```js throws
const model = Stitch.Observable.create({ link: { href: '/report', onclick: 'track()' } });
new Stitch.DataBinder().bind('#app', model);
```
Throws: `[Stitch E321]`

### E322: srcdoc from data

**Message:** `srcdoc holds a whole HTML document, scripts included, so data may not set it. Point src at a page instead, or show the text with data-text.`

**Cause:** A `data-attr` object lists `srcdoc`. Its value is a whole HTML document that runs its own scripts.

**Fix:** Point the frame's `src` at a page, or show the text with `data-text` (which is always text).

### E323: javascript: or vbscript: URL from data

**Message:** `"…" would get a …: URL, which runs script when it is followed, so it is refused. Use an http(s), mailto, tel, #anchor or relative URL.`

**Cause:** A URL-bearing attribute (`href`, `src`, `action`, `formaction`, `xlink:href`, `poster`, `cite`, `background`, `ping`, `srcset`, `data`, an SVG animation's `to`/`from`/`by`/`values`, and the other URL attributes listed under [data-attr](API.md#data-attrpath)) would get a `javascript:` or `vbscript:` URL. The check reads the value the way a browser does (any case; tabs, newlines and control characters inside or before the scheme) and also after decoding character references (`&#106;`, `&colon;`, ...) and percent-escapes, and after removing every invisible character, so the evasion forms are refused too. Nothing in the object is written.

**Fix:** Use an `http(s):`, `mailto:`, `tel:`, `#anchor` or relative URL. A URL that only contains `javascript:` later on (`/go?next=javascript:x`) is allowed.

```html page
<a id="app" data-attr="link">Open</a>
```

```js throws
const model = Stitch.Observable.create({ link: { href: ' JaVaScRiPt:alert(1)' } });
new Stitch.DataBinder().bind('#app', model);
```
Throws: `[Stitch E323]`

### E324: data: URL from data

**Message:** `"…" would get a data: URL, which can carry a document with scripts. Only data:image/... in an <img> src is allowed; serve anything else from a URL.`

**Cause:** A URL-bearing attribute would get a `data:` URL. A `data:` URL can carry a whole document (HTML, SVG) with scripts. The one exception is `data:image/...` in the `src` of an `<img>`, where an image cannot run script.

**Fix:** Serve the content from a URL, or show an inline image with `<img data-attr="...">` and `{ src: 'data:image/png;base64,...' }`.

### E325: style string from data

**Message:** `style must be an object of { property: value }, written through the CSSOM, e.g. { style: { color: "red" } }; a style string is refused (a strict Content-Security-Policy blocks it).`

**Cause:** A `data-attr` object gives `style` a string (or an array). A page with a strict Content-Security-Policy (`style-src` without `'unsafe-inline'`) blocks style strings, so Stitch never writes one.

**Fix:** Give `style` an object such as `{ color: 'red', fontSize: '12px' }`. Each property is set through the CSSOM (`element.style.setProperty`), which the policy allows; prefer classes (`data-class`) where you can.

### E326: Binding on a script, style, base or meta element

**Message:** `…: a <…> element holds code or decides where the page loads code from, so Stitch does not bind it (data could run script). Bind an ordinary element (e.g. a <span>) instead.`

**Cause:** A built-in binding (`data-text`, `data-attr`, ...) is on a `<script>`, `<style>`, `<base>` or `<meta>` element (in any namespace, SVG included). Their text or attributes are code, or decide where the page loads code from, so data written there could run script.

**Fix:** Bind an ordinary element. To show code as text, put it in a `<pre>` or `<code>` with `data-text`.

```html page
<div id="app"><script data-text="code"></script></div>
```

```js throws
const model = Stitch.Observable.create({ code: 'alert(1)' });
new Stitch.DataBinder().bind('#app', model);
```
Throws: `[Stitch E326]`

### E327: Security-sensitive attribute from data

**Message:** `"…" decides what the page or an embedded document may do (or vouches for what it loads), so data may neither set nor remove it. Write it in the markup.`

**Cause:** A `data-attr` object lists one of `sandbox`, `allow`, `allowfullscreen`, `allowpaymentrequest`, `allowusermedia`, `csp`, `credentialless`, `http-equiv`, `integrity`, `crossorigin`, `nonce`, `referrerpolicy`, `is`. These decide what an embedded document may do (`sandbox`, `allow`, `csp`, ...), whether a loaded resource is trusted (`integrity`, `crossorigin`, `nonce`), what is sent to another page (`referrerpolicy`), how a `<meta>` acts (`http-equiv`) or which custom element runs (`is`). Data may neither set nor remove them, whatever the value: `{ sandbox: null }` would remove a static `sandbox` and lift it. Nothing in the object is written.

**Fix:** Write the attribute in the markup. If it must differ by case, render the variants in the markup and show one with `data-visible`.

```html page
<iframe id="app" sandbox="" data-attr="frame"></iframe>
```

```js throws
const model = Stitch.Observable.create({ frame: { title: 'Report', sandbox: null } });
new Stitch.DataBinder().bind('#app', model);
```
Throws: `[Stitch E327]`

### E328: rel="opener" from data

**Message:** `rel "opener" gives the linked page a reference back to this window, so data may not set it. Leave it out (a link opened in a new tab gets noopener by default) or use "noopener noreferrer".`

**Cause:** A `data-attr` object gives `rel` a value with the token `opener`, which would let the linked page reach this window (`window.opener`) and navigate it. Other `rel` values, `noopener noreferrer` included, are written as given.

**Fix:** Leave `rel` out, or use `rel: 'noopener noreferrer'`.

### E329: rel protection from the markup dropped by data

**Message:** `the markup's rel has …, which data may not drop: a bound rel may only add tokens. Keep them in the value (e.g. "noopener noreferrer nofollow"), or leave rel out of the object.`

**Cause:** The element's markup has `rel` with `noopener` and/or `noreferrer`, and a `data-attr` value for `rel` would remove it (`null`, `false`) or replace it with a value that lacks one of them (`"nofollow"`). Those tokens keep the linked page from reaching this window or seeing this page's address, so data may add tokens next to them but never drop them.

**Fix:** Keep the markup's tokens in the value (`rel: 'noopener noreferrer nofollow'`), or leave `rel` out of the object.

```html page
<a id="app" href="/report" rel="noopener noreferrer" data-attr="link">Report</a>
```

```js throws
const model = Stitch.Observable.create({ link: { rel: 'nofollow' } });
new Stitch.DataBinder().bind('#app', model);
```
Throws: `[Stitch E329]`

## E4xx: Handlers

A handler is a bare name (looked up on the current row; outside a list, the model), `$parent.name` (one level up) or `$root.name` (the root model). It is called with `(item, event)`.

[E401](#e401-handler-not-found) · [E402](#e402-handler-is-not-a-function) · [E403](#e403-parent-outside-a-list) · [E404](#e404-handler-in-a-row-template-not-found-checked-at-bind) · [E405](#e405-parent-handler-in-a-row-template-is-not-a-function) · [E406](#e406-root-handler-in-a-row-template-not-found-checked-at-bind) · [E407](#e407-root-handler-in-a-row-template-is-not-a-function)

### E401: Handler not found

**Message:** `handler "…" was not found on ….…`

**Cause:** The name does not exist where it was looked up. The most common case: a bare name inside a list row, where it is looked up on the row's item, while the method is on the model. The message says where the name does exist.

**Fix:** Use the prefix the message suggests, usually `$root.name` (or `$parent.name` in a top-level list). For a method more than one level up, move it to the root model.

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
Throws: `[Stitch E401]`

### E402: Handler is not a function

**Message:** `"…" on … is …, not a function. A handler must be a method of the model or row.`

**Cause:** The name exists but holds data, not a method.

**Fix:** Name a method, or turn the property into one.

### E403: $parent. outside a list

**Message:** `"$parent." is only available inside a foreach row; here the handler is on the model itself. Use data-… with the bare name "…".`

**Cause:** A handler outside any list uses `$parent.`; there is no level above the model.

**Fix:** Use the bare name.

### E404: Handler in a row template not found (checked at bind)

**Message:** `…: handler "…" was not found on …. If it is a method of each row, use the bare name; if it is on the root model, use $root.name.`

**Cause:** A `$parent.` handler in a list's row template does not exist one level up. This is checked when the list is bound, even if it has no rows yet.

**Fix:** Use the bare name if it is a method of each row, `$root.name` if it is on the root model.

### E405: $parent. handler in a row template is not a function

**Message:** `…: "…" on … is …, not a function.`

**Cause:** The name exists one level up but is not a method.

**Fix:** Name a method.

### E406: Root handler in a row template not found (checked at bind)

**Message:** `…: handler "…" was not found on the root model. If it is a method of each row, use the bare name; if it is on the enclosing row, use $parent.name.`

**Cause:** A `$root.` handler in a list's row template is not on the root model. This is checked when the list is bound, even if it has no rows yet.

**Fix:** Add the method to the root model, or use the bare name if it is a method of each row, `$parent.name` if it is on the enclosing row.

### E407: $root. handler in a row template is not a function

**Message:** `…: "…" on the root model is …, not a function.`

**Cause:** The name exists on the root model but is not a method.

**Fix:** Name a method.

## E5xx: Lists

Keys, row templates, list values and the list attributes. A list that breaks a rule throws before the list changes (from `bind()`, or to `Stitch.onError` on a later update).

[E501](#e501-a-row-has-no-key) · [E502](#e502-two-rows-have-the-same-key) · [E503](#e503-a-row-is-null-or-undefined) · [E504](#e504-data-key-on-a-list-of-plain-values) · [E505](#e505-empty-data-key) · [E511](#e511-row-template-with-several-root-elements) · [E512](#e512-empty-row-template) · [E513](#e513-row-template-is-only-text) · [E514](#e514-data-template-names-no-element) · [E515](#e515-data-template-names-an-element-that-is-not-a-template) · [E516](#e516-data-template-list-with-content-inside) · [E521](#e521-data-foreach-bound-to-something-that-is-not-an-array) · [E531](#e531-data-key-or-data-template-without-data-foreach) · [E532](#e532-data-default-text-or-data-default-value-outside-a-select-list) · [E533](#e533-data-default-value-without-data-default-text) · [E534](#e534-data-text-and-data-foreach-on-one-element) · [E535](#e535-data-text-on-an-element-that-contains-bound-elements)

### E501: A row has no key

**Message:** `…: row … has no "…" (…). Every row of a list needs a unique key. …`

**Cause:** An object row has no `id` (or no value for the `data-key` field). If the row has a field that looks like a key (`sku`, `code`, `userId`, ...) the message suggests it.

**Fix:** Add `data-key="field"` naming the field that identifies a row, or give every row an `id`.

```html page
<ul id="app" data-foreach="products"><li data-text="name"></li></ul>
```

```js throws
const model = Stitch.Observable.create({ products: [{ sku: 'A1', name: 'Pen' }] });
new Stitch.DataBinder().bind('#app', model);
```
Throws: `[Stitch E501]`

### E502: Two rows have the same key

**Message:** `…: rows … and … have …. Keys must be unique within a list: remove the duplicate, or key the rows by a field that is unique.`

**Cause:** Two rows share a key (two objects with the same `id`, or the same plain value twice).

**Fix:** Remove the duplicate, or key the rows by a field that is unique (`data-key`). For plain values that repeat, use objects with an `id`.

```html page
<ul id="app" data-foreach="tags"><li data-text="$data"></li></ul>
```

```js throws
const model = Stitch.Observable.create({ tags: ['a', 'b', 'a'] });
new Stitch.DataBinder().bind('#app', model);
```
Throws: `[Stitch E502]`

### E503: A row is null or undefined

**Message:** `…: row … is …. A list row must be an object with a key, or a plain value (string, number, boolean). Remove the empty row from the list.`

**Cause:** The list contains `null` or `undefined`.

**Fix:** Remove empty entries before you assign the list.

### E504: data-key on a list of plain values

**Message:** `…: row … is a plain … (…), so it has no "…" field. data-key is for lists of objects; remove data-key and each plain value is its own key.`

**Cause:** The list has `data-key` but its rows are strings, numbers or booleans.

**Fix:** Remove `data-key`: each plain value is its own key.

### E505: Empty data-key

**Message:** `…: data-key is empty. Set it to the field that identifies a row (e.g. data-key="sku"), or remove it to use "id".`

**Cause:** `data-key=""`.

**Fix:** Name the key field (`data-key="sku"`), or remove the attribute to use `id`.

### E511: Row template with several root elements

**Message:** `…: … has … (…), but a row must be exactly one element. Wrap them in one element, e.g. <div>...</div>.`

**Cause:** The row template has two or more top-level elements (or text next to an element). A row must be exactly one element.

**Fix:** Wrap them in one element (a `<div>`, `<li>` or `<tr>`).

```html page
<div id="app" data-foreach="groups"><h4 data-text="title"></h4><p data-text="note"></p></div>
```

```js throws
const model = Stitch.Observable.create({ groups: [{ id: 1, title: 'A', note: 'n' }] });
new Stitch.DataBinder().bind('#app', model);
```
Throws: `[Stitch E511]`

### E512: Empty row template

**Message:** `…: … is empty. …`

**Cause:** The list element (or its `<template>`) has no element to use as a row.

**Fix:** Put one row element inside the list element, or inside the `<template>` named by `data-template`.

### E513: Row template is only text

**Message:** `…: … is …, but a row must be one element. Wrap it in an element, e.g. <span data-text="$data"></span>.`

**Cause:** The row template is text, not an element.

**Fix:** Wrap it in an element, for example `<span data-text="$data"></span>`.

### E514: data-template names no element

**Message:** `…: data-template="…" names no element. Add <template id="…"> with one row element inside.`

**Cause:** No element has the id given in `data-template`.

**Fix:** Add `<template id="...">` with one row element inside, or fix the id.

### E515: data-template names an element that is not a template

**Message:** `…: data-template="…" must name a <template> element, got <…>.`

**Cause:** The id belongs to a `<div>` or another element.

**Fix:** Use a `<template>` element.

### E516: data-template list with content inside

**Message:** `…: the list takes its rows from the <template>, so the elements written inside it (…) would be discarded. Remove them, or remove data-template to use them as the row template.`

**Cause:** The list has `data-template` and also elements inside it, which would be discarded.

**Fix:** Remove the inner elements, or remove `data-template` to use them as the template.

### E521: data-foreach bound to something that is not an array

**Message:** `…: "…" must be an array (or null/undefined for no rows), got …. Bind data-foreach to an array.`

**Cause:** The bound value is an object, a string or a number. (`null` and `undefined` render no rows.)

**Fix:** Bind an array. For an object of rows, bind a computed that returns `Object.values(...)` with keys.

```html page
<ul id="app" data-foreach="people"><li data-text="name"></li></ul>
```

```js throws
const model = Stitch.Observable.create({ people: { a: { id: 1, name: 'Ann' } } });
new Stitch.DataBinder().bind('#app', model);
```
Throws: `[Stitch E521]`

### E531: data-key or data-template without data-foreach

**Message:** `…: … only works on an element with data-foreach (it configures the list's rows). Add data-foreach to this element, or remove ….`

**Cause:** The attribute configures a list, but the element has no `data-foreach`.

**Fix:** Add `data-foreach` to the element, or remove the attribute.

### E532: data-default-text or data-default-value outside a select list

**Message:** `…: … only works on a <select> with data-foreach (it adds a placeholder option). Move it to the <select data-foreach>, or remove it.`

**Cause:** The placeholder attributes only work on a `<select data-foreach>`.

**Fix:** Move them to the `<select data-foreach>`, or remove them.

### E533: data-default-value without data-default-text

**Message:** `…: data-default-value is the value of the placeholder option, which data-default-text creates. Add data-default-text="Choose..." or remove data-default-value.`

**Cause:** There is no placeholder option to give a value to.

**Fix:** Add `data-default-text="Choose..."`, or remove `data-default-value`.

### E534: data-text and data-foreach on one element

**Message:** `… has data-foreach="…" and data-text="…": data-text would replace the list's rows. Put the text on another element (e.g. a heading before the list).`

**Cause:** The text would replace the list's rows.

**Fix:** Put the text on another element, such as a heading before the list.

### E535: data-text on an element that contains bound elements

**Message:** `… contains …: … would replace the element's content, destroying the binding inside it. Put the text in its own element (e.g. a <span>) next to the bound elements.`

**Cause:** `data-text` replaces the element's whole content, which would destroy the bindings inside it.

**Fix:** Put the text in its own element (a `<span>`) next to the bound elements.

```html page
<p id="app" data-text="title"><b data-text="name"></b></p>
```

```js throws
const model = Stitch.Observable.create({ title: 'T', name: 'N' });
new Stitch.DataBinder().bind('#app', model);
```
Throws: `[Stitch E535]`

## E6xx: DataBinder and custom bindings

[E601](#e601-element-already-bound) · [E602](#e602-selector-matches-nothing) · [E603](#e603-not-an-element) · [E604](#e604-bind-without-a-model) · [E605](#e605-bind-after-dispose) · [E606](#e606-unbind-after-dispose) · [E607](#e607-unbind-of-an-element-with-nothing-bound) · [E611](#e611-hooks-are-not-an-object) · [E612](#e612-unknown-hook) · [E613](#e613-hook-is-not-a-function) · [E614](#e614-properties-hook-is-not-an-object) · [E615](#e615-property-hooks-are-not-an-object) · [E616](#e616-unknown-property-hook) · [E617](#e617-property-hook-is-not-a-function) · [E621](#e621-registerbinding-after-bind) · [E622](#e622-binding-name-is-not-a-string) · [E623](#e623-invalid-binding-name) · [E624](#e624-binding-name-reserved) · [E625](#e625-binding-handler-without-bind) · [E626](#e626-invalid-value-kind) · [E627](#e627-binding-name-taken)

### E601: Element already bound

**Message:** `… is already bound by …. Binding it again would leave it on the first model or bind it twice. Call unbind() on the root that bound it first (or dispose() that binder), then bind again.`

**Cause:** The root (or an element inside it) was already bound, by this binder or another one. Binding twice would leave it on the first model or bind it twice.

**Fix:** Call `unbind()` on the root that bound it (or `dispose()` that binder) first, then bind again.

```html page
<span id="app" data-text="a"></span>
```

```js throws
const binder = new Stitch.DataBinder();
binder.bind('#app', Stitch.Observable.create({ a: 1 }));
binder.bind('#app', Stitch.Observable.create({ a: 2 }));
```
Throws: `[Stitch E601]`

### E602: Selector matches nothing

**Message:** `…("…"): no element matches that selector.`

**Cause:** `bind()` or `unbind()` got a selector that matches no element (often: the script runs before the element exists).

**Fix:** Fix the selector, or run the script after the element is in the page (at the end of `<body>`, or on `DOMContentLoaded`).

### E603: Not an element

**Message:** `…(element): element must be a DOM element or a selector, got ….`

**Cause:** `bind()` or `unbind()` got something that is neither an element nor a selector string.

**Fix:** Pass an element or a CSS selector.

### E604: bind() without a model

**Message:** `bind(element, model): model must be created with Stitch.Observable.create().`

**Cause:** The second argument of `bind()` is a plain object or missing.

**Fix:** Create it with `Stitch.Observable.create(data)`.

### E605: bind() after dispose()

**Message:** `bind(): this DataBinder was disposed. Create a new DataBinder to bind again.`

**Cause:** The binder was disposed.

**Fix:** Create a new `Stitch.DataBinder()`.

### E606: unbind() after dispose()

**Message:** `unbind(): this DataBinder was disposed; everything it bound is already released.`

**Cause:** The binder was disposed; everything it bound is already released.

**Fix:** Remove the call.

### E607: unbind() of an element with nothing bound

**Message:** `unbind(…): nothing is bound by this DataBinder in that element. Pass the element (or an ancestor of the elements) given to bind(), with the binder that bound it.`

**Cause:** Nothing inside that element was bound by this binder (wrong element, wrong binder, or already unbound).

**Fix:** Pass the element given to `bind()` (or an ancestor), with the binder that bound it.

### E611: Hooks are not an object

**Message:** `new DataBinder(hooks): hooks must be an object, got ….`

**Cause:** `new Stitch.DataBinder(hooks)` got something other than an object.

**Fix:** Pass `{ onBind, onChange, properties }` or nothing.

### E612: Unknown hook

**Message:** `new DataBinder(hooks): unknown hook "…". Known hooks: ….`

**Cause:** The hooks object has a name other than `onBind`, `onChange`, `properties`.

**Fix:** Fix the name.

### E613: Hook is not a function

**Message:** `new DataBinder(hooks): … must be a function, got ….`

**Cause:** `onBind` or `onChange` is not a function.

**Fix:** Pass a function.

### E614: properties hook is not an object

**Message:** `new DataBinder(hooks): properties must be an object of { propertyName: { onBind, onChange } }.`

**Cause:** `hooks.properties` is not an object.

**Fix:** Pass `{ propertyName: { onBind, onChange } }`.

### E615: Property hooks are not an object

**Message:** `new DataBinder(hooks): properties.… must be an object of { onBind, onChange }.`

**Cause:** An entry of `hooks.properties` is not an object.

**Fix:** Pass `{ onBind, onChange }` for each property.

### E616: Unknown property hook

**Message:** `new DataBinder(hooks): unknown hook "properties.….…". Known: onBind, onChange.`

**Cause:** A property hook has a name other than `onBind` or `onChange` (names are case-sensitive).

**Fix:** Fix the name.

### E617: Property hook is not a function

**Message:** `new DataBinder(hooks): properties.….… must be a function.`

**Cause:** A property hook is not a function.

**Fix:** Pass a function.

### E621: registerBinding() after bind()

**Message:** `registerBinding("…") was called after bind(): elements bound before it would not get the binding. Register every custom binding before the first bind() on the page.`

**Cause:** A custom binding was registered after the first `bind()` on the page; elements bound earlier would not get it.

**Fix:** Register every custom binding before the first `bind()`, for example at the top of your page script.

```html page
<span id="app" data-text="a"></span>
```

```js throws
new Stitch.DataBinder().bind('#app', Stitch.Observable.create({ a: 1 }));
Stitch.DataBinder.registerBinding('tooltip', { bind() {} });
```
Throws: `[Stitch E621]`

### E622: Binding name is not a string

**Message:** `registerBinding: name must be a string`

**Cause:** The first argument is not a string.

**Fix:** Pass the name as a string: `registerBinding("tooltip", ...)`.

### E623: Invalid binding name

**Message:** `registerBinding("…"): a binding name must be lowercase letters, digits and dashes (e.g. "tooltip" or "date-format"): it becomes the attribute data-…, and HTML lowercases attribute names.`

**Cause:** HTML lowercases attribute names, so a name with capitals (`myBinding`) could never match.

**Fix:** Use lowercase letters, digits and dashes: `my-binding`.

### E624: Binding name reserved

**Message:** `registerBinding("…"): data-… is reserved by Stitch (it configures lists or form-value conversion). Choose another name.`

**Cause:** `key`, `template`, `default-text` and `default-value` configure lists.

**Fix:** Choose another name.

### E625: Binding handler without bind()

**Message:** `registerBinding: handler must have a bind() method`

**Cause:** The handler object has no `bind` function.

**Fix:** Pass `{ bind(element, model, value, context) { ... } }`.

### E626: Invalid value kind

**Message:** `registerBinding("…"): value must be "path" or "literal": "path" (the default) when the attribute names a model property, "literal" when the attribute text is passed as is. Got ….`

**Cause:** `handler.value` is something other than `"path"` or `"literal"`.

**Fix:** Use `"path"` (the attribute names a model property) or `"literal"` (the attribute text is passed as is).

### E627: Binding name taken

**Message:** `registerBinding("…"): data-… is already registered…. Choose another name.`

**Cause:** A built-in or an earlier custom binding has that name.

**Fix:** Choose another name.

## E7xx: Models and computed properties

[E701](#e701-create-without-an-object) · [E702](#e702-createarray-without-an-array) · [E703](#e703-create-of-a-model) · [E704](#e704-create-or-reactive-of-an-object-inside-a-model) · [E705](#e705-options-are-not-an-object) · [E706](#e706-unknown-option) · [E707](#e707-arrow-function-as-a-method) · [E708](#e708-arrow-function-assigned-to-a-property) · [E709](#e709-reserved-field-name) · [E710](#e710-a-model-inside-another-model) · [E711](#e711-one-array-map-or-set-in-two-models) · [E712](#e712-delete-on-a-list-map-or-set) · [E713](#e713-assignment-to-a-computed) · [E714](#e714-frozen-sealed-or-non-extensible-data) · [E721](#e721-computed-of-the-wrong-kind) · [E722](#e722-deps-is-not-an-array) · [E723](#e723-computed-deps-form-a-cycle) · [E724](#e724-a-computed-wrote-to-the-model) · [E725](#e725-a-computed-changed-a-list-map-or-set)

### E701: create() without an object

**Message:** `Observable.create() requires an object as input`

**Cause:** `Observable.create()` got a value that is not an object.

**Fix:** Pass a plain object. For an array, use `Observable.createArray()`.

### E702: createArray() without an array

**Message:** `Observable.createArray() requires an array as input`

**Cause:** `Observable.createArray()` got a value that is not an array.

**Fix:** Pass an array.

### E703: create() of a model

**Message:** `Observable.create() received an already-reactive object. Use the existing proxy or pass a plain object.`

**Cause:** The object is already a model.

**Fix:** Use the model you have, or pass a plain copy (`Stitch.Observable.toRaw(model)`).

### E704: create() or reactive() of an object inside a model

**Message:** `…(): "…" already belongs to a model; use the root model (events, change handlers and bindings live there), or Observable.toRaw() it to make a separate model from a copy.`

**Cause:** The object is part of another model (for example `model.user`).

**Fix:** Use the root model, or make a separate model from a copy: `Observable.create(Observable.toRaw(model.user))`.

### E705: Options are not an object

**Message:** `…(data, options): options must be an object, got ….`

**Cause:** The second argument of `create`, `createArray` or `reactive` is not an object.

**Fix:** Pass `{ isolated: true }` or nothing.

### E706: Unknown option

**Message:** `…(): unknown option "…". Known options: ….…`

**Cause:** An option other than `isolated` was passed. There is no `debug` option: Stitch has no debug mode.

**Fix:** Remove the option.

```js throws
Stitch.Observable.create({ a: 1 }, { debug: true });
```
Throws: `[Stitch E706]`

### E707: Arrow function as a method

**Message:** `Arrow function detected in property '…' Arrow functions cannot access reactive properties via 'this'. They use lexical 'this' binding which cannot be changed. Convert to regular function or ES6 method shorthand: ❌ …: () => { return this.someValue; } ✅ …() { return this.someValue; } ✅ …: function() { return this.someValue; } Learn more: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Functions/Arrow_functions`

**Cause:** A method of the data is an arrow function. Arrow functions cannot see the model through `this`. Checked wherever data enters a model: `Observable.create()`, assignment, `$set`, and the rows given to a list (at create, `push`, `unshift`, `splice`, `fill`, an index write, a new array), at any depth; nothing is added when it throws.

**Fix:** Write `name() { ... }` or `name: function () { ... }`.

### E708: Arrow function assigned to a property

**Message:** `Cannot set arrow function on property '…' Arrow functions cannot access reactive properties via 'this'. Use regular function or ES6 method shorthand instead.`

**Cause:** An arrow function was assigned to a model property.

**Fix:** Assign a regular function or method.

### E709: Reserved field name

**Message:** `"…" is reserved: …, so a data field with that name would be overwritten. Rename the field when the data arrives (e.g. to "…Value").`

**Cause:** A data field is named `toJSON` or like a model helper (`$on`, `$set`, `$watch`, ...). The message names the path (`rows[3].toJSON`).

**Fix:** Rename the field when the data arrives, for example to `jsonValue`.

### E710: A model inside another model

**Message:** `cannot put … at "…": A model cannot be nested in another model: assign plain data, or Observable.toRaw(…). One page model is one root; events, change handlers and bindings follow that root only.`

**Cause:** A model (or an object of another model) was assigned, pushed or set into a model. One model is one root: events, change handlers and bindings follow that root only.

**Fix:** Assign plain data, or a copy: `app.cart = Stitch.Observable.toRaw(cart)`.

```js throws
const app = Stitch.Observable.create({ cart: null });
const cart = Stitch.Observable.create({ items: [] });
app.cart = cart;
```
Throws: `[Stitch E710]`

### E711: One array, Map or Set in two models

**Message:** `"…" already belongs to a model; give each model its own copy (…). The same array, Map or Set in two models would be one live object with two owners: it belongs to a different model.`

**Cause:** The same array, `Map` or `Set` was given to a second model (often a shared lookup list such as countries).

**Fix:** Give each model its own copy: `[...countries]`, `new Map(rates)`, `new Set(codes)`.

```js throws
const countries = [{ code: 'FR' }];
const a = Stitch.Observable.create({ countries });
const b = Stitch.Observable.create({ countries });
```
Throws: `[Stitch E711]`

### E712: delete on a list, Map or Set

**Message:** `delete …: …. Model data cannot be deleted (it would leave a hole the screen does not see; set it to null instead).`

**Cause:** `delete` on a model list, `Map` or `Set` would leave a hole the page does not see.

**Fix:** Use `list.splice(index, 1)`, `map.delete(key)` or `set.delete(value)`. On objects, set the property to `null` (deleting a model object's property fails: in strict mode with the browser's own `TypeError`, in sloppy mode silently returning `false`).

### E713: Assignment to a computed

**Message:** `Cannot set computed property '…'`

**Cause:** Computed properties are read-only.

**Fix:** Change the properties it is computed from.

### E714: Frozen, sealed or non-extensible data

**Message:** `… is … (Object.freeze, Object.seal or Object.preventExtensions): Stitch makes data reactive in place, which … data does not allow. Pass a copy instead, e.g. structuredClone(data) or { ...data }.`

**Cause:** Data passed to `Observable.create()`, `createArray()` or `reactive()`, assigned to a model property, pushed into a list or put in a Map or Set was frozen (`Object.freeze`), sealed (`Object.seal`) or made non-extensible. Stitch converts data in place, which such objects do not allow. The message names where the object sits (`"rows[0]"`, `"user"`, or "The data" for the whole object).

**Fix:** Pass a copy: `structuredClone(data)`, or `{ ...data }` / `[...list]` for one level.

```js throws
Stitch.Observable.create(Object.freeze({ name: 'Ada' }));
```
Throws: `[Stitch E714]`

### E721: computed() of the wrong kind

**Message:** `Stitch.computed() expects either: - A function: Stitch.computed(function() { ... }) - An object: Stitch.computed({ get() { ... }, deps: [...] })`

**Cause:** `Stitch.computed()` got neither a function nor `{ get }`.

**Fix:** Pass `function () { return ...; }` or `{ get() { ... }, deps: [...] }`.

### E722: deps is not an array

**Message:** `Stitch.computed() deps must be an array of property names. Example: Stitch.computed({ get() { ... }, deps: ['prop1', 'prop2'] })`

**Cause:** `deps` was given as a string or object.

**Fix:** Pass an array of property names, or leave `deps` out (dependencies are tracked automatically).

### E723: Computed deps form a cycle

**Message:** `Stitch.computed() deps form a cycle: … → …. Remove the computed from its own dependency chain.`

**Cause:** The `deps` lists lead back to the computed itself.

**Fix:** Remove the computed from its own dependency chain.

### E724: A computed wrote to the model

**Message:** `a computed wrote "…": a computed only reads the model and returns a value. Move the write to a handler or a $watch callback, or make the written value a computed of its own.`

**Cause:** While a computed's function ran, it assigned a model property (`this.count++`), called `$set`, or wrote a list index. A computed runs whenever it is read again, so a write there changes the model at unpredictable times. The write does not happen; the error goes to whoever read the computed (`bind()`, your code, or `Stitch.onError` for a binding that re-renders).

**Fix:** Keep computeds read-only. Do the write in a handler or a `$watch` callback, or turn the written value into a computed of its own.

```js throws
const model = Stitch.Observable.create({
    reads: 0,
    total: Stitch.computed(function () { this.reads++; return 1; })
});
model.total;
```
Throws: `[Stitch E724]`

### E725: A computed changed a list, Map or Set

**Message:** `a computed called ….…(), which changes the model: a computed only reads. Work on a copy and return it, e.g. ….slice().sort(...) or [...…].reverse().`

**Cause:** While a computed's function ran, it called a method that changes a model list, Map or Set in place: `sort`, `reverse`, `push`, `splice`, `fill`, ... on a list, `set`, `add`, `delete`, `clear` on a Map or Set. The usual case is `return this.items.sort(...)`, which would reorder the model itself. Nothing changes; the error goes to whoever read the computed.

**Fix:** Work on a copy and return it: `this.items.slice().sort(...)`, `[...this.items].reverse()`. `filter()` and `map()` already return new arrays.

```js throws
const model = Stitch.Observable.create({
    items: [{ id: 2 }, { id: 1 }],
    sorted: Stitch.computed(function () { return this.items.sort((a, b) => a.id - b.id); })
});
model.sorted;
```
Throws: `[Stitch E725]`

## E8xx: Model helpers, events and the message bus

Events (`$on`, `$off`, `$emit`, `$once`, `$use`) live on the root model only. Change handlers (`$onChange`, `$offChange`) work on any model object. The model's event helpers use the message bus, so an error from `model.$on(...)` may name `MessageBus.subscribe`.

[E801](#e801-events-on-a-nested-object-row-or-list) · [E802](#e802-v2-helper-name) · [E803](#e803-onchange-with-an-event-name) · [E804](#e804-onchange-with-several-arguments) · [E805](#e805-onchange-without-a-function) · [E806](#e806-offchange-with-an-event-name) · [E807](#e807-offchange-without-the-handler) · [E808](#e808-offchange-with-a-value-that-is-not-a-function) · [E809](#e809-offchange-of-a-handler-that-is-not-installed) · [E810](#e810-on-with-swapped-arguments) · [E811](#e811-on-with-only-a-function) · [E812](#e812-on-with-the-wrong-number-of-arguments) · [E813](#e813-off-without-both-arguments) · [E814](#e814-once-without-an-event-name) · [E815](#e815-once-without-a-callback) · [E816](#e816-set-without-a-name) · [E817](#e817-watch-without-a-callback) · [E851](#e851-event-name-missing) · [E852](#e852-subscriber-is-not-a-function) · [E853](#e853-unsubscribing-a-callback-that-is-not-subscribed) · [E854](#e854-middleware-is-not-a-function) · [E855](#e855-events-publishing-each-other-forever)

### E801: Events on a nested object, row or list

**Message:** `…(): events live on the root model: use model.$emit('…') / model.$on('…', callback). From a list row, call a root handler with $root.handler (data-click / data-event).`

**Cause:** `$emit`, `$on`, `$off`, `$once` or `$use` was called on something other than the root model (a nested object, a list row, an array, a Map or Set).

**Fix:** Call it on the root model. From a list row, call a root method with `data-click="$root.handler"` and emit from there.

```js throws
const model = Stitch.Observable.create({ user: { name: 'Ada' } });
model.user.$on('saved', function () {});
```
Throws: `[Stitch E801]`

### E802: v2 helper name

**Message:** `.…() is now .…() in Stitch v3: the helpers are $-prefixed, so that data fields can be named on, off, get or set. Events: $on(event, callback) / $off(event, callback).`

**Cause:** Code calls (or assigns) `on`, `off`, `get` or `set`, the v2 names. In v3 the helpers are `$`-prefixed, so data can have fields with those names.

**Fix:** Use `$onChange` (was `on`), `$offChange` (was `off`), `$get` (was `get`), `$set` (was `set`). Events use `$on(event, callback)` / `$off(event, callback)`.

```js throws
const model = Stitch.Observable.create({ count: 0 });
model.on(function (change) {});
```
Throws: `[Stitch E802]`

### E803: $onChange() with an event name

**Message:** `$onChange(fn) registers a change handler; for events use $on(event, callback).`

**Cause:** `$onChange` got a string first. Change handlers take only a function.

**Fix:** For events, use `$on(event, callback)`.

### E804: $onChange() with several arguments

**Message:** `$onChange(fn) takes one argument (the change handler), got ….`

**Cause:** `$onChange` takes exactly one function.

**Fix:** Pass only the handler.

### E805: $onChange() without a function

**Message:** `$onChange(handler): handler must be a function, got ….`

**Cause:** The argument is not a function.

**Fix:** Pass a function.

### E806: $offChange() with an event name

**Message:** `$offChange(fn) removes a change handler; for events use $off(event, callback).`

**Cause:** `$offChange` got a string first.

**Fix:** For events, use `$off(event, callback)`.

### E807: $offChange() without the handler

**Message:** `$offChange(handler) needs the handler to remove (exactly one argument, got …). Removing is explicit: call it once per handler given to $onChange().`

**Cause:** `$offChange` was called with no argument or several. There is no "remove all".

**Fix:** Pass the function given to `$onChange`, once per handler.

### E808: $offChange() with a value that is not a function

**Message:** `$offChange(handler): handler is …, not a function. Pass the handler given to $onChange().`

**Cause:** Often a variable that is `undefined`.

**Fix:** Pass the function given to `$onChange`.

### E809: $offChange() of a handler that is not installed

**Message:** `$offChange(handler): that function is not a change handler of this object. Pass the function given to $onChange().`

**Cause:** The function was never added to this object, or was already removed.

**Fix:** Pass the same function given to `$onChange` on the same object.

### E810: $on() with swapped arguments

**Message:** `$on(fn, event): the arguments are swapped. Use $on(event, callback).`

**Cause:** The callback came first.

**Fix:** Write `$on(event, callback)`.

### E811: $on() with only a function

**Message:** `$on(fn): $on needs an event name; for change handlers use $onChange(fn).`

**Cause:** In v2, `on(fn)` registered a change handler. `$on` takes an event name.

**Fix:** For change handlers use `$onChange(fn)`; for events `$on(event, callback)`.

### E812: $on() with the wrong number of arguments

**Message:** `$on(event, callback) takes two arguments, got …; for change handlers use $onChange(fn).`

**Cause:** `$on` takes an event name and a callback.

**Fix:** Pass both.

### E813: $off() without both arguments

**Message:** `$off needs an event name and the callback: $off(event, callback) for events, $offChange(fn) for change handlers.`

**Cause:** `$off` takes an event name and the callback to remove.

**Fix:** Pass both, or use the function `$on` returned. For change handlers use `$offChange(fn)`.

### E814: $once() without an event name

**Message:** `$once(fn): $once needs an event name: $once(event, callback).`

**Cause:** The callback came first or the name is missing.

**Fix:** Write `$once(event, callback)`.

### E815: $once() without a callback

**Message:** `$once(event, callback): callback must be a function, got ….`

**Cause:** The callback is not a function.

**Fix:** Pass a function.

### E816: $set() without a name

**Message:** `$set(key, value): key must be a non-empty string, got ….`

**Cause:** The first argument of `$set` is not a non-empty string.

**Fix:** Pass the property name or path as a string.

### E817: $watch() without a callback

**Message:** `$watch("…", callback): callback must be a function, got ….`

**Cause:** The second argument of `$watch` is not a function.

**Fix:** Pass a function `(newValue, oldValue, info) => { ... }`.

### E851: Event name missing

**Message:** `MessageBus.…(event, ...): the event name must be a non-empty string, got ….`

**Cause:** The event name is empty or not a string.

**Fix:** Pass a non-empty string.

### E852: Subscriber is not a function

**Message:** `MessageBus.…(event, callback): callback must be a function, got ….`

**Cause:** The callback given to `subscribe` / `unsubscribe` (or `$on` / `$off`) is not a function.

**Fix:** Pass a function.

### E853: Unsubscribing a callback that is not subscribed

**Message:** `MessageBus.unsubscribe("…", callback): that callback is not subscribed to "…". Pass the same function that was subscribed (or call the function subscribe() returned).`

**Cause:** The function passed to `unsubscribe` (or `$off`) is not subscribed to that event: a different function (a new arrow function with the same body is a different function), the wrong event, already removed, or a `$once` callback that already ran.

**Fix:** Pass the same function that was subscribed, or call the function `subscribe` / `$on` returned.

### E854: Middleware is not a function

**Message:** `MessageBus.use(middleware): middleware must be a function, got ….`

**Cause:** `use` / `$use` got something other than a function.

**Fix:** Pass `function (eventData) { ... }`.

### E855: Events publishing each other forever

**Message:** `MessageBus stopped an infinite loop: events kept publishing each other for … rounds; the queued events were dropped (…). A subscriber probably publishes an event that leads back to itself.`

**Cause:** Subscribers kept publishing events for 100 rounds; the queued events were dropped. Reported to `Stitch.onError`.

**Fix:** Find the subscriber that publishes an event leading back to itself, and break the loop.

## E9xx: Error hooks, update loops and internal errors

The E99x errors should not occur in normal use; if you see one, it is probably a bug in Stitch or code that uses its internals.

[E901](#e901-onerror-or-onbindreport-without-a-function) · [E902](#e902-second-onerror-or-onbindreport-handler) · [E911](#e911-updates-triggering-each-other-forever) · [E912](#e912-an-effect-re-running-itself) · [E991](#e991-effect-on-a-disposed-reactive-system) · [E992](#e992-scheduler-got-something-that-is-not-an-effect) · [E993](#e993-foreach-binding-missing)

### E901: onError() or onBindReport() without a function

**Message:** `…(fn): fn must be a function (or null to remove the handler), got ….`

**Cause:** The argument is neither a function nor `null`.

**Fix:** Pass a function, or `null` to remove the installed one.

### E902: Second onError() or onBindReport() handler

**Message:** `…(fn): a handler is already installed. Remove it first with …(null) or the function the first …() call returned, then install the new one.`

**Cause:** A different handler is already installed. There is one per page.

**Fix:** Remove the first one (call the function the first call returned, or pass `null`), then install the new one.

### E911: Updates triggering each other forever

**Message:** `Stopped an infinite loop of updates: effects kept re-queuing each other for … rounds (… still queued were dropped). An effect, computed or binding probably writes a value that it, or something it triggers, reads. Move the write out of the effect, or guard it so the value stops changing.`

**Cause:** Effects kept re-running each other for 100 rounds: usually a binding, computed or watch that writes a value it (or something it triggers) reads. Reported to `Stitch.onError`.

**Fix:** Move the write out of the effect, or guard it so the value stops changing.

### E912: An effect re-running itself

**Message:** `Stopped an effect that kept re-running itself: it ran … times inside one change, because it writes a value it reads (for example a $watch callback that writes the watched path). Write only when the value must change (if (value !== wanted)), or move the write to a handler.`

**Cause:** A synchronous effect wrote a value it reads, so it re-ran itself from inside its own run, 100 levels deep: usually a `$watch` callback that writes the watched path every time (`model.$watch('a', v => { model.a = v + 1; })`), or a custom binding's effect that does the same. Stitch stops it before the call stack overflows and reports this error to `Stitch.onError` (uncaught without one); the writes made so far stay.

**Fix:** Write only when the value must change (`if (value !== wanted) model.a = wanted;`), or move the write to a handler.

```js throws
const model = Stitch.Observable.create({ a: 1 });
model.$watch('a', function (value) { model.a = value + 1; });
model.a = 2;
```
Throws: `[Stitch E912]`

### E991: Effect on a disposed reactive system

**Message:** `effect(): this ReactiveSystem was disposed; create a new model to bind again.`

**Cause:** A custom binding created an effect after `reactiveSystem.dispose()`.

**Fix:** Create a new model (and binder) to bind again.

### E992: Scheduler got something that is not an effect

**Message:** `queue() expects a function, got …`

**Cause:** Internal: an effect queue received a non-function.

**Fix:** Report it as a bug.

### E993: foreach binding missing

**Message:** `foreach binding is not available: createBindingRuntime() was given no bindForeach.`

**Cause:** Internal: the binding runtime was built without the list renderer.

**Fix:** Use the published `stitch.js` / `stitch.min.js`; report it as a bug.
