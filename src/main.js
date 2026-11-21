// InfoTech desktop: a secure window onto the live admin at infotechq8.com/admin.
// All data and logic stay on the server; this shell adds what a browser tab can't.

const { app, BrowserWindow, session, shell } = require('electron');
const path = require('node:path');
const config = require('./config');
const windowState = require('./window-state');
const downloads = require('./downloads');
const contextMenu = require('./context-menu');
const menu = require('./menu');
const updater = require('./updater');

const isMac = process.platform === 'darwin';
const OFFLINE_PAGE = path.join(__dirname, 'offline.html');

// Net errors that mean "can't reach the server", as opposed to a page that
// loaded and said no. ERR_ABORTED (-3) is a navigation we cancelled ourselves.
const OFFLINE_ERRORS = new Set([-2, -7, -21, -100, -101, -102, -104, -105, -106, -109, -118, -130, -137, -324]);

let mainWindow = null;
let quitting = false;

app.setName('InfoTech');
app.setAboutPanelOptions({
  applicationName: 'InfoTech',
  applicationVersion: app.getVersion(),
  copyright: 'InfoTech Institute for Private Training',
  website: 'https://infotechq8.com',
});

// The admin can recognise the app by this ("app detection" in the plan), e.g.
// to hide notices the app handles itself. Must be set before any window loads.
app.userAgentFallback = `${app.userAgentFallback} InfoTechDesktop/${app.getVersion()}`;

// One InfoTech at a time: opening it again brings the existing window forward.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => showMain());
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
  menu.build({ go: navigate });
  createMainWindow();
  updater.start();
}

function createMainWindow() {
  const state = windowState.load();

  mainWindow = new BrowserWindow({
    ...state,
    minWidth: 960,
    minHeight: 600,
    title: 'InfoTech',
    backgroundColor: '#ffffff',
    icon: path.join(__dirname, '..', 'build', 'icon.png'),
    show: false,
    webPreferences: webPreferences(),
  });

  if (state.maximized) mainWindow.maximize();
  windowState.track(mainWindow);
  guard(mainWindow.webContents);

  mainWindow.once('ready-to-show', () => mainWindow.show());

  // On a Mac, closing the window keeps InfoTech running (like Mail); the Dock
  // icon brings it straight back without logging in or reloading.
  mainWindow.on('close', (event) => {
    if (isMac && !quitting) {
      event.preventDefault();
      if (mainWindow.isFullScreen()) {
        mainWindow.once('leave-full-screen', () => mainWindow.hide());
        mainWindow.setFullScreen(false);
      } else {
        mainWindow.hide();
      }
    }
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
  // letter) open in a new app window; anything else goes to the browser.
  webContents.setWindowOpenHandler(({ url }) => {
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
app.on('window-all-closed', () => { if (!isMac) app.quit(); });

// Nothing in the app should ever create a webview or open a page outside these rules.
app.on('web-contents-created', (_e, contents) => {
  contents.on('will-attach-webview', (event) => event.preventDefault());
});
