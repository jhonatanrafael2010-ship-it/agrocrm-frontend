// src/utils/offlineSync.ts

import type { StoreName } from "./indexedDB";
import {
  getAllFromStore,
  putManyInStore,
  addPendingVisit,
  getAllPendingVisits,
  deletePendingVisit,
} from "./indexedDB";


/**
 * Remove barras duplicadas no final.
 * Ex: "/api/" -> "/api"
 */
function normalizeBaseUrl(base: string): string {
  return base.replace(/\/+$/, "");
}

/**
 * Fetch com cache:
 * - Online: busca na API, salva no IndexedDB e retorna
 * - Offline/erro: lê do IndexedDB
 */
export async function fetchWithCache<T = any>(
  url: string,
  store: StoreName
): Promise<T[]> {
  try {
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Erro HTTP ${res.status}`);
    }
    const data = await res.json();
    await putManyInStore(store, data);
    return data as T[];
  } catch (err) {
    console.warn(`⚠️ Offline ou erro na API (${url}), usando cache local:`, err);
    const cached = await getAllFromStore<T>(store);
    return cached;
  }
}

/**
 * Cria uma visita e tenta enviar para o backend.
 * - Se online: POST normal
 * - Se der erro de rede: salva em pending_visits (IndexedDB) para sync depois
 */
export async function createVisitWithSync(
  apiBase: string,
  payload: any
): Promise<any> {
  const base = normalizeBaseUrl(apiBase);

  try {
    const res = await fetch(`${base}/visits`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      throw new Error(`Erro HTTP ${res.status}`);
    }

    const json = await res.json();
    return { ...json, synced: true };
  } catch (err) {
    console.warn("📡 Sem conexão, guardando visita para sincronizar depois.", err);
    await addPendingVisit(payload);
    return {
      offline: true,
      synced: false,
      message: "Visita salva localmente e será enviada quando houver internet.",
    };
  }
}

/**
 * Sincroniza todas as visitas pendentes (criadas offline) com o backend.
 * Chamado no App.tsx quando o evento 'online' dispara.
 */
export async function syncPendingVisits(apiBase: string): Promise<void> {
  const base = normalizeBaseUrl(apiBase);

  if (!navigator.onLine) {
    console.log("🔌 Ainda offline, não sincronizando.");
    return;
  }

  const pendings = await getAllPendingVisits();
  if (!pendings.length) {
    console.log("✅ Nenhuma visita pendente para sincronizar.");
    return;
  }

  console.log(`🚀 Sincronizando ${pendings.length} visitas pendentes...`);

  for (const p of pendings) {
    try {
      const res = await fetch(`${base}/visits`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(p.data),
      });

      if (res.ok) {
        console.log(`✅ Visita pendente ${p.id} sincronizada.`);
        if (typeof p.id === "number") {
          await deletePendingVisit(p.id);
        }
      } else {
        console.warn(
          `⚠️ Falha ao sincronizar visita pendente ${p.id}:`,
          res.status
        );
      }
    } catch (err) {
      console.warn(`⚠️ Erro de rede ao sincronizar visita pendente ${p.id}:`, err);
    }
  }
}
