// InfoTech in the menu bar (Mac) / system tray (Windows): open, compose, inbox,
// quiet mode, start at login, quit. With the tray, closing the window on
// Windows keeps InfoTech running so notifications still arrive.

const { app, Tray, Menu, nativeImage } = require('electron');
const path = require('node:path');
const { paths } = require('./config');
const settings = require('./settings');
const loginItem = require('./login-item');

const isMac = process.platform === 'darwin';
let tray = null;
let actions = null;

function create(handlers) {
  actions = handlers;
  const image = isMac
    ? nativeImage.createFromPath(path.join(__dirname, 'assets', 'trayTemplate.png'))
    : nativeImage.createFromPath(path.join(__dirname, 'assets', 'tray.png'));
  if (isMac) image.setTemplateImage(true);

  tray = new Tray(image);
  tray.setToolTip('InfoTech');
  // Windows: a click on the tray icon brings the window back; Mac shows the menu.
  if (!isMac) tray.on('click', () => actions.show());
  refresh(0);
  return tray;
}

function refresh(badge = 0) {
  if (!tray) return;
  tray.setToolTip(badge > 0 ? `InfoTech — ${badge} unread` : 'InfoTech');
  if (isMac) tray.setTitle(badge > 0 ? String(badge) : '');

  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Open InfoTech', click: () => actions.show() },
    { label: 'Compose Email', accelerator: actions.composeShortcut, click: () => actions.go(paths.compose) },
    { label: badge > 0 ? `Inbox (${badge} unread)` : 'Inbox', click: () => actions.go(paths.inbox) },
    { type: 'separator' },
    {
      label: 'Quiet Mode',
      type: 'checkbox',
      checked: !!settings.get('quiet'),
      toolTip: 'No notification pop-ups; the badge still counts',
      click: (item) => { settings.set('quiet', item.checked); actions.settingsChanged(); },
    },
    {
      label: 'Start at Login',
      type: 'checkbox',
      checked: loginItem.isEnabled(),
      click: (item) => { loginItem.setEnabled(item.checked); actions.settingsChanged(); },
    },
    { type: 'separator' },
    { label: 'Quit InfoTech', click: () => app.quit() },
  ]));
}

module.exports = { create, refresh };
