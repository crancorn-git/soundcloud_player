// main.js - Electron Main Process
const { app, BrowserWindow, Tray, Menu, nativeImage, globalShortcut, Notification, ipcMain, shell, session } = require('electron');
const path = require('path');
const { autoUpdater } = require('electron-updater');
const log = require('electron-log');

// Setup Logging
log.transports.file.level = 'info';
autoUpdater.logger = log;

// AUTH: Load token from local file (ignored by git)
let token = '';
try {
  const auth = require('./auth');
  token = auth.GH_TOKEN;
} catch (e) {
  log.warn('No auth.js found. Auto-updates may fail.');
}
process.env.GH_TOKEN = token;

// Config
app.setAppUserModelId('com.cran.crancloudplayer');
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

// Globals
let mainWindow = null;
let tray = null;
let hiddenWin = null;
let authWin = null;

// Persistence ID for cookies
const SC_PARTITION = 'persist:soundcloud';

/* --- WINDOW MANAGEMENT --- */
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 1000,
    minHeight: 700,
    backgroundColor: '#000000',
    title: "CranCloud Player",
    frame: false, // FRAMELESS WINDOW
    titleBarStyle: 'hidden', // Use custom drag region
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
      partition: SC_PARTITION,
      webSecurity: true,
      backgroundThrottling: false
    }
  });

  const distPath = path.join(__dirname, 'dist', 'index.html');
  mainWindow.loadFile(distPath).catch(e => console.error('Failed to load app:', e));

  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.on('close', (e) => {
    if (!app.isQuiting) {
      e.preventDefault();
      mainWindow.hide();
    }
  });

  setupTray();
  setupShortcuts();
}

function setupTray() {
  try {
    const iconName = process.platform === 'win32' ? 'icon.ico' : 'icon.png';
    const iconPath = path.join(__dirname, 'build', iconName);
    const img = nativeImage.createFromPath(iconPath);
    tray = new Tray(img.isEmpty() ? nativeImage.createEmpty() : img);

    const menu = Menu.buildFromTemplate([
      { label: 'Show Player', click: () => mainWindow?.show() },
      { type: 'separator' },
      { label: 'Play/Pause', click: () => mainWindow?.webContents.send('media:toggle') },
      { label: 'Next Track', click: () => mainWindow?.webContents.send('media:next') },
      { type: 'separator' },
      { label: 'Quit', click: () => { app.isQuiting = true; app.quit(); } }
    ]);
    tray.setToolTip('CranCloud Player');
    tray.setContextMenu(menu);
    tray.on('click', () => mainWindow?.isVisible() ? mainWindow.hide() : mainWindow?.show());
  } catch (e) { console.error('Tray error:', e); }
}

function setupShortcuts() {
  globalShortcut.register('MediaPlayPause', () => mainWindow?.webContents.send('media:toggle'));
  globalShortcut.register('MediaNextTrack', () => mainWindow?.webContents.send('media:next'));
  globalShortcut.register('MediaPreviousTrack', () => mainWindow?.webContents.send('media:prev'));
}

/* --- ACCOUNT & SCRAPING HELPERS --- */
async function isLoggedIn() {
  try {
    const ses = session.fromPartition(SC_PARTITION);
    const cookies = await ses.cookies.get({ domain: 'soundcloud.com' });
    return cookies.some(c => c.name === 'oauth_token' || c.name === '_soundcloud_session');
  } catch { return false; }
}

async function getHiddenWin() {
  if (hiddenWin && !hiddenWin.isDestroyed()) return hiddenWin;
  hiddenWin = new BrowserWindow({
    width: 1000, height: 800, show: false,
    webPreferences: { partition: SC_PARTITION, contextIsolation: false }
  });
  return hiddenWin;
}

// Auto scroll helper for scraping
async function autoScroll(win, maxTimeMs = 5000) {
  await win.webContents.executeJavaScript(`
    new Promise(resolve => {
      let totalHeight = 0;
      let distance = 300;
      let elapsed = 0;
      const timer = setInterval(() => {
        const scrollHeight = document.body.scrollHeight;
        window.scrollBy(0, distance);
        totalHeight += distance;
        elapsed += 200;
        
        // Try to click "Load more" buttons
        const btn = document.querySelector('.sc-button-load-more');
        if(btn) btn.click();

        if (elapsed >= ${maxTimeMs}) {
          clearInterval(timer);
          resolve();
        }
      }, 200);
    });
  `);
}

// IPC Handlers
ipcMain.handle('app:openExternal', (_, url) => shell.openExternal(url));

// Window Controls for Custom Titlebar
ipcMain.on('win:minimize', () => mainWindow?.minimize());
ipcMain.on('win:maximize', () => {
  if (mainWindow?.isMaximized()) mainWindow.unmaximize();
  else mainWindow?.maximize();
});
ipcMain.on('win:close', () => mainWindow?.hide());

ipcMain.handle('account:status', async () => {
  const logged = await isLoggedIn();
  if (!logged) return { loggedIn: false };
  
  const win = await getHiddenWin();
  try {
    await win.loadURL('https://soundcloud.com/you/likes');
    const user = await win.webContents.executeJavaScript(`
      (function() {
         try {
           const me = window.__sc_hydration?.find(x => x.data?.me)?.data?.me;
           if(me) return { username: me.username, avatar_url: me.avatar_url };
         } catch(e){}
         return null;
      })()
    `);
    return { loggedIn: true, user };
  } catch { return { loggedIn: true, user: null }; }
});

ipcMain.handle('account:login', async () => {
  if (authWin) { authWin.focus(); return false; }
  return new Promise(resolve => {
    authWin = new BrowserWindow({
      width: 600, height: 700, show: true,
      webPreferences: { partition: SC_PARTITION }
    });
    authWin.loadURL('https://soundcloud.com/signin');
    const poll = setInterval(async () => {
      if (await isLoggedIn()) {
        clearInterval(poll);
        authWin.close();
        resolve(true);
      }
    }, 1000);
    authWin.on('closed', () => { clearInterval(poll); authWin = null; resolve(false); });
  });
});

ipcMain.handle('account:logout', async () => {
  const ses = session.fromPartition(SC_PARTITION);
  await ses.clearStorageData();
  return true;
});

// Search Scraping
ipcMain.handle('search:tracks', async (_, query) => {
  const win = await getHiddenWin();
  await win.loadURL(`https://soundcloud.com/search/sounds?q=${encodeURIComponent(query)}`);
  await new Promise(r => setTimeout(r, 2000)); 
  
  return await win.webContents.executeJavaScript(`
    Array.from(document.querySelectorAll('li .soundTitle__title')).map(el => {
       const link = el.closest('li').querySelector('a.soundTitle__title');
       const art = el.closest('li').querySelector('.sc-artwork');
       const artist = el.closest('li').querySelector('.soundTitle__username');
       
       let img = '';
       if(art) {
         const style = window.getComputedStyle(art).backgroundImage;
         const m = style.match(/url\\("(.*?)"\\)/);
         if(m) img = m[1];
       }

       return {
         title: link ? link.innerText.trim() : 'Unknown',
         url: link ? link.href : '',
         permalink_url: link ? link.href : '',
         artist: artist ? artist.innerText.trim() : '',
         art: img
       };
    }).slice(0, 15);
  `);
});

// Import Library (Likes, Playlists, Albums)
ipcMain.handle('import:all', async (event) => {
  const win = await getHiddenWin();
  const sender = mainWindow.webContents;
  const send = (ch, d) => sender.send(ch, d);
  
  try {
    if(!(await isLoggedIn())) {
       send('import:error', 'Not logged in. Please sign in first.');
       return;
    }

    send('import:status', 'Scanning Likes...');
    send('import:progress', 10);
    await win.loadURL('https://soundcloud.com/you/likes');
    await new Promise(r => setTimeout(r, 1500));
    await autoScroll(win, 6000); 
    
    const likes = await win.webContents.executeJavaScript(`
      Array.from(document.querySelectorAll('a.soundTitle__title')).map(a => a.href).filter(u => u.includes('/sets/') === false)
    `);

    send('import:status', 'Scanning Playlists...');
    send('import:progress', 50);
    await win.loadURL('https://soundcloud.com/you/sets');
    await new Promise(r => setTimeout(r, 1500));
    await autoScroll(win, 4000);

    const playlists = await win.webContents.executeJavaScript(`
      Array.from(document.querySelectorAll('.soundList__item')).map(item => {
        const titleEl = item.querySelector('.soundTitle__title');
        // Simple extraction:
        const url = titleEl ? titleEl.href : '';
        const title = titleEl ? titleEl.innerText.trim() : 'Untitled';
        return { title, url, tracks: [] }; 
      }).filter(p => p.url);
    `);
    
    send('import:status', 'Scanning Albums...');
    send('import:progress', 80);
    await win.loadURL('https://soundcloud.com/you/albums');
    await new Promise(r => setTimeout(r, 1000));
    await autoScroll(win, 3000);
    
    const albums = await win.webContents.executeJavaScript(`
      Array.from(document.querySelectorAll('.soundList__item')).map(item => {
        const titleEl = item.querySelector('.soundTitle__title');
        const url = titleEl ? titleEl.href : '';
        const title = titleEl ? titleEl.innerText.trim() : 'Untitled';
        return { title, url, tracks: [] };
      }).filter(p => p.url);
    `);

    send('library:merge', { likes, playlists, albums });
    send('import:done');

  } catch (e) {
    console.error(e);
    send('import:error', 'Import failed: ' + e.message);
  }
});

// Update Check Helper
async function checkForUpdatesEarly() {
  if (!app.isPackaged) { log.info('Updater: skipped (dev mode)'); return; }
  try {
    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = false;
    const send = (ch, payload) => mainWindow?.webContents.send(ch, payload);
    
    autoUpdater.on('checking-for-update', () => send('updater:status', 'checking'));
    autoUpdater.on('update-available', (info) => send('updater:available', info));
    autoUpdater.on('update-not-available', () => send('updater:none'));
    autoUpdater.on('download-progress', (p) => send('updater:progress', p));
    autoUpdater.on('update-downloaded', (info) => {
      send('updater:downloaded', info);
      autoUpdater.quitAndInstall(true, true);
    });
    autoUpdater.on('error', (err) => send('updater:error', err?.message));
    
    await autoUpdater.checkForUpdates();
  } catch (e) { log.warn('Updater check failed', e); }
}

ipcMain.handle('app:checkForUpdates', async () => {
  if (!app.isPackaged) { return { ok: false, msg: 'dev-disabled' }; }
  try { await autoUpdater.checkForUpdates(); return { ok: true }; }
  catch (e) { return { ok: false, msg: e?.message || String(e) }; }
});


/* --- LIFECYCLE --- */
app.whenReady().then(async () => {
  createWindow();
  // Check for updates shortly after launch
  setTimeout(() => checkForUpdatesEarly(), 3000);
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
  else mainWindow?.show();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});