import React, { useEffect, useRef, useState } from 'react'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import ptBrLocale from '@fullcalendar/core/locales/pt-br'
import DarkSelect from '../components/DarkSelect'

const API_BASE = import.meta.env.VITE_API_URL || '/api/'

type Client = { id: number; name: string }
type Property = { id: number; client_id: number; name: string }
type Plot = { id: number; property_id: number; name: string }
type Culture = { id: number; name: string }
type Variety = { id: number; name: string; culture: string }

// ======== TABELAS FENOLÓGICAS (dias após plantio) ========
const PHENO: Record<string, { code: string; name: string; days: number }[]> = {
  "Milho": [
    { code: "Plantio", name: "Plantio", days: 0 },
    { code: "VE", name: "Emergência", days: 5 },
    { code: "V1", name: "1 folha verdadeira", days: 8 },
    { code: "V4", name: "4 folhas verdadeiras", days: 20 },
    { code: "VT", name: "Pendoamento", days: 54 },
    { code: "R1", name: "Espiga com boneca", days: 55 },
    { code: "R3", name: "Grão leitoso", days: 68 },
    { code: "R6", name: "Maturação fisiológica", days: 100 },
    { code: "Colh", name: "Colheita", days: 130 }
  ],
  "Soja": [
    { code: "Plantio", name: "Plantio", days: 0 },
    { code: "VE", name: "Emergência", days: 5 },
    { code: "V1", name: "1º trifólio", days: 12 },
    { code: "V4", name: "4º nó", days: 25 },
    { code: "R1", name: "Início floração", days: 35 },
    { code: "R3", name: "Vagens pequenas", days: 49 },
    { code: "R5", name: "Granação", days: 65 },
    { code: "R7", name: "Início maturação", days: 92 },
    { code: "Colh", name: "Colheita", days: 115 }
  ],
  "Algodão": [
    { code: "Plantio", name: "Plantio", days: 0 },
    { code: "V1", name: "1 folha verdadeira", days: 14 },
    { code: "V4", name: "4 folhas verdadeiras", days: 27 },
    { code: "B1", name: "1º botão floral", days: 38 },
    { code: "F1", name: "1ª flor aberta", days: 65 },
    { code: "C1", name: "1º capulho aberto", days: 117 },
    { code: "Colh", name: "Colheita", days: 165 }
  ]
}

// ============================================================
// 🌾 Componente principal — CalendarCore
// ============================================================
const CalendarCore: React.FC = () => {
  const calendarRef = useRef<any>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [events, setEvents] = useState<any[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [cultures, setCultures] = useState<Culture[]>([])
  const [varieties, setVarieties] = useState<Variety[]>([])
  const [consultants, setConsultants] = useState<{ id: number; name: string }[]>([])
  const [properties, setProperties] = useState<Property[]>([])
  const [plots, setPlots] = useState<Plot[]>([])
  const [form, setForm] = useState({
    id: null as number | null,
    date: '',
    client_id: '',
    property_id: '',
    consultant_id: '',
    plot_id: '',
    recommendation: '',
    culture: '',
    variety: '',
    genPheno: true
  })
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  // 🔹 Carrega dados iniciais
  // 🔹 Carrega dados iniciais
useEffect(() => {
  console.log('🧠 Calendar montado')
  setLoading(true)

  Promise.all([
    fetch(`${API_BASE}clients`).then(r => r.json()),
    fetch(`${API_BASE}properties`).then(r => r.json()),
    fetch(`${API_BASE}plots`).then(r => r.json()),
    fetch(`${API_BASE}visits`).then(r => r.json()),
  ])
    .then(([cs, ps, pls, visits]) => {
      const evs: any[] = []

      if (Array.isArray(visits)) {
        visits.forEach((v: any) => {
          if (v.date) {
            const clientName =
              cs.find((c: any) => c.id === v.client_id)?.name ||
              `Cliente: ${v.client_id}`
            evs.push({
              id: `visit-${v.id}`,
              title: clientName,
              start: v.date,
              extendedProps: { type: 'visit', raw: v },
            })
          }
        })
      }

      setEvents(evs)
      setClients(cs || [])
      setProperties(ps || [])
      setPlots(pls || [])

      // ✅ Agora carrega culturas e variedades separadamente
      fetch(`${API_BASE}cultures`)
        .then(r => r.ok ? r.json() : Promise.reject('Falha em /cultures'))
        .then(data => setCultures(Array.isArray(data) ? data : []))
        .catch(err => { console.error('Erro carregando culturas:', err); setCultures([]) })

      fetch(`${API_BASE}varieties`)
        .then(r => r.ok ? r.json() : Promise.reject('Falha em /varieties'))
        .then(data => setVarieties(Array.isArray(data) ? data : []))
        .catch(err => { console.error('Erro carregando variedades:', err); setVarieties([]) })

      fetch(`${API_BASE}consultants`)
  .then(r => r.ok ? r.json() : Promise.reject('Falha em /consultants'))
  .then(data => setConsultants(Array.isArray(data) ? data : []))
  .catch(err => { console.error('Erro carregando consultores:', err); setConsultants([]) })

    })
    .catch(err => console.error(err))
    .finally(() => setLoading(false))

  return () => {
    const container = containerRef.current
    if (container) container.innerHTML = ''
    console.log('🧹 Calendar desmontado e container limpo')
  }
}, [])


  // 🔹 Selecionar data
  const handleDateSelect = (info: any) => {
    const [y, m, d] = info.startStr.split('-')
    setForm(f => ({ ...f, date: `${d}/${m}/${y}` }))
    setOpen(true)
  }

  // 🔹 Alterações de formulário
  const handleChange = (e: any) => {
    const { name, value } = e.target
    setForm(f => ({ ...f, [name]: value }))
  }

  // 🔹 Utilitário para adicionar dias
  function addDaysISO(iso: string, days: number) {
    const d = new Date(iso)
    d.setDate(d.getDate() + days)
    const yyyy = d.getFullYear()
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    return `${yyyy}-${mm}-${dd}`
  }

  // 🔹 Criar visita
  const handleCreateVisit = async () => {
    if (!form.date || !form.client_id || !form.property_id || !form.plot_id)
      return alert('Data, cliente, propriedade e talhão são obrigatórios')

    try {
      const [d, m, y] = form.date.split('/')
      const plantingISO = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`

      const baseVisit = {
  client_id: Number(form.client_id),
  property_id: Number(form.property_id),
  plot_id: Number(form.plot_id),
  consultant_id: form.consultant_id ? Number(form.consultant_id) : null
}


      // 1️⃣ Cria visita inicial
      const firstRes = await fetch(`${API_BASE}visits`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...baseVisit, date: plantingISO, recommendation: form.recommendation })
      })
      const firstBody = await firstRes.json()
      if (!firstRes.ok) throw new Error(firstBody.message || `status ${firstRes.status}`)
      const created = firstBody.visit || firstBody

      // ============================================================
// 🧠 Atualização: geração de eventos + exibição detalhada
// ============================================================
if (form.genPheno && form.culture && PHENO[form.culture]) {
  const items = PHENO[form.culture].map(stage => ({
    ...baseVisit,
    date: addDaysISO(plantingISO, stage.days),
    recommendation: `${stage.code} — ${stage.name}${form.variety ? ` (${form.variety})` : ''}`
  }))
  const unique = items.filter(it => it.date !== plantingISO)

  if (unique.length) {
    const bulkRes = await fetch(`${API_BASE}visits/bulk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: unique })
    })
    const bulkBody = await bulkRes.json()
    if (!bulkRes.ok) throw new Error(bulkBody.message || `status ${bulkRes.status}`)

    const allCreated = [created, ...bulkBody]
    setEvents(e => [
      ...e,
      ...allCreated.map(v => {
        const clientName = clients.find(c => c.id === v.client_id)?.name || `Cliente ${v.client_id}`
        const consultant = consultants.find(x => x.id === v.consultant_id)?.name || ''
        const variety = v.recommendation?.match(/\(([^)]+)\)/)?.[1] || ''
        const stage = v.recommendation?.split('—')[1]?.trim() || v.recommendation

        const titleLines = [clientName]
        if (variety) titleLines.push(variety)
        if (stage) titleLines.push(stage)
        if (consultant) titleLines.push(`👨‍🌾 ${consultant}`)

        return {
          id: `visit-${v.id}`,
          title: titleLines.join('\n'),
          start: v.date,
          extendedProps: { type: 'visit', raw: v }
        }
      })
    ])
  }
} else {
  // ✅ caso sem geração fenológica
  const clientName = clients.find(c => c.id === Number(form.client_id))?.name || `Cliente: ${form.client_id}`
  const consultant = consultants.find(x => x.id === Number(form.consultant_id))?.name || ''
  const variety = form.variety || ''
  const stage = form.recommendation || ''

  const titleLines = [clientName]
  if (variety) titleLines.push(variety)
  if (stage) titleLines.push(stage)
  if (consultant) titleLines.push(`👨‍🌾 ${consultant}`)

  setEvents(e => [
    ...e,
    {
      id: `visit-${created.id}`,
      title: titleLines.join('\n'),
      start: created.date,
      extendedProps: { type: 'visit', raw: created }
    }
  ])
}

// 🔄 limpa o formulário e fecha o modal
setOpen(false)
setForm({
  date: '',
  client_id: '',
  property_id: '',
  plot_id: '',
  consultant_id: '',
  recommendation: '',
  culture: '',
  variety: '',
  genPheno: true
})

    } catch (err: any) {
      alert(err?.message || 'Erro ao criar visita')
    }
  }

// ============================================================
// 🗓️ Renderização do componente
// ============================================================
return (
  <div className="calendar-page">
    <h2>Calendário</h2>
    {loading && <div style={{ color: '#9fb3b6' }}>Carregando...</div>}

    <div ref={containerRef} className="calendar-wrap">
      <FullCalendar
        ref={calendarRef}
        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
        locales={[ptBrLocale]}
        locale="pt-br"
        initialView="dayGridMonth"
        selectable
        select={handleDateSelect}
        events={events}
        height={650}
        headerToolbar={{
          left: 'prev,next today',
          center: 'title',
          right: 'dayGridMonth,timeGridWeek,timeGridDay'
        }}
        eventDidMount={(info) => {
          // ✅ Permite múltiplas linhas e melhor legibilidade
          info.el.style.whiteSpace = 'pre-line';
          info.el.style.lineHeight = '1.3';
          info.el.style.padding = '4px';
        }}
      />
    </div>

    {/* ✅ Modal precisa estar dentro do mesmo return */}
    {open && (
      <div className="modal-overlay">
        <div className="modal">
          <h3>Nova Visita</h3>

          <div className="form-row">
            <label>Data</label>
            <input name="date" value={form.date} onChange={handleChange} placeholder="dd/mm/aaaa" />
          </div>

          <div className="form-row">
            <label>Cliente</label>
            <DarkSelect
              name="client_id"
              value={form.client_id}
              placeholder="Selecione cliente"
              options={[{ value: '', label: 'Selecione cliente' }, ...clients.map(c => ({ value: String(c.id), label: c.name }))]}
              onChange={(e: any) => setForm(f => ({ ...f, client_id: e.target.value, property_id: '', plot_id: '' }))}
            />
          </div>

          <div className="form-row">
            <label>Propriedade</label>
            <DarkSelect
              name="property_id"
              value={form.property_id}
              placeholder="Selecione propriedade"
              options={[{ value: '', label: 'Selecione propriedade' }, ...properties.map(p => ({ value: String(p.id), label: p.name }))]}
              onChange={(e: any) => setForm(f => ({ ...f, property_id: e.target.value, plot_id: '' }))}
            />
          </div>

          <div className="form-row">
            <label>Talhão</label>
            <DarkSelect
              name="plot_id"
              value={form.plot_id}
              placeholder="Selecione talhão"
              options={[{ value: '', label: 'Selecione talhão' }, ...plots.map(pl => ({ value: String(pl.id), label: pl.name }))]}
              onChange={handleChange as any}
            />
          </div>

          <div className="form-row">
            <label>Cultura</label>
            <select
              name="culture"
              value={form.culture}
              onChange={(e) => setForm(f => ({ ...f, culture: e.target.value, variety: '' }))}
            >
              <option value="">Selecione</option>
              {cultures.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
            </select>
          </div>

          <div className="form-row">
            <label>Variedade</label>
            <select
              name="variety"
              value={form.variety}
              onChange={(e) => setForm(f => ({ ...f, variety: e.target.value }))}
              disabled={!form.culture}
            >
              <option value="">Selecione</option>
              {varieties
                .filter(v => v.culture.toLowerCase() === (form.culture || '').toLowerCase())
                .map(v => <option key={v.id} value={v.name}>{v.name}</option>)}
            </select>
          </div>

          <div className="form-row">
            <label>Consultor</label>
            <select
              name="consultant_id"
              value={form.consultant_id}
              onChange={(e) => setForm(f => ({ ...f, consultant_id: e.target.value }))}
            >
              <option value="">Selecione</option>
              {consultants.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div className="form-row" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              id="genPheno"
              type="checkbox"
              checked={form.genPheno}
              onChange={e => setForm(f => ({ ...f, genPheno: e.target.checked }))}
            />
            <label htmlFor="genPheno">Gerar cronograma fenológico (milho/soja/algodão)</label>
          </div>

          <div className="form-row">
            <label>Recomendação</label>
            <textarea
              name="recommendation"
              value={form.recommendation}
              onChange={handleChange}
              placeholder="Observações ou anotações técnicas..."
            />
          </div>

          <div className="modal-actions" style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
            <button className="btn-cancel" onClick={() => setOpen(false)} style={{
              flex: 1, background: 'var(--muted)', border: 'none', color: '#fff',
              padding: '8px 10px', borderRadius: '8px', cursor: 'pointer'
            }}>Cancelar</button>

            <button className="btn-save" onClick={handleCreateVisit} style={{
              flex: 1, background: 'var(--accent)', border: 'none', color: '#02251f',
              padding: '8px 10px', borderRadius: '8px', cursor: 'pointer', fontWeight: 600
            }}>Salvar</button>

            <button className="btn-delete"
              onClick={async () => {
                if (!form.id) return
                const confirmar = confirm('🗑 Deseja realmente excluir esta visita?')
                if (!confirmar) return

                try {
                  const resp = await fetch(`${API_BASE}visits/${form.id}`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' } })
                  if (!resp.ok) throw new Error(`Erro HTTP ${resp.status}`)
                  setEvents(evts => evts.filter(e => e.id !== `visit-${form.id}`))
                  alert('✅ Visita excluída com sucesso!')
                  setOpen(false)
                } catch (err) {
                  console.error('Erro ao excluir visita:', err)
                  alert('❌ Erro ao excluir visita.')
                }
              }}
              style={{
                flex: 1, background: '#c0392b', border: 'none', color: '#fff',
                padding: '8px 10px', borderRadius: '8px', cursor: 'pointer', fontWeight: 600
              }}>Excluir</button>
          </div>
        </div>
      </div>
       )}
  </div>
)   // 👈 esse fecha o return do CalendarCore
}   // 👈 esse fecha o componente CalendarCore!

// ============================================================
// 🔁 Wrapper para controle de renderização
// ============================================================
const CalendarPage: React.FC = () => {
  console.log('🔁 Calendar renderizado')
  return <CalendarCore />
}

export default CalendarPage

