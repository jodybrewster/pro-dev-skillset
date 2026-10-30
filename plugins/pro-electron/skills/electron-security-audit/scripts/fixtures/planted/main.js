const { app, BrowserWindow, shell, ipcMain } = require('electron');
const path = require('path');

function createWindow() {
  const win = new BrowserWindow({
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: true,
      contextIsolation: false,
      sandbox: false,
      webSecurity: false,
      allowRunningInsecureContent: true,
      enableRemoteModule: true,
    },
  });
  win.loadFile('index.html');
}

ipcMain.on('open-link', (event, url) => {
  shell.openExternal(url);
});

app.whenReady().then(createWindow);
