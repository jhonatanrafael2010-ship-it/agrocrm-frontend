import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import { getDB } from './db'

// ============================================================
// 🎨 Estilos globais — ORDEM DE CARREGAMENTO CORRETA
// ============================================================

// 1️⃣ Bootstrap base (estrutura e variáveis)
import 'bootstrap/dist/css/bootstrap.min.css'

// 2️⃣ Temas personalizados (carregados ANTES do app.css)
import './styles/theme-base.css'
import './styles/theme-agrocrm.css'
import './styles/theme-agrocrm-mobile.css'

// 3️⃣ Estilos gerais do app — DEVE SER O ÚLTIMO CSS
//    (sobrepõe tudo acima, inclusive Bootstrap)
import './styles/app.css'

// 4️⃣ Bootstrap JS (opcional, mas deve vir após o CSS)
import 'bootstrap/dist/js/bootstrap.bundle.min.js'

// 5️⃣ Estilo do Vite (mantém, mas NÃO deve ficar depois do app.css)
import './styles/index.css'


// ============================================================
// 🚀 Inicialização do app
// ============================================================
createRoot(document.getElementById('root')!).render(
  <App />
)


// ============================================================
// 🗄️ IndexedDB e inicialização
// ============================================================
getDB().then(() => console.log('✅ IndexedDB pronta'))

// 📱 Detecta automaticamente se é APK ou desktop
if (/Android|iPhone|iPad|Mobile/i.test(navigator.userAgent)) {
  document.body.setAttribute('data-platform', 'mobile')
} else {
  document.body.setAttribute('data-platform', 'desktop')
}

// ============================================================
// 🔄 Atualização automática de cache (UX aprimorada)
// ============================================================
;(async () => {
  try {
    const splash = document.createElement('div')
    splash.style.cssText = `
      position: fixed; top:0; left:0; width:100%; height:100%;
      background:#0b1620; color:#2dd36f; font-family:Inter, sans-serif;
      display:flex; flex-direction:column; align-items:center; justify-content:center;
      z-index:9999;
    `
    splash.innerHTML = `
      <div style="font-size:1.6rem;margin-bottom:10px;">🔄 Atualizando o sistema...</div>
      <div style="font-size:0.9rem;color:#9fb3b6;">Por favor, aguarde alguns segundos</div>
    `
    document.body.appendChild(splash)

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

    splash.remove()
  } catch (err) {
    console.warn('⚠️ Falha ao verificar cache:', err)
  }
})()

// ============================================================
// ⚙️ Renderização principal
// ============================================================
createRoot(document.getElementById('root')!).render(<App />)
