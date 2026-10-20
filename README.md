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
- [Accessibility](docs/ACCESSIBILITY.md): what Stitch does for assistive technology, and the
  patterns for labels, ARIA states, live regions, loading, validation and focus.
- [RELEASE.md](RELEASE.md): how a version is released.
- [AGENTS.md](AGENTS.md): the rules in short form, for AI agents and quick reference.
- [Claude skill](#ai-agents): `skills/stitch/`, for Claude Code and the Agent SDK.
- [Migration guide](MIGRATION.md): upgrading from v2.
- [Changelog](CHANGELOG.md).
- [Examples](#examples) below.

The code blocks in these documents are run by the test suite, so they work as written.

## AI agents

[AGENTS.md](AGENTS.md) lists the rules in short form. For Claude (Claude Code or the Agent SDK),
the `skills/stitch/` folder is a skill: it loads when a page uses Stitch and gives the model the
rules, a page to start from, recipes, gotchas, the attribute grammar and every error code. Install
it by copying the folder into your project's `.claude/skills/` folder (or `~/.claude/skills/` for
every project):

```bash
cp -r skills/stitch your-project/.claude/skills/stitch
```

## Examples

Open any `example-*.html` page in a browser (served over HTTP, for example with
`npx http-server`): cascading dropdowns, dynamic validation, a shopping cart, an editable table,
conditional forms, search and filter, a wizard, nested computeds, event bindings, dropdowns, and
attribute and class bindings. `example-basic-demo.html` shows the basics on one page.

## Browser support

**Policy:** the current and the previous year's versions of Chrome, Edge, Firefox and Safari
(desktop and mobile). Every push runs the whole test suite, on both `stitch.js` and
`stitch.min.js`, in the three engines behind them: Chromium (Chrome, Edge), Firefox and WebKit
(Safari), including a page served with a strict Content-Security-Policy.

The newest language and DOM features the library uses, read from its code (the test suite checks
this table against the code):

| Feature | Chrome | Edge | Firefox | Safari |
|---|---|---|---|---|
| Optional chaining (`?.`) | 80 | 80 | 74 | 13.1 |
| `Element.replaceChildren()` | 86 | 86 | 78 | 14 |

Minimum versions: Chrome 86, Edge 86, Firefox 78, Safari 14.

These minimums are derived from the APIs the library uses; they are not tested on those versions.
Versions older than the policy's are not tested and not supported, even where they meet these
minimums. Internet Explorer is not supported.

Under a strict Content-Security-Policy (no `'unsafe-inline'`, no `'unsafe-eval'`,
`require-trusted-types-for 'script'`) Stitch needs nothing allowed: it never writes HTML strings,
script strings or style strings. Chrome and Edge enforce Trusted Types, and so does the current
Safari (verified on the WebKit 26 engine the tests run); older Safari versions do not, and Firefox
ignores that directive and enforces the rest of the policy.

What Stitch guards and what the page must: `data-attr` refuses values that could run script
(`javascript:`, `vbscript:` and most `data:` URLs, event handlers, `srcdoc`, style strings) and
security-sensitive attribute names. Its URL check is a **scheme check only**: an `https:` URL to any
host is written, whether it is a link, an image, a stylesheet or a form `action`. Which origins
the page may load from, frame or submit to is the page's own policy. With data in attributes, a
client-facing page should also set `form-action 'self'` (not covered by `default-src`),
`frame-src` / `object-src`, and `img-src 'self' data:` if it shows `data:image` sources (which
`default-src 'self'` blocks).

## Development

The source is in `packages/`; `stitch.js` and `stitch.min.js` are generated from it.

```bash
npm install
npx playwright install chromium firefox webkit
npm run build    # regenerate stitch.js and stitch.min.js
npm test         # static checks, every suite on three engines and both builds, gate self-tests
```

See [ARCHITECTURE.md](ARCHITECTURE.md) for the module layout and the test harness, and
[KNOWN-ISSUES.md](KNOWN-ISSUES.md) for known defects.

## License

MIT. See [LICENSE](LICENSE).
