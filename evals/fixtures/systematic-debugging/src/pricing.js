export function subtotal(cart) {
  return cart.items.reduce((sum, i) => sum + i.priceCents * i.qty, 0);
}

export function total(cart, taxRate = 0.1) {
  return Math.round(subtotal(cart) * (1 + taxRate));
}
