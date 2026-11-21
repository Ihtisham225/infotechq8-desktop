// Where the app points, and which hosts count as "inside the app".
//
// INFOTECH_URL overrides the start page for local testing, e.g.
//   INFOTECH_URL=http://127.0.0.1:8000/dashboard npm start
// Its host is then treated as internal too, so the local site behaves like the
// live one. Packaged builds ignore it, so a stray variable on a team member's
// machine can never point the installed app somewhere else.

const { app } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const OFFLINE_PATH = pathToFileURL(path.join(__dirname, 'offline.html')).pathname;

// /admin itself is not a page; the admin dashboard lives at /dashboard.
const LIVE_URL = 'https://infotechq8.com/dashboard';

const startUrl = (!app.isPackaged && process.env.INFOTECH_URL) || LIVE_URL;
const origin = new URL(startUrl).origin;

const INTERNAL_HOSTS = new Set(['infotechq8.com', 'www.infotechq8.com', new URL(startUrl).host]);

function isInternal(rawUrl) {
  try {
    const url = new URL(rawUrl);
    if (url.protocol === 'file:') return url.pathname === OFFLINE_PATH; // our own offline page, nothing else on disk
    if (!['https:', 'http:'].includes(url.protocol)) return false;
    // The live site is HTTPS only; plain http is allowed just for a local override.
    if (url.protocol === 'http:' && url.origin !== origin) return false;
    return INTERNAL_HOSTS.has(url.host);
  } catch {
    return false;
  }
}

// Schemes handed to the operating system: the browser, the mail client, WhatsApp, the phone.
const EXTERNAL_SCHEMES = new Set(['https:', 'http:', 'mailto:', 'tel:', 'whatsapp:']);

function canOpenExternally(rawUrl) {
  try {
    return EXTERNAL_SCHEMES.has(new URL(rawUrl).protocol);
  } catch {
    return false;
  }
}

const paths = {
  dashboard: `${origin}/dashboard`,
  inbox: `${origin}/admin/mailbox/inbox`,
  compose: `${origin}/admin/emails/create`,
  feed: `${origin}/admin/desktop/notifications`,
  openFile: `${origin}/admin/library/open`,
};

module.exports = { startUrl, origin, isInternal, canOpenExternally, paths };
