// db.ts
import { openDB } from 'idb';

export const DB_NAME = 'agrocrm';
export const DB_VERSION = 3; // aumente quando mudar estrutura

export async function getDB() {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) { // 🔧 removido oldVersion
      if (!db.objectStoreNames.contains('clients')) db.createObjectStore('clients', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('properties')) db.createObjectStore('properties', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('plots')) db.createObjectStore('plots', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('visits')) db.createObjectStore('visits', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('varieties')) db.createObjectStore('varieties', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('cultures')) db.createObjectStore('cultures', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('photos')) db.createObjectStore('photos', { keyPath: 'id' });
    },
  });
}
