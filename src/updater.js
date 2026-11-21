// Automatic updates from GitHub Releases. A new version downloads in the
// background and installs the next time the app quits; nobody has to do anything.
//
// Like UC-Ultra, the page shows the progress as a pill in the corner
// ("Downloading update…", then "Relaunch to update"). The state is kept here
// so a page that loads after the download finished still gets it. If no page
// is listening (a website version without the pill), a dialog says it instead.

const { app, dialog, BrowserWindow } = require('electron');
const { autoUpdater } = require('electron-updater');

const SIX_HOURS = 6 * 60 * 60 * 1000;
let manualCheck = null; // the window to answer when the person chose "Check for Updates…"

autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;

/** @type {{status: 'idle'|'checking'|'available'|'downloaded'|'none'|'error', version?: string, percent?: number}} */
let state = { status: 'idle' };
const listeners = new Set(); // webContents ids of pages showing the pill

function setState(next) {
  state = next;
  for (const win of BrowserWindow.getAllWindows()) {
    if (listeners.has(win.webContents.id)) win.webContents.send('update-state', state);
  }
}

autoUpdater.on('checking-for-update', () => { if (state.status !== 'downloaded') setState({ status: 'checking' }); });
autoUpdater.on('download-progress', (p) => setState({ status: 'available', version: state.version, percent: Math.round(p.percent) }));

// Without this the updater fails silently: a bad manifest or a blocked network
// looks exactly like "no update available".
autoUpdater.on('error', (err) => {
  console.error('[updater]', err);
  if (state.status !== 'downloaded') setState({ status: 'error' });
  if (manualCheck) {
    dialog.showMessageBox(manualCheck, { type: 'error', message: 'Could not check for updates.', detail: err?.message ?? String(err) });
    manualCheck = null;
  }
});

autoUpdater.on('update-not-available', () => {
  setState({ status: 'none' });
  if (manualCheck) {
    dialog.showMessageBox(manualCheck, { type: 'info', message: 'InfoTech is up to date.', detail: `Version ${app.getVersion()}` });
    manualCheck = null;
  }
});

autoUpdater.on('update-available', (info) => {
  setState({ status: 'available', version: info.version, percent: 0 });
  if (manualCheck) {
    dialog.showMessageBox(manualCheck, { type: 'info', message: `Version ${info.version} is downloading.`, detail: 'It installs the next time InfoTech restarts.' });
    manualCheck = null;
  }
});

autoUpdater.on('update-downloaded', async (info) => {
  setState({ status: 'downloaded', version: info.version });
  if (listeners.size) return; // the page's pill offers "Relaunch to update"

  const win = BrowserWindow.getAllWindows()[0];
  const { response } = await dialog.showMessageBox(win, {
    type: 'info',
    message: `InfoTech ${info.version} is ready.`,
    detail: 'It installs when you quit InfoTech. Restart now to use it straight away.',
    buttons: ['Later', 'Restart now'],
    defaultId: 0,
    cancelId: 0,
  });
  if (response === 1) install();
});

/** A page asked for the state: it shows the pill from now on (until it navigates away or closes). */
function listen(webContents) {
  const id = webContents.id;
  if (!listeners.has(id)) {
    listeners.add(id);
    // A new page (not an in-page change or a frame) must ask again.
    const leave = (_e, _url, isInPlace, isMainFrame) => {
      if (isMainFrame && !isInPlace) {
        listeners.delete(id);
        webContents.off('did-start-navigation', leave);
      }
    };
    webContents.on('did-start-navigation', leave);
    webContents.once('destroyed', () => listeners.delete(id));
  }
  return state;
}

function install() {
  autoUpdater.quitAndInstall();
}

function start() {
  if (!app.isPackaged) return; // dev runs have no release to compare against
  autoUpdater.checkForUpdates().catch(() => {});
  setInterval(() => autoUpdater.checkForUpdates().catch(() => {}), SIX_HOURS);
}

function checkNow(win) {
  if (!app.isPackaged) {
    dialog.showMessageBox(win, { type: 'info', message: 'Updates only run in the installed app.' });
    return;
  }
  manualCheck = win;
  autoUpdater.checkForUpdates().catch(() => {});
}

module.exports = { start, checkNow, listen, install };
