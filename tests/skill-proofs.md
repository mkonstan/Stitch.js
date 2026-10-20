# Proofs for the skill's gotchas

Test data, not documentation. Each section executes one row of
`skills/stitch/references/gotchas.md`:

- **Wrong:** the row's "About to write" code, failing the way the row says: a `throws` block
  asserting the row's error code, or a `run` block whose checks show the misbehaviour.
- **Right:** the row's "Write instead" code, working: `run` blocks with checks.

The `skill` static check requires both halves for every row, requires every code span of the
"About to write" cell to occur in the Wrong half and every code span of the "Write instead" cell
to occur in the Right half, and requires the Wrong half to assert each code the row names. The
doc-snippet runner (`test-skill-proofs.html`) executes both halves. A row whose advice cannot run
in the test page is marked "Guidance only:" and listed in `SKILL_GUIDANCE_ONLY`
(`_tools/doc-checks.js`).

## G1

Wrong:

```html run
<div id="p"><p>Hello {{ name }}</p></div>
<script>new Stitch.DataBinder().bind('#p', Stitch.Observable.create({ name: 'Ada' }));</script>
```
<!-- check: text('#p p') === 'Hello {{ name }}' -->

Right:

```html run
<div id="p"><p>Hello <span data-text="name"></span></p></div>
<script>new Stitch.DataBinder().bind('#p', Stitch.Observable.create({ name: 'Ada' }));</script>
```
<!-- check: text('#p p') === 'Hello Ada' -->

## G2

Wrong:

```html throws
<span id="p" data-text="{{name}}"></span>
<script>new Stitch.DataBinder().bind('#p', Stitch.Observable.create({ name: 'Ada' }));</script>
```
Throws: `[Stitch E103]`

Right:

```html run
<span id="p" data-text="name"></span>
<script>new Stitch.DataBinder().bind('#p', Stitch.Observable.create({ name: 'Ada' }));</script>
```
<!-- check: text('#p') === 'Ada' -->

## G3

Wrong:

```html run
<div id="p"><p id="a" v-if="open">a</p><p id="b" x-if="open">b</p><p id="c" data-if="open">c</p></div>
<script>new Stitch.DataBinder().bind('#p', Stitch.Observable.create({ open: false }));</script>
```
<!-- check: visible('#a') && visible('#b') && visible('#c') -->

Right:

```html run
<div id="p"><p id="a" data-visible="open">a</p></div>
<script>const model = Stitch.Observable.create({ open: false }); new Stitch.DataBinder().bind('#p', model);</script>
```
<!-- check: visible('#a') === false -->
<!-- check: (model.open = true, true) -->
<!-- check: visible('#a') -->

## G4

Wrong:

```html throws
<div id="p"><div data-foreach="ifOpen"><p>panel</p></div></div>
<script>
new Stitch.DataBinder().bind('#p', Stitch.Observable.create({
    open: true,
    ifOpen: Stitch.computed(function () { return this.open ? [this] : []; }) // no id on the model
}));
</script>
```
Throws: `[Stitch E501]`

Right:

```html run
<div id="p">
    <p id="a" data-visible="open">shown with data-visible</p>
    <div data-foreach="ifOpen"><p class="panel" data-text="$root.title"></p></div>
</div>
<script>
const model = Stitch.Observable.create({
    open: false,
    title: 'Details',
    ifOpen: Stitch.computed(function () { return this.open ? [{ id: 'panel' }] : []; })
});
new Stitch.DataBinder().bind('#p', model);
</script>
```
<!-- check: visible('#a') === false && count('#p .panel') === 0 -->
<!-- check: (model.open = true, true) -->
<!-- check: visible('#a') && text('#p .panel') === 'Details' -->

## G5

Wrong:

```html run
<div id="p"><p id="a" v-show="open">a</p><p id="b" x-show="open">b</p><p id="c" data-show="open">c</p></div>
<script>new Stitch.DataBinder().bind('#p', Stitch.Observable.create({ open: false }));</script>
```
<!-- check: visible('#a') && visible('#b') && visible('#c') -->

Right:

```html run
<p id="a" data-visible="open">a</p>
<script>new Stitch.DataBinder().bind('#a', Stitch.Observable.create({ open: false }));</script>
```
<!-- check: visible('#a') === false -->

## G6

Wrong:

```html run
<div id="p"><input id="a" v-model="name"><input id="b" x-model="name"><input id="c" data-model="name"></div>
<script>const model = Stitch.Observable.create({ name: 'Ada' }); new Stitch.DataBinder().bind('#p', model);</script>
```
<!-- check: document.getElementById('a').value === '' && type('#c', 'Lin') && model.name === 'Ada' -->

Right:

```html run
<input id="a" data-value="name">
<script>const model = Stitch.Observable.create({ name: 'Ada' }); new Stitch.DataBinder().bind('#a', model);</script>
```
<!-- check: document.getElementById('a').value === 'Ada' && type('#a', 'Lin') && model.name === 'Lin' -->

## G7

Wrong:

```html run
<select id="a" data-value="qty" v-model.number="qty"><option value="1">1</option><option value="2">2</option></select>
<script>const model = Stitch.Observable.create({ qty: 1 }); new Stitch.DataBinder().bind('#a', model);</script>
```
<!-- check: type('#a', '2') && model.qty === '2' -->

Right:

```html run
<select id="a" data-value="qty" data-type="int"><option value="1">1</option><option value="2">2</option></select>
<script>const model = Stitch.Observable.create({ qty: 1 }); new Stitch.DataBinder().bind('#a', model);</script>
```
<!-- check: type('#a', '2') && model.qty === 2 -->

## G8

Wrong:

```html run
<ul id="p"><li v-for="item in items">x</li><li data-for="items">y</li></ul>
<script>new Stitch.DataBinder().bind('#p', Stitch.Observable.create({ items: [{ id: 1 }, { id: 2 }, { id: 3 }] }));</script>
```
<!-- check: count('#p li') === 2 -->

Right:

```html run
<ul id="p" data-foreach="items"><li data-text="id"></li></ul>
<script>new Stitch.DataBinder().bind('#p', Stitch.Observable.create({ items: [{ id: 1 }, { id: 2 }, { id: 3 }] }));</script>
```
<!-- check: texts('#p li').join(',') === '1,2,3' -->

## G9

Wrong:

```html run
<span id="p" data-bind="text: name"></span>
<script>new Stitch.DataBinder().bind('#p', Stitch.Observable.create({ name: 'Ada' }));</script>
```
<!-- check: text('#p') === '' -->

Right:

```html run
<span id="p" data-text="name"></span>
<script>new Stitch.DataBinder().bind('#p', Stitch.Observable.create({ name: 'Ada' }));</script>
```
<!-- check: text('#p') === 'Ada' -->

## G10

Wrong:

```html run
<a id="p" :href="url" v-bind:title="tip" data-text="tip"></a>
<script>new Stitch.DataBinder().bind('#p', Stitch.Observable.create({ url: '/docs', tip: 'Docs' }));</script>
```
<!-- check: attr('#p', 'href') === null && attr('#p', 'title') === null -->

Right:

```html run
<a id="p" data-attr="linkAttrs" data-text="tip"></a>
<script>
new Stitch.DataBinder().bind('#p', Stitch.Observable.create({
    url: '/docs',
    tip: 'Docs',
    linkAttrs: Stitch.computed(function () { return { href: this.url, title: this.tip }; })
}));
</script>
```
<!-- check: attr('#p', 'href') === '/docs' && attr('#p', 'title') === 'Docs' -->

## G11

Wrong:

```html run
<button id="p" :disabled="busy">Save</button>
<script>new Stitch.DataBinder().bind('#p', Stitch.Observable.create({ busy: true }));</script>
```
<!-- check: document.getElementById('p').disabled === false -->

Right:

```html run
<div id="p"><button id="a" data-enabled="idle">Save</button><button id="b" data-loading="busy">Send</button></div>
<script>
new Stitch.DataBinder().bind('#p', Stitch.Observable.create({
    busy: true,
    idle: Stitch.computed(function () { return !this.busy; })
}));
</script>
```
<!-- check: document.getElementById('a').disabled === true && document.getElementById('b').disabled === true -->

## G12

Wrong:

```html throws
<div id="p"><button @click="count++" data-click="count++">+</button></div>
<script>new Stitch.DataBinder().bind('#p', Stitch.Observable.create({ count: 0 }));</script>
```
Throws: `[Stitch E108]`

Right:

```html run
<button id="p" type="button" data-click="increment">+</button>
<script>
const model = Stitch.Observable.create({ count: 0, increment() { this.count++; } });
new Stitch.DataBinder().bind('#p', model);
</script>
```
<!-- check: click('#p') && model.count === 1 -->

## G13

Wrong:

```html run
<input id="p" @keyup.enter="save" data-value="q">
<script>const model = Stitch.Observable.create({ q: '', saved: false, save() { this.saved = true; } }); new Stitch.DataBinder().bind('#p', model);</script>
```
<!-- check: (document.getElementById('p').dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', bubbles: true })), model.saved === false) -->

Right:

```html run
<input id="p" data-event="keyEvents" data-value="q">
<script>
const model = Stitch.Observable.create({
    q: '',
    saved: false,
    keyEvents: { keydown: 'onKey' },
    onKey(item, event) { if (event.key === 'Enter') this.saved = true; }
});
new Stitch.DataBinder().bind('#p', model);
</script>
```
<!-- check: (document.getElementById('p').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })), model.saved === true) -->

## G14

Wrong:

```html throws
<ul id="p" data-foreach="items"><li><button data-click="remove(item)">x</button></li></ul>
<script>new Stitch.DataBinder().bind('#p', Stitch.Observable.create({ items: [{ id: 1 }], remove() {} }));</script>
```
Throws: `[Stitch E108]`

Right:

```html run
<ul id="p" data-foreach="items"><li><button type="button" data-click="$root.remove">x</button></li></ul>
<script>
const model = Stitch.Observable.create({
    items: [{ id: 1 }, { id: 2 }],
    remove(item, event) { this.items.splice(this.items.indexOf(item), 1); }
});
new Stitch.DataBinder().bind('#p', model);
</script>
```
<!-- check: click('#p li button') && model.items.map(i => i.id).join() === '2' -->

## G15

Wrong:

```html throws
<button id="p" data-attr="attrs">x</button>
<script>new Stitch.DataBinder().bind('#p', Stitch.Observable.create({ attrs: { onclick: 'save()' } }));</script>
```
Throws: `[Stitch E321]`

Right:

```html run
<button id="p" type="button" data-click="save">x</button>
<script>const model = Stitch.Observable.create({ saved: false, save() { this.saved = true; } }); new Stitch.DataBinder().bind('#p', model);</script>
```
<!-- check: click('#p') && model.saved === true -->

## G16

Wrong:

```html throws
<p id="p" :class="{ active: on }" data-class="{ active: on }">x</p>
<script>new Stitch.DataBinder().bind('#p', Stitch.Observable.create({ on: true }));</script>
```
Throws: `[Stitch E103]`

Right:

```html run
<p id="p" class="card" data-class="rowClass">x</p>
<script>
new Stitch.DataBinder().bind('#p', Stitch.Observable.create({
    on: true,
    rowClass: Stitch.computed(function () { return { active: this.on }; })
}));
</script>
```
<!-- check: document.getElementById('p').className === 'card active' -->

## G17

Wrong:

```js run
const model = Stitch.Observable.create({ query: '', log: '', watch: { query(value) { this.log = value; } } });
model.query = 'stitch';
```
<!-- check: model.log === '' -->

Right:

```js run
const model = Stitch.Observable.create({ query: '', log: '' });
model.$watch('query', function (now) { model.log = now; });
model.query = 'stitch';
```
<!-- check: model.log === 'stitch' -->

## G18

Wrong:

```html throws
<p id="p" data-visible="!done">x</p>
<script>new Stitch.DataBinder().bind('#p', Stitch.Observable.create({ done: false }));</script>
```
Throws: `[Stitch E102]`

```html throws
<p id="p" data-visible="items.length > 0">x</p>
<script>new Stitch.DataBinder().bind('#p', Stitch.Observable.create({ items: [] }));</script>
```
Throws: `[Stitch E102]`

Right:

```html run
<p id="p" data-visible="notDone">x</p>
<script>
new Stitch.DataBinder().bind('#p', Stitch.Observable.create({
    done: true,
    notDone: Stitch.computed(function () { return !this.done; })
}));
</script>
```
<!-- check: visible('#p') === false -->

## G19

Wrong:

```html throws
<p id="p" data-text="price.toFixed(2)"></p>
<script>new Stitch.DataBinder().bind('#p', Stitch.Observable.create({ price: 1 }));</script>
```
Throws: `[Stitch E104]`

Right:

```html run
<p id="p" data-text="priceText"></p>
<script>
new Stitch.DataBinder().bind('#p', Stitch.Observable.create({
    price: 1,
    priceText: Stitch.computed(function () { return this.price.toFixed(2); })
}));
</script>
```
<!-- check: text('#p') === '1.00' -->

## G20

Wrong:

```html throws
<p id="p" data-text="name | upper"></p>
<script>new Stitch.DataBinder().bind('#p', Stitch.Observable.create({ name: 'ada' }));</script>
```
Throws: `[Stitch E102]`

Right:

```html run
<p id="p" data-text="upperName"></p>
<script>
new Stitch.DataBinder().bind('#p', Stitch.Observable.create({
    name: 'ada',
    upperName: Stitch.computed(function () { return this.name.toUpperCase(); })
}));
</script>
```
<!-- check: text('#p') === 'ADA' -->

## G21

Wrong:

```html throws
<input id="p" data-value="city, visible: hasCity">
<script>new Stitch.DataBinder().bind('#p', Stitch.Observable.create({ city: '', hasCity: true }));</script>
```
Throws: `[Stitch E105]`

Right:

```html run
<input id="p" data-value="city" data-visible="hasCity">
<script>new Stitch.DataBinder().bind('#p', Stitch.Observable.create({ city: 'Paris', hasCity: false }));</script>
```
<!-- check: document.getElementById('p').value === 'Paris' && visible('#p') === false -->

## G22

Wrong:

```html run
<div id="p"><div id="a" v-html="html"></div><div id="b" data-html="html"></div></div>
<script>new Stitch.DataBinder().bind('#p', Stitch.Observable.create({ html: '<b>bold</b>' }));</script>
```
<!-- check: text('#a') === '' && text('#b') === '' -->

Right:

```html run
<div id="p" data-text="html"></div>
<script>new Stitch.DataBinder().bind('#p', Stitch.Observable.create({ html: '<b>bold</b>' }));</script>
```
<!-- check: text('#p') === '<b>bold</b>' && count('#p b') === 0 -->

## G23

Wrong:

```html run
<p id="p" data-text="title"></p>
<script>
const model = Stitch.Observable.create({ title: 'Old', other: 1 });
new Stitch.DataBinder().bind('#p', model);
document.getElementById('p').textContent = 'New'; // a DOM write the model does not know
model.title = 'Newer';
</script>
```
<!-- check: text('#p') === 'Newer' && model.title === 'Newer' -->

Right:

```html run
<p id="p" data-text="title"></p>
<script>const model = Stitch.Observable.create({ title: 'Old' }); new Stitch.DataBinder().bind('#p', model); model.title = 'New';</script>
```
<!-- check: text('#p') === 'New' -->

## G24

Wrong:

```html run
<p id="p" data-text="title"></p>
<script>
let model = Stitch.Observable.create({ title: 'old' });
new Stitch.DataBinder().bind('#p', model);
const newData = { title: 'new' };
model = Stitch.Observable.create(newData);
</script>
```
<!-- check: text('#p') === 'old' -->

Right:

```html run
<p id="p" data-text="title"></p>
<script>const model = Stitch.Observable.create({ title: 'old' }); new Stitch.DataBinder().bind('#p', model); model.title = 'new';</script>
```
<!-- check: text('#p') === 'new' -->

## G25

Wrong:

```js run
const model = Stitch.Observable.create({ price: 2, qty: 3, total: Stitch.computed(() => this.price * this.qty) });
```
<!-- check: Number.isNaN(model.total) -->

Right:

```js run
const model = Stitch.Observable.create({
    price: 2,
    qty: 3,
    total: Stitch.computed(m => m.price * m.qty),
    total2: Stitch.computed(function () { return this.price * this.qty; })
});
```
<!-- check: model.total === 6 && model.total2 === 6 -->

## G26

Wrong:

```js throws
Stitch.Observable.create({ saved: false, save: () => { this.saved = true; } });
```
Throws: `[Stitch E707]`

Right:

```js run
const model = Stitch.Observable.create({ saved: false, save() { this.saved = true; } });
model.save();
```
<!-- check: model.saved === true -->

## G27

Wrong:

```js run
const model = Stitch.Observable.create({ a: 2, total: Stitch.computed(function () { return this.a; }) });
try { model.total(); window.result = 'called'; } catch (e) { window.result = e instanceof TypeError; }
```
<!-- check: window.result === true -->

Right:

```js run
const model = Stitch.Observable.create({ a: 2, total: Stitch.computed(function () { return this.a; }) });
const total = model.total;
window.result = total;
```
<!-- check: window.result === 2 -->

## G28

Wrong:

```js throws
const model = Stitch.Observable.create({ price: 1, total: Stitch.computed(function () { return this.price; }) });
model.total = 5;
```
Throws: `[Stitch E713]`

Right:

```js run
const model = Stitch.Observable.create({ price: 1, total: Stitch.computed(function () { return this.price; }) });
model.price = 5;
```
<!-- check: model.total === 5 -->

## G29

Wrong:

```js throws
const model = Stitch.Observable.create({ reads: 0, total: Stitch.computed(function () { this.reads++; return 1; }) });
model.total;
```
Throws: `[Stitch E724]`

Right:

```js run
const model = Stitch.Observable.create({ a: 1, changes: 0, total: Stitch.computed(function () { return this.a * 2; }) });
model.$watch('a', function () { model.changes++; });
model.a = 2;
```
<!-- check: model.total === 4 && model.changes === 1 -->

## G30

Wrong:

```js throws
const model = Stitch.Observable.create({
    items: [{ id: 2 }, { id: 1 }],
    sorted: Stitch.computed(function () { return this.items.sort((a, b) => a.id - b.id); })
});
model.sorted;
```
Throws: `[Stitch E725]`

Right:

```js run
const model = Stitch.Observable.create({
    items: [{ id: 2 }, { id: 1 }],
    sorted: Stitch.computed(function () { return this.items.slice().sort((a, b) => a.id - b.id); })
});
```
<!-- check: model.sorted.map(i => i.id).join() === '1,2' && model.items.map(i => i.id).join() === '2,1' -->

## G31

Wrong:

```html throws
<p id="p" data-text="newProp"></p>
<script>
const model = Stitch.Observable.create({ x: 1 });
model.newProp = 1;
new Stitch.DataBinder().bind('#p', model);
</script>
```
Throws: `[Stitch E203]`

Right:

```html run
<p id="a" data-text="newProp"></p><p id="b" data-text="other"></p>
<script>
const model = Stitch.Observable.create({ x: 1, other: null });
model.$set('newProp', 1);
new Stitch.DataBinder().bind('#a', model);
const declared = Stitch.Observable.create({ newProp: null });
new Stitch.DataBinder().bind('#b', Stitch.Observable.create({ other: 'declared' }));
model.newProp = 2;
</script>
```
<!-- check: text('#a') === '2' && text('#b') === 'declared' -->

## G32

Wrong:

```html throws
<ul id="p" data-foreach="items"><li data-text="name"></li></ul>
<script>new Stitch.DataBinder().bind('#p', Stitch.Observable.create({ items: [{ name: 'a' }] }));</script>
```
Throws: `[Stitch E501]`

Right:

```html run
<ul id="a" data-foreach="items"><li data-text="name"></li></ul>
<ul id="b" data-foreach="items" data-key="field"><li data-text="name"></li></ul>
<script>
new Stitch.DataBinder().bind('#a', Stitch.Observable.create({ items: [{ id: 1, name: 'a' }] }));
new Stitch.DataBinder().bind('#b', Stitch.Observable.create({ items: [{ field: 'k', name: 'b' }] }));
</script>
```
<!-- check: text('#a li') === 'a' && text('#b li') === 'b' -->

## G33

Wrong:

```html throws
<button id="p" data-click="save">x</button>
<script>
new Stitch.DataBinder().bind('#p', Stitch.Observable.create({ save(event) { event.preventDefault(); } }));
click('#p');
</script>
```
Throws: `preventDefault is not a function`

Right:

```html run
<button id="p" data-click="save">x</button>
<script>
const model = Stitch.Observable.create({ save(item, event) { event.preventDefault(); } });
new Stitch.DataBinder().bind('#p', model);
document.getElementById('p').addEventListener('click', function (e) { window.prevented = e.defaultPrevented; });
</script>
```
<!-- check: click('#p') && window.prevented === true -->

## G34

Wrong:

```html run
<ul id="p" data-foreach="rows"><li><button data-click="$root.remove" data-text="name"></button></li></ul>
<script>
const model = Stitch.Observable.create({
    rows: [{ id: 1, name: 'a' }, { id: 2, name: 'b' }],
    remove() { this.rows.splice(this.rows.indexOf(this), 1); } // this is the model, not the row
});
new Stitch.DataBinder().bind('#p', model);
</script>
```
<!-- check: click('#p li:nth-child(1) button') && model.rows.map(r => r.name).join() === 'a' -->

Right:

```html run
<ul id="p" data-foreach="rows"><li><button data-click="$root.remove" data-text="name"></button></li></ul>
<script>
const model = Stitch.Observable.create({
    rows: [{ id: 1, name: 'a' }, { id: 2, name: 'b' }],
    remove(row) { this.rows.splice(this.rows.indexOf(row), 1); }
});
new Stitch.DataBinder().bind('#p', model);
</script>
```
<!-- check: click('#p li:nth-child(1) button') && model.rows.map(r => r.name).join() === 'b' -->

## G35

Wrong:

```html throws
<p id="p" data-text="nmae"></p>
<script>new Stitch.DataBinder().bind('#p', Stitch.Observable.create({ name: 'Ada' }));</script>
```
Throws: `[Stitch E201]`

Right:

```html run
<p id="p" data-text="nickname"></p>
<script>new Stitch.DataBinder().bind('#p', Stitch.Observable.create({ name: 'Ada', nickname: null }));</script>
```
<!-- check: text('#p') === '' -->

## G36

Wrong:

```html throws
<ul id="p" data-foreach="people"><li data-text="email"></li></ul>
<script>new Stitch.DataBinder().bind('#p', Stitch.Observable.create({ people: [{ id: 1, email: 'a@example.com' }, { id: 2 }] }));</script>
```
Throws: `[Stitch E201]`

Right:

```html run
<ul id="p" data-foreach="people"><li data-text="email"></li></ul>
<script>
const rows = [{ id: 1, email: 'a@example.com' }, { id: 2 }];
new Stitch.DataBinder().bind('#p', Stitch.Observable.create({ people: rows.map(r => ({ id: r.id, email: r.email ?? null })) }));
</script>
```
<!-- check: count('#p li') === 2 -->

## G37

Wrong:

```html throws
<ul id="p" data-foreach="nodes" data-template="node"></ul>
<template id="node"><li><span data-text="name"></span><ul data-foreach="children" data-template="node"></ul></li></template>
<script>new Stitch.DataBinder().bind('#p', Stitch.Observable.create({ nodes: [{ id: 1, name: 'leaf' }] }));</script>
```
Throws: `[Stitch E201]`

Right:

```html run
<ul id="p" data-foreach="nodes" data-template="node"></ul>
<template id="node"><li><span data-text="name"></span><ul data-foreach="children" data-template="node"></ul></li></template>
<script>new Stitch.DataBinder().bind('#p', Stitch.Observable.create({ nodes: [{ id: 1, name: 'leaf', children: [] }] }));</script>
```
<!-- check: text('#p span') === 'leaf' -->

## G38

Wrong:

```html throws
<p id="p" data-text="_count"></p>
<script>new Stitch.DataBinder().bind('#p', Stitch.Observable.create({ _count: 1 }));</script>
```
Throws: `[Stitch E203]`

Right:

```html run
<p id="p" data-text="count"></p>
<script>new Stitch.DataBinder().bind('#p', Stitch.Observable.create({ count: 1 }));</script>
```
<!-- check: text('#p') === '1' -->

## G39

Wrong:

```js throws
Stitch.Observable.create({ rows: [{ id: 1, toJSON: 'x' }] });
```
Throws: `[Stitch E709]`

Right:

```js run
const fromServer = [{ id: 1, toJSON: 'x' }];
const model = Stitch.Observable.create({ rows: fromServer.map(r => ({ id: r.id, jsonValue: r.toJSON })) });
```
<!-- check: model.rows[0].jsonValue === 'x' -->

## G40

Wrong:

```js throws
const model = Stitch.Observable.create({ a: 1 });
model.on(fn);
function fn() {}
```
Throws: `[Stitch E802]`

```js throws
const model = Stitch.Observable.create({ a: 1 });
model.get('a');
```
Throws: `[Stitch E802]`

Right:

```js run
const model = Stitch.Observable.create({ a: 1 });
const seen = [];
function fn(change) { seen.push(change.field); }
model.$onChange(fn);
model.a = 2;
window.result = model.$get('a') + ' ' + seen.join();
```
<!-- check: window.result === '2 a' -->

## G41

Wrong:

```js throws
const data = { count: 0 };
Stitch.Observable.create(data, { debug: true });
```
Throws: `[Stitch E706]`

Right:

```js run
const data = { count: 0 };
const model = Stitch.Observable.create(data);
let report = null;
const remove = Stitch.onBindReport(fn);
function fn(r) { report = r; }
remove();
```
<!-- check: model.count === 0 && typeof remove === 'function' -->

## G42

Wrong:

```js run
try { Stitch.debug.enable(); window.result = 'enabled'; } catch (e) { window.result = e instanceof TypeError; }
```
<!-- check: window.result === true -->

Right:

```js run
window.result = Stitch.debug.stats();
```
<!-- check: typeof window.result.effects === 'number' -->

## G43

Wrong:

```js throws
const initial = { name: '' };
Stitch.Observable.create(initial);
Stitch.Observable.create(initial);
```
Throws: `[Stitch E703]`

Right:

```js run
function blank() { return { name: '' }; }
const model = Stitch.Observable.create(blank());
model.name = 'Ada';
Object.assign(model, blank());
```
<!-- check: model.name === '' -->

## G44

Wrong:

```js throws
const model = Stitch.Observable.create({ user: { name: 'Ada' } });
Stitch.Observable.create(model.user);
```
Throws: `[Stitch E704]`

Right:

```js run
const model = Stitch.Observable.create({ user: { name: 'Ada' } });
const copy = Stitch.Observable.create(Stitch.Observable.toRaw(model.user));
copy.name = 'Grace';
```
<!-- check: model.user.name === 'Ada' && copy.name === 'Grace' -->

## G45

Wrong:

```js throws
const app = Stitch.Observable.create({ cart: null });
const cartModel = Stitch.Observable.create({ items: [] });
app.cart = cartModel;
```
Throws: `[Stitch E710]`

Right:

```js run
const app = Stitch.Observable.create({ cart: null });
const cartModel = Stitch.Observable.create({ items: [] });
app.cart = Stitch.Observable.toRaw(cartModel);
```
<!-- check: Array.isArray(Stitch.Observable.toRaw(app.cart.items)) -->

## G46

Wrong:

```js throws
const countries = ['FR', 'JP'];
Stitch.Observable.create({ countries });
Stitch.Observable.create({ countries });
```
Throws: `[Stitch E711]`

Right:

```js run
const countries = ['FR', 'JP'];
const a = Stitch.Observable.create({ countries: [...countries] });
const b = Stitch.Observable.create({ countries: [...countries] });
```
<!-- check: a.countries.length === 2 && b.countries.length === 2 -->

## G47

Wrong:

```js throws
const data = Object.freeze({ name: 'Ada' });
Stitch.Observable.create(data);
```
Throws: `[Stitch E714]`

Right:

```js run
const data = Object.freeze({ name: 'Ada' });
const model = Stitch.Observable.create(structuredClone(data));
```
<!-- check: model.name === 'Ada' -->

## G48

Wrong:

```js run
const model = Stitch.Observable.create({ selected: { id: 1 } });
window.result = delete model.selected; // sloppy-mode script: false, nothing deleted
```
<!-- check: window.result === false && model.selected.id === 1 -->

Right:

```js run
const model = Stitch.Observable.create({ selected: { id: 1 } });
model.selected = null;
```
<!-- check: model.selected === null -->

## G49

Wrong:

```js throws
const model = Stitch.Observable.create({ rows: [{ id: 1 }] });
delete model.rows[0];
```
Throws: `[Stitch E712]`

Right:

```js run
const model = Stitch.Observable.create({ rows: [{ id: 1 }] });
model.rows.splice(0, 1);
```
<!-- check: model.rows.length === 0 -->

## G50

Wrong:

```js run
const model = Stitch.Observable.create({ rows: [{ id: 1 }] });
try { structuredClone(model); window.result = 'cloned'; } catch (e) { window.result = e.name; }
```
<!-- check: window.result === 'DataCloneError' -->

Right:

```js run
const model = Stitch.Observable.create({ rows: [{ id: 1 }] });
const copy = Stitch.Observable.toRaw(model);
```
<!-- check: Array.isArray(copy.rows) && copy.rows[0].id === 1 && Stitch.Observable.isReactive(copy) === false -->

## G51

Wrong:

```js throws
const model = Stitch.Observable.create({ user: { name: 'Ada' } });
model.user.$emit('saved');
```
Throws: `[Stitch E801]`

Right:

```html run
<ul id="p" data-foreach="rows"><li><button data-click="$root.save">save</button></li></ul>
<script>
const model = Stitch.Observable.create({ rows: [{ id: 1 }], heard: [], save(row) { this.$emit('saved', row.id); } });
model.$on('saved', function (id) { model.heard.push(id === undefined ? 'root' : id); });
new Stitch.DataBinder().bind('#p', model);
model.$emit('saved');
</script>
```
<!-- check: click('#p button') -->
<!-- check: model.heard.join() === 'root,1' -->

## G52

Wrong:

```js run
const model = Stitch.Observable.create({ user: { name: 'Ada' } });
const fn = function () {};
try { model.user.$watch('name', fn); window.result = 'watched'; } catch (e) { window.result = e instanceof TypeError; }
```
<!-- check: window.result === true -->

Right:

```js run
const model = Stitch.Observable.create({ user: { name: 'Ada' } });
const seen = [];
const fn = function (now) { seen.push(now); };
model.$watch('user.name', fn);
model.user.name = 'Grace';
```
<!-- check: seen.join() === 'Grace' -->

## G53

Wrong:

```js throws
const model = Stitch.Observable.create({ a: 1 });
const fn = function () {};
model.$on(fn);
```
Throws: `[Stitch E811]`

Right:

```js run
const model = Stitch.Observable.create({ a: 1 });
const seen = [];
const fn = function (change) { seen.push(change.field); };
model.$onChange(fn);
model.a = 2;
```
<!-- check: seen.join() === 'a' -->

## G54

Wrong:

```js throws
const model = Stitch.Observable.create({ a: 1 });
const fn = function () {};
model.$onChange('saved', fn);
```
Throws: `[Stitch E803]`

Right:

```js run
const model = Stitch.Observable.create({ a: 1, got: null });
const fn = function (payload) { model.got = payload; };
model.$on('saved', fn);
model.$emit('saved', 3);
```
<!-- check: model.got === 3 -->

## G55

Wrong:

```js throws
const model = Stitch.Observable.create({ a: 1 });
model.$on('saved', () => {});
model.$off('saved', () => {});
```
Throws: `[Stitch E853]`

Right:

```js run
const model = Stitch.Observable.create({ heard: 0 });
const stop = model.$on('saved', () => { model.heard++; });
stop();
model.$emit('saved');
```
<!-- check: tick().then(() => model.heard === 0) -->

## G56

Wrong:

```js throws
const model = Stitch.Observable.create({ a: 1 });
model.$watch('a', function (v) { model.a = v + 1; });
model.a = 2;
```
Throws: `[Stitch E912]`

Right:

```js run
const model = Stitch.Observable.create({ a: 1 });
model.$watch('a', function (v) { if (v > 10) model.a = 10; });
model.a = 20;
```
<!-- check: model.a === 10 -->

## G57

Wrong:

```js throws
const fn = function () {};
Stitch.Observable.create({ _x: 1 }).$watch('_x', fn);
```
Throws: `[Stitch E205]`

```js throws
const fn = function () {};
Stitch.Observable.create({ x: 1 }).$watch('missing', fn);
```
Throws: `[Stitch E204]`

Right:

```js run
const seen = [];
const model = Stitch.Observable.create({ x: 1 });
model.$watch('x', function (now) { seen.push(now); });
model.x = 2;
```
<!-- check: seen.join() === '2' -->

## G58

Wrong:

```js run
const model = Stitch.Observable.create({ n: 0 });
model.$on('ping', function () { model.n = 1; });
model.$emit('ping');
window.sync = model.n;
```
<!-- check: window.sync === 0 -->

Right:

```js run
(async function () {
    const model = Stitch.Observable.create({ n: 0 });
    model.$on('ping', function () { model.n = 1; });
    model.$emit('ping');
    await Promise.resolve();
    window.after = model.n;
})();
```
<!-- check: window.after === 1 -->

## G59

Wrong:

```html run
<p id="p" data-text="count"></p>
<script>
const model = Stitch.Observable.create({ count: 0 });
const binder = new Stitch.DataBinder();
binder.bind('#p', model);
const heard = [];
model.$watch('count', function () { heard.push('watch'); });
model.$onChange(function () { heard.push('change'); });
binder.dispose();
model.count = 1;
</script>
```
<!-- check: heard.join() === 'watch,change' -->

Right:

```html run
<p id="p" data-text="count"></p>
<script>
const model = Stitch.Observable.create({ count: 0 });
const binder = new Stitch.DataBinder();
binder.bind('#p', model);
const heard = [];
const stopWatch = model.$watch('count', function () { heard.push('watch'); });
binder.dispose();
stopWatch();
model.count = 1;
</script>
```
<!-- check: heard.length === 0 -->

## G60

Wrong:

```js throws
const model = Stitch.Observable.create({
    first: 'Ada',
    name: Stitch.computed({ get() { return this.first; }, set(value) { this.first = value; } })
});
model.name = 'Grace';
```
Throws: `[Stitch E713]`

Right:

```html run
<button id="p" data-click="rename" data-text="first"></button>
<script>
const model = Stitch.Observable.create({ first: 'Ada', rename(model, event) { this.first = 'Grace'; } });
new Stitch.DataBinder().bind('#p', model);
</script>
```
<!-- check: click('#p') && model.first === 'Grace' -->

## G61

Wrong:

```html throws
<p id="p" data-text="selected.nmae"></p>
<script>
const model = Stitch.Observable.create({ selected: null });
new Stitch.DataBinder().bind('#p', model); // binds: the path stops at null
model.selected = { name: 'Ada' };          // now the typo is found
</script>
```
Throws: `[Stitch E201]`

Right:

```html run
<p id="p" data-text="selected.name"></p>
<script>
const model = Stitch.Observable.create({ selected: null });
new Stitch.DataBinder().bind('#p', model);
model.selected = { name: 'Ada' };
</script>
```
<!-- check: text('#p') === 'Ada' -->

## G62

Wrong:

```html throws
<p id="p" data-text="items.0.title"></p>
<script>new Stitch.DataBinder().bind('#p', Stitch.Observable.create({ items: [] }));</script>
```
Throws: `[Stitch E201]`

Right:

```html run
<p id="p" data-text="firstTitle"></p>
<script>
const model = Stitch.Observable.create({
    items: [],
    firstTitle: Stitch.computed(function () { return this.items.length ? this.items[0].title : ''; })
});
new Stitch.DataBinder().bind('#p', model);
model.items.push({ id: 1, title: 'First' });
</script>
```
<!-- check: text('#p') === 'First' -->

## G63

Wrong:

```js run
const model = Stitch.Observable.create({
    label: Stitch.computed(function (format = 'short') { return format === 'short' ? 'short' : 'got the holder'; })
});
```
<!-- check: model.label === 'got the holder' -->

Right:

```js run
const model = Stitch.Observable.create({
    format: 'short',
    label: Stitch.computed(function () { return this.format === 'short' ? 'short' : 'long'; })
});
```
<!-- check: model.label === 'short' -->

## G64

Wrong:

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

Right:

```html run
<ul id="a" data-foreach="rows"><li data-text="name"></li></ul>
<ul id="b" data-foreach="rows"><li data-text="name"></li></ul>
<script>
const A = Stitch.Observable.create({ rows: [{ id: 1, name: 'a1' }] }, { isolated: true });
const B = Stitch.Observable.create({ rows: [{ id: 1, name: 'b1' }] }, { isolated: true });
new Stitch.DataBinder().bind('#a', A);
new Stitch.DataBinder().bind('#b', B);
A.rows.push({ id: 2, name: 'a2' });
</script>
```
<!-- check: (A.rows[1].name = 'a2-changed', true) -->
<!-- check: texts('#a li').join(',') === 'a1,a2-changed' -->

## G65

Wrong:

```js throws
const model = Stitch.Observable.create({ rows: [] });
const rows = model.rows;
rows.push({ id: 3, go: () => 1 });
```
Throws: `[Stitch E707]`

Right:

```js run
const model = Stitch.Observable.create({ rows: [] });
const rows = model.rows;
rows.push({ id: 3, go() { return 1; } });
```
<!-- check: model.rows[0].go() === 1 -->

## G66

Wrong:

```html throws
<div id="p"><label data-text="label"><input data-value="v"></label></div>
<script>new Stitch.DataBinder().bind('#p', Stitch.Observable.create({ label: 'Name', v: '' }));</script>
```
Throws: `[Stitch E535]`

Right:

```html run
<div id="p"><label><span data-text="label"></span><input data-value="v"></label></div>
<script>new Stitch.DataBinder().bind('#p', Stitch.Observable.create({ label: 'Name', v: 'x' }));</script>
```
<!-- check: text('#p span') === 'Name' && document.querySelector('#p input').value === 'x' -->

## G67

Wrong:

```html throws
<div id="p"><ul data-foreach="rows" data-text="title"><li data-text="$data"></li></ul></div>
<script>new Stitch.DataBinder().bind('#p', Stitch.Observable.create({ title: 'T', rows: ['a'] }));</script>
```
Throws: `[Stitch E534]`

Right:

```html run
<div id="p"><h3 data-text="title"></h3><ul data-foreach="rows"><li data-text="$data"></li></ul></div>
<script>new Stitch.DataBinder().bind('#p', Stitch.Observable.create({ title: 'T', rows: ['a'] }));</script>
```
<!-- check: text('#p h3') === 'T' && text('#p li') === 'a' -->

## G68

Wrong:

```html throws
<input id="p" data-value="total">
<script>new Stitch.DataBinder().bind('#p', Stitch.Observable.create({ a: 1, total: Stitch.computed(function () { return this.a; }) }));</script>
```
Throws: `[Stitch E311]`

Right:

```html run
<div id="p"><input data-value="a"><span data-text="total"></span></div>
<script>new Stitch.DataBinder().bind('#p', Stitch.Observable.create({ a: 1, total: Stitch.computed(function () { return this.a * 2; }) }));</script>
```
<!-- check: type('#p input', '4') -->
<!-- check: text('#p span') === '8' -->

## G69

Wrong:

```html throws
<select id="p" data-foreach="sectors" data-value="sector"><option data-value="$data" data-text="$data"></option></select>
<script>new Stitch.DataBinder().bind('#p', Stitch.Observable.create({ sector: '', sectors: ['Energy'] }));</script>
```
Throws: `[Stitch E313]`

Right:

```html run
<select id="p" data-foreach="sectors" data-value="sector"><option data-text="$data"></option></select>
<script>const model = Stitch.Observable.create({ sector: '', sectors: ['Energy', 'Tech'] }); new Stitch.DataBinder().bind('#p', model);</script>
```
<!-- check: type('#p', 'Tech') && model.sector === 'Tech' -->

## G70

Wrong:

```html run
<div id="p"><span data-value="name"></span></div>
<script>new Stitch.DataBinder().bind('#p', Stitch.Observable.create({ name: 'Ada' }));</script>
```
<!-- check: text('#p span') === '' -->

Right:

```html run
<div id="p"><span data-text="name"></span><input data-value="name"></div>
<script>new Stitch.DataBinder().bind('#p', Stitch.Observable.create({ name: 'Ada' }));</script>
```
<!-- check: text('#p span') === 'Ada' && document.querySelector('#p input').value === 'Ada' -->

## G71

Wrong:

```html run
<div id="p"><select data-value="selectedId"><option value="1">one</option><option value="2">two</option></select></div>
<script>
const model = Stitch.Observable.create({ selectedId: 1 });
new Stitch.DataBinder().bind('#p', model);
window.picksTwo = () => model.selectedId === 2;
</script>
```
<!-- check: type('#p select', '2') && window.picksTwo() === false && model.selectedId === '2' -->

Right:

```html run
<div id="p"><select data-value="selectedId" data-type="int"><option value="1">one</option><option value="2">two</option></select></div>
<script>const model = Stitch.Observable.create({ selectedId: 1 }); new Stitch.DataBinder().bind('#p', model);</script>
```
<!-- check: type('#p select', '2') && model.selectedId === 2 -->

## G72

Wrong:

```html run
<select id="p" data-foreach="cities" data-value="city" data-default-text="City"><option data-text="$data"></option></select>
<script>
const model = Stitch.Observable.create({
    city: 'Lyon',
    cities: ['Paris', 'Lyon'],
    async reload() {
        const loaded = ['Paris', 'Lyon', 'Nice'];
        this.cities = [];
        await new Promise(resolve => setTimeout(resolve, 0));
        this.cities = loaded;
    }
});
new Stitch.DataBinder().bind('#p', model);
model.reload();
</script>
```
<!-- check: tick().then(() => tick()).then(() => model.city === '' && count('#p option') === 4) -->

Right:

```html run
<select id="p" data-foreach="cities" data-value="city" data-default-text="City"><option data-text="$data"></option></select>
<script>
const model = Stitch.Observable.create({
    city: 'Lyon',
    cities: ['Paris', 'Lyon'],
    async reload() {
        const loaded = ['Paris', 'Lyon', 'Nice'];
        await new Promise(resolve => setTimeout(resolve, 0));
        this.cities = loaded;
    }
});
new Stitch.DataBinder().bind('#p', model);
model.reload();
</script>
```
<!-- check: tick().then(() => tick()).then(() => model.city === 'Lyon' && document.getElementById('p').value === 'Lyon') -->

## G73

Wrong:

```html run
<div id="p">
    <input data-value="q">
    <select data-foreach="shown" data-value="city" data-default-text="City"><option data-value="id" data-text="name"></option></select>
</div>
<script>
const model = Stitch.Observable.create({
    q: '',
    city: 'par',
    cities: [{ id: 'par', name: 'Paris' }, { id: 'lyo', name: 'Lyon' }],
    shown: Stitch.computed(function () { return this.cities.filter(c => c.name.toLowerCase().includes(this.q)); })
});
new Stitch.DataBinder().bind('#p', model);
</script>
```
<!-- check: type('#p input', 'ly') -->
<!-- check: type('#p input', '') -->
<!-- check: model.city === '' && document.querySelector('#p select').value === '' -->

Right:

```html run
<div id="p">
    <input data-value="q">
    <select data-foreach="shown" data-value="city" data-default-text="City"><option data-value="id" data-text="name"></option></select>
</div>
<script>
const model = Stitch.Observable.create({
    q: '',
    city: 'par',
    cities: [{ id: 'par', name: 'Paris' }, { id: 'lyo', name: 'Lyon' }],
    shown: Stitch.computed(function () { return this.cities.filter(c => c.name.toLowerCase().includes(this.q) || c.id === this.city); })
});
new Stitch.DataBinder().bind('#p', model);
</script>
```
<!-- check: type('#p input', 'ly') -->
<!-- check: model.city === 'par' && count('#p option') === 3 -->
<!-- check: type('#p input', '') -->
<!-- check: model.city === 'par' && document.querySelector('#p select').value === 'par' -->

## G74

Wrong:

```html run
<div id="p"><select data-foreach="opts" data-value="v"><option data-text="$data"></option></select></div>
<script>const model = Stitch.Observable.create({ v: 'b', opts: ['a', 'b'] }); new Stitch.DataBinder().bind('#p', model); model.opts = ['a'];</script>
```
<!-- check: model.v === null && document.querySelector('#p select').selectedIndex === -1 -->

Right:

```html run
<div id="p"><select data-foreach="opts" data-value="v" data-default-text="Choose..."><option data-text="$data"></option></select></div>
<script>const model = Stitch.Observable.create({ v: 'b', opts: ['a', 'b'] }); new Stitch.DataBinder().bind('#p', model); model.opts = ['a'];</script>
```
<!-- check: model.v === '' && document.querySelector('#p select').selectedOptions[0].textContent === 'Choose...' -->

## G75

Wrong:

```html throws
<select id="p" data-foreach="options" data-value="choice"><option value="">Pick</option><option data-text="$data"></option></select>
<script>new Stitch.DataBinder().bind('#p', Stitch.Observable.create({ choice: '', options: ['x'] }));</script>
```
Throws: `[Stitch E511]`

Right:

```html run
<select id="p" data-foreach="options" data-value="choice" data-default-text="Pick"><option data-text="$data"></option></select>
<script>new Stitch.DataBinder().bind('#p', Stitch.Observable.create({ choice: '', options: ['x'] }));</script>
```
<!-- check: texts('#p option').join(',') === 'Pick,x' -->

## G76

Wrong:

```html run
<p id="p" class="card" data-class="state">x</p>
<script>new Stitch.DataBinder().bind('#p', Stitch.Observable.create({ state: 'active' }));</script>
```
<!-- check: document.getElementById('p').className === 'active' -->

Right:

```html run
<p id="p" class="card" data-class="classes">x</p>
<script>
new Stitch.DataBinder().bind('#p', Stitch.Observable.create({
    on: true,
    classes: Stitch.computed(function () { return { active: this.on }; })
}));
</script>
```
<!-- check: document.getElementById('p').className === 'card active' -->

## G77

Wrong:

```html run
<button id="p" data-attr="attrs">x</button>
<script>new Stitch.DataBinder().bind('#p', Stitch.Observable.create({ attrs: { 'aria-expanded': true } }));</script>
```
<!-- check: attr('#p', 'aria-expanded') === '' -->

Right:

```html run
<button id="p" data-attr="attrs">x</button>
<script>
new Stitch.DataBinder().bind('#p', Stitch.Observable.create({
    open: true,
    attrs: Stitch.computed(function () { return { 'aria-expanded': this.open ? 'true' : 'false' }; })
}));
</script>
```
<!-- check: attr('#p', 'aria-expanded') === 'true' -->

## G78

Wrong:

```html throws
<p id="p" data-attr="attrs">x</p>
<script>new Stitch.DataBinder().bind('#p', Stitch.Observable.create({ attrs: { style: 'color: red' } }));</script>
```
Throws: `[Stitch E325]`

Right:

```html run
<div id="p"><p id="a" data-attr="attrs">x</p><p id="b" data-class="classes">y</p></div>
<script>new Stitch.DataBinder().bind('#p', Stitch.Observable.create({ attrs: { style: { color: 'red' } }, classes: { warn: true } }));</script>
```
<!-- check: document.getElementById('a').style.color === 'red' && document.getElementById('b').className === 'warn' -->

## G79

Wrong:

```html throws
<a id="p" data-attr="link">x</a>
<script>
const userInput = 'javascript:alert(1)';
new Stitch.DataBinder().bind('#p', Stitch.Observable.create({ link: { href: userInput } }));
</script>
```
Throws: `[Stitch E323]`

Right:

```html run
<a id="p" data-attr="link">x</a>
<script>
new Stitch.DataBinder().bind('#p', Stitch.Observable.create({
    userId: 'javascript:alert(1)',
    link: Stitch.computed(function () { return { href: '/u/' + encodeURIComponent(this.userId) }; })
}));
</script>
```
<!-- check: attr('#p', 'href').indexOf('/u/javascript%3A') === 0 -->

## G80

Wrong:

```html throws
<a id="p" data-attr="link">report</a>
<script>new Stitch.DataBinder().bind('#p', Stitch.Observable.create({ link: { href: 'data:text/html,hi' } }));</script>
```
Throws: `[Stitch E324]`

Right:

```html run
<a id="p" data-attr="link">report</a>
<script>new Stitch.DataBinder().bind('#p', Stitch.Observable.create({ link: { href: '/files/report.html' } }));</script>
```
<!-- check: attr('#p', 'href') === '/files/report.html' -->

## G81

Wrong:

```html throws
<iframe id="p" sandbox="" data-attr="frame"></iframe>
<script>new Stitch.DataBinder().bind('#p', Stitch.Observable.create({ frame: { sandbox: null } }));</script>
```
Throws: `[Stitch E327]`

Right:

```html run
<iframe id="p" sandbox="" data-attr="frame"></iframe>
<script>new Stitch.DataBinder().bind('#p', Stitch.Observable.create({ frame: { title: 'Preview' } }));</script>
```
<!-- check: attr('#p', 'sandbox') === '' && attr('#p', 'title') === 'Preview' -->

## G82

Wrong:

```html throws
<a id="p" rel="noopener" data-attr="link">x</a>
<script>new Stitch.DataBinder().bind('#p', Stitch.Observable.create({ link: { rel: 'nofollow' } }));</script>
```
Throws: `[Stitch E329]`

Right:

```html run
<a id="p" rel="noopener" data-attr="link">x</a>
<script>new Stitch.DataBinder().bind('#p', Stitch.Observable.create({ link: { rel: 'noopener nofollow' } }));</script>
```
<!-- check: attr('#p', 'rel') === 'noopener nofollow' -->

## G83

Wrong:

```html throws
<a id="p" data-attr="link">x</a>
<script>new Stitch.DataBinder().bind('#p', Stitch.Observable.create({ link: { rel: 'opener' } }));</script>
```
Throws: `[Stitch E328]`

Right:

```html run
<a id="p" data-attr="link">x</a>
<script>new Stitch.DataBinder().bind('#p', Stitch.Observable.create({ link: { rel: 'noopener noreferrer' } }));</script>
```
<!-- check: attr('#p', 'rel') === 'noopener noreferrer' -->

## G84

Wrong:

```html throws
<iframe id="p" data-attr="frame"></iframe>
<script>new Stitch.DataBinder().bind('#p', Stitch.Observable.create({ frame: { srcdoc: '<p>hi</p>' } }));</script>
```
Throws: `[Stitch E322]`

Right:

```html run
<a id="p" data-attr="link">open the report</a>
<script>new Stitch.DataBinder().bind('#p', Stitch.Observable.create({ link: { href: '/files/report.html' } }));</script>
```
<!-- check: attr('#p', 'href') === '/files/report.html' -->

## G85

Wrong:

```html throws
<div id="p"><style data-text="css"></style></div>
<script>new Stitch.DataBinder().bind('#p', Stitch.Observable.create({ css: 'p {}' }));</script>
```
Throws: `[Stitch E326]`

Right:

```html run
<div id="p"><pre data-text="css"></pre></div>
<script>new Stitch.DataBinder().bind('#p', Stitch.Observable.create({ css: 'p {}' }));</script>
```
<!-- check: text('#p pre') === 'p {}' -->

## G86

Wrong:

```html run
<input id="p" type="password" data-attr="attrs">
<script>
const field = 'type';       // a name that came from data
const value = 'text';
new Stitch.DataBinder().bind('#p', Stitch.Observable.create({ attrs: { [field]: value } }));
</script>
```
<!-- check: document.getElementById('p').type === 'text' -->

Right:

```html run
<input id="p" type="password" data-attr="attrs">
<script>
new Stitch.DataBinder().bind('#p', Stitch.Observable.create({
    hint: 'type' ,
    attrs: Stitch.computed(function () { return { placeholder: this.hint }; })
}));
</script>
```
<!-- check: document.getElementById('p').type === 'password' && attr('#p', 'placeholder') === 'type' -->

## G87

Guidance only: a Content-Security-Policy comes from the page's HTTP header (or a meta element at load); the snippet frames cannot set one. The library's strict-CSP suite (test-strict-csp.html) shows that Stitch needs nothing allowed.

## G88

Wrong:

```html run
<div id="p"><p hidden data-visible="open">x</p></div>
<script>new Stitch.DataBinder().bind('#p', Stitch.Observable.create({ open: true }));</script>
```
<!-- check: visible('#p p') === false -->

Right:

```html run
<div id="p"><p data-visible="open">x</p></div>
<script>const model = Stitch.Observable.create({ open: false }); new Stitch.DataBinder().bind('#p', model);</script>
```
<!-- check: visible('#p p') === false && (model.open = true, true) -->
<!-- check: visible('#p p') -->

## G89

Wrong:

```html run
<style>.hid { display: none; }</style>
<div id="p"><p class="hid" data-visible="open">x</p></div>
<script>new Stitch.DataBinder().bind('#p', Stitch.Observable.create({ open: true }));</script>
```
<!-- check: visible('#p p') === false -->

Right:

```html run
<div id="p"><p data-visible="open">x</p></div>
<script>const model = Stitch.Observable.create({ open: false }); new Stitch.DataBinder().bind('#p', model);</script>
```
<!-- check: visible('#p p') === false && (model.open = true, true) -->
<!-- check: visible('#p p') -->

## G90

Wrong:

```html run
<div id="p"><input type="number" data-value="qty"><span data-text="total"></span></div>
<script>
const model = Stitch.Observable.create({ price: 2, qty: 1, total: Stitch.computed(function () { return this.price * this.qty; }) });
new Stitch.DataBinder().bind('#p', model);
</script>
```
<!-- check: type('#p input', '') && model.qty === null && model.total === 0 -->

Right:

```html run
<div id="p"><input type="number" data-value="qty"><span data-text="total"></span></div>
<script>
const model = Stitch.Observable.create({ price: 2, qty: 1, total: Stitch.computed(function () { return this.price * (this.qty || 0); }) });
new Stitch.DataBinder().bind('#p', model);
</script>
```
<!-- check: type('#p input', 'x') && model.total === 0 && type('#p input', '3') && model.total === 6 -->

## G91

Wrong:

```html run
<p id="p" data-text="due"></p>
<script>new Stitch.DataBinder().bind('#p', Stitch.Observable.create({ due: new Date(Date.UTC(2024, 4, 6)) }));</script>
```
<!-- check: text('#p').length > 20 -->

Right:

```html run
<p id="p" data-text="dueText"></p>
<script>
new Stitch.DataBinder().bind('#p', Stitch.Observable.create({
    due: new Date(Date.UTC(2024, 4, 6)),
    dueText: Stitch.computed(function () { return this.due ? this.due.toISOString().slice(0, 10) : ''; })
}));
</script>
```
<!-- check: text('#p') === '2024-05-06' -->

## G92

Wrong:

```html run
<p id="p" data-text="obj"></p>
<script>new Stitch.DataBinder().bind('#p', Stitch.Observable.create({ obj: { a: 1 } }));</script>
```
<!-- check: text('#p') === '[object Object]' -->

Right:

```html run
<div id="p"><span id="a" data-text="objText"></span><span id="b" data-text="tagText"></span></div>
<script>
new Stitch.DataBinder().bind('#p', Stitch.Observable.create({
    obj: { a: 1 },
    tags: ['x', 'y'],
    objText: Stitch.computed(function () { return JSON.stringify(this.obj); }),
    tagText: Stitch.computed(function () { return this.tags.join(', '); })
}));
</script>
```
<!-- check: text('#a') === '{"a":1}' && text('#b') === 'x, y' -->

## G93

Wrong:

```html run
<div id="p"><a data-enabled="ok" data-click="go">go</a></div>
<script>const model = Stitch.Observable.create({ ok: false, went: false, go() { this.went = true; } }); new Stitch.DataBinder().bind('#p', model);</script>
```
<!-- check: click('#p a') && model.went === true -->

Right:

```html run
<div id="p"><button type="button" data-enabled="ok" data-click="go">go</button></div>
<script>const model = Stitch.Observable.create({ ok: false, went: false, go() { this.went = true; } }); new Stitch.DataBinder().bind('#p', model);</script>
```
<!-- check: click('#p button') && model.went === false -->

## G94

Wrong:

```html throws
<dl id="p" data-foreach="terms"><dt data-text="term"></dt><dd data-text="meaning"></dd></dl>
<script>new Stitch.DataBinder().bind('#p', Stitch.Observable.create({ terms: [{ id: 1, term: 't', meaning: 'm' }] }));</script>
```
Throws: `[Stitch E511]`

Right:

```html run
<dl id="p" data-foreach="terms"><div><dt data-text="term"></dt><dd data-text="meaning"></dd></div></dl>
<script>new Stitch.DataBinder().bind('#p', Stitch.Observable.create({ terms: [{ id: 1, term: 't', meaning: 'm' }] }));</script>
```
<!-- check: text('#p dt') === 't' && text('#p dd') === 'm' -->

## G95

Wrong:

```html throws
<ul id="p" data-foreach="rows">Loading...</ul>
<script>new Stitch.DataBinder().bind('#p', Stitch.Observable.create({ rows: [] }));</script>
```
Throws: `[Stitch E513]`

Right:

```html run
<div id="p"><p data-visible="loading">Loading...</p><ul data-foreach="rows"><li data-text="$data"></li></ul></div>
<script>const model = Stitch.Observable.create({ loading: true, rows: [] }); new Stitch.DataBinder().bind('#p', model);</script>
```
<!-- check: visible('#p p') && (model.rows = ['a'], model.loading = false, true) -->
<!-- check: visible('#p p') === false && text('#p li') === 'a' -->

## G96

Wrong:

```html run
<div id="p"><table data-foreach="rows"><tr><td data-text="name"></td></tr></table></div>
<script>new Stitch.DataBinder().bind('#p', Stitch.Observable.create({ rows: [{ id: 1, name: 'a' }, { id: 2, name: 'b' }] }));</script>
```
<!-- check: count('#p table > tbody') === 2 -->

Right:

```html run
<div id="p"><table><tbody data-foreach="rows"><tr><td data-text="name"></td></tr></tbody></table></div>
<script>new Stitch.DataBinder().bind('#p', Stitch.Observable.create({ rows: [{ id: 1, name: 'a' }, { id: 2, name: 'b' }] }));</script>
```
<!-- check: count('#p table > tbody') === 1 && count('#p tr') === 2 -->

## G97

Wrong:

```html throws
<ul id="p" data-foreach="byId"><li data-text="name"></li></ul>
<script>new Stitch.DataBinder().bind('#p', Stitch.Observable.create({ byId: { a: { id: 1, name: 'a' } } }));</script>
```
Throws: `[Stitch E521]`

Right:

```html run
<ul id="p" data-foreach="rows"><li data-text="name"></li></ul>
<script>
new Stitch.DataBinder().bind('#p', Stitch.Observable.create({
    byId: { a: { id: 1, name: 'a' } },
    rows: Stitch.computed(function () { return Object.values(this.byId); })
}));
</script>
```
<!-- check: text('#p li') === 'a' -->

## G98

Wrong:

```html throws
<ul id="p" data-foreach="tags"><li data-text="$data"></li></ul>
<script>new Stitch.DataBinder().bind('#p', Stitch.Observable.create({ tags: ['a', 'a'] }));</script>
```
Throws: `[Stitch E502]`

```html throws
<ul id="p" data-foreach="rows"><li data-text="tag"></li></ul>
<script>new Stitch.DataBinder().bind('#p', Stitch.Observable.create({ rows: [{ id: 1, tag: 'a' }, { id: 1, tag: 'b' }] }));</script>
```
Throws: `[Stitch E502]`

Right:

```html run
<ul id="p" data-foreach="tags"><li data-text="tag"></li></ul>
<script>new Stitch.DataBinder().bind('#p', Stitch.Observable.create({ tags: [{ id: 1, tag: 'a' }, { id: 2, tag: 'a' }] }));</script>
```
<!-- check: texts('#p li').join(',') === 'a,a' -->

## G99

Wrong:

```html throws
<ul id="p" data-foreach="rows"><li data-text="name"></li></ul>
<script>new Stitch.DataBinder().bind('#p', Stitch.Observable.create({ rows: [{ id: 1, name: 'a' }, null] }));</script>
```
Throws: `[Stitch E503]`

Right:

```html run
<ul id="p" data-foreach="rows"><li data-text="name"></li></ul>
<script>
const rows = [{ id: 1, name: 'a' }, null];
new Stitch.DataBinder().bind('#p', Stitch.Observable.create({ rows: rows.filter(r => r !== null) }));
</script>
```
<!-- check: count('#p li') === 1 -->

## G100

Wrong:

```html throws
<ul id="p" data-foreach="tags" data-key="id"><li data-text="$data"></li></ul>
<script>new Stitch.DataBinder().bind('#p', Stitch.Observable.create({ tags: ['a'] }));</script>
```
Throws: `[Stitch E504]`

Right:

```html run
<div id="p"><ul data-foreach="tags"><li data-text="$data"></li></ul></div>
<script>new Stitch.DataBinder().bind('#p', Stitch.Observable.create({ tags: ['a', 'b'] }));</script>
```
<!-- check: texts('#p li').join(',') === 'a,b' -->

## G101

Wrong:

```html throws
<ul id="p" data-foreach="rows" data-key=""><li data-text="name"></li></ul>
<script>new Stitch.DataBinder().bind('#p', Stitch.Observable.create({ rows: [{ sku: 'A1', name: 'a' }] }));</script>
```
Throws: `[Stitch E505]`

Right:

```html run
<ul id="p" data-foreach="rows" data-key="sku"><li data-text="name"></li></ul>
<script>new Stitch.DataBinder().bind('#p', Stitch.Observable.create({ rows: [{ sku: 'A1', name: 'a' }] }));</script>
```
<!-- check: text('#p li') === 'a' -->

## G102

Wrong:

```html throws
<ul id="p" data-key="sku"><li>x</li></ul>
<script>new Stitch.DataBinder().bind('#p', Stitch.Observable.create({}));</script>
```
Throws: `[Stitch E531]`

Right:

```html run
<ul id="p" data-foreach="rows" data-key="sku"><li data-text="name"></li></ul>
<script>new Stitch.DataBinder().bind('#p', Stitch.Observable.create({ rows: [{ sku: 'A1', name: 'a' }] }));</script>
```
<!-- check: text('#p li') === 'a' -->

## G103

Wrong:

```html throws
<ul id="p" data-foreach="rows" data-template="row"><li>inline</li></ul>
<template id="row"><li data-text="name"></li></template>
<script>new Stitch.DataBinder().bind('#p', Stitch.Observable.create({ rows: [{ id: 1, name: 'a' }] }));</script>
```
Throws: `[Stitch E516]`

Right:

```html run
<div id="p"><ul data-foreach="rows" data-template="row"></ul></div>
<template id="row"><li data-text="name"></li></template>
<script>new Stitch.DataBinder().bind('#p', Stitch.Observable.create({ rows: [{ id: 1, name: 'a' }] }));</script>
```
<!-- check: text('#p li') === 'a' -->

## G104

Wrong:

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

Right:

```html run
<ul id="p" data-foreach="rows" data-template="row"></ul>
<template id="row"><li data-text="name"></li></template>
<script>new Stitch.DataBinder().bind('#p', Stitch.Observable.create({ rows: [{ id: 1, name: 'a' }] }));</script>
```
<!-- check: text('#p li') === 'a' -->

## G105

Wrong:

```html throws
<div id="p"><ul data-foreach="rows"></ul></div>
<script>new Stitch.DataBinder().bind('#p', Stitch.Observable.create({ rows: ['a'] }));</script>
```
Throws: `[Stitch E512]`

Right:

```html run
<div id="p"><ul data-foreach="rows"><li data-text="$data"></li></ul></div>
<script>new Stitch.DataBinder().bind('#p', Stitch.Observable.create({ rows: ['a'] }));</script>
```
<!-- check: text('#p li') === 'a' -->

## G106

Wrong:

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

Right:

```html run
<select id="p" data-foreach="rows" data-default-text="Choose" data-default-value="0"><option data-text="$data"></option></select>
<script>new Stitch.DataBinder().bind('#p', Stitch.Observable.create({ rows: ['a'] }));</script>
```
<!-- check: texts('#p option').join(',') === 'Choose,a' && document.querySelector('#p option').value === '0' -->

## G107

Wrong:

```html throws
<ul id="p" data-foreach="items"><li><button data-click="save">x</button></li></ul>
<script>new Stitch.DataBinder().bind('#p', Stitch.Observable.create({ items: [{ id: 1 }], save() {} }));</script>
```
Throws: `[Stitch E401]`

```html throws
<ul id="p" data-foreach="items"><li><button data-click="save">x</button></li></ul>
<script>
const model = Stitch.Observable.create({ items: [], save() {} });
new Stitch.DataBinder().bind('#p', model); // an empty list: nothing to check yet
model.items.push({ id: 1 });               // the first row reports it
</script>
```
Throws: `[Stitch E401]`

Right:

```html run
<ul id="p" data-foreach="items"><li><button data-click="$root.save">x</button></li></ul>
<script>const model = Stitch.Observable.create({ items: [{ id: 1 }], saved: 0, save(item) { this.saved = item.id; } }); new Stitch.DataBinder().bind('#p', model);</script>
```
<!-- check: click('#p button') && model.saved === 1 -->

## G108

Wrong:

```html throws
<ul id="p" data-foreach="items"><li><button data-click="$root.save">x</button></li></ul>
<script>new Stitch.DataBinder().bind('#p', Stitch.Observable.create({ items: [] }));</script>
```
Throws: `[Stitch E406]`

Right:

```html run
<ul id="p" data-foreach="items"><li><button data-click="$root.save">x</button></li></ul>
<script>const model = Stitch.Observable.create({ items: [{ id: 1 }], saved: false, save() { this.saved = true; } }); new Stitch.DataBinder().bind('#p', model);</script>
```
<!-- check: click('#p button') && model.saved === true -->

## G109

Wrong:

```html throws
<button id="p" data-click="$parent.save">x</button>
<script>new Stitch.DataBinder().bind('#p', Stitch.Observable.create({ save() {} }));</script>
```
Throws: `[Stitch E403]`

Right:

```html run
<button id="p" data-click="save">x</button>
<script>const model = Stitch.Observable.create({ saved: false, save() { this.saved = true; } }); new Stitch.DataBinder().bind('#p', model);</script>
```
<!-- check: click('#p') && model.saved === true -->

## G110

Wrong:

```html throws
<div id="p" data-foreach="groups"><div><ul data-foreach="items"><li><button data-click="$parent.$parent.save">x</button></li></ul></div></div>
<script>new Stitch.DataBinder().bind('#p', Stitch.Observable.create({ groups: [{ id: 1, items: [{ id: 2 }] }], save() {} }));</script>
```
Throws: `[Stitch E110]`

Right:

```html run
<div id="p" data-foreach="groups"><div><ul data-foreach="items"><li><button data-click="$root.save">x</button></li></ul></div></div>
<script>const model = Stitch.Observable.create({ groups: [{ id: 1, items: [{ id: 2 }] }], saved: 0, save(item) { this.saved = item.id; } }); new Stitch.DataBinder().bind('#p', model);</script>
```
<!-- check: click('#p button') && model.saved === 2 -->

## G111

Wrong:

```html throws
<button id="p" data-click="$root">x</button>
<script>new Stitch.DataBinder().bind('#p', Stitch.Observable.create({ save() {} }));</script>
```
Throws: `[Stitch E109]`

Right:

```html run
<ul id="p" data-foreach="items"><li><button data-click="$root.save">x</button></li></ul>
<script>const model = Stitch.Observable.create({ items: [{ id: 1 }], saved: false, save() { this.saved = true; } }); new Stitch.DataBinder().bind('#p', model);</script>
```
<!-- check: click('#p button') && model.saved === true -->

## G112

Wrong:

```html throws
<ul id="p" data-foreach="rows"><li><input data-event="rowEvents"></li></ul>
<script>new Stitch.DataBinder().bind('#p', Stitch.Observable.create({ rows: [{ id: 1 }], rowEvents: { input: '$root.touch' }, touch() {} }));</script>
```
Throws: `[Stitch E201]`

Right:

```html run
<ul id="p" data-foreach="rows"><li><input data-event="$root.rowEvents"></li></ul>
<script>
const model = Stitch.Observable.create({ rows: [{ id: 1 }], touched: 0, rowEvents: { input: '$root.touch' }, touch(row) { this.touched = row.id; } });
new Stitch.DataBinder().bind('#p', model);
</script>
```
<!-- check: (document.querySelector('#p input').dispatchEvent(new Event('input', { bubbles: true })), model.touched === 1) -->

## G113

Wrong:

```html throws
<input id="p" data-event="onInput">
<script>new Stitch.DataBinder().bind('#p', Stitch.Observable.create({ onInput() {} }));</script>
```
Throws: `[Stitch E304]`

Right:

```html run
<input id="p" data-event="inputEvents">
<script>
const model = Stitch.Observable.create({ typed: false, inputEvents: { input: 'onInput' }, onInput() { this.typed = true; } });
new Stitch.DataBinder().bind('#p', model);
</script>
```
<!-- check: type('#p', 'x') && model.typed === true -->

## G114

Wrong:

```js throws
Stitch.Observable.create({ events: { input: () => {} } });
```
Throws: `[Stitch E707]`

Right:

```html run
<input id="p" data-event="events">
<script>
const model = Stitch.Observable.create({ touched: false, events: { input: 'touch' }, touch() { this.touched = true; } });
new Stitch.DataBinder().bind('#p', model);
</script>
```
<!-- check: type('#p', 'x') && model.touched === true -->

## G115

Wrong:

```html throws
<input id="p" data-event="events">
<script>new Stitch.DataBinder().bind('#p', Stitch.Observable.create({ events: { input: 'tuoch' }, touch() {} }));</script>
```
Throws: `[Stitch E401]`

Right:

```html run
<input id="p" data-event="events">
<script>
const model = Stitch.Observable.create({ touched: false, events: { input: 'touch' }, touch() { this.touched = true; } });
new Stitch.DataBinder().bind('#p', model);
</script>
```
<!-- check: type('#p', 'x') && model.touched === true -->

## G116

Wrong:

```html throws
<ul id="p" data-foreach="rows"><li data-text="name"></li></ul>
<script>
const model = Stitch.Observable.create({ rows: [{ id: 1, name: 'a' }] });
new Stitch.DataBinder().bind('#p', model);
const rows = model.rows;
rows.push({ id: 1, name: 'again' });
</script>
```
Throws: `[Stitch E502]`

Right:

```html run
<ul id="p" data-foreach="rows"><li data-text="name"></li></ul>
<script>
const model = Stitch.Observable.create({ rows: [{ id: 1, name: 'a' }] });
new Stitch.DataBinder().bind('#p', model);
const rows = model.rows;
rows[0] = { id: 1, name: 'again' };
</script>
```
<!-- check: texts('#p li').join(',') === 'again' -->

## G117

Wrong:

```html run
<ul id="p" data-foreach="rows"><li><input data-value="name"></li></ul>
<script>
const model = Stitch.Observable.create({
    rows: [{ id: 1, name: 'a' }],
    refresh(fresh) { this.rows = fresh; }
});
new Stitch.DataBinder().bind('#p', model);
window.before = document.querySelector('#p input');
model.refresh([{ id: 1, name: 'a' }]);
</script>
```
<!-- check: document.querySelector('#p input') !== window.before -->

Right:

```html run
<ul id="p" data-foreach="rows"><li><input data-value="name"></li></ul>
<script>
const model = Stitch.Observable.create({
    rows: [{ id: 1, name: 'a' }],
    refresh(fresh) { Object.assign(this.rows[0], fresh[0]); }
});
new Stitch.DataBinder().bind('#p', model);
window.before = document.querySelector('#p input');
model.refresh([{ id: 1, name: 'b' }]);
</script>
```
<!-- check: document.querySelector('#p input') === window.before && window.before.value === 'b' -->

## G118

Wrong:

```html throws
<ol id="p" data-foreach="rows"><li data-text="$index + 1"></li></ol>
<script>new Stitch.DataBinder().bind('#p', Stitch.Observable.create({ rows: ['a'] }));</script>
```
Throws: `[Stitch E102]`

Right:

```html run
<div id="p"><ol data-foreach="rows"><li data-text="$data"></li></ol></div>
<script>new Stitch.DataBinder().bind('#p', Stitch.Observable.create({ rows: ['a', 'b'] }));</script>
```
<!-- check: count('#p li') === 2 -->

## G119

Wrong:

```html run
<form id="f"><input data-value="q"><button data-click="go">Go</button></form>
<script>
window.addEventListener('submit', function (e) { window.unprevented = !e.defaultPrevented; e.preventDefault(); });
new Stitch.DataBinder().bind('#f', Stitch.Observable.create({ q: '', go() {} }));
</script>
```
<!-- check: click('#f button') && window.unprevented === true -->

Right:

```html run
<form id="f"><input data-value="q"><button type="button" data-click="go">Go</button></form>
<script>
window.submitted = false;
window.addEventListener('submit', function (e) { window.submitted = true; e.preventDefault(); });
const model = Stitch.Observable.create({ q: '', went: false, go() { this.went = true; } });
new Stitch.DataBinder().bind('#f', model);
</script>
```
<!-- check: click('#f button') && window.submitted === false && model.went === true -->

## G120

Wrong:

```html run
<form id="f"><input data-value="q"></form>
<script>
window.addEventListener('submit', function (e) { window.unprevented = !e.defaultPrevented; e.preventDefault(); });
new Stitch.DataBinder().bind('#f', Stitch.Observable.create({ q: '' }));
document.getElementById('f').requestSubmit(); // what Enter in the field does
</script>
```
<!-- check: window.unprevented === true -->

Right:

```html run
<form id="f" data-event="formEvents"><input data-value="q"></form>
<script>
window.addEventListener('submit', function (e) { window.prevented = e.defaultPrevented; e.preventDefault(); });
const model = Stitch.Observable.create({
    q: 'x',
    saved: false,
    formEvents: { submit: 'save' },
    save(model, event) { event.preventDefault(); this.saved = true; }
});
new Stitch.DataBinder().bind('#f', model);
document.getElementById('f').requestSubmit();
</script>
```
<!-- check: window.prevented === true && model.saved === true -->

## G121

Wrong:

```html run
<div id="p"><form data-event="formEvents"><input type="email" required data-value="email"><button type="submit">Join</button></form></div>
<script>
const model = Stitch.Observable.create({ email: '', ran: false, formEvents: { submit: 'save' }, save(model, event) { event.preventDefault(); this.ran = true; } });
new Stitch.DataBinder().bind('#p', model);
</script>
```
<!-- check: click('#p button') && model.ran === false -->

Right:

```html run
<div id="p"><form novalidate data-event="formEvents"><input type="email" required data-value="email"><button type="submit">Join</button></form></div>
<script>
const model = Stitch.Observable.create({ email: '', ran: false, formEvents: { submit: 'save' }, save(model, event) { event.preventDefault(); this.ran = true; } });
new Stitch.DataBinder().bind('#p', model);
</script>
```
<!-- check: click('#p button') && model.ran === true -->

## G122

Wrong:

```html run
<input id="p" data-value="email" data-event="events">
<script>
const model = Stitch.Observable.create({ email: '', touched: false, events: { change: 'touch' }, touch() { this.touched = true; } });
new Stitch.DataBinder().bind('#p', model);
const el = document.getElementById('p');
el.value = 'a';
el.dispatchEvent(new Event('input', { bubbles: true })); // a keystroke: input only
</script>
```
<!-- check: model.email === 'a' && model.touched === false -->

Right:

```html run
<input id="p" data-value="email" data-event="events">
<script>
const model = Stitch.Observable.create({ email: '', touched: false, events: { input: 'touch' }, touch() { this.touched = true; } });
new Stitch.DataBinder().bind('#p', model);
const el = document.getElementById('p');
el.value = 'a';
el.dispatchEvent(new Event('input', { bubbles: true }));
</script>
```
<!-- check: model.touched === true -->

## G123

Wrong:

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

Right:

```html run
<input id="p" data-value="address.city">
<script>
const model = Stitch.Observable.create({ address: { city: '' } });
new Stitch.DataBinder().bind('#p', model);
</script>
```
<!-- check: type('#p', 'Paris') && model.address.city === 'Paris' -->

## G124

Wrong:

```html run
<div id="p"><button data-click="save">save</button><p id="e" data-text="error"></p></div>
<script>
Stitch.onError(function (error, context) { window.got = context.source + ': ' + error.message; });
function api() { return Promise.reject(new Error('server said no')); }
const model = Stitch.Observable.create({ error: '', async save() { await api(); } });
new Stitch.DataBinder().bind('#p', model);
</script>
```
<!-- check: click('#p button') -->
<!-- check: tick().then(() => window.got === 'handler: server said no' && text('#e') === '') -->

Right:

```html run
<div id="p"><button data-click="save">save</button><p id="e" data-text="error"></p></div>
<script>
function api() { return Promise.reject(new Error('server said no')); }
const model = Stitch.Observable.create({
    error: '',
    async save() {
        try { await api(); } catch (e) { this.error = e.message; }
    }
});
new Stitch.DataBinder().bind('#p', model);
</script>
```
<!-- check: click('#p button') -->
<!-- check: tick().then(() => text('#e') === 'server said no') -->

## G125

Guidance only: whether `type="date"` is a date control depends on the browser engine; the engines the tests run (current Chromium, Firefox and WebKit builds) differ, so the failing half cannot be shown everywhere. The fix itself, `data-type="date"`, is executed by recipe 10 in `skills/stitch/references/recipes.md`.

## G126

Wrong:

```html throws
<script>new Stitch.DataBinder().bind('#later', Stitch.Observable.create({ t: 1 }));</script>
<p id="later" data-text="t"></p>
```
Throws: `[Stitch E602]`

Right:

```html run
<script>
document.addEventListener('DOMContentLoaded', function () {
    new Stitch.DataBinder().bind('#later', Stitch.Observable.create({ t: 1 }));
});
</script>
<p id="later" data-text="t"></p>
```
<!-- check: text('#later') === '1' -->

## G127

Wrong:

```html run
<p class="card" data-text="title"></p><p class="card" data-text="title"></p>
<script>
const model = Stitch.Observable.create({ title: 'T' });
const binder = new Stitch.DataBinder();
binder.bind('.card', model);
</script>
```
<!-- check: texts('.card').join(',') === 'T,' -->

Right:

```html run
<p class="card" data-text="title" data-title="A"></p><p class="card" data-text="title" data-title="B"></p>
<script>
const binder = new Stitch.DataBinder();
function cardModel(el) { return Stitch.Observable.create({ title: el.getAttribute('data-title') }); }
document.querySelectorAll('.card').forEach(el => binder.bind(el, cardModel(el)));
</script>
```
<!-- check: texts('.card').join(',') === 'A,B' -->

## G128

Wrong:

```html throws
<p id="p" data-text="title"></p>
<script>
const binder = new Stitch.DataBinder();
let model = Stitch.Observable.create({ title: 'a' });
binder.bind('#p', model);
model = Stitch.Observable.create({ title: 'b' });
binder.bind('#p', model);
</script>
```
Throws: `[Stitch E601]`

Right:

```html run
<p id="p" data-text="title"></p>
<script>
const binder = new Stitch.DataBinder();
binder.bind('#p', Stitch.Observable.create({ title: 'a' }));
binder.unbind('#p');
binder.bind('#p', Stitch.Observable.create({ title: 'b' }));
</script>
```
<!-- check: text('#p') === 'b' -->

## G129

Wrong:

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
<script>new Stitch.DataBinder().bind('#outer', Stitch.Observable.create({ title: 'T' }));</script>
```
Throws: `[Stitch E201]`

Right:

```html run
<div id="page"><span id="t" data-text="title"></span></div><div id="widget"><span id="n" data-text="name"></span></div>
<script>
new Stitch.DataBinder().bind('#page', Stitch.Observable.create({ title: 'T' }));
new Stitch.DataBinder().bind('#widget', Stitch.Observable.create({ name: 'N' }));
</script>
```
<!-- check: text('#t') === 'T' && text('#n') === 'N' -->

## G130

Wrong:

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

Right:

```html run
<p id="p" data-text="t"></p>
<script>
const binder = new Stitch.DataBinder();
const model = Stitch.Observable.create({ t: 1 });
binder.bind('#p', model);
binder.unbind('#p');
model.t = 2;
</script>
```
<!-- check: text('#p') === '1' -->

## G131

Wrong:

```html throws
<p id="p" data-text="t"></p>
<script>
const binder = new Stitch.DataBinder();
binder.dispose();
binder.bind('#p', Stitch.Observable.create({ t: 1 }));
</script>
```
Throws: `[Stitch E605]`

Right:

```html run
<p id="p" data-text="t"></p>
<script>
const old = new Stitch.DataBinder();
old.dispose();
const model = Stitch.Observable.create({ t: 1 });
new Stitch.DataBinder().bind('#p', model);
</script>
```
<!-- check: text('#p') === '1' -->

## G132

Wrong:

```html throws
<p id="p" data-text="t"></p>
<script>new Stitch.DataBinder().bind('#p', { t: 1 });</script>
```
Throws: `[Stitch E604]`

Right:

```html run
<p id="p" data-text="t"></p>
<script>new Stitch.DataBinder().bind('#p', Stitch.Observable.create({ t: 1 }));</script>
```
<!-- check: text('#p') === '1' -->

## G133

Wrong:

```html run
<p id="p" data-text="t"></p>
<script>
const model = Stitch.Observable.create({ t: 'old' });
new Stitch.DataBinder().bind('#p', model);
model.t = 'new';
window.sameTick = document.getElementById('p').textContent;
</script>
```
<!-- check: window.sameTick === 'old' -->

Right:

```html run
<p id="p" data-text="t"></p>
<script>
(async function () {
    const model = Stitch.Observable.create({ t: 'old' });
    new Stitch.DataBinder().bind('#p', model);
    model.t = 'new';
    await Promise.resolve();
    window.after = document.getElementById('p').textContent;
})();
</script>
```
<!-- check: window.after === 'new' -->

## G134

Wrong:

```html run
<button id="p" data-enabled="ok" data-click="go">go</button>
<script>
const model = Stitch.Observable.create({ ok: false, went: false, go() { this.went = true; } });
new Stitch.DataBinder().bind('#p', model);
model.ok = true;
document.getElementById('p').click(); // same tick: still disabled
</script>
```
<!-- check: model.went === false -->

Right:

```html run
<button id="p" data-enabled="ok" data-click="go">go</button>
<script>
(async function () {
    const model = window.model = Stitch.Observable.create({ ok: false, went: false, go() { this.went = true; } });
    new Stitch.DataBinder().bind('#p', model);
    model.ok = true;
    await Promise.resolve();
    document.getElementById('p').click();
})();
</script>
```
<!-- check: window.model.went === true -->

## G135

Wrong:

```html throws
<p id="p" data-text="t"></p>
<script>
new Stitch.DataBinder().bind('#p', Stitch.Observable.create({ t: 1 }));
Stitch.DataBinder.registerBinding('late', { bind() {} });
</script>
```
Throws: `[Stitch E621]`

Right:

```html run
<p id="p" data-late="t"></p>
<script>
Stitch.DataBinder.registerBinding('late', { bind(element, model, path) { element.title = String(model[path]); } });
new Stitch.DataBinder().bind('#p', Stitch.Observable.create({ t: 1 }));
</script>
```
<!-- check: attr('#p', 'title') === '1' -->

## G136

Wrong:

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

Right:

```html run
<button id="p" data-tooltip="Save changes">Save</button>
<script>
Stitch.DataBinder.registerBinding('tooltip', { value: 'literal', bind(element, model, text) { element.title = text; } });
new Stitch.DataBinder().bind('#p', Stitch.Observable.create({}));
</script>
```
<!-- check: attr('#p', 'title') === 'Save changes' -->

## G137

Wrong:

```js throws
Stitch.DataBinder.registerBinding('myTooltip', { bind() {} });
```
Throws: `[Stitch E623]`

Right:

```js run
Stitch.DataBinder.registerBinding('my-tooltip', { bind() {} });
window.result = 'registered';
```
<!-- check: window.result === 'registered' -->

## G138

Wrong:

```js throws
Stitch.DataBinder.registerBinding('badge', { bind() {} });
Stitch.DataBinder.registerBinding('badge', { bind() {} });
```
Throws: `[Stitch E627]`

Right:

```js run
Stitch.DataBinder.registerBinding('badge', { bind() {} });
Stitch.DataBinder.registerBinding('badge-count', { bind() {} });
window.result = 'two names';
```
<!-- check: window.result === 'two names' -->

## G139

Wrong:

```html run
<p id="p" data-upper="name"></p>
<script>
Stitch.DataBinder.registerBinding('upper', {
    bind(element, model, path, context) {
        context.reactiveSystem.effect(function () { element.textContent = String(model[path]).toUpperCase(); });
    }
});
const before = Stitch.debug.stats().effects;
const binder = new Stitch.DataBinder();
binder.bind('#p', Stitch.Observable.create({ name: 'ada' }));
binder.dispose();
window.left = Stitch.debug.stats().effects - before;
</script>
```
<!-- check: window.left === 1 -->

Right:

```html run
<p id="p" data-upper="name"></p>
<script>
Stitch.DataBinder.registerBinding('upper', {
    bind(element, model, path, context) {
        const effect = context.reactiveSystem.effect(function () { element.textContent = String(model[path]).toUpperCase(); });
        context.binder._trackCleanup(element, () => context.reactiveSystem.cleanup(effect));
    }
});
const before = Stitch.debug.stats().effects;
const binder = new Stitch.DataBinder();
binder.bind('#p', Stitch.Observable.create({ name: 'ada' }));
window.shown = document.getElementById('p').textContent;
binder.dispose();
window.left = Stitch.debug.stats().effects - before;
</script>
```
<!-- check: window.shown === 'ADA' && window.left === 0 -->

## G140

Wrong:

```html run
<p id="p" data-raw="value"></p>
<script>
Stitch.DataBinder.registerBinding('raw', {
    bind(element, model, path) { const value = model[path]; element.innerHTML = value; }
});
new Stitch.DataBinder().bind('#p', Stitch.Observable.create({ value: '<b>from data</b>' }));
</script>
```
<!-- check: count('#p b') === 1 -->

Right:

```html run
<p id="p" data-raw="value"></p>
<script>
Stitch.DataBinder.registerBinding('raw', {
    bind(element, model, path) { const value = model[path]; element.textContent = value; }
});
new Stitch.DataBinder().bind('#p', Stitch.Observable.create({ value: '<b>from data</b>' }));
</script>
```
<!-- check: count('#p b') === 0 && text('#p') === '<b>from data</b>' -->

## G141

Wrong:

```js throws
const fn = function () {};
Stitch.onError(fn);
Stitch.onError(fn2);
function fn2() {}
```
Throws: `[Stitch E902]`

Right:

```js run
const remove = Stitch.onError(function () {});
remove();
const removeSecond = Stitch.onError(function () {});
window.result = typeof removeSecond;
```
<!-- check: window.result === 'function' -->

## G142

Wrong:

```html run
<p id="p" data-text="nmae"></p>
<script>
const binder = new Stitch.DataBinder();
const model = Stitch.Observable.create({ name: 'Ada' });
try { binder.bind('#p', model); } catch (e) {}
</script>
```
<!-- check: text('#p') === '' -->

Right:

```html run
<p id="p" data-text="name"></p>
<script>
const binder = new Stitch.DataBinder();
const model = Stitch.Observable.create({ name: 'Ada' });
binder.bind('#p', model);
</script>
```
<!-- check: text('#p') === 'Ada' -->

## G143

Wrong:

```html run
<p id="p" data-text="nmae"></p>
<script>
let matched = null;
try { new Stitch.DataBinder().bind('#p', Stitch.Observable.create({ name: 'Ada' })); } catch (thrown) {
    // the same error after a future rewording of its message
    const error = { message: thrown.message.replace('is not a property', 'does not exist on') };
    if (/is not a property/.test(error.message)) matched = true; else matched = false;
}
</script>
```
<!-- check: matched === false -->

Right:

```html run
<p id="p" data-text="nmae"></p>
<script>
let matched = null;
try { new Stitch.DataBinder().bind('#p', Stitch.Observable.create({ name: 'Ada' })); } catch (error) {
    matched = error.message.startsWith('[Stitch E201]');
}
</script>
```
<!-- check: matched === true -->
