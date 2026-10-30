const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  openLink: (url) => ipcRenderer.send('open-link', url),
});
