import { createRoot } from 'react-dom/client'
import './styles/index.css'
import App from './App.tsx'
import './styles/theme-agrocrm.css';
import { getDB } from './db';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap/dist/js/bootstrap.bundle.min.js';



getDB().then(() => console.log('✅ IndexedDB pronta'));


// 📱 Detecta automaticamente se é versão mobile (APK)
if (/Android|iPhone|iPad|Mobile/i.test(navigator.userAgent)) {
  document.body.setAttribute('data-platform', 'mobile');
} else {
  document.body.setAttribute('data-platform', 'desktop');
}


// 🧹 Script automático para limpar cache ao detectar nova versão
;(async () => {
  try {
    // 🔸 Cria splash temporário na tela
    const splash = document.createElement('div')
    splash.style.position = 'fixed'
    splash.style.top = '0'
    splash.style.left = '0'
    splash.style.width = '100%'
    splash.style.height = '100%'
    splash.style.background = '#0b1620'
    splash.style.color = '#2dd36f'
    splash.style.fontFamily = 'Inter, sans-serif'
    splash.style.display = 'flex'
    splash.style.flexDirection = 'column'
    splash.style.alignItems = 'center'
    splash.style.justifyContent = 'center'
    splash.style.zIndex = '9999'
    splash.innerHTML = `
      <div style="font-size:1.6rem;margin-bottom:10px;">🔄 Atualizando o sistema...</div>
      <div style="font-size:0.9rem;color:#9fb3b6;">Por favor, aguarde alguns segundos</div>
    `
    document.body.appendChild(splash)

    // 🔹 Identifica versão atual e nova
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

      // ⏳ Espera um pouco para UX mais suave
      setTimeout(() => location.reload(), 1500)
      return
    } else if (!currentVersion && newVersion) {
      localStorage.setItem('app_version', newVersion)
    }

    // 🔹 Remove splash se não precisar atualizar
    splash.remove()
  } catch (err) {
    console.warn('⚠️ Falha ao verificar cache:', err)
  }
})()

// ⚠️ StrictMode removido — evita re-render duplo no dev
createRoot(document.getElementById('root')!).render(<App />)

// ==============================
// 🧭 Registro do Service Worker PWA
// ==============================
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/service-worker.js")
      .then(() => console.log("✅ Service Worker registrado com sucesso"))
      .catch((err) => console.error("❌ Falha ao registrar Service Worker:", err));
  });
}

