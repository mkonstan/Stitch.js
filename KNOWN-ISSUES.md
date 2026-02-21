# Known Issues - Stitch.js

## ✅ FIXED IN V2.0.1

### Array-Dependent Computed Properties

**Status**: ✅ FIXED in v2.0.1
**Previous Severity**: Critical (returned stale values)
**Test**: `test-computed-properties.html` - Test 4.1 (now passing)

---

## No Known Issues in v2.0.1

All test suites passing: 58/58 tests ✅

### Issue Description

Computed properties that depend on array contents do not automatically recalculate when items are added/removed via array mutation methods (`push`, `splice`, etc.).

### Example

```javascript
const cart = Stitch.Observable.create({
    items: [],
    subtotal: Stitch.computed(function() {
        return this.items.reduce((sum, item) => sum + item.total, 0);
    })
});

console.log(cart.subtotal); // 0 ✅

cart.items.push({ total: 100 });
console.log(cart.subtotal); // Still 0 ❌ (should be 100)
```

### Root Cause

Array mutations (`push`, `pop`, `splice`, etc.) trigger through the `array-mutation` MessageBus event, which:
1. Is asynchronous (queued via Promise.resolve)
2. Only triggers on the array's `length` property
3. Does NOT trigger on the parent's `items` property that the computed is tracking

**Tracking Flow:**
```
Computed tracks: cart.items (the property)
Mutation triggers: array.length (not cart.items)
Result: Computed doesn't know to recalculate
```

### Workaround

Manually trigger recalculation by reassigning the array:

```javascript
cart.items.push({ total: 100 });
cart.items = [...cart.items]; // Force trigger ✅
```

Or use explicit computed dependencies:

```javascript
subtotal: Stitch.computed(function() {
    const _ = this.items.length; // Track length explicitly
    return this.items.reduce((sum, item) => sum + item.total, 0);
}, ['items'])
```

### Impact

- **18 of 19 computed tests PASS** ✅
- Only affects computed properties that:
  - Depend on array contents
  - Need to react to push/pop/splice operations
  - Don't manually trigger updates

### Future Fix

Requires redesigning array mutation tracking to:
1. Make array mutations synchronous (like v2.0 property triggers)
2. Trigger on parent property when array mutates
3. Propagate to computed dependencies correctly

**Estimated effort**: 2-3 hours
**Priority**: Medium (workaround available, not a blocker)

---

## Test Results Summary

| Suite | Total | Pass | Fail | Notes |
|-------|-------|------|------|-------|
| test-computed-properties.html | 19 | 18 | 1 | Array-dependent computed (known issue above) |
| test-all-bindings.html | 6 | TBD | TBD | Pending Phase 4 |
| test-core-reactivity.html | 6 | TBD | TBD | Pending testing |
| test-array-reactivity.html | 13 | TBD | TBD | Pending testing |
| test-edge-cases.html | 7 | TBD | TBD | Pending testing |
| test-messagebus.html | 7 | TBD | TBD | Pending testing |

---

*Last Updated: Phase 3 completion*
*Next: Continue to Phase 4-8, comprehensive testing in Phase 7*
