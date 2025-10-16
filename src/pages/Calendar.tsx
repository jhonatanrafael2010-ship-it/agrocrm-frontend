import React, { useEffect, useRef, useState, memo } from 'react'
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

const CalendarCore: React.FC = memo(() => {
  const calendarRef = useRef<any>(null);
  const [mounted, setMounted] = useState(false); // ✅ evita montagem duplicada
  const [events, setEvents] = useState<any[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [plots, setPlots] = useState<Plot[]>([]);
  const [form, setForm] = useState({
    date: '',
    client_id: '',
    property_id: '',
    plot_id: '',
    recommendation: ''
  });
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  // ==========================
  // 🔹 Carrega dados iniciais
  // ==========================
  useEffect(() => {
    if (mounted) return; // 🧱 bloqueia duplicação de montagem
    setMounted(true);

    console.log('🧠 CalendarCore montado');
    setLoading(true);

    Promise.all([
      fetch(`${API_BASE}clients`).then(r => r.json()),
      fetch(`${API_BASE}properties`).then(r => r.json()),
      fetch(`${API_BASE}plots`).then(r => r.json()),
      fetch(`${API_BASE}visits`).then(r => r.json()),
    ])
      .then(([cs, ps, pls, visits]) => {
        const evs: any[] = [];

        if (Array.isArray(visits)) {
          visits.forEach((v: any) => {
            if (v.date) {
              const clientName =
                (cs || []).find((c: any) => c.id === v.client_id)?.name ||
                `Cliente: ${v.client_id}`;

              evs.push({
                id: `visit-${v.id}`,
                title: clientName,
                start: v.date,
                extendedProps: { type: 'visit', raw: v }
              });
            }
          });
        }

        // 🔁 força limpeza de eventos antigos
        const api = calendarRef.current?.getApi?.();
        if (api) {
          api.removeAllEvents();
          api.addEventSource(evs);
        }

        setEvents(evs);
        setClients(cs || []);
        setProperties(ps || []);
        setPlots(pls || []);
      })
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, [mounted]);

  // ==========================
  // 🔹 Seleção de datas
  // ==========================
  const handleDateSelect = (info: any) => {
    const [y, m, d] = info.startStr.split('-');
    setForm(f => ({ ...f, date: `${d}/${m}/${y}` }));
    setOpen(true);
  };

  // ==========================
  // 🔹 Manipulação de formulário
  // ==========================
  const handleChange = (e: any) => {
    const { name, value } = e.target;
    setForm(f => ({ ...f, [name]: value }));
  };

  // ==========================
  // 🔹 Criação de nova visita
  // ==========================
  const handleCreateVisit = async () => {
    if (!form.date || !form.client_id || !form.property_id || !form.plot_id)
      return alert('Data, cliente, propriedade e talhão são obrigatórios');

    try {
      const [d, m, y] = form.date.split('/');
      const dateISO = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;

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
      });

      const body = await res.json();
      if (!res.ok) throw new Error(body.message || `status ${res.status}`);

      const created = body.visit || body;
      const clientName =
        clients.find(c => c.id === Number(form.client_id))?.name ||
        `Cliente: ${form.client_id}`;

      setEvents(e => [
        ...e,
        {
          id: `visit-${created.id}`,
          title: clientName,
          start: created.date,
          extendedProps: { type: 'visit', raw: created }
        }
      ]);

      setOpen(false);
      setForm({
        date: '',
        client_id: '',
        property_id: '',
        plot_id: '',
        recommendation: ''
      });
    } catch (err: any) {
      alert(err?.message || 'Erro ao criar visita');
    }
  };


  return (
    <div className="calendar-page">
      {loading && <div style={{ color: '#9fb3b6' }}>Carregando...</div>}
      <div className="calendar-wrap">
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
          headerToolbar={{ left: 'prev,next today', center: 'title', right: 'dayGridMonth,timeGridWeek,timeGridDay' }}
        />
      </div>

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
    </div>
  )
})

const CalendarPage: React.FC = () => {
  console.log('🔁 Calendar renderizado')
  return <CalendarCore />
}

export default CalendarPage
