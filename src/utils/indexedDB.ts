// src/utils/indexedDB.ts

const DB_NAME = "agrocrm_offline_db";
const DB_VERSION = 2; // 🔼 aumente a versão para forçar upgrade no navegador

// 🔹 Todas as stores usadas no app
export type StoreName =
  | "clients"
  | "properties"
  | "plots"
  | "cultures"
  | "varieties"
  | "consultants"
  | "visits"
  | "pending_visits";

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // 🔹 Cria as stores se ainda não existirem
      const storeNames: StoreName[] = [
        "clients",
        "properties",
        "plots",
        "cultures",
        "varieties",
        "consultants",
        "visits",
        "pending_visits",
      ];

      storeNames.forEach((name) => {
        if (!db.objectStoreNames.contains(name)) {
          if (name === "pending_visits") {
            db.createObjectStore(name, {
              keyPath: "id",
              autoIncrement: true,
            });
          } else {
            db.createObjectStore(name, { keyPath: "id" });
          }
        }
      });
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// ============================================================
// 🧹 Limpar store
// ============================================================
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

// ============================================================
// 💾 Inserir vários itens
// ============================================================
export async function putManyInStore(
  store: StoreName,
  items: any[]
): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readwrite");
    const os = tx.objectStore(store);

    // Só limpamos stores de coleção
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


// ============================================================
// ➕ Adicionar item sem limpar a store (usado para salvar visitas offline)
// ============================================================
export async function appendToStore(store: StoreName, item: any): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readwrite");
    const os = tx.objectStore(store);
    os.put(item); // não limpa nada, apenas adiciona ou atualiza
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}


// ============================================================
// 📦 Buscar todos os itens
// ============================================================
export async function getAllFromStore<T = any>(store: StoreName): Promise<T[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readonly");
    const os = tx.objectStore(store);
    const req = os.getAll();

    req.onsuccess = () => resolve(req.result as T[]);
    req.onerror = () => reject(req.error);
  });
}

// ============================================================
// 🔄 PENDENTES DE SYNC (visitas offline)
// ============================================================
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
    req.onsuccess = () => resolve(req.result as PendingVisit[]);
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
