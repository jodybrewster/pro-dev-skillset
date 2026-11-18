set -e
mkdir -p src/orders
cat > src/orders/create.js <<'JS'
export function createOrder(items) {
  return { id: Date.now(), items };
}
JS
mkdir -p src/orders
cat > src/orders/total.js <<'JS'
export function total(order) {
  return order.items.reduce((s, i) => s + i.price * i.qty, 0);
}
JS
mkdir -p src/billing
cat > src/billing/invoice.js <<'JS'
import { total } from '../orders/total.js';
export function invoice(order) {
  return { orderId: order.id, due: total(order) };
}
JS
git init -q . && git config user.name "Sam Rivera" && git config user.email sam@example.com && git add -A && git -c user.email=e@e -c user.name=e commit -qm init
