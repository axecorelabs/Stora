// Thin IndexedDB wrapper for the Add Inventory draft system. IndexedDB,
// not localStorage: a draft's imagePreviews/selectedImages hold real
// File objects (client-compressed, up to 10 x ~2MB), which IndexedDB
// stores natively via structured clone -- localStorage only stores
// strings (forcing a ~33% bigger base64 re-encode) and caps out around
// 5-10MB, nowhere near enough for a multi-image product.
//
// One row per draft key (`${userId}:${context}` -- see useInventoryDraft),
// not a drafts list: this is a single "resume what you were just doing"
// slot, not a saved-drafts feature.

const DB_NAME = 'stora-inventory-drafts';
const DB_VERSION = 1;
const STORE_NAME = 'drafts';

let dbPromise = null;

function openDb() {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is not available in this environment'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  // A failed open (private browsing, quota, disabled storage) shouldn't
  // permanently wedge every future call -- let the next call retry.
  dbPromise.catch(() => {
    dbPromise = null;
  });

  return dbPromise;
}

export async function saveDraft(key, data) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put({ ...data, savedAt: Date.now() }, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function loadDraft(key) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const request = tx.objectStore(STORE_NAME).get(key);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

export async function clearDraft(key) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
