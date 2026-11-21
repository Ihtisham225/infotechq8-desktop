// InfoTech desktop: a secure window onto the live admin at infotechq8.com/admin.
// All data and logic stay on the server; this shell adds what a browser tab can't.

const { app, BrowserWindow, Notification, globalShortcut, ipcMain, session, shell } = require('electron');
const path = require('node:path');
const config = require('./config');
const windowState = require('./window-state');
const downloads = require('./downloads');
const contextMenu = require('./context-menu');
const menu = require('./menu');
const updater = require('./updater');
const notifier = require('./notifier');
const tray = require('./tray');
const loginItem = require('./login-item');
const openedFiles = require('./opened-files');
const googleDocs = require('./google-docs');

const isMac = process.platform === 'darwin';
const OFFLINE_PAGE = path.join(__dirname, 'offline.html');

// Opens Compose from anywhere, even when InfoTech is in the background.
const COMPOSE_SHORTCUT = 'CommandOrControl+Alt+Shift+E';

// Net errors that mean "can't reach the server", as opposed to a page that
// loaded and said no. ERR_ABORTED (-3) is a navigation we cancelled ourselves.
const OFFLINE_ERRORS = new Set([-2, -7, -21, -100, -101, -102, -104, -105, -106, -109, -118, -130, -137, -324]);

let mainWindow = null;
let quitting = false;
let feed = null;
let toldAboutTray = false;

app.setName('InfoTech');
// A dev run against another server (INFOTECH_URL) gets its own profile, so its
// login, settings and notification cursor never mix with the installed app's.
if (!app.isPackaged && process.env.INFOTECH_URL) app.setPath('userData', `${app.getPath('userData')}-dev`);
// Windows only shows notifications for an app with an id (it matches the installer's appId).
if (process.platform === 'win32') app.setAppUserModelId('com.infotechq8.desktop');
app.setAboutPanelOptions({
  applicationName: 'InfoTech',
  applicationVersion: app.getVersion(),
  copyright: 'InfoTech Institute for Private Training',
  website: 'https://infotechq8.com',
});

// The admin can recognise the app by this ("app detection" in the plan), e.g.
// to hide notices the app handles itself. Must be set before any window loads.
app.userAgentFallback = `${app.userAgentFallback} InfoTechDesktop/${app.getVersion()}`;

// Word / PDF files opened with InfoTech. On a Mac they arrive as 'open-file'
// events (possibly before the app is ready); on Windows as command-line arguments.
let isReady = false;
app.on('open-file', (event, filePath) => {
  event.preventDefault();
  if (openedFiles.add(filePath) && isReady) showOpenPage();
});
openedFiles.fromArgv(process.argv).forEach(openedFiles.add);

// One InfoTech at a time: opening it again (or opening a file with it) uses the running one.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', (_event, argv) => {
    const files = openedFiles.fromArgv(argv).filter(openedFiles.add);
    if (files.length) showOpenPage();
    else showMain();
  });
  app.whenReady().then(ready);
}

function webPreferences() {
  return {
    preload: path.join(__dirname, 'preload.js'),
    contextIsolation: true, // the page and the preload never share objects
    nodeIntegration: false, // no Node.js in the page, so a page can't reach the computer
    sandbox: true,
    webSecurity: true,
    plugins: true, // Chromium's built-in PDF viewer, for PDF previews
    spellcheck: true,
    additionalArguments: [`--infotech-version=${app.getVersion()}`],
  };
}

function ready() {
  const ses = session.defaultSession;

  // Only infotechq8.com may ask for anything (clipboard, notifications, full
  // screen); camera, microphone, location and the rest stay off for every page.
  const ALLOWED = new Set(['clipboard-read', 'clipboard-sanitized-write', 'notifications', 'fullscreen']);
  ses.setPermissionRequestHandler((wc, permission, callback) => {
    callback(ALLOWED.has(permission) && config.isInternal(wc.getURL()));
  });
  ses.setPermissionCheckHandler((wc, permission) => ALLOWED.has(permission) && !!wc && config.isInternal(wc.getURL()));

  downloads.attach(ses);
  menu.build({ go: navigate, composeShortcut: COMPOSE_SHORTCUT, settingsChanged: () => tray.refresh(notifier.badge()) });
  createMainWindow({ hidden: loginItem.startedHidden() });
  updater.start();

  tray.create({
    show: showMain,
    go: navigate,
    composeShortcut: COMPOSE_SHORTCUT,
    settingsChanged: () => menu.build({ go: navigate, composeShortcut: COMPOSE_SHORTCUT, settingsChanged: () => tray.refresh(notifier.badge()) }),
  });

  feed = notifier.start({
    session: ses,
    openUrl: (url) => (url ? navigate(url) : showMain()),
    badgeChanged: (count) => tray.refresh(count),
  });

  if (!globalShortcut.register(COMPOSE_SHORTCUT, () => navigate(config.paths.compose))) {
    console.warn('[shortcut] another app already uses', COMPOSE_SHORTCUT);
  }

  // The "Open a file" page asks for the file the computer handed us. Only that
  // page on infotechq8.com may ask, and it only ever gets files the person opened.
  ipcMain.handle('opened-file:take', (event) => {
    const url = event.senderFrame?.url || '';
    if (!config.isInternal(url) || new URL(url).pathname !== new URL(config.paths.openFile).pathname) return null;
    return openedFiles.take();
  });

  // Update pill on InfoTech pages: the page asks for the state, and may ask to relaunch.
  ipcMain.handle('update:state', (event) => (config.isInternal(event.senderFrame?.url || '') ? updater.listen(event.sender) : null));
  ipcMain.on('update:install', (event) => {
    if (!config.isInternal(event.senderFrame?.url || '')) return;
    quitting = true;
    updater.install();
  });

  isReady = true;
  if (openedFiles.pending()) showOpenPage();
}

function showOpenPage() {
  navigate(config.paths.openFile);
}

function createMainWindow({ hidden = false } = {}) {
  const state = windowState.load();

  mainWindow = new BrowserWindow({
    ...state,
    minWidth: 960,
    minHeight: 600,
    title: 'InfoTech',
    backgroundColor: '#ffffff',
    icon: path.join(__dirname, 'assets', 'icon.png'),
    // Mac: no title bar, like UC-Ultra. The window buttons sit in the admin's
    // sidebar logo row (the website leaves room for them), and the top bar
    // drags the window. Windows keeps its normal frame.
    ...(isMac ? { titleBarStyle: 'hiddenInset', trafficLightPosition: { x: 28, y: 37 } } : {}),
    show: false,
    webPreferences: webPreferences(),
  });

  if (state.maximized) mainWindow.maximize();
  windowState.track(mainWindow);
  guard(mainWindow.webContents);

  // Started at login: load in the background and wait in the tray / menu bar.
  if (!hidden) mainWindow.once('ready-to-show', () => mainWindow.show());

  // Closing the window keeps InfoTech running (like Mail), so notifications keep
  // arriving; the Dock / tray icon brings it straight back without reloading.
  // Quit from the app menu or the tray.
  mainWindow.on('close', (event) => {
    if (quitting) return;
    event.preventDefault();
    if (mainWindow.isFullScreen()) {
      mainWindow.once('leave-full-screen', () => mainWindow.hide());
      mainWindow.setFullScreen(false);
    } else {
      mainWindow.hide();
    }
    if (!isMac && !toldAboutTray && Notification.isSupported()) {
      toldAboutTray = true;
      new Notification({ title: 'InfoTech is still running', body: 'It stays in the system tray so notifications keep coming. Right-click the tray icon to quit.' }).show();
    }
  });

  // Opening the Inbox or a list clears its part of the badge on the server; ask again soon.
  let refreshSoon;
  mainWindow.webContents.on('did-navigate', (_e, url) => {
    if (!feed || !config.isInternal(url) || url.startsWith('file:')) return;
    clearTimeout(refreshSoon);
    refreshSoon = setTimeout(() => feed.pollNow(), 1500);
  });
  mainWindow.on('closed', () => { mainWindow = null; });

  mainWindow.webContents.on('did-fail-load', (_e, code, _desc, url, isMainFrame) => {
    if (!isMainFrame) return;
    // ready-to-show never fires for a page that failed, so the window would stay invisible.
    if (!mainWindow.isVisible()) mainWindow.show();
    if (!OFFLINE_ERRORS.has(code)) return;
    mainWindow.loadFile(OFFLINE_PAGE, { query: { retry: config.isInternal(url) ? url : config.startUrl } });
  });

  mainWindow.loadURL(config.startUrl);
}

// Keeps a window on infotechq8.com: every other link opens in the normal browser.
function guard(webContents) {
  contextMenu.attach(webContents);

  webContents.on('will-navigate', (event, url) => {
    if (config.isInternal(url)) return;
    event.preventDefault();
    if (config.canOpenExternally(url)) shell.openExternal(url);
  });

  // A redirect from the server to another site (rare) is treated the same way.
  webContents.on('will-redirect', (event, url, _inPlace, isMainFrame) => {
    if (!isMainFrame || config.isInternal(url)) return;
    event.preventDefault();
    if (config.canOpenExternally(url)) shell.openExternal(url);
  });

  // target="_blank" and window.open: InfoTech pages (a PDF preview, a printable
  // letter) open in a new app window, and so does the Google Docs editor the
  // library opens for editing; anything else goes to the browser.
  webContents.setWindowOpenHandler(({ url }) => {
    if (config.isInternal(webContents.getURL()) && googleDocs.isEditorUrl(url)) {
      // Closing the editor brings InfoTech back, where "Save & close" is waiting.
      googleDocs.openEditor(url, () => mainWindow && !mainWindow.isDestroyed() && showMain());
      return { action: 'deny' };
    }
    if (config.isInternal(url) && !url.startsWith('file:')) {
      return {
        action: 'allow',
        overrideBrowserWindowOptions: {
          width: 1100,
          height: 800,
          backgroundColor: '#ffffff',
          webPreferences: webPreferences(),
        },
      };
    }
    if (config.canOpenExternally(url)) shell.openExternal(url);
    return { action: 'deny' };
  });

  webContents.on('did-create-window', (child) => guard(child.webContents));
}

function showMain() {
  if (!mainWindow) createMainWindow();
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

function navigate(url) {
  showMain();
  mainWindow.loadURL(url);
}

app.on('activate', () => showMain());
app.on('before-quit', () => { quitting = true; });
app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  notifier.stop();
});

// Nothing in the app should ever create a webview or open a page outside these rules.
app.on('web-contents-created', (_e, contents) => {
  contents.on('will-attach-webview', (event) => event.preventDefault());
});
