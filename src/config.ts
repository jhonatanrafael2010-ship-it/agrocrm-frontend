// src/config.ts
// ===================================================
// 🌐 Configuração central da API
// ===================================================

// Tenta ler a variável de ambiente gerada pelo Vite
const envApi = import.meta.env.VITE_API_URL;

// Define a URL base final com fallback
export const API_BASE =
  envApi?.replace(/\/+$/, "") || "https://agrocrm-backend.onrender.com/api";

// Log de depuração no console (para ver se o build pegou a env)
console.log("🌐 VITE_API_URL (build):", import.meta.env.VITE_API_URL);
console.log("🌐 API_BASE final:", API_BASE);

// Também expõe no escopo global para depuração
if (typeof window !== "undefined") {
  (window as any).API_BASE = API_BASE;
}
