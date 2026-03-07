# Stitch.js vs jQuery: A Comprehensive Comparison

## Overview

| Aspect | Stitch.js (v2.1.0) | jQuery (v3.7) |
|--------|-------------------|---------------|
| **Philosophy** | Reactive MVVM data-binding | General-purpose DOM utility library |
| **Size (minified)** | ~53 KB | ~87 KB (slim: ~72 KB) |
| **Size (gzipped)** | ~14 KB | ~30 KB (slim: ~24 KB) |
| **Dependencies** | Zero | Zero |
| **IE Support** | No (requires ES6 Proxy) | Yes (IE 9+) |
| **First Release** | 2025 | 2006 |

---

## 1. DOM Manipulation

### jQuery: Imperative, Full-Featured

jQuery provides a comprehensive imperative API for direct DOM manipulation:

```javascript
// jQuery - imperative DOM manipulation
$('#title').text('Hello World');
$('#title').html('<strong>Hello</strong>');
$('#title').addClass('active').removeClass('hidden');
$('#title').attr('data-id', '42');
$('#title').css({ color: 'red', fontSize: '16px' });
$('#title').show();
$('#title').hide();
$('.item').each(function() { $(this).text('Updated'); });
$('<div class="new">').appendTo('#container');
$('#old').remove();
$('#title').wrap('<section>');
$('#list').append('<li>New Item</li>');
```

jQuery excels at direct, surgical DOM changes. You tell it **what** to do and **when**.

### Stitch.js: Declarative, Binding-Driven

Stitch.js has **no imperative DOM manipulation API**. All DOM updates flow automatically from data changes through declarative bindings:

```html
<!-- Stitch.js - declarative bindings -->
<h1 data-text="title"></h1>
<h1 data-class="titleClasses"></h1>
<h1 data-attr="titleAttrs"></h1>
<h1 data-visible="isTitleVisible"></h1>
<ul data-foreach="items">
    <li data-text="$data.name"></li>
</ul>
```

```javascript
const vm = Stitch.Observable.create({
    title: 'Hello World',
    titleClasses: { active: true, hidden: false },
    titleAttrs: { 'data-id': '42' },
    isTitleVisible: true,
    items: [{ name: 'Item 1' }, { name: 'Item 2' }]
});

Stitch.DataBinder.bind('#app', vm);

// DOM updates automatically when data changes:
vm.title = 'Updated!';              // <h1> text updates
vm.isTitleVisible = false;           // <h1> hides
vm.items.push({ name: 'Item 3' });   // new <li> appears
```

### Verdict

| Capability | jQuery | Stitch.js |
|-----------|--------|-----------|
| Read DOM values | `.text()`, `.html()`, `.val()`, `.attr()` | Not supported (data lives in the model) |
| Set text content | `.text(val)` | `data-text` binding |
| Set HTML content | `.html(val)` | Not supported |
| Toggle visibility | `.show()` / `.hide()` / `.toggle()` | `data-visible` binding |
| CSS classes | `.addClass()` / `.removeClass()` / `.toggleClass()` | `data-class` binding |
| Attributes | `.attr()` / `.removeAttr()` / `.prop()` | `data-attr` binding |
| Inline styles | `.css()` | Not supported (use `data-class` + CSS) |
| Create elements | `$('<div>')` | Not supported (use `data-foreach`) |
| Remove elements | `.remove()` / `.detach()` | Not supported directly |
| Move/wrap elements | `.append()`, `.wrap()`, `.before()` | Not supported |
| Traverse DOM | `.find()`, `.parent()`, `.children()` | Not supported |

**jQuery wins** for ad-hoc, imperative DOM manipulation and DOM traversal.
**Stitch.js wins** for keeping DOM in sync with data automatically — no manual updates needed.

---

## 2. Event Handling

### jQuery

```javascript
$('#btn').on('click', function(e) { /* ... */ });
$('#btn').off('click', handler);
$('#btn').one('click', handler);                     // fire once
$(document).on('click', '.dynamic-btn', handler);    // delegation
$('#form').on('submit change input', handler);       // multiple events
$('#btn').trigger('click');                           // programmatic
```

jQuery supports event delegation, namespacing (`click.myPlugin`), custom events, and works with dynamically created elements.

### Stitch.js

```html
<button data-click="handleClick">Click Me</button>
<input data-event="inputEvents">
```

```javascript
const vm = Stitch.Observable.create({
    handleClick(e) { /* ... */ },
    inputEvents: {
        input: 'onInput',
        change: 'onChange',
        focus: 'onFocus',
        blur: 'onBlur'
    },
    onInput(e) { /* ... */ },
    onChange(e) { /* ... */ }
});
```

Stitch.js also provides a **MessageBus** for custom pub/sub events:

```javascript
vm.$on('data-loaded', handler);
vm.$emit('data-loaded', { items: [...] });
vm.$once('init', handler);
vm.$off('data-loaded', handler);
vm.$watch('title', (newVal, oldVal) => { /* ... */ });
```

### Verdict

| Capability | jQuery | Stitch.js |
|-----------|--------|-----------|
| Click handlers | `.on('click', fn)` | `data-click` binding |
| Multiple event types | `.on('input change', fn)` | `data-event` object binding |
| Event delegation | `.on('click', selector, fn)` | Not supported |
| Event namespacing | `.on('click.ns', fn)` | Not supported |
| Programmatic trigger | `.trigger('click')` | Not supported for DOM events |
| One-time listeners | `.one('click', fn)` | `$once()` (MessageBus only) |
| Custom pub/sub events | Via `.trigger()` / `.on()` | `$on()` / `$emit()` / `$off()` |
| Property watching | Not built-in | `$watch('path', fn)` |
| Middleware | Not built-in | `$use(middleware)` |

**jQuery wins** for DOM event handling flexibility (delegation, namespacing, dynamic elements).
**Stitch.js wins** for reactive property watching and structured pub/sub communication.

---

## 3. AJAX / HTTP Requests

### jQuery

```javascript
$.ajax({ url: '/api/data', method: 'GET', dataType: 'json' })
    .done(data => { /* ... */ })
    .fail(err => { /* ... */ });

$.get('/api/items', data => { /* ... */ });
$.post('/api/items', { name: 'New' }, data => { /* ... */ });
$.getJSON('/api/data', data => { /* ... */ });

// Global AJAX events
$(document).ajaxStart(() => $('#spinner').show());
$(document).ajaxStop(() => $('#spinner').hide());
```

jQuery provides a full AJAX suite with shorthand methods, global event hooks, and automatic serialization.

### Stitch.js

**Stitch.js has no HTTP capabilities.** Use the native `fetch` API or any HTTP library:

```javascript
const vm = Stitch.Observable.create({
    isLoading: false,
    items: [],
    async loadItems() {
        this.isLoading = true;
        const res = await fetch('/api/items');
        this.items = await res.json();
        this.isLoading = false;
    }
});
```

```html
<div data-loading="isLoading">
    <ul data-foreach="items">
        <li data-text="$data.name"></li>
    </ul>
</div>
```

### Verdict

**jQuery wins** — it has built-in AJAX; Stitch.js has none. However, with modern `fetch()` being universally available, jQuery's AJAX advantage is less significant than it once was. Stitch.js's `data-loading` binding does provide elegant loading state management that jQuery lacks.

---

## 4. Animation

### jQuery

```javascript
$('#box').fadeIn(400);
$('#box').fadeOut(400);
$('#box').slideUp(300);
$('#box').slideDown(300);
$('#box').animate({ opacity: 0.5, left: '200px' }, 1000, 'swing');
$('#box').stop();                    // stop current animation
$('#box').delay(500).fadeIn(400);    // chained with delay
```

jQuery provides a complete animation engine with easing, queuing, and chaining.

### Stitch.js

**Stitch.js has no animation support.** Use CSS transitions or an animation library:

```html
<div data-visible="isOpen" class="fade-transition">...</div>
```

```css
.fade-transition { transition: opacity 0.3s ease; }
```

### Verdict

**jQuery wins** decisively for animation. Stitch.js defers entirely to CSS transitions and external libraries.

---

## 5. Form Handling & Two-Way Binding

### jQuery

```javascript
// Reading values
const name = $('#name').val();
const checked = $('#agree').prop('checked');

// Setting values
$('#name').val('New Name');
$('#agree').prop('checked', true);

// Listening for changes
$('#name').on('input', function() {
    const val = $(this).val();
    // Manually update display
    $('#preview').text(val);
});
```

jQuery requires **manual synchronization** between form inputs and display elements.

### Stitch.js

```html
<input data-value="name" data-type="string">
<input type="checkbox" data-value="agreed" data-type="boolean">
<input data-value="age" data-type="int">
<input data-value="price" data-type="float">
<input type="date" data-value="birthday" data-type="date">

<!-- Automatically stays in sync -->
<span data-text="name"></span>
<span data-text="age"></span>
```

```javascript
const vm = Stitch.Observable.create({
    name: '',
    agreed: false,
    age: 0,
    price: 0.0,
    birthday: null
});
```

Stitch.js provides **automatic two-way binding** with built-in type conversion for 7 types (`int`, `float`, `boolean`, `string`, `date`, `datetime`, `auto`). Changes to inputs automatically update the model, and model changes automatically update the inputs.

### Verdict

**Stitch.js wins** decisively for form handling. Two-way binding with automatic type conversion eliminates the boilerplate of manually reading, converting, and synchronizing form values — which is jQuery's most tedious pattern.

---

## 6. List/Collection Rendering

### jQuery

```javascript
// Render a list
const items = ['Apple', 'Banana', 'Cherry'];
const $list = $('#fruit-list').empty();
items.forEach(item => {
    $list.append(`<li>${item}</li>`);
});

// Update one item
$('#fruit-list li').eq(1).text('Blueberry');

// Add an item
$('#fruit-list').append('<li>Date</li>');

// Remove an item
$('#fruit-list li').eq(0).remove();
```

Every list change requires manual DOM construction and cleanup.

### Stitch.js

```html
<ul data-foreach="fruits">
    <li data-text="$data"></li>
</ul>
```

```javascript
const vm = Stitch.Observable.create({
    fruits: ['Apple', 'Banana', 'Cherry']
});

// All DOM updates happen automatically:
vm.fruits.push('Date');           // adds <li>Date</li>
vm.fruits.splice(0, 1);          // removes first <li>
vm.fruits[1] = 'Blueberry';      // updates second <li>
```

Stitch.js uses **smart DOM reconciliation** that:
- Preserves focus state (no cursor jumping in editable lists)
- Minimizes DOM mutations (90%+ reduction)
- Provides context variables (`$data`, `$index`, `$parent`)
- Supports external `<template>` elements for complex items

### Verdict

**Stitch.js wins** decisively for list rendering. Smart reconciliation, automatic updates, and focus preservation solve problems that require significant custom code with jQuery.

---

## 7. Reactivity & State Management

### jQuery

jQuery has **no reactivity system**. State is stored in variables or DOM attributes, and all updates are manual:

```javascript
let count = 0;

$('#increment').on('click', function() {
    count++;
    // Must manually update every place count is displayed
    $('#count-display').text(count);
    $('#count-label').text(`Count: ${count}`);
    $('#submit-btn').prop('disabled', count > 10);
});
```

### Stitch.js

Stitch.js provides a **Proxy-based reactivity system** with computed properties:

```javascript
const vm = Stitch.Observable.create({
    count: 0,
    // Computed properties with automatic dependency tracking
    countLabel: Stitch.computed(() => `Count: ${vm.count}`),
    isOverLimit: Stitch.computed(() => vm.count > 10),

    increment() { this.count++; }
});
```

```html
<span data-text="count"></span>
<span data-text="countLabel"></span>
<button data-click="increment" data-enabled="isOverLimit">Submit</button>
```

Changing `count` automatically:
1. Updates `countLabel` (computed dependency)
2. Recalculates `isOverLimit`
3. Updates all bound DOM elements
4. Batches updates for performance

### Verdict

**Stitch.js wins** — reactivity is its core purpose. jQuery has no equivalent. Building reactive UIs with jQuery means writing manual update logic that grows linearly with complexity.

---

## 8. Extensibility

### jQuery

```javascript
// Custom plugin
$.fn.highlight = function(color) {
    return this.css('background-color', color || 'yellow');
};
$('.important').highlight('red');

// Thousands of plugins available in the ecosystem
```

jQuery's plugin ecosystem is massive and mature, covering virtually every UI need.

### Stitch.js

```javascript
// Custom binding
Stitch.DataBinder.registerBinding('tooltip', {
    bind(element, viewModel, path, context) {
        const eff = context.reactiveSystem.effect(() => {
            const value = getProperty(viewModel, path);
            element.setAttribute('title', value || '');
        }, { batch: true });
        context.binder._trackCleanup(element, () => {
            context.reactiveSystem.cleanup(eff);
        });
    }
});
// Usage: <button data-tooltip="helpText">Help</button>

// Middleware
vm.$use((payload) => {
    console.log('Event:', payload.event);
    return payload;
});

// Lifecycle hooks
new Stitch.DataBinder({
    onBind(el, vm, bindings) { /* ... */ },
    onChange(change, vm, el) { /* ... */ }
});
```

### Verdict

**jQuery wins** for ecosystem size and plugin availability. **Stitch.js** provides a clean extension model for custom bindings, but its ecosystem is new and small.

---

## 9. Debugging

### jQuery

No built-in debug mode. Use browser DevTools to inspect jQuery objects.

### Stitch.js

```javascript
Stitch.debug.enable();                        // enable all logging
Stitch.debug.enableCategory('reactivity');     // selective categories
Stitch.debug.enableCategory('computed');
Stitch.debug.enableCategory('bindings');
Stitch.debug.enableCategory('effects');
Stitch.debug.enableCategory('messageBus');
```

**Stitch.js wins** with built-in, category-based debug logging.

---

## 10. Use Case Comparison

| Use Case | Better Choice | Why |
|----------|--------------|-----|
| Reactive forms | **Stitch.js** | Two-way binding + type conversion eliminates boilerplate |
| Data-driven UIs | **Stitch.js** | Automatic DOM sync from data changes |
| Editable data tables | **Stitch.js** | Focus preservation + smart reconciliation |
| One-off DOM tweaks | **jQuery** | Quick imperative changes without setup |
| Legacy browser support (IE) | **jQuery** | Stitch.js requires ES6 Proxy |
| DOM traversal & querying | **jQuery** | Powerful selector engine |
| AJAX-heavy apps | **jQuery** | Built-in HTTP support |
| Animations | **jQuery** | Complete animation engine |
| Adding reactivity to existing apps | **Stitch.js** | Drop-in reactive sections without rewrite |
| Plugin-heavy UI (datepickers, modals) | **jQuery** | Massive plugin ecosystem |
| Complex computed state | **Stitch.js** | Computed properties with dependency tracking |
| Cross-component communication | **Stitch.js** | Built-in MessageBus with middleware |

---

## Summary

**jQuery** is a general-purpose DOM utility library that does many things well: DOM manipulation, traversal, events, AJAX, and animation. It's imperative — you tell it exactly what to change and when.

**Stitch.js** is a focused reactive data-binding library that does one thing exceptionally: keeping the DOM in sync with your data model. It's declarative — you describe the relationship between data and DOM, and updates happen automatically.

### Choose jQuery when you need:
- Broad DOM manipulation (create, move, remove, traverse)
- Legacy browser support
- Animation without CSS
- A massive plugin ecosystem
- Quick, imperative DOM scripting

### Choose Stitch.js when you need:
- Reactive data binding without a full framework
- Two-way form synchronization with type conversion
- Computed properties with automatic dependency tracking
- Smart list rendering with focus preservation
- To add reactive sections to an existing app (any framework)

### Use both together:
They are not mutually exclusive. Use jQuery for DOM querying and AJAX, Stitch.js for reactive data binding:

```javascript
// jQuery for AJAX, Stitch.js for reactivity
const vm = Stitch.Observable.create({
    items: [],
    isLoading: false
});

Stitch.DataBinder.bind('#app', vm);

// Use jQuery for the HTTP call
vm.isLoading = true;
$.getJSON('/api/items', function(data) {
    vm.items = data;         // Stitch automatically renders the list
    vm.isLoading = false;    // Stitch automatically hides the spinner
});
```
