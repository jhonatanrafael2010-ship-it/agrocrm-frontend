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
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`Erro HTTP ${res.status}`);

    const data = await res.json();
    await putManyInStore(store, data);

    console.log(`📦 ${data.length} registros salvos no cache (${store})`);
    return data as T[];
  } catch (err) {
    console.warn(`⚠️ Offline ou erro na API (${store}), usando cache local.`);
    try {
      const cached = await getAllFromStore<T>(store);
      console.log(`💾 ${cached.length} registros carregados do cache (${store})`);
      return cached;
    } catch (cacheErr) {
      console.error(`❌ Erro ao ler cache (${store}):`, cacheErr);
      return [];
    }
  }
}

/**
 * Cria uma visita e tenta enviar para o backend.
 * - Se online: POST normal
 * - Se offline: salva em pending_visits (IndexedDB) para sync depois
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

    if (!res.ok) throw new Error(`Erro HTTP ${res.status}`);

    const json = await res.json();
    console.log("✅ Visita criada online:", json);
    return { ...json, synced: true };
  } catch (err) {
    console.warn("📡 Sem conexão, salvando visita localmente:", err);
    await addPendingVisit(payload);
    return {
      offline: true,
      synced: false,
      message: "Visita salva localmente. Será enviada quando houver internet.",
    };
  }
}

/**
 * Sincroniza todas as visitas pendentes (criadas offline) com o backend.
 * Chamado automaticamente no App.tsx quando reconectar.
 */
export async function syncPendingVisits(apiBase: string): Promise<void> {
  const base = normalizeBaseUrl(apiBase);

  if (!navigator.onLine) {
    console.log("🔌 Ainda offline — não sincronizando.");
    return;
  }

  const pendings = await getAllPendingVisits();
  if (!pendings.length) {
    console.log("✅ Nenhuma visita pendente para sincronizar.");
    return;
  }

  console.log(`🚀 Iniciando sync de ${pendings.length} visitas pendentes...`);
  let syncedCount = 0;

  for (const p of pendings) {
    try {
      const res = await fetch(`${base}/visits`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(p.data),
      });

      if (res.ok) {
        console.log(`✅ Visita pendente ${p.id} sincronizada com sucesso.`);
        syncedCount++;
        if (typeof p.id === "number") await deletePendingVisit(p.id);
      } else {
        console.warn(`⚠️ Falha ao sincronizar visita ${p.id}:`, res.status);
      }
    } catch (err) {
      console.warn(`⚠️ Erro de rede ao sincronizar visita pendente ${p.id}:`, err);
    }
  }

  if (syncedCount > 0) {
    console.log(`📡 ${syncedCount} visitas sincronizadas com sucesso.`);
    // 🔔 Dispara UMA vez só
    window.dispatchEvent(new Event("visits-synced"));
  }
}

/**
 * Pré-carrega entidades base (clientes, culturas, etc.)
 * para garantir funcionamento offline antes do usuário precisar delas.
 */
export async function preloadOfflineData(apiBase: string): Promise<void> {
  const base = normalizeBaseUrl(apiBase);

  // Só pré-carrega stores existentes no IndexedDB atual
  const endpoints: [string, StoreName][] = [
    [`${base}/clients`, "clients"],
    [`${base}/properties`, "properties"],
    [`${base}/visits?scope=all`, "visits"],
  ];

  for (const [url, store] of endpoints) {
    await fetchWithCache(url, store);
  }

  console.log("📦 Dados base pré-carregados para uso offline.");
}
