// Automatic updates from GitHub Releases. A new version downloads in the
// background and installs the next time the app quits; nobody has to do anything.

const { app, dialog } = require('electron');
const { autoUpdater } = require('electron-updater');

const SIX_HOURS = 6 * 60 * 60 * 1000;
let manualCheck = null; // the window to answer when the person chose "Check for Updates…"

autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;

// Without this the updater fails silently: a bad manifest or a blocked network
// looks exactly like "no update available".
autoUpdater.on('error', (err) => {
  console.error('[updater]', err);
  if (manualCheck) {
    dialog.showMessageBox(manualCheck, { type: 'error', message: 'Could not check for updates.', detail: err?.message ?? String(err) });
    manualCheck = null;
  }
});

autoUpdater.on('update-not-available', () => {
  if (manualCheck) {
    dialog.showMessageBox(manualCheck, { type: 'info', message: 'InfoTech is up to date.', detail: `Version ${app.getVersion()}` });
    manualCheck = null;
  }
});

autoUpdater.on('update-available', (info) => {
  if (manualCheck) {
    dialog.showMessageBox(manualCheck, { type: 'info', message: `Version ${info.version} is downloading.`, detail: 'It installs the next time InfoTech restarts.' });
    manualCheck = null;
  }
});

autoUpdater.on('update-downloaded', async (info) => {
  const { BrowserWindow } = require('electron');
  const win = BrowserWindow.getAllWindows()[0];
  const { response } = await dialog.showMessageBox(win, {
    type: 'info',
    message: `InfoTech ${info.version} is ready.`,
    detail: 'It installs when you quit InfoTech. Restart now to use it straight away.',
    buttons: ['Later', 'Restart now'],
    defaultId: 0,
    cancelId: 0,
  });
  if (response === 1) autoUpdater.quitAndInstall();
});

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

module.exports = { start, checkNow };
