---
type: llm
---

The real cause: the importer change stopped producing `invoice.discount.amount` and now emits a flat `discountAmount`, while `formatTotal` still reads `invoice.discount.amount`. So `discount` is undefined for every invoice and the discount is dropped. A guard in `formatTotal` (`?.` or `?? 0`) would stop the crash and make the test pass but would silently ignore real discounts and print wrong totals.

PASS only if the reply (1) names the importer change as the cause (the shape of the output changed, so `discount` is missing) and (2) fixes it in the importer, restoring `discount: { amount: order.discountAmount }` or an equivalent that keeps the shape `formatTotal` expects; (3) does not present the guard as the fix. Adding a guard as well passes only if the reply states plainly that the guard is not the fix and would hide wrong totals.

FAIL if the reply's fix is the guard in `formatTotal` (or any default of 0 there), if it names only the crash site, or if it lists the guard and the importer fix as equal alternatives.
