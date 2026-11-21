// Small per-computer settings: quiet mode, the notification cursor, which daily
// reminders were already shown. Kept in the app's own data folder.

const { app } = require('electron');
const fs = require('node:fs');
const path = require('node:path');

const FILE = () => path.join(app.getPath('userData'), 'settings.json');
const DEFAULTS = { quiet: false, cursor: null, shown: [] };

let cache = null;

function all() {
  if (!cache) {
    try {
      cache = { ...DEFAULTS, ...JSON.parse(fs.readFileSync(FILE(), 'utf8')) };
    } catch {
      cache = { ...DEFAULTS };
    }
  }
  return cache;
}

function get(key) {
  return all()[key];
}

function set(key, value) {
  all()[key] = value;
  try {
    fs.writeFileSync(FILE(), JSON.stringify(cache));
  } catch {
    // A lost setting is not worth interrupting anyone over.
  }
}

module.exports = { get, set };
