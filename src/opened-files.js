// Word and PDF files opened with InfoTech from the computer (double-click when
// InfoTech is the default app, or right-click → Open With → InfoTech).
//
// The app keeps the paths here and opens the admin's "Open a file" page, which
// asks for the file through the preload bridge, checks whether the library
// already has it, and uploads it. Only files the operating system handed to us
// are ever read, and only that one page may ask for them.

const fs = require('node:fs/promises');
const path = require('node:path');

const TYPES = {
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.doc': 'application/msword',
  '.pdf': 'application/pdf',
};
const MAX_BYTES = 50 * 1024 * 1024; // the library's upload limit

const queue = [];

/** Picks the openable files out of a command line (Windows passes them as arguments). */
function fromArgv(argv) {
  return argv.slice(1).filter((arg) => !arg.startsWith('-') && TYPES[path.extname(arg).toLowerCase()]);
}

/** Queues a file; false when it isn't a Word/PDF file we can open. */
function add(filePath) {
  if (!filePath || !TYPES[path.extname(filePath).toLowerCase()]) return false;
  const resolved = path.resolve(filePath);
  if (!queue.includes(resolved)) queue.push(resolved);
  return true;
}

function pending() {
  return queue.length > 0;
}

/** The next opened file, read into memory for the page; null when there's none (or it vanished). */
async function take() {
  while (queue.length) {
    const filePath = queue.shift();
    try {
      const stat = await fs.stat(filePath);
      if (!stat.isFile()) continue;
      if (stat.size > MAX_BYTES) {
        return { name: path.basename(filePath), tooBig: true, size: stat.size };
      }
      const data = await fs.readFile(filePath);
      return {
        name: path.basename(filePath),
        type: TYPES[path.extname(filePath).toLowerCase()],
        size: stat.size,
        lastModified: stat.mtimeMs,
        data,
      };
    } catch {
      // moved or deleted since it was opened: try the next one
    }
  }
  return null;
}

module.exports = { fromArgv, add, pending, take };
