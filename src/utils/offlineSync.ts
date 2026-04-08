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

function isTemporaryOfflineId(value: any): boolean {
  const n = Number(value);
  if (!n || Number.isNaN(n)) return false;
  return n > 1000000000000;
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

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`POST ${base}/visits falhou: HTTP ${res.status} - ${text}`);
    }

    const json = await res.json();
    const realVisit = json.visit || json;
    const realId = Number(realVisit.id);

    await appendToStore("visits", {
      ...realVisit,
      id: realId,
      offline: false,
      synced: true,
    });

    window.dispatchEvent(new Event("visits-updated"));

    return { ...realVisit, id: realId, synced: true, offline: false };
  } catch (err: any) {
    const message = String(err?.message || "");

    const isNetworkError =
      message.includes("Failed to fetch") ||
      message.includes("NetworkError") ||
      message.includes("Load failed") ||
      message.includes("fetch");

    if (!isNetworkError) {
      console.error("❌ Erro real do backend ao criar visita:", err);
      throw err;
    }

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

    await appendToStore("visits", offlineVisit);

    window.dispatchEvent(new Event("visits-updated"));

    return offlineVisit;
  }
}


/**
 * Sincronizar fotos offline
 */
export async function syncPendingPhotos(
  apiBase: string
): Promise<{ synced: number; failed: number }> {
  const base = normalizeBaseUrl(apiBase);
  const photos = await getAllPendingPhotos();

  if (!photos.length) {
    return { synced: 0, failed: 0 };
  }

  let syncedCount = 0;
  let failedCount = 0;

  for (const p of photos) {
    const form = new FormData();
    form.append("photos", dataURLtoBlob(p.dataUrl), p.fileName);
    form.append("captions", p.caption || "");

    if (p.latitude != null) {
      form.append("latitude", String(p.latitude));
    }
    if (p.longitude != null) {
      form.append("longitude", String(p.longitude));
    }

    try {
      const res = await fetch(`${base}/visits/${p.visit_id}/photos`, {
        method: "POST",
        body: form,
      });

      if (res.ok && p.id != null) {
        await deletePendingPhoto(p.id);
        syncedCount++;
      } else {
        failedCount++;
      }
    } catch (err) {
      console.warn("⚠ Erro ao sincronizar foto:", err);
      failedCount++;
    }
  }

  return { synced: syncedCount, failed: failedCount };
}


/**
 * Sincronizar visitas pendentes
 */
export async function syncPendingVisits(
  apiBase: string
): Promise<{ synced: number; failed: number }> {
  const base = normalizeBaseUrl(apiBase);

  if (!navigator.onLine) return { synced: 0, failed: 0 };

  const pendings = await getAllPendingVisits();
  if (!pendings.length) return { synced: 0, failed: 0 };

  let syncedCount = 0;
  let failedCount = 0;

  for (const p of pendings) {
    try {
      const payload = p.data;
      if (!payload) {
        if (p.id != null) await deletePendingVisit(p.id);
        continue;
      }

      const isUpdate = payload.__update === true;

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

        if (!res.ok) {
          const text = await res.text().catch(() => "");
          console.error(`❌ Falha sync PUT visita ${visitId}:`, res.status, text);
          failedCount++;
          continue;
        }

        const resp = await res.json().catch(() => null);
        const serverVisit = resp?.visit || resp || { id: visitId, ...bodyToSend };

        await appendToStore("visits", {
          ...serverVisit,
          id: Number(serverVisit.id || visitId),
          synced: true,
          offline: false,
        });

        if (p.id != null) await deletePendingVisit(p.id);
        syncedCount++;
        continue;
      }

      const bodyToSend = { ...payload };
      const offlineId = bodyToSend.idOffline;

      if (offlineId) delete bodyToSend.idOffline;

      const res = await fetch(`${base}/visits`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bodyToSend),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        console.error(`❌ Falha sync POST visita offline ${offlineId}:`, res.status, text);
        failedCount++;
        continue;
      }

      const resp = await res.json();
      const serverVisit = resp.visit || resp;
      const realId = Number(serverVisit.id);

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
      failedCount++;
    }
  }

  if (syncedCount > 0) {
    await syncPendingPhotos(apiBase);
    await fetchWithCache(`${base}/visits?scope=all`, "visits");
    window.dispatchEvent(new Event("visits-synced"));
  }

  return { synced: syncedCount, failed: failedCount };
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

  if (isTemporaryOfflineId(visitId)) {
    const localVisits = await getAllFromStore<any>("visits");
    const existing = localVisits.find((v) => Number(v.id) === Number(visitId));

    if (!existing) {
      throw new Error(`Visita offline ${visitId} não encontrada no IndexedDB.`);
    }

    const updatedLocalVisit = {
      ...existing,
      ...payload,
      id: existing.id,
      offline: true,
      synced: false,
    };

    await appendToStore("visits", updatedLocalVisit);

    const pendings = await getAllPendingVisits();
    const pendingCreate = pendings.find(
      (p) => Number(p?.data?.idOffline) === Number(visitId) && p?.data?.__update !== true
    );

    if (pendingCreate?.id != null) {
      await deletePendingVisit(pendingCreate.id);
      await addPendingVisit({
        data: { ...updatedLocalVisit, idOffline: visitId },
        createdAt: Date.now(),
      });
    }

    window.dispatchEvent(new Event("visits-updated"));

    return {
      ...updatedLocalVisit,
      synced: false,
      offline: true,
      message: "Visita offline atualizada localmente",
    };
  }

  try {
    const res = await fetch(`${base}/visits/${visitId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`PUT ${base}/visits/${visitId} falhou: HTTP ${res.status} - ${text}`);
    }

    const json = await res.json();
    const updated = json.visit || json;

    await appendToStore("visits", {
      ...updated,
      id: Number(updated.id || visitId),
      offline: false,
      synced: true,
    });

    window.dispatchEvent(new Event("visits-updated"));

    return { ...updated, synced: true, offline: false };
  } catch (err: any) {
    const message = String(err?.message || "");

    const isNetworkError =
      message.includes("Failed to fetch") ||
      message.includes("NetworkError") ||
      message.includes("Load failed") ||
      message.includes("fetch");

    if (!isNetworkError) {
      console.error("❌ Erro real do backend ao atualizar visita:", err);
      throw err;
    }

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
