# Accessibility with Stitch.js

Stitch renders **your** markup. It sets text, values, classes, attributes and visibility on the
elements you wrote, and it adds or removes list rows. It does not add roles, labels or ARIA
states, and it does not move focus. So the page is as accessible as the HTML you write, and the
patterns below show how to keep it that way while the data changes. Every example on this page is
executed by the test suite.

What Stitch does on its own:

| Binding | What assistive technology sees |
|---|---|
| `data-text` | the new text (never markup) |
| `data-visible` | `display: none` when false: the element is hidden from screen readers too, but stays in the page with its bindings |
| `data-enabled` | the `disabled` property: a disabled control is announced as unavailable and skipped by Tab |
| `data-loading` | `disabled`, class `loading`, and `aria-busy="true"` / `"false"` |
| `data-foreach` | rows added and removed as elements; a row whose key stays keeps its element |
| `data-attr` | exactly the attributes you list, including `aria-*` |

What it does not do: it does not announce changes, move focus, label controls or set any ARIA
state other than `aria-busy` from `data-loading`. Those are yours, and the patterns are short.

## Use real controls

Put `data-click` on a `<button>`, not on a `<div>` or `<span>`: a button is reachable with Tab and
activated with Enter and Space; a `<div>` is not. Inside a `<form>`, give buttons `type="button"`
unless they submit.

```html page
<div id="app">
    <button id="more" type="button" data-click="more">Show more</button>
    <span id="count" data-text="count"></span>
</div>
```

```js run
const model = Stitch.Observable.create({
    count: 0,
    more() { this.count++; }
});
new Stitch.DataBinder().bind('#app', model);
```
<!-- check: click('#more') -->
<!-- check: text('#count') === '1' -->

## Label every control

A static `<label for>` is the simplest label and needs no binding. When the label text comes from
data, bind the label's text; when there is no visible label, bind `aria-label` with `data-attr`.

```html page
<div id="app">
    <label for="amount" data-text="amountLabel"></label>
    <input id="amount" type="number" data-value="amount">
    <input id="search" type="search" data-value="query" data-attr="searchAttrs">
</div>
```

```js run
const model = Stitch.Observable.create({
    currency: 'USD',
    amount: 100,
    query: '',
    amountLabel: Stitch.computed(function () { return 'Amount (' + this.currency + ')'; }),
    searchAttrs: Stitch.computed(function () { return { 'aria-label': 'Search ' + this.currency + ' accounts' }; })
});
new Stitch.DataBinder().bind('#app', model);
```
<!-- check: text('label') === 'Amount (USD)' && attr('#search', 'aria-label') === 'Search USD accounts' -->

## ARIA states are strings

`data-attr` writes `true` as an empty attribute and removes the attribute for `false`. That suits
HTML boolean attributes (`hidden`, `open`), but ARIA states need the strings `"true"` and
`"false"`: `aria-expanded=""` is not "expanded". Return strings from the computed.

```html page
<div id="app">
    <button id="toggle" type="button" aria-controls="details" data-click="toggle" data-attr="toggleAttrs">Details</button>
    <div id="details" data-visible="open">Account details</div>
</div>
```

```js run
const model = Stitch.Observable.create({
    open: false,
    toggle() { this.open = !this.open; },
    toggleAttrs: Stitch.computed(function () { return { 'aria-expanded': this.open ? 'true' : 'false' }; })
});
new Stitch.DataBinder().bind('#app', model);
```
<!-- check: attr('#toggle', 'aria-expanded') === 'false' && !visible('#details') -->
<!-- check: click('#toggle') -->
<!-- check: attr('#toggle', 'aria-expanded') === 'true' && visible('#details') -->

## Showing and hiding: data-visible or removal

Both hide content from everyone, screen readers included:

- `data-visible="flag"` sets `display: none`. The element stays in the page, keeps its bindings and
  its state (a half-typed input keeps its text), and comes back as it was. Its bindings must still
  resolve while it is hidden.
- A list that returns `[this]` or `[]` (see the Guide's "Showing an element only for some rows")
  removes the element. It is built again when it comes back, with no leftover state.

Do not hide content with `aria-hidden` alone: it stays visible and focusable for keyboard users.
To hide something only visually (a label for screen readers), use a CSS class such as
`.visually-hidden`, not `data-visible`.

## Announce changes with a live region

A screen reader does not read text that changes somewhere else on the page unless that place is a
live region. Put status and result messages in an element with `role="status"` (polite) or
`role="alert"` (urgent) that is in the page from the start, and change its text with `data-text`.
Keep the region always rendered: a region that appears together with its text is often not
announced, so do not put `data-visible` on it.

```html page
<div id="app">
    <button id="save" type="button" data-click="save">Save</button>
    <p id="status" role="status" data-text="status"></p>
</div>
```

```js run
const model = Stitch.Observable.create({
    status: '',
    save() { this.status = 'Saved at 10:42'; }
});
new Stitch.DataBinder().bind('#app', model);
```
<!-- check: text('#status') === '' -->
<!-- check: click('#save') -->
<!-- check: text('#status') === 'Saved at 10:42' && attr('#status', 'role') === 'status' -->

## Loading states

`data-loading` on a button disables it and sets `aria-busy`. For a region that is reloading, bind
`aria-busy` on the region itself with `data-attr`, and say what is happening in a live region.

```html page
<div id="app">
    <button id="refresh" type="button" data-click="refresh" data-loading="loading">Refresh</button>
    <section id="results" data-attr="resultsAttrs">
        <p role="status" data-text="loadingText"></p>
    </section>
</div>
```

```js run
const model = Stitch.Observable.create({
    loading: false,
    refresh() { this.loading = true; },
    resultsAttrs: Stitch.computed(function () { return { 'aria-busy': this.loading ? 'true' : 'false' }; }),
    loadingText: Stitch.computed(function () { return this.loading ? 'Loading results' : ''; })
});
new Stitch.DataBinder().bind('#app', model);
```
<!-- check: attr('#refresh', 'aria-busy') === 'false' && attr('#results', 'aria-busy') === 'false' -->
<!-- check: click('#refresh') -->
<!-- check: attr('#refresh', 'aria-busy') === 'true' && document.getElementById('refresh').disabled && attr('#results', 'aria-busy') === 'true' && text('#results p') === 'Loading results' -->

## Validation messages

Tie each message to its field: `aria-invalid` says the value is wrong, `aria-describedby` points at
the element that says why. Bind both with `data-attr`; `null` removes an attribute, so a valid
field carries neither. Keep the message element in the page (it can be empty) so the reference
always resolves.

```html page
<div id="app">
    <label for="email">Email</label>
    <input id="email" type="email" data-value="email" data-attr="emailAttrs">
    <p id="email-error" data-text="emailError"></p>
</div>
```

```js run
const model = Stitch.Observable.create({
    email: 'ada@example.com',
    emailError: Stitch.computed(function () { return /^[^@\s]+@[^@\s]+$/.test(this.email) ? '' : 'Enter an email address like name@example.com'; }),
    emailAttrs: Stitch.computed(function () {
        const bad = this.emailError !== '';
        return { 'aria-invalid': bad ? 'true' : null, 'aria-describedby': bad ? 'email-error' : null };
    })
});
new Stitch.DataBinder().bind('#app', model);
```
<!-- check: attr('#email', 'aria-invalid') === null && attr('#email', 'aria-describedby') === null -->
<!-- check: type('#email', 'ada') -->
<!-- check: attr('#email', 'aria-invalid') === 'true' && attr('#email', 'aria-describedby') === 'email-error' && text('#email-error').indexOf('Enter an email') === 0 -->

## Focus after list changes

A row whose key stays keeps its element, so a control inside it keeps focus while other rows come
and go. When the focused row itself is removed, its element leaves the page and focus falls back
to the page body, where a keyboard user loses their place. Move focus yourself, after the list has
updated: Stitch updates the page in a microtask after the change, so focus in a
`Promise.resolve().then(...)` callback (or later). A heading with `tabindex="-1"` is a good
target: it can take focus from code without joining the Tab order.

```html page
<div id="app">
    <h2 id="accounts-heading" tabindex="-1">Accounts</h2>
    <ul data-foreach="accounts">
        <li><span data-text="name"></span> <button type="button" data-click="$root.remove">Remove</button></li>
    </ul>
</div>
```

```js run
const model = Stitch.Observable.create({
    accounts: [{ id: 1, name: 'Growth' }, { id: 2, name: 'Income' }],
    remove(account) {
        this.accounts.splice(this.accounts.indexOf(account), 1);
        // The row is gone after the next update; then put focus somewhere stable.
        Promise.resolve().then(() => document.getElementById('accounts-heading').focus());
    }
});
new Stitch.DataBinder().bind('#app', model);
```
<!-- check: document.querySelector('li button').focus() || document.activeElement.tagName === 'BUTTON' -->
<!-- check: click('li button') -->
<!-- check: count('li') === 1 && document.activeElement.id === 'accounts-heading' -->

For a list that is filtered as the user types, leave focus in the filter input; announce the
number of results in a live region instead ("4 accounts").
