/**
 * IndexedDB store for booking draft payment evidence files.
 *
 * Why IDB and not localStorage: File/Blob objects cannot survive JSON
 * serialization. IDB natively stores binary objects, so we can persist the
 * actual File across drawer open/close without uploading it early.
 *
 * All functions are safe to call from SSR (they no-op when window is absent).
 */

const DB_NAME = "swasana-booking-draft";
const STORE_NAME = "evidence";
const DB_VERSION = 1;

/** Open (or upgrade) the IDB database. Returns null on SSR or on error. */
function openDb(): Promise<IDBDatabase | null> {
  if (typeof window === "undefined" || !("indexedDB" in window)) {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    req.onsuccess = (e) => resolve((e.target as IDBOpenDBRequest).result);
    req.onerror = () => resolve(null);
  });
}

/**
 * Persist a File/Blob under the given key.
 * Key convention used by booking-drawer: `booking-draft-evidence-{sortOrder}`
 */
export async function idbPutEvidence(key: string, file: File): Promise<void> {
  const db = await openDb();
  if (!db) return;

  return new Promise((resolve) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const req = store.put(file, key);
    req.onsuccess = () => resolve();
    req.onerror = () => resolve();
    tx.oncomplete = () => db.close();
  });
}

/**
 * Retrieve a previously stored File/Blob by key.
 * Returns null if not found or on any error (caller must handle gracefully).
 */
export async function idbGetEvidence(key: string): Promise<File | null> {
  const db = await openDb();
  if (!db) return null;

  return new Promise((resolve) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(key);
    req.onsuccess = (e) => {
      const result = (e.target as IDBRequest<File | undefined>).result;
      resolve(result instanceof File ? result : null);
    };
    req.onerror = () => resolve(null);
    tx.oncomplete = () => db.close();
  });
}

/**
 * Remove a single evidence entry from IDB.
 * Called when the user clears a term's evidence or removes the term.
 */
export async function idbDeleteEvidence(key: string): Promise<void> {
  const db = await openDb();
  if (!db) return;

  return new Promise((resolve) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const req = store.delete(key);
    req.onsuccess = () => resolve();
    req.onerror = () => resolve();
    tx.oncomplete = () => db.close();
  });
}

/**
 * Delete ALL evidence entries from the store.
 * Called on draft clear (discard) or after a successful booking submission.
 */
export async function idbClearAllEvidence(): Promise<void> {
  const db = await openDb();
  if (!db) return;

  return new Promise((resolve) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const req = store.clear();
    req.onsuccess = () => resolve();
    req.onerror = () => resolve();
    tx.oncomplete = () => db.close();
  });
}

/** Build the IDB key for a specific term's evidence, keyed by its sortOrder. */
export function evidenceIdbKey(sortOrder: number): string {
  return `booking-draft-evidence-${sortOrder}`;
}
