set -e
mkdir -p src
cat > src/last.js <<'JS'
export function lastN(items, n) {
  return items.slice(items.length - n - 1);
}
JS
git init -q . && git config user.name "Sam Rivera" && git config user.email sam@example.com && git add -A && git -c user.email=e@e -c user.name=e commit -qm init
