const EMPTY = [];

export function createCart(items = EMPTY) {
  return {
    items,
    add(name, priceCents, qty = 1) {
      items.push({ name, priceCents, qty });
    },
  };
}
