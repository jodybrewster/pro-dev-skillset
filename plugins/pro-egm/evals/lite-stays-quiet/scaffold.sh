set -e
mkdir -p src
cat > src/form.html <<'HTML'
<form>
  <button type="submit">Sumbit</button>
</form>
HTML
git init -q . && git config user.name "Sam Rivera" && git config user.email sam@example.com && git add -A && git -c user.email=e@e -c user.name=e commit -qm init
