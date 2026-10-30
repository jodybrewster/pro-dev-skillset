const { app, BrowserWindow, shell } = require('electron');
const path = require('path');

const ALLOWED_HOSTS = new Set(['example.com']);

function openSafely(rawUrl) {
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return false;
  }
  if (parsed.protocol !== 'https:' || !ALLOWED_HOSTS.has(parsed.hostname)) {
    return false;
  }
  shell.openExternal(parsed.toString());
  return true;
}

function createWindow() {
  const win = new BrowserWindow({
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    },
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    openSafely(url);
    return { action: 'deny' };
  });

  win.webContents.on('will-navigate', (event, url) => {
    if (new URL(url).protocol !== 'file:') {
      event.preventDefault();
    }
  });

  win.loadFile('index.html');
}

app.whenReady().then(createWindow);
