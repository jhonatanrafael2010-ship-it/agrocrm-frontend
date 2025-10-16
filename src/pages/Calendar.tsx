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
  const calendarRef = useRef<FullCalendar | null>(null)
  const [events, setEvents] = useState<any[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [properties, setProperties] = useState<Property[]>([])
  const [plots, setPlots] = useState<Plot[]>([])
  const [loading, setLoading] = useState(false)

  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ date: '', client_id: '', property_id: '', plot_id: '', recommendation: '' })
  const [viewOpen, setViewOpen] = useState(false)
  const [activeEvent, setActiveEvent] = useState<any>(null)

  // ✅ Corrigido: destrói o calendário anterior ao recarregar dados
  useEffect(() => {
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
      .catch(err => console.error('Erro ao carregar calendário:', err))
      .finally(() => setLoading(false))

    return () => { mounted = false }
  }, [])

  // ✅ Recriação segura do calendário — evita duplicação
  useEffect(() => {
    const calendarEl = document.getElementById('calendar')
    if (!calendarEl) return

    // destrói instância anterior se existir
    if ((window as any).activeCalendar) {
      (window as any).activeCalendar.destroy()
    }

    const calendar = new FullCalendar.Calendar(calendarEl, {
      plugins: [dayGridPlugin, timeGridPlugin, interactionPlugin],
      locales: [ptBrLocale],
      locale: 'pt-br',
      initialView: 'dayGridMonth',
      selectable: true,
      events: events || [],
      headerToolbar: {
        left: 'prev,next today',
        center: 'title',
        right: 'dayGridMonth,timeGridWeek,timeGridDay'
      },
      select: handleDateSelect,
      eventClick: handleEventClick,
      height: 650
    })

    calendar.render()
    ;(window as any).activeCalendar = calendar

    return () => {
      calendar.destroy()
      ;(window as any).activeCalendar = null
    }
  }, [events])

  // Carregar propriedades e talhões de acordo com cliente
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

  function formatDateBR(dateStr?: string) {
    if (!dateStr) return '--'
    try {
      const d = new Date(dateStr)
      if (isNaN(d.getTime())) {
        const parts = String(dateStr).split('-')
        if (parts.length >= 3) return `${parts[2]}/${parts[1]}/${parts[0]}`
        return String(dateStr)
      }
      const dd = String(d.getDate()).padStart(2, '0')
      const mm = String(d.getMonth() + 1).padStart(2, '0')
      const yyyy = d.getFullYear()
      return `${dd}/${mm}/${yyyy}`
    } catch {
      return String(dateStr)
    }
  }

  function handleDateSelect(selectInfo: any) {
    const dateStr = selectInfo.startStr
    const [yyyy, mm, dd] = dateStr.split('-')
    const brDate = `${dd}/${mm}/${yyyy}`
    setForm(f => ({ ...f, date: brDate }))
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
      const [dd, mm, yyyy] = form.date.split('/')
      const dateISO = `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`

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
        clients.find(c => c.id === Number(form.client_id))?.name || `Cliente: ${form.client_id}`

      setEvents(e => [
        {
          id: `visit-${created.id}`,
          title: clientName,
          start: created.date,
          extendedProps: { type: 'visit', raw: created }
        },
        ...e
      ])

      setOpen(false)
      setForm({ date: '', client_id: '', property_id: '', plot_id: '', recommendation: '' })
    } catch (err: any) {
      alert(err?.message || 'Erro ao criar visita')
    }
  }

  function getClientName(id?: number) { return clients.find(c => c.id === id)?.name ?? String(id) }
  function getPropertyName(id?: number) { return properties.find(p => p.id === id)?.name ?? String(id) }
  function getPlotName(id?: number) { return plots.find(p => p.id === id)?.name ?? String(id) }

  function handleEventClick(clickInfo: any) {
    const ev = clickInfo.event
    setActiveEvent(ev)
    setViewOpen(true)
  }

  return (
    <div className="calendar-page">
      <h2>Calendário</h2>
      {loading && <div style={{ color: '#9fb3b6' }}>Carregando...</div>}

      <div id="calendar" className="calendar-wrap"></div>

      {/* Modal: nova visita */}
      {open && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>Nova Visita</h3>
            <div className="form-row"><label>Data</label><input name="date" type="text" value={form.date} onChange={handleChange} placeholder="dd/mm/aaaa" /></div>
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

      {/* Modal: visualizar evento */}
      {viewOpen && activeEvent && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>Ver Acompanhamento</h3>
            <div className="form-row"><label>Tipo</label><div>{activeEvent.extendedProps?.type ?? 'evento'}</div></div>
            {activeEvent.extendedProps?.type === 'visit' && (
              <>
                <div className="form-row"><label>Data</label><div>{formatDateBR(activeEvent.startStr)}</div></div>
                <div className="form-row"><label>Cliente</label><div>{getClientName(activeEvent.extendedProps.raw?.client_id)}</div></div>
                <div className="form-row"><label>Propriedade</label><div>{getPropertyName(activeEvent.extendedProps.raw?.property_id)}</div></div>
                <div className="form-row"><label>Talhão</label><div>{getPlotName(activeEvent.extendedProps.raw?.plot_id)}</div></div>
              </>
            )}
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
