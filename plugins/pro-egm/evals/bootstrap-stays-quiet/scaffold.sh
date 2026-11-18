set -e
cat > package.json <<'JSON'
{
  "name": "tinydate",
  "version": "1.0.0",
  "main": "index.js"
}
JSON
cat > index.js <<'JS'
export function format(d) {
  return d.toISOString().slice(0, 10);
}
JS
git init -q . && git config user.name "Sam Rivera" && git config user.email sam@example.com && git add -A && git -c user.email=e@e -c user.name=e commit -qm init
