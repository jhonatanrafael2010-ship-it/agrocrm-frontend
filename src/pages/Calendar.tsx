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

const CalendarPage: React.FC = () => {
  const calendarRef = useRef<any>(null)
  const [events, setEvents] = useState<any[]>([])
  const initialized = useRef(false)
  const [clients, setClients] = useState<Client[]>([])
  const [properties, setProperties] = useState<Property[]>([])
  const [plots, setPlots] = useState<Plot[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ date: '', client_id: '', property_id: '', plot_id: '', recommendation: '' })
  const [viewOpen, setViewOpen] = useState(false)
  const [activeEvent, setActiveEvent] = useState<any>(null)

  // 🔹 Carregar dados iniciais
 useEffect(() => {
  if (initialized.current) return
  initialized.current = true

  let mounted = true
  setLoading(true)

  Promise.all([
    fetch(`${API_BASE}clients`).then(r => r.json()),
    fetch(`${API_BASE}properties`).then(r => r.json()),
    fetch(`${API_BASE}plots`).then(r => r.json()),
    fetch(`${API_BASE}visits`).then(r => r.json()),
  ])
    .then(([cs, ps, pls, visits]) => {
      if (!mounted) return
      const evs: any[] = []
      if (visits && Array.isArray(visits)) {
        visits.forEach((v: any) => {
          if (v.date) {
            const clientName = (cs || []).find((c: any) => c.id === v.client_id)?.name || `Cliente: ${v.client_id}`
            evs.push({
              id: `visit-${v.id}`,
              title: clientName,
              start: v.date,
              extendedProps: { type: 'visit', raw: v }
            })
          }
        })
      }
      setEvents(evs)
      setClients(cs || [])
      setProperties(ps || [])
      setPlots(pls || [])
    })
    .catch(err => console.error(err))
    .finally(() => setLoading(false))

  return () => { mounted = false }
}, [])


  // 🔹 Re-render seguro do calendário (sem duplicar textos)
  useEffect(() => {
    const calendarApi = calendarRef.current?.getApi?.()
    if (calendarApi) {
      calendarApi.removeAllEvents()
      calendarApi.addEventSource(events)
    }
  }, [events])

  // 🔹 Busca dependente
  useEffect(() => {
    if (!form.client_id) {
      setProperties([])
      setPlots([])
      return
    }
    fetch(`${API_BASE}properties?client_id=${form.client_id}`)
      .then(r => r.ok ? r.json() : [])
      .then(data => setProperties(data))
      .catch(() => setProperties([]))
    setPlots([])
  }, [form.client_id])

  useEffect(() => {
    if (!form.property_id) {
      setPlots([])
      return
    }
    fetch(`${API_BASE}plots?property_id=${form.property_id}`)
      .then(r => r.ok ? r.json() : [])
      .then(data => setPlots(Array.isArray(data) ? data : []))
      .catch(() => setPlots([]))
  }, [form.property_id])

  // 🔹 Funções utilitárias
  function formatDateBR(dateStr?: string) {
    if (!dateStr) return '--'
    try {
      const d = new Date(dateStr)
      if (isNaN(d.getTime())) {
        const [y, m, d2] = dateStr.split('-')
        return `${d2}/${m}/${y}`
      }
      return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1)
        .toString()
        .padStart(2, '0')}/${d.getFullYear()}`
    } catch {
      return dateStr
    }
  }

  function handleDateSelect(selectInfo: any) {
    const [y, m, d] = selectInfo.startStr.split('-')
    setForm(f => ({ ...f, date: `${d}/${m}/${y}` }))
    setOpen(true)
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
    const { name, value } = e.target
    setForm(f => ({ ...f, [name]: value }))
  }

  async function handleCreateVisit() {
    if (!form.date || !form.client_id || !form.property_id || !form.plot_id)
      return alert('Data, cliente, propriedade e talhão são obrigatórios')

    try {
      const [d, m, y] = form.date.split('/')
      const dateISO = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`

      const res = await fetch(`${API_BASE}visits`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: Number(form.client_id),
          property_id: Number(form.property_id),
          plot_id: Number(form.plot_id),
          date: dateISO,
          recommendation: form.recommendation
        })
      })

      const body = await res.json()
      if (!res.ok) throw new Error(body.message || `status ${res.status}`)
      const created = body.visit || body
      const clientName =
        clients.find(c => c.id === Number(form.client_id))?.name ||
        `Cliente: ${form.client_id}`

      setEvents(prev => [
        ...prev,
        {
          id: `visit-${created.id}`,
          title: clientName,
          start: created.date,
          extendedProps: { type: 'visit', raw: created }
        }
      ])
      setOpen(false)
      setForm({ date: '', client_id: '', property_id: '', plot_id: '', recommendation: '' })
    } catch (err: any) {
      alert(err?.message || 'Erro ao criar visita')
    }
  }

  function handleEventClick(clickInfo: any) {
    const ev = clickInfo.event
    setActiveEvent(ev)
    setViewOpen(true)
  }

  console.log('🔁 Calendar renderizado')
  return (
    <div className="calendar-page">
      <h2>Calendário</h2>
      {loading && <div style={{ color: '#9fb3b6' }}>Carregando...</div>}

      <div className="calendar-wrap">
        <FullCalendar
          ref={calendarRef}
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          locales={[ptBrLocale]}
          locale="pt-br"
          initialView="dayGridMonth"
          selectable={true}
          select={handleDateSelect}
          eventClick={handleEventClick}
          headerToolbar={{
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek,timeGridDay'
          }}
          events={events}
          height={650}
        />
      </div>

      {/* Modal: Nova Visita */}
      {open && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>Nova Visita</h3>
            <div className="form-row"><label>Data</label><input name="date" value={form.date} onChange={handleChange} /></div>
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
            <div className="form-row"><label>Recomendação</label><textarea name="recommendation" value={form.recommendation} onChange={handleChange} /></div>
            <div className="modal-actions">
              <button className="btn-cancel" onClick={() => setOpen(false)}>Cancelar</button>
              <button className="btn-save" onClick={handleCreateVisit}>Salvar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Ver Evento */}
      {viewOpen && activeEvent && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>Ver Acompanhamento</h3>
            <div className="form-row"><label>Tipo</label><div>{activeEvent.extendedProps?.type ?? 'evento'}</div></div>
            <div className="form-row"><label>Data</label><div>{formatDateBR(activeEvent.startStr)}</div></div>
            <div className="modal-actions">
              <button className="btn-cancel" onClick={() => { setViewOpen(false); setActiveEvent(null) }}>Fechar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default CalendarPage
