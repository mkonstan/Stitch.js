# Stitch.js

**Drop-in reactive data binding for any project. ~14KB (gzipped), zero dependencies, no build step.**

```html
<script src="stitch.js"></script>
<!-- That's it. You're ready. -->
```

## What Problem Does This Solve?

You have an existing app (React, Vue, jQuery, vanilla JS, or server-rendered) and you need to add reactive behavior to **one section** without rewriting everything.

**Before Stitch:**
```javascript
// Manual DOM updates everywhere
document.getElementById('count').textContent = count;
document.getElementById('message').textContent = message;
nameInput.addEventListener('input', (e) => {
    model.name = e.target.value;
    updateAllTheThings();
});
// Repeat for every form field... 😱
```

**With Stitch:**
```javascript
const model = Stitch.Observable.create({
    count: 0,
    message: 'Hello',
    name: ''
});
new Stitch.DataBinder().bind('#app', model);
// All <input data-value="name"> elements automatically sync
// All <div data-text="message"> elements automatically update
```

## Why I Built Stitch.js

I've been building LOB web applications for years. My primary tool was always KendoUI. I fell in love with its MVVM system—how clean (for the most part) it kept the code. Business logic in JavaScript, presentation in HTML, with reactive data binding connecting them effortlessly.

But I kept hitting walls:

**What made logical sense in MVVM wasn't supported out of the box.** I needed workarounds and fixes, and the reason was simple: MVVM in KendoUI was an afterthought, not a first-class citizen. What made things worse was the massive bundle overhead for basic reactivity and the jQuery dependency that added weight I didn't need. On top of that, its opinionated architecture forced decisions that didn't always fit my projects.

When I tried Alpine.js as a lightweight alternative, I appreciated the philosophy—zero dependencies, drop it in and go, robust. But as apps grew, I found myself fighting with:

- Scattered logic across dozens of inline attributes
- Readability challenges at scale
- Missing the clean separation of concerns I loved from KendoUI MVVM

What if I could build a tool that extracts the best parts of both?  
This is how Stitch.js was born—a layer that stitches HTML to data.

---

### The Stitch.js Philosophy

That's why I built Stitch.js:

✅ **KendoUI's elegant MVVM pattern** – Clean separation, declarative bindings, reactive by design
✅ **Alpine's lightweight mindset** – 10KB gzipped, zero dependencies, no build tools
✅ **Modern architecture** – Proxy-based reactivity, smart DOM reconciliation, type-safe forms
✅ **One focused job** – Reactive data binding, done exceptionally well

**No opinions about your stack.** Drop it into legacy apps or modern SPAs. Use it with jQuery, React, Vue, or vanilla JS. It's a tool, not a framework—it stays out of your way and lets you build the way you want.

---

### What Makes It Different

**Clean markup** – Logic lives in JavaScript where it belongs:
```html
<input data-value="username">
<div data-text="greeting"></div>
```

**True two-way binding** – With type conversion (int, float, date, datetime) built in. No more manual parsing.

**Smart reconciliation** – DOM updates preserve focus and state. Critical for editable tables and lists—no more cursor jumping.

**Computed properties** – Automatic dependency tracking with lazy evaluation. Define once, updates everywhere.

**Message bus** – Elegant event coordination without tight coupling. Observability built in (`$on`, `$emit`, `$watch`).

**Extensible** – `registerBinding()` API lets you add custom behaviors without touching core code.

---

### The Result

A tool I actually use every day. One that feels right—not because it does everything, but because it does **one thing exceptionally well**: reactive data binding that gets out of your way and lets you focus on building features, not fighting the framework.

## When Should You Use Stitch?

✅ **Use Stitch when you need:**
- Reactive forms in a legacy jQuery app
- One complex form in a React app (without fighting React)
- Interactive sections in server-rendered pages (Rails, Django, PHP)
- Two-way bindings without Alpine's attribute soup
- MVVM pattern without KendoUI's 180KB bundle
- Drop-in reactivity with **zero configuration**

❌ **Don't use Stitch when you need:**
- Full SPA framework (use Vue, React, Svelte)
- Server-side rendering (use Next.js, Nuxt)
- Complex component hierarchies
- Global state management at scale (use Zustand, Redux)

## Key Features

- **10 Custom Bindings**: `data-text`, `data-value`, `data-visible`, `data-enabled`, `data-click`, `data-event`, `data-class`, `data-attr`, `data-foreach`, `data-loading`
- **Two-Way Binding** with type conversion (`int`, `float`, `date`, `datetime`, `boolean`)
- **Computed Properties** with automatic dependency tracking
- **Smart Reconciliation** preserves focus in editable tables/lists
- **Message Bus** for event coordination (`$on`, `$emit`, `$watch`)
- **Extensible API** via `registerBinding()` for custom bindings

**Size:** ~53KB minified, ~14KB gzipped | **Dependencies:** Zero | **Build Tools:** None required

## Installation

Drop the script into your site and reference it in HTML:

```html
<script src="stitch.js"></script>
```

No webpack config. No babel. No compilation. Just include and go.

## Packaging Profiles (Contributors)

The runtime source of truth is modular (`packages/*` + `stitch.entry.js`), and `stitch.js` is generated.

Build generated artifacts:
```bash
npm run build:assembly
```

Build package profiles:
```bash
npm run package:runtime
npm run package:contributor
```

Profile outputs:
- Runtime package: `_artifacts/profiles/runtime`
- Contributor package: `_artifacts/profiles/contributor`
- Each profile includes `PACKAGE_PROFILE_MANIFEST.json` with file list and size.

Report retention cleanup:
```bash
npm run clean:reports:dry
npm run clean:reports
```

## Quick Start

### Example 1: Reactive Form (5 minutes)

```html
<!DOCTYPE html>
<html>
<head>
    <script src="stitch.js"></script>
</head>
<body>
    <div id="app">
        <h1 data-text="greeting"></h1>

        <input data-value="name" type="text" placeholder="Your name">
        <input data-value="age" data-type="int" type="number" placeholder="Age">
        <input data-value="subscribe" type="checkbox"> Subscribe to newsletter

        <button data-click="submit" data-enabled="isValid">Submit</button>

        <div data-visible="showResult">
            <p>Name: <span data-text="name"></span></p>
            <p>Age: <span data-text="age"></span></p>
            <p>Newsletter: <span data-text="subscribeText"></span></p>
        </div>
    </div>

    <script>
        const model = Stitch.Observable.create({
            name: '',
            age: null,
            subscribe: false,
            showResult: false,

            greeting: Stitch.computed(function() {
                return this.name ? `Hello, ${this.name}!` : 'Hello!';
            }),

            isValid: Stitch.computed(function() {
                return this.name.length > 0 && this.age > 0;
            }),

            subscribeText: Stitch.computed(function() {
                return this.subscribe ? 'Yes' : 'No';
            }),

            submit() {
                this.showResult = true;
                console.log('Submitted:', {
                    name: this.name,
                    age: this.age,
                    subscribe: this.subscribe
                });
            }
        });

        new Stitch.DataBinder().bind('#app', model);
    </script>
</body>
</html>
```

**What just happened?**
- Two-way binding works automatically (no `onChange` handlers)
- Computed properties update when dependencies change
- Type conversion handles `age` as integer, not string
- Button enables/disables based on validation
- Clean separation: logic in JS, presentation in HTML

### Example 2: Editable Table with Smart Reconciliation

```html
<table>
    <thead>
        <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Actions</th>
        </tr>
    </thead>
    <tbody data-foreach="users">
        <tr>
            <td><input data-value="name" type="text"></td>
            <td><input data-value="email" type="email"></td>
            <td><button data-click="$parent.removeUser">Delete</button></td>
        </tr>
    </tbody>
</table>

<script>
    const model = Stitch.Observable.create({
        users: [
            { id: 1, name: 'John Doe', email: 'john@example.com' },
            { id: 2, name: 'Jane Smith', email: 'jane@example.com' }
        ],

        removeUser(user, event) {
            // user is the $data from foreach context
            this.users = this.users.filter(u => u.id !== user.id);
        }
    });

    new Stitch.DataBinder().bind('table', model);
</script>
```

**Smart reconciliation preserves:**
- Focus state (cursor position in inputs)
- Existing DOM elements (no flicker)
- User-typed values during sorting/filtering

**How foreach binding works:**

Within a `data-foreach` loop, Stitch automatically creates a binding context where the current item's properties are directly accessible. This is why you can use `data-value="name"` instead of `data-value="$data.name"` - the context makes item properties available at the top level.

Special context variables:
- `$data` - The current item (e.g., the user object)
- `$index` - The current index (0-based)
- `$parent` - Reference to the parent view model (use this to call methods on the main model, like `$parent.removeUser`)

## Core API

### Observable.create()

Create a reactive object where property changes automatically trigger UI updates.

```javascript
const model = Stitch.Observable.create({
    count: 0,
    message: 'Hello',

    // Methods have access to reactive properties via 'this'
    increment() {
        this.count++;
    },

    // Computed properties auto-update when dependencies change
    doubled: Stitch.computed(function() {
        return this.count * 2;
    })
});

model.count = 5;  // UI updates automatically
console.log(model.doubled);  // 10
```

### Computed Properties

Lazy-evaluated getters with automatic dependency tracking.

```javascript
const model = Stitch.Observable.create({
    firstName: 'John',
    lastName: 'Doe',

    // Automatically recalculates when firstName or lastName changes
    fullName: Stitch.computed(function() {
        return `${this.firstName} ${this.lastName}`;
    }),

    // Can depend on other computed properties
    greeting: Stitch.computed(function() {
        return `Hello, ${this.fullName}!`;
    })
});

console.log(model.greeting);  // "Hello, John Doe!"
model.firstName = 'Jane';
console.log(model.greeting);  // "Hello, Jane Doe!" (auto-updated)
```

**Important:** Use regular functions (not arrow functions) so `this` works correctly.

### Message Bus API

Coordinate events across your application without tight coupling.

```javascript
// Watch specific property
model.$watch('count', (newVal, oldVal) => {
    console.log(`Count: ${oldVal} → ${newVal}`);
});

// Listen to all property changes
model.$on('property-changed', (event) => {
    console.log(`${event.key} changed`);
});

// Emit custom events
model.$emit('user-login', { userId: 123 });

// Listen to custom events
model.$on('user-login', (payload) => {
    console.log('User logged in:', payload.userId);
});
```

## Data Bindings Reference

### Two-Way Bindings

#### `data-value` - Form Input Synchronization

Supports all input types with automatic type conversion:

```html
<!-- Text input -->
<input data-value="username" type="text">

<!-- Number with integer conversion -->
<input data-value="age" data-type="int" type="number">

<!-- Date picker -->
<input data-value="birthday" data-type="date" type="date">

<!-- Checkbox (boolean) -->
<input data-value="agree" type="checkbox">

<!-- Radio buttons -->
<input data-value="gender" type="radio" value="male"> Male
<input data-value="gender" type="radio" value="female"> Female

<!-- Select dropdown -->
<select data-value="country">
    <option value="us">United States</option>
    <option value="uk">United Kingdom</option>
</select>

<!-- Textarea -->
<textarea data-value="notes"></textarea>
```

**Type Conversion Options** (via `data-type` attribute):
- `int` - Parse as integer
- `float` - Parse as float
- `boolean` (or `bool`) - Parse as true/false
- `string` - String (default)
- `date` - Date object (YYYY-MM-DD)
- `datetime` - Date object with time
- `auto` - Automatic inference

### One-Way Bindings

#### `data-text` - Text Content

```html
<div data-text="message"></div>
<span data-text="user.name"></span>
```

#### `data-visible` - Conditional Visibility

```html
<div data-visible="isLoggedIn">Welcome back!</div>
<div data-visible="hasErrors">Error message</div>
```

#### `data-enabled` - Enable/Disable Elements

```html
<button data-enabled="canSubmit">Submit</button>
<input data-enabled="isEditable" type="text">
```

#### `data-class` - Dynamic CSS Classes

```html
<!-- String mode: replace entire className -->
<div data-class="statusClass"></div>

<!-- Object mode: toggle individual classes -->
<div data-class="classObject"></div>
```

```javascript
const model = Stitch.Observable.create({
    // String mode
    statusClass: 'active success',

    // Object mode
    classObject: {
        active: true,
        disabled: false,
        highlighted: true
    }
    // Result: <div class="active highlighted"></div>
});
```

#### `data-attr` - Dynamic Attributes

```html
<a data-attr="linkAttrs">Link</a>
<img data-attr="imageAttrs">
```

```javascript
const model = Stitch.Observable.create({
    linkAttrs: {
        href: 'https://example.com',
        target: '_blank',
        rel: 'noopener'
    },

    imageAttrs: {
        src: 'photo.jpg',
        alt: 'Photo description',
        width: 300,
        height: 200
    }
});
```

### Event Bindings

#### `data-click` - Click Handler

```html
<button data-click="handleClick">Click Me</button>
<a data-click="navigate">Go</a>
```

```javascript
const model = Stitch.Observable.create({
    handleClick(event) {
        console.log('Clicked!', event.target);
    }
});
```

#### `data-event` - Multiple Event Handlers

```html
<input data-event="inputEvents" type="text">
```

```javascript
const model = Stitch.Observable.create({
    inputEvents: {
        input: 'onInput',
        change: 'onChange',
        focus: 'onFocus',
        blur: 'onBlur'
    },

    onInput(e) { console.log('Input:', e.target.value); },
    onChange(e) { console.log('Changed'); },
    onFocus(e) { console.log('Focused'); },
    onBlur(e) { console.log('Blurred'); }
});
```

### List Binding

#### `data-foreach` - Array Rendering

```html
<!-- Simple list -->
<ul data-foreach="items">
    <li data-text="$data"></li>
</ul>

<!-- Object properties -->
<table>
    <tbody data-foreach="users">
        <tr>
            <td data-text="name"></td>
            <td data-text="email"></td>
            <td><button data-click="$parent.removeUser">Delete</button></td>
        </tr>
    </tbody>
</table>
```

**Context Variables:**
- `$data` - Current item
- `$index` - Current index (0-based)
- `$parent` - Parent view model

```javascript
const model = Stitch.Observable.create({
    items: ['Apple', 'Banana', 'Cherry'],

    users: [
        { id: 1, name: 'John', email: 'john@example.com' },
        { id: 2, name: 'Jane', email: 'jane@example.com' }
    ],

    removeUser(user, event) {
        // user is the $data context
        this.users = this.users.filter(u => u.id !== user.id);
    }
});
```

**External Templates** (for cleaner HTML):

```html
<template id="user-row">
    <tr>
        <td data-text="name"></td>
        <td data-text="email"></td>
    </tr>
</template>

<table>
    <tbody data-foreach="users" data-template="user-row"></tbody>
</table>
```

### Composite Bindings

#### `data-loading` - Loading State

Automatically manages three attributes during async operations:

```html
<button data-loading="isSaving">Save</button>
```

When `isSaving = true`:
- Sets `disabled` attribute
- Adds `loading` CSS class
- Sets `aria-busy="true"`

```javascript
const model = Stitch.Observable.create({
    isSaving: false,

    async save() {
        this.isSaving = true;
        try {
            await fetch('/api/save', { method: 'POST' });
        } finally {
            this.isSaving = false;
        }
    }
});
```

Add CSS for loading spinner:
```css
.loading {
    position: relative;
    color: transparent;
}
.loading::after {
    content: '';
    position: absolute;
    width: 16px;
    height: 16px;
    border: 2px solid #fff;
    border-top-color: transparent;
    border-radius: 50%;
    animation: spin 0.6s linear infinite;
}
@keyframes spin {
    to { transform: rotate(360deg); }
}
```

## Advanced Usage

### Custom Bindings

Extend Stitch with your own `data-*` attributes:

```javascript
// Register custom tooltip binding
Stitch.DataBinder.registerBinding('tooltip', {
    bind(element, viewModel, path, context) {
        context.reactiveSystem.effect(() => {
            const value = getProperty(viewModel, path);
            element.setAttribute('title', value || '');
        });
    }
});
```

Usage:
```html
<button data-tooltip="helpText">Help</button>
```

### Property Hooks

React to specific property changes with custom logic:

```javascript
const binder = new Stitch.DataBinder({
    properties: {
        'selectedCountry': {
            onChange(element, newValue, oldValue) {
                // Load states/provinces for new country
                loadRegionsForCountry(newValue);
            }
        }
    }
});
```

### Standalone Message Bus

Use MessageBus independently for event coordination:

```javascript
const bus = new Stitch.MessageBus();

// Component A
bus.subscribe('user-updated', (user) => {
    console.log('User updated:', user);
});

// Component B
bus.publish('user-updated', { id: 123, name: 'John' });
```

## Integration Patterns

### With React

Use Stitch for that one problematic form:

```html
<!-- In your HTML (public/index.html) -->
<script src="stitch.js"></script>
```

```javascript
// In your React component - Stitch is available globally
function WeirdForm() {
    const formRef = useRef();

    useEffect(() => {
        const model = Stitch.Observable.create({
            // Complex form state
        });

        const binder = new Stitch.DataBinder();
        binder.bind(formRef.current, model);

        return () => binder.unbind(formRef.current);
    }, []);

    return <div ref={formRef}>{/* Stitch-bound markup */}</div>;
}
```

### With Vue

Stitch and Vue can coexist in different sections:

```html
<!-- Include both libraries -->
<script src="https://unpkg.com/vue@3"></script>
<script src="stitch.js"></script>

<!-- Vue app in #vue-app -->
<div id="vue-app">{{ vueState }}</div>

<!-- Stitch form in #stitch-form -->
<div id="stitch-form">
    <input data-value="username">
</div>

<script>
    // Vue handles main app
    const vueApp = Vue.createApp({ /* ... */ }).mount('#vue-app');

    // Stitch handles complex form
    const formModel = Stitch.Observable.create({ /* ... */ });
    new Stitch.DataBinder().bind('#stitch-form', formModel);
</script>
```

### With jQuery

Drop Stitch into legacy jQuery apps:

```html
<!-- Include both libraries -->
<script src="https://code.jquery.com/jquery-3.6.0.min.js"></script>
<script src="stitch.js"></script>
```

```javascript
$(document).ready(function() {
    // Existing jQuery code
    $('#legacy-button').on('click', function() { /* ... */ });

    // Add Stitch for new reactive sections
    const model = Stitch.Observable.create({ /* ... */ });
    new Stitch.DataBinder().bind('#new-section', model);

    // jQuery and Stitch coexist peacefully
});
```

### Server-Rendered Pages (Rails, Django, PHP)

```html
<!-- Server renders initial HTML -->
<div id="filters">
    <input data-value="search" type="text" value="<?= $initialSearch ?>">
    <select data-value="category">
        <?php foreach($categories as $cat): ?>
            <option value="<?= $cat->id ?>"><?= $cat->name ?></option>
        <?php endforeach; ?>
    </select>
</div>

<script>
    // Add reactivity to server-rendered markup
    const filters = Stitch.Observable.create({
        search: '<?= $initialSearch ?>',
        category: '<?= $initialCategory ?>',

        // Automatically filters as user types
        filteredResults: Stitch.computed(function() {
            return applyFilters(this.search, this.category);
        })
    });

    new Stitch.DataBinder().bind('#filters', filters);
</script>
```

## Real-World Example

**Economic Impact Visualization App** - Migrated from Alpine.js to Stitch

- **Before:** 15KB Alpine + scattered logic in HTML attributes
- **After:** 10KB Stitch + clean MVVM separation
- **Lines Changed:** ~200 (mostly removing Alpine directives)
- **Architecture Change:** Zero - same state machine, same business logic
- **Result:** Cleaner code, smaller bundle, better maintainability

Key features:
- 20+ reactive state properties
- 15+ computed properties
- Complex async state transitions
- External map component integration
- Message bus event coordination

[View full source code →](./examples/economic-impact/)

## Debugging

Enable debug logging to track reactivity:

```javascript
// Enable all debug categories
Stitch.debug.enable();

// Enable specific categories
Stitch.debug.enableCategory('reactivity');
Stitch.debug.enableCategory('computed');
Stitch.debug.enableCategory('bindings');

// Disable all
Stitch.debug.disable();
```

Available categories:
- `reactivity` - Track/trigger calls
- `computed` - Computed property evaluation
- `effects` - Effect creation/execution
- `bindings` - Binding application
- `messageBus` - Message bus events

## Performance

- **Bundle Size:** 31KB minified, 10KB gzipped
- **Zero Dependencies:** No jQuery, no Lodash, nothing
- **Batched Updates:** 70-80% reduction in DOM update cycles
- **Smart Reconciliation:** 90%+ reduction in DOM mutations for lists
- **Lazy Computed:** Only evaluates when accessed
- **Memory Efficient:** WeakMap-based tracking (GC-friendly)

## Browser Support

Works in all modern browsers supporting:
- ES6 Proxy
- WeakMap
- Set
- Promise

**Supported:** Chrome 49+, Firefox 18+, Safari 10+, Edge 12+

## Comparison

| Feature | Stitch | Alpine | Vue 3 | Knockout | KendoUI |
|---------|--------|--------|-------|----------|---------|
| Size (gzipped) | 10KB | 15KB | 40KB | 24KB | 180KB+ |
| Build Required | ❌ | ❌ | ⚠️ | ❌ | ❌ |
| Dependencies | Zero | Zero | Zero | Zero | jQuery |
| MVVM Separation | ✅ | ❌ | ✅ | ✅ | ✅ |
| Two-Way Binding | ✅ | ✅ | ✅ | ✅ | ✅ |
| Type Conversion | ✅ Native | ❌ | ❌ | ❌ | ❌ |
| Smart Reconciliation | ✅ | ❌ | ✅ Full | ❌ | ❌ |
| Component System | ❌ | ❌ | ✅ | ❌ | ✅ |
| Plays Well With Others | ✅ | ⚠️ | ❌ | ⚠️ | ❌ |

**Why Stitch over Alpine?**
- Cleaner: Logic in JS, not scattered across attributes
- MVVM: Better separation of concerns at scale
- Type System: Native type conversion for forms

**Why Stitch over Vue?**
- Simpler: No build step, smaller mental model
- Drop-in: Use in one section, not whole app
- Size: 4x smaller

**Why Stitch over KendoUI?**
- Modern: Proxy-based reactivity, not observables
- Lightweight: 18x smaller, zero dependencies
- Open: MIT licensed, no vendor lock-in

## FAQ

**Q: Is this production-ready?**
A: Yes. Used in production apps with complex forms and data tables.

**Q: Can I use this with [framework]?**
A: Yes. Stitch is a tool, not a framework. It coexists with React, Vue, Angular, jQuery, or vanilla JS.

**Q: Does this replace [framework]?**
A: No. Stitch solves specific problems (reactive bindings). Use full frameworks for full SPAs.

**Q: What about SSR/SEO?**
A: Stitch is client-side only. Server renders HTML, Stitch adds interactivity.

**Q: How do I manage global state?**
A: Use your own solution (Zustand, Redux) or multiple Observables with MessageBus coordination.

**Q: Can I build components?**
A: Not built-in. Use custom bindings or your existing component system.

**Q: TypeScript support?**
A: Not yet, but `.d.ts` definitions are planned.

## License

MIT License - use anywhere, for anything.

## Documentation

- [User Documentation](./stitch_documentation.md) - full usage guide
- [Architecture Guide](./ARCHITECTURE.md) - module/resource map and build pipeline
- [Migration Guide](./MIGRATION.md) - migration notes and compatibility guidance
- [Modularization Log](./MODULARIZATION_PHASE2.md) - extraction/cutover history
- [Examples](./example-basic-demo.html) - start here, then explore `example-*.html`
- [Browser Tests](./run-tests.html) - interactive test runner for `test-*.html` suites

## Links

- [GitHub](https://github.com/your-username/stitch-js)
- [Issues](https://github.com/your-username/stitch-js/issues)

---

**Made with ❤️ for developers who want reactivity without the ceremony.**
