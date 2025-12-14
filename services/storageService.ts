const DB_NAME = 'WaifuGameDB';
const STORE_NAME = 'sessions';
const DB_VERSION = 1;

// Initialize the database
export const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'sessionId' });
      }
    };
  });
};

// Save a single session
export const saveSession = async (session: any): Promise<void> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    // Clone to ensure clean object
    const request = store.put(JSON.parse(JSON.stringify(session)));
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
};

// Get all sessions
export const getAllSessions = async (): Promise<any[]> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    // Sort by lastUpdated desc manually after fetch usually, or use index
    const request = store.getAll();
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
        const results = request.result;
        // Sort by date descending (newest first)
        results.sort((a: any, b: any) => b.lastUpdated - a.lastUpdated);
        resolve(results);
    };
  });
};

// Delete a session
export const deleteSession = async (sessionId: string): Promise<void> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(sessionId);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
};

// Migrate from LocalStorage if needed
export const migrateFromLocalStorage = async (key: string) => {
    try {
        const json = localStorage.getItem(key);
        if (json) {
            const data = JSON.parse(json);
            if (Array.isArray(data)) {
                for (const session of data) {
                    await saveSession(session);
                }
            }
            localStorage.removeItem(key); // Clear after migration
            console.log("Migrated history to IndexedDB");
        }
    } catch (e) {
        console.warn("Migration failed or no data", e);
    }
};