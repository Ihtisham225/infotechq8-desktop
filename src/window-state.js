// Remembers the main window's size, position and maximised state between launches.

const { app, screen } = require('electron');
const fs = require('node:fs');
const path = require('node:path');

const FILE = () => path.join(app.getPath('userData'), 'window-state.json');
const DEFAULTS = { width: 1360, height: 860 };

function load() {
  try {
    const saved = JSON.parse(fs.readFileSync(FILE(), 'utf8'));
    if (!Number.isFinite(saved.width) || !Number.isFinite(saved.height)) return { ...DEFAULTS };
    // A monitor that was unplugged would leave the window off screen: only keep
    // the position when it still lands on a connected display.
    if (Number.isFinite(saved.x) && Number.isFinite(saved.y)) {
      const visible = screen.getAllDisplays().some(({ workArea: a }) =>
        saved.x < a.x + a.width - 100 && saved.x + saved.width > a.x + 100 &&
        saved.y >= a.y - 10 && saved.y < a.y + a.height - 100);
      if (!visible) {
        delete saved.x;
        delete saved.y;
      }
    }
    return saved;
  } catch {
    return { ...DEFAULTS };
  }
}

function track(win) {
  let timer;
  const saveNow = () => {
    clearTimeout(timer);
    if (win.isDestroyed()) return;
    const state = { ...win.getNormalBounds(), maximized: win.isMaximized() };
    try {
      fs.writeFileSync(FILE(), JSON.stringify(state));
    } catch {
      // Losing the window position is not worth interrupting anyone over.
    }
  };
  // Dragging fires dozens of events; write once it settles.
  const saveSoon = () => {
    clearTimeout(timer);
    timer = setTimeout(saveNow, 400);
  };
  for (const event of ['resize', 'move', 'maximize', 'unmaximize']) win.on(event, saveSoon);
  // Quitting doesn't wait for a timer, so closing saves straight away.
  win.on('close', saveNow);
  app.on('before-quit', saveNow);
}

module.exports = { load, track };
