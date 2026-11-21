# App icon

`build/icon.png` (1024×1024) is concept **C · Stacked**: "info" over "Tech" in the
website's typeface, Instrument Sans Bold (SIL Open Font License, see
`InstrumentSans-OFL.txt`), with the logo's square gold dot on the i and a navy/gold
corner arc. electron-builder turns it into the Mac `.icns` and Windows `.ico`.

To regenerate (needs Python 3 with Pillow):

```bash
curl -sSL -o InstrumentSans.ttf "https://github.com/google/fonts/raw/main/ofl/instrumentsans/InstrumentSans%5Bwdth%2Cwght%5D.ttf"
python3 make_icons.py InstrumentSans.ttf .   # writes icon-A/B/C.png and concepts.png
```

Then copy `icon-C.png` to `build/icon.png`, and 256 px / 32 px versions to
`src/assets/icon.png` and `src/assets/tray.png`. The Mac menu-bar icon
(`src/assets/trayTemplate*.png`) stays a plain black template image, as macOS expects.
