# InfoTech desktop

The InfoTech admin (`https://infotechq8.com/admin`) as a Mac and Windows app.
All data and logic stay on the server; the app is a secure window onto it plus
the things a browser tab can't do. Plan: *InfoTech Desktop App — Plan* (Claude Docs).

The website itself lives in the private `infotechq8` repository; this repository
is public on purpose, so installed apps can read its GitHub Releases for updates
without a token. It holds no secrets.

## Phase 1 — what's in it

| Plan item | Where |
| --- | --- |
| Main window: InfoTech name and icon, remembers size and position, keeps the login | `src/main.js`, `src/window-state.js` (login: Laravel's 30-day session cookie, kept by Electron's persistent session) |
| Stays on InfoTech: only infotechq8.com opens inside, every other link opens in the browser | `src/config.js`, `guard()` in `src/main.js` |
| Downloads: ask where to save, then *Open* / *Show in folder* | `src/downloads.js` |
| Printing and PDF previews | File → Print (⌘P / Ctrl+P), Chromium's PDF viewer (`plugins: true`) |
| No internet screen with *Try again*, reconnects by itself | `src/offline.html` |
| Menus and shortcuts, right-click menu | `src/menu.js`, `src/context-menu.js` |
| Automatic updates, installed on the next restart | `src/updater.js` (electron-updater, GitHub Releases) |
| Installers: `.dmg` (Apple Silicon + Intel), `.exe` (Windows) | `package.json` → `build`, `.github/workflows/build.yml` |

## Phase 2 — notifications and extras

| Plan item | Where |
| --- | --- |
| A notification for each new email, registration and inquiry; clicking opens it | `src/notifier.js`, polling `GET /admin/desktop/notifications` every minute with the window's own login |
| Follow-ups due: one reminder a day | the feed's `digest`; shown once per day (`src/settings.js` remembers it) |
| Unread count on the Dock (Mac) / a dot on the taskbar (Windows) | `setBadge()` in `src/notifier.js`; opening the Inbox / lists resets it on the server |
| Tray / menu bar: open, compose, inbox, quiet mode, start at login, quit | `src/tray.js` |
| Compose from anywhere: ⌘⌥⇧E / Ctrl+Alt+Shift+E | `globalShortcut` in `src/main.js` |
| Drag files onto an email to attach them | the website's Compose page (works in a browser too) |
| Start at login, in the background | `src/login-item.js` (off until turned on) |

Closing the window keeps InfoTech running (Mac and Windows) so notifications keep
arriving; quit from the app menu or the tray. Quiet Mode stops pop-ups but keeps the
badge. The feed needs the website from infotechq8 PR #24 or later; against an older
server the app simply shows no notifications.

Shortcuts: ⌘N / Ctrl+N Compose email · ⌘1 Dashboard · ⌘2 Inbox · ⌘3 Compose ·
⌘[ / ⌘] back and forward · ⌘P print.

The app adds `InfoTechDesktop/<version>` to its user agent and exposes
`window.infotechDesktop = { version, platform }`, so the admin can tell it is
running inside the app (plan: "App detection").

Security: context isolation, sandboxed preload, no Node.js in the page, no
`<webview>`, and only infotechq8.com may ask for permissions (clipboard,
notifications, full screen).

## Run it

```bash
npm install
npm start                 # opens the live admin
npm run dev               # opens http://127.0.0.1:8000/dashboard (php artisan serve), with its own profile
```

`INFOTECH_URL=<url> npm start` points a dev run anywhere; packaged builds always
use the live site.

## Build installers locally

```bash
npm run dist:mac          # release/InfoTech-<version>-arm64.dmg and -x64.dmg
npm run dist:win          # release/InfoTech-Setup-<version>.exe (best built on CI)
npm run dist:dir          # unpacked app only, quickest to try
```

## Releasing

Tag a version and push the tag; GitHub Actions builds both platforms and attaches
the installers and update manifests to a GitHub Release:

```bash
git tag v0.1.0 && git push origin v0.1.0
```

The tag decides the version (`.github/scripts/version-from-tag.mjs`); the number in
`package.json` is a placeholder for local runs. Installed apps check for a new
release on start and every six hours, download it in the background and install it
on the next quit.

Keep this repository public: electron-updater reads its releases without a
token. A private download page on the website can host the installers for the
first install either way.

### Signing (repository secrets)

| Secret | For |
| --- | --- |
| `CSC_LINK` | Apple Developer ID Application certificate (.p12, base64) |
| `APPLE_API_KEY`, `APPLE_API_KEY_ID`, `APPLE_API_ISSUER`, `APPLE_TEAM_ID` | Notarisation (App Store Connect API key) |
| `WIN_CSC_LINK`, `WIN_CSC_KEY_PASSWORD` | Optional Windows certificate |

Without the Apple secrets the Mac build is unsigned: macOS blocks the first open
(System Settings → Privacy & Security → *Open Anyway*, or
`xattr -cr /Applications/InfoTech.app`). Without a Windows certificate,
SmartScreen asks once (*More info → Run anyway*).
