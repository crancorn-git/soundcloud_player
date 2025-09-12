// main.js — Widget mode + Robust Likes Importer + Silent Auto-Updater (with logging)
const {
  app, BrowserWindow, Tray, Menu, nativeImage,
  globalShortcut, Notification, ipcMain
} = require('electron');
const path = require('path');

// === Auto-update + logging ===
const { autoUpdater } = require('electron-updater');
const log = require('electron-log');
log.transports.file.level = 'info';
autoUpdater.logger = log;

// Match build.appId for clean shortcuts/toasts/updates on Windows
app.setAppUserModelId('com.cran.soundcloudplayer');

// === Optional window-state (safe import)
let WindowStateKeeper = null;
try { WindowStateKeeper = require('electron-window-state'); } catch { /* optional */ }

let mainWindow = null;
let tray = null;
let likesWin = null;

// Renderer behavior flags
process.env.SOUND_MODE = 'widget';
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

// === Early, silent updater check (runs only when packaged) ===
async function checkForUpdatesEarly() {
  if (!app.isPackaged) {
    log.info('Updater: skipped (dev mode)');
    return;
  }
  try {
    // If you ever want beta/dev: autoUpdater.allowPrerelease = true;
    autoUpdater.autoDownload = true;

    // Events
    autoUpdater.on('checking-for-update', () => log.info('Updater: checking'));
    autoUpdater.on('update-available', (info) => log.info('Updater: available', info && info.version));
    autoUpdater.on('update-not-available', () => log.info('Updater: not available'));
    autoUpdater.on('download-progress', (p) => log.info(`Updater: ${Math.round(p.percent)}% @ ${Math.round(p.bytesPerSecond / 1024)}KB/s`));
    autoUpdater.on('error', (err) => log.error('Updater error:', err));
    autoUpdater.on('update-downloaded', (info) => {
      log.info('Updater: downloaded', info && info.version);
      // Install immediately and restore state; silent flow
      autoUpdater.quitAndInstall(false, true);
    });

    await autoUpdater.checkForUpdates();
  } catch (e) {
    log.error('Updater check failed:', e);
  }
}

// Optional manual trigger from renderer (e.g., “Check for Updates…” menu)
ipcMain.handle('app:checkForUpdates', async () => {
  if (!app.isPackaged) return { ok: false, msg: 'Running in dev mode.' };
  try {
    await autoUpdater.checkForUpdates();
    return { ok: true };
  } catch (e) {
    return { ok: false, msg: String(e) };
  }
});

function createWindow() {
  // Bigger defaults
  const defaultBounds = { width: 1280, height: 860 };
  const enforcedMin   = { width: 1100, height: 760 };

  // Use a NEW window-state file so new defaults take effect for everyone
  const state = WindowStateKeeper
    ? WindowStateKeeper({
        defaultWidth:  defaultBounds.width,
        defaultHeight: defaultBounds.height,
        file: 'window-state-v2.json'     // <— bump file name to reset saved size
      })
    : { x: undefined, y: undefined, width: defaultBounds.width, height: defaultBounds.height, manage(){} };

  mainWindow = new BrowserWindow({
    x: state.x,
    y: state.y,
    width: state.width,
    height: state.height,
    minWidth: enforcedMin.width,
    minHeight: enforcedMin.height,
    backgroundColor: '#0b0b0b',
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: true,
      partition: 'persist:soundcloud',
      devTools: false,
      webSecurity: true
    }
  });

  // Let window-state manage position/size persistence
  state.manage?.(mainWindow);

  mainWindow.loadFile(path.join(__dirname, 'player.html'));

  mainWindow.once('ready-to-show', () => {
    // If a tiny legacy state slipped through, enforce our roomy minimums on first show
    const [w, h] = mainWindow.getSize();
    if (w < enforcedMin.width || h < enforcedMin.height) {
      mainWindow.setSize(
        Math.max(w, enforcedMin.width),
        Math.max(h, enforcedMin.height),
        false
      );
    }
    mainWindow.show();
  });

  mainWindow.on('close', (e) => {
    if (!app.isQuiting) { e.preventDefault(); mainWindow.hide(); }
  });

  setupTray();
  setupGlobalShortcuts();
}

// === Tray & media keys ===
function setupTray() {
  try {
    const iconPath = process.platform === 'win32'
      ? path.join(__dirname, 'build', 'icon.ico')
      : path.join(__dirname, 'build', 'icon.png');
    const trayIcon = nativeImage.createFromPath(iconPath);
    tray = new Tray(trayIcon.isEmpty() ? nativeImage.createEmpty() : trayIcon);

    const template = [
      { label: 'Show / Hide', click: () => (mainWindow?.isVisible() ? mainWindow.hide() : mainWindow?.show()) },
      { type: 'separator' },
      { label: 'Play/Pause', click: () => mainWindow?.webContents.send('media:toggle') },
      { label: 'Next',       click: () => mainWindow?.webContents.send('media:next') },
      { label: 'Previous',   click: () => mainWindow?.webContents.send('media:prev') },
      { type: 'separator' },
      { label: 'Import Likes…', click: () => importLikesFlow() },
      { label: 'Fetch Likes Now', click: () => global.collectLikesNow && global.collectLikesNow() },
      { type: 'separator' },
      { label: 'Check for Updates…', click: async () => { try { await autoUpdater.checkForUpdates(); } catch {} } },
      { type: 'separator' },
      { label: 'Quit', click: () => { app.isQuiting = true; app.quit(); } }
    ];
    tray.setToolTip('SoundCloud Player');
    tray.setContextMenu(Menu.buildFromTemplate(template));
    tray.on('click', () => (mainWindow?.isVisible() ? mainWindow.hide() : mainWindow?.show()));
  } catch (e) { console.error('Tray setup failed:', e); }
}

function setupGlobalShortcuts() {
  const map = [
    ['MediaPlayPause',  () => mainWindow?.webContents.send('media:toggle')],
    ['MediaNextTrack',  () => mainWindow?.webContents.send('media:next')],
    ['MediaPreviousTrack', () => mainWindow?.webContents.send('media:prev')]
  ];
  map.forEach(([key, handler]) => { try { globalShortcut.register(key, handler); } catch {} });
}

// === Toasts from renderer ===
ipcMain.on('track:changed', (_evt, { title }) => {
  if (title && Notification.isSupported()) {
    new Notification({ title: 'Now Playing', body: title, silent: true }).show();
  }
});

// === Likes Importer (robust) ===
async function importLikesFlow() {
  const part = 'persist:soundcloud';

  if (likesWin && !likesWin.isDestroyed()) {
    likesWin.show(); likesWin.focus(); return;
  }

  likesWin = new BrowserWindow({
    width: 1100, height: 800, backgroundColor: '#111',
    autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true, partition: part, devTools: false }
  });

  likesWin.on('closed', () => { likesWin = null; });

  const m = Menu.buildFromTemplate([
    { label: 'File', submenu: [
      { label: 'Fetch Likes Now', click: () => collectLikesNow() },
      { role: 'close' }
    ] }
  ]);
  likesWin.setMenu(m);

  likesWin.loadURL('https://soundcloud.com/you/likes');

  const canScrape = (urlStr) => {
    try { const u = new URL(urlStr); return u.hostname.endsWith('soundcloud.com') && /\/you\/likes\/?$/.test(u.pathname); }
    catch { return false; }
  };

  async function scrape() {
    if (!likesWin || likesWin.isDestroyed()) return [];
    const code = `
      (function() {
        const delay = (ms)=> new Promise(r=>setTimeout(r,ms));
        async function autoscroll(rounds=10){
          for (let i=0;i<rounds;i++){ window.scrollTo(0, document.body.scrollHeight); await delay(600); }
          await delay(300); window.scrollTo(0,0);
        }
        function collect(){
          const anchors = Array.from(document.querySelectorAll('a')).map(a=>a.href).filter(Boolean)
            .map(h=>h.split('?')[0])
            .filter(h=>/^https:\\/\\/soundcloud\\.com\\/[^\\/]+\\/[^\\/]+$/.test(h))
            .filter(h=>!/\\/sets\\//.test(h));
          return Array.from(new Set(anchors));
        }
        return (async () => { await autoscroll(12); return collect(); })();
      })();
    `;
    try { const urls = await likesWin.webContents.executeJavaScript(code, true); return Array.isArray(urls) ? urls : []; }
    catch (e) { console.error('Scrape error:', e); return []; }
  }

  async function collectLikesNow() {
    if (!likesWin || likesWin.isDestroyed()) return;
    const currentURL = likesWin.webContents.getURL();
    if (!canScrape(currentURL)) {
      likesWin.webContents.executeJavaScript(`
        (function(){ const el=document.createElement('div');
          el.style.position='fixed'; el.style.zIndex=2147483647; el.style.left='50%'; el.style.transform='translateX(-50%)';
          el.style.bottom='16px'; el.style.background='#22c55e'; el.style.color='#031f10';
          el.style.padding='10px 14px'; el.style.borderRadius='8px'; el.style.fontFamily='system-ui,Segoe UI,Inter,Arial';
          el.style.boxShadow='0 6px 20px rgba(0,0,0,.35)';
          el.textContent='Open your Likes page, scroll a bit, then click “Fetch Likes Now” again.'; document.body.appendChild(el);
          setTimeout(()=>el.remove(), 8000); })();
      `);
      return;
    }

    const urls = await scrape();
    if (urls.length) {
      mainWindow?.webContents.send('likes:loaded', { urls });
    } else {
      likesWin.webContents.executeJavaScript(`
        (function(){ const el=document.createElement('div'); el.style.position='fixed'; el.style.zIndex=2147483647;
          el.style.right='16px'; el.style.bottom='16px'; el.style.background='#1f1f1f'; el.style.color='#fff';
          el.style.padding='10px 14px'; el.style.border='1px solid #333'; el.style.borderRadius='8px';
          el.style.fontFamily='system-ui,Segoe UI,Inter,Arial';
          el.textContent='Didn\\'t catch any tracks yet. Scroll further, then try “Fetch Likes Now”.';
          document.body.appendChild(el); setTimeout(()=>el.remove(), 8000); })();
      `);
    }
  }

  global.collectLikesNow = collectLikesNow;

  likesWin.webContents.on('did-navigate', (_e, url) => { if (canScrape(url)) setTimeout(collectLikesNow, 1200); });
  likesWin.webContents.on('did-navigate-in-page', (_e, url) => { if (canScrape(url)) setTimeout(collectLikesNow, 1200); });
  likesWin.webContents.on('dom-ready', () => {
    const url = likesWin.webContents.getURL();
    if (canScrape(url)) setTimeout(collectLikesNow, 1500);
  });
}

ipcMain.handle('likes:import', async () => { await importLikesFlow(); return true; });

// === App lifecycle ===
app.whenReady().then(async () => {
  // start update check ASAP; window shows while download happens
  await checkForUpdatesEarly();
  createWindow();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
  else mainWindow?.show();
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});
