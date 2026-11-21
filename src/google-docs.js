// Google Docs inside InfoTech, for editing library Word files.
//
// The admin shares the document "anyone with the link can edit" while it is
// being edited, so this window needs no Google sign-in (Google blocks signing in
// inside apps like this one anyway). It gets its own storage, separate from the
// InfoTech login, presents itself as plain Chrome (Docs refuses unknown
// browsers), and may only show Google Docs: any other link opens in the normal browser.

const { app, BrowserWindow, session, shell } = require('electron');
const contextMenu = require('./context-menu');
const downloads = require('./downloads');

const PARTITION = 'persist:google-docs';
const EDITOR = /^https:\/\/docs\.google\.com\/document\/d\/[\w-]+\/edit/;

let prepared = false;

function isEditorUrl(url) {
  return EDITOR.test(url);
}

function isDocsUrl(url) {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && u.host === 'docs.google.com';
  } catch {
    return false;
  }
}

function prepare() {
  if (prepared) return;
  prepared = true;
  const ses = session.fromPartition(PARTITION);
  // Plain Chrome: without the "Electron" and "InfoTechDesktop" words Docs treats us as Chrome.
  ses.setUserAgent(app.userAgentFallback.replace(/\s(Electron|InfoTech\w*)\/\S+/g, ''));
  ses.setPermissionRequestHandler((_wc, permission, cb) => cb(permission === 'clipboard-sanitized-write'));
  downloads.attach(ses); // File → Download in Docs still asks where to save
}

const open = new Map(); // editor URL → its window, so a second click focuses it

/**
 * Opens (or focuses) the editor in its own InfoTech window. The app creates it
 * itself rather than letting the page's window.open do it: a window the page
 * opens would share the page's session and identity.
 */
function openEditor(url, onClosed) {
  const key = url.split('?')[0].split('#')[0];
  const existing = open.get(key);
  if (existing && !existing.isDestroyed()) {
    if (existing.isMinimized()) existing.restore();
    existing.focus();
    return existing;
  }

  prepare();
  const win = new BrowserWindow({
    width: 1200,
    height: 900,
    title: 'Google Docs — InfoTech',
    backgroundColor: '#ffffff',
    autoHideMenuBar: true,
    webPreferences: {
      partition: PARTITION,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: true,
      // no preload: Google's page gets no bridge to the app
    },
  });
  guard(win.webContents);
  open.set(key, win);
  win.on('closed', () => {
    open.delete(key);
    onClosed?.();
  });
  win.loadURL(url);
  return win;
}

/** Keeps the Docs window on docs.google.com; everything else goes to the browser. */
function guard(webContents) {
  contextMenu.attach(webContents);

  const outside = (event, url) => {
    if (isDocsUrl(url)) return;
    event.preventDefault();
    if (/^https?:/.test(url)) shell.openExternal(url);
  };
  webContents.on('will-navigate', outside);
  webContents.on('will-redirect', (event, url, _inPlace, isMainFrame) => isMainFrame && outside(event, url));

  webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
}

module.exports = { isEditorUrl, openEditor };
