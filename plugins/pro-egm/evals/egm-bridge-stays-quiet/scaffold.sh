set -e
echo "# demo" > README.md
git init -q . && git add -A && git -c user.email=e@e -c user.name=e commit -qm init
