# Acceptance tasks

Three pages to build with Stitch.js, from its documentation. Each page has an automated acceptance
test in this folder (`tree.spec.js`, `list.spec.js`, `form.spec.js`) that drives it like a user:
it clicks, types and reads what is shown. The tests find elements only by the `data-testid`
values named below, so use exactly those; everything else about the markup, the styling and the
code is up to you.

For every page:

- Save it at the path given (in `tests/acceptance/pages/`).
- Use Stitch.js and no other library. Load it with `<script src="../../../stitch.js"></script>`.
- The page must load and work without any error in the console.
- "Visible" means shown on screen; an element that is hidden or not rendered counts as not visible.

Run the tests with `npm run test:acceptance`.

## 1. File tree: **tests/acceptance/pages/tree.html**

Show this folder tree (use exactly this data):

```json
[
  { "id": 1, "name": "src", "children": [
    { "id": 2, "name": "app.js" },
    { "id": 3, "name": "lib", "children": [
      { "id": 4, "name": "format.js" },
      { "id": 5, "name": "parse.js" }
    ] },
    { "id": 6, "name": "styles", "children": [
      { "id": 7, "name": "main.css" }
    ] }
  ] },
  { "id": 8, "name": "docs", "children": [
    { "id": 9, "name": "guide.md" }
  ] },
  { "id": 10, "name": "README.md" }
]
```

A node with `children` is a folder; a node without is a file. The tree can be any depth: build it
so that deeper data would also work.

1. Each node is an element with `data-testid="node"`. Inside it, and not inside one of its child
   nodes, are the node's name (`data-testid="node-name"`) and, for a folder only, a toggle button
   (`data-testid="node-toggle"`). A folder's child nodes are inside the folder's node element.
   Files have no toggle.
2. At first every folder is collapsed: only `src`, `docs` and `README.md` are visible, in that order.
3. A collapsed folder's toggle shows `+`, an expanded folder's toggle shows `-`. Clicking the toggle
   expands or collapses that folder. Expanding shows the folder's direct children in data order;
   collapsing hides everything inside it.
4. A folder remembers the state of the folders inside it: expand `src`, expand `lib`, collapse
   `src`, expand `src` again: `lib` is still expanded and format.js is visible.
5. Clicking a node's name selects that node. An element with `data-testid="selected"` shows the
   selected node's path, the names from the top joined by `/` (for example src/lib/format.js).
   Before anything is selected it shows `Nothing selected`.
6. A button `data-testid="expand-all"` expands every folder; a button `data-testid="collapse-all"`
   collapses every folder.

## 2. Stock list: **tests/acceptance/pages/list.html**

Show this list of stocks (use exactly this data; the ticker identifies a stock):

```json
[
  { "ticker": "AAPL", "name": "Apple", "sector": "Technology", "price": 189.5 },
  { "ticker": "MSFT", "name": "Microsoft", "sector": "Technology", "price": 411.2 },
  { "ticker": "JPM", "name": "JPMorgan Chase", "sector": "Financials", "price": 196.8 },
  { "ticker": "XOM", "name": "Exxon Mobil", "sector": "Energy", "price": 112.3 },
  { "ticker": "JNJ", "name": "Johnson & Johnson", "sector": "Health Care", "price": 152.6 },
  { "ticker": "BAC", "name": "Bank of America", "sector": "Financials", "price": 37.9 },
  { "ticker": "CVX", "name": "Chevron", "sector": "Energy", "price": 158.1 },
  { "ticker": "PFE", "name": "Pfizer", "sector": "Health Care", "price": 28.4 }
]
```

1. Each stock is a row element with `data-testid="row"`, containing its ticker
   (`data-testid="row-ticker"`), its name (`data-testid="row-name"`), its price with two decimals
   (`data-testid="row-price"`, e.g. `189.50`), a "watch" checkbox (`data-testid="row-watch"`) and a
   remove button (`data-testid="row-remove"`).
2. Rows are shown in ticker order, A to Z.
3. A text box `data-testid="search"` filters the rows as the user types: a row is shown when its
   ticker or its name contains the text, ignoring case. An empty box shows all rows.
4. A drop-down `data-testid="sector"` filters by sector. Its options are `All sectors` (the first,
   selected at the start, showing every sector) followed by each sector in the data, A to Z, each
   shown once. The search and the sector filter apply together.
5. An element `data-testid="count"` shows `Showing N of M`, where N is the number of rows shown and
   M the number of stocks in the list.
6. An element `data-testid="empty"` with the text `No matching stocks` is visible only when no row is
   shown.
7. Checking a row's watch box marks that stock as watched. The mark belongs to the stock: it is
   still checked when the row is filtered out and shown again. An element
   `data-testid="watched-count"` shows `N watched`.
8. A row's remove button removes that stock from the list for good (the count and the watched count
   follow).

## 3. Sign-up form: **tests/acceptance/pages/form.html**

A form (`data-testid="form"`) with these fields:

| Field | `data-testid` | Kind |
|---|---|---|
| Name | `name` | text input |
| Email | `email` | text or email input |
| Age | `age` | number input |
| Password | `password` | password input |
| Confirm password | `confirm` | password input |
| I accept the terms | `terms` | checkbox |

and a submit button `data-testid="submit"`, which is always enabled.

Each field has an error element: `data-testid="name-error"`, `email-error`, `age-error`,
`password-error`, `confirm-error`, `terms-error`. A field's error is visible only when the field is
invalid AND the user has changed that field (typed in it, even if they then cleared it, or toggled
the checkbox) or has pressed submit. The error shows exactly the first rule that fails:

| Field | Rule | Error text |
|---|---|---|
| Name | not empty (ignoring spaces at the ends) | `Name is required` |
| Email | not empty | `Email is required` |
| Email | looks like `something@domain.tld` (no spaces) | `Enter a valid email address` |
| Age | not empty | `Age is required` |
| Age | a whole number from 18 to 120 | `Age must be between 18 and 120` |
| Password | at least 8 characters | `Password must be at least 8 characters` |
| Confirm | equal to the password | `Passwords do not match` |
| Terms | checked | `You must accept the terms` |

1. When the page opens, no error is visible.
2. Errors update as the user types. Changing the password re-checks the confirmation: if the
   confirmation has been changed (or submit pressed) and no longer matches, its error appears.
3. Pressing submit while anything is invalid shows the error of every invalid field and does not
   submit.
4. Pressing submit when everything is valid hides the form and shows an element
   `data-testid="success"` with the text `Welcome, <name>!`, using the name without spaces at the
   ends (e.g. `Welcome, Ada!`). Before that, the success element is not visible.
