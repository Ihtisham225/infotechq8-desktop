// Electron has no right-click menu of its own; this gives the one people expect
// from a browser: spelling fixes, cut/copy/paste, and link and image actions.

const { Menu, shell, clipboard } = require('electron');

function attach(webContents) {
  webContents.on('context-menu', (_event, p) => {
    const items = [];

    if (p.misspelledWord) {
      for (const word of p.dictionarySuggestions.slice(0, 5)) {
        items.push({ label: word, click: () => webContents.replaceMisspelling(word) });
      }
      items.push({ label: 'Add to Dictionary', click: () => webContents.session.addWordToSpellCheckerDictionary(p.misspelledWord) });
      items.push({ type: 'separator' });
    }

    if (p.linkURL) {
      items.push({ label: 'Open Link in Browser', click: () => shell.openExternal(p.linkURL) });
      items.push({ label: 'Copy Link', click: () => clipboard.writeText(p.linkURL) });
      items.push({ type: 'separator' });
    }

    if (p.mediaType === 'image' && p.srcURL) {
      items.push({ label: 'Save Image As…', click: () => webContents.downloadURL(p.srcURL) });
      items.push({ label: 'Copy Image', click: () => webContents.copyImageAt(p.x, p.y) });
      items.push({ type: 'separator' });
    }

    if (p.isEditable) {
      items.push({ role: 'cut', enabled: p.editFlags.canCut });
      items.push({ role: 'copy', enabled: p.editFlags.canCopy });
      items.push({ role: 'paste', enabled: p.editFlags.canPaste });
      items.push({ role: 'pasteAndMatchStyle', enabled: p.editFlags.canPaste });
      items.push({ role: 'selectAll' });
    } else if (p.selectionText.trim()) {
      items.push({ role: 'copy' });
    }

    while (items.length && items[items.length - 1].type === 'separator') items.pop();
    if (items.length) Menu.buildFromTemplate(items).popup();
  });
}

module.exports = { attach };
