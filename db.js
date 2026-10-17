// Archivio locale (IndexedDB): tutto resta sul telefono.
const DB_NAME = 'armadio';
const DB_VERSION = 1;
const STORES = ['categories', 'items', 'outfits', 'meta'];

let dbPromise = null;

function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('categories')) db.createObjectStore('categories', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('items')) {
        const s = db.createObjectStore('items', { keyPath: 'id' });
        s.createIndex('categoryId', 'categoryId');
      }
      if (!db.objectStoreNames.contains('outfits')) db.createObjectStore('outfits', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta', { keyPath: 'key' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function done(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('Operazione annullata'));
  });
}

function reqP(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function getAll(store) {
  const db = await openDb();
  return reqP(db.transaction(store).objectStore(store).getAll());
}

export async function put(store, value) {
  const db = await openDb();
  const tx = db.transaction(store, 'readwrite');
  tx.objectStore(store).put(value);
  return done(tx);
}

export async function getMeta(key) {
  const db = await openDb();
  const row = await reqP(db.transaction('meta').objectStore('meta').get(key));
  return row ? row.value : undefined;
}

export async function setMeta(key, value) {
  return put('meta', { key, value });
}

/** Elimina capi e outfit in un'unica transazione. */
export async function removeMany({ categoryIds = [], itemIds = [], outfitIds = [] }) {
  const db = await openDb();
  const tx = db.transaction(['categories', 'items', 'outfits'], 'readwrite');
  categoryIds.forEach((id) => tx.objectStore('categories').delete(id));
  itemIds.forEach((id) => tx.objectStore('items').delete(id));
  outfitIds.forEach((id) => tx.objectStore('outfits').delete(id));
  return done(tx);
}

/** Sostituisce tutto l'archivio (usato dall'importazione del backup). */
export async function replaceAll({ categories, items, outfits }) {
  const db = await openDb();
  const tx = db.transaction(['categories', 'items', 'outfits'], 'readwrite');
  for (const s of ['categories', 'items', 'outfits']) tx.objectStore(s).clear();
  categories.forEach((c) => tx.objectStore('categories').put(c));
  items.forEach((i) => tx.objectStore('items').put(i));
  outfits.forEach((o) => tx.objectStore('outfits').put(o));
  return done(tx);
}

export { STORES };
