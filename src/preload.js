// The narrow "safe bridge" between the page and the desktop: it tells the page
// it runs inside the app, and hands the library a file opened with InfoTech.
// Runs sandboxed with context isolation: the page sees only what is exposed here.

const { contextBridge, ipcRenderer } = require('electron');

const versionArg = process.argv.find((arg) => arg.startsWith('--infotech-version='));

contextBridge.exposeInMainWorld('infotechDesktop', {
  version: versionArg ? versionArg.split('=')[1] : null,
  platform: process.platform,
  // The Word/PDF file opened with InfoTech from the computer, for the library's
  // "Open a file" page. The app only answers that page; anywhere else it's null.
  takeOpenedFile: () => ipcRenderer.invoke('opened-file:take'),
});
