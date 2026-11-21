// Asks the admin every minute what's new (GET /admin/desktop/notifications),
// shows a desktop notification for each new email, registration and inquiry,
// keeps the Dock / taskbar badge in step, and shows the follow-up reminder once a day.
//
// The request carries the window's own login cookie, so each person gets their
// own feed; when nobody is signed in the server answers 401 and we simply wait.

const { app, Notification, BrowserWindow, nativeImage } = require('electron');
const path = require('node:path');
const config = require('./config');
const settings = require('./settings');

const EVERY = 60 * 1000;
const MAX_SINGLE = 3; // more than this in one poll becomes one summary notice

let timer = null;
let inFlight = false;
let open = () => {};
let onBadge = () => {};
let lastBadge = 0;
const badgeImage = nativeImage.createFromPath(path.join(__dirname, 'assets', 'badge.png'));

function start({ session, openUrl, badgeChanged }) {
  open = openUrl;
  onBadge = badgeChanged || (() => {});
  const tick = () => poll(session).catch((err) => console.warn('[notifier]', err?.message ?? err));
  tick();
  timer = setInterval(tick, EVERY);
  return { pollNow: tick };
}

function stop() {
  clearInterval(timer);
}

async function poll(session) {
  if (inFlight) return;
  inFlight = true;
  try {
    const url = new URL(config.paths.feed);
    const cursor = settings.get('cursor');
    if (cursor) url.searchParams.set('since', cursor);

    const response = await session.fetch(url.toString(), {
      headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
      credentials: 'include',
      redirect: 'manual',
      cache: 'no-store',
    });

    // Signed out (401), not admin/staff (403), or an old server without the feed (404).
    if (!response.ok) {
      if (response.status === 401) setBadge(0);
      return;
    }

    const feed = await response.json();
    settings.set('cursor', feed.now);
    setBadge(Number(feed.badge) || 0);

    if (!settings.get('quiet')) {
      announce(Array.isArray(feed.items) ? feed.items : []);
      remind(feed.digest);
    }
  } finally {
    inFlight = false;
  }
}

function announce(items) {
  if (!items.length || !Notification.isSupported()) return;

  if (items.length > MAX_SINGLE) {
    const counts = items.reduce((acc, i) => ({ ...acc, [i.kind]: (acc[i.kind] || 0) + 1 }), {});
    const parts = [
      counts.email && `${counts.email} email${counts.email > 1 ? 's' : ''}`,
      counts.registration && `${counts.registration} registration${counts.registration > 1 ? 's' : ''}`,
      counts.inquiry && `${counts.inquiry} inquir${counts.inquiry > 1 ? 'ies' : 'y'}`,
    ].filter(Boolean);
    notify({ title: `${items.length} new items`, body: parts.join(', '), url: config.paths.inbox });
    return;
  }

  // Oldest first, so they stack in the order they arrived.
  for (const item of [...items].reverse()) notify(item);
}

function remind(digest) {
  if (!digest?.id) return;
  const shown = settings.get('shown') || [];
  if (shown.includes(digest.id)) return;
  settings.set('shown', [...shown, digest.id].slice(-50));
  notify(digest);
}

function notify({ title, body, url }) {
  if (!app.isPackaged) console.log('[notifier] notify:', title, '|', body, '|', url);
  const n = new Notification({ title: String(title || 'InfoTech'), body: String(body || ''), silent: false });
  n.on('click', () => {
    if (url && config.isInternal(url)) open(url);
    else open(null);
  });
  n.show();
}

function setBadge(count) {
  if (count === lastBadge) return;
  if (!app.isPackaged) console.log('[notifier] badge:', count);
  lastBadge = count;
  if (process.platform === 'darwin') {
    app.setBadgeCount(count); // shows on the Dock icon
  } else {
    // Windows has no taskbar number; an overlay dot with the count as its description.
    for (const win of BrowserWindow.getAllWindows()) {
      win.setOverlayIcon(count > 0 ? badgeImage : null, count > 0 ? `${count} unread` : '');
    }
  }
  onBadge(count);
}

function badge() {
  return lastBadge;
}

module.exports = { start, stop, badge };
