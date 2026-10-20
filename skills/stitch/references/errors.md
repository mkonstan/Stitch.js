# Stitch.js v3 error codes

Generated from the library's error reference; do not edit by hand. Every Stitch error message
starts with its code, then the element and binding: `[Stitch E201] <span data-text="nmae">: ...`.
Find the code below, apply the fix, and read the rest of the message for the names involved.

- Errors found by a call you make (`bind()`, `Observable.create()`, `$on()`, ...) are thrown to
  your code; a `bind()` that throws leaves nothing bound.
- Errors found later, inside an update (a list re-render, a computed, a handler, a change
  handler), go to `Stitch.onError(fn)`; with none installed they are uncaught. The page keeps its
  last good state.
- Match errors by code (`error.message.startsWith('[Stitch E201]')`), never by wording.

## E1xx: Binding syntax

| Code | Cause | Fix |
|---|---|---|
| E101 | Empty binding value | Write the name of a model property, or remove the attribute. |
| E102 | Expression in a binding | Make a computed property that returns the value and bind its name. |
| E103 | Object literal in a binding | Put the object on the model, as a computed if it changes, and bind its name: `data-class="rowClasses"`. |
| E104 | Function call in a binding | Make a computed that returns the formatted value and bind its name. |
| E105 | Several bindings in one attribute | Use one attribute per binding: `data-value="city" data-visible="hasCity"`. |
| E106 | Not a property path | Use names of letters, digits, `_` and `$` joined by dots: `items.0.title`. |
| E107 | Not a property path (model helpers) | Pass a dotted name such as `"user.name"`. |
| E108 | Handler is not a name | Name the method only: `data-click="save"`. It is called with `(item, event)`, so it does not need arguments in the attribute. |
| E109 | Handler prefix without a name | Add the method name: `$root.save`. |
| E110 | Two scope prefixes in a handler | Put the method on the root model and use `$root.name`. |

## E2xx: Missing and non-reactive properties

| Code | Cause | Fix |
|---|---|---|
| E201 | A binding names a property the model does not have | Fix the name, or declare the property in `Observable.create()` with a starting value (`null` is fine). For rows from a server, add missing fields before creating the model. |
| E202 | A path walks through a plain value | Fix the path, or make that value an object. |
| E203 | A binding names a property that is not reactive | Rename it without the `_`, or declare it in `Observable.create()`, or add it with `model.$set(name, value)`. |
| E204 | $watch, $get or $set names a property the model does not have | Fix the name, or declare the property in `Observable.create()`. To add a new property, call `$set(name, value)` with a single name. |
| E205 | $watch names a property that is not reactive | Declare the property in `Observable.create()` (or add it with `$set`), without a leading `_`. |

## E3xx: Binding values and two-way bindings

| Code | Cause | Fix |
|---|---|---|
| E301 | data-text bound to a function | Make the value a computed (`Stitch.computed(function () { ... })`) and bind that. |
| E302 | data-class value of the wrong kind | Return a class string or an object from a computed. |
| E303 | data-attr value of the wrong kind | Bind an object such as `{ href: url, target: "_blank" }`, usually a computed. |
| E304 | data-event value of the wrong kind | Put an object such as `{ input: "validate", blur: "$root.save" }` on the model and bind its name. |
| E305 | data-event entry of the wrong kind | Map each event to a handler name or a function. |
| E311 | data-value on a computed | Bind the computed one-way (`data-text`), or bind `data-value` to the plain property it is computed from. |
| E312 | data-value on a read-only getter | Bind it one-way, or bind a writable property. |
| E313 | data-value on a row-context value | Bind a property of the row (`data-value="name"` or `data-value="$data.name"` in a list of objects) or of the model (`data-value="$root.selected"`). For a `<select>` whose options come from a list of plain values, write `<option data-text="$data"></option>` without `data-value`: an option without a value uses its text as its value. |
| E314 | Writing through a null object | Give the object a value first (`address: { city: "" }`), or hide the input while it is `null` (`data-visible="address"`). |
| E321 | Event-handler attribute from data | Attach behaviour with `data-click` or `data-event`, which call a handler on the model. |
| E322 | srcdoc from data | Point the frame's `src` at a page, or show the text with `data-text` (which is always text). |
| E323 | javascript: or vbscript: URL from data | Use an `http(s):`, `mailto:`, `tel:`, `#anchor` or relative URL. A URL that only contains `javascript:` later on (`/go?next=javascript:x`) is allowed. |
| E324 | data: URL from data | Serve the content from a URL, or show an inline image with `<img data-attr="...">` and `{ src: 'data:image/png;base64,...' }`. |
| E325 | style string from data | Give `style` an object such as `{ color: 'red', fontSize: '12px' }`. Each property is set through the CSSOM (`element.style.setProperty`), which the policy allows; prefer classes (`data-class`) where you can. |
| E326 | Binding on a script, style, base or meta element | Bind an ordinary element. To show code as text, put it in a `<pre>` or `<code>` with `data-text`. |
| E327 | Security-sensitive attribute from data | Write the attribute in the markup. If it must differ by case, render the variants in the markup and show one with `data-visible`. |
| E328 | rel="opener" from data | Leave `rel` out, or use `rel: 'noopener noreferrer'`. |
| E329 | rel protection from the markup dropped by data | Keep the markup's tokens in the value (`rel: 'noopener noreferrer nofollow'`), or leave `rel` out of the object. |

## E4xx: Handlers

| Code | Cause | Fix |
|---|---|---|
| E401 | Handler not found | Use the prefix the message suggests, usually `$root.name` (or `$parent.name` in a top-level list). For a method more than one level up, move it to the root model. |
| E402 | Handler is not a function | Name a method, or turn the property into one. |
| E403 | $parent. outside a list | Use the bare name. |
| E404 | Handler in a row template not found (checked at bind) | Use the bare name if it is a method of each row, `$root.name` if it is on the root model. |
| E405 | $parent. handler in a row template is not a function | Name a method. |
| E406 | Root handler in a row template not found (checked at bind) | Add the method to the root model, or use the bare name if it is a method of each row, `$parent.name` if it is on the enclosing row. |
| E407 | $root. handler in a row template is not a function | Name a method. |

## E5xx: Lists

| Code | Cause | Fix |
|---|---|---|
| E501 | A row has no key | Add `data-key="field"` naming the field that identifies a row, or give every row an `id`. |
| E502 | Two rows have the same key | Remove the duplicate, or key the rows by a field that is unique (`data-key`). For plain values that repeat, use objects with an `id`. |
| E503 | A row is null or undefined | Remove empty entries before you assign the list. |
| E504 | data-key on a list of plain values | Remove `data-key`: each plain value is its own key. |
| E505 | Empty data-key | Name the key field (`data-key="sku"`), or remove the attribute to use `id`. |
| E511 | Row template with several root elements | Wrap them in one element (a `<div>`, `<li>` or `<tr>`). |
| E512 | Empty row template | Put one row element inside the list element, or inside the `<template>` named by `data-template`. |
| E513 | Row template is only text | Wrap it in an element, for example `<span data-text="$data"></span>`. |
| E514 | data-template names no element | Add `<template id="...">` with one row element inside, or fix the id. |
| E515 | data-template names an element that is not a template | Use a `<template>` element. |
| E516 | data-template list with content inside | Remove the inner elements, or remove `data-template` to use them as the template. |
| E521 | data-foreach bound to something that is not an array | Bind an array. For an object of rows, bind a computed that returns `Object.values(...)` with keys. |
| E531 | data-key or data-template without data-foreach | Add `data-foreach` to the element, or remove the attribute. |
| E532 | data-default-text or data-default-value outside a select list | Move them to the `<select data-foreach>`, or remove them. |
| E533 | data-default-value without data-default-text | Add `data-default-text="Choose..."`, or remove `data-default-value`. |
| E534 | data-text and data-foreach on one element | Put the text on another element, such as a heading before the list. |
| E535 | data-text on an element that contains bound elements | Put the text in its own element (a `<span>`) next to the bound elements. |

## E6xx: DataBinder and custom bindings

| Code | Cause | Fix |
|---|---|---|
| E601 | Element already bound | Call `unbind()` on the root that bound it (or `dispose()` that binder) first, then bind again. |
| E602 | Selector matches nothing | Fix the selector, or run the script after the element is in the page (at the end of `<body>`, or on `DOMContentLoaded`). |
| E603 | Not an element | Pass an element or a CSS selector. |
| E604 | bind() without a model | Create it with `Stitch.Observable.create(data)`. |
| E605 | bind() after dispose() | Create a new `Stitch.DataBinder()`. |
| E606 | unbind() after dispose() | Remove the call. |
| E607 | unbind() of an element with nothing bound | Pass the element given to `bind()` (or an ancestor), with the binder that bound it. |
| E611 | Hooks are not an object | Pass `{ onBind, onChange, properties }` or nothing. |
| E612 | Unknown hook | Fix the name. |
| E613 | Hook is not a function | Pass a function. |
| E614 | properties hook is not an object | Pass `{ propertyName: { onBind, onChange } }`. |
| E615 | Property hooks are not an object | Pass `{ onBind, onChange }` for each property. |
| E616 | Unknown property hook | Fix the name. |
| E617 | Property hook is not a function | Pass a function. |
| E621 | registerBinding() after bind() | Register every custom binding before the first `bind()`, for example at the top of your page script. |
| E622 | Binding name is not a string | Pass the name as a string: `registerBinding("tooltip", ...)`. |
| E623 | Invalid binding name | Use lowercase letters, digits and dashes: `my-binding`. |
| E624 | Binding name reserved | Choose another name. |
| E625 | Binding handler without bind() | Pass `{ bind(element, model, value, context) { ... } }`. |
| E626 | Invalid value kind | Use `"path"` (the attribute names a model property) or `"literal"` (the attribute text is passed as is). |
| E627 | Binding name taken | Choose another name. |

## E7xx: Models and computed properties

| Code | Cause | Fix |
|---|---|---|
| E701 | create() without an object | Pass a plain object. For an array, use `Observable.createArray()`. |
| E702 | createArray() without an array | Pass an array. |
| E703 | create() of a model | Use the model you have, or pass a plain copy (`Stitch.Observable.toRaw(model)`). |
| E704 | create() or reactive() of an object inside a model | Use the root model, or make a separate model from a copy: `Observable.create(Observable.toRaw(model.user))`. |
| E705 | Options are not an object | Pass `{ isolated: true }` or nothing. |
| E706 | Unknown option | Remove the option. |
| E707 | Arrow function as a method | Write `name() { ... }` or `name: function () { ... }`. |
| E708 | Arrow function assigned to a property | Assign a regular function or method. |
| E709 | Reserved field name | Rename the field when the data arrives, for example to `jsonValue`. |
| E710 | A model inside another model | Assign plain data, or a copy: `app.cart = Stitch.Observable.toRaw(cart)`. |
| E711 | One array, Map or Set in two models | Give each model its own copy: `[...countries]`, `new Map(rates)`, `new Set(codes)`. |
| E712 | delete on a list, Map or Set | Use `list.splice(index, 1)`, `map.delete(key)` or `set.delete(value)`. On objects, set the property to `null` (deleting a model object's property fails: in strict mode with the browser's own `TypeError`, in sloppy mode silently returning `false`). |
| E713 | Assignment to a computed | Change the properties it is computed from. |
| E714 | Frozen, sealed or non-extensible data | Pass a copy: `structuredClone(data)`, or `{ ...data }` / `[...list]` for one level. |
| E721 | computed() of the wrong kind | Pass `function () { return ...; }` or `{ get() { ... }, deps: [...] }`. |
| E722 | deps is not an array | Pass an array of property names, or leave `deps` out (dependencies are tracked automatically). |
| E723 | Computed deps form a cycle | Remove the computed from its own dependency chain. |

## E8xx: Model helpers, events and the message bus

| Code | Cause | Fix |
|---|---|---|
| E801 | Events on a nested object, row or list | Call it on the root model. From a list row, call a root method with `data-click="$root.handler"` and emit from there. |
| E802 | v2 helper name | Use `$onChange` (was `on`), `$offChange` (was `off`), `$get` (was `get`), `$set` (was `set`). Events use `$on(event, callback)` / `$off(event, callback)`. |
| E803 | $onChange() with an event name | For events, use `$on(event, callback)`. |
| E804 | $onChange() with several arguments | Pass only the handler. |
| E805 | $onChange() without a function | Pass a function. |
| E806 | $offChange() with an event name | For events, use `$off(event, callback)`. |
| E807 | $offChange() without the handler | Pass the function given to `$onChange`, once per handler. |
| E808 | $offChange() with a value that is not a function | Pass the function given to `$onChange`. |
| E809 | $offChange() of a handler that is not installed | Pass the same function given to `$onChange` on the same object. |
| E810 | $on() with swapped arguments | Write `$on(event, callback)`. |
| E811 | $on() with only a function | For change handlers use `$onChange(fn)`; for events `$on(event, callback)`. |
| E812 | $on() with the wrong number of arguments | Pass both. |
| E813 | $off() without both arguments | Pass both, or use the function `$on` returned. For change handlers use `$offChange(fn)`. |
| E814 | $once() without an event name | Write `$once(event, callback)`. |
| E815 | $once() without a callback | Pass a function. |
| E816 | $set() without a name | Pass the property name or path as a string. |
| E817 | $watch() without a callback | Pass a function `(newValue, oldValue, info) => { ... }`. |
| E851 | Event name missing | Pass a non-empty string. |
| E852 | Subscriber is not a function | Pass a function. |
| E853 | Unsubscribing a callback that is not subscribed | Pass the same function that was subscribed, or call the function `subscribe` / `$on` returned. |
| E854 | Middleware is not a function | Pass `function (eventData) { ... }`. |
| E855 | Events publishing each other forever | Find the subscriber that publishes an event leading back to itself, and break the loop. |

## E9xx: Error hooks, update loops and internal errors

| Code | Cause | Fix |
|---|---|---|
| E901 | onError() or onBindReport() without a function | Pass a function, or `null` to remove the installed one. |
| E902 | Second onError() or onBindReport() handler | Remove the first one (call the function the first call returned, or pass `null`), then install the new one. |
| E911 | Updates triggering each other forever | Move the write out of the effect, or guard it so the value stops changing. |
| E991 | Effect on a disposed reactive system | Create a new model (and binder) to bind again. |
| E992 | Scheduler got something that is not an effect | Report it as a bug. |
| E993 | foreach binding missing | Use the published `stitch.js` / `stitch.min.js`; report it as a bug. |
