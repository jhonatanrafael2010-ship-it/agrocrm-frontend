import React, { useEffect, useRef, useState } from 'react'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import ptBrLocale from '@fullcalendar/core/locales/pt-br'
import DarkSelect from '../components/DarkSelect'

const API_BASE = (import.meta as any).env.VITE_API_URL || '/api/'

type Client = { id: number; name: string }
type Property = { id: number; client_id: number; name: string }
type Plot = { id: number; property_id: number; name: string }
type Culture = { id: number; name: string }
type Variety = { id: number; name: string; culture: string }
type Consultant = { id: number; name: string }

type Visit = {
  id: number
  client_id: number
  property_id: number
  plot_id: number
  consultant_id?: number | null
  date: string
  recommendation?: string
  status?: 'planned' | 'done' | string
  culture?: string
  variety?: string
}

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

const CalendarPage: React.FC = () => {
  const calendarRef = useRef<any>(null)
  const [events, setEvents] = useState<any[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [cultures, setCultures] = useState<Culture[]>([])
  const [varieties, setVarieties] = useState<Variety[]>([])
  const [consultants, setConsultants] = useState<Consultant[]>([])
  const [properties, setProperties] = useState<Property[]>([])
  const [plots, setPlots] = useState<Plot[]>([])
  const [loading, setLoading] = useState(false)

  // filtro de agenda por consultor
  const [selectedConsultant, setSelectedConsultant] = useState<string>('')

  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({
    id: null as number | null,
    date: '',
    client_id: '',
    property_id: '',
    plot_id: '',
    consultant_id: '',
    culture: '',
    variety: '',
    recommendation: '',
    genPheno: true
  })

  // ============================================================
  // 🔁 Função para carregar visitas e montar eventos
  // ============================================================
  const loadVisits = async () => {
    try {
      const res = await fetch(`${API_BASE}visits`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const vs: Visit[] = await res.json();

      const cs = clients || [];
      const cons = consultants || [];

      const evs = (vs || [])
        .filter((v) => v.date)
        .map((v) => {
          const clientName = cs.find((c) => c.id === v.client_id)?.name || `Cliente ${v.client_id}`;
          const variety = v.recommendation?.match(/\(([^)]+)\)/)?.[1] || v.variety || '';
          let stage = v.recommendation || ''
stage = stage.replace(/\s*\(.*?\)\s*/g, '').trim()  // remove "(AS 1820 PRO4)"
          const consultant = cons.find((x) => x.id === v.consultant_id)?.name || '';

          const titleLines = [
            `👤 ${clientName}`,
            variety ? `🌱 ${variety}` : '',
            stage ? `📍 ${stage}` : '',
            consultant ? `👨‍🌾 ${consultant}` : '',
          ].filter(Boolean);

          const tooltip = `
👤 ${clientName}
🌱 ${variety || '-'}
📍 ${stage || '-'}
👨‍🌾 ${consultant || '-'}
          `.trim();

          return {
            id: `visit-${v.id}`,
            title: titleLines.join('\n'),
            start: v.date,
            backgroundColor: colorFor(v.date, v.status),
            extendedProps: { type: 'visit', raw: v },
            className: 'visit-event',
            dataTooltip: tooltip,
          };
        });

      setEvents(evs);
      console.log(`✅ ${evs.length} visitas carregadas no calendário.`);
    } catch (err) {
      console.error('❌ Erro ao carregar visitas:', err);
    }
  };

  // ============================================================
  // 🚀 Load inicial — carrega clientes, culturas e dispara loadVisits
  // ============================================================
  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch(`${API_BASE}clients`).then(r => r.json()),
      fetch(`${API_BASE}properties`).then(r => r.json()),
      fetch(`${API_BASE}plots`).then(r => r.json()),
      fetch(`${API_BASE}cultures`).then(r => r.json()),
      fetch(`${API_BASE}varieties`).then(r => r.json()),
      fetch(`${API_BASE}consultants`).then(r => r.json())
    ])
      .then(([cs, ps, pls, cts, vars, cons]) => {
        setClients(cs || []);
        setProperties(ps || []);
        setPlots(pls || []);
        setCultures(cts || []);
        setVarieties(vars || []);
        setConsultants(cons || []);
      })
      .catch(console.error)
      .finally(() => {
        loadVisits(); // ✅ carrega visitas assim que tudo estiver pronto
        setLoading(false);
      });
  }, []);


  // ==============================
  // utils
  // ==============================
  const addDaysISO = (iso: string, days: number) => {
    const d = new Date(iso)
    d.setDate(d.getDate() + days)
    const yyyy = d.getFullYear()
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    return `${yyyy}-${mm}-${dd}`
  }

  const colorFor = (dateISO: string, status?: string) => {
    const today = new Date().toISOString().split('T')[0]
    if (status === 'done') return '#16a34a'  // verde
    if (dateISO < today) return '#dc2626'    // vermelho
    return '#3b82f6'                          // azul
  }

  // ==============================
  // handlers
  // ==============================
  const handleDateSelect = (info: any) => {
    const [y, m, d] = info.startStr.split('-')
    setForm(f => ({ ...f, date: `${d}/${m}/${y}`, id: null }))
    setOpen(true)
  }

  const handleChange = (e: any) => {
    const { name, value } = e.target
    setForm(f => ({ ...f, [name]: value }))
  }


  const handleCreateOrUpdate = async () => {
  if (!form.date || !form.client_id || !form.property_id || !form.plot_id) {
    alert('Data, cliente, propriedade e talhão são obrigatórios');
    return;
  }

  const [d, m, y] = form.date.split('/')

// 🔧 Corrige fuso horário local → UTC
function toYmdLocal(date: Date) {
  const offset = date.getTimezoneOffset()
  const corrected = new Date(date.getTime() - offset * 60000)
  return corrected.toISOString().slice(0, 10)
}

// 🔍 Converte cultura ID → nome (compatível com string ou number)
let cultureName = ''
if (form.culture) {
  const byId = cultures.find(c => String(c.id) === String(form.culture))
  cultureName = byId ? byId.name : form.culture
}

// 📅 Converte a data digitada no formato brasileiro para ISO (corrigida)
const iso = toYmdLocal(new Date(`${y}-${m}-${d}`))

// 🧱 Monta objeto-base da visita
const base = {
  client_id: Number(form.client_id),
  property_id: Number(form.property_id),
  plot_id: Number(form.plot_id),
  consultant_id: form.consultant_id ? Number(form.consultant_id) : null,
  date: iso,
  recommendation: form.recommendation || '',
  culture: cultureName, // ✅ novo campo corrigido
  variety: form.variety || '',
  status: 'planned'
};


  try {
    const res = await fetch(`${API_BASE}visits`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(base),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(body || `Erro ${res.status}`);
    }

    const createdBody = await res.json();
    const created = createdBody.visit as Visit;

    // 🌾 Gerar visitas fenológicas automáticas (extra)
    if (form.genPheno && form.culture && PHENO[form.culture]) {
      const items = PHENO[form.culture]
        .map(s => ({
          client_id: base.client_id,
          property_id: base.property_id,
          plot_id: base.plot_id,
          consultant_id: base.consultant_id,
          date: addDaysISO(iso, s.days),
          recommendation: `${s.code} — ${s.name}${form.variety ? ` (${form.variety})` : ''}`,
          status: 'planned'
        }))
        .filter(it => it.date !== iso);

      if (items.length) {
        const bulk = await fetch(`${API_BASE}visits/bulk`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items })
        });
        const bulkBody = await bulk.json();
        if (!bulk.ok) throw new Error(bulkBody.message || 'Erro em /visits/bulk');

        const all = [created, ...bulkBody];
        const clientName = clients.find(c => c.id === base.client_id)?.name || `Cliente ${base.client_id}`;

        setEvents(prev => [
          ...prev,
          ...all.map((v: Visit) => {
            const consultant = consultants.find(x => x.id === v.consultant_id)?.name || '';
            const variety = v.recommendation?.match(/\(([^)]+)\)/)?.[1] || '';
            const stage = v.recommendation?.split('—')[1]?.trim() || v.recommendation || '';
            const titleLines = [
              `👤 ${clientName}`,
              variety ? `🌱 ${variety}` : '',
              stage ? `📍 ${stage}` : '',
              consultant ? `👨‍🌾 ${consultant}` : '',
            ].filter(Boolean);
            return {
              id: `visit-${(v as any).id}`,
              title: titleLines.join('\n'),
              start: v.date,
              backgroundColor: colorFor(v.date, v.status),
              extendedProps: { type: 'visit', raw: v },
            };
          }),
        ]);
      }
    } else {
      // 📌 Criação simples (sem fenologia)
      const clientName = clients.find(c => c.id === base.client_id)?.name || `Cliente ${base.client_id}`;
      const consultant = consultants.find(x => x.id === base.consultant_id)?.name || '';
      const variety = form.variety || '';
      const stage = form.recommendation || '';
      const titleLines = [
        `👤 ${clientName}`,
        variety ? `🌱 ${variety}` : '',
        stage ? `📍 ${stage}` : '',
        consultant ? `👨‍🌾 ${consultant}` : '',
      ].filter(Boolean);

      setEvents(prev => [
        ...prev,
        {
          id: `visit-${created.id}`,
          title: titleLines.join('\n'),
          start: created.date,
          backgroundColor: colorFor(created.date, created.status),
          extendedProps: { type: 'visit', raw: created },
        },
      ]);
    }

    // 🧹 Limpa formulário e atualiza calendário
    setOpen(false);
    setForm({
      id: null,
      date: '',
      client_id: '',
      property_id: '',
      plot_id: '',
      consultant_id: '',
      culture: '',
      variety: '',
      recommendation: '',
      genPheno: true,
    });
    await loadVisits();

  } catch (e: any) {
    console.error("❌ Erro ao salvar visita:", e);
    alert(e?.message || 'Erro ao salvar visita');
  }
};


  const handleDelete = async () => {
    if (!form.id) return
    if (!confirm('🗑 Deseja realmente excluir esta visita?')) return
    try {
      const resp = await fetch(`${API_BASE}visits/${form.id}`, { method: 'DELETE' })
      if (!resp.ok) throw new Error('Erro HTTP ' + resp.status)
      setEvents(prev => prev.filter(e => e.id !== `visit-${form.id}`))
      setOpen(false)
    } catch (e) {
      alert('Erro ao excluir')
    }
  }

  const markDone = async () => {
    if (!form.id) return
    try {
      const r = await fetch(`${API_BASE}visits/${form.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'done' })
      })
      if (!r.ok) throw new Error('Falha ao concluir')
      setEvents(prev => prev.map(ev => {
        if (ev.id === `visit-${form.id}`) {
          const v = { ...ev.extendedProps.raw, status: 'done' }
          return { ...ev, backgroundColor: colorFor(v.date, v.status), extendedProps: { ...ev.extendedProps, raw: v } }
        }
        return ev
      }))
      setOpen(false)
    } catch (e) {
      alert('Erro ao concluir')
    }
  }

  // ==============================
  // Render
  // ==============================
  return (
    <div className="calendar-page">
      <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:8 }}>
        <h2 style={{ margin:0 }}>Agenda de Visitas</h2>
        <select
          value={selectedConsultant}
          onChange={(e)=>setSelectedConsultant(e.target.value)}
          style={{ marginLeft:'auto', padding:'6px 10px', borderRadius:8, background:'#0d1f1b', color:'#cde5df', border:'1px solid #234' }}
        >
          <option value="">Todos os consultores</option>
          {consultants.map(c => <option key={c.id} value={String(c.id)}>{c.name}</option>)}
        </select>
      </div>

      {loading && <div style={{ color: '#9fb3b6' }}>Carregando...</div>}

      <FullCalendar
  ref={calendarRef}
  plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
  locales={[ptBrLocale]}
  locale="pt-br"
  initialView="dayGridMonth"
  selectable
  select={handleDateSelect}
  events={events.filter(e => {
    if (!selectedConsultant) return true;
    const cid = e.extendedProps?.raw?.consultant_id;
    return String(cid || '') === selectedConsultant;
  })}
  height={650}
  headerToolbar={{
    left: 'prev,next today',
    center: 'title',
    right: 'dayGridMonth,timeGridWeek,timeGridDay'
  }}
  eventContent={(arg) => {
    const v = arg.event.extendedProps?.raw as Visit;
    const bg = colorFor(v?.date || arg.event.startStr, v?.status);
    const lines = arg.event.title.split('\n');

    const wrapper = document.createElement('div');
    wrapper.style.background = bg;
    wrapper.style.color = '#fff';
    wrapper.style.padding = '4px 6px';
    wrapper.style.borderRadius = '8px';
    wrapper.style.lineHeight = '1.25';
    wrapper.style.fontSize = '0.8rem';
    wrapper.style.whiteSpace = 'pre-line';
    wrapper.style.overflow = 'hidden';
    wrapper.style.textOverflow = 'ellipsis';
    wrapper.style.maxHeight = '48px'; // mostra no máx. 3 linhas
    wrapper.style.cursor = 'pointer';
    wrapper.style.position = 'relative';
    wrapper.textContent = lines.join('\n');

    return { domNodes: [wrapper] };
  }}
  eventClick={(info) => {
          const v = info.event.extendedProps?.raw as Visit
          if (!v) return
          const d = v.date ? new Date(v.date) : null
          setForm({
            id: v.id,
            date: d ? d.toLocaleDateString('pt-BR') : '',
            client_id: String(v.client_id || ''),
            property_id: String(v.property_id || ''),
            plot_id: String(v.plot_id || ''),
            consultant_id: String(v.consultant_id || ''),
            culture: v.culture || '',
            variety: v.variety || '',
            recommendation: v.recommendation || '',
            genPheno: false
          })
          setOpen(true)
        }}
      />

      {open && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>{form.id ? 'Editar Visita' : 'Nova Visita'}</h3>

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
              <button className="btn-cancel" onClick={() => setOpen(false)}>Cancelar</button>

              {!form.id && (
                <button className="btn-save" onClick={handleCreateOrUpdate}>Salvar</button>
              )}

              {form.id && (
                <>
                  <button className="btn-save" onClick={markDone}>Marcar como Concluída</button>
                  <button className="btn-delete" onClick={handleDelete}>Excluir</button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default CalendarPage
