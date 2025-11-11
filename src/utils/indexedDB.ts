// src/utils/indexedDB.ts

const DB_NAME = "agrocrm_offline_db";
const DB_VERSION = 1;

export type StoreName = "clients" | "properties" | "visits" | "pending_visits";

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      if (!db.objectStoreNames.contains("clients")) {
        db.createObjectStore("clients", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("properties")) {
        db.createObjectStore("properties", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("visits")) {
        db.createObjectStore("visits", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("pending_visits")) {
        db.createObjectStore("pending_visits", {
          keyPath: "id",
          autoIncrement: true,
        });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function clearStore(store: StoreName): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readwrite");
    const os = tx.objectStore(store);
    os.clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function putManyInStore(
  store: StoreName,
  items: any[]
): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readwrite");
    const os = tx.objectStore(store);

    // Só limpamos para stores de "coleção"
    if (store !== "pending_visits") {
      os.clear();
    }

    for (const item of items) {
      os.put(item);
    }

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getAllFromStore<T = any>(store: StoreName): Promise<T[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readonly");
    const os = tx.objectStore(store);
    const req = os.getAll();

    req.onsuccess = () => {
      resolve(req.result as T[]);
    };
    req.onerror = () => reject(req.error);
  });
}

// ---------- PENDENTES DE SYNC (visitas criadas offline) ----------

export interface PendingVisit {
  id?: number;
  data: any;
  createdAt: number;
}

export async function addPendingVisit(data: any): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("pending_visits", "readwrite");
    const os = tx.objectStore("pending_visits");
    os.add({
      data,
      createdAt: Date.now(),
    } as PendingVisit);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getAllPendingVisits(): Promise<PendingVisit[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("pending_visits", "readonly");
    const os = tx.objectStore("pending_visits");
    const req = os.getAll();

    req.onsuccess = () => {
      resolve(req.result as PendingVisit[]);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function deletePendingVisit(id: number): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("pending_visits", "readwrite");
    const os = tx.objectStore("pending_visits");
    os.delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
