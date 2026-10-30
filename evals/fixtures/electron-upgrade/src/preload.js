const { contextBridge, ipcRenderer } = require('electron');

// Encode a note body for the main process and give the UI a tick to settle first.
function saveNote(text) {
  const payload = Buffer.from(text, 'utf8').toString('base64');
  setImmediate(() => ipcRenderer.send('note:save', payload));
}

contextBridge.exposeInMainWorld('app', { version: '1.0.0', saveNote });
