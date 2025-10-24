import { openDB } from 'idb'

// Tipagem da visita, compatível com seu backend Flask
export interface VisitData {
  id?: number
  date: string
  client_id: number
  property_id: number
  plot_id: number
  recommendation?: string
}

// ===============================================================
// 💾 Salva uma visita localmente quando o app estiver offline
// ===============================================================
export async function saveVisitOffline(visit: VisitData) {
  const db = await openDB('agrocrm', 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('pendingVisits')) {
        db.createObjectStore('pendingVisits', { keyPath: 'id', autoIncrement: true })
      }
    },
  })
  await db.put('pendingVisits', visit)
  console.log('💾 Visita salva offline:', visit)
}

// ===============================================================
// 🔄 Sincroniza visitas armazenadas quando o app voltar a ficar online
// ===============================================================
export async function syncPendingVisits(apiBase: string = '/api/') {
  const db = await openDB('agrocrm', 1)
  const all = await db.getAll('pendingVisits')

  if (!all.length) {
    console.log('✅ Nenhuma visita pendente para sincronizar.')
    return
  }

  console.log(`🔄 Iniciando sincronização de ${all.length} visitas...`)

  for (const visit of all) {
    try {
      const res = await fetch(`${apiBase}visits`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(visit),
      })

      if (res.ok) {
        await db.delete('pendingVisits', visit.id!)
        console.log('✅ Visita sincronizada:', visit)
      } else {
        const errText = await res.text()
        console.error('❌ Falha ao sincronizar visita:', errText)
      }
    } catch (err) {
      console.warn('⚠️ Offline ou erro de rede, tentativa será repetida:', err)
    }
  }
}
