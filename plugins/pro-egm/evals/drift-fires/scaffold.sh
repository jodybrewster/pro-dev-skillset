set -e
mkdir -p docs/designs
cat > docs/designs/rate-limiter.md <<'MD'
# Design: Rate limiter

## Behavior

1. Each API key may make 100 requests per minute.
2. Over the limit, the server returns 429 with a Retry-After header.
3. Limits are kept in memory per process.
MD
mkdir -p src
cat > src/limiter.js <<'JS'
export function allow(store, key, now) {
  const hits = (store[key] || []).filter((t) => now - t < 60000);
  hits.push(now);
  store[key] = hits;
  return hits.length <= 100;
}
JS
git init -q . && git config user.name "Sam Rivera" && git config user.email sam@example.com && git add -A && git -c user.email=e@e -c user.name=e commit -qm init
