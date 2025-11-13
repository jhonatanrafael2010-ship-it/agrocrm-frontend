// src/config.ts
// ===================================================
// 🌐 Configuração central da API
// ===================================================

const rawBase = import.meta.env.VITE_API_URL || "https://agrocrm-backend.onrender.com/api";

// 🔧 Garante que termine sempre com "/"
export const API_BASE = rawBase.endsWith("/") ? rawBase : `${rawBase}/`;

console.log("🌐 VITE_API_URL (build):", import.meta.env.VITE_API_URL);
console.log("🌐 API_BASE final:", API_BASE);

// Também expõe no escopo global para depuração (opcional)
if (typeof window !== "undefined") {
  (window as any).API_BASE = API_BASE;
}
