const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  accountStatus: () => ipcRenderer.invoke('account:status'),
  accountLogin: () => ipcRenderer.invoke('account:login'),
  accountLogout: () => ipcRenderer.invoke('account:logout'),
  searchTracks: (q) => ipcRenderer.invoke('search:tracks', q),
  importAll: () => ipcRenderer.invoke('import:all'),
  openExternal: (url) => ipcRenderer.invoke('app:openExternal', url),
  
  // Window Controls
  minimize: () => ipcRenderer.send('win:minimize'),
  maximize: () => ipcRenderer.send('win:maximize'),
  close: () => ipcRenderer.send('win:close')
});

contextBridge.exposeInMainWorld('importer', {
  onStatus: (cb) => ipcRenderer.on('import:status', (_e, v) => cb(v)),
  onProgress: (cb) => ipcRenderer.on('import:progress', (_e, v) => cb(v)),
  onDone: (cb) => ipcRenderer.on('import:done', (_e, v) => cb(v)),
  onError: (cb) => ipcRenderer.on('import:error', (_e, v) => cb(v)),
});

contextBridge.exposeInMainWorld('app', {
  checkForUpdates: () => ipcRenderer.invoke('app:checkForUpdates')
});

// Events
ipcRenderer.on('library:merge', (_event, data) => {
  window.postMessage({ type: 'LIBRARY_MERGE', ...data }, '*');
});
ipcRenderer.on('media:toggle', () => window.postMessage({ type: 'MEDIA_TOGGLE' }, '*'));
ipcRenderer.on('media:next', () => window.postMessage({ type: 'MEDIA_NEXT' }, '*'));
ipcRenderer.on('media:prev', () => window.postMessage({ type: 'MEDIA_PREV' }, '*'));