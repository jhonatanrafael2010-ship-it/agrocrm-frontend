// src/utils/indexedDB.ts

// ============================================================
// 📦 Configuração principal do IndexedDB
// ============================================================
const DB_NAME = "agrocrm_offline_db";
const DB_VERSION = 6; // 🔼 aumente sempre que alterar schema

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

      const stores: StoreName[] = [
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

      stores.forEach((name) => {
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

      console.log("🔧 Banco atualizado para versão:", DB_VERSION);
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// ============================================================
// 🧹 Limpar store inteira
// ============================================================
export async function clearStore(store: StoreName): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readwrite");
    tx.objectStore(store).clear();
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

    // nunca apagar stores críticas
    if (
      navigator.onLine &&
      store !== "visits" &&
      store !== "pending_visits" &&
      store !== "pending_photos"
    ) {
      os.clear();
    }

    for (const item of items) {
      try {
        os.put(item);
      } catch (err) {
        console.warn("⚠ IndexedDB put error:", err, item);
      }
    }

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ============================================================
// ➕ Append (usar para visitas offline)
// ============================================================
export async function appendToStore(store: StoreName, item: any): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readwrite");
    try {
      tx.objectStore(store).put(item);
    } catch (err) {
      console.warn("⚠ appendToStore error:", err);
    }

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ============================================================
// ❌ Remover item
// ============================================================
export async function deleteFromStore(
  store: StoreName,
  id: number | string
): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readwrite");
    tx.objectStore(store).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ============================================================
// 📦 Buscar todos itens
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

export async function addPendingVisit(entry: {
  data: any;
  createdAt: number;
}): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const os = db
      .transaction("pending_visits", "readwrite")
      .objectStore("pending_visits");

    os.add(entry);

    os.transaction.oncomplete = () => resolve();
    os.transaction.onerror = () => reject(os.transaction.error);
  });
}

export async function getAllPendingVisits(): Promise<PendingVisit[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const req = db
      .transaction("pending_visits", "readonly")
      .objectStore("pending_visits")
      .getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function deletePendingVisit(id: number): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("pending_visits", "readwrite");
    tx.objectStore("pending_visits").delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}




// 🔥 Helper: normalizar estrutura das fotos offline
function normalizePendingPhoto(p: any) {
  return {
    id: p.id,
    visit_id: p.visit_id,
    dataUrl: p.dataUrl,
    fileName: p.fileName,
    mime: p.mime,
    caption: p.caption || "",
    pending: true,
    synced: false,
  };
}

// ============================================================
// 📸 PENDENTES — FOTOS
// ============================================================
export interface PendingPhoto {
  id?: number;
  visit_id: number;
  fileName: string;
  mime: string;
  dataUrl: string;
  caption?: string;
  synced: boolean;
}

export async function savePendingPhoto(photo: PendingPhoto): Promise<void> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction("pending_photos", "readwrite");
      const store = tx.objectStore("pending_photos");

      // 🔥 garante que cada foto tenha ID
      if (!photo.id) {
        photo.id = Date.now() + Math.floor(Math.random() * 9999);
      }

      store.put(photo);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    } catch (err) {
      console.warn("Erro ao salvar foto offline:", err, photo);
      reject(err);
    }
  });
}

export async function getAllPendingPhotos(): Promise<PendingPhoto[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const req = db
      .transaction("pending_photos", "readonly")
      .objectStore("pending_photos")
      .getAll();

    req.onsuccess = () =>
      resolve(req.result.map((p) => normalizePendingPhoto(p)));
    req.onerror = () => reject(req.error);
  });
}

export async function deletePendingPhoto(id: number): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("pending_photos", "readwrite");
    tx.objectStore("pending_photos").delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ============================================================
// 🧪 Base64 → Blob
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

// ============================================================
// 🔄 Atualizar visit_id das fotos offline quando sincronizar
// ============================================================
export async function updatePendingPhotosVisitId(
  oldId: number,
  newId: number
) {
  const photos = await getAllPendingPhotos();
  const db = await openDB();

  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction("pending_photos", "readwrite");
    const store = tx.objectStore("pending_photos");

    photos.forEach((p) => {
      if (p.visit_id === oldId) {
        store.put({ ...p, visit_id: newId });
      }
    });

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
