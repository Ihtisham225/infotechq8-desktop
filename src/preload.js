// The narrow "safe bridge" between the page and the desktop. Phase 1 only tells
// the page it is running inside the app; Phase 2 adds notifications and the badge.
// Runs sandboxed with context isolation: the page sees only what is exposed here.

const { contextBridge } = require('electron');

const versionArg = process.argv.find((arg) => arg.startsWith('--infotech-version='));

contextBridge.exposeInMainWorld('infotechDesktop', {
  version: versionArg ? versionArg.split('=')[1] : null,
  platform: process.platform,
});
