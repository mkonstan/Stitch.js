# A run block whose check does not hold

```html run
<p id="out" data-text="name"></p>
<script>
  new Stitch.DataBinder().bind('#out', Stitch.Observable.create({ name: 'Ada' }));
</script>
```
<!-- check: text('#out') === 'Grace' -->
