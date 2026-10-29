import { createCart } from "./cart.js";
import { total } from "./pricing.js";

export function orderTotal(lines) {
  const cart = createCart();
  for (const [name, priceCents, qty] of lines) cart.add(name, priceCents, qty);
  return total(cart);
}
