# Stitch.js

Reactive data binding for plain HTML pages: one script tag, no dependencies, no build step.

You write HTML with `data-*` attributes that name properties, create a model object, and bind the
two. When the model changes, the page follows; when the user types into a bound input, the model
follows. Stitch fits server-rendered pages, internal tools and any page where you want reactive
forms and lists without adopting a framework.

Stitch is strict. A binding to a property that does not exist, a list row without a key, an
expression in an attribute or a handler that cannot be found is an error that names the element,
the binding and the fix, never a silent blank.

## Quick start

Copy `stitch.js` (or `stitch.min.js`) next to your page:

```html run
<!doctype html>
<html>
<head>
    <meta charset="utf-8">
    <script src="stitch.js"></script>
</head>
<body>
    <div id="app">
        <input id="name" data-value="name">
        <p id="greeting" data-text="greeting"></p>
        <ul data-foreach="people">
            <li data-text="name"></li>
        </ul>
    </div>
    <script>
        const model = Stitch.Observable.create({
            name: 'Ada',
            people: [{ id: 1, name: 'Grace' }, { id: 2, name: 'Alan' }],
            greeting: Stitch.computed(function () { return 'Hello, ' + this.name + '!'; })
        });
        new Stitch.DataBinder().bind('#app', model);
    </script>
</body>
</html>
```
<!-- check: text('#greeting') === 'Hello, Ada!' && texts('#app li').join(',') === 'Grace,Alan' -->
<!-- check: type('#name', 'Lin') -->
<!-- check: text('#greeting') === 'Hello, Lin!' -->

Type in the box and the greeting follows. Add a person with `model.people.push({ id: 3, name: 'Lin' })`
and a row appears.

## Bindings

`data-text`, `data-value` (two-way), `data-visible`, `data-enabled`, `data-class`, `data-attr`,
`data-loading`, `data-click`, `data-event`, `data-foreach` (keyed lists, with `data-key` and
`data-template`). Logic lives in computed properties, not in attributes.

## Documentation

- [Guide](docs/GUIDE.md): models, bindings, lists, handlers, forms, computeds, events, errors,
  custom bindings, lifecycle.
- [API reference](docs/API.md): every name, signature, return value and error.
- [Error reference](docs/ERRORS.md): every error message, its cause and its fix.
- [AGENTS.md](AGENTS.md): the rules in short form, for AI agents and quick reference.
- [Migration guide](MIGRATION.md): upgrading from v2.
- [Changelog](CHANGELOG.md).
- [Examples](#examples) below.

The code blocks in these documents are run by the test suite, so they work as written.

## Examples

Open any `example-*.html` page in a browser (served over HTTP, for example with
`npx http-server`): cascading dropdowns, dynamic validation, a shopping cart, an editable table,
conditional forms, search and filter, a wizard, nested computeds, event bindings, dropdowns, and
attribute and class bindings. `example-basic-demo.html` shows the basics on one page.

## Browser support

Stitch needs `Proxy`, `WeakMap`, `Map`, `Set` and `Promise`. The test suite runs in Chromium.

## Development

The source is in `packages/`; `stitch.js` and `stitch.min.js` are generated from it.

```bash
npm install
npx playwright install chromium
npm run build    # regenerate stitch.js and stitch.min.js
npm test         # static checks, every suite on both builds, gate self-tests
```

See [ARCHITECTURE.md](ARCHITECTURE.md) for the module layout and the test harness, and
[KNOWN-ISSUES.md](KNOWN-ISSUES.md) for known defects.

## License

MIT. See [LICENSE](LICENSE).
