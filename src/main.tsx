import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import { getDB } from './db'

// ============================================================
// 🎨 Estilos globais — ORDEM DE CARREGAMENTO CORRETA
// ============================================================

import 'bootstrap/dist/css/bootstrap.min.css'
import './styles/theme-base.css'
import './styles/theme-agrocrm.css'
import './styles/theme-agrocrm-mobile.css'
import './styles/index.css'
import './styles/app.css'
import 'bootstrap/dist/js/bootstrap.bundle.min.js'

// ============================================================
// 🚀 Inicialização do app
// ============================================================
getDB().then(() => console.log('✅ IndexedDB pronta'))

// 📱 Detecta automaticamente se é APK ou desktop
if (/Android|iPhone|iPad|Mobile/i.test(navigator.userAgent)) {
  document.body.setAttribute('data-platform', 'mobile')
} else {
  document.body.setAttribute('data-platform', 'desktop')
}

// 🔒 Força o modo claro em toda a aplicação
document.documentElement.setAttribute('data-theme', 'light')
document.body.setAttribute('data-theme', 'light')
document.documentElement.setAttribute('data-bs-theme', 'light')

// ============================================================
// ⚙️ Renderização principal
// ============================================================
createRoot(document.getElementById('root')!).render(<App />)

// ============================================================
// 🔄 Atualização automática de cache (UX aprimorada)
// ============================================================
;(async () => {
  const splash = document.createElement('div')
  try {
    splash.style.cssText = `
      position: fixed; inset: 0;
      background:#0b1620; color:#2dd36f; font-family:Inter, sans-serif;
      display:flex; flex-direction:column; align-items:center; justify-content:center;
      z-index: 2147483647;
      pointer-events: all;
      isolation: isolate;
    `;

    splash.innerHTML = `
      <div style="font-size:1.6rem;margin-bottom:10px;">🔄 Atualizando o sistema...</div>
      <div style="font-size:0.9rem;color:#9fb3b6;">Por favor, aguarde alguns segundos</div>
    `

    document.body.style.overflow = "hidden";

    // 🔒 trava UI durante atualização
    document.body.classList.add("app-updating");

    // fecha offcanvas se estiver aberto (garantia)
    document.querySelectorAll(".offcanvas.show").forEach((el) => {
      el.classList.remove("show");
    });
    document.querySelectorAll(".offcanvas-backdrop").forEach((el) => el.remove());

    // trava scroll e cliques atrás
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    document.body.style.pointerEvents = "none";


    document.documentElement.appendChild(splash)


    const currentVersion = localStorage.getItem('app_version')
    const files = Array.from(document.getElementsByTagName('script'))
    const hashFile = files.find(f => f.src.includes('index-') || f.src.includes('main-'))
    const newVersion = hashFile ? hashFile.src.split('-').pop()?.split('.')[0] : 'dev'

    if (currentVersion && newVersion && currentVersion !== newVersion) {
      console.log('🧩 Nova versão detectada! Limpando cache...')
      localStorage.clear()
      sessionStorage.clear()

      if ('caches' in window) {
        const keys = await caches.keys()
        await Promise.all(keys.map(k => caches.delete(k)))
      }

      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations()
        for (const reg of regs) await reg.unregister()
      }

      if ('indexedDB' in window && indexedDB.databases) {
        const dbs = await indexedDB.databases()
        for (const db of dbs) if (db.name) indexedDB.deleteDatabase(db.name)
      }

      setTimeout(() => location.reload(), 1500)
      return
    } else if (!currentVersion && newVersion) {
      localStorage.setItem('app_version', newVersion)
    }

    splash.remove();
    document.body.classList.remove("app-updating");
    document.documentElement.style.overflow = "";
    document.body.style.overflow = "";
    document.body.style.pointerEvents = "";

    } catch (err) {
      console.warn('⚠️ Falha ao verificar cache:', err)
      try { splash.remove() } catch {}
      document.body.style.overflow = ""
    }

})()
