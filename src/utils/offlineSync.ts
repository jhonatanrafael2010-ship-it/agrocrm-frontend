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
  deleteFromStore, // 🔥 NOVO
} from "./indexedDB";

/**
 * Normaliza a URL base da API.
 */
function normalizeBaseUrl(base: string): string {
  if (!base) {
    console.warn("⚠️ API base não definida, usando Render.");
    return "https://agrocrm-backend.onrender.com/api";
  }
  return base.replace(/\/+$/, "");
}

/**
 * Fetch com suporte offline/cache
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
    const cached = await getAllFromStore<T>(store);
    return cached;
  }
}

/**
 * Criar visita com suporte offline
 */
export async function createVisitWithSync(
  apiBase: string,
  payload: any
): Promise<any> {
  const base = normalizeBaseUrl(apiBase);

  try {
    // 🔵 ONLINE
    const res = await fetch(`${base}/visits`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) throw new Error(`Erro HTTP ${res.status}`);

    const json = await res.json();

    const visitOnline = {
      ...json,
      synced: true,
      offline: false,
    };

    // ❗ NÃO precisamos gravar aqui na IndexedDB, porque
    // o Calendar vai chamar fetchWithCache("/visits") depois.
    // Isso evita DataError caso o backend não devolva "id".
    window.dispatchEvent(new Event("visits-updated"));

    return visitOnline;
  } catch (err) {
    console.warn("📴 Criando visita OFFLINE:", err);

    // 🔴 OFFLINE
    const offlineId = Date.now() + Math.floor(Math.random() * 1000);

    // Salva pendente seguindo o formato do IndexedDB:
    await addPendingVisit({
      data: {
        ...payload,
        idOffline: offlineId,
      },
      createdAt: Date.now(),
    });

    const offlineVisit = {
      ...payload,
      id: offlineId,
      offline: true,
      synced: false,
      client_name:
        payload.client_name || payload.clientSearch || "Cliente offline",
      consultant_name: payload.consultant_name || "—",
    };

    // Mantém a visita offline visível no calendário / lista
    await appendToStore("visits", offlineVisit);

    window.dispatchEvent(new Event("visits-updated"));

    return offlineVisit;
  }
}

/**
 * Sincronizar fotos offline
 */
export async function syncPendingPhotos(API_BASE: string) {
  const base = normalizeBaseUrl(API_BASE);
  const photos = await getAllPendingPhotos();
  if (!photos.length) return;

  for (const p of photos) {
    const form = new FormData();
    form.append("photos", dataURLtoBlob(p.dataUrl), p.fileName);

    try {
      const res = await fetch(`${base}/visits/${p.visit_id}/photos`, {
        method: "POST",
        body: form,
      });

      if (res.ok && p.id != null) {
        await deletePendingPhoto(p.id);
      }
    } catch (err) {
      console.warn("⚠️ Erro ao sincronizar foto:", err);
    }
  }
}

/**
 * Sincronizar visitas pendentes (criação + atualização)
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
        // dado pendente corrompido, remove
        if (p.id != null) {
          await deletePendingVisit(p.id);
        }
        continue;
      }

      const isUpdate = payload.__update === true;

      if (isUpdate) {
        // =====================================================
        // 🟡 ATUALIZAÇÃO OFFLINE → PUT /visits/:id
        // =====================================================
        const visitId = payload.visit_id;
        if (!visitId) {
          console.warn(
            "⚠️ Pendência de update sem visit_id, ignorando:",
            payload
          );
          if (p.id != null) {
            await deletePendingVisit(p.id);
          }
          continue;
        }

        // Clona e remove meta-campos antes de enviar
        const bodyToSend = { ...payload };
        delete bodyToSend.__update;
        delete bodyToSend.visit_id;

        const res = await fetch(`${base}/visits/${visitId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(bodyToSend),
        });

        if (!res.ok) {
          console.warn("⚠️ Falha ao sincronizar update de visita:", res.status);
          continue;
        }

        // Não precisamos inserir na store aqui — o fetchWithCache vai atualizar.
        if (p.id != null) {
          await deletePendingVisit(p.id);
        }

        syncedCount++;
      } else {
        // =====================================================
        // 🟢 CRIAÇÃO OFFLINE → POST /visits
        // =====================================================
        const bodyToSend = { ...payload };
        const offlineId = bodyToSend.idOffline;
        if (offlineId) {
          delete bodyToSend.idOffline;
        }

        const res = await fetch(`${base}/visits`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(bodyToSend),
        });

        if (!res.ok) {
          console.warn("⚠️ Falha ao sincronizar criação de visita:", res.status);
          continue;
        }

        const json = await res.json();

        // 🔥 1. Atualizar fotos que estavam com idOffline
        if (offlineId && json?.id) {
          // atualiza fotos pendentes para usarem o ID real
          await updatePendingPhotosVisitId(offlineId, json.id);

          // 🔥 remove a visita offline antiga da store "visits"
          await deleteFromStore("visits", offlineId);
        }

        // ❗ NÃO gravamos json direto na store "visits" aqui.
        // Quem vai trazer a versão certa é o fetchWithCache no final.
        if (p.id != null) {
          await deletePendingVisit(p.id);
        }

        syncedCount++;
      }
    } catch (err) {
      console.warn("⚠️ Erro ao sincronizar visita:", err);
    }
  }

  if (syncedCount > 0) {
    // 🔥 Agora sim, sincroniza fotos (já com visit_id real atualizado)
    await syncPendingPhotos(apiBase);

    // Atualizar visitas na UI — agora só dados do servidor (mais quaisquer offline novas)
    await fetchWithCache(`${base}/visits`, "visits");

    window.dispatchEvent(new Event("visits-synced"));
  }
}

/**
 * Pré-carregar dados offline
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
 * Atualizar visita com suporte offline
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
    console.warn("📴 Salvando atualização de visita OFFLINE:", err);

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
