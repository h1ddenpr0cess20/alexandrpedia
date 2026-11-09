/**
 * A small persistent cache of the articles a reader has opened, in IndexedDB, so a book chosen once is not
 * fetched again on the next visit. Nothing is fetched or stored until a book is selected. Where there is no
 * IndexedDB (Node, a private window that refuses it) every call quietly does nothing.
 */

const DB = 'alexandrpedia';
const STORE = 'articles';
const VERSION = 1;

let opened = null;

function open() {
  if (!opened) {
    opened = new Promise((resolve) => {
      if (typeof indexedDB === 'undefined') return resolve(null);
      try {
        const request = indexedDB.open(DB, VERSION);
        request.onupgradeneeded = () => request.result.createObjectStore(STORE);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => resolve(null);
        request.onblocked = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  }
  return opened;
}

const run = async (mode, make) => {
  const db = await open();
  if (!db) return undefined;
  return new Promise((resolve) => {
    try {
      const request = make(db.transaction(STORE, mode).objectStore(STORE));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(undefined);
    } catch {
      resolve(undefined);
    }
  });
};

/** The article saved under `id`, or undefined. */
export const readSaved = (id) => run('readonly', (store) => store.get(id));

/** Save an article under `id`. Resolves whether or not it could be kept. */
export const keepSaved = (id, article) => run('readwrite', (store) => store.put(article, id));

/** Forget every saved article. */
export const clearSaved = () => run('readwrite', (store) => store.clear());
