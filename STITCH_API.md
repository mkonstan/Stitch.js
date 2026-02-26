# Stitch.js v2.1.0 - API Reference

**Type:** Micro MVVM reactive data-binding framework  
**Size:** ~52KB minified (`stitch.min.js` in this repo is 52,830 bytes)  
**Dependencies:** None  
**Runtime requirements:** ES6 `Proxy`, `WeakMap`, `Set`, `Promise`  
**Module:** UMD (`window.Stitch` in browser, `module.exports` in CommonJS)

---

## Exports

```javascript
window.Stitch = {
    Observable,  // Reactive object factory
    DataBinder,  // DOM binding engine
    MessageBus,  // Pub/sub class export
    computed,    // Alias of Observable.computed
    version,     // "2.1.0"
    debug        // Debug helpers
};
```

---

## Observable

### Observable.create(data, options?)

Creates a reactive object and adds event helpers (`$watch`, `$on`, `$emit`, etc.).

**Options:**
- `debug` (boolean) — Enable debug logging for this instance.
- `isolated` (boolean) — If `true`, creates an isolated ReactiveSystem instead of using the shared default. Use this when you need observables that cannot cross-track dependencies.

By default, all observables share a single `ReactiveSystem` and `BatchScheduler`, enabling cross-observable dependency tracking and coalesced batch scheduling. Each observable still gets its own `MessageBus` for `$on`/`$emit` events.

Important behavior:
- Function properties remain normal methods.
- Computed properties must be wrapped with `Stitch.computed(...)`.

```javascript
const model = Stitch.Observable.create({
    firstName: 'John',
    lastName: 'Doe',

    // Computed property (must use Stitch.computed)
    fullName: Stitch.computed(function () {
        return this.firstName + ' ' + this.lastName;
    }),

    // Regular method
    greet(prefix) {
        return prefix + ' ' + this.fullName;
    }
}, { debug: true });

model.firstName = 'Jane';
console.log(model.fullName);      // "Jane Doe" (property access, not function call)
console.log(model.greet('Hello')); // "Hello Jane Doe"
```

### Observable.createArray(items, options?)

Creates a reactive array with mutation tracking.

**Options:** Same as `Observable.create()` (`isolated`).

```javascript
const todos = Stitch.Observable.createArray(['Learn Stitch.js', 'Build app']);
todos.push('Deploy');        // Reactive
todos.splice(1, 1);          // Reactive
todos[0] = 'Master Stitch';  // Reactive
```

### Observable.reactive(obj, options?)

Makes an existing object reactive. Returns the existing proxy if the object is already reactive.

**Options:** Same as `Observable.create()` (`isolated`).

```javascript
const plain = { count: 0 };
const reactive = Stitch.Observable.reactive(plain);
```

### Observable.reset()

Resets the shared ReactiveSystem, clearing all shared state. Primarily for testing. Existing observables retain their old factory; only new observables created after `reset()` use the new system.

```javascript
Stitch.Observable.reset();
```

### Observable.computed(config)

Creates a computed marker for object properties.  
It is consumed by `Observable.create()` / reactive conversion.

Supported forms:
- `Stitch.computed(function () { ... })`
- `Stitch.computed({ get() { ... }, deps: ['a', 'b'] })`

```javascript
const model = Stitch.Observable.create({
    count: 2,
    multiplier: 5,

    total: Stitch.computed(function () {
        return this.count * this.multiplier;
    }),

    // Explicit dependency form
    doubled: Stitch.computed({
        get() { return this.count * 2; },
        deps: ['count']
    })
});

console.log(model.total);   // 10
console.log(model.doubled); // 4
```

Computed properties are getters:
- Access with `model.total`
- Do not call `model.total()`
- Do not use `.value`

### Observable.isReactive(obj)

Returns `true` if the object is reactive.

### Observable.toRaw(reactiveObj)

Converts a reactive object to a plain object (uses `toJSON()` when available).

---

## Reactive Object Instance API

Reactive objects expose:

### `observable.on(handler)`

Subscribe to property change notifications.

```javascript
model.on((change) => {
    console.log(`${change.field}: ${change.oldValue} -> ${change.newValue}`);
});
// change = { field, oldValue, newValue, target, ... }
```

### `observable.off(handler?)`

Unsubscribe one handler, or all handlers when omitted.

### `observable.set(path, value)`

Set nested property by dot-path.

```javascript
model.set('user.profile.name', 'John Doe');
```

### `observable.get(path)`

Get nested property by dot-path.

```javascript
const name = model.get('user.profile.name');
```

### `observable.toJSON()`

Recursively unwrap to plain object.

### `observable.$set(key, value)`

Define/update a reactive property dynamically.

```javascript
model.$set('newProp', 123);
```

When the object was created with `Observable.create()`, it also exposes:

### `observable.$watch(path, callback, options?)`

Watch a specific path. Default is immediate (non-batched); use `{ batch: true }` to batch.

```javascript
model.$watch('count', (newVal, oldVal, meta) => {
    console.log('count changed', oldVal, '->', newVal, meta);
}, { batch: true });
```

### `observable.$emit(event, payload)`
### `observable.$on(event, handler)`
### `observable.$off(event, handler)`
### `observable.$once(event, handler)`
### `observable.$use(middlewareFn)`

Message bus helpers attached to the observable instance.

---

## DataBinder

### `new Stitch.DataBinder(hooks?)`

Creates a binder instance. Optional hooks:
- `onBind(element, context, bindings)`
- `onChange(change, viewModel, rootElement)`
- `properties` (property-specific hooks)

### `binder.bind(selectorOrElement, viewModel)`

Binds a DOM subtree to a reactive model (must come from `Observable.create()`).
Bindings are discovered from `data-*` attributes whose names match registered handlers.

```javascript
const binder = new Stitch.DataBinder();
binder.bind('#app', model);
```

### Built-in Binding Attributes

```html
<span data-text="fullName"></span>
<input data-value="userName">
<div data-visible="isLoggedIn">Welcome!</div>
<button data-click="handleSubmit">Submit</button>
<button data-enabled="canSubmit">Submit</button>

<div data-class="classMap"></div>
<img data-attr="imageAttrs">
<input data-event="inputEvents">

<ul data-foreach="items">
    <li data-text="$data"></li>
</ul>

<button data-loading="isSaving">Save</button>
```

Notes:
- Stitch does not parse Knockout-style `data-bind="text: ..."` strings.
- `data-class`, `data-attr`, and `data-event` should point to object properties on the model (path strings), not inline object literals.
- `data-enabled` sets `element.disabled = !value`.

### Custom Binding Registration

Use `DataBinder.registerBinding(name, { bind(...) { ... } })`.

```javascript
const readPath = (obj, path) =>
    path.split('.').reduce((acc, key) => (acc == null ? acc : acc[key]), obj);

Stitch.DataBinder.registerBinding('tooltip', {
    bind(element, viewModel, path, context) {
        const eff = context.reactiveSystem.effect(() => {
            const value = readPath(viewModel, path);
            element.setAttribute('title', value || '');
        }, { batch: true });

        context.binder._trackCleanup(element, () => context.reactiveSystem.cleanup(eff));
    }
});
```

---

## MessageBus

`Stitch.MessageBus` is exported as a standalone pub/sub class.

Each observable created with `Observable.create()` gets its own per-model `MessageBus`. Events emitted on one model are only visible to subscribers on that same model:
- `$emit`, `$on`, `$off`, `$once`, `$use`

```javascript
model.$emit('stateSelected', { fips: '06' });
model.$on('stateSelected', (data) => {
    console.log('Selected:', data.fips);
});
```

Internally, the shared `ReactiveSystem` uses a separate `MessageBus` for framework events (`nested-change`, `array-mutation`). These internal events are not accessible via `$on()` — use `$watch()` for property observation instead.

---

## Debug Utilities

```javascript
Stitch.debug.enable();                      // Enable debug logging
Stitch.debug.disable();                     // Disable all debug logging
Stitch.debug.enableCategory('reactivity');  // Enable one category
Stitch.debug.disableCategory('computed');   // Disable one category
Stitch.debug.categories();                  // Print category table
// Categories: reactivity, computed, effects, bindings, messageBus
```

---

## v2 Notes

1. Computed invalidation is synchronous; computed evaluation remains lazy.
2. `$watch` is immediate by default; batching is opt-in with `{ batch: true }`.
3. Computed properties are marker-based (`Stitch.computed(...)`), not auto-detected from method signatures.
4. Binding API is `data-*` handler attributes (for example `data-text`, `data-value`), not `data-bind` expression parsing.

---

## Integration with D3Map

```javascript
const app = Stitch.Observable.create({
    selectedState: null,
    selectedStateName: '',
    economicData: { output: 0, jobs: 0, wages: 0, taxes: 0 },

    formattedOutput: Stitch.computed(function () {
        return '$' + (this.economicData.output || 0).toLocaleString();
    }),
    formattedJobs: Stitch.computed(function () {
        return (this.economicData.jobs || 0).toLocaleString();
    }),
    formattedWages: Stitch.computed(function () {
        return '$' + (this.economicData.wages || 0).toLocaleString();
    }),
    formattedTaxes: Stitch.computed(function () {
        return '$' + (this.economicData.taxes || 0).toLocaleString();
    }),
    hasSelection: Stitch.computed(function () {
        return this.selectedState !== null;
    })
});

const binder = new Stitch.DataBinder();
binder.bind('#data-panel', app);

map.bind('featureSelected', (e) => {
    app.selectedState = e.data.fid;
    app.selectedStateName = e.data.name;
    // Fetch and update economic data...
});

map.bind('reset', () => {
    app.selectedState = null;
    app.selectedStateName = '';
    app.economicData = { output: 0, jobs: 0, wages: 0, taxes: 0 };
});
```
