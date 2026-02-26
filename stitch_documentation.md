# Stitch.js v2.1.0 - Complete Documentation

**Version 2.1.0** | **Enterprise MVVM Framework**

> *"Stitching data to the DOM with precision"*

---

## Table of Contents

1. [Overview](#overview)
2. [Quick Start](#quick-start)
3. [Build and Source Layout](#build-and-source-layout)
4. [Core Concepts](#core-concepts)
5. [Custom Attribute Bindings](#custom-attribute-bindings)
6. [Observable System](#observable-system)
7. [Computed Properties](#computed-properties)
8. [Type Conversion System](#type-conversion-system)
9. [Advanced Features](#advanced-features)
10. [API Reference](#api-reference)
11. [Common Patterns](#common-patterns)
12. [Performance](#performance)

---

## Overview

### What is Stitch.js?

Stitch.js is a lightweight, zero-dependency MVVM (Model-View-ViewModel) framework for modern web applications. It provides:

- **Custom Attribute Bindings** - Clean, intuitive `data-text`, `data-value`, `data-visible` syntax
- **Proxy-Based Reactivity** - Automatic change detection with eager conversion
- **Two-Way Data Binding** - Seamless model ↔ view synchronization
- **Type Conversion System** - Automatic int, float, boolean, date conversions
- **Smart DOM Reconciliation** - Focus preservation in editable tables/lists
- **Zero Runtime Dependencies** - Prebuilt `stitch.js` works with script tag only; modular build workflow is available for contributors

### Key Features

- 🧵 **One File Runtime** - Include generated `stitch.js` and start immediately
- ⚡ **Zero Dependencies** - No npm, webpack, or build tools needed
- 🎯 **Enterprise Ready** - Advanced hook system for complex applications
- 🔄 **Eager Reactivity** - All nested objects reactive from creation
- 🎮 **Two-Way Binding** - Form inputs sync automatically
- 📊 **Computed Properties** - Auto-updating derived values
- 🚀 **Performance** - Smart reconciliation, minimal overhead
- 🚨 **Developer Experience** - Helpful error messages

### Philosophy

**Clean Syntax** - Custom attributes are intuitive and discoverable:
```html
<div data-text="message"></div>
<input data-value="username">
<button data-click="handleSubmit">Submit</button>
```

**Eager Reactivity** - All objects become reactive immediately upon creation. No manual tracking, no lazy conversion.

**Type Safety** - Automatic bidirectional type conversion between model and DOM with 7 converters.

### Size & Performance

- **Minified:** ~31 KB
- **Gzipped:** ~10 KB
- **Batched Updates:** 70-80% reduction in DOM update cycles
- **Smart Reconciliation:** 90%+ reduction in DOM mutations

---

## Quick Start

### 1. Include Stitch.js

```html
<!DOCTYPE html>
<html>
<head>
    <script src="stitch.js"></script>
</head>
<body>
    <!-- Your app here -->
</body>
</html>
```

### 2. Create Your Model

```javascript
const model = Stitch.Observable.create({
    // Properties
    message: 'Hello, World!',
    count: 0,
    isActive: true,

    // Computed property
    doubleCount: Stitch.computed(function() {
        return this.count * 2;
    }),

    // Action method
    increment() {
        this.count++;
    }
});
```

### 3. Bind to DOM

```html
<div id="app">
    <h1 data-text="message"></h1>
    <p>Count: <span data-text="count"></span></p>
    <p>Double: <span data-text="doubleCount"></span></p>
    <button data-click="increment">Increment</button>
</div>

<script>
    const binder = new Stitch.DataBinder();
    binder.bind('#app', model);
</script>
```

### 4. See It Work

Changes to `model.count` automatically update all bound elements. Clicking the button triggers `increment()` which updates both `count` and `doubleCount`.

---

## Build and Source Layout

### Source of Truth

- `packages/*` contains the modular runtime source (`api`, `core`, `browser`, `utils`).
- `stitch.entry.js` is the distribution entrypoint that composes those packages.
- `stitch.js` is generated output and should be treated as build artifact.
- `dist/stitch.assembled.js` is the assembled release-candidate artifact.

### Build Commands

```bash
npm install
npx playwright install chromium
npm run build:assembly
```

`npm run build:assembly` (alias: `npm run build:stitch`) runs `_tools/build-stitch-assembly.js` and writes:
- `dist/stitch.assembled.js`
- `stitch.js`

### Validation Commands

```bash
npm run validate:browser
npm run validate:assembly
npm run pipeline:build-compare
```

- `validate:browser`: runs browser HTML suites against generated `stitch.js`.
- `validate:assembly`: builds assembly + runs suites + enforces KPI gate.
- `pipeline:build-compare`: validates source and assembled artifacts, then compares suite results and export surface parity.

### Package Entry Points

- `packages/api/index.js` - public observable/computed API
- `packages/core/index.js` - reactivity engine primitives (`ReactiveSystem`, `BatchScheduler`, `ComputedRef`, `MessageBus`)
- `packages/browser/index.js` - DOM binding and foreach orchestration (`DataBinder`, binding runtime)
- `packages/utils/index.js` - shared helpers (paths, debug config, type conversion, attr/value helpers, foreach helpers)

For a full contributor map of every module and tool, see `ARCHITECTURE.md`.

---

## Core Concepts

### Reactivity

**Eager Conversion** - All objects become reactive immediately upon creation:

```javascript
const data = Stitch.Observable.create({
    user: {
        profile: {
            name: 'John'  // ✅ Reactive from creation!
        }
    }
});

// Deep changes work immediately
data.user.profile.name = 'Jane';  // ✅ Triggers updates automatically
```

**Change Bubbling** - Changes propagate through nested objects:

```
Deep Nested Change → Parent Notified → Computed Properties Update → DOM Updates
```

### V2.0 Architecture Overview

**Synchronous Computed + Async DOM Model**

Stitch.js v2.0 uses a dual-phase reactivity architecture that balances correctness with performance:

```
Property Change
      ↓
  [SYNCHRONOUS PHASE]
      ↓
Computed Properties Invalidated ← markDirty() called immediately
      ↓
Computed Ready for Access ← get() returns fresh value
      |
      ├─→ [ASYNC PHASE]
      |         ↓
      |   DOM Effects Queued ← BatchScheduler
      |         ↓
      |   Microtask Flush ← Promise.resolve()
      |         ↓
      └─→ DOM Updated (batched & deduplicated)
```

**Why This Design?**

1. **Synchronous Computed** - Ensures computed properties always return fresh values
   ```javascript
   model.x = 5;
   console.log(model.computed);  // ✅ Fresh value immediately
   ```

2. **Async DOM** - Batches multiple changes into single DOM update
   ```javascript
   model.x = 1;
   model.y = 2;
   model.z = 3;
   // DOM updates ONCE in microtask (70-80% reduction)
   ```

3. **BatchScheduler** - Replaces v1.0 MessageBus for property reactivity
   - Set-based deduplication (same effect queued multiple times = runs once)
   - Automatic microtask flushing via Promise.resolve()
   - Infinite loop protection (MAX_FLUSH_DEPTH: 100)

4. **ReactiveSystem** - Core dependency tracking engine (shared singleton by default)
   - Transparent tracking via JavaScript Proxies
   - Effect stack for nested computed properties
   - Synchronous trigger() for immediate invalidation
   - All observables share one ReactiveSystem by default (cross-observable effects, coalesced batching)
   - Opt-in isolation via `Observable.create(data, { isolated: true })`

> 📖 **For Implementation Details:** See [ARCHITECTURE.md](ARCHITECTURE.md) for deep dive into BatchScheduler, ComputedRef, and ReactiveSystem internals.
>
> 📖 **Migrating from v1.0:** See [MIGRATION.md](MIGRATION.md) for breaking changes and migration guide.

**Key V2.0 Changes:**

- ✅ Computed properties invalidate synchronously (fixed stale value bug from v1.0)
- ✅ DOM updates batch asynchronously for performance
- ✅ effect({ batch: true }) for explicit batching control
- ✅ $watch immediate by default (was async in v1.0)
- ⚠️ MessageBus now handles user events only (not property reactivity)

### Custom Attributes

All bindings use clean `data-[type]` syntax:

```html
<!-- Text content -->
<div data-text="message"></div>

<!-- Form input (two-way) -->
<input data-value="username">

<!-- Visibility -->
<div data-visible="isActive">Content</div>

<!-- Click handler -->
<button data-click="handleSubmit">Submit</button>

<!-- Multiple bindings -->
<input data-value="email" data-enabled="canEdit">
```

### Two-Way Data Binding

Form inputs automatically sync with model:

```javascript
const model = Stitch.Observable.create({
    email: 'user@example.com'
});
```

```html
<input type="email" data-value="email">
```

**Direction:** Model ↔ View
- User types → model updates
- Model changes → input updates

---

## Custom Attribute Bindings

Stitch.js supports **10 custom attribute binding types**.

> ⚠️ **Important:** When using `data-class` binding with elements that have existing CSS classes (e.g., Bootstrap, Tailwind), **always use object mode** to preserve static classes. String mode replaces the entire className and will destroy framework classes. See [Best Practices for Class & Attr Bindings](#best-practices-for-class--attr-bindings) for details.

### ⚠️ Important: Binding Syntax Requirements

**All binding values MUST be property paths** - not inline JavaScript objects or expressions.

Stitch.js uses **property path resolution** for all bindings. This means binding values are treated as dot-notation paths (e.g., `"user.name"`, `"classBindings"`) that reference properties on your model.

**❌ WRONG - Inline Object Literals (Will Not Work):**
```html
<!-- These will FAIL with "property does not exist" errors -->
<div data-class="{ highlight: isActive }"></div>
<div data-attr="{ title: 'My Title', id: 'elem1' }"></div>
<input data-event="{ focus: onFocus, blur: onBlur }">
```

**✅ CORRECT - Property References:**
```html
<!-- Reference properties containing objects -->
<div data-class="classBindings"></div>
<div data-attr="attrBindings"></div>
<input data-event="inputEvents">
```

```javascript
const model = Stitch.Observable.create({
    classBindings: { highlight: true },
    attrBindings: { title: 'My Title', id: 'elem1' },
    inputEvents: {
        focus: function() { console.log('focused'); },
        blur: function() { console.log('blurred'); }
    }
});
```

**Why This Limitation Exists:**

Stitch.js internally uses `getProperty(viewModel, bindingValue)` which splits the binding value by dots to traverse nested properties. When you write `data-class="{ highlight: true }"`, it tries to find `viewModel["{ highlight: true }"]` as a property name, not parse it as JavaScript.

**Affected Bindings:**
- `data-class` (object mode)
- `data-attr`
- `data-event`

**See Also:** [Common Pitfalls and Troubleshooting](#common-pitfalls-and-troubleshooting) for detailed examples and error messages.

---

### 1. Text Binding (`data-text`)

Binds element's text content to a property.

**Syntax:**
```html
<span data-text="propertyName"></span>
```

**Example:**
```javascript
const model = Stitch.Observable.create({
    message: 'Hello, World!',
    user: { name: 'John' }
});
```

```html
<h1 data-text="message"></h1>
<p data-text="user.name"></p>
```

**Supported Elements:** `span`, `div`, `p`, `h1`-`h6`, `label`, `td`, `th`, `li`

---

### 2. Value Binding (`data-value`)

Creates bidirectional binding between form inputs and properties.

**Syntax:**
```html
<input data-value="propertyName">
```

**Example:**
```javascript
const model = Stitch.Observable.create({
    firstName: 'John',
    age: 25,
    isActive: true,
    selectedOption: 'option1'
});
```

```html
<!-- Text inputs -->
<input data-value="firstName" type="text">
<textarea data-value="description"></textarea>

<!-- Number inputs -->
<input data-value="age" type="number">

<!-- Checkboxes -->
<input data-value="isActive" type="checkbox">

<!-- Select dropdowns -->
<select data-value="selectedOption">
    <option value="option1">Option 1</option>
    <option value="option2">Option 2</option>
</select>
```

**Direction:** Model ↔ View (changes in either direction sync automatically)

---

### 3. Visible Binding (`data-visible`)

Controls element visibility based on property truthiness.

**Syntax:**
```html
<div data-visible="propertyName">Content</div>
```

**Example:**
```javascript
const model = Stitch.Observable.create({
    isLoggedIn: false,
    items: [],

    hasItems: Stitch.computed(function() {
        return this.items.length > 0;
    })
});
```

```html
<div data-visible="isLoggedIn">Welcome back!</div>
<div data-visible="hasItems">You have items!</div>
```

**Mechanism:** Sets `display: none` when falsy, removes inline style when truthy

---

### 4. Enabled Binding (`data-enabled`)

Controls element enabled/disabled state.

**Syntax:**
```html
<button data-enabled="propertyName">Submit</button>
```

**Example:**
```javascript
const model = Stitch.Observable.create({
    email: '',
    password: '',

    isValid: Stitch.computed(function() {
        return this.email.length > 0 && this.password.length >= 8;
    })
});
```

```html
<input data-value="email" type="email">
<input data-value="password" type="password">
<button data-enabled="isValid">Submit</button>
```

**Mechanism:** Sets `disabled` attribute based on property value

---

### 5. Click Binding (`data-click`)

Binds click events to methods.

**Syntax:**
```html
<button data-click="methodName">Click Me</button>
```

**Example:**
```javascript
const model = Stitch.Observable.create({
    count: 0,

    increment() {
        this.count++;
    },

    handleClick(event) {
        console.log('Clicked!', event);
    }
});
```

```html
<button data-click="increment">Increment</button>
<button data-click="handleClick">Click Me</button>
```

**Method Signature:**
```javascript
methodName(event) {
    // 'this' = model
    // 'event' = click event
}
```

---

### 6. Event Binding (`data-event`)

Generic event binding for any DOM event.

**Syntax:**
```html
<input data-event="eventConfigObject">
```

**Example:**
```javascript
const model = Stitch.Observable.create({
    username: '',

    usernameEvents: {
        input: 'onUsernameInput',
        blur: 'validateUsername',
        focus: 'onFocus'
    },

    onUsernameInput(event) {
        console.log('User typing:', this.username);
    },

    validateUsername(event) {
        if (this.username.length < 3) {
            console.log('Username too short');
        }
    },

    onFocus(event) {
        console.log('Input focused');
    }
});
```

```html
<input data-value="username" data-event="usernameEvents">
```

**Supported Events:** Works with **any standard DOM event**:
- Form events: `change`, `input`, `submit`, `reset`, `blur`, `focus`
- Keyboard events: `keyup`, `keydown`, `keypress`
- Mouse events: `click`, `dblclick`, `mouseenter`, `mouseleave`
- Touch events: `touchstart`, `touchend`, `touchmove`

**Multiple Events:**
```javascript
const model = Stitch.Observable.create({
    inputEvents: {
        input: 'onInput',
        focus: 'onFocus',
        blur: 'onBlur',
        keyup: 'onKeyUp'
    }
});
```

---

### 7. Class Binding (`data-class`)

Dynamically applies CSS classes.

**String Mode:**
```html
<div data-class="cssClassName"></div>
```

**Example (String):**
```javascript
const model = Stitch.Observable.create({
    cssClassName: 'active-class',

    changeClass() {
        this.cssClassName = 'inactive-class';
    }
});
```

**Object Mode (Conditional Classes):**
```html
<div data-class="classObject"></div>
```

**Example (Object):**
```javascript
const model = Stitch.Observable.create({
    isActive: true,
    isDisabled: false,
    isHighlighted: true,

    classObject: Stitch.computed(function() {
        return {
            active: this.isActive,
            disabled: this.isDisabled,
            highlight: this.isHighlighted
        };
    })
});
```

**Result:** Element gets `class="active highlight"` (disabled is false)

#### How Each Mode Works Internally

**String Mode Mechanism:**
```javascript
// What happens internally:
element.className = value;

// Example:
element.className = "active";
// Before: <div class="btn btn-primary old-class">
// After:  <div class="active">
// ❌ Lost: "btn", "btn-primary", "old-class"
```

**Object Mode Mechanism:**
```javascript
// What happens internally:
Object.keys(value).forEach(className => {
    element.classList.toggle(className, !!value[className]);
});

// Example:
Object.keys({ active: true, disabled: false }).forEach(className => {
    element.classList.toggle(className, !!{ active: true, disabled: false }[className]);
});
// Before: <div class="btn btn-primary old-class">
// After:  <div class="btn btn-primary old-class active">
// ✅ Preserved: "btn", "btn-primary", "old-class"
// ✅ Added: "active"
// ✅ Omitted: "disabled" (false value)
```

**Key Difference:**

- **String mode** replaces the ENTIRE `className` property → destroys everything
- **Object mode** calls `classList.toggle()` for ONLY the classes named in the binding → leaves everything else untouched

**Why Object Mode Preserves Classes:**

It's not "smart detection" - it's simply that `classList.toggle('active', true)` ONLY affects the `active` class. It never looks at or modifies `btn`, `btn-primary`, or any other class.

Think of it like this:
- String mode: "Replace all classes with this new string"
- Object mode: "For each class I mention, turn it on or off. Don't touch anything else."

#### ⚠️ Critical Behavior Differences

**String Mode vs Object Mode have FUNDAMENTALLY different behaviors:**

| Aspect | String Mode | Object Mode |
|--------|-------------|-------------|
| **Mechanism** | `element.className = value` | `element.classList.toggle()` |
| **Existing Classes** | ❌ **DESTROYED** (complete replacement) | ✅ **PRESERVED** (selective toggle) |
| **Use Case** | Replace ALL classes dynamically | Toggle specific classes on/off |
| **Static Classes** | Lost on first update | Kept intact |
| **Safety** | ⚠️ Dangerous with framework CSS | ✅ Safe for all scenarios |

**Example showing the critical difference:**

```html
<!-- Element with static Bootstrap classes -->
<div class="container border-rounded" data-class="dynamicClass">
    Content
</div>
```

**String Mode (DESTRUCTIVE):**
```javascript
const model = Stitch.Observable.create({
    dynamicClass: 'active'
});

// Result: class="active"
// ❌ LOST: "container border-rounded"
// ⚠️ All static classes are GONE!
```

**Object Mode (PRESERVING):**
```javascript
const model = Stitch.Observable.create({
    dynamicClass: Stitch.computed(function() {
        return {
            active: this.isActive
        };
    })
});

// Result: class="container border-rounded active"
// ✅ KEPT: "container border-rounded"
// ✅ TOGGLED: "active" based on isActive
```

#### 🎯 When to Use Each Mode

**Use String Mode when:**
- ✅ Completely replacing ALL classes based on state
- ✅ Element has NO static classes you need to preserve
- ✅ Dynamic class string comes from external source
- ⚠️ **RARE use case** - be absolutely certain you want to destroy existing classes

**Use Object Mode when:**
- ✅ Element has static classes in HTML (e.g., `class="btn btn-primary"`)
- ✅ Toggling individual classes on/off based on state
- ✅ Conditional classes based on multiple boolean properties
- ✅ Working with CSS frameworks (Bootstrap, Tailwind, etc.)
- ✅ **RECOMMENDED for 95% of use cases**

#### ⚠️ Common Gotcha: Framework CSS Classes

**WRONG - String mode destroys framework classes:**
```html
<!-- Bootstrap button with state -->
<button class="btn btn-primary btn-lg" data-class="buttonState">
    Submit
</button>
```

```javascript
const model = Stitch.Observable.create({
    buttonState: 'disabled'
});

// ❌ Result: class="disabled"
// ❌ LOST: "btn btn-primary btn-lg" (button styling broken!)
```

**FIXED - Object mode preserves framework classes:**
```html
<button class="btn btn-primary btn-lg" data-class="buttonClasses">
    Submit
</button>
```

```javascript
const model = Stitch.Observable.create({
    isValid: true,
    isSaving: false,

    buttonClasses: Stitch.computed(function() {
        return {
            disabled: !this.isValid,
            loading: this.isSaving
        };
    })
});

// ✅ Result: class="btn btn-primary btn-lg disabled loading"
// ✅ PRESERVED: "btn btn-primary btn-lg"
// ✅ TOGGLED: "disabled" and "loading" classes
```

**See Also:**
- [Best Practices for Class & Attr Bindings](#best-practices-for-class--attr-bindings) - Complete guide with pitfalls and solutions
- [example-27-attr-class-bindings.html](example-27-attr-class-bindings.html) - Comprehensive examples

---

### 8. Attr Binding (`data-attr`)

Dynamically sets HTML attributes using object-based syntax.

**Syntax:**
```html
<a data-attr="attributeObject">Link</a>
```

**Example:**
```javascript
const model = Stitch.Observable.create({
    url: '/page',
    openInNewTab: false,
    imageUrl: '/photo.jpg',
    imageAlt: 'Product photo',

    linkAttrs: Stitch.computed(function() {
        return {
            'href': this.url,
            'target': this.openInNewTab ? '_blank' : '_self',
            'rel': this.openInNewTab ? 'noopener noreferrer' : null,
            'title': 'Click to navigate'
        };
    }),

    imageAttrs: Stitch.computed(function() {
        return {
            'src': this.imageUrl,
            'alt': this.imageAlt,
            'loading': 'lazy',
            'width': '300',
            'height': '200'
        };
    })
});
```

```html
<a data-attr="linkAttrs">Link</a>
<img data-attr="imageAttrs">
```

**Attribute Value Handling:**
- **String/number**: Sets attribute with value
- **`null` or `undefined`**: Removes attribute
- **Boolean `true`**: Sets attribute with empty value (for boolean attrs like `disabled`)
- **Boolean `false`**: Removes attribute

#### Attribute Preservation Behavior

**Attr binding ONLY manages attributes mentioned in the binding object** - all other attributes remain untouched.

```html
<!-- Element with static attributes -->
<input type="text"
       id="username"
       class="form-control"
       placeholder="Static placeholder"
       data-attr="dynamicAttrs">
```

```javascript
const model = Stitch.Observable.create({
    isValid: false,

    dynamicAttrs: Stitch.computed(function() {
        return {
            'aria-invalid': !this.isValid,
            'aria-describedby': 'username-error'
        };
    })
});

// Result attributes:
// ✅ PRESERVED: type="text", id="username", class="form-control", placeholder="Static placeholder"
// ✅ MANAGED: aria-invalid="true", aria-describedby="username-error"
//
// Only the attributes in the binding object are touched!
```

#### ⚠️ Overwriting Static Attributes

**If an attribute appears in BOTH static HTML AND the binding object, the binding WILL overwrite the static value:**

```html
<!-- Static placeholder will be overwritten -->
<input type="text"
       placeholder="Enter username"
       data-attr="inputAttrs">
```

```javascript
const model = Stitch.Observable.create({
    dynamicPlaceholder: 'Type your name here',

    inputAttrs: Stitch.computed(function() {
        return {
            'placeholder': this.dynamicPlaceholder  // ❌ Overwrites static!
        };
    })
});

// Result: placeholder="Type your name here"
// ❌ Static "Enter username" is OVERWRITTEN
```

**Best Practice:** Don't duplicate attributes - use EITHER static OR dynamic, not both:

```html
<!-- ✅ GOOD: All static -->
<input type="text" placeholder="Enter username">

<!-- ✅ GOOD: All dynamic (uses property reference) -->
<input type="text" data-attr="inputAttrs">

<!-- ❌ BAD: Inline object literal (syntax not supported) -->
<input type="text" data-attr="{ placeholder: 'Dynamic' }">
<!-- Error: Property "{ placeholder: 'Dynamic' }" does not exist -->

<!-- ❌ BAD: Duplicating same attribute in static + dynamic -->
<input type="text"
       placeholder="Static will be lost"
       data-attr="inputAttrs">  <!-- inputAttrs also sets placeholder -->
<!-- Result: Dynamic value overwrites static placeholder -->
```

#### Removing Attributes Conditionally

Set attribute value to `null` or `undefined` to remove it conditionally:

```javascript
const model = Stitch.Observable.create({
    showTooltip: true,
    tooltipText: 'Help text',
    hasUserId: false,
    userId: null,

    conditionalAttrs: Stitch.computed(function() {
        return {
            // Removes 'title' when showTooltip is false
            'title': this.showTooltip ? this.tooltipText : null,

            // Removes 'data-id' when no userId
            'data-id': this.hasUserId ? this.userId : undefined,

            // Always set (never removed)
            'role': 'button'
        };
    })
});
```

**Example outcomes:**

```html
<!-- When showTooltip=true, hasUserId=false -->
<button data-attr="conditionalAttrs">
<!-- Result: <button title="Help text" role="button"> -->

<!-- When showTooltip=false, hasUserId=true, userId="123" -->
<button data-attr="conditionalAttrs">
<!-- Result: <button role="button" data-id="123"> -->
```

**See Also:**
- [Best Practices for Class & Attr Bindings](#best-practices-for-class--attr-bindings) - Complete guide with pitfalls and solutions
- [example-27-attr-class-bindings.html](example-27-attr-class-bindings.html) - Comprehensive examples

---

### 9. ForEach Binding (`data-foreach`)

Renders collections of data with support for inline or external templates.

**Syntax (Inline Template):**
```html
<ul data-foreach="arrayProperty">
    <li data-text="$data"></li>
</ul>
```

**Syntax (External Template):**
```html
<ul data-foreach="arrayProperty" data-template="templateId"></ul>

<template id="templateId">
    <li data-text="name"></li>
</template>
```

**Example (Simple List):**
```javascript
const model = Stitch.Observable.create({
    items: ['Apple', 'Banana', 'Cherry']
});
```

```html
<ul data-foreach="items">
    <li data-text="$data"></li>
</ul>
```

**Example (Complex Objects):**
```javascript
const model = Stitch.Observable.create({
    users: [
        { id: 1, name: 'John', email: 'john@example.com' },
        { id: 2, name: 'Jane', email: 'jane@example.com' }
    ],

    deleteUser(event) {
        const userId = event.target.dataset.userId;
        const index = this.users.findIndex(u => u.id == userId);
        this.users.splice(index, 1);
    }
});
```

```html
<div data-foreach="users">
    <div class="user-card">
        <h3 data-text="name"></h3>
        <p data-text="email"></p>
        <span>Index: <span data-text="$index"></span></span>
        <button data-click="$parent.deleteUser">Delete</button>
    </div>
</div>
```

**External Templates (Dropdowns with Placeholder):**
```html
<select data-foreach="countries"
        data-value="selectedCountry"
        data-template="country-template"
        data-default-text="Select a country...">
</select>

<template id="country-template">
    <option data-value="code" data-text="name"></option>
</template>
```

**Context Variables:**
- `$data` - Current item in the array
- `$index` - Current index (0-based)
- `$parent` - Parent view model

**⚠️ Important:** For object items (not primitives), the framework **mutates the original objects** by adding these context properties directly to each item. This means:

```javascript
const originalUsers = [
    { id: 1, name: 'John' },
    { id: 2, name: 'Jane' }
];

const model = Stitch.Observable.create({ users: originalUsers });
binder.bind('#app', model);  // Binds with data-foreach="users"

// After binding, original objects are mutated:
console.log(originalUsers[0]);
// Output: { id: 1, name: 'John', $data: {...}, $index: 0, $parent: model }
```

**Side Effects of Mutation:**

- **Pros:** Efficient - no object copying required
- **Cons:** Original array objects are modified (not a problem for most use cases)

**For Primitives:** Context properties are added to a wrapper Observable, not to the primitive value itself:

```javascript
const model = Stitch.Observable.create({
    items: ['Apple', 'Banana', 'Cherry']
});

// Primitives can't be mutated, so wrapper object is created
// No side effects on original strings
```

**Optional Attributes:**
- `data-template` - ID of external `<template>` element
- `data-default-text` - Placeholder option text (for `<select>` only)
- `data-default-value` - Placeholder option value (for `<select>` only, defaults to `""`)

**Array Mutations:** All mutations trigger re-render:
```javascript
model.items.push('New Item');      // ✅ Updates DOM
model.items.splice(1, 1);          // ✅ Updates DOM
model.items[0] = 'Changed';        // ✅ Updates DOM
```

**Smart Reconciliation:** Existing DOM elements are reused (not destroyed/recreated) for better performance and focus preservation.

---

#### ⚠️ Smart Reconciliation Requirements

**IMPORTANT:** For smart reconciliation to work effectively with reordering, items **SHOULD have stable `id` or `key` properties**. Without them, the framework falls back to index-based keys, which breaks reconciliation when items are reordered.

**How Keys Work:**

The framework generates keys for each item using this priority:
1. If `item.id` exists → key = `"item-{id}"` ✅ **Stable across reorders**
2. Else if `item.key` exists → key = `"item-{key}"` ✅ **Stable across reorders**
3. Else → key = `"item-{index}"` ⚠️ **Fallback - Breaks reconciliation on reorder**

The fallback to index-based keys allows lists without IDs to still work (append/remove operations succeed), but reordering operations will cause full DOM recreation instead of element reuse.

**Example - WITH IDs (Good):**

```javascript
const model = Stitch.Observable.create({
    users: [
        { id: 1, name: 'Alice' },
        { id: 2, name: 'Bob' },
        { id: 3, name: 'Charlie' }
    ]
});

// Reorder users
model.users.reverse();
// ✅ Keys remain stable: "item-1", "item-2", "item-3"
// ✅ DOM elements reused correctly
// ✅ Focus preserved if user was typing
```

**Example - WITHOUT IDs (Bad):**

```javascript
const model = Stitch.Observable.create({
    users: [
        { name: 'Alice' },    // key = "item-0"
        { name: 'Bob' },      // key = "item-1"
        { name: 'Charlie' }   // key = "item-2"
    ]
});

// Reorder users
model.users.reverse();
// ❌ Keys change based on new indices:
//    Charlie now at index 0 → key changes from "item-2" to "item-0"
//    Bob now at index 1 → key changes from "item-1" to "item-1" (same by luck)
//    Alice now at index 2 → key changes from "item-0" to "item-2"
// ❌ Keys don't match → reconciliation fails
// ❌ ALL DOM elements destroyed and recreated
// ❌ Focus lost, performance penalty
```

**When You Don't Need IDs:**

- Items are **never reordered** (append/remove only)
- **Small lists** (< 20 items) where performance doesn't matter
- Items are **primitives** (strings, numbers) that don't need focus preservation

**When You MUST Have IDs:**

- Items can be **reordered** (sorting, filtering, drag-drop)
- **Large lists** (100+ items) where performance matters
- **Editable fields** where focus preservation is critical
- **Complex objects** with nested data

**Recommended Pattern:**

```javascript
const model = Stitch.Observable.create({
    items: [
        { id: 1, name: 'Item 1' },
        { id: 2, name: 'Item 2' }
    ],
    nextId: 3,

    addItem(name) {
        this.items.push({
            id: this.nextId++,  // ✅ Always generate unique ID
            name: name
        });
    }
});
```

---

#### ⚠️ Exception: SELECT Elements Don't Use Reconciliation

**SELECT elements are the ONLY foreach container that does NOT use smart reconciliation.**

**Containers that USE reconciliation:**
- `<ul>`, `<ol>` (lists)
- `<tbody>`, `<thead>`, `<tfoot>` (table sections)
- Generic containers (`<div>`, etc.)

**Containers that DON'T use reconciliation:**
- `<select>` (dropdowns)

**Why SELECT is different:**

SELECT elements always perform full `innerHTML` replacement (destroy all options, recreate all options) because:

1. **Value validation:** Selected value must be validated against available options
2. **Placeholder handling:** `data-default-text` placeholder must be inserted/preserved
3. **Browser quirks:** Select option state can be unreliable with partial updates

**Performance Impact:**

```javascript
// SELECT dropdown
model.countries.push({ code: 'US', name: 'United States' });
// → 100% DOM mutation (all options destroyed/recreated)
// → No benefit from having item.id properties

// TABLE with <tbody>
model.users.push({ id: 4, name: 'David' });
// → ~10% DOM mutation (only new row created)
// → Massive benefit from having item.id properties
```

**Recommendation:**

- For **SELECT dropdowns:** Don't add `id` properties - they provide **ZERO benefit** since reconciliation doesn't apply. Adding IDs wastes memory without improving performance.
- For **lists/tables:** Always add `id` properties for performance and focus preservation (reconciliation applies)

**Why IDs Don't Help SELECT Elements:**

```javascript
// Even with IDs, SELECT always does full innerHTML replacement
const countries = [
    { id: 1, code: 'US', name: 'United States' },  // ID doesn't help
    { id: 2, code: 'CA', name: 'Canada' }
];

model.countries.push({ id: 3, code: 'MX', name: 'Mexico' });
// Result: ALL options destroyed and recreated (100% DOM mutation)
// ID properties are completely ignored for SELECT elements
```

---

#### ForEach Implementation Details

**How ForEach Processes Templates:**

When `data-foreach` binds an array, it follows these steps:

1. **Template Identification:** The first direct child of the foreach container is used as the template
2. **Cloning:** For each array item, the template is cloned
3. **Context Creation:** Each clone is bound with its own context (`$data`, `$index`, `$parent`)
4. **Boundary Respect:** The binding system stops traversal at foreach boundaries

**Binding Boundaries:**

ForEach creates a **binding boundary** - an architectural pattern where certain bindings manage their own descendant elements. The parent binding system stops tree traversal when it encounters a boundary element.

```javascript
// When binding this structure:
<div id="app">                    <!-- Parent binding starts here -->
    <h1 data-text="title"></h1>   <!-- ✅ Bound by parent -->
    <div data-foreach="users">     <!-- ⛔ BOUNDARY - parent stops here -->
        <div data-text="name"></div>   <!-- ✅ Bound by foreach (not parent) -->
    </div>
</div>
```

**Why Boundaries Matter:**

Without binding boundaries, the parent binding system would try to bind template children before foreach processes them. This would cause errors because:

1. Template children reference properties from array items (`name`, `fullName`, etc.)
2. Template children don't have access to those properties until foreach creates item contexts
3. Result: "Property does not exist" errors for every template binding

**Tree-Walking with Boundaries:**

Stitch.js uses depth-first tree walking that respects binding boundaries:

```javascript
// Simplified algorithm:
function _bindElement(element, context) {
    // 1. Bind current element's data-* attributes
    this._processBindings(element, context);

    // 2. Check if element creates a boundary
    if (this._isBindingBoundary(element)) {
        return;  // Stop - boundary handler will manage children
    }

    // 3. Recursively bind direct children
    Array.from(element.children).forEach(child => {
        this._bindElement(child, context);
    });
}
```

**Boundary Types:**

Currently implemented:
- `data-foreach` - Template children managed by foreach binding

Future possibilities:
- `data-if` - Conditionally rendered children
- `data-component` - Component-managed subtree
- `data-portal` - Children rendered elsewhere in DOM

**Debugging Boundaries:**

Enable debug logging to see boundary detection:

```javascript
Stitch.debug.enable();
// Logs: "Stopped at binding boundary: DIV" when foreach boundary detected
```

**Template Children Protection:**

The boundary pattern ensures template children are never bound in the wrong context:

```html
<!-- BEFORE foreach processes (during initial bind): -->
<div data-foreach="users">
    <!-- These elements are SKIPPED by parent binding -->
    <h3 data-text="fullName"></h3>  <!-- Not bound yet -->
</div>

<!-- AFTER foreach processes (foreach creates clones): -->
<div data-foreach="users">
    <!-- Original template still skipped -->
    <h3 data-text="fullName"></h3>

    <!-- Clone 1 - bound with users[0] context -->
    <h3>Alice Anderson</h3>

    <!-- Clone 2 - bound with users[1] context -->
    <h3>Bob Brown</h3>
</div>
```

This architecture prevents "phantom iterations" where template elements would be incorrectly bound as if they were data items.

---

## Best Practices for Class & Attr Bindings

This section provides critical guidelines for using `data-class` and `data-attr` bindings effectively, especially when working with elements that have existing attributes.

### Class Binding Best Practices

#### 1. Default to Object Mode

Object mode is safer and more predictable for most use cases:

```javascript
// ✅ RECOMMENDED: Object mode
const model = Stitch.Observable.create({
    isActive: false,
    isDisabled: false,

    classObject: Stitch.computed(function() {
        return {
            active: this.isActive,
            disabled: this.isDisabled
        };
    })
});

// ⚠️ Use sparingly: String mode (destroys existing classes)
const model2 = Stitch.Observable.create({
    className: 'dynamic-class'  // Only if element has NO static classes!
});
```

#### 2. Keep Static Framework Classes in HTML

Never put framework CSS classes (Bootstrap, Tailwind, etc.) in your model - keep them in HTML:

```html
<!-- ✅ GOOD: Framework classes static, state classes dynamic -->
<button class="btn btn-lg btn-primary" data-class="stateClasses">
    Submit
</button>

<!-- ❌ BAD: Mixing framework classes with dynamic logic -->
<button data-class="allClasses">Submit</button>
```

```javascript
// ✅ GOOD: Only state classes in model
stateClasses: Stitch.computed(function() {
    return {
        'is-valid': this.isValid,
        'is-loading': this.isLoading
    };
})

// ❌ BAD: Framework classes in model (brittle, hard to maintain)
allClasses: Stitch.computed(function() {
    let classes = 'btn btn-lg btn-primary ';  // Hard-coded styling!
    if (this.isValid) classes += 'is-valid ';
    return classes.trim();
})
```

#### 3. Always Use Computed for Dynamic Class Objects

Class objects must be reactive to update when dependencies change:

```javascript
// ✅ GOOD: Computed property (reactive)
const model = Stitch.Observable.create({
    isActive: true,

    stateClasses: Stitch.computed(function() {
        return {
            active: this.isActive  // ✅ Updates when isActive changes
        };
    })
});

// ❌ BAD: Static object (won't update!)
const model2 = Stitch.Observable.create({
    isActive: true,

    stateClasses: {
        active: model2.isActive  // ❌ Captured at creation, never updates!
    }
});
```

### Attr Binding Best Practices

#### 1. Don't Duplicate Attributes

Each attribute should be controlled by EITHER static HTML OR dynamic binding, never both:

```html
<!-- ✅ GOOD: Static-only attribute -->
<input type="text" placeholder="Enter name">

<!-- ✅ GOOD: Dynamic-only attribute (uses property reference) -->
<input type="text" data-attr="inputAttrs">

<!-- ❌ BAD: Inline object literal (syntax not supported) -->
<input type="text" data-attr="{ placeholder: 'Dynamic' }">
<!-- Error: Property "{ placeholder: 'Dynamic' }" does not exist -->

<!-- ❌ BAD: Duplicating same attribute in static + dynamic -->
<input type="text"
       placeholder="This will be lost"
       data-attr="inputAttrs">  <!-- inputAttrs also sets placeholder -->
<!-- Result: Dynamic value overwrites static placeholder -->
```

#### 2. Group Related Attributes

Keep logically related attributes together in the same computed property:

```javascript
// ✅ GOOD: Related attributes grouped
const model = Stitch.Observable.create({
    url: '/home',
    openInNewTab: false,

    linkAttrs: Stitch.computed(function() {
        return {
            'href': this.url,
            'target': this.openInNewTab ? '_blank' : '_self',
            'rel': this.openInNewTab ? 'noopener noreferrer' : null
        };
    })
});

// ❌ BAD: Scattered across multiple properties
const model2 = Stitch.Observable.create({
    hrefAttr: { href: '/home' },
    targetAttr: { target: '_blank' },
    relAttr: { rel: 'noopener' }
});
```

#### 3. Use Null for Conditional Attributes

Remove attributes conditionally by returning `null` or `undefined`:

```javascript
// ✅ GOOD: Conditional attribute management
const model = Stitch.Observable.create({
    showTooltip: true,
    tooltipText: 'Help',

    tooltipAttrs: Stitch.computed(function() {
        return {
            // Only set title when tooltip should be shown
            'title': this.showTooltip ? this.tooltipText : null,

            // Always set role (never removed)
            'role': 'button',

            // Conditional ARIA attribute
            'aria-label': this.showTooltip ? null : this.tooltipText
        };
    })
});
```

### Common Pitfalls

#### Pitfall 1: String Mode Destroys Framework CSS

**Problem:** Using string mode with elements that have CSS framework classes.

```html
<!-- ❌ WRONG: Bootstrap classes will be destroyed -->
<div class="container mx-auto px-4" data-class="themeClass">
    Content
</div>
```

```javascript
const model = Stitch.Observable.create({
    isDark: true,
    themeClass: 'dark'  // String mode!
});

// Result: class="dark"
// ❌ LOST: "container mx-auto px-4"
// ❌ Layout completely broken!
```

**Fix:** Use object mode:

```javascript
const model = Stitch.Observable.create({
    isDark: true,

    themeClasses: Stitch.computed(function() {
        return {
            dark: this.isDark
        };
    })
});

// Result: class="container mx-auto px-4 dark"
// ✅ PRESERVED: All framework classes
// ✅ TOGGLED: dark class
```

#### Pitfall 2: Boolean Attribute String Values

> ⚠️ **CRITICAL:** HTML boolean attributes (disabled, readonly, required, checked, hidden, etc.) are controlled by **PRESENCE**, not value. If the attribute exists, it's enabled. **Period.**
>
> Using string `"false"` does NOT disable a boolean attribute - the attribute is still present, so it's still enabled!

**Problem:** Using string `"true"` / `"false"` instead of boolean values leads to incorrect handler selection and broken boolean attributes.

```javascript
// ❌ WRONG: String values select the WRONG handler
const model = Stitch.Observable.create({
    badAttrs: {
        'required': 'true',   // ❌ String → default handler → required="true"
        'disabled': 'false'   // ❌ String → default handler → disabled="false" (ENABLED!)
    }
});

// ✅ CORRECT: Use actual booleans to select boolean handler
const model2 = Stitch.Observable.create({
    goodAttrs: Stitch.computed(function() {
        return {
            'required': true,   // ✅ Boolean → boolean handler → required=""
            'disabled': false   // ✅ Boolean → boolean handler → removes attribute
        };
    })
});
```

**Why This Happens - Handler Selection Logic:**

The framework selects attribute handlers based on value type:

```javascript
// Internal handler selection
if (typeof value === "boolean") {
    // Use boolean handler: setAttribute(name, "") or removeAttribute(name)
    return ATTR_VALUE_HANDLERS.boolean;
}
// String "true"/"false" falls through to default handler!
return ATTR_VALUE_HANDLERS.default;  // Uses setAttribute(name, String(value))
```

**The Problem with String "false":**

1. `typeof "false" === "string"` → selects DEFAULT handler (not boolean handler)
2. Default handler calls `setAttribute('disabled', 'false')`
3. Result: `<input disabled="false">`
4. **HTML spec:** Presence of `disabled` attribute = disabled, regardless of value!

**Visual Demonstration:**

```html
<!-- Using string "false" (WRONG) -->
<input disabled="false">  <!-- ❌ STILL DISABLED! Can't type in it! -->

<!-- Using boolean false (CORRECT) -->
<input>  <!-- ✅ ENABLED! No disabled attribute present -->

<!-- Using boolean true (CORRECT) -->
<input disabled="">  <!-- ✅ DISABLED! Empty value = present = disabled -->

**Boolean attribute behavior by value type:**

| Value Type | Handler | Result |
|------------|---------|--------|
| `true` (boolean) | Boolean handler | Sets attribute with empty value (`disabled=""`) |
| `false` (boolean) | Boolean handler | Removes attribute entirely |
| `"true"` (string) | Default handler | Sets attribute with string value (`disabled="true"`) ⚠️ |
| `"false"` (string) | Default handler | Sets attribute with string value (`disabled="false"`) ⚠️ Still disabled! |

#### Pitfall 3: Not Using Computed for Reactive Classes

**Problem:** Static class objects don't update when dependencies change.

```javascript
// ❌ WRONG: Class object captured at creation
const model = Stitch.Observable.create({
    isValid: false,

    // Static object - won't update when isValid changes!
    classes: {
        valid: model.isValid  // ❌ Always false, captured at creation
    }
});

model.isValid = true;  // ❌ Classes don't update!
```

**Fix:** Use computed property:

```javascript
// ✅ CORRECT: Computed re-evaluates when dependencies change
const model = Stitch.Observable.create({
    isValid: false,

    classes: Stitch.computed(function() {
        return {
            valid: this.isValid  // ✅ Updates reactively
        };
    })
});

model.isValid = true;  // ✅ Classes update automatically!
```

#### Pitfall 4: Type Converter Confusion with Select Dropdowns

**Problem:** Expecting HTML `type` attribute to control type conversion.

```html
<!-- User thinks: "type='text' means treat as string" -->
<select data-value="selectedId">
    <option value="101">District 1</option>
    <option value="102">District 2</option>
</select>
```

```javascript
const model = Stitch.Observable.create({
    selectedId: 101  // number
});

// ❌ User expects: Dropdown shows placeholder (thinks type='text' forces string)
// ✅ Actually: Dropdown shows "District 1" (int converter matches 101 === "101")
```

**Why This Happens:**

SELECT elements don't have a `type` attribute. Type inference falls through to value type inspection, sees `typeof 101 === "number"` + `Number.isInteger(101)` → uses int converter → type-aware equality matches "101" with 101.

**Fix:** Use explicit `data-type` if you want to force string comparison:

```html
<select data-value="selectedId" data-type="string">
    <option value="101">District 1</option>
</select>
```

Or use string values in model:

```javascript
const model = Stitch.Observable.create({
    selectedId: "101"  // string
});
```

---

#### Pitfall 5: Thinking Smart Reconciliation Works Everywhere

**Problem:** Assuming all foreach loops benefit from smart reconciliation.

```html
<!-- User expects: "I added IDs, so this will be fast!" -->
<select data-foreach="countries" data-value="selectedCountry">
    <option data-value="code" data-text="name"></option>
</select>
```

```javascript
const model = Stitch.Observable.create({
    countries: [
        { id: 1, code: 'US', name: 'United States' },
        { id: 2, code: 'CA', name: 'Canada' }
    ]
});

model.countries.push({ id: 3, code: 'MX', name: 'Mexico' });
// ❌ User expects: Only new option created
// ✅ Actually: ALL options destroyed and recreated (SELECT doesn't use reconciliation)
```

**Fix:** Understand that SELECT is the exception:

**Use reconciliation (benefits from IDs):**
- `<ul>`, `<ol>` lists
- `<tbody>`, `<thead>`, `<tfoot>` table sections
- Generic containers

**Don't use reconciliation (IDs don't help):**
- `<select>` dropdowns

For SELECT dropdowns, don't worry about adding `id` properties - they won't improve performance.

### Quick Decision Guide

**When to use String Mode for Class Binding:**
- Element has NO static classes
- You're replacing ALL classes based on a single state
- Dynamic class string comes from external source

**When to use Object Mode for Class Binding (RECOMMENDED):**
- Element has ANY static classes (e.g., from CSS frameworks)
- Toggling specific classes on/off
- Working with conditional classes
- **Default choice for 95% of use cases**

**When Attr Binding is Safe:**
- Element has static attributes that are NOT in your binding object (they'll be preserved)
- You need to conditionally add/remove specific attributes
- Managing ARIA attributes, data attributes, or accessibility properties

**When to Be Careful with Attr Binding:**
- If you include an attribute in the binding object, it WILL overwrite any static value
- Boolean attributes need `true`/`false`, not string `"true"`/`"false"`

---

### 10. Loading Binding (`data-loading`)

Convenience binding for form loading states with accessibility.

**Syntax:**
```html
<input data-loading="isLoadingProperty">
```

**Example:**
```javascript
const model = Stitch.Observable.create({
    isLoading: false,
    data: [],

    async fetchData() {
        this.isLoading = true;
        try {
            const response = await fetch('/api/data');
            this.data = await response.json();
        } finally {
            this.isLoading = false;
        }
    }
});
```

```html
<input data-loading="isLoading" placeholder="Search...">
<button data-loading="isLoading" data-click="fetchData">Load Data</button>
```

**Automatically Sets:**
- `disabled` attribute
- `loading` CSS class
- `aria-busy` attribute

**Rendered when loading:**
```html
<input disabled class="loading" aria-busy="true">
```

---

## Common Pitfalls and Troubleshooting

This section covers common mistakes and how to fix them.

### Pitfall: Using Inline Object Literals in Bindings

**Problem:** Attempting to use inline JavaScript object syntax in binding attributes.

**Common Mistakes:**

```html
<!-- ❌ WRONG: Inline object in data-class -->
<div data-class="{ highlight: isActive, disabled: !isEnabled }">
    Content
</div>

<!-- ❌ WRONG: Inline object in data-attr -->
<input data-attr="{ placeholder: 'Enter text', title: 'Help text' }">

<!-- ❌ WRONG: Inline object in data-event -->
<input data-event="{ focus: handleFocus, blur: handleBlur }">
```

**What Happens:**

You'll see errors in the console like:

```
[Stitch.js v1.0.0] Invalid binding syntax: "{ highlight: isActive, disabled: !isEnabled }"

❌ Inline object literals are NOT supported in bindings.
✅ Use a property reference instead.
```

Or:

```
[Stitch.js v1.0.0] Property "{ highlight: isActive }" does not exist on object at path ""
```

**Why It Fails:**

Stitch.js treats **all binding values as property paths**, not JavaScript expressions. When you write:

```html
<div data-class="{ highlight: isActive }">
```

Stitch.js tries to find a property on your model literally named `"{ highlight: isActive }"`, rather than parsing it as an object. This is because the internal `getProperty()` function splits binding values by dots to traverse nested properties (e.g., `"user.name"` → `model["user"]["name"]`).

**How to Fix:**

**Step 1:** Define the object as a property in your model:

```javascript
const model = Stitch.Observable.create({
    // Your reactive data
    isActive: true,
    isEnabled: false,

    // ✅ CORRECT: Object as a property
    classBindings: {
        highlight: false,
        disabled: true
    },

    attrBindings: {
        placeholder: 'Enter text',
        title: 'Help text'
    },

    inputEvents: {
        focus: function() { console.log('focused'); },
        blur: function() { console.log('blurred'); }
    }
});
```

**Step 2:** Reference the property name in your binding:

```html
<!-- ✅ CORRECT: Property reference -->
<div data-class="classBindings">
    Content
</div>

<input data-attr="attrBindings">

<input data-event="inputEvents">
```

**Using Computed Properties for Dynamic Objects:**

For objects that need to update based on other properties, use `Stitch.computed()`:

```javascript
const model = Stitch.Observable.create({
    isActive: true,
    isEnabled: false,
    placeholderText: 'Enter your username',

    // ✅ CORRECT: Computed object updates when dependencies change
    classBindings: Stitch.computed(function() {
        return {
            highlight: this.isActive,
            disabled: !this.isEnabled
        };
    }),

    attrBindings: Stitch.computed(function() {
        return {
            placeholder: this.placeholderText,
            'aria-label': this.placeholderText
        };
    })
});
```

```html
<!-- These will update automatically when isActive, isEnabled, or placeholderText change -->
<div data-class="classBindings">Content</div>
<input data-attr="attrBindings">
```

**Summary:**

| ❌ Don't Do This | ✅ Do This Instead |
|---|---|
| `data-class="{ active: true }"` | `data-class="classBindings"` + define `classBindings` in model |
| `data-attr="{ title: 'Text' }"` | `data-attr="attrBindings"` + define `attrBindings` in model |
| `data-event="{ click: fn }"` | `data-event="eventBindings"` + define `eventBindings` in model |

**Key Takeaway:** Binding values are **property paths** (like `"user.name"` or `"classBindings"`), not JavaScript expressions. Always define objects in your model and reference them by property name.

---

## Observable System

### Creating Observables

**Basic Observable:**
```javascript
const model = Stitch.Observable.create({
    count: 0,
    message: 'Hello',
    user: {
        name: 'John',
        email: 'john@example.com'
    }
});
```

By default, all observables share a single `ReactiveSystem` and `BatchScheduler`. This means effects can track dependencies across observable boundaries, and batched updates coalesce into a single microtask flush. Each observable gets its own `MessageBus` for `$on`/`$emit` events.

**Isolated Observable (opt-in):**
```javascript
const isolated = Stitch.Observable.create({ count: 0 }, { isolated: true });
// This observable has its own ReactiveSystem — no cross-observable tracking
```

**Observable Array:**
```javascript
const items = Stitch.Observable.createArray([1, 2, 3]);
items.push(4);  // ✅ Reactive
```

**Make Existing Object Reactive:**
```javascript
const obj = { count: 0 };
const reactive = Stitch.Observable.reactive(obj);
// If obj is already reactive, returns the existing proxy
```

**Reset Shared State (for testing):**
```javascript
Stitch.Observable.reset();
// Existing observables keep their old system; new ones get a fresh system
```

### ⚠️ Arrow Function Restriction

**CRITICAL:** Arrow functions **cannot** be used as methods in reactive objects because they cannot access reactive properties via `this`.

**❌ WRONG - Arrow Functions (Runtime Error):**
```javascript
const model = Stitch.Observable.create({
    count: 5,

    // ❌ Arrow function - WILL THROW ERROR
    increment: () => {
        this.count++;  // Error: Cannot access reactive properties
    }
});

// Error message:
// "Stitch.js v2.1.0: Arrow function detected in property 'increment'
//
//  Arrow functions cannot access reactive properties via 'this'.
//
//  Use regular functions or method shorthand instead:
//
//  ✅ increment: function() { this.count++; }
//  ✅ increment() { this.count++; }"
```

**✅ CORRECT - Regular Functions:**
```javascript
const model = Stitch.Observable.create({
    count: 5,

    // ✅ Regular function - Works correctly
    increment: function() {
        this.count++;
    },

    // ✅ Method shorthand - Works correctly
    decrement() {
        this.count--;
    },

    // ✅ Async method - Works correctly
    async fetchData() {
        const data = await api.get('/data');
        this.data = data;
    }
});

model.increment();  // ✅ this.count is 6
```

**Why This Restriction Exists:**

Arrow functions lexically bind `this` to the outer scope at definition time. When you write `() => { this.count++ }`, the arrow function captures `this` from the surrounding context (usually `window` or `undefined`), NOT from the reactive proxy object.

Regular functions and method shorthand allow `this` to be dynamically bound to the reactive proxy when the method is called, which is required for reactivity to work.

**Computed Properties Are Fine:**

This restriction ONLY applies to action methods. Computed properties work with both regular functions and arrow functions (though regular functions are recommended):

```javascript
const model = Stitch.Observable.create({
    count: 5,

    // ✅ Regular function computed (recommended)
    double: Stitch.computed(function() {
        return this.count * 2;
    }),

    // ✅ Arrow function computed (works but not typical)
    triple: Stitch.computed(() => {
        return model.count * 3;  // Must reference 'model' explicitly
    })
});
```

### Eager Reactivity

All objects become reactive **immediately upon creation** - no lazy conversion, no manual tracking.

**For Nested Objects:**

```javascript
const data = Stitch.Observable.create({
    settings: {
        theme: {
            mode: 'dark'
        }
    }
});

// Deep changes work immediately
data.settings.theme.mode = 'light';  // ✅ Triggers updates automatically
```

**For Arrays with Computed Properties:**

Array items containing computed properties are processed eagerly to ensure computed properties are available immediately:

```javascript
const model = Stitch.Observable.create({
    users: [
        {
            firstName: 'Alice',
            lastName: 'Anderson',

            // Computed property in array item
            fullName: Stitch.computed(function() {
                return `${this.firstName} ${this.lastName}`;
            })
        },
        {
            firstName: 'Bob',
            lastName: 'Brown',

            fullName: Stitch.computed(function() {
                return `${this.firstName} ${this.lastName}`;
            })
        }
    ]
});

// ✅ Computed properties work immediately
console.log(model.users[0].fullName);  // "Alice Anderson"

// ✅ Can be used in foreach right away
// <div data-foreach="users">
//     <span data-text="fullName"></span>
// </div>
```

**Why Eager Conversion for Arrays:**

Eager conversion of array items with computed properties is essential for `data-foreach` bindings:

- **Without eager conversion:** Array items are converted lazily when first accessed. When foreach accesses items, computed property markers are encountered during conversion and skipped, resulting in undefined properties.

- **With eager conversion:** `Observable.create()` inspects array items upfront. Items with computed properties are processed immediately - computed markers are extracted and defined as getters before foreach ever sees them.

This ensures that code like `<div data-text="fullName"></div>` inside a foreach works without "property does not exist" errors.

**Note:** Array items WITHOUT computed properties still use standard reactive conversion. Eager processing only applies when `Stitch.computed()` is detected in array item properties.

### Change Bubbling

Changes automatically propagate through nested objects:

```javascript
const state = Stitch.Observable.create({
    settings: {
        theme: {
            mode: 'dark'
        }
    },

    themeLabel: Stitch.computed(function() {
        return `Theme: ${this.settings.theme.mode}`;
    })
});

// Change deep nested value
state.settings.theme.mode = 'light';
// ✅ themeLabel automatically recalculates
// ✅ DOM automatically updates
```

---

## Computed Properties

Computed properties are derived values that automatically recalculate when dependencies change.

### Creating Computed Properties

**All computed properties MUST be wrapped with `Stitch.computed()`:**

#### Function Syntax (Automatic Dependency Tracking)

```javascript
const model = Stitch.Observable.create({
    firstName: 'John',
    lastName: 'Doe',

    // ✅ Computed property with automatic tracking
    fullName: Stitch.computed(function() {
        return `${this.firstName} ${this.lastName}`;
    })
});
```

#### Object Syntax (Explicit Dependencies)

For advanced use cases, you can explicitly declare dependencies instead of relying on automatic tracking:

```javascript
const model = Stitch.Observable.create({
    count: 0,
    multiplier: 2,

    // ✅ Computed property with explicit dependencies
    result: Stitch.computed({
        get() {
            return this.count * this.multiplier;
        },
        deps: ['count', 'multiplier']
    })
});
```

**When to Use Object Syntax:**
- ✅ When automatic tracking is insufficient or unclear
- ✅ For computed properties with complex conditional logic
- ✅ To document dependencies explicitly for maintainability
- ✅ When you want precise control over when recomputation occurs

**Note:** Both syntaxes produce the same reactive behavior. Object syntax with `deps` is processed internally by the reactive factory.

### Accessing Computed Properties

**CRITICAL:** Computed properties are accessed as **properties** (direct getters), not functions.

When you use `Stitch.computed()` inside `Observable.create()`, the framework automatically converts it to a direct property getter on your model. You simply access computed properties the same way you access regular properties.

```javascript
const model = Stitch.Observable.create({
    firstName: 'John',
    lastName: 'Doe',
    fullName: Stitch.computed(function() {
        return `${this.firstName} ${this.lastName}`;
    })
});

// ✅ CORRECT: Access as property (direct getter)
const name = model.fullName;  // "John Doe"

// ❌ WRONG: Don't call as function
const name = model.fullName();  // TypeError: fullName is not a function
```

**Why This Works:**

`Stitch.computed()` returns a marker object that `Observable.create()` recognizes and converts into a property getter. The transformation happens automatically:

```javascript
// What you write:
fullName: Stitch.computed(function() { return this.firstName + ' ' + this.lastName; })

// What Observable.create() creates on your model:
Object.defineProperty(model, 'fullName', {
    get() { /* cached computed evaluation with dependency tracking */ }
});

// Result: You access it as a simple property
model.fullName  // Works like any other property
```

**What You Interact With:**

As a user of Stitch.js, you ONLY interact with the final property getter created by `Observable.create()`. There are no `.value`, `.get()`, or other accessor methods - computed properties are indistinguishable from regular properties in terms of access syntax:

```javascript
// Both accessed identically:
model.firstName    // Regular property
model.fullName     // Computed property - looks and feels the same!
```

### V2.0 Synchronous Invalidation & Lazy Evaluation

**How Computed Properties Update in V2.0**

Stitch.js v2.0 uses a two-phase computed property model that guarantees fresh values while maintaining performance:

**Phase 1: Synchronous Invalidation (markDirty)**
```javascript
const model = Stitch.Observable.create({
    x: 5,
    y: 10,

    sum: Stitch.computed(function() {
        return this.x + this.y;
    })
});

model.x = 20;
// ✅ IMMEDIATELY marks 'sum' as dirty (synchronous)
// ⏸️ Does NOT recalculate yet (lazy)

console.log(model.sum);
// ✅ NOW recalculates (because dirty flag is set)
// Returns fresh value: 30
```

**Phase 2: Lazy Evaluation (get)**

Computed properties only recalculate when accessed:

```javascript
model.x = 1;  // Mark dirty
model.x = 2;  // Mark dirty again
model.x = 3;  // Mark dirty again

// No recalculation happened yet!

console.log(model.sum);  // NOW recalculates ONCE: 13 (3 + 10)
```

**Why This Matters - V1.0 vs V2.0**

```javascript
// ❌ V1.0 PROBLEM: Stale values
model.x = 5;
console.log(model.computed);  // Returns OLD value (async delay)

// ✅ V2.0 FIX: Fresh values
model.x = 5;
console.log(model.computed);  // Returns FRESH value (sync invalidation)
```

**Nested Computed Properties**

When a computed property depends on another computed property, synchronous invalidation cascades:

```javascript
const model = Stitch.Observable.create({
    count: 5,

    double: Stitch.computed(function() {
        return this.count * 2;
    }),

    quadruple: Stitch.computed(function() {
        return this.double * 2;  // Depends on 'double'
    })
});

model.count = 10;
// ✅ IMMEDIATELY marks 'double' dirty
// ✅ IMMEDIATELY marks 'quadruple' dirty (cascade)
// ⏸️ Neither recalculated yet

console.log(model.quadruple);
// ✅ Evaluates quadruple → needs double → evaluates double → returns 40
```

**Explicit Dependencies & Recursive Resolution**

When using object syntax with `deps`, dependencies are resolved recursively:

```javascript
const model = Stitch.Observable.create({
    a: 1,
    b: 2,

    sum: Stitch.computed({
        get() { return this.a + this.b; },
        deps: ['a', 'b']
    }),

    result: Stitch.computed({
        get() { return this.sum * 10; },
        deps: ['sum']  // Depends on another computed
    })
});

// Framework automatically flattens dependencies:
// 'result' tracks: 'sum', 'a', 'b' (recursive resolution)

model.a = 5;
// ✅ Marks both 'sum' and 'result' dirty (flattened tracking)
```

**Performance Characteristics**

- **Synchronous phase:** Ultra-fast (just sets dirty flag)
- **Lazy phase:** Only recalculates when accessed
- **Caching:** Returns cached value if not dirty
- **Cascading:** Nested computed properties invalidate efficiently

> 📖 **Implementation Details:** See [ARCHITECTURE.md](ARCHITECTURE.md) for ComputedRef class internals, effect stack mechanics, and dependency tracking algorithms.

### Boolean Computed Properties

```javascript
const model = Stitch.Observable.create({
    status: 'active',
    items: [],

    isActive: Stitch.computed(function() {
        return this.status === 'active';
    }),

    hasItems: Stitch.computed(function() {
        return this.items.length > 0;
    }),

    isEmpty: Stitch.computed(function() {
        return this.items.length === 0;
    })
});
```

### Nested Computed Properties

Computed properties can depend on other computed properties:

```javascript
const model = Stitch.Observable.create({
    count: 5,

    isPositive: Stitch.computed(function() {
        return this.count > 0;
    }),

    status: Stitch.computed(function() {
        return this.isPositive ? 'positive' : 'negative';  // ✅ Works correctly!
    })
});

model.count = -3;
// ✅ isPositive updates to false
// ✅ status updates to 'negative'
// ✅ DOM updates automatically
```

### Action Methods vs. Computed Properties

**Action methods remain as regular functions** (no wrapper):

```javascript
const model = Stitch.Observable.create({
    count: 0,

    // Action methods - NO wrapper
    incrementCounter() {
        this.count++;
    },

    resetCounter() {
        this.count = 0;
    },

    handleClick(event) {
        this.status = 'inactive';
    }
});
```

### Computed Properties in Arrays

When using computed properties in array items (especially with `data-foreach` loops), there are important requirements to understand:

**✅ Correct - Computed Properties in Array Items:**

```javascript
const model = Stitch.Observable.create({
    users: [
        {
            id: 1,
            firstName: 'Alice',
            lastName: 'Anderson',

            // ✅ Computed property in array item
            fullName: Stitch.computed(function() {
                return `${this.firstName} ${this.lastName}`;
            }),

            isActive: true,

            // ✅ Computed property depending on other properties
            statusLabel: Stitch.computed(function() {
                return this.isActive ? 'Active' : 'Inactive';
            })
        },
        {
            id: 2,
            firstName: 'Bob',
            lastName: 'Brown',

            fullName: Stitch.computed(function() {
                return `${this.firstName} ${this.lastName}`;
            }),

            isActive: false,

            statusLabel: Stitch.computed(function() {
                return this.isActive ? 'Active' : 'Inactive';
            })
        }
    ]
});
```

**Using with ForEach:**

```html
<div data-foreach="users">
    <h3 data-text="fullName"></h3>
    <span data-text="statusLabel"></span>
    <button data-click="$parent.toggleStatus">Toggle</button>
</div>
```

**How It Works:**

When `Observable.create()` processes an array containing objects with computed properties, it performs **eager conversion**:

1. Each array item is inspected for `Stitch.computed()` markers
2. Computed properties are extracted and regular properties are made reactive
3. Computed properties are then defined as getters on the reactive item
4. This happens immediately during `Observable.create()` - no lazy conversion

This eager processing ensures that computed properties are available as soon as `data-foreach` binds the array items, preventing "property does not exist" errors.

**Why Eager Conversion Matters:**

Without eager conversion, array items would be converted lazily (on first access), which causes problems:

```javascript
// Without eager conversion (broken):
// 1. Observable.create() leaves array items as-is
// 2. data-foreach accesses items for the first time
// 3. Items are converted to reactive, but computed markers get skipped
// 4. Result: fullName and statusLabel are undefined ❌

// With eager conversion (correct):
// 1. Observable.create() immediately processes all array items
// 2. Computed properties become getters before foreach sees them
// 3. data-foreach accesses items with computed properties already working
// 4. Result: fullName and statusLabel work perfectly ✅
```

**Important Notes:**

- Eager conversion only applies to array items with computed properties
- Array items without computed properties use standard reactive conversion
- Both simple `Stitch.computed(fn)` and advanced `computed({ get, deps })` syntax are supported
- The array itself is also reactive, so `push()`, `splice()`, etc. trigger updates

---

## Type Conversion System

Automatic bidirectional type conversion between model values and DOM strings.

### The Problem

```javascript
// BEFORE type converters - Type mismatch causes issues
model.selectedId = 101;  // number in model
<option value="101">     // string in DOM

// Strict equality fails: "101" === 101 → false ❌
// Result: Dropdown shows placeholder instead of selection!
```

### The Solution

```javascript
// WITH type converters - Automatic conversion
model.selectedId = 101;  // number in model
<option value="101">     // string in DOM

// Type-aware equality: converter.equals("101", 101) → true ✅
// Result: Dropdown correctly shows selected option!
```

### Available Type Converters

| Type | toModel() | toDom() | Use Case |
|------|-----------|---------|----------|
| `int` | `parseInt()` | `String()` | Integer IDs, counts, indices |
| `float` | `parseFloat()` | `String()` | Prices, percentages, measurements |
| `boolean` | `=== 'true'` | `String()` | Yes/No dropdowns, flags |
| `string` | `String()` | `String()` | Text fields (default for most) |
| `date` | `new Date()` | ISO string | Date pickers |
| `datetime` | `new Date()` | ISO string | DateTime pickers |
| `auto` | Smart parse | `String()` | Loose equality fallback |

### Type Inference Algorithm

Type conversion is determined by **single-pass evaluation** where each converter's `canHandle()` method checks multiple criteria together, not by sequential priority levels.

**How Type Selection Works:**

**Step 1: Explicit `data-type` Attribute (Immediate Selection)**

If element has `data-type` attribute, that converter is used immediately:

```html
<input data-value="age" data-type="int">
<!-- int converter selected, all other checks skipped -->
```

**Step 2: Converter `canHandle()` Evaluation**

If no `data-type` attribute exists, Stitch.js iterates through all converters and calls each one's `canHandle(value, element)` method. **The first converter that returns `true` is selected.**

Each converter's `canHandle()` method evaluates **multiple criteria in a SINGLE check** using OR logic:

```javascript
// Example: int converter's canHandle() checks MULTIPLE criteria together
int.canHandle(value, element) {
    return element?.getAttribute("data-type") === "int" ||  // Explicit type
           (element?.type === "number" && Number.isInteger(value));  // HTML + value
}
```

**Common Criteria Checked by Converters:**
- Explicit `data-type` attribute (redundant with Step 1, defensive check)
- HTML `type` attribute (`type="number"`, `type="date"`, etc.)
- Value type inspection (`typeof value`, `Number.isInteger()`, `instanceof Date`)
- Element tag (`<textarea>`, `<select>`, etc.)

**Important:** There are no "priority levels" - each converter evaluates ALL its criteria in one boolean expression. If ANY criterion matches (OR logic), the converter returns `true`.

**Step 3: Value Type Fallback (No Element Context)**

If no element is provided (programmatic use), converters check value type only:

```javascript
typeof value === "number" && Number.isInteger(value) → int
typeof value === "number" && !Number.isInteger(value) → float
typeof value === "boolean" → boolean
value instanceof Date → date
```

**Step 4: Auto Converter (Last Resort)**

If no converter matched, use `auto` converter with loose equality (`==`).

---

**Common Misconception:**

**WRONG:** "HTML `type` attribute has higher priority than value type"

**CORRECT:** "HTML `type` is one of several criteria evaluated together in each converter's `canHandle()` method"

**Example - Why This Matters:**

```html
<input type="text" data-value="userId">
```

```javascript
model.userId = 101;  // number
```

**You might think:** "HTML type='text' takes priority → string converter selected"

**What actually happens:**

1. No `data-type` → proceed to Step 2
2. Check `string.canHandle(101, element)`:
   - Checks: `element.tagName === "TEXTAREA"`? No → return `false`
3. Check `int.canHandle(101, element)`:
   - Checks: `element.type === "number"`? No
   - Checks: `Number.isInteger(101)`? **Yes** → return `true`
4. Use `int` converter

**Result:** Integer converter is selected because value type criterion matched, even though HTML type was "text". The criteria are checked together with OR logic, not as sequential priority levels.

**Type Attribute Usage:**
```html
<!-- Explicit type specification -->
<input data-value="age" data-type="int">
<input data-value="price" data-type="float">
<select data-value="country" data-type="string">
```

### Usage Examples

**Explicit Integer Type:**
```html
<select data-value="selectedDistrictId" data-type="int">
    <option value="101">District 1</option>
    <option value="102">District 2</option>
    <option value="103">District 3</option>
</select>
```

```javascript
const model = Stitch.Observable.create({
    selectedDistrictId: 101  // number
});

// Works perfectly!
// Converter: 101 (number) ↔ "101" (DOM string)
// Equality: converter.equals("101", 101) → true ✅
```

**Float Conversion for Prices:**
```html
<input type="number"
       data-value="price"
       data-type="float"
       step="0.01">
```

```javascript
const model = Stitch.Observable.create({
    price: 19.99  // number (float)
});

// Automatically converts:
// Model → DOM: 19.99 → "19.99"
// DOM → Model: "19.99" → 19.99
```

**Boolean Dropdowns:**
```html
<select data-value="isActive" data-type="boolean">
    <option value="true">Yes</option>
    <option value="false">No</option>
</select>
```

```javascript
const model = Stitch.Observable.create({
    isActive: true  // boolean
});

// Converts:
// Model → DOM: true → "true"
// DOM → Model: "true" → true (boolean)
```

**Date Inputs:**
```html
<input type="date"
       data-value="birthDate"
       data-type="date">
```

```javascript
const model = Stitch.Observable.create({
    birthDate: new Date('1990-01-15')
});

// Converts:
// Model → DOM: Date object → "1990-01-15"
// DOM → Model: "1990-01-15" → Date object
```

**Automatic Inference from HTML Type:**
```html
<!-- No data-type needed - inferred from type="number" -->
<input type="number" data-value="age">
```

```javascript
const model = Stitch.Observable.create({
    age: 25  // Automatically uses float converter
});
```

### Null Handling

```javascript
// Empty strings convert to null for numeric/date types
<input type="number" data-value="age">
model.age = "";  // Converts to null (not 0 or NaN)

// Null converts to empty string in DOM
model.age = null;  // DOM shows "" (empty field)
```

### Error Handling

```javascript
// Invalid conversions return null with console warning
model.age = "abc";  // Console: "Failed to convert 'abc' to float. Returning null."
// model.age becomes null (safe fallback)
```

---

## Model Message Bus API

Every Observable created with `Observable.create()` includes 6 built-in methods for event observation and coordination. All methods use the `$` prefix (Vue.js convention) to indicate framework-provided instance methods.

Each observable gets its **own per-model MessageBus**. Events emitted on one model are only delivered to subscribers on that same model — they do not leak across unrelated observables.

> ⚠️ **V2.0 Breaking Change - MessageBus Role Change:**
>
> In **v1.0**, MessageBus was the core reactivity mechanism for property changes (async).
> In **v2.0**, MessageBus is used for **user events only** (`$emit`, `$on`).
>
> **Property change reactivity** is now handled by **ReactiveSystem** (synchronous).
>
> **Recommended Migration:**
> - ✅ Use `$watch()` for property observation (still works, now uses ReactiveSystem internally)
> - ⚠️ Avoid subscribing to 'property-changed' events directly (deprecated, may be removed in future)
> - ❌ `$on('array-mutation')` and `$on('nested-change')` no longer receive internal framework events — these now run on a separate internal bus. Use `$watch()` instead.
> - ✅ Continue using `$emit()` / `$on()` for custom user events
>
> See [MIGRATION.md](MIGRATION.md) for complete details.

### `model.$on(event, callback)`

Subscribe to Message Bus events. Returns an unsubscribe function.

**Parameters:**
- `event` (String) - Event name: custom events, or '*' (wildcard)
  - ⚠️ **Removed:** 'property-changed', 'nested-change', 'array-mutation' are no longer delivered to model `$on()`. Use `$watch()` for property observation.
- `callback` (Function) - Handler function receiving payload

**Returns:** Function - Unsubscribe function

**Example (Custom Events - Recommended):**
```javascript
const model = Stitch.Observable.create({
    user: null
});

// Subscribe to custom events
const unsubscribe = model.$on('user-login', (payload) => {
    console.log('User logged in:', payload.user);
});

model.$emit('user-login', { user: { name: 'Alice' } });  // Logs: "User logged in: ..."

// Unsubscribe when done
unsubscribe();
```

**⚠️ Deprecated Pattern (v1.0 - Use $watch instead):**
```javascript
// ❌ Deprecated in v2.0 (still works but not recommended)
const unsubscribe = model.$on('property-changed', (payload) => {
    console.log(`${payload.key} changed:`, payload.oldValue, '→', payload.newValue);
});

// ✅ Use $watch() instead:
const unsubscribe = model.$watch('count', (newValue, oldValue) => {
    console.log('count changed:', oldValue, '→', newValue);
});
```

**Wildcard Subscription:**
```javascript
model.$on('*', ({ event, payload }) => {
    console.log('[Any Event]', event, payload);
});
```

### `model.$watch(property, callback, options)`

Watch a specific property for changes. Uses ReactiveSystem internally for efficient, synchronous tracking.

**Parameters:**
- `property` (String) - Property name to watch
- `callback` (Function) - Handler receiving (newValue, oldValue, payload)
- `options` (Object, optional) - Configuration options
  - `batch` (Boolean) - If `true`, batches callback execution in microtask. Default: `false` (immediate)

**Returns:** Function - Unsubscribe function

> ⚠️ **V2.0 Breaking Change:** `$watch` is **immediate by default** (was async in v1.0).
>
> - **v1.0:** Callbacks executed asynchronously via MessageBus
> - **v2.0:** Callbacks executed **immediately** by default (synchronous)
> - **v2.0:** Opt into batching with `{ batch: true }` option

**Example (Immediate - Default in v2.0):**
```javascript
const model = Stitch.Observable.create({
    selectedCountry: '',
    selectedState: ''
});

// Watch specific property (immediate execution)
model.$watch('selectedCountry', (newValue, oldValue) => {
    console.log('Country changed from', oldValue, 'to', newValue);
    model.selectedState = '';  // Reset dependent field
});

model.selectedCountry = 'USA';  // Triggers callback IMMEDIATELY
model.selectedState = 'CA';     // Does NOT trigger callback
```

**Example (Batched Execution):**
```javascript
// Opt into batched execution (v1.0 behavior)
model.$watch('selectedCountry', (newValue, oldValue) => {
    console.log('Country changed (batched):', newValue);
}, { batch: true });  // ← Batches in microtask

model.selectedCountry = 'USA';  // Callback queued, runs in microtask
```

### `model.$use(middleware)`

Add middleware to the Message Bus for logging, validation, or debugging.

**Parameters:**
- `middleware` (Function) - Middleware function receiving eventData, must return eventData

**Returns:** Void

**Example:**
```javascript
const model = Stitch.Observable.create({ count: 0 });

// Add logging middleware
model.$use((eventData) => {
    console.log('[Middleware]', eventData.event, eventData.timestamp);
    return eventData;  // Must return eventData
});

// Add validation middleware
model.$use((eventData) => {
    if (eventData.event === 'property-changed' && eventData.payload.key === 'count') {
        if (eventData.payload.newValue < 0) {
            console.warn('Count cannot be negative!');
        }
    }
    return eventData;
});

model.count = -5;  // Logs warning via middleware
```

### `model.$off(event, callback)`

Unsubscribe from a specific event.

**Parameters:**
- `event` (String) - Event name
- `callback` (Function) - Handler function to remove

**Returns:** Void

**Example:**
```javascript
const model = Stitch.Observable.create({ count: 0 });

const handler = (payload) => {
    console.log('Count changed:', payload.newValue);
};

// Subscribe
model.$on('property-changed', handler);

// Later, unsubscribe
model.$off('property-changed', handler);
```

**Note:** Most use cases prefer the unsubscribe function returned by `$on()`:
```javascript
const unsubscribe = model.$on('property-changed', handler);
unsubscribe();  // Cleaner than $off()
```

### `model.$emit(event, payload)`

Emit custom events for decoupled communication patterns.

**Parameters:**
- `event` (String) - Custom event name
- `payload` (Any) - Event data

**Returns:** Void

**Example:**
```javascript
const model = Stitch.Observable.create({
    user: null,

    async login(credentials) {
        this.user = await api.login(credentials);
        this.$emit('logged-in', { user: this.user });  // Custom event
    },

    async logout() {
        this.user = null;
        this.$emit('logged-out', { timestamp: Date.now() });
    }
});

// Subscribe to custom events
model.$on('logged-in', (payload) => {
    console.log('User logged in:', payload.user);
    redirectToDashboard();
});

model.$on('logged-out', (payload) => {
    console.log('User logged out at', new Date(payload.timestamp));
    redirectToLogin();
});
```

### `model.$once(event, callback)`

Subscribe to an event for one-time execution only. Auto-unsubscribes after first invocation.

**Parameters:**
- `event` (String) - Event name
- `callback` (Function) - Handler function

**Returns:** Function - Unsubscribe function

**Example:**
```javascript
const model = Stitch.Observable.create({ status: 'loading' });

// Only log the first time status changes
model.$once('property-changed', (payload) => {
    console.log('Status changed for the first time:', payload.newValue);
});

model.status = 'loaded';    // Logs: "Status changed..."
model.status = 'error';     // Does NOT log (already unsubscribed)
```

**Common Use Cases:**
```javascript
// Wait for initialization
model.$once('initialized', () => {
    console.log('Model ready!');
});

// One-time data load
model.$once('data-loaded', (payload) => {
    renderChart(payload.data);
});

// First error only
model.$once('error', (payload) => {
    showErrorModal(payload.message);
});
```

### Common Patterns

**Pattern 1: Cascading Dropdowns**
```javascript
const model = Stitch.Observable.create({
    selectedCountry: '',
    selectedState: '',
    states: []
});

// Reset state when country changes
model.$watch('selectedCountry', (newCountry) => {
    model.selectedState = '';
    model.states = getStatesForCountry(newCountry);
});
```

**Pattern 2: Form Validation**
```javascript
const form = Stitch.Observable.create({
    email: '',
    errors: []
});

// Validate on change
model.$watch('email', (newEmail) => {
    if (!isValidEmail(newEmail)) {
        form.errors.push('Invalid email');
    }
});
```

**Pattern 3: Analytics Tracking**
```javascript
const model = Stitch.Observable.create({ /* ... */ });

// Track all property changes
model.$on('property-changed', (payload) => {
    analytics.track('model-changed', {
        property: payload.key,
        value: payload.newValue
    });
});
```

**Pattern 4: Debugging**
```javascript
const model = Stitch.Observable.create({ /* ... */ });

// Log all events during development
if (DEBUG_MODE) {
    model.$on('*', ({ event, payload }) => {
        console.log('[Debug]', event, payload);
    });
}
```

**Pattern 5: Workflow Events**
```javascript
const model = Stitch.Observable.create({
    async saveData() {
        this.$emit('saving');
        try {
            await api.save(this.data);
            this.$emit('saved', { success: true });
        } catch (error) {
            this.$emit('save-error', { error });
        }
    }
});

model.$on('saving', () => showSpinner());
model.$on('saved', () => { hideSpinner(); showSuccess(); });
model.$on('save-error', ({ error }) => showError(error));
```

---

## Advanced Features

### Property-Specific Hooks

Create custom binding behavior for individual properties without affecting global bindings.

```javascript
const binder = new Stitch.DataBinder({
    properties: {
        // Custom binding for 'status' property
        'status': {
            onBind(element, value, binding, fullPath) {
                element.className = `status-${value}`;
                element.textContent = value.toUpperCase();
            },
            onChange(element, newValue, oldValue, binding, fullPath) {
                element.className = `status-${newValue}`;
                element.textContent = newValue.toUpperCase();
            }
        },

        // Custom binding for 'priority' property
        'priority': {
            onBind(element, value) {
                const colors = { low: 'green', medium: 'yellow', high: 'red' };
                element.style.backgroundColor = colors[value] || 'gray';
            },
            onChange(element, newValue) {
                const colors = { low: 'green', medium: 'yellow', high: 'red' };
                element.style.backgroundColor = colors[newValue] || 'gray';
            }
        }
    }
});

binder.bind('#app', model);
```

**HTML:**
```html
<!-- These properties use custom hooks -->
<div data-text="status"></div>
<div data-text="priority"></div>

<!-- Other properties use default bindings -->
<div data-text="name"></div>
```

### Custom Bindings

Register your own custom attribute bindings using `DataBinder.registerBinding()`.

**Handler Signature:**
```javascript
{
    bind(element, viewModel, path, context) {
        // element: The DOM element being bound
        // viewModel: The reactive model object
        // path: The property path string (e.g., 'themeColor')
        // context: { reactiveSystem, binder }

        // IMPORTANT: Wrap binding logic in effect() for reactivity
        // V2.0: Use { batch: true } for DOM updates to enable efficient batching
        context.reactiveSystem.effect(() => {
            const value = getProperty(viewModel, path);
            // Apply binding logic here
        }, { batch: true });  // ← V2.0: Required for DOM effects
    }
}
```

**Example: Color Binding**
```javascript
// Define custom binding handler
const colorHandler = {
    bind(element, viewModel, path, context) {
        // Create reactive effect that updates element color
        context.reactiveSystem.effect(() => {
            const color = getProperty(viewModel, path);
            element.style.color = color || '';
        }, { batch: true });  // ← V2.0: Enable DOM update batching
    }
};

// Register the custom binding
Stitch.DataBinder.registerBinding('color', colorHandler);
```

**Usage:**
```html
<div data-color="themeColor">Custom colored text</div>
```

**Example: Tooltip Binding**
```javascript
Stitch.DataBinder.registerBinding('tooltip', {
    bind(element, viewModel, path, context) {
        context.reactiveSystem.effect(() => {
            const value = getProperty(viewModel, path);
            element.setAttribute('title', value || '');
        }, { batch: true });  // ← V2.0: Enable DOM update batching
    }
});
```

```html
<button data-tooltip="helpText">Hover me</button>
```

**Example: Background Binding**
```javascript
Stitch.DataBinder.registerBinding('background', {
    bind(element, viewModel, path, context) {
        context.reactiveSystem.effect(() => {
            const bgColor = getProperty(viewModel, path);
            element.style.backgroundColor = bgColor || '';
        }, { batch: true });  // ← V2.0: Enable DOM update batching
    }
});
```

```html
<div data-background="statusColor">Status indicator</div>
```

**Helper Function:**
```javascript
// getProperty is an internal helper, you can use this pattern:
function getProperty(obj, path) {
    return path.split('.').reduce((curr, prop) => curr?.[prop], obj);
}
```

**Key Points:**
- ✅ **ALWAYS** use `context.reactiveSystem.effect()` to create reactive bindings
- ✅ **V2.0:** Use `{ batch: true }` option for DOM effects to enable efficient batching
- ✅ Handler has only ONE method: `bind()` (no `update()` method)
- ✅ Use `getProperty()` to access nested paths like `'user.profile.name'`
- ✅ Registered bindings work exactly like built-in bindings (text, value, etc.)
- ⚠️ Custom bindings use `data-[name]` attributes (e.g., `data-color`, `data-tooltip`)

**What Can Be Extended:**

Stitch.js provides a public API for extending **binding types** only:

| Feature | Extensible? | API |
|---------|-------------|-----|
| **Binding Types** | ✅ Yes | `Stitch.DataBinder.registerBinding(name, handler)` |
| **Type Converters** | ❌ No | Internal-only (no public API) |
| **Value Handlers** | ❌ No | Internal-only (no public API) |
| **Attribute Handlers** | ❌ No | Internal-only (no public API) |

**Why Value/Attribute Handlers Aren't Extensible:**

VALUE_HANDLERS and ATTR_VALUE_HANDLERS are internal architecture components that work closely with the reactive system's bidirectional data flow. They are not designed to be extended by users for these reasons:

1. **Type Safety:** Handlers manage critical type conversion between DOM strings and model values. Custom handlers could break type consistency.
2. **Framework Internals:** Handlers are tightly coupled to internal binding logic and the reactive system's update cycle.
3. **Use Case Coverage:** The built-in handlers (`input`, `textarea`, `select`, `checkbox`, `radio`) cover all standard HTML form elements.

**If you need custom input behavior:**

Instead of trying to extend value handlers, use **custom bindings** (which ARE extensible) to create specialized behavior:

```javascript
// ✅ Instead of extending value handlers, create a custom binding
Stitch.DataBinder.registerBinding('custom-input', {
    bind(element, viewModel, path, context) {
        // Full control over input/output behavior
        context.reactiveSystem.effect(() => {
            const value = getProperty(viewModel, path);
            // Custom DOM update logic
            element.value = customFormat(value);
        }, { batch: true });  // ← V2.0: Enable DOM update batching

        // Custom user input handling
        element.addEventListener('input', () => {
            const rawValue = element.value;
            setProperty(viewModel, path, customParse(rawValue));
        });
    }
});
```

This approach gives you complete control while maintaining compatibility with the framework.

### Debug Mode

Enable debug logging to understand reactivity flow:

```javascript
// Enable debug logging
Stitch.debug.enable();

// Now see detailed logging
const model = Stitch.Observable.create({ count: 0 });
model.count = 5;  // Logs: "[Stitch.js Debug] Property 'count' changed: 0 → 5"
```

#### Property Validation Features (Debug Mode Only)

When debug mode is enabled, Stitch.js validates property bindings and provides helpful diagnostic output for typos and missing properties.

**⚠️ Important:** Validation only runs when `Stitch.debug.enable()` is called. Don't rely on validation warnings in production - they won't appear unless debug is enabled.

**Features:**

1. **Property Existence Checking**

   Detects when bindings reference non-existent properties:

   ```javascript
   Stitch.debug.enable();

   const model = Stitch.Observable.create({
       userName: 'John',
       userEmail: 'john@example.com'
   });

   // Typo in binding
   binder.bind('<div data-text="usrName"></div>', model);

   // Console warning:
   // "[Stitch.js] text binding failed: Property 'usrName' not found"
   ```

2. **Fuzzy Matching Suggestions**

   Suggests correct property names for typos:

   ```javascript
   Stitch.debug.enable();

   const model = Stitch.Observable.create({
       firstName: 'John',
       lastName: 'Doe'
   });

   // Typo: "firstNam" instead of "firstName"
   binder.bind('<div data-text="firstNam"></div>', model);

   // Console warning:
   // "[Stitch.js] text binding failed: Property 'firstNam' not found
   //  Did you mean 'firstName'?"
   ```

3. **Available Properties Listing**

   Shows all available properties on the model:

   ```javascript
   Stitch.debug.enable();

   const model = Stitch.Observable.create({
       count: 0,
       message: 'Hello',
       items: []
   });

   binder.bind('<div data-text="missing"></div>', model);

   // Console warning includes:
   // {
   //     element: "DIV",
   //     expectedProperty: "missing",
   //     availableProperties: ["count", "message", "items"],
   //     totalProperties: 3
   // }
   ```

4. **Element Context Information**

   Provides element details for debugging:

   ```html
   <div id="user-card" class="card" data-text="missingProp"></div>
   ```

   ```javascript
   Stitch.debug.enable();

   // Console warning includes:
   // {
   //     element: "DIV",
   //     elementId: "user-card",
   //     elementClasses: "card",
   //     expectedProperty: "missingProp",
   //     ...
   // }
   ```

**How to Enable Validation:**

```javascript
// Enable all debug features (includes validation)
Stitch.debug.enable();

// OR enable specific category
Stitch.debug.enableCategory('bindings');

// Now bindings will be validated and warnings will appear
const binder = new Stitch.DataBinder();
binder.bind('#app', model);
```

**Production vs Development:**

```javascript
// Development
if (process.env.NODE_ENV === 'development') {
    Stitch.debug.enable();  // Validation warnings appear
}

// Production
// Debug disabled by default - no validation overhead
```

---

## API Reference

### Observable

**`Stitch.Observable.create(data, options)`**
- **Description:** Creates a reactive object
- **Parameters:**
  - `data` (Object) - Initial data
  - `options` (Object, optional) - Configuration options
- **Returns:** Reactive proxy object
- **Example:**
  ```javascript
  const model = Stitch.Observable.create({
      count: 0,
      message: 'Hello'
  });
  ```

**`Stitch.Observable.createArray(array)`**
- **Description:** Creates a reactive array
- **Parameters:**
  - `array` (Array) - Initial array
- **Returns:** Reactive proxy array
- **Example:**
  ```javascript
  const items = Stitch.Observable.createArray([1, 2, 3]);
  ```

**`Stitch.Observable.reactive(obj)`**
- **Description:** Makes existing object reactive
- **Parameters:**
  - `obj` (Object) - Object to make reactive
- **Returns:** Reactive proxy object
- **Example:**
  ```javascript
  const obj = { count: 0 };
  const reactive = Stitch.Observable.reactive(obj);
  ```

**`Stitch.Observable.isReactive(obj)`**
- **Description:** Check if an object is reactive
- **Parameters:**
  - `obj` (Any) - Object to check
- **Returns:** Boolean - True if object is reactive, false otherwise
- **Example:**
  ```javascript
  const model = Stitch.Observable.create({ count: 0 });
  const isReactive = Stitch.Observable.isReactive(model);  // true

  const plain = { count: 0 };
  Stitch.Observable.isReactive(plain);  // false
  ```

**`Stitch.Observable.toRaw(obj)`**
- **Description:** Get the raw (non-reactive) version of a reactive object
- **Parameters:**
  - `obj` (Object) - Reactive object
- **Returns:** Object - Raw object without reactivity
- **Note:** Equivalent to calling `model.toJSON()` on the instance
- **Example:**
  ```javascript
  const model = Stitch.Observable.create({ count: 0 });
  const raw = Stitch.Observable.toRaw(model);
  // OR equivalently:
  const raw2 = model.toJSON();

  // Modifications to raw don't trigger reactivity
  raw.count = 5;  // No reactive updates
  ```

**`model.toJSON()`**
- **Description:** Instance method to convert reactive object to plain object (same as `Observable.toRaw()`)
- **Parameters:** None
- **Returns:** Object - Plain object without reactivity
- **Use Case:** Useful for serialization, API calls, or debugging
- **Example:**
  ```javascript
  const model = Stitch.Observable.create({
      name: 'John',
      count: 5,
      doubled: Stitch.computed(function() { return this.count * 2; })
  });

  const plain = model.toJSON();
  // { name: 'John', count: 5, doubled: 10 }

  JSON.stringify(plain);  // Works without issues
  ```

**`model.set(path, value)`**
- **Description:** Set nested property value using dot notation
- **Parameters:**
  - `path` (String) - Property path (e.g., "user.name" or "items.0.title")
  - `value` (Any) - Value to set
- **Returns:** Void
- **Note:** Creates intermediate objects as plain objects initially, but they automatically become reactive when assigned to the reactive parent (due to eager reactivity). For array access, use numeric keys like "items.0" instead of bracket notation "items[0]"
- **Example:**
  ```javascript
  const model = Stitch.Observable.create({ user: {} });

  // Set nested property
  model.set('user.name', 'John');
  // model.user.name is now 'John'

  // Works with arrays (use numeric keys)
  model.set('items', ['a', 'b', 'c']);
  model.set('items.0', 'A');  // ✅ Works
  // model.set('items[0]', 'A');  // ❌ Would create property 'items[0]'
  ```
- **Reactivity Behavior:**

  When `set()` creates intermediate objects, they start as plain objects but immediately become reactive when assigned to the reactive parent:

  ```javascript
  const model = Stitch.Observable.create({ });

  // Create deep nested path
  model.set('user.profile.settings.theme', 'dark');

  // What happens internally:
  // 1. Creates plain object: { profile: {} }
  // 2. Assigns to model.user (reactive parent)
  // 3. Eager reactivity: model.user becomes reactive proxy
  // 4. Creates plain object: { settings: {} }
  // 5. Assigns to model.user.profile (reactive parent)
  // 6. Eager reactivity: model.user.profile becomes reactive proxy
  // ... and so on

  // Result: ALL intermediate objects ARE reactive
  model.user.profile.settings.theme = 'light';  // ✅ Triggers updates!
  ```

  **Why This Works:**

  Stitch.js uses **eager reactivity** - when you assign ANY object to a reactive parent, it automatically converts to a reactive proxy. So even though `set()` creates plain objects internally, they become reactive the moment they're assigned as properties of reactive objects.

  **Practical Implication:**

  ```javascript
  const model = Stitch.Observable.create({});

  // Create nested structure
  model.set('settings.theme.mode', 'dark');

  // All of these are reactive and trigger updates:
  model.settings.theme.mode = 'light';        // ✅ Reactive
  model.settings.theme = { mode: 'auto' };    // ✅ Reactive
  model.settings = { theme: { mode: 'dark' } }; // ✅ Reactive
  ```

  The only time this doesn't work is if you keep a reference to the plain object BEFORE it's assigned:

  ```javascript
  const model = Stitch.Observable.create({});

  // DON'T DO THIS - bypasses reactivity:
  const plainSettings = {};  // Plain object
  plainSettings.theme = 'dark';
  model.set('settings', plainSettings);  // Now reactive

  // This won't trigger updates (using old reference):
  plainSettings.theme = 'light';  // ❌ Not reactive (old reference)

  // This WILL trigger updates (using reactive reference):
  model.settings.theme = 'light';  // ✅ Reactive
  ```

**`model.get(path)`**
- **Description:** Get nested property value using dot notation
- **Parameters:**
  - `path` (String) - Property path (e.g., "user.name" or "items.0.title")
- **Returns:** Any - Property value, or undefined if not found
- **Note:** Safely navigates nested structures. Logs warnings for null/undefined or missing properties (when debug enabled)
- **Example:**
  ```javascript
  const model = Stitch.Observable.create({
      user: { name: 'John', age: 25 }
  });

  model.get('user.name');   // 'John'
  model.get('user.email');  // undefined (with warning if debug enabled)

  // Works with arrays (use numeric keys)
  model.get('items.0.name');  // ✅ Works
  // model.get('items[0].name');  // ❌ Would look for property 'items[0]'
  ```

**`model.$set(key, value)`**
- **Description:** Dynamically add a reactive property to an existing observable
- **Parameters:**
  - `key` (String) - Property name
  - `value` (Any) - Initial value
- **Returns:** Void
- **Example:**
  ```javascript
  const model = Stitch.Observable.create({ name: 'John' });

  // Add dynamic property (becomes reactive)
  model.$set('age', 25);

  // Now reactive!
  model.age = 26;  // Triggers updates
  ```
- **When to Use `$set()` vs. Direct Assignment:**
  ```javascript
  const model = Stitch.Observable.create({ name: 'John' });

  // ✅ Modifying existing property - use direct assignment
  model.name = 'Jane';  // Works (property already exists and is reactive)

  // ❌ Adding new property - direct assignment NOT reactive
  model.age = 25;  // NOT reactive! Won't trigger updates

  // ✅ Adding new property - use $set()
  model.$set('age', 25);  // Reactive! Will trigger updates
  model.age = 26;         // Now works reactively
  ```
- **Common Use Cases:**

  **1. Dynamic Form Fields:**
  ```javascript
  const form = Stitch.Observable.create({
      requiredFields: ['name', 'email']
  });

  // User adds optional field
  function addField(fieldName, defaultValue) {
      form.$set(fieldName, defaultValue);
  }

  addField('phone', '');
  addField('address', '');

  // Now these fields are reactive
  form.phone = '555-1234';  // Triggers updates
  ```

  **2. User Preferences:**
  ```javascript
  const settings = Stitch.Observable.create({
      theme: 'light'
  });

  // User enables experimental feature
  function enableFeature(featureName) {
      settings.$set(featureName, true);
  }

  enableFeature('darkMode');
  enableFeature('betaFeatures');

  // HTML bindings work immediately
  // <div data-visible="darkMode">Dark mode enabled</div>
  ```

  **3. Conditional Properties:**
  ```javascript
  const dashboard = Stitch.Observable.create({
      userRole: 'admin'
  });

  // Add role-specific properties dynamically
  if (dashboard.userRole === 'admin') {
      dashboard.$set('canDelete', true);
      dashboard.$set('canEditUsers', true);
  }

  // Bindings respond immediately
  // <button data-visible="canDelete">Delete</button>
  ```

  **4. Plugin System:**
  ```javascript
  const app = Stitch.Observable.create({
      plugins: []
  });

  function loadPlugin(pluginName, pluginData) {
      // Add plugin state dynamically
      app.$set(pluginName + 'Enabled', true);
      app.$set(pluginName + 'Data', pluginData);
  }

  loadPlugin('analytics', { trackingId: '123' });
  // Creates: app.analyticsEnabled = true
  //          app.analyticsData = { trackingId: '123' }
  ```

  **5. Runtime Configuration:**
  ```javascript
  const config = Stitch.Observable.create({
      apiUrl: '/api'
  });

  // Load additional config from server
  async function loadRemoteConfig() {
      const remote = await fetch('/config').then(r => r.json());

      // Add all remote properties reactively
      Object.keys(remote).forEach(key => {
          config.$set(key, remote[key]);
      });
  }

  loadRemoteConfig();
  // All remote config properties are now reactive
  ```

- **Important Notes:**
  - ✅ Properties added with `$set()` are fully reactive
  - ✅ Works with computed properties that depend on the new property
  - ✅ Works with all bindings (data-text, data-visible, etc.)
  - ⚠️ Use `$set()` ONLY for properties that don't exist yet
  - ⚠️ For existing properties, use direct assignment: `model.prop = value`

- **Edge Cases:**

  **Attempting to $set() Computed Properties:**

  ```javascript
  const model = Stitch.Observable.create({
      count: 0,
      doubled: Stitch.computed(function() { return this.count * 2; })
  });

  // ❌ This will fail (computed properties are read-only)
  model.$set('doubled', 20);
  // Computed property has a getter, $set() attempts direct assignment
  // Result: TypeError (computed properties don't have setters)
  ```

  **Setting Properties That Already Have Getters:**

  If a property already exists and has a getter (like computed properties), `$set()` simply assigns the value directly rather than creating a new reactive descriptor. This means:

  ```javascript
  const model = Stitch.Observable.create({ count: 0 });

  // Define a custom getter
  Object.defineProperty(model, 'customProp', {
      get() { return 'custom value'; }
  });

  // Calling $set on property with getter
  model.$set('customProp', 'new value');
  // Behavior: Direct assignment attempted (this.customProp = value)
  // Result: May fail if getter has no setter, or no-op if read-only
  ```

  **Recommended:** Only use `$set()` for adding entirely new properties that don't exist on the model. For modifying existing properties (even dynamic ones), use direct assignment.

**`Stitch.computed(fn)`**
- **Description:** Creates a computed property marker for use with `Observable.create()`. This marker is recognized and converted to a reactive property getter when the observable is created.
- **Parameters:**
  - `fn` (Function|Object) - Computed property function OR config object
    - When **Function**: Automatic dependency tracking
    - When **Object**: Must have `get` function and optional `deps` array
- **Returns:** Marker object `{ __isStitchComputed: true, fn: <your function> }`
- **Important:** The returned marker is ONLY used by `Observable.create()` to identify computed properties. You never interact with this marker directly - `Observable.create()` transforms it into a simple property getter on your model.
- **Public API - What You Use:**
  ```javascript
  const model = Stitch.Observable.create({
      count: 5,
      doubled: Stitch.computed(function() { return this.count * 2; })
  });

  // ✅ CORRECT: Access as simple property
  console.log(model.doubled);  // 10

  // ❌ WRONG: Don't access marker properties
  console.log(model.doubled.__isStitchComputed);  // undefined (marker removed)
  console.log(model.doubled.fn);  // undefined (marker removed)
  ```
- **Example (Function Syntax):**
  ```javascript
  const model = Stitch.Observable.create({
      count: 0,
      doubleCount: Stitch.computed(function() {
          return this.count * 2;
      })
  });

  // Access like any property
  model.doubleCount;  // Returns count * 2
  ```
- **Example (Object Syntax):**
  ```javascript
  const model = Stitch.Observable.create({
      count: 0,
      multiplier: 2,
      result: Stitch.computed({
          get() { return this.count * this.multiplier; },
          deps: ['count', 'multiplier']
      })
  });

  // Access like any property
  model.result;  // Returns count * multiplier
  ```
- **Note on `deps` Array:**

  The `deps` array in object syntax is processed by `Observable.create()` when the computed property is attached to an observable. It is NOT a standalone feature of `Stitch.computed()`.

  **This works (deps processed by Observable.create()):**
  ```javascript
  const model = Stitch.Observable.create({
      count: 5,
      multiplier: 2,
      result: Stitch.computed({
          get() { return this.count * this.multiplier; },
          deps: ['count', 'multiplier']
      })
  });
  ```

  **This doesn't work (standalone computed doesn't process deps):**
  ```javascript
  // ❌ deps won't be processed without Observable.create()
  const standaloneComputed = Stitch.computed({
      get() { return someGlobal * 2; },
      deps: ['someGlobal']
  });
  ```

  **Recursive Dependency Resolution:**

  When computed properties depend on other computed properties, `Observable.create()` automatically resolves dependencies recursively:

  ```javascript
  const model = Stitch.Observable.create({
      a: 1,
      b: Stitch.computed({ get() { return this.a * 2; }, deps: ['a'] }),
      c: Stitch.computed({ get() { return this.b * 2; }, deps: ['b'] })
  });

  // Internal resolution:
  // - 'c' depends on 'b'
  // - 'b' depends on 'a'
  // - Result: 'c' resolved dependencies = ['a'] (flattened transitively)
  ```

  **Circular Dependency Detection:**

  The framework detects circular dependencies during resolution and logs warnings:

  ```javascript
  const model = Stitch.Observable.create({
      x: Stitch.computed({ get() { return this.y * 2; }, deps: ['y'] }),
      y: Stitch.computed({ get() { return this.x * 2; }, deps: ['x'] })
  });

  // Console warning: "Circular dependency detected: x → y → x"
  // Framework prevents infinite loop, uses automatic tracking fallback
  ```

  In practice, you'll always use `Stitch.computed()` inside `Observable.create()`, so this limitation doesn't matter. Just be aware that `deps` is an Observable.create() feature, not a Stitch.computed() feature.

### DataBinder

**`new Stitch.DataBinder(options)`**
- **Description:** Creates a data binder instance
- **Parameters:**
  - `options` (Object, optional) - Binder configuration
    - `onBind` (Function) - Called after an element receives one or more bindings
    - `onChange` (Function) - Called when model changes are observed during a bind session
    - `properties` (Object) - Property-specific hooks (`onBind` / `onChange` per property key/path)
- **Example:**
  ```javascript
  const binder = new Stitch.DataBinder({
      onBind(element, context, bindings) {
          // Global bind hook
      },
      onChange(change, viewModel, rootElement) {
          // Global change hook
      },
      properties: {
          'status': {
              onBind(element, value) { /* ... */ },
              onChange(element, newValue) { /* ... */ }
          }
      }
  });
  ```

**`binder.bind(selector, viewModel)`**
- **Description:** Binds a view model to DOM element
- **Parameters:**
  - `selector` (String|Element) - CSS selector or DOM element
  - `viewModel` (Object) - Reactive model to bind
- **Example:**
  ```javascript
  binder.bind('#app', model);
  ```

**`binder.unbind(element)`**
- **Description:** Unbinds a DOM element and removes it from tracking
- **Parameters:**
  - `element` (String|Element) - CSS selector or DOM element to unbind
- **Returns:** Void
- **Behavior:** Removes bound tracking and runs all cleanups registered for that element (reactive effects + event listeners created by Stitch bindings).
- **Example:**
  ```javascript
  binder.unbind('#app');
  // Element is removed from tracking and per-element cleanups run
  ```

**`binder.dispose()`**
- **Description:** Global cleanup for the binder instance.
- **Behavior:** Runs all tracked cleanups for all bound elements, clears tracking state, and detaches from reactive system.
- **Use when:** Unmounting an entire Stitch-managed region (SPA route/component teardown).
- **Example:**
  ```javascript
  binder.dispose();
  ```

**Cleanup Guidance**
- Use `unbind(element)` for scoped teardown of a specific root/element.
- Use `dispose()` when discarding the binder entirely.
- Continue normal app-level reference management for models you no longer need.

**`Stitch.DataBinder.registerBinding(name, handler)`**
- **Description:** Register a custom attribute binding (static method)
- **Parameters:**
  - `name` (String) - Binding name (used as `data-[name]` attribute)
  - `handler` (Object) - Binding handler with `bind()` method
- **Returns:** Void
- **Throws:** Error if name is not a string or handler lacks `bind()` method
- **Example:**
  ```javascript
  // Register a custom 'color' binding
  Stitch.DataBinder.registerBinding('color', {
      bind(element, viewModel, path, context) {
          context.reactiveSystem.effect(() => {
              const color = getProperty(viewModel, path);
              element.style.color = color || '';
          });
      }
  });

  // Use in HTML: <div data-color="themeColor">Text</div>
  ```
- **Handler Signature:**
  - `bind(element, viewModel, path, context)`:
    - `element` (HTMLElement) - DOM element being bound
    - `viewModel` (Object) - Reactive model object
    - `path` (String) - Property path (e.g., `'user.name'`)
    - `context` (Object) - `{ reactiveSystem, binder }`
- **Error Handling:**
  ```javascript
  // Invalid name (throws error)
  Stitch.DataBinder.registerBinding(123, handler);
  // Error: "name must be a string"

  // Invalid handler (throws error)
  Stitch.DataBinder.registerBinding('color', {});
  // Error: "handler must have a bind() method"

  // Override existing binding (shows warning)
  Stitch.DataBinder.registerBinding('text', handler);
  // Warning: "Overriding existing handler 'text'"
  ```
- **See Also:** Custom Bindings section for complete examples

### Debug

**`Stitch.debug.enable()`**
- **Description:** Enable all debug logging across all categories
- **Returns:** Void
- **Example:**
  ```javascript
  Stitch.debug.enable();
  console.log('[Stitch.js] Debug mode ENABLED');
  ```

**`Stitch.debug.disable()`**
- **Description:** Disable all debug logging
- **Returns:** Void
- **Example:**
  ```javascript
  Stitch.debug.disable();
  console.log('[Stitch.js] Debug mode DISABLED');
  ```

**`Stitch.debug.enableCategory(category)`**
- **Description:** Enable debug logging for a specific category
- **Parameters:**
  - `category` (String) - Category name: 'reactivity', 'computed', 'effects', 'bindings', or 'messageBus'
- **Returns:** Void
- **Example:**
  ```javascript
  Stitch.debug.enableCategory('reactivity');
  ```

**`Stitch.debug.disableCategory(category)`**
- **Description:** Disable debug logging for a specific category
- **Parameters:**
  - `category` (String) - Category name
- **Returns:** Void
- **Example:**
  ```javascript
  Stitch.debug.disableCategory('computed');
  ```

**`Stitch.debug.categories()`**
- **Description:** List all available debug categories
- **Returns:** Void (logs to console)
- **Example:**
  ```javascript
  Stitch.debug.categories();
  // Logs: "[Stitch.js Debug] Available categories: reactivity, computed, effects, bindings, messageBus"
  ```

---

## Common Patterns

### Form Validation

```javascript
const form = Stitch.Observable.create({
    email: '',
    password: '',

    // Computed validation properties
    isEmailValid: Stitch.computed(function() {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.email);
    }),

    isPasswordValid: Stitch.computed(function() {
        return this.password.length >= 8;
    }),

    isFormValid: Stitch.computed(function() {
        return this.isEmailValid && this.isPasswordValid;
    }),

    // Action method
    handleSubmit() {
        if (this.isFormValid) {
            // Submit form
        }
    }
});
```

```html
<input data-value="email" type="email">
<div data-visible="isEmailValid" class="success">Valid email</div>

<input data-value="password" type="password">
<div data-visible="isPasswordValid" class="success">Strong password</div>

<button data-enabled="isFormValid" data-click="handleSubmit">Submit</button>
```

### Loading States

```javascript
const app = Stitch.Observable.create({
    data: [],
    isLoading: false,
    error: null,

    // Computed properties
    hasData: Stitch.computed(function() {
        return this.data.length > 0;
    }),

    hasError: Stitch.computed(function() {
        return this.error !== null;
    }),

    // Action method (async)
    async loadData() {
        this.isLoading = true;
        this.error = null;
        try {
            const response = await fetch('/api/data');
            this.data = await response.json();
        } catch (err) {
            this.error = err.message;
        } finally {
            this.isLoading = false;
        }
    }
});
```

```html
<div data-visible="isLoading">Loading...</div>
<div data-visible="hasError" data-text="error"></div>
<div data-visible="hasData">
    <ul data-foreach="data">
        <li data-text="$data"></li>
    </ul>
</div>
```

### Shopping Cart

```javascript
const cart = Stitch.Observable.create({
    items: [],

    // Computed properties
    total: Stitch.computed(function() {
        return this.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    }),

    itemCount: Stitch.computed(function() {
        return this.items.reduce((sum, item) => sum + item.quantity, 0);
    }),

    isEmpty: Stitch.computed(function() {
        return this.items.length === 0;
    }),

    // Action methods
    addItem(product) {
        const existing = this.items.find(item => item.id === product.id);
        if (existing) {
            existing.quantity++;
        } else {
            this.items.push({
                id: product.id,
                name: product.name,
                price: product.price,
                quantity: 1
            });
        }
    },

    removeItem(itemId) {
        const index = this.items.findIndex(item => item.id === itemId);
        if (index !== -1) {
            this.items.splice(index, 1);
        }
    },

    updateQuantity(itemId, quantity) {
        const item = this.items.find(item => item.id === itemId);
        if (item) {
            item.quantity = quantity;
        }
    }
});
```

```html
<div data-visible="isEmpty">Cart is empty</div>
<div data-visible="!isEmpty">
    <table>
        <tbody data-foreach="items">
            <tr>
                <td data-text="name"></td>
                <td data-text="price"></td>
                <td><input data-value="quantity" type="number" min="1"></td>
            </tr>
        </tbody>
    </table>
    <div>Total: $<span data-text="total"></span></div>
    <div>Items: <span data-text="itemCount"></span></div>
</div>
```

---

## Performance

### Efficient Updates

- **Only changed properties trigger re-renders**
- **Computed properties cached until dependencies change**
- **Minimal overhead per binding**

### Batched Updates

**V2.0:** Multiple synchronous state changes trigger only one DOM update via **BatchScheduler**:

```javascript
// Before batching: 3 DOM updates
model.firstName = 'John';
model.lastName = 'Doe';
model.email = 'john@example.com';

// With batching: 1 DOM update (BatchScheduler deduplicates)
// 70-80% reduction in DOM update cycles
```

**How It Works (V2.0):**

1. Property changes mark computed properties dirty (synchronous)
2. DOM effects queued in BatchScheduler (Set-based deduplication)
3. Microtask flush consolidates all pending DOM updates
4. Single DOM update cycle for all changes

> ⚠️ **V2.0 Change:** Batching now handled by BatchScheduler (replaces v1.0 MessageBus for property reactivity).
> MessageBus still handles user events ($emit, $on) but no longer batches property changes.

#### Infinite Loop Protection

**BatchScheduler** (V2.0 - DOM Effects) and **MessageBus** (User Events) both include built-in protection against infinite loops with two safeguards:

**Early Warning (Flush Depth > 5):**

When flush depth exceeds 5, the framework logs a warning with diagnostic information:

```javascript
// Circular event dependency
model.$on('prop-a-changed', () => model.propB = 1);
model.$on('prop-b-changed', () => model.propA = 1);
model.propA = 1;

// Console output (when depth > 5):
// "[Stitch.js] Flush depth > 5. Queued events: prop-a-changed, prop-b-changed, prop-a-changed, ..."
```

This helps identify circular dependencies early before they become a serious problem.

**Maximum Flush Depth (MAX_FLUSH_DEPTH = 100):**

If flush depth reaches 100, the framework:
1. Clears the event queue
2. Resets flush depth to 0
3. Logs a detailed error message
4. Prevents browser freeze

```javascript
// Console output (when depth = 100):
// BatchScheduler:
// "[Stitch.js v2.1.0 BatchScheduler] Maximum flush depth (100) exceeded.
//  Possible infinite loop detected. Queue cleared."
//
// MessageBus (for user events):
// "[Stitch.js v2.1.0 MessageBus] Maximum flush depth (100) exceeded.
//  Possible infinite loop detected.
//  Event queue has been cleared to prevent browser freeze."
```

**What Triggers This:**

- Circular watchers: A watches B, B watches A
- Recursive computed properties with circular dependencies
- Event handlers that trigger themselves indirectly

**Application Behavior:**

The application remains responsive - the event queue is cleared and execution continues. However, your circular logic will be interrupted, so you should fix the underlying issue rather than relying on this safety mechanism.

### Smart Reconciliation

DOM elements are reused (not destroyed/recreated) during foreach updates:

```javascript
// Before reconciliation: Destroy all rows, create all rows (100% DOM mutations)
// With reconciliation: Only update changed rows (90%+ reduction)

model.items.push({ name: 'New Item' });  // Only 1 row created
model.items[0].name = 'Updated';         // Only 1 row updated
```

**Benefits:**
- Focus preservation in editable tables/lists
- Better performance for large lists
- Smoother animations and transitions

### Best Practices

- ✅ Keep computed properties pure (no side effects)
- ✅ Avoid deep nesting (>5 levels)
- ✅ Use `data-foreach` for lists (not manual DOM manipulation)
- ✅ Batch state changes when possible
- ✅ Use Message Bus middleware for logging/debugging (not inline console.logs)

---

## Complete Example: Todo App

```html
<!DOCTYPE html>
<html>
<head>
    <script src="stitch.js"></script>
    <style>
        /* Style completed todos based on checkbox state */
        .todo-checkbox:checked + .todo-text {
            text-decoration: line-through;
            opacity: 0.6;
        }
        .loading { opacity: 0.5; cursor: not-allowed; }
    </style>
</head>
<body>
    <div id="app">
        <h1>Todo List</h1>

        <!-- Add Todo Form -->
        <div>
            <input data-value="newTodoText"
                   data-event="newTodoEvents"
                   placeholder="What needs to be done?"
                   type="text">
            <button data-click="addTodo" data-enabled="canAddTodo">Add</button>
        </div>

        <!-- Filter Tabs -->
        <div>
            <button data-click="setFilter" data-class="filterAllClass">All</button>
            <button data-click="setFilter" data-class="filterActiveClass">Active</button>
            <button data-click="setFilter" data-class="filterCompletedClass">Completed</button>
        </div>

        <!-- Todo List -->
        <ul data-foreach="filteredTodos">
            <li>
                <input data-value="completed" type="checkbox" class="todo-checkbox">
                <span data-text="text" class="todo-text"></span>
                <button data-click="$parent.deleteTodo">Delete</button>
            </li>
        </ul>

        <!-- Stats -->
        <div>
            <span data-text="activeCount"></span> items left
            <button data-click="clearCompleted" data-visible="hasCompleted">
                Clear completed
            </button>
        </div>
    </div>

    <script>
        const model = Stitch.Observable.create({
            todos: [],
            newTodoText: '',
            filter: 'all', // 'all' | 'active' | 'completed'

            // Event configurations
            newTodoEvents: {
                keypress: 'handleKeyPress'
            },

            // Computed properties
            filteredTodos: Stitch.computed(function() {
                if (this.filter === 'active') {
                    return this.todos.filter(todo => !todo.completed);
                }
                if (this.filter === 'completed') {
                    return this.todos.filter(todo => todo.completed);
                }
                return this.todos;
            }),

            activeCount: Stitch.computed(function() {
                return this.todos.filter(todo => !todo.completed).length;
            }),

            hasCompleted: Stitch.computed(function() {
                return this.todos.some(todo => todo.completed);
            }),

            canAddTodo: Stitch.computed(function() {
                return this.newTodoText.trim().length > 0;
            }),

            filterAllClass: Stitch.computed(function() {
                return { active: this.filter === 'all' };
            }),

            filterActiveClass: Stitch.computed(function() {
                return { active: this.filter === 'active' };
            }),

            filterCompletedClass: Stitch.computed(function() {
                return { active: this.filter === 'completed' };
            }),

            // Action methods
            addTodo() {
                if (this.canAddTodo) {
                    this.todos.push({
                        id: Date.now(),
                        text: this.newTodoText.trim(),
                        completed: false
                    });
                    this.newTodoText = '';
                }
            },

            deleteTodo(event) {
                const todoId = event.target.closest('li').dataset.id;
                const index = this.todos.findIndex(t => t.id == todoId);
                if (index !== -1) {
                    this.todos.splice(index, 1);
                }
            },

            setFilter(event) {
                const buttonText = event.target.textContent.toLowerCase();
                this.filter = buttonText;
            },

            clearCompleted() {
                this.todos = this.todos.filter(todo => !todo.completed);
            },

            handleKeyPress(event) {
                if (event.key === 'Enter') {
                    this.addTodo();
                }
            }
        });

        const binder = new Stitch.DataBinder();
        binder.bind('#app', model);
    </script>
</body>
</html>
```

---

**Last Updated:** 2026-02-13 (v2.1.0 - Modularization + Build Workflow Update)
**Maintained By:** Stitch.js modularization contributors
