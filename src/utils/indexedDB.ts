// src/utils/indexedDB.ts

// ============================================================
// 📦 Configuração principal do IndexedDB
// ============================================================
const DB_NAME = "agrocrm_offline_db";
const DB_VERSION = 4; // 🔼 aumente sempre que alterar stores

// 🔹 Todas as stores válidas
export type StoreName =
  | "clients"
  | "properties"
  | "plots"
  | "cultures"
  | "varieties"
  | "consultants"
  | "visits"
  | "pending_visits"
  | "pending_photos";


// ============================================================
// 🔓 Abrir banco
// ============================================================
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // --- Stores principais para dados sincronizáveis
      const mainStores: StoreName[] = [
        "clients",
        "properties",
        "plots",
        "cultures",
        "varieties",
        "consultants",
        "visits",
        "pending_visits",
        "pending_photos",
      ];

      mainStores.forEach((name) => {
        if (!db.objectStoreNames.contains(name)) {
          if (name === "pending_visits" || name === "pending_photos") {
            db.createObjectStore(name, {
              keyPath: "id",
              autoIncrement: true,
            });
          } else {
            db.createObjectStore(name, { keyPath: "id" });
          }
        }
      });

      console.log("🔧 Banco atualizado:", DB_VERSION);
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
    tx.objectStore(store).clear();
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}


// ============================================================
// 💾 Inserir vários itens (com limpeza automática se online)
// ============================================================
export async function putManyInStore(
  store: StoreName,
  items: any[]
): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readwrite");
    const os = tx.objectStore(store);

    // ⚠️ Nunca limpar stores de pendências
    if (navigator.onLine && store !== "pending_visits" && store !== "pending_photos") {
      os.clear();
    }

    items.forEach((item) => os.put(item));

    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}


// ============================================================
// ➕ Append (sem limpar, usado p/ visitas offline)
// ============================================================
export async function appendToStore(store: StoreName, item: any): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readwrite");
    tx.objectStore(store).put(item);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}


// ============================================================
// 📦 Buscar todos os itens
// ============================================================
export async function getAllFromStore<T = any>(store: StoreName): Promise<T[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const req = db.transaction(store, "readonly").objectStore(store).getAll();
    req.onsuccess = () => resolve(req.result as T[]);
    req.onerror = () => reject(req.error);
  });
}


// ============================================================
// 🔄 PENDENTES — VISITAS
// ============================================================
export interface PendingVisit {
  id?: number;
  data: any;
  createdAt: number;
}

export async function addPendingVisit(data: any): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const os = db.transaction("pending_visits", "readwrite").objectStore("pending_visits");
    os.add({ data, createdAt: Date.now() });
    os.transaction.oncomplete = resolve;
    os.transaction.onerror = () => reject(os.transaction.error);
  });
}

export async function getAllPendingVisits(): Promise<PendingVisit[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const req = db.transaction("pending_visits", "readonly").objectStore("pending_visits").getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function deletePendingVisit(id: number): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("pending_visits", "readwrite");
    tx.objectStore("pending_visits").delete(id);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}


// ============================================================
// 📸 PENDENTES — FOTOS OFFLINE
// ============================================================
export interface PendingPhoto {
  id?: number;
  visit_id: number;
  fileName: string;
  mime: string;
  dataUrl: string;
  synced: boolean;
}

export async function savePendingPhoto(photo: PendingPhoto): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("pending_photos", "readwrite");
    tx.objectStore("pending_photos").add(photo);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}

export async function getAllPendingPhotos(): Promise<PendingPhoto[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const req = db.transaction("pending_photos", "readonly").objectStore("pending_photos").getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function deletePendingPhoto(id: number): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("pending_photos", "readwrite");
    tx.objectStore("pending_photos").delete(id);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}


// ============================================================
// 🧪 Converter Base64 → Blob (para upload)
// ============================================================
export function dataURLtoBlob(dataUrl: string): Blob {
  const parts = dataUrl.split(",");
  const mimeMatch = parts[0].match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : "image/jpeg";

  const binary = atob(parts[1]);
  const len = binary.length;
  const buffer = new Uint8Array(len);

  for (let i = 0; i < len; i++) {
    buffer[i] = binary.charCodeAt(i);
  }

  return new Blob([buffer], { type: mime });
}
