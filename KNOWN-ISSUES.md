# Known Issues - Stitch.js

This file lists the defects known in the current code. None of them is fixed yet.

Each defect has a test that asserts the intended (v3) behaviour and fails today. The tests are
listed in `tests/known-failing.json`, so `npm test` reports them as known-failing instead of
failing the build, but only while each fails with exactly the assertions recorded for it; a
failure for any other reason fails the build. When a fix makes its test pass, `npm test` fails until the entry is removed
from that file, so this list and the code cannot silently drift apart.

An earlier version of this file said there were no known issues and that all suites passed. That
was not true: the defects below were present, and the old test runner could pass without running
some tests.

| # | Defect | Test (`<page>#<test id>`) | Target |
|---|---|---|---|
| 1 | A list whose rows have no key (`id`) renders by row position. When the list is filtered or reordered, rows can show the wrong items. No error is raised. | `test-v3-defects.html#d1-keyless-row-throws` | T1 |
| 2 | Reloading a list with new objects that have the same ids keeps the old rows bound to the old objects, so the page keeps showing the old values. | `test-v3-defects.html#d2-same-id-new-object-rebinds` | T1 |
| 3 | Rows removed from a list (for example by hiding and showing it) keep their bindings alive. Each later change runs once per leaked binding, and the leak grows with every cycle. | `test-v3-defects.html#d3-hidden-rows-release-bindings` | T1 |
| 4 | In a nested list, a click handler cannot reach the root model: there is no `$root.` path, and `data-click="$root.remove"` does nothing, silently. | `test-v3-defects.html#d4-root-handler-in-nested-foreach` | T2 |
| 5 | Mistakes are silent. A misspelled binding name (`data-txet`) is ignored, and `Stitch.debug.enable()` does not turn on the binder's warnings, so debug mode reports nothing. | `test-v3-defects.html#d5-strict-bindings-and-one-debug-switch`, `test-warnings.html#warns-missing-property`, `test-warnings.html#warns-missing-keys`, `test-warnings.html#warns-select-performance` | T2 |
| 6 | An effect that read a computed property keeps running after it is cleaned up (for example after `binder.unbind(element)`), and keeps writing to its element. | `test-v3-defects.html#d6-computed-reader-stops-after-cleanup` | T1 |
| 7 | A list row template with more than one root element (for example `<h4>` followed by `<ul>` inside a `data-foreach` container) silently renders only the first root; the rest, including any nested list, never appears. No error is raised. v3 requires exactly one root element and throws otherwise. | `test-v3-defects.html#d7-multi-root-row-template-throws` | T1 |

"Target" is the planned hardening sprint for the next major release (v3): T1 covers list correctness and
binding lifecycle, T2 covers strictness and debug mode.

## How to check

```bash
npm test
```

The summary prints, for `stitch.js` and `stitch.min.js`, how many tests passed, how many are
known-failing (the tests above), and how many failed or were skipped (both must be 0).
To see one defect in a browser, open its page (for example `test-v3-defects.html`); the
`[harness]` line at the top shows the results and each failed assertion is in the report.
