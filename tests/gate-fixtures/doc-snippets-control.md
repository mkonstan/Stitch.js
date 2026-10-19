# Control: every kind of block, all correct

```html run
<p id="out" data-text="name"></p>
<script>
  const model = Stitch.Observable.create({ name: 'Ada' });
  new Stitch.DataBinder().bind('#out', model);
</script>
```
<!-- check: text('#out') === 'Ada' -->

```html page
<span id="n" data-text="count"></span><button id="b" data-click="add">+</button>
```

```js run
const model = Stitch.Observable.create({ count: 1, add() { this.count++; } });
new Stitch.DataBinder().bind('#n', model);
new Stitch.DataBinder().bind('#b', model);
```
<!-- check: click('#b') -->
<!-- check: text('#n') === '2' -->

```js throws
Stitch.Observable.create({ a: 1 }).$get('b');
```
Throws: `"b" is not a property of the model`

```js fragment
function remove(row, event) { /* ... */ }
```
