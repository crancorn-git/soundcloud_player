// preload.js — bridge for media keys and likes import
const { contextBridge, ipcRenderer } = require('electron');

// Media commands from tray / global keys → player.html
ipcRenderer.on('media:toggle', () => window.postMessage({ type: 'WIDGET_TOGGLE' }, '*'));
ipcRenderer.on('media:next',   () => window.postMessage({ type: 'WIDGET_NEXT' }, '*'));
ipcRenderer.on('media:prev',   () => window.postMessage({ type: 'WIDGET_PREV' }, '*'));

// Likes loaded from importer → player.html
ipcRenderer.on('likes:loaded', (_evt, payload) => {
  window.postMessage({ type: 'LIKES_LOADED', ...payload }, '*');
});

// Renderer asks main to start likes import
contextBridge.exposeInMainWorld('electronAPI', {
  importLikes: () => ipcRenderer.invoke('likes:import')
});

// Track toast relay
window.addEventListener('message', (e) => {
  const msg = e.data;
  if (msg && msg.type === 'TRACK_CHANGED' && msg.title) {
    ipcRenderer.send('track:changed', { title: msg.title });
  }
}, false);
