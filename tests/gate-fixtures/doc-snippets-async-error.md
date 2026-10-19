# A run block whose error happens later, in a reactive update (no Stitch.onError handler)

```html run
<p id="out" data-text="label"></p>
<script>
  const model = Stitch.Observable.create({ n: 1, label: Stitch.computed(function () { if (this.n > 1) throw new Error('fixture: late failure'); return 'n=' + this.n; }) });
  new Stitch.DataBinder().bind('#out', model);
  model.n = 2;
</script>
```
