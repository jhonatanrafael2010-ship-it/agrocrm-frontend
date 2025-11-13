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

    // Cronograma fenológico gerado offline
    if (payload.genPheno || payload.generate_schedule) {
      const stages = [
        { name: "Plantio", days: 0 },
        { name: "Emergência", days: 7 },
        { name: "V2", days: 14 },
        { name: "V5", days: 21 },
        { name: "R1", days: 35 },
        { name: "R5", days: 50 },
        { name: "R8", days: 65 },
      ];

      const baseDate = new Date(payload.date);

      for (const stage of stages) {
        const newDate = new Date(baseDate);
        newDate.setDate(baseDate.getDate() + stage.days);

        const stageVisit = {
          ...offlineVisit,
          id: Date.now() + Math.floor(Math.random() * 10000),
          date: newDate.toISOString().slice(0, 10),
          recommendation: stage.name,
        };

        await appendToStore("visits", stageVisit);
      }
    } else {
      await appendToStore("visits", offlineVisit);
    }

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
 * Sincronizar fotos armazenadas offline
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

      if (res.ok) {
        await deletePendingPhoto(p.id);
      }
    } catch (err) {
      console.warn("⚠️ Erro ao sincronizar foto:", err);
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
