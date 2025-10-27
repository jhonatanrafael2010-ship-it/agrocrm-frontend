import React, { useEffect, useRef, useState } from 'react'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import ptBrLocale from '@fullcalendar/core/locales/pt-br'
import DarkSelect from '../components/DarkSelect'
import './Calendar.css'
import { Camera, CameraResultType } from '@capacitor/camera'
import { Geolocation } from '@capacitor/geolocation'



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
  client_name?: string        // ✅ nome vindo do backend
  consultant_name?: string    // ✅ nome vindo do backend
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
    genPheno: true,
    photos: null as FileList | null,
    photoPreviews: [] as string[],
    clientSearch: ''  // ✅ novo campo para busca digitável
  });



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
          // ✅ Agora prioriza os nomes vindos do backend
          const clientName =
            v.client_name ||
            cs.find((c) => c.id === v.client_id)?.name ||
            `Cliente ${v.client_id}`;

          const consultant =
            v.consultant_name ||
            cons.find((x) => x.id === v.consultant_id)?.name ||
            '';

          const variety =
            v.variety || v.recommendation?.match(/\(([^)]+)\)/)?.[1] || '';

          let stage = '';
          if (v.recommendation) {
            stage = v.recommendation.split('—').pop()?.trim() || v.recommendation;
            stage = stage.replace(/\s*\(.*?\)\s*/g, '').trim();
          }

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



 // =============================================================
// 🎨 Função de cor sólida para eventos (sem faixas nem degradê)
// =============================================================
  const colorFor = (dateISO?: string, status?: string): string => {
    const s = (status || '').toLowerCase();

    // Cores fixas por status
    if (s.includes('conclu')) return '#16a34a';     // verde — concluído
    if (s.includes('pendente')) return '#f59e0b';   // amarelo — pendente
    if (s.includes('atras')) return '#dc2626';      // vermelho — atrasado
    if (s.includes('planejado')) return '#2563eb';  // azul — planejado

    // Fallback baseado na data (para variedade)
    if (dateISO) {
      const hash = [...dateISO].reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
      const palette = ['#2dd36f', '#3b82f6', '#10b981', '#8b5cf6', '#ec4899'];
      return palette[hash % palette.length];
    }

    return '#6b7280'; // cinza neutro
  };

  const handleChange = (e: any) => {
    const { name, value } = e.target
    setForm(f => ({ ...f, [name]: value }))
  }


  const handleCreateOrUpdate = async () => {
  if (!form.date || !form.client_id) {
    alert('Data e cliente são obrigatórios');
    return;
  }


  const [d, m, y] = form.date.split('/');
  // ✅ Garante que a data enviada para o backend é sempre o mesmo dia escolhido (sem deslocamento de fuso)
  const iso = `${y}-${m}-${d}`; 


  // resolve nome da cultura
  let cultureName = '';
  if (form.culture) {
    const byId = cultures.find(c => String(c.id) === String(form.culture));
    cultureName = byId ? byId.name : form.culture;
  }

  // monta payload completo
  const payload = {
    client_id: Number(form.client_id),
    property_id: Number(form.property_id),
    plot_id: Number(form.plot_id),
    consultant_id: form.consultant_id ? Number(form.consultant_id) : null,
    date: iso,
    status: 'planned',
    generate_schedule: !!form.genPheno,
    culture: cultureName || '',
    variety: form.variety || '',
    recommendation: form.genPheno ? '' : (form.recommendation || 'Plantio'),
    latitude: (form as any).latitude || null,
    longitude: (form as any).longitude || null,
  };

  try {
    const res = await fetch(`${API_BASE}visits`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(body || `Erro ${res.status}`);
    }

    // ✅ Captura o ID da nova visita criada
    const data = await res.json();
    const newVisitId = data.visit?.id;

    // ✅ Se há fotos, envia ao backend
    if (newVisitId && form.photos && form.photos.length > 0) {
      const fd = new FormData();
      Array.from(form.photos).forEach((file) => fd.append("photos", file));

      try {
        await fetch(`${API_BASE}visits/${newVisitId}/photos`, {
          method: "POST",
          body: fd,
        });
        console.log("📸 Fotos enviadas com sucesso!");
      } catch (err) {
        console.error("Erro ao enviar fotos:", err);
      }
    }

    // Captura coordenadas GPS (se o usuário permitir)
if ("geolocation" in navigator) {
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      console.log("📍 Localização:", pos.coords.latitude, pos.coords.longitude);
      // Exemplo: adicionar no payload
      payload["latitude"] = pos.coords.latitude;
      payload["longitude"] = pos.coords.longitude;
    },
    (err) => console.warn("⚠️ Sem permissão para GPS:", err)
  );
}


    // ✅ Limpa formulário e recarrega visitas
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
      photos: null,
      photoPreviews: [],
      clientSearch: ''
    });
    await loadVisits();
    } catch (e: any) {
      console.error("❌ Erro ao salvar visita:", e);
      alert(e?.message || 'Erro ao salvar visita');
    }
  }; // ✅ <-- ESTA LINHA FECHA handleCreateOrUpdate CORRETAMENTE


  const handleDelete = async () => {
    if (!form.id) return;
    if (!confirm('🗑 Deseja realmente excluir esta visita?')) return;
    try {
      const resp = await fetch(`${API_BASE}visits/${form.id}`, { method: 'DELETE' });
      if (!resp.ok) throw new Error('Erro HTTP ' + resp.status);
      // 🔁 Recarrega visitas para refletir exclusão em cascata
      await loadVisits();
      setOpen(false);
    } catch (e) {
      alert('Erro ao excluir');
    }
  };


  // ============================================================
// 📸 Tirar Foto diretamente do app
// ============================================================
const handleTakePhoto = async () => {
  try {
    const image = await Camera.getPhoto({
      quality: 85,
      allowEditing: false,
      resultType: CameraResultType.Base64,
    });

    if (image.base64String) {
      const base64 = `data:image/jpeg;base64,${image.base64String}`;
      setForm((f) => ({
        ...f,
        photoPreviews: [...(f.photoPreviews || []), base64],
      }));
      alert('📸 Foto capturada com sucesso!');
    }
  } catch (err) {
    console.error('Erro ao tirar foto:', err);
    alert('Erro ao capturar foto');
  }
};

// ============================================================
// 📍 Capturar localização GPS do dispositivo
// ============================================================
const handleGetLocation = async () => {
  try {
    const position = await Geolocation.getCurrentPosition();
    const { latitude, longitude } = position.coords;
    setForm((f) => ({
      ...f,
      latitude,
      longitude,
    }));
    alert(`📍 Localização salva: ${latitude.toFixed(5)}, ${longitude.toFixed(5)}`);
  } catch (err) {
    console.error('Erro ao obter localização:', err);
    alert('Erro ao capturar localização');
  }
};


// ============================================================
// ✅ Marcar visita como concluída
// ============================================================
const markDone = async () => {
  if (!form.id) return;
  try {
    const r = await fetch(`${API_BASE}visits/${form.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'done' }),
    });

    if (!r.ok) throw new Error('Erro HTTP ' + r.status);

    // ✅ Atualiza o calendário visualmente
    const calendarApi = calendarRef.current?.getApi();

    setEvents((prev) =>
      prev.map((ev) => {
        if (ev.id === `visit-${form.id}`) {
          const updatedVisit = { ...ev.extendedProps.raw, status: 'done' };
          const newBg = colorFor(updatedVisit.date, updatedVisit.status);
          const existingEvent = calendarApi?.getEventById(ev.id);

          if (existingEvent) {
            existingEvent.setExtendedProp('status', 'done');
            existingEvent.setProp('backgroundColor', newBg);
            existingEvent.setProp('borderColor', newBg);
          }

          return {
            ...ev,
            backgroundColor: newBg,
            extendedProps: { ...ev.extendedProps, raw: updatedVisit },
          };
        }
        return ev;
      })
    );

    await loadVisits();
    setOpen(false);
  } catch (e) {
    console.error('Erro ao concluir:', e);
    alert('Erro ao concluir');
  }
};

    // ==============================
  // Render
  // ==============================
  return (
    <div className="calendar-page">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
        <h2 style={{ margin: 0 }}>Agenda de Visitas</h2>
        <select
          value={selectedConsultant}
          onChange={(e) => setSelectedConsultant(e.target.value)}
          style={{ marginLeft: 'auto', padding: '6px 10px', borderRadius: 8, background: '#0d1f1b', color: '#cde5df', border: '1px solid #234' }}
        >
          <option value="">Todos os consultores</option>
          {consultants.map(c => (
            <option key={c.id} value={String(c.id)}>{c.name}</option>
          ))}
        </select>
      </div>

      {loading && <div style={{ color: '#9fb3b6' }}>Carregando...</div>}

      <FullCalendar
        ref={calendarRef}
        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
        locales={[ptBrLocale]}
        locale="pt-br"
        initialView="dayGridMonth"
        height={window.innerWidth < 768 ? 'auto' : 650}
        expandRows={true}
        dateClick={(info) => {
          const dateStr = info.dateStr;
          const [y, m, d] = dateStr.split('-');
          setForm({
            id: null,
            date: `${d}/${m}/${y}`,
            client_id: '',
            property_id: '',
            plot_id: '',
            consultant_id: '',
            culture: '',
            variety: '',
            recommendation: '',
            genPheno: true,
            photos: null,
            photoPreviews: [],
            clientSearch: ''
          });
          setOpen(true);
        }}
        events={events.filter(e => {
          if (!selectedConsultant) return true;
          const cid = e.extendedProps?.raw?.consultant_id;
          return String(cid || '') === selectedConsultant;
        })}
        headerToolbar={{
          left: 'prev,next today',
          center: 'title',
          right: 'dayGridMonth,timeGridWeek,timeGridDay'
        }}
        eventContent={(arg) => {
          const v = arg.event.extendedProps?.raw;

          // Cor sólida de fundo (sem faixas)
          const bg = colorFor(v?.date || arg.event.startStr, v?.status);
          console.log("🎨 Fundo aplicado:", bg);


          // Cria o wrapper principal
          const wrapper = document.createElement('div');
          wrapper.style.backgroundColor = bg;
          wrapper.style.color = '#fff';
          wrapper.style.padding = '6px 8px';
          wrapper.style.borderRadius = '10px';
          wrapper.style.display = 'flex';
          wrapper.style.flexDirection = 'column';
          wrapper.style.alignItems = 'flex-start';
          wrapper.style.justifyContent = 'center';
          wrapper.style.fontSize = window.innerWidth < 768 ? '0.8rem' : '0.85rem';
          wrapper.style.lineHeight = '1.3';
          wrapper.style.wordBreak = 'break-word';
          wrapper.style.whiteSpace = 'normal';
          wrapper.style.wordBreak = 'break-word';
          wrapper.style.textAlign = 'left';
          wrapper.style.textAlign = 'left';
          wrapper.style.boxSizing = 'border-box';
          wrapper.style.border = 'none'; // 🚫 remove bordas laterais
          wrapper.style.outline = 'none'; // 🚫 garante fundo limpo
          wrapper.style.minHeight = '52px';
          wrapper.classList.add('visit-card');
          wrapper.setAttribute('data-tooltip', arg.event.extendedProps?.dataTooltip || '');

          // Cria linhas bem organizadas (sem emojis)
          const infoLines = [
            `Cliente: ${v?.client_name || '-'}`,
            `Variedade: ${v?.variety || '-'}`,
            `Fenologia: ${v?.recommendation?.split('—').pop()?.trim() || '-'}`,
            `Consultor: ${v?.consultant_name || '-'}`,
          ];

          infoLines.forEach((line) => {
            const p = document.createElement('div');
            p.textContent = line;
            p.style.margin = '1px 0';
            wrapper.appendChild(p);
          });

          return { domNodes: [wrapper] };
        }}


        eventClick={(info) => {
          const v = info.event.extendedProps?.raw;
          if (!v) return;
          const d = v.date ? new Date(v.date) : null;
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
            genPheno: false,
            photos: null,
            photoPreviews: [],
            clientSearch: ''
          });
          setOpen(true);
        }}
      />

      {/* ➕ Botão flutuante (após o FullCalendar, ainda dentro do return) */}
      {window.innerWidth <= 768 && (
        <button
          className="fab-new-visit"
          onClick={() => {
            setForm({
              id: null,
              date: new Date().toLocaleDateString('pt-BR'),
              client_id: '',
              property_id: '',
              plot_id: '',
              consultant_id: '',
              culture: '',
              variety: '',
              recommendation: '',
              genPheno: true,
              photos: null,
              photoPreviews: [],
              clientSearch: '',
            });
            setOpen(true);
          }}
        >
          +
        </button>
      )}

      {open && (
        <div className="modal-overlay">
          <div className="modal">
            {/* 🔘 Botão de Fechar */}
            <button
              className="modal-close"
              onClick={() => setOpen(false)}
              aria-label="Fechar"
            >
              ✕
            </button>

            <h3>{form.id ? 'Editar Visita' : 'Nova Visita'}</h3>


            <div className="form-row">
              <label>Data</label>
              <input name="date" value={form.date} onChange={handleChange} placeholder="dd/mm/aaaa" />
            </div>

            {/* 🧑‍🌾 Cliente com busca inteligente */}
            <div className="form-row" style={{ position: 'relative' }}>
              <label style={{ fontWeight: 600 }}>Cliente</label>
              <input
                type="text"
                value={
                  clients.find(c => String(c.id) === form.client_id)?.name ||
                  form.clientSearch ||
                  ''
                }
                onChange={(e) => {
                  const value = e.target.value;
                  setForm(f => ({ ...f, clientSearch: value, client_id: '' }));
                }}
                placeholder="Digite o nome do cliente..."
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: '8px',
                  border: '1px solid #2d3d3f',
                  background: '#101c1a',
                  color: '#d5e5e2',
                }}
              />
              {form.clientSearch && (
                <ul
                  style={{
                    position: 'absolute',
                    top: '70px',
                    left: 0,
                    right: 0,
                    background: '#182825',
                    border: '1px solid #234',
                    borderRadius: '8px',
                    maxHeight: '160px',
                    overflowY: 'auto',
                    zIndex: 10,
                    listStyle: 'none',
                    margin: 0,
                    padding: '4px 0'
                  }}
                >
                  {clients
                    .filter(c => c.name.toLowerCase().startsWith(form.clientSearch.toLowerCase()))
                    .map(c => (
                      <li
                        key={c.id}
                        onClick={() => {
                          setForm(f => ({
                            ...f,
                            client_id: String(c.id),
                            clientSearch: c.name
                          }));
                        }}
                        style={{
                          padding: '6px 10px',
                          cursor: 'pointer',
                          color: '#cde5df',
                          background: form.client_id === String(c.id) ? '#244b41' : 'transparent',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = '#244b41')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                      >
                        {c.name}
                      </li>
                    ))}
                </ul>
              )}
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
                {cultures.map(c => (
                  <option key={c.id} value={c.name}>{c.name}</option>
                ))}
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

            {/* 📸 & 📍 Botões para captura rápida */}
            <div
              className="form-row"
              style={{
                display: 'flex',
                gap: '10px',
                justifyContent: 'space-between',
                marginTop: 10,
              }}
            >
              <button type="button" className="btn-new" onClick={handleTakePhoto}>
                📸 Tirar Foto
              </button>
              <button type="button" className="btn-new" onClick={handleGetLocation}>
                📍 Capturar Localização
              </button>
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

            {/* 📸 Upload de fotos */}
            <div className="form-row">
              <label style={{ fontWeight: 600 }}>Fotos da Visita</label>
              <input
                type="file"
                multiple
                accept="image/*"
                onChange={(e) => {
                  const files = e.target.files;
                  if (!files) return;
                  const previews = Array.from(files).map((f) => URL.createObjectURL(f));
                  setForm((f) => ({
                    ...f,
                    photos: files,
                    photoPreviews: previews
                  }));
                }}
              />

              {/* 🔍 Fotos existentes da visita */}
              {form.id && form.photoPreviews.length === 0 && (
                <div className="form-row">
                  <label>Fotos salvas</label>
                  <div className="photo-gallery">
                    {events
                      .find(ev => ev.extendedProps?.raw?.id === form.id)
                      ?.extendedProps?.raw?.photos?.map((p: any, i: number) => (
                        <div key={i} className="photo-thumb">
                          <img src={p.url} alt={`foto ${i + 1}`} />
                          <button
                            type="button"
                            onClick={async () => {
                              if (!confirm('Excluir esta foto?')) return;
                              try {
                                const res = await fetch(`${API_BASE}photos/${p.id}`, { method: 'DELETE' });
                                if (res.ok) {
                                  alert('Foto excluída com sucesso!');
                                  await loadVisits();
                                  setForm(f => ({ ...f }));
                                } else {
                                  alert('Falha ao excluir a foto.');
                                }
                              } catch (err) {
                                console.error('Erro ao excluir foto:', err);
                                alert('Erro ao excluir.');
                              }
                            }}
                            style={{
                              position: 'absolute',
                              top: '4px',
                              right: '4px',
                              background: 'rgba(0,0,0,0.6)',
                              color: '#fff',
                              border: 'none',
                              borderRadius: '50%',
                              width: '22px',
                              height: '22px',
                              cursor: 'pointer',
                              fontWeight: 'bold'
                            }}
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                  </div>

                  <button
                    onClick={() => window.open(`/api/visits/${form.id}/photos`, '_blank')}
                    style={{
                      background: 'linear-gradient(90deg, #2563eb, #38bdf8)',
                      border: 'none',
                      padding: '8px 14px',
                      borderRadius: '8px',
                      marginTop: '6px',
                      color: '#fff',
                      cursor: 'pointer'
                    }}
                  >
                    📸 Ver todas as fotos da visita
                  </button>
                </div>
              )}

              {/* Miniaturas de novas fotos */}
              {form.photoPreviews && form.photoPreviews.length > 0 && (
                <div className="photo-gallery">
                  {form.photoPreviews.map((src, i) => (
                    <div key={i} className="photo-thumb">
                      <img src={src} alt={`foto ${i + 1}`} />
                      <button
                        type="button"
                        onClick={() => {
                          const updated = form.photoPreviews.filter((_, idx) => idx !== i);
                          setForm((f) => ({ ...f, photoPreviews: updated }));
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <small style={{ color: '#8fa9a3' }}>
                Envie uma ou mais fotos (JPEG/PNG). Você pode removê-las antes de salvar.
              </small>
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
  );
};

export default CalendarPage;
