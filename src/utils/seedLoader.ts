// src/utils/seedLoader.ts
// ============================================================
// Carrega dados seed embutidos no APK quando IndexedDB está vazio
// Isso permite o app funcionar 100% offline desde a primeira abertura
// ============================================================

import type { StoreName } from "./indexedDB";
import { getAllFromStore, putManyInStore } from "./indexedDB";

const SEED_URL = "/seed/data.json";
const SEED_LOADED_KEY = "agrocrm_seed_loaded";

interface SeedData {
  version: string;
  generated_at: string;
  consultants: any[];
  clients: any[];
  properties: any[];
  plots: any[];
  cultures: any[];
  varieties: any[];
}

/**
 * Verifica se o IndexedDB está vazio (primeira abertura)
 */
async function isIndexedDBEmpty(): Promise<boolean> {
  try {
    // Verifica se já carregou seed antes neste dispositivo
    if (localStorage.getItem(SEED_LOADED_KEY)) {
      return false;
    }

    // Verifica se tem consultores (dado mais crítico)
    const consultants = await getAllFromStore("consultants");
    if (consultants && consultants.length > 0) {
      return false;
    }

    // Verifica se tem clientes
    const clients = await getAllFromStore("clients");
    if (clients && clients.length > 0) {
      return false;
    }

    return true;
  } catch (err) {
    console.warn("[SeedLoader] Erro ao verificar IndexedDB:", err);
    return true;
  }
}

/**
 * Carrega o seed.json embutido no APK
 */
async function fetchSeedData(): Promise<SeedData | null> {
  try {
    const response = await fetch(SEED_URL);
    if (!response.ok) {
      console.warn("[SeedLoader] Seed não encontrado:", response.status);
      return null;
    }
    return await response.json();
  } catch (err) {
    console.warn("[SeedLoader] Erro ao carregar seed:", err);
    return null;
  }
}

/**
 * Popula o IndexedDB com dados do seed
 */
async function populateFromSeed(seed: SeedData): Promise<void> {
  const stores: { key: keyof SeedData; store: StoreName }[] = [
    { key: "consultants", store: "consultants" },
    { key: "clients", store: "clients" },
    { key: "properties", store: "properties" },
    { key: "plots", store: "plots" },
    { key: "cultures", store: "cultures" },
    { key: "varieties", store: "varieties" },
  ];

  for (const { key, store } of stores) {
    const data = seed[key];
    if (Array.isArray(data) && data.length > 0) {
      try {
        await putManyInStore(store, data);
        console.log(`[SeedLoader] ${store}: ${data.length} registros carregados`);
      } catch (err) {
        console.warn(`[SeedLoader] Erro ao popular ${store}:`, err);
      }
    }
  }
}

/**
 * Função principal: carrega seed se IndexedDB estiver vazio
 * Chamada uma vez na inicialização do app
 */
export async function loadSeedIfNeeded(): Promise<boolean> {
  try {
    const isEmpty = await isIndexedDBEmpty();

    if (!isEmpty) {
      console.log("[SeedLoader] IndexedDB já tem dados, pulando seed");
      return false;
    }

    console.log("[SeedLoader] IndexedDB vazio, carregando seed...");

    const seed = await fetchSeedData();

    if (!seed) {
      console.warn("[SeedLoader] Seed não disponível");
      return false;
    }

    await populateFromSeed(seed);

    // Marca que o seed foi carregado (evita recarregar)
    localStorage.setItem(SEED_LOADED_KEY, seed.version || "1");

    console.log(`[SeedLoader] Seed v${seed.version} carregado com sucesso!`);
    return true;

  } catch (err) {
    console.error("[SeedLoader] Erro:", err);
    return false;
  }
}

/**
 * Força recarregamento do seed (útil para debug)
 */
export async function forceReloadSeed(): Promise<boolean> {
  localStorage.removeItem(SEED_LOADED_KEY);
  return loadSeedIfNeeded();
}

/**
 * Retorna informações sobre o seed carregado
 */
export function getSeedInfo(): { loaded: boolean; version: string | null } {
  const version = localStorage.getItem(SEED_LOADED_KEY);
  return {
    loaded: !!version,
    version,
  };
}
