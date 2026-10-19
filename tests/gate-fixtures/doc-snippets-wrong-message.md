# A throws block whose message differs from the documented one

```js throws
Stitch.Observable.create({ a: 1 }).$get('b');
```
Throws: `a message Stitch never wrote`
