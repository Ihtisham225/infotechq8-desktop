// The usual Mac / Windows menus plus InfoTech's own: Compose email, Inbox, Dashboard.

const { app, Menu, shell, BrowserWindow } = require('electron');
const { paths } = require('./config');
const updater = require('./updater');

const isMac = process.platform === 'darwin';

function build({ go }) {
  const focused = () => BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];

  const template = [
    ...(isMac ? [{
      label: app.name,
      submenu: [
        { role: 'about' },
        { label: 'Check for Updates…', click: () => updater.checkNow(focused()) },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' },
      ],
    }] : []),
    {
      label: 'File',
      submenu: [
        { label: 'Compose Email', accelerator: 'CmdOrCtrl+N', click: () => go(paths.compose) },
        { type: 'separator' },
        { label: 'Print…', accelerator: 'CmdOrCtrl+P', click: () => focused()?.webContents.print() },
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit' },
      ],
    },
    { role: 'editMenu' },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
        { type: 'separator' },
        { role: 'toggleDevTools' },
      ],
    },
    {
      label: 'Go',
      submenu: [
        { label: 'Back', accelerator: isMac ? 'Cmd+[' : 'Alt+Left', click: () => focused()?.webContents.navigationHistory.goBack() },
        { label: 'Forward', accelerator: isMac ? 'Cmd+]' : 'Alt+Right', click: () => focused()?.webContents.navigationHistory.goForward() },
        { type: 'separator' },
        { label: 'Dashboard', accelerator: 'CmdOrCtrl+1', click: () => go(paths.dashboard) },
        { label: 'Inbox', accelerator: 'CmdOrCtrl+2', click: () => go(paths.inbox) },
        { label: 'Compose Email', accelerator: 'CmdOrCtrl+3', click: () => go(paths.compose) },
      ],
    },
    { role: 'windowMenu' },
    {
      role: 'help',
      submenu: [
        { label: 'Open This Page in the Browser', click: () => { const url = focused()?.webContents.getURL(); if (url?.startsWith('http')) shell.openExternal(url); } },
        ...(isMac ? [] : [
          { type: 'separator' },
          { label: 'Check for Updates…', click: () => updater.checkNow(focused()) },
          { label: `About InfoTech ${app.getVersion()}`, click: () => app.showAboutPanel() },
        ]),
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

module.exports = { build };
