// "Start at Login": opens InfoTech in the background when the computer starts,
// so notifications arrive from the first minute. Off unless the person turns it on.

const { app } = require('electron');

const HIDDEN_ARG = '--hidden';

function isEnabled() {
  return app.getLoginItemSettings({ args: [HIDDEN_ARG] }).openAtLogin;
}

function setEnabled(enabled) {
  app.setLoginItemSettings({
    openAtLogin: enabled,
    openAsHidden: true, // older macOS
    args: [HIDDEN_ARG], // Windows: tells us to start in the tray
  });
}

/** True when the system started us at login: stay in the tray / menu bar until clicked. */
function startedHidden() {
  if (process.argv.includes(HIDDEN_ARG)) return true;
  if (process.platform === 'darwin') {
    const s = app.getLoginItemSettings();
    return !!(s.wasOpenedAtLogin || s.wasOpenedAsHidden);
  }
  return false;
}

module.exports = { isEnabled, setEnabled, startedHidden };
