// src/utils/offlineSync.ts

import type { StoreName } from "./indexedDB";

import {
  getAllFromStore,
  putManyInStore,
  addPendingVisit,
  getAllPendingVisits,
  deletePendingVisit,
  appendToStore,
  getAllPendingPhotos,
  deletePendingPhoto,
  dataURLtoBlob,
  updatePendingPhotosVisitId,
  deleteFromStore,
} from "./indexedDB";

/**
 * Normaliza URL
 */
function normalizeBaseUrl(base: string): string {
  if (!base) {
    return "https://agrocrm-backend.onrender.com/api";
  }
  return base.replace(/\/+$/, "");
}

/**
 * Fetch com cache e fallback offline
 */
export async function fetchWithCache<T = any>(
  url: string,
  store: StoreName
): Promise<T[]> {
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`Erro HTTP ${res.status}`);

    const data = await res.json();
    await putManyInStore(store, data);
    return data as T[];
  } catch {
    return await getAllFromStore<T>(store);
  }
}

/**
 * Criar visita com suporte offline
 */
export async function createVisitWithSync(apiBase: string, payload: any) {
  const base = normalizeBaseUrl(apiBase);

  try {
    const res = await fetch(`${base}/visits`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) throw new Error(`Erro HTTP ${res.status}`);

    const json = await res.json();

    const realVisit = json.visit || json;   // ← pega sempre o objeto real
    const realId = Number(realVisit.id);

    window.dispatchEvent(new Event("visits-updated"));

    return { ...realVisit, id: realId, synced: true, offline: false };

  } catch {
    // 🔥 modo offline
    const offlineId = Date.now() + Math.floor(Math.random() * 9999);

    await addPendingVisit({
      data: { ...payload, idOffline: offlineId },
      createdAt: Date.now(),
    });

    const offlineVisit = {
      ...payload,
      id: offlineId,
      offline: true,
      synced: false,
      client_name: payload.client_name || payload.clientSearch || "Cliente offline",
      consultant_name: payload.consultant_name || "—",
    };

    // salva a visita offline localmente
    await appendToStore("visits", offlineVisit);

    window.dispatchEvent(new Event("visits-updated"));

    return offlineVisit;
  }

}


/**
 * Sincronizar fotos offline
 */
export async function syncPendingPhotos(apiBase: string) {
  const base = normalizeBaseUrl(apiBase);
  const photos = await getAllPendingPhotos();
  if (!photos.length) return;

  for (const p of photos) {
    const form = new FormData();
    form.append("photos", dataURLtoBlob(p.dataUrl), p.fileName);
    form.append("captions", p.caption || "");

    try {
      const res = await fetch(`${base}/visits/${p.visit_id}/photos`, {
        method: "POST",
        body: form,
      });

      if (res.ok && p.id != null) {
        await deletePendingPhoto(p.id);
      }
    } catch (err) {
      console.warn("⚠ Erro ao sincronizar foto:", err);
    }
  }
}

/**
 * Sincronizar visitas pendentes
 */
export async function syncPendingVisits(apiBase: string): Promise<void> {
  const base = normalizeBaseUrl(apiBase);

  if (!navigator.onLine) return;

  const pendings = await getAllPendingVisits();
  if (!pendings.length) return;

  let syncedCount = 0;

  for (const p of pendings) {
    try {
      const payload = p.data;
      if (!payload) {
        if (p.id != null) await deletePendingVisit(p.id);
        continue;
      }

      const isUpdate = payload.__update === true;

      // =====================================================
      // 🟡 Atualização offline
      // =====================================================
      if (isUpdate) {
        const visitId = payload.visit_id;

        if (!visitId) {
          if (p.id != null) await deletePendingVisit(p.id);
          continue;
        }

        const bodyToSend = { ...payload };
        delete bodyToSend.__update;
        delete bodyToSend.visit_id;

        const res = await fetch(`${base}/visits/${visitId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(bodyToSend),
        });

        if (!res.ok) continue;

        if (p.id != null) await deletePendingVisit(p.id);
        syncedCount++;
        continue;
      }

      // =====================================================
      // 🟢 Criação offline
      // =====================================================
      const bodyToSend = { ...payload };
      const offlineId = bodyToSend.idOffline;

      if (offlineId) delete bodyToSend.idOffline;

      const res = await fetch(`${base}/visits`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bodyToSend),
      });

      if (!res.ok) continue;

      const resp = await res.json();
      const serverVisit = resp.visit || resp;
      const realId = Number(serverVisit.id);

      // 🔥 atualizar fotos offline com o ID certo + substituir visita no IndexedDB
      if (offlineId && realId) {
          await updatePendingPhotosVisitId(offlineId, realId);
          await deleteFromStore("visits", offlineId);
          await appendToStore("visits", {
              ...serverVisit,
              id: realId,
              synced: true,
              offline: false,
          });
      }

      if (p.id != null) await deletePendingVisit(p.id);
      syncedCount++;
    } catch (err) {
      console.warn("⚠ Sync erro:", err);
    }
  }

  if (syncedCount > 0) {
    await syncPendingPhotos(apiBase);
    await fetchWithCache(`${base}/visits`, "visits");
    window.dispatchEvent(new Event("visits-synced"));
  }
}

/**
 * Carregar dados para usar offline
 */
export async function preloadOfflineData(apiBase: string): Promise<void> {
  const base = normalizeBaseUrl(apiBase);

  const endpoints: [string, StoreName][] = [
    [`${base}/clients`, "clients"],
    [`${base}/properties`, "properties"],
    [`${base}/plots`, "plots"],
    [`${base}/cultures`, "cultures"],
    [`${base}/varieties`, "varieties"],
    [`${base}/consultants`, "consultants"],
    [`${base}/visits`, "visits"],
  ];

  for (const [url, store] of endpoints) {
    await fetchWithCache(url, store);
  }
}

/**
 * Atualização de visita com suporte offline
 */
export async function updateVisitWithSync(
  apiBase: string,
  visitId: number,
  payload: any
) {
  const base = normalizeBaseUrl(apiBase);

  try {
    const res = await fetch(`${base}/visits/${visitId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) throw new Error("Erro HTTP " + res.status);

    const json = await res.json();
    return { ...json, synced: true, offline: false };
  } catch (err) {
    console.warn("📴 Salvando atualização OFFLINE:", err);

    await addPendingVisit({
      data: {
        ...payload,
        __update: true,
        visit_id: visitId,
      },
      createdAt: Date.now(),
    });

    return {
      id: visitId,
      offline: true,
      synced: false,
      message: "Atualização salva offline",
    };
  }
}
