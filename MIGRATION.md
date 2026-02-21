# Migration Guide: Stitch.js v1.0 → v2.0

This guide helps you migrate from Stitch.js v1.0 to v2.0.

---

## Overview

**V2.0** fixes the core timing bug where computed properties returned stale values when accessed synchronously after dependency changes. The fix requires architectural changes that introduce some breaking changes to advanced APIs.

**Good News**: Most code works unchanged! Observable.create(), data bindings, and computed properties work as before.

---

## Breaking Changes

### 1. Custom Effects: `scheduler` → `batch` Option

**v1.0:**
```javascript
reactiveSystem.effect(() => {
    element.textContent = model.value;
}, {
    scheduler: () => {
        // Custom scheduling logic
    }
});
```

**v2.0:**
```javascript
// For DOM updates (batched for performance)
reactiveSystem.effect(() => {
    element.textContent = model.value;
}, { batch: true });

// For immediate execution (e.g., logging, non-DOM)
reactiveSystem.effect(() => {
    console.log('Value changed:', model.value);
}, { batch: false });  // Or omit for immediate
```

**Migration:**
- If your effect modifies the DOM → use `{ batch: true }`
- If your effect needs immediate execution → use `{ batch: false }` or omit the option
- Remove custom scheduler logic (batching is now automatic)

---

### 2. $watch API: Now Immediate by Default

**v1.0:**
```javascript
model.$watch('count', (newVal, oldVal) => {
    console.log(`Count: ${oldVal} → ${newVal}`);
});
// Callback always ran async (microtask queue)
```

**v2.0:**
```javascript
// Immediate execution (default)
model.$watch('count', (newVal, oldVal) => {
    console.log(`Count: ${oldVal} → ${newVal}`);
});

// Batched execution (opt-in)
model.$watch('count', (newVal, oldVal) => {
    console.log(`Count: ${oldVal} → ${newVal}`);
}, { batch: true });
```

**Why Changed:**
- v1.0: `$watch` used MessageBus (async)
- v2.0: `$watch` uses ReactiveSystem.effect() (immediate by default)

**Migration:**
- Most code works unchanged
- If you need batching behavior → add `{ batch: true }` as third parameter

---

### 3. Computed Properties: Synchronous Invalidation

**v1.0:**
```javascript
const model = Stitch.Observable.create({
    x: 1,
    doubled: Stitch.computed(function() {
        return this.x * 2;
    })
});

model.x = 5;
console.log(model.doubled); // ❌ 2 (stale - async invalidation)
```

**v2.0:**
```javascript
const model = Stitch.Observable.create({
    x: 1,
    doubled: Stitch.computed(function() {
        return this.x * 2;
    })
});

model.x = 5;
console.log(model.doubled); // ✅ 10 (fresh - sync invalidation)
```

**No Code Changes Required** - This is a fix, not a breaking change!

---

### 4. MessageBus Role Change

**v1.0:**
- MessageBus handled ALL reactivity (property changes, user events)
- `property-changed` event was core mechanism

**v2.0:**
- ReactiveSystem handles property change reactivity
- MessageBus handles user events only (`$emit`, `$on`)

**Migration:**
- If you subscribed to `property-changed` event → use `$watch` instead
- If you used `$emit`/`$on` for custom events → no changes needed

**Example:**

```javascript
// v1.0 (will still work but not recommended)
model.$on('property-changed', payload => {
    if (payload.key === 'count') {
        console.log('Count changed:', payload.newValue);
    }
});

// v2.0 (recommended)
model.$watch('count', (newVal, oldVal) => {
    console.log('Count changed:', newVal);
});
```

---

### 5. Middleware API: Continuation-Style → Transformation-Style

**v1.0:**
```javascript
model.$use((name, data, next) => {
    console.log('Event:', name);
    next(); // Continue middleware chain
});
```

**v2.0:**
```javascript
model.$use((eventData) => {
    console.log('Event:', eventData.event);
    return eventData; // Return to continue chain
});
```

**Why Changed:**
- v1.0: Continuation-style with separate parameters `(name, data, next)`
- v2.0: Transformation-style with single `eventData` object parameter
- Simpler API, easier to transform event data

**Migration:**
- Replace `(name, data, next)` with `(eventData)`
- Access event name via `eventData.event` instead of `name` parameter
- Access event data via `eventData.data` instead of `data` parameter
- Return `eventData` instead of calling `next()`
- To modify event data, mutate and return `eventData`

**Example:**

```javascript
// v1.0
model.$use((name, data, next) => {
    if (name === 'user-login') {
        data.timestamp = Date.now(); // Mutate data
    }
    next(); // Continue
});

// v2.0
model.$use((eventData) => {
    if (eventData.event === 'user-login') {
        eventData.data.timestamp = Date.now(); // Mutate data
    }
    return eventData; // Return to continue
});
```

---

## Non-Breaking Changes

These APIs work exactly the same in v1.0 and v2.0:

### ✅ Observable.create()
```javascript
const model = Stitch.Observable.create({
    name: 'Alice',
    age: 30
});
// Works identically in v1.0 and v2.0
```

### ✅ Computed Properties
```javascript
const model = Stitch.Observable.create({
    firstName: 'John',
    lastName: 'Doe',
    fullName: Stitch.computed(function() {
        return this.firstName + ' ' + this.lastName;
    })
});
// Syntax unchanged - just works correctly now!
```

### ✅ Data Bindings
```html
<div data-text="message"></div>
<input data-value="name">
<button data-click="handleClick">Click</button>
<!-- All bindings work unchanged -->
```

### ✅ Custom Events ($emit, $on)
```javascript
model.$emit('custom-event', { data: 'value' });
model.$on('custom-event', payload => {
    console.log(payload);
});
// Works identically in v1.0 and v2.0
```

---

## Compatibility Matrix

| Feature | v1.0 | v2.0 | Breaking? |
|---------|------|------|-----------|
| Observable.create() | ✅ | ✅ | ❌ No |
| Stitch.computed() | ✅ | ✅ | ❌ No |
| Data bindings (data-text, data-value, etc.) | ✅ | ✅ | ❌ No |
| $emit / $on | ✅ | ✅ | ❌ No |
| $watch() | ✅ Async | ✅ Immediate | ⚠️ Timing change |
| $use() middleware | ✅ (name, data, next) | ✅ (eventData) | ✅ Yes → API change |
| effect({ scheduler }) | ✅ | ❌ Removed | ✅ Yes → use { batch } |
| effect({ batch }) | ❌ | ✅ | ✅ Yes → new API |
| property-changed event | ✅ Core | ⚠️ Deprecated | ⚠️ Use $watch instead |

---

## Migration Checklist

### Step 1: Update Custom Bindings (if any)

If you registered custom bindings with `DataBinder.registerBinding()`:

```javascript
// v1.0
Stitch.DataBinder.registerBinding('tooltip', {
    bind(element, viewModel, path, context) {
        context.reactiveSystem.effect(() => {
            const value = getProperty(viewModel, path);
            element.title = value;
        });
    }
});

// v2.0 (add { batch: true } for DOM updates)
Stitch.DataBinder.registerBinding('tooltip', {
    bind(element, viewModel, path, context) {
        context.reactiveSystem.effect(() => {
            const value = getProperty(viewModel, path);
            element.title = value;
        }, { batch: true });  // ← Add this
    }
});
```

### Step 2: Update Direct effect() Calls (if any)

Search your codebase for `reactiveSystem.effect(` or `.effect(`:

```javascript
// v1.0
effect(() => {
    console.log(model.value);
});

// v2.0 (no change needed for immediate execution)
effect(() => {
    console.log(model.value);
});

// v2.0 (add { batch: true } for DOM updates)
effect(() => {
    element.textContent = model.value;
}, { batch: true });
```

### Step 3: Review $watch Usage (if any)

If timing is critical:

```javascript
// v1.0 (async)
model.$watch('count', callback);

// v2.0 (immediate by default)
model.$watch('count', callback);

// v2.0 (batched if needed)
model.$watch('count', callback, { batch: true });
```

### Step 4: Update Middleware ($use) (if any)

If you use middleware for event transformation:

```javascript
// v1.0
model.$use((name, data, next) => {
    console.log('Event:', name);
    data.modified = true;
    next();
});

// v2.0
model.$use((eventData) => {
    console.log('Event:', eventData.event);
    eventData.data.modified = true;
    return eventData;
});
```

### Step 5: Replace property-changed Subscriptions (if any)

```javascript
// v1.0
model.$on('property-changed', payload => {
    if (payload.key === 'count') {
        console.log('Count changed');
    }
});

// v2.0
model.$watch('count', (newVal, oldVal) => {
    console.log('Count changed');
});
```

### Step 6: Test Thoroughly

- Run your test suite
- Manually test computed properties
- Verify custom bindings work
- Check timing-sensitive code

---

## Known Issues

### Array-Dependent Computed Properties

**Status**: ✅ FIXED in v2.0.1 (known limitation in v2.0.0)

**Issue in v2.0.0**: Computed properties that depend on array contents do not automatically recalculate when items are added/removed via array mutation methods (`push`, `splice`, etc.).

**Example:**
```javascript
const cart = Stitch.Observable.create({
    items: [],
    subtotal: Stitch.computed(function() {
        return this.items.reduce((sum, item) => sum + item.total, 0);
    })
});

cart.items.push({ total: 100 });
console.log(cart.subtotal); // Still 0 ❌ (should be 100) - v2.0.0 only
```

**Fix in v2.0.1**: Array mutations now trigger synchronously. Upgrade to v2.0.1 to resolve this issue.

**Workarounds for v2.0.0 (not needed in v2.0.1):**

**Option 1: Manual Trigger**
```javascript
cart.items.push({ total: 100 });
cart.items = [...cart.items]; // Force trigger ✅
```

**Option 2: Explicit Dependencies**
```javascript
subtotal: Stitch.computed(function() {
    const _ = this.items.length; // Track length explicitly
    return this.items.reduce((sum, item) => sum + item.total, 0);
}, ['items'])
```

See [KNOWN-ISSUES.md](KNOWN-ISSUES.md) for implementation details of the v2.0.1 fix.

---

## Performance

**Good News**: v2.0 maintains the same performance characteristics as v1.0!

- DOM updates still batched efficiently (70-80% reduction)
- Computed properties still cached until invalidated
- No performance regressions

**What Changed:**
- v1.0: Batching via MessageBus (all effects async)
- v2.0: Batching via BatchScheduler (computed sync, DOM async)

---

## Need Help?

- 📖 See [stitch_documentation.md](stitch_documentation.md) for complete API reference
- 🏗️ See [ARCHITECTURE.md](ARCHITECTURE.md) for technical implementation details
- 🐛 Report issues at: [GitHub Issues](https://github.com/your-repo/stitch.js/issues)
- 💡 Check [KNOWN-ISSUES.md](KNOWN-ISSUES.md) for documented limitations

---

*Last Updated: 2025-01-04 (V2.0.1)*
