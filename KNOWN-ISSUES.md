# Known Issues - Stitch.js

This file lists the defects known in the current code, and the ones already fixed on the way to v3.

Each open defect has a test that asserts the intended (v3) behaviour and fails today. The tests are
listed in `tests/known-failing.json`, so `npm test` reports them as known-failing instead of
failing the build, but only while each fails with exactly the assertions recorded for it; a
failure for any other reason fails the build. When a fix makes its test pass, `npm test` fails until the entry is removed
from that file, so this list and the code cannot silently drift apart.

An earlier version of this file said there were no known issues and that all suites passed. That
was not true: the defects below were present, and the old test runner could pass without running
some tests.

There are no open defects: `tests/known-failing.json` is empty.

The hardening for the next major release (v3) runs in sprints: T1 covered list correctness and
binding lifecycle, T2 strictness (mistakes throw, errors in reactive updates are reported, no debug
switch).

### Fixed

These were fixed in T1 and T2. Their tests stay in place and now pass on every run, so a regression
fails the build.

| # | Defect | Test (`<page>#<test id>`) | Fixed in |
|---|---|---|---|
| 1 | A list whose rows have no key (`id`) renders by row position. When the list is filtered or reordered, rows can show the wrong items. No error is raised. | `test-v3-defects.html#d1-keyless-row-throws` | T1 |
| 2 | Reloading a list with new objects that have the same ids keeps the old rows bound to the old objects, so the page keeps showing the old values. | `test-v3-defects.html#d2-same-id-new-object-rebinds` | T1 |
| 3 | Rows removed from a list (for example by hiding and showing it) keep their bindings alive. Each later change runs once per leaked binding, and the leak grows with every cycle. | `test-v3-defects.html#d3-hidden-rows-release-bindings` | T1 |
| 4 | In a nested list, a click handler could not reach the root model: there was no `$root.` path, and `data-click="$root.remove"` did nothing, silently. v3: a handler is a bare name (current row), `$parent.name` or `$root.name`; it receives the row item; a name that is not found throws. | `test-v3-defects.html#d4-root-handler-in-nested-foreach` | T2 |
| 5 | Mistakes were silent. A misspelled binding name (`data-txet`) was ignored, a binding to a missing property showed nothing, and `Stitch.debug.enable()` did not turn on the binder's warnings, so debug mode reported nothing. v3 (D24-D26): Stitch reads only its own attributes, so a misspelled name is not Stitch's and is listed as ignored by `Stitch.onBindReport`; invalid syntax and missing properties throw; there is no debug switch (`Stitch.debug.stats()` remains). | `test-v3-defects.html#d5-misspelled-binding-reported-and-no-debug-switch` | T2 |
| 6 | An effect that read a computed property keeps running after it is cleaned up (for example after `binder.unbind(element)`), and keeps writing to its element. | `test-v3-defects.html#d6-computed-reader-stops-after-cleanup` | T1 |
| 7 | A list row template with more than one root element (for example `<h4>` followed by `<ul>` inside a `data-foreach` container) silently renders only the first root; the rest, including any nested list, never appears. No error is raised. v3 requires exactly one root element and throws otherwise. | `test-v3-defects.html#d7-multi-root-row-template-throws` | T1 |

## How to check

```bash
npm test
```

The summary prints, for `stitch.js` and `stitch.min.js`, how many tests passed, how many are
known-failing (the tests above), and how many failed or were skipped (both must be 0).
To see one defect in a browser, open its page (for example `test-v3-defects.html`); the
`[harness]` line at the top shows the results and each failed assertion is in the report.
