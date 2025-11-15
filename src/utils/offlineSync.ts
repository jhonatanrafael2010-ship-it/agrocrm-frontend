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
  dataURLtoBlob
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
 * Criar visita com suporte offline + cronograma
 */
export async function createVisitWithSync(apiBase: string, payload: any): Promise<any> {
  const base = normalizeBaseUrl(apiBase);

  try {
    // ON-LINE
    const res = await fetch(`${base}/visits`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) throw new Error(`Erro HTTP ${res.status}`);

    const json = await res.json();
    return { ...json, synced: true };

  } catch {
    // OFFLINE
    await addPendingVisit(payload);

    const offlineVisit = {
      ...payload,
      id: Date.now() + Math.floor(Math.random() * 1000), // ID REAL OFFLINE
      offline: true,
    };

    offlineVisit.client_name =
      payload.client_name || payload.clientSearch || "Cliente offline";

    offlineVisit.consultant_name =
      payload.consultant_name || "—";

    // 🔥 NOVO — SEM CRONOGRAMA OFFLINE
    await appendToStore("visits", offlineVisit);

    window.dispatchEvent(new Event("visits-updated"));

    return {
      id: offlineVisit.id,      // 🔥 ESSENCIAL
      offline: true,
      synced: false,
      message: "Visita salva localmente. Será sincronizada."
    };
  }
}



/**
 * Criar visita com suporte offline + cronograma
 */
export async function createVisitWithSync(apiBase: string, payload: any): Promise<any> {
  const base = normalizeBaseUrl(apiBase);

  try {
    // =============================
    // 🌐 TENTATIVA ONLINE
    // =============================
    const res = await fetch(`${base}/visits`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      throw new Error(`Erro HTTP ${res.status}`);
    }

    const json = await res.json();

    return {
      ...json,
      synced: true,
      offline: false,
    };

  } catch (err) {
    console.warn("⚠️ Sem internet, salvando visita offline:", err);

    // Marca para posterior sincronização
    await addPendingVisit(payload);

    // Cria ID confiável para o modo offline
    const offlineId = Date.now() + Math.floor(Math.random() * 1000);

    const offlineVisit = {
      ...payload,
      id: offlineId,
      offline: true,
      synced: false,
      client_name: payload.client_name || payload.clientSearch || "Cliente offline",
      consultant_name: payload.consultant_name || "—",
    };

    // Salva a visita local
    await appendToStore("visits", offlineVisit);

    // Atualizar UI
    window.dispatchEvent(new Event("visits-updated"));

    return offlineVisit;
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
      const res = await fetch(`${base}/visits`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(p.data),
      });

      if (res.ok) {
        syncedCount++;
        await deletePendingVisit(p.id!);
      }
    } catch (err) {
      console.warn("⚠️ Erro ao sincronizar visita:", err);
    }
  }

  if (syncedCount > 0) {
    // 🔥 Agora sincroniza fotos após visitas
    await syncPendingPhotos(apiBase);

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
export async function updateVisitWithSync(apiBase: string, visitId: number, payload: any) {
  const base = normalizeBaseUrl(apiBase);

  try {
    const res = await fetch(`${base}/visits/${visitId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) throw new Error("Erro HTTP " + res.status);

    const json = await res.json();
    return { ...json, synced: true };

  } catch (err) {
    // offline → salvar como pending_visit_update
    await addPendingVisit({
      ...payload,
      __update: true,
      visit_id: visitId,
    });

    return {
      id: visitId,
      offline: true,
      synced: false,
      message: "Atualização salva offline",
    };
  }
}