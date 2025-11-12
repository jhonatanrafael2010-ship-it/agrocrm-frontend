// src/utils/offlineSync.ts
import type { StoreName } from "./indexedDB";
import {
  getAllFromStore,
  putManyInStore,
  addPendingVisit,
  getAllPendingVisits,
  deletePendingVisit,
  appendToStore,
} from "./indexedDB";

function normalizeBaseUrl(base: string): string {
  return base.replace(/\/+$/, "");
}

/**
 * Fetch com cache:
 * - Online: busca na API, salva no IndexedDB e retorna
 * - Offline: lê do IndexedDB
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
 * Cria visita com suporte offline
 */
export async function createVisitWithSync(apiBase: string, payload: any): Promise<any> {
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

    // 🔹 Salva em pending_visits
    await addPendingVisit(payload);

    // 🔹 Cria visita offline com ID único
    const offlineVisit = {
      ...payload,
      id: Date.now() + Math.floor(Math.random() * 1000),
      offline: true,
    };

    offlineVisit.client_name = payload.client_name || payload.clientSearch || "Cliente offline";
    offlineVisit.consultant_name = payload.consultant_name || "—";


    // 🧮 Gera cronograma fenológico simulado offline
    if (payload.genPheno || payload.generate_schedule) {
      const stages = ["Plantio", "Emergência", "V2", "V5", "R1", "R5", "R8"];
      const baseDate = new Date(payload.date);
      for (let i = 0; i < stages.length; i++) {
        const newDate = new Date(baseDate);
        newDate.setDate(baseDate.getDate() + i * 15); // espaçamento de 15 dias
        const stageVisit = {
          ...offlineVisit,
          id: Date.now() + i + Math.floor(Math.random() * 1000),
          date: newDate.toISOString().slice(0, 10),
          recommendation: stages[i],
        };
        await appendToStore("visits", stageVisit);
      }
      console.log("🌱 Cronograma fenológico gerado offline.");
    } else {
      await appendToStore("visits", offlineVisit);
    }

    return {
      offline: true,
      synced: false,
      message: "Visita salva localmente. Será enviada quando houver internet.",
    };
  }
}

/**
 * Sincroniza visitas pendentes (quando reconectar)
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
        syncedCount++;
        console.log(`✅ Visita pendente ${p.id} sincronizada.`);
        if (typeof p.id === "number") await deletePendingVisit(p.id);
      } else {
        console.warn(`⚠️ Falha ao sincronizar visita ${p.id}: ${res.status}`);
      }
    } catch (err) {
      console.warn(`⚠️ Erro de rede ao sincronizar visita pendente ${p.id}:`, err);
    }
  }

  if (syncedCount > 0) {
    console.log(`📡 ${syncedCount} visitas sincronizadas com sucesso.`);
    await fetchWithCache(`${base}/visits?scope=all`, "visits"); // 🔁 Atualiza cache local
    window.dispatchEvent(new Event("visits-synced"));
  }
}

/**
 * Pré-carrega entidades base (para uso offline)
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
    [`${base}/visits?scope=all`, "visits"],
  ];
  for (const [url, store] of endpoints) {
    await fetchWithCache(url, store);
  }
  console.log("📦 Dados base pré-carregados para uso offline.");
}
