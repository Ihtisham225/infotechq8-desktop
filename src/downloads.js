// Invoices, letters, outlines and reports: ask where to save, then offer Open / Show in folder.

const { app, dialog, shell, BrowserWindow } = require('electron');
const path = require('node:path');

function attach(session) {
  session.on('will-download', (_event, item, webContents) => {
    const win = BrowserWindow.fromWebContents(webContents) || BrowserWindow.getAllWindows()[0];

    item.setSaveDialogOptions({
      title: 'Save file',
      defaultPath: path.join(app.getPath('downloads'), item.getFilename()),
    });

    item.on('updated', () => {
      if (!win || win.isDestroyed()) return;
      const total = item.getTotalBytes();
      win.setProgressBar(total > 0 ? item.getReceivedBytes() / total : 2); // 2 = indeterminate
    });

    item.once('done', async (_e, state) => {
      if (win && !win.isDestroyed()) win.setProgressBar(-1);
      if (state === 'cancelled') return; // they closed the save dialog
      const file = item.getSavePath();
      const name = path.basename(file || item.getFilename());

      if (state !== 'completed') {
        dialog.showMessageBox(win, {
          type: 'error',
          message: `${name} could not be downloaded.`,
          detail: 'Check the internet connection and try again.',
        });
        return;
      }

      if (process.platform === 'darwin') app.dock.downloadFinished(file);

      const { response } = await dialog.showMessageBox(win, {
        type: 'info',
        message: `${name} is saved.`,
        detail: file,
        buttons: ['Open', 'Show in folder', 'Close'],
        defaultId: 0,
        cancelId: 2,
      });
      if (response === 0) {
        const error = await shell.openPath(file);
        if (error) dialog.showMessageBox(win, { type: 'error', message: `${name} could not be opened.`, detail: error });
      } else if (response === 1) {
        shell.showItemInFolder(file);
      }
    });
  });
}

module.exports = { attach };
