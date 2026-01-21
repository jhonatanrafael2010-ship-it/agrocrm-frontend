// src/utils/indexedDB.ts

// ============================================================
// 📦 Configuração principal do IndexedDB
// ============================================================
const DB_NAME = "agrocrm_offline_db";
const DB_VERSION = 8; // força limpar cache antiga do iOS

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
        // ✅ cria store se não existir
        if (!db.objectStoreNames.contains(name)) {
          if (name === "pending_visits" || name === "pending_photos") {
            db.createObjectStore(name, { keyPath: "id", autoIncrement: true });
          } else {
            const store = db.createObjectStore(name, { keyPath: "id" });

            // ✅ índices da store visits (para cascade)
            if (name === "visits") {
              store.createIndex("parent_id", "parent_id", { unique: false });

              // (opcional, mas recomendado) se você usa plantio no offline:
              store.createIndex("planting_id", "planting_id", { unique: false });
            }
          }
        }
      });

      // ✅ se a store "visits" já existia (upgrade), cria os índices nela também
      if (db.objectStoreNames.contains("visits")) {
        const tx = (event.target as IDBOpenDBRequest).transaction;
        if (tx) {
          const store = tx.objectStore("visits");

          if (!store.indexNames.contains("parent_id")) {
            store.createIndex("parent_id", "parent_id", { unique: false });
          }

          // opcional:
          if (!store.indexNames.contains("planting_id")) {
            store.createIndex("planting_id", "planting_id", { unique: false });
          }
        }
      }

      console.log("🔧 Banco atualizado para versão:", DB_VERSION);
    };


    request.onsuccess = () => {
      const db = request.result;
      // fecha automaticamente quando a aba/app descarregar
      db.onversionchange = () => {
        try { db.close(); } catch {}
      };
      resolve(db);
    };

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
// ❌ Remover VISITA localmente (correção para visitas antigas offline)
// ============================================================
export async function deleteLocalVisit(visitId: number) {
  const db = await openDB();
  const tx = db.transaction("visits", "readwrite");

  tx.objectStore("visits").delete(visitId);

  // ✔ correção para IndexedDB nativo
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}


export async function deleteLocalVisitCascade(parentId: number) {
  const db = await openDB();

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(["visits"], "readwrite");
    const store = tx.objectStore("visits");

    store.delete(parentId);

    const deleteByCursor = (req: IDBRequest<IDBCursorWithValue | null>) => {
      req.onsuccess = (e: any) => {
        const cursor = e.target.result;
        if (!cursor) return;
        store.delete(cursor.primaryKey);
        cursor.continue();
      };
    };

    try {
      const idx = store.index("parent_id");
      deleteByCursor(idx.openCursor(IDBKeyRange.only(parentId)));
    } catch {
      // fallback: varre tudo se não tiver índice
      deleteByCursor(store.openCursor());
    }

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });

  try { db.close(); } catch {}
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
    req.onsuccess = () => resolve(req.result || []);
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

  // GPS offline
  latitude?: number | null;
  longitude?: number | null;
}


export async function savePendingPhoto(photo: PendingPhoto): Promise<void> {
  const db = await openDB();

  // ✅ iOS fallback se randomUUID não existir
  const uuid =
    (globalThis.crypto as any)?.randomUUID?.() ??
    `${Date.now()}_${Math.random().toString(16).slice(2)}`;

  const uniqueName = `${uuid}_${photo.fileName}`;

  return new Promise((resolve, reject) => {
    let tx: IDBTransaction | null = null;

    try {
      tx = db.transaction("pending_photos", "readwrite");
      const store = tx.objectStore("pending_photos");

      store.put({
        ...photo,
        fileName: uniqueName,
      });

      tx.oncomplete = () => {
        try { db.close(); } catch {}
        resolve();
      };

      tx.onerror = () => {
        // ✅ LOG COMPLETO
        const err = tx?.error || new Error("IndexedDB tx.onerror sem tx.error");
        console.error("❌ IndexedDB pending_photos tx.onerror:", err);

        // ✅ Detecta quota cheia
        const name = (err as any)?.name || "";
        const msg = (err as any)?.message || "";
        if (name === "QuotaExceededError" || msg.toLowerCase().includes("quota")) {
          console.warn("⚠️ QuotaExceededError: armazenamento do iOS/Browser cheio.");
        }

        try { db.close(); } catch {}
        reject(err);
      };

      tx.onabort = () => {
        // ✅ LOG COMPLETO
        const err = tx?.error || new Error("IndexedDB tx.onabort sem tx.error");
        console.error("❌ IndexedDB pending_photos tx.onabort:", err);

        const name = (err as any)?.name || "";
        const msg = (err as any)?.message || "";
        if (name === "QuotaExceededError" || msg.toLowerCase().includes("quota")) {
          console.warn("⚠️ QuotaExceededError: armazenamento do iOS/Browser cheio.");
        }

        try { db.close(); } catch {}
        reject(err);
      };
    } catch (err) {
      console.error("❌ Erro ao iniciar transação IndexedDB (savePendingPhoto):", err);
      try { db.close(); } catch {}
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
      resolve(req.result);
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
