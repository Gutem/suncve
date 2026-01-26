import { openDB, type IDBPDatabase } from 'idb';

const DB_NAME = 'suncve-cache';
const STORE_NAME = 'sqlite-db';
const DB_KEY = 'main-db';

interface CacheDB {
  'sqlite-db': {
    key: string;
    value: {
      data: ArrayBuffer;
      timestamp: number;
      version: string;
    };
  };
}

let dbPromise: Promise<IDBPDatabase<CacheDB>> | null = null;

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB<CacheDB>(DB_NAME, 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      }
    });
  }
  return dbPromise;
}

export async function getCachedDB(): Promise<ArrayBuffer | null> {
  try {
    const db = await getDB();
    const cached = await db.get(STORE_NAME, DB_KEY);
    if (cached) {
      // Cache valid for 24 hours
      const isValid = Date.now() - cached.timestamp < 24 * 60 * 60 * 1000;
      if (isValid) {
        return cached.data;
      }
    }
    return null;
  } catch (error) {
    console.error('Error reading from IndexedDB cache:', error);
    return null;
  }
}

export async function setCachedDB(
  data: ArrayBuffer,
  version: string = '1.0'
): Promise<void> {
  try {
    const db = await getDB();
    await db.put(
      STORE_NAME,
      {
        data,
        timestamp: Date.now(),
        version
      },
      DB_KEY
    );
  } catch (error) {
    console.error('Error writing to IndexedDB cache:', error);
  }
}

export async function clearCache(): Promise<void> {
  try {
    const db = await getDB();
    await db.delete(STORE_NAME, DB_KEY);
  } catch (error) {
    console.error('Error clearing IndexedDB cache:', error);
  }
}
