const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const Database = require('better-sqlite3');

const db = new Database(path.join(app.getPath('userData'), 'notes.db'));
db.exec('CREATE TABLE IF NOT EXISTS notes (id INTEGER PRIMARY KEY, body TEXT)');

function createWindow() {
  const win = new BrowserWindow({
    webPreferences: { preload: path.join(__dirname, 'preload.js') },
  });

  win.loadFile(path.join(__dirname, 'index.html'));
}

ipcMain.on('note:save', (_event, payload) => {
  const body = Buffer.from(payload, 'base64').toString('utf8');
  db.prepare('INSERT INTO notes (body) VALUES (?)').run(body);
});

app.whenReady().then(createWindow);
