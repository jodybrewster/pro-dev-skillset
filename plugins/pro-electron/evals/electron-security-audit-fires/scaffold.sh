set -e
cat > package.json <<'JSON'
{ "name": "demo-app", "version": "1.0.0", "main": "main.js", "devDependencies": { "electron": "^45.0.0" } }
JSON
cat > main.js <<'JS'
const { app, BrowserWindow, shell, ipcMain } = require('electron');

function createWindow() {
  const win = new BrowserWindow({
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      sandbox: false,
    },
  });
  win.loadFile('index.html');
}

ipcMain.on('open-link', (event, url) => {
  shell.openExternal(url);
});

app.whenReady().then(createWindow);
JS
cat > index.html <<'HTML'
<!doctype html>
<html><head><meta charset="utf-8" /><title>Demo</title></head>
<body><h1>Demo</h1><script src="./renderer.js"></script></body></html>
HTML
