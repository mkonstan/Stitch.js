# Proofs for the skill's gotchas

Test data, not documentation. Each section proves one row of `skills/stitch/references/gotchas.md`:
a `throws` block proves the error code the row names (the doc-snippet runner checks that the error
message contains it), and a `run` block with checks pins a silent behaviour the row describes. The
`skill` static check requires a section here for every gotcha row that names a code, and that the
section asserts every code the row names. If the library changes one of these behaviours, the
proof fails and the gotcha must be rewritten.

## G1

```html run
<p id="p">Hello {{ name }}</p>
<script>new Stitch.DataBinder().bind('#p', Stitch.Observable.create({ name: 'Ada' }));</script>
```
<!-- check: text('#p') === 'Hello {{ name }}' -->

## G2

```html throws
<span id="p" data-text="{{name}}"></span>
<script>new Stitch.DataBinder().bind('#p', Stitch.Observable.create({ name: 'Ada' }));</script>
```
Throws: `[Stitch E103]`

## G3

```html run
<p id="p" data-if="shown" v-if="shown" x-show="shown" data-show="shown">x</p>
<script>
let report = null;
Stitch.onBindReport(function (r) { report = r; });
new Stitch.DataBinder().bind('#p', Stitch.Observable.create({ shown: false }));
</script>
```
<!-- check: visible('#p') && report.bound.length === 0 && report.ignored.map(e => e.attribute).join(',') === 'data-if,data-show' -->

## G7

```html run
<span id="p" data-bind="text: name"></span>
<script>new Stitch.DataBinder().bind('#p', Stitch.Observable.create({ name: 'Ada' }));</script>
```
<!-- check: text('#p') === '' -->

## G8

```html throws
<button id="p" data-click="count++">+</button>
<script>new Stitch.DataBinder().bind('#p', Stitch.Observable.create({ count: 0 }));</script>
```
Throws: `[Stitch E108]`

## G9

```html throws
<ul id="p" data-foreach="items"><li><button data-click="remove(item)">x</button></li></ul>
<script>new Stitch.DataBinder().bind('#p', Stitch.Observable.create({ items: [{ id: 1 }], remove() {} }));</script>
```
Throws: `[Stitch E108]`

## G10

```html throws
<button id="p" data-attr="attrs">x</button>
<script>new Stitch.DataBinder().bind('#p', Stitch.Observable.create({ attrs: { onclick: 'save()' } }));</script>
```
Throws: `[Stitch E321]`

## G11

```html throws
<p id="p" data-class="{ active: on }">x</p>
<script>new Stitch.DataBinder().bind('#p', Stitch.Observable.create({ on: true }));</script>
```
Throws: `[Stitch E103]`

## G12

```html throws
<p id="p" data-visible="items.length > 0">x</p>
<script>new Stitch.DataBinder().bind('#p', Stitch.Observable.create({ items: [] }));</script>
```
Throws: `[Stitch E102]`

## G13

```html throws
<p id="p" data-text="price.toFixed(2)"></p>
<script>new Stitch.DataBinder().bind('#p', Stitch.Observable.create({ price: 1 }));</script>
```
Throws: `[Stitch E104]`

## G14

```html throws
<p id="p" data-text="name | upper"></p>
<script>new Stitch.DataBinder().bind('#p', Stitch.Observable.create({ name: 'a' }));</script>
```
Throws: `[Stitch E102]`

## G15

```html throws
<input id="p" data-value="city, visible: hasCity">
<script>new Stitch.DataBinder().bind('#p', Stitch.Observable.create({ city: '', hasCity: true }));</script>
```
Throws: `[Stitch E105]`

## G18

```html run
<p id="p" data-text="title"></p>
<script>
let model = Stitch.Observable.create({ title: 'old' });
new Stitch.DataBinder().bind('#p', model);
model = Stitch.Observable.create({ title: 'new' });
</script>
```
<!-- check: text('#p') === 'old' -->

## G19

```js run
const model = Stitch.Observable.create({ price: 2, qty: 3, total: Stitch.computed(() => this.price * this.qty) });
```
<!-- check: Number.isNaN(model.total) -->

## G20

```js throws
Stitch.Observable.create({ saved: false, save: () => { this.saved = true; } });
```
Throws: `[Stitch E707]`

## G21

```js run
const model = Stitch.Observable.create({ a: 1, total: Stitch.computed(function () { return this.a; }) });
try { model.total(); window.result = 'called'; } catch (e) { window.result = e instanceof TypeError; }
```
<!-- check: window.result === true -->

## G22

```js throws
const model = Stitch.Observable.create({ a: 1, total: Stitch.computed(function () { return this.a; }) });
model.total = 5;
```
Throws: `[Stitch E713]`

## G24

```html run
<ul id="p" data-foreach="sorted"><li data-text="name"></li></ul>
<script>
const model = Stitch.Observable.create({
    rows: [{ id: 2, name: 'b' }, { id: 1, name: 'a' }],
    sorted: Stitch.computed(function () { return this.rows.sort((x, y) => x.id - y.id); })
});
new Stitch.DataBinder().bind('#p', model);
model.rows.push({ id: 0, name: 'z' });
</script>
```
<!-- check: texts('#p li').join('') === 'ab' -->

## G25

```html throws
<p id="p" data-text="later"></p>
<script>
const model = Stitch.Observable.create({ x: 1 });
model.later = 'L';
new Stitch.DataBinder().bind('#p', model);
</script>
```
Throws: `[Stitch E203]`

## G26

```html throws
<ul id="p" data-foreach="items"><li data-text="name"></li></ul>
<script>new Stitch.DataBinder().bind('#p', Stitch.Observable.create({ items: [{ name: 'a' }] }));</script>
```
Throws: `[Stitch E501]`

## G27

```html throws
<button id="p" data-click="save">x</button>
<script>
new Stitch.DataBinder().bind('#p', Stitch.Observable.create({ save(event) { event.preventDefault(); } }));
click('#p');
</script>
```
Throws: `preventDefault is not a function`

## G29

```html throws
<p id="p" data-text="nmae"></p>
<script>new Stitch.DataBinder().bind('#p', Stitch.Observable.create({ name: 'Ada' }));</script>
```
Throws: `[Stitch E201]`

## G30

```html throws
<ul id="p" data-foreach="people"><li data-text="email"></li></ul>
<script>
const model = Stitch.Observable.create({ people: [{ id: 1, email: 'a@example.com' }] });
new Stitch.DataBinder().bind('#p', model);
model.people.push({ id: 2 });
</script>
```
Throws: `[Stitch E201]`

## G31

```html throws
<ul id="p" data-foreach="nodes" data-template="node"></ul>
<template id="node"><li><span data-text="name"></span><ul data-foreach="children" data-template="node"></ul></li></template>
<script>new Stitch.DataBinder().bind('#p', Stitch.Observable.create({ nodes: [{ id: 1, name: 'leaf' }] }));</script>
```
Throws: `[Stitch E201]`

## G32

```html throws
<p id="p" data-text="_count"></p>
<script>new Stitch.DataBinder().bind('#p', Stitch.Observable.create({ _count: 1 }));</script>
```
Throws: `[Stitch E203]`

## G33

```js throws
Stitch.Observable.create({ rows: [{ id: 1, toJSON: 'x' }] });
```
Throws: `[Stitch E709]`

## G34

```js throws
Stitch.Observable.create({ count: 0 }).on(function () {});
```
Throws: `[Stitch E802]`

## G35

```js throws
Stitch.Observable.create({ count: 0 }, { debug: true });
```
Throws: `[Stitch E706]`

## G36

```js run
try { Stitch.debug.enable(); window.result = 'enabled'; } catch (e) { window.result = e instanceof TypeError && Object.keys(Stitch.debug).join() === 'stats'; }
```
<!-- check: window.result === true -->

## G37

```js throws
const initial = { name: '' };
Stitch.Observable.create(initial);
Stitch.Observable.create(initial);
```
Throws: `[Stitch E703]`

## G38

```js throws
const model = Stitch.Observable.create({ user: { name: 'Ada' } });
Stitch.Observable.create(model.user);
```
Throws: `[Stitch E704]`

## G39

```js throws
const app = Stitch.Observable.create({ cart: null });
app.cart = Stitch.Observable.create({ items: [] });
```
Throws: `[Stitch E710]`

## G40

```js throws
const countries = ['FR', 'JP'];
Stitch.Observable.create({ countries });
Stitch.Observable.create({ countries });
```
Throws: `[Stitch E711]`

## G41

```js throws
Stitch.Observable.create(Object.freeze({ name: 'Ada' }));
```
Throws: `[Stitch E714]`

## G42

```js run
const model = Stitch.Observable.create({ selected: { id: 1 } });
window.result = delete model.selected; // sloppy-mode script: false, nothing deleted
```
<!-- check: window.result === false && model.selected.id === 1 -->

## G43

```js throws
const model = Stitch.Observable.create({ rows: [{ id: 1 }] });
delete model.rows[0];
```
Throws: `[Stitch E712]`

## G44

```js run
try { structuredClone(Stitch.Observable.create({ rows: [{ id: 1 }] })); window.result = 'cloned'; } catch (e) { window.result = e.name; }
```
<!-- check: window.result === 'DataCloneError' -->

## G45

```js throws
Stitch.Observable.create({ user: { name: 'Ada' } }).user.$emit('saved');
```
Throws: `[Stitch E801]`

## G46

```js run
const model = Stitch.Observable.create({ user: { name: 'Ada' } });
try { model.user.$watch('name', function () {}); window.result = 'watched'; } catch (e) { window.result = e instanceof TypeError; }
```
<!-- check: window.result === true -->

## G47

```js throws
Stitch.Observable.create({ a: 1 }).$on(function () {});
```
Throws: `[Stitch E811]`

## G48

```js throws
Stitch.Observable.create({ a: 1 }).$onChange('saved', function () {});
```
Throws: `[Stitch E803]`

## G49

```js throws
const model = Stitch.Observable.create({ a: 1 });
model.$on('saved', () => {});
model.$off('saved', () => {});
```
Throws: `[Stitch E853]`

## G51

```js throws
Stitch.Observable.create({ _x: 1 }).$watch('_x', function () {});
```
Throws: `[Stitch E205]`

```js throws
Stitch.Observable.create({ x: 1 }).$watch('missing', function () {});
```
Throws: `[Stitch E204]`

## G52

```js run
const model = Stitch.Observable.create({ n: 0 });
model.$on('ping', function () { model.n = 1; });
model.$emit('ping');
window.sync = model.n;
```
<!-- check: window.sync === 0 && model.n === 1 -->

## G54

```js throws
const model = Stitch.Observable.create({
    first: 'Ada',
    name: Stitch.computed({ get() { return this.first; }, set(value) { this.first = value; } })
});
model.name = 'Grace';
```
Throws: `[Stitch E713]`

## G55

```html throws
<p id="p" data-text="selected.nmae"></p>
<script>
const model = Stitch.Observable.create({ selected: null });
new Stitch.DataBinder().bind('#p', model); // binds: the path stops at null
model.selected = { name: 'Ada' };          // now the typo is found
</script>
```
Throws: `[Stitch E201]`

## G56

```html throws
<p id="p" data-text="items.0.title"></p>
<script>new Stitch.DataBinder().bind('#p', Stitch.Observable.create({ items: [] }));</script>
```
Throws: `[Stitch E201]`

## G57

```js run
const model = Stitch.Observable.create({
    first: 'Ada',
    label: Stitch.computed(function (format = 'short') { return format === 'short' ? 'short' : 'got the holder'; })
});
```
<!-- check: model.label === 'got the holder' -->

## G58

```html run
<ul id="a" data-foreach="rows"><li data-text="name"></li></ul>
<ul id="b" data-foreach="rows"><li data-text="name"></li></ul>
<script>
const A = Stitch.Observable.create({ rows: [{ id: 1, name: 'a1' }] }, { isolated: true });
const B = Stitch.Observable.create({ rows: [{ id: 1, name: 'b1' }] }, { isolated: true });
const binder = new Stitch.DataBinder();
binder.bind('#a', A);
binder.bind('#b', B);
A.rows.push({ id: 2, name: 'a2' });
</script>
```
<!-- check: (A.rows[1].name = 'a2-changed', true) -->
<!-- check: texts('#a li').join(',') === 'a1,a2' -->

## G59

```html throws
<label id="p" data-text="label"><input data-value="v"></label>
<script>new Stitch.DataBinder().bind('#p', Stitch.Observable.create({ label: 'L', v: '' }));</script>
```
Throws: `[Stitch E535]`

## G60

```html throws
<ul id="p" data-foreach="rows" data-text="title"><li data-text="$data"></li></ul>
<script>new Stitch.DataBinder().bind('#p', Stitch.Observable.create({ title: 'T', rows: ['a'] }));</script>
```
Throws: `[Stitch E534]`

## G61

```html throws
<input id="p" data-value="total">
<script>new Stitch.DataBinder().bind('#p', Stitch.Observable.create({ a: 1, total: Stitch.computed(function () { return this.a; }) }));</script>
```
Throws: `[Stitch E311]`

## G62

```html throws
<select id="p" data-foreach="sectors" data-value="sector"><option data-value="$data" data-text="$data"></option></select>
<script>new Stitch.DataBinder().bind('#p', Stitch.Observable.create({ sector: '', sectors: ['Energy'] }));</script>
```
Throws: `[Stitch E313]`

## G63

```html run
<span id="p" data-value="name"></span>
<script>new Stitch.DataBinder().bind('#p', Stitch.Observable.create({ name: 'Ada' }));</script>
```
<!-- check: text('#p') === '' -->

## G64

```html run
<select id="p" data-foreach="people" data-value="selectedId"><option data-value="id" data-text="name"></option></select>
<script>
const model = Stitch.Observable.create({ selectedId: 1, people: [{ id: 1, name: 'Ann' }, { id: 2, name: 'Bob' }] });
new Stitch.DataBinder().bind('#p', model);
</script>
```
<!-- check: type('#p', '2') && model.selectedId === '2' && model.selectedId !== 2 -->

## G65

```html run
<select id="p" data-foreach="options" data-value="choice"><option data-text="$data"></option></select>
<script>
const model = Stitch.Observable.create({ choice: 'y', options: ['x', 'y'] });
new Stitch.DataBinder().bind('#p', model);
model.options = ['x'];
</script>
```
<!-- check: document.getElementById('p').value === 'x' && model.choice === 'y' -->

## G66

```html throws
<select id="p" data-foreach="options" data-value="choice"><option value="">Pick</option><option data-text="$data"></option></select>
<script>new Stitch.DataBinder().bind('#p', Stitch.Observable.create({ choice: '', options: ['x'] }));</script>
```
Throws: `[Stitch E511]`

## G67

```html run
<p id="p" class="card" data-class="state">x</p>
<script>new Stitch.DataBinder().bind('#p', Stitch.Observable.create({ state: 'active' }));</script>
```
<!-- check: document.getElementById('p').className === 'active' -->

## G68

```html run
<button id="p" data-attr="attrs">x</button>
<script>new Stitch.DataBinder().bind('#p', Stitch.Observable.create({ attrs: { 'aria-expanded': true } }));</script>
```
<!-- check: attr('#p', 'aria-expanded') === '' -->

## G69

```html throws
<p id="p" data-attr="attrs">x</p>
<script>new Stitch.DataBinder().bind('#p', Stitch.Observable.create({ attrs: { style: 'color: red' } }));</script>
```
Throws: `[Stitch E325]`

## G70

```html throws
<a id="p" data-attr="link">x</a>
<script>new Stitch.DataBinder().bind('#p', Stitch.Observable.create({ link: { href: 'javascript:alert(1)' } }));</script>
```
Throws: `[Stitch E323]`

## G71

```html throws
<iframe id="p" data-attr="frame"></iframe>
<script>new Stitch.DataBinder().bind('#p', Stitch.Observable.create({ frame: { src: 'data:text/html,hi' } }));</script>
```
Throws: `[Stitch E324]`

## G72

```html throws
<iframe id="p" sandbox="" data-attr="frame"></iframe>
<script>new Stitch.DataBinder().bind('#p', Stitch.Observable.create({ frame: { sandbox: null } }));</script>
```
Throws: `[Stitch E327]`

## G73

```html throws
<a id="p" rel="noopener" data-attr="link">x</a>
<script>new Stitch.DataBinder().bind('#p', Stitch.Observable.create({ link: { rel: 'nofollow' } }));</script>
```
Throws: `[Stitch E329]`

## G74

```html throws
<a id="p" data-attr="link">x</a>
<script>new Stitch.DataBinder().bind('#p', Stitch.Observable.create({ link: { rel: 'opener' } }));</script>
```
Throws: `[Stitch E328]`

## G75

```html throws
<iframe id="p" data-attr="frame"></iframe>
<script>new Stitch.DataBinder().bind('#p', Stitch.Observable.create({ frame: { srcdoc: '<p>hi</p>' } }));</script>
```
Throws: `[Stitch E322]`

## G76

```html throws
<div id="p"><style data-text="css"></style></div>
<script>new Stitch.DataBinder().bind('#p', Stitch.Observable.create({ css: 'p {}' }));</script>
```
Throws: `[Stitch E326]`

## G79

```html run
<p id="p" hidden data-visible="open">x</p>
<script>new Stitch.DataBinder().bind('#p', Stitch.Observable.create({ open: true }));</script>
```
<!-- check: visible('#p') === false -->

## G80

```html run
<input id="p" type="number" data-value="qty">
<script>
const model = Stitch.Observable.create({ qty: 1 });
new Stitch.DataBinder().bind('#p', model);
</script>
```
<!-- check: type('#p', '') && model.qty === null -->

## G82

```html run
<p id="p"><span id="o" data-text="obj"></span>|<span id="a" data-text="arr"></span></p>
<script>new Stitch.DataBinder().bind('#p', Stitch.Observable.create({ obj: { a: 1 }, arr: [1, 2] }));</script>
```
<!-- check: text('#o') === '[object Object]' && text('#a') === '1,2' -->

## G84

```html throws
<dl id="p" data-foreach="terms"><dt data-text="term"></dt><dd data-text="meaning"></dd></dl>
<script>new Stitch.DataBinder().bind('#p', Stitch.Observable.create({ terms: [{ id: 1, term: 't', meaning: 'm' }] }));</script>
```
Throws: `[Stitch E511]`

## G85

```html throws
<ul id="p" data-foreach="rows">Loading...</ul>
<script>new Stitch.DataBinder().bind('#p', Stitch.Observable.create({ rows: [] }));</script>
```
Throws: `[Stitch E513]`

## G86

```html run
<table id="p" data-foreach="rows"><tr><td data-text="name"></td></tr></table>
<script>new Stitch.DataBinder().bind('#p', Stitch.Observable.create({ rows: [{ id: 1, name: 'a' }, { id: 2, name: 'b' }] }));</script>
```
<!-- check: count('#p > tbody') === 2 -->

## G87

```html throws
<ul id="p" data-foreach="byId"><li data-text="name"></li></ul>
<script>new Stitch.DataBinder().bind('#p', Stitch.Observable.create({ byId: { a: { id: 1, name: 'a' } } }));</script>
```
Throws: `[Stitch E521]`

## G88

```html throws
<ul id="p" data-foreach="tags"><li data-text="$data"></li></ul>
<script>new Stitch.DataBinder().bind('#p', Stitch.Observable.create({ tags: ['a', 'a'] }));</script>
```
Throws: `[Stitch E502]`

## G89

```html throws
<ul id="p" data-foreach="rows"><li data-text="name"></li></ul>
<script>new Stitch.DataBinder().bind('#p', Stitch.Observable.create({ rows: [{ id: 1, name: 'a' }, null] }));</script>
```
Throws: `[Stitch E503]`

## G90

```html throws
<ul id="p" data-foreach="tags" data-key="id"><li data-text="$data"></li></ul>
<script>new Stitch.DataBinder().bind('#p', Stitch.Observable.create({ tags: ['a'] }));</script>
```
Throws: `[Stitch E504]`

## G91

```html throws
<ul id="p" data-foreach="rows" data-key=""><li data-text="name"></li></ul>
<script>new Stitch.DataBinder().bind('#p', Stitch.Observable.create({ rows: [{ id: 1, name: 'a' }] }));</script>
```
Throws: `[Stitch E505]`

## G92

```html throws
<ul id="p" data-key="sku"><li>x</li></ul>
<script>new Stitch.DataBinder().bind('#p', Stitch.Observable.create({}));</script>
```
Throws: `[Stitch E531]`

## G93

```html throws
<ul id="p" data-foreach="rows" data-template="row"><li>inline</li></ul>
<template id="row"><li data-text="name"></li></template>
<script>new Stitch.DataBinder().bind('#p', Stitch.Observable.create({ rows: [{ id: 1, name: 'a' }] }));</script>
```
Throws: `[Stitch E516]`

## G94

```html throws
<ul id="p" data-foreach="rows" data-template="missing"></ul>
<script>new Stitch.DataBinder().bind('#p', Stitch.Observable.create({ rows: [] }));</script>
```
Throws: `[Stitch E514]`

```html throws
<ul id="p" data-foreach="rows" data-template="row"></ul>
<div id="row"><li data-text="name"></li></div>
<script>new Stitch.DataBinder().bind('#p', Stitch.Observable.create({ rows: [] }));</script>
```
Throws: `[Stitch E515]`

## G95

```html throws
<ul id="p" data-foreach="rows"></ul>
<script>new Stitch.DataBinder().bind('#p', Stitch.Observable.create({ rows: ['a'] }));</script>
```
Throws: `[Stitch E512]`

## G96

```html throws
<ul id="p" data-foreach="rows" data-default-text="Choose"><li data-text="$data"></li></ul>
<script>new Stitch.DataBinder().bind('#p', Stitch.Observable.create({ rows: [] }));</script>
```
Throws: `[Stitch E532]`

```html throws
<select id="p" data-foreach="rows" data-default-value="0"><option data-text="$data"></option></select>
<script>new Stitch.DataBinder().bind('#p', Stitch.Observable.create({ rows: [] }));</script>
```
Throws: `[Stitch E533]`

## G97

```html throws
<ul id="p" data-foreach="items"><li><button data-click="remove">x</button></li></ul>
<script>
const model = Stitch.Observable.create({ items: [], remove() {} });
new Stitch.DataBinder().bind('#p', model); // an empty list: nothing to check yet
model.items.push({ id: 1 });               // the first row reports it
</script>
```
Throws: `[Stitch E401]`

## G98

```html throws
<ul id="p" data-foreach="items"><li><button data-click="$root.save">x</button></li></ul>
<script>new Stitch.DataBinder().bind('#p', Stitch.Observable.create({ items: [] }));</script>
```
Throws: `[Stitch E406]`

## G99

```html throws
<button id="p" data-click="$parent.save">x</button>
<script>new Stitch.DataBinder().bind('#p', Stitch.Observable.create({ save() {} }));</script>
```
Throws: `[Stitch E403]`

## G100

```html throws
<div id="p" data-foreach="groups"><div><ul data-foreach="items"><li><button data-click="$parent.$parent.save">x</button></li></ul></div></div>
<script>new Stitch.DataBinder().bind('#p', Stitch.Observable.create({ groups: [{ id: 1, items: [{ id: 2 }] }], save() {} }));</script>
```
Throws: `[Stitch E110]`

## G101

```html throws
<button id="p" data-click="$root">x</button>
<script>new Stitch.DataBinder().bind('#p', Stitch.Observable.create({ save() {} }));</script>
```
Throws: `[Stitch E109]`

## G102

```html throws
<ul id="p" data-foreach="rows"><li><input data-event="rowEvents"></li></ul>
<script>new Stitch.DataBinder().bind('#p', Stitch.Observable.create({ rows: [{ id: 1 }], rowEvents: { input: '$root.touch' }, touch() {} }));</script>
```
Throws: `[Stitch E201]`

## G103

```html throws
<input id="p" data-event="onInput">
<script>new Stitch.DataBinder().bind('#p', Stitch.Observable.create({ onInput() {} }));</script>
```
Throws: `[Stitch E304]`

## G104

```js throws
Stitch.Observable.create({ events: { input: () => {} } });
```
Throws: `[Stitch E707]`

## G105

```html throws
<input id="p" data-event="events">
<script>new Stitch.DataBinder().bind('#p', Stitch.Observable.create({ events: { input: 'tuoch' }, touch() {} }));</script>
```
Throws: `[Stitch E401]`

## G106

```html throws
<ul id="p" data-foreach="rows"><li data-text="name"></li></ul>
<script>
const model = Stitch.Observable.create({ rows: [{ id: 1, name: 'a' }] });
new Stitch.DataBinder().bind('#p', model);
model.rows.push({ id: 1, name: 'again' });
</script>
```
Throws: `[Stitch E502]`

## G107

```html run
<ul id="p" data-foreach="rows"><li data-text="name"></li></ul>
<script>
const model = Stitch.Observable.create({ rows: [{ id: 1, name: 'a' }] });
new Stitch.DataBinder().bind('#p', model);
window.before = document.querySelector('#p li');
model.rows = [{ id: 1, name: 'a' }];
</script>
```
<!-- check: document.querySelector('#p li') !== window.before && text('#p li') === 'a' -->

## G109

```html throws
<ol id="p" data-foreach="rows"><li data-text="$index + 1"></li></ol>
<script>new Stitch.DataBinder().bind('#p', Stitch.Observable.create({ rows: ['a'] }));</script>
```
Throws: `[Stitch E102]`

## G110

```html run
<form id="f"><input data-value="q"><button id="b" data-click="go">Go</button></form>
<script>
window.addEventListener('submit', function (e) { window.submitted = true; e.preventDefault(); });
new Stitch.DataBinder().bind('#f', Stitch.Observable.create({ q: '', go() {} }));
</script>
```
<!-- check: click('#b') && window.submitted === true -->

## G114

```html throws
<input id="p" data-value="address.city">
<script>
new Stitch.DataBinder().bind('#p', Stitch.Observable.create({ address: null }));
const input = document.getElementById('p');
input.value = 'Paris';
input.dispatchEvent(new Event('input', { bubbles: true }));
</script>
```
Throws: `[Stitch E314]`

## G115

```html run
<button id="p" data-click="go">x</button>
<script>
window.seen = [];
Stitch.onError(function () { window.seen.push('onError'); });
const model = Stitch.Observable.create({
    // A thenable stands in for the promise an async handler returns: Stitch never calls then().
    go() { return { then: function () { window.seen.push('then'); } }; }
});
new Stitch.DataBinder().bind('#p', model);
click('#p');
</script>
```
<!-- check: tick().then(() => window.seen.length === 0) -->

## G117

```html throws
<script>new Stitch.DataBinder().bind('#later', Stitch.Observable.create({ t: 1 }));</script>
<p id="later" data-text="t"></p>
```
Throws: `[Stitch E602]`

## G118

```html run
<p class="card" data-text="title"></p><p class="card" data-text="title"></p>
<script>new Stitch.DataBinder().bind('.card', Stitch.Observable.create({ title: 'T' }));</script>
```
<!-- check: texts('.card').join(',') === 'T,' -->

## G119

```html throws
<p id="p" data-text="title"></p>
<script>
const binder = new Stitch.DataBinder();
binder.bind('#p', Stitch.Observable.create({ title: 'a' }));
binder.bind('#p', Stitch.Observable.create({ title: 'b' }));
</script>
```
Throws: `[Stitch E601]`

## G120

```html throws
<div id="outer"><span data-text="title"></span><div id="inner"><span data-text="name"></span></div></div>
<script>
new Stitch.DataBinder().bind('#inner', Stitch.Observable.create({ name: 'N' }));
new Stitch.DataBinder().bind('#outer', Stitch.Observable.create({ title: 'T' }));
</script>
```
Throws: `[Stitch E601]`

```html throws
<div id="outer"><span data-text="title"></span><div id="inner"><span data-text="name"></span></div></div>
<script>
new Stitch.DataBinder().bind('#outer', Stitch.Observable.create({ title: 'T' }));
</script>
```
Throws: `[Stitch E201]`

## G121

```html throws
<p id="p" data-text="t"></p>
<script>
const binder = new Stitch.DataBinder();
binder.bind('#p', Stitch.Observable.create({ t: 1 }));
binder.unbind('#p');
binder.unbind('#p');
</script>
```
Throws: `[Stitch E607]`

## G122

```html throws
<p id="p" data-text="t"></p>
<script>
const binder = new Stitch.DataBinder();
binder.dispose();
binder.bind('#p', Stitch.Observable.create({ t: 1 }));
</script>
```
Throws: `[Stitch E605]`

## G123

```html throws
<p id="p" data-text="t"></p>
<script>new Stitch.DataBinder().bind('#p', { t: 1 });</script>
```
Throws: `[Stitch E604]`

## G124

```html run
<p id="p" data-text="t"></p>
<script>
const model = Stitch.Observable.create({ t: 'old' });
new Stitch.DataBinder().bind('#p', model);
model.t = 'new';
window.sameTick = document.getElementById('p').textContent;
</script>
```
<!-- check: window.sameTick === 'old' && text('#p') === 'new' -->

## G126

```html throws
<p id="p" data-text="t"></p>
<script>
new Stitch.DataBinder().bind('#p', Stitch.Observable.create({ t: 1 }));
Stitch.DataBinder.registerBinding('late', { bind() {} });
</script>
```
Throws: `[Stitch E621]`

## G127

```html throws
<button id="p" data-tooltip="Save changes">Save</button>
<script>
Stitch.DataBinder.registerBinding('tooltip', { bind(element, model, value) { element.title = value; } });
new Stitch.DataBinder().bind('#p', Stitch.Observable.create({}));
</script>
```
Throws: `[Stitch E102]`

```html throws
<button id="p" data-tooltip="Save">Save</button>
<script>
Stitch.DataBinder.registerBinding('tooltip', { bind(element, model, value) { element.title = value; } });
new Stitch.DataBinder().bind('#p', Stitch.Observable.create({}));
</script>
```
Throws: `[Stitch E201]`

## G128

```js throws
Stitch.DataBinder.registerBinding('myTooltip', { bind() {} });
```
Throws: `[Stitch E623]`

## G129

```js throws
Stitch.DataBinder.registerBinding('badge', { bind() {} });
Stitch.DataBinder.registerBinding('badge', { bind() {} });
```
Throws: `[Stitch E627]`

## G132

```js throws
Stitch.onError(function () {});
Stitch.onError(function () {});
```
Throws: `[Stitch E902]`
