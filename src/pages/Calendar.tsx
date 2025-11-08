import React, { useEffect, useRef, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import ptBrLocale from "@fullcalendar/core/locales/pt-br";
import DarkSelect from "../components/DarkSelect";
import "../styles/Calendar.css";
import { Camera, CameraResultType } from "@capacitor/camera";
import { Geolocation } from "@capacitor/geolocation";
import VisitPhotos from "../components/VisitPhotos";


const API_BASE = (import.meta as any).env.VITE_API_URL || "/api/";

type Client = { id: number; name: string };
type Property = { id: number; client_id: number; name: string };
type Plot = { id: number; property_id: number; name: string };
type Culture = { id: number; name: string };
type Variety = { id: number; name: string; culture: string };
type Consultant = { id: number; name: string };

type Visit = {
  id: number;
  client_id: number;
  property_id: number;
  plot_id: number;
  consultant_id?: number | null;
  date: string;
  recommendation?: string;
  status?: "planned" | "done" | string;
  photos?: Photo[];
  culture?: string;
  variety?: string;
  latitude?: number | null;
  longitude?: number | null;
  client_name?: string;
  consultant_name?: string;
};
type Photo = {
  id: number;
  url: string;
  caption?: string;
};


const CalendarPage: React.FC = () => {
  const calendarRef = useRef<any>(null);

  // dados base
  const [events, setEvents] = useState<any[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [cultures, setCultures] = useState<Culture[]>([]);
  const [varieties, setVarieties] = useState<Variety[]>([]);
  const [consultants, setConsultants] = useState<Consultant[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [plots, setPlots] = useState<Plot[]>([]);
  const [loading, setLoading] = useState(false);

  // filtros
  const [selectedConsultant, setSelectedConsultant] = useState<string>("");
  const [selectedVariety, setSelectedVariety] = useState<string>("");

  // modal
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    photoCaptions: [] as string[],
    id: null as number | null,
    date: "",
    client_id: "",
    property_id: "",
    plot_id: "",
    consultant_id: "",
    culture: "",
    variety: "",
    recommendation: "",
    genPheno: true,
    photos: null as FileList | null,
    photoPreviews: [] as string[],
    savedPhotos: [] as any[], // 🆕 fotos já salvas da visita
    clientSearch: "",
    latitude: null as number | null,
    longitude: null as number | null,
  });


  // ============================================================
  // 🔁 Carregar visitas -> monta eventos
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
          const clientName =
            v.client_name ||
            cs.find((c) => c.id === v.client_id)?.name ||
            `Cliente ${v.client_id}`;

          const consultant =
            v.consultant_name ||
            cons.find((x) => x.id === v.consultant_id)?.name ||
            "";

          const variety =
            v.variety || v.recommendation?.match(/\(([^)]+)\)/)?.[1] || "";

          let stage = "";
          if (v.recommendation) {
            stage =
              v.recommendation.split("—").pop()?.trim() || v.recommendation;
            stage = stage.replace(/\s*\(.*?\)\s*/g, "").trim();
          }

          const tooltip = `
👤 ${clientName}
🌱 ${variety || "-"}
📍 ${stage || "-"}
👨‍🌾 ${consultant || "-"}
          `.trim();

          return {
            id: `visit-${v.id}`,
            title: clientName,
            start: v.date,
            backgroundColor: colorFor(v.date, v.status),
            borderColor: colorFor(v.date, v.status),
            extendedProps: { type: "visit", raw: v, tooltip },
            classNames: ["visit-event"],
          };
        });

      setEvents(evs);
      if (form.id) {
        const updatedVisit = vs.find((v) => v.id === form.id);
        if (updatedVisit) {
          setForm((f) => ({
            ...f,
            savedPhotos: updatedVisit.photos || [],
          }));
        }
      }
      console.log(`✅ ${evs.length} visitas carregadas no calendário.`);
    } catch (err) {
      console.error("❌ Erro ao carregar visitas:", err);
    }
  };

  // ============================================================
  // 🚀 Load inicial
  // ============================================================
  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch(`${API_BASE}clients`).then((r) => r.json()),
      fetch(`${API_BASE}properties`).then((r) => r.json()),
      fetch(`${API_BASE}plots`).then((r) => r.json()),
      fetch(`${API_BASE}cultures`).then((r) => r.json()),
      fetch(`${API_BASE}varieties`).then((r) => r.json()),
      fetch(`${API_BASE}consultants`).then((r) => r.json()),
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
        loadVisits();
        setLoading(false);
      });
  }, []);

  // ============================================================
  // 🎨 Cor dos eventos
  // ============================================================
  const colorFor = (dateISO?: string, status?: string): string => {
    const s = (status || "").toLowerCase();

    // concluído
    if (s.includes("done") || s.includes("conclu")) return "#2dd36f"; // verde da sua UI

    // normaliza data
    let d: Date | null = null;
    if (dateISO) {
      const [y, m, day] = dateISO.split("-");
      if (y && m && day)
        d = new Date(Number(y), Number(m) - 1, Number(day), 0, 0, 0, 0);
      else d = new Date(dateISO);
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (d && d.getTime() < today.getTime()) return "#dc3545"; // atrasado
    return "#2563eb"; // planejado
  };

  // ============================================================
  // 📝 Form handlers
  // ============================================================
  const handleChange = (e: any) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  };

  const handleCreateOrUpdate = async () => {
    if (!form.date || !form.client_id) {
      alert("Data e cliente são obrigatórios");
      return;
    }

    // converte dd/mm/aaaa → yyyy-mm-dd
    const [d, m, y] = form.date.split("/");
    const iso = `${y}-${m}-${d}`;

    let cultureName = "";
    if (form.culture) {
      const byId = cultures.find((c) => String(c.id) === String(form.culture));
      cultureName = byId ? byId.name : form.culture;
    }

    // ✅ Define automaticamente se deve gerar cronograma fenológico
    const isPhenoCulture =
      ["Milho", "Soja", "Algodão"].includes(cultureName || "");

    const payload: any = {
      client_id: Number(form.client_id),
      property_id: form.property_id ? Number(form.property_id) : null,
      plot_id: form.plot_id ? Number(form.plot_id) : null,
      consultant_id: form.consultant_id ? Number(form.consultant_id) : null,
      date: iso,
      status: "planned",
      culture: cultureName || "",
      variety: form.variety || "",
      recommendation: "Plantio",
      latitude: form.latitude,
      longitude: form.longitude,

      // 🔥 Correção: dispara cronograma automático se a cultura for milho, soja ou algodão
      generate_schedule: isPhenoCulture,
      genPheno: isPhenoCulture,
    };




    try {
      console.log("📦 Payload enviado:", JSON.stringify(payload, null, 2));
      const res = await fetch(`${API_BASE}visits`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const body = await res.text();
        throw new Error(body || `Erro ${res.status}`);
      }

    

      // upload de fotos (se tiver)
      if (form.photos && form.photos.length > 0) {
        const fd = new FormData();
        Array.from(form.photos).forEach((file, idx) => {
          fd.append("photos", file);
          fd.append("captions", form.photoCaptions[idx] || "");
        });

        const photoResp = await fetch(`${API_BASE}visits/${form.id}/photos`, {
          method: "POST",
          body: fd,
        });

        if (!photoResp.ok) {
          console.warn("⚠️ Falha ao enviar fotos e legendas:", photoResp.status);
        } else {
          console.log("📸 Fotos e legendas enviadas com sucesso!");
        }
      }



      // recarrega
      setOpen(false);
      await loadVisits();
      setForm({
        id: null,
        date: "",
        client_id: "",
        property_id: "",
        plot_id: "",
        consultant_id: "",
        culture: "",
        variety: "",
        recommendation: "",
        genPheno: true,
        photos: null,
        photoPreviews: [],
        savedPhotos: [], // 🆕 limpa fotos antigas
        clientSearch: "",
        latitude: null,
        longitude: null,
        photoCaptions: [],
      });

    } catch (e: any) {
      console.error("❌ Erro ao salvar visita:", e);
      alert(e?.message || "Erro ao salvar visita");
    }
  };
  

  // ============================================================
  // 🗑️ Excluir
  // ============================================================
  const handleDelete = async () => {
    if (!form.id) return;
    if (!confirm("🗑 Deseja realmente excluir esta visita?")) return;
    try {
      const resp = await fetch(`${API_BASE}visits/${form.id}`, {
        method: "DELETE",
      });
      if (!resp.ok) throw new Error("Erro HTTP " + resp.status);
      await loadVisits();
      setOpen(false);
      await loadVisits();
    } catch (e) {
      alert("Erro ao excluir");
    }
  };

  // ============================================================
  // 📸 Tirar foto
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
        alert("📸 Foto capturada com sucesso!");
      }
    } catch (err) {
      console.error("Erro ao tirar foto:", err);
      alert("Erro ao capturar foto");
    }
  };

  // ============================================================
  // 📍 GPS
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
      alert(
        `📍 Localização salva: ${latitude.toFixed(5)}, ${longitude.toFixed(5)}`
      );
    } catch (err) {
      console.error("Erro ao obter localização:", err);
      alert("Erro ao capturar localização");
    }
  };

  // ============================================================
  // ✅ Concluir
  // ============================================================
  const markDone = async () => {
    if (!form.id) return;

    try {
      // ✅ Se houver fotos, envia primeiro
      if (form.photos && form.photos.length > 0) {
        const fd = new FormData();
        Array.from(form.photos).forEach((file, idx) => {
          fd.append("photos", file);
          fd.append("captions", form.photoCaptions[idx] || "");
        });
        const photoResp = await fetch(`${API_BASE}visits/${form.id}/photos`, {
          method: "POST",
          body: fd,
        });
        if (!photoResp.ok) {
          console.warn("⚠️ Falha ao enviar fotos antes de concluir:", photoResp.status);
        } else {
          console.log("📸 Fotos enviadas com sucesso antes de concluir!");
        }
      }

      // ✅ Depois, atualiza o status para concluído
      const r = await fetch(`${API_BASE}visits/${form.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "done" }),
      });

      if (!r.ok) throw new Error("Erro HTTP " + r.status);

      await loadVisits();
      setOpen(false);
      alert("✅ Visita concluída e fotos salvas com sucesso!");
    } catch (e) {
      console.error("Erro ao concluir:", e);
      alert("Erro ao concluir visita");
    }
  };

  // ============================================================
  // 🖼️ Lightbox (visualizador de fotos)
  // ============================================================
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  const handleCloseLightbox = () => {
    setLightboxOpen(false);
    setLightboxUrl(null);
  };
  

  // ============================================================
  // ⬅️➡️ Navegação entre fotos no lightbox
  // ============================================================
  const [lightboxPhotos] = useState<string[]>([]);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState<number>(0);


  const handlePrevLightbox = () => {
    if (lightboxPhotos.length === 0) return;
    const prevIndex = (currentPhotoIndex - 1 + lightboxPhotos.length) % lightboxPhotos.length;
    setCurrentPhotoIndex(prevIndex);
    setLightboxUrl(lightboxPhotos[prevIndex]);
  };

  const handleNextLightbox = () => {
    if (lightboxPhotos.length === 0) return;
    const nextIndex = (currentPhotoIndex + 1) % lightboxPhotos.length;
    setCurrentPhotoIndex(nextIndex);
    setLightboxUrl(lightboxPhotos[nextIndex]);
  };

  // ============================================================
  // Render
  // ============================================================
  return (
    <div className="calendar-page">
      {/* 🔹 Cabeçalho fixo da agenda */}
      <div className="calendar-header-sticky">
        <div className="title-row">
          <h2 className="mb-0">Agenda de Visitas</h2>
        </div>

        <div className="filters-row">
          <select
            value={selectedConsultant}
            onChange={(e) => setSelectedConsultant(e.target.value)}
            className="form-select form-select-sm calendar-filter"
          >
            <option value="">Todos os consultores</option>
            {consultants.map((c) => (
              <option key={c.id} value={String(c.id)}>
                {c.name}
              </option>
            ))}
          </select>

          <select
            value={selectedVariety}
            onChange={(e) => setSelectedVariety(e.target.value)}
            className="form-select form-select-sm calendar-filter"
          >
            <option value="">Todas as variedades</option>
            {varieties.map((v) => (
              <option key={v.id} value={v.name}>
                {v.name}
              </option>
            ))}
          </select>
        </div>
      </div>


      {loading && <div className="text-muted mb-2">Carregando...</div>}

      <div className="calendar-shell">
        <FullCalendar
          ref={calendarRef}
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          locales={[ptBrLocale]}
          locale="pt-br"
          initialView="dayGridMonth"
          height={window.innerWidth < 768 ? "auto" : 650}
          expandRows={true}
          headerToolbar={{
            left: "prev,next today",
            center: "title",
            right: "dayGridMonth,timeGridWeek,timeGridDay",
          }}
          dayMaxEventRows={3}
          eventDisplay="block"
          events={events.filter((e) => {
            const cid = e.extendedProps?.raw?.consultant_id;
            const variety =
              e.extendedProps?.raw?.variety ||
              e.extendedProps?.raw?.variedade ||
              "";

            const matchesConsultant =
              !selectedConsultant || String(cid || "") === selectedConsultant;

            const matchesVariety =
              !selectedVariety ||
              String(variety)
                .toLowerCase()
                .includes(selectedVariety.toLowerCase());

            return matchesConsultant && matchesVariety;
          })}
          dateClick={(info) => {
            // mobile não abre modal
            const isMobile =
              window.innerWidth <= 768 ||
              document.body.dataset.platform === "mobile";
            if (isMobile) return;

            const dateStr = info.dateStr;
            const [y, m, d] = dateStr.split("-");
            setForm({
              id: null,
              date: `${d}/${m}/${y}`,
              client_id: "",
              property_id: "",
              plot_id: "",
              consultant_id: "",
              culture: "",
              variety: "",
              recommendation: "",
              genPheno: true,
              savedPhotos: [],
              photos: null,
              photoPreviews: [],
              clientSearch: "",
              latitude: null,
              longitude: null,
              photoCaptions: [],
            });
            setOpen(true);
          }}
          eventClick={(info) => {
          const v = info.event.extendedProps?.raw as Visit | undefined;
          if (!v) return;
          const d = v.date ? new Date(v.date) : null;

          const clientName =
            v.client_name ||
            clients.find((c) => c.id === v.client_id)?.name ||
            "";

          setForm({
            id: v.id,
            date: d ? d.toLocaleDateString("pt-BR") : "",
            client_id: String(v.client_id || ""),
            property_id: String(v.property_id || ""),
            plot_id: String(v.plot_id || ""),
            consultant_id: String(v.consultant_id || ""),
            culture: v.culture || "",
            variety: v.variety || "",
            recommendation: v.recommendation || "",
            genPheno: false,
            photos: null,
            photoPreviews: [],
            savedPhotos: v.photos || [], // 🆕 carrega fotos já salvas
            clientSearch: clientName,
            latitude: v.latitude || null,
            longitude: v.longitude || null,
            photoCaptions: [],
          });

          setOpen(true);
        }}

          eventContent={(arg) => {
            const v = (arg.event.extendedProps?.raw as any) || {};
            const bg = colorFor(v?.date || arg.event.startStr, v?.status);

            const stage =
              (
                (v?.recommendation?.split("—").pop() || v?.recommendation || "") +
                ""
              ).trim() || "-";

            const clientName = v?.client_name || "—";
            const variety = v?.variety || "—";
            const consultant = v?.consultant_name || "—";

            return (
              <div
                className="fc-visit-card"
                style={{ backgroundColor: bg, borderColor: bg }}
              >
                <div className="fc-visit-line">👤 {clientName}</div>
                <div className="fc-visit-line">🌱 {variety}</div>
                <div className="fc-visit-line">📍 {stage}</div>
                <div className="fc-visit-line">👨‍🌾 {consultant}</div>
              </div>
            );
          }}
        />
      </div>

      {/* ➕ FAB no mobile */}
      {window.innerWidth <= 768 && (
        <button
          className="fab"
          onClick={() => {
            const btn = document.querySelector(".fab");
            if (btn) {
              btn.classList.add("pressed");
              setTimeout(() => btn.classList.remove("pressed"), 180);
            }
            setForm({
              id: null,
              date: new Date().toLocaleDateString("pt-BR"),
              client_id: "",
              property_id: "",
              plot_id: "",
              consultant_id: "",
              culture: "",
              variety: "",
              recommendation: "",
              genPheno: true,
              savedPhotos: [],
              photos: null,
              photoPreviews: [],
              clientSearch: "",
              latitude: null,
              longitude: null,
              photoCaptions: [],
            });
            setOpen(true);
          }}
        >
          +
        </button>
      )}

      {/* MODAL */}
      {open && (
        <div
          className="modal fade show d-block"
          tabIndex={-1}
          role="dialog"
          style={{ backgroundColor: "rgba(0,0,0,0.7)" }}
        >
          <div
            className="modal-dialog modal-dialog-centered modal-xl"
            role="document"
          >
            <div
              className="modal-content border-0 shadow-lg"
              style={{
                background: "var(--panel)",
                color: "var(--text)",
                transition: "background 0.3s ease, color 0.3s ease",
                maxWidth: "1100px",
              }}
            >
              {/* Cabeçalho */}
              <div className="modal-header border-0">
                <h5 className="modal-title">
                  {form.id ? "Editar Visita" : "Nova Visita"}
                </h5>
                <button
                  type="button"
                  className="btn-close btn-close-white"
                  aria-label="Fechar"
                  onClick={() => setOpen(false)}
                ></button>
              </div>

              {/* Corpo */}
              <div className="modal-body">
                <div className="row g-3">
                  {/* Data */}
                  <div className="col-md-4">
                    <label className="form-label fw-semibold">Data</label>
                    <input
                      name="date"
                      value={form.date}
                      onChange={handleChange}
                      placeholder="dd/mm/aaaa"
                      className="form-control"
                      style={{
                        background: "var(--input-bg)",
                        color: "var(--text)",
                        borderColor: "var(--border)"
                      }}
                    />
                  </div>

                  {/* Cliente busca digitável */}
                  <div className="col-12 position-relative">
                    <label className="form-label fw-semibold">Cliente</label>
                    <input
                      type="text"
                      className="form-control"
                      style={{
                        background: "var(--input-bg)",
                        color: "var(--text)",
                        borderColor: "var(--border)"
                      }}
                      value={
                        clients.find((c) => String(c.id) === form.client_id)?.name ||
                        form.clientSearch ||
                        ""
                      }
                      onChange={(e) => {
                        const value = e.target.value;
                        setForm((f) => ({
                          ...f,
                          clientSearch: value,
                          client_id: "",
                        }));
                      }}
                      placeholder="Digite o nome do cliente..."
                    />
                    {form.clientSearch && (
                      <ul
                        className="list-group position-absolute w-100 mt-1"
                        style={{
                          maxHeight: "150px",
                          overflowY: "auto",
                          zIndex: 20,
                        }}
                      >
                        {clients
                          .filter((c) =>
                            c.name.toLowerCase().startsWith(form.clientSearch.toLowerCase())
                          )
                          .map((c) => (
                            <li
                              key={c.id}
                              className={`list-group-item list-group-item-action ${
                                form.client_id === String(c.id)
                                  ? "active bg-success text-white"
                                  : "bg-dark text-light"
                              }`}
                              onClick={() => {
                                setForm((f) => ({
                                  ...f,
                                  client_id: String(c.id),
                                  clientSearch: c.name,
                                }));
                              }}
                              style={{ cursor: "pointer" }}
                            >
                              {c.name}
                            </li>
                          ))}
                      </ul>
                    )}
                  </div>

                  {/* Propriedade */}
                  <div className="col-md-6">
                    <label className="form-label fw-semibold">Propriedade</label>
                    <DarkSelect
                      name="property_id"
                      value={form.property_id}
                      placeholder="Selecione propriedade"
                      options={[
                        { value: "", label: "Selecione propriedade" },
                        ...properties.map((p) => ({
                          value: String(p.id),
                          label: p.name,
                        })),
                      ]}
                      onChange={(e: any) =>
                        setForm((f) => ({
                          ...f,
                          property_id: e.target.value,
                          plot_id: "",
                        }))
                      }
                    />
                  </div>

                  {/* Talhão */}
                  <div className="col-md-6">
                    <label className="form-label fw-semibold">Talhão</label>
                    <DarkSelect
                      name="plot_id"
                      value={form.plot_id}
                      placeholder="Selecione talhão"
                      options={[
                        { value: "", label: "Selecione talhão" },
                        ...plots.map((pl) => ({
                          value: String(pl.id),
                          label: pl.name,
                        })),
                      ]}
                      onChange={handleChange as any}
                    />
                  </div>

                  {/* Cultura */}
                  <div className="col-md-6">
                    <label className="form-label fw-semibold">Cultura</label>
                    <select
                      name="culture"
                      value={form.culture}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          culture: e.target.value,
                          variety: "",
                        }))
                      }
                      className="form-select"
                      style={{
                        background: "var(--input-bg)",
                        color: "var(--text)",
                        borderColor: "var(--border)"
                      }}
                    >
                      <option value="">Selecione</option>
                      {cultures.map((c) => (
                        <option key={c.id} value={c.name}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Variedade */}
                  <div className="col-md-6">
                    <label className="form-label fw-semibold">Variedade</label>
                    <select
                      name="variety"
                      value={form.variety}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, variety: e.target.value }))
                      }
                      disabled={!form.culture}
                      className="form-select"
                      style={{
                        background: "var(--input-bg)",
                        color: "var(--text)",
                        borderColor: "var(--border)"
                      }}
                    >
                      <option value="">Selecione</option>
                      {varieties
                        .filter(
                          (v) =>
                            v.culture.toLowerCase() ===
                            (form.culture || "").toLowerCase()
                        )
                        .map((v) => (
                          <option key={v.id} value={v.name}>
                            {v.name}
                          </option>
                        ))}
                    </select>
                  </div>

                  {/* Consultor */}
                  <div className="col-md-6">
                    <label className="form-label fw-semibold">Consultor</label>
                    <select
                      name="consultant_id"
                      value={form.consultant_id}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          consultant_id: e.target.value,
                        }))
                      }
                      className="form-select"
                      style={{
                        background: "var(--input-bg)",
                        color: "var(--text)",
                        borderColor: "var(--border)"
                      }}
                    >
                      <option value="">Selecione</option>
                      {consultants.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Checkbox */}
                  <div className="col-12 form-check mt-3">
                    <input
                      id="genPheno"
                      type="checkbox"
                      className="form-check-input"
                      checked={form.genPheno}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, genPheno: e.target.checked }))
                      }
                    />
                    <label htmlFor="genPheno" className="form-check-label ms-2">
                      Gerar cronograma fenológico (milho/soja/algodão)
                    </label>
                  </div>

                  {/* Botões de captura */}
                  <div className="col-12 d-flex justify-content-between mt-3">
                    <button
                      type="button"
                      className="btn btn-outline-light"
                      onClick={handleTakePhoto}
                    >
                      📸 Tirar Foto
                    </button>
                    <button
                      type="button"
                      className="btn btn-outline-info"
                      onClick={handleGetLocation}
                    >
                      📍 Capturar Localização
                    </button>
                  </div>

                  {/* Recomendação */}
                  <div className="col-12">
                    <label className="form-label fw-semibold">Recomendação</label>
                    <textarea
                      name="recommendation"
                      value={form.recommendation}
                      onChange={handleChange}
                      placeholder="Observações ou anotações técnicas..."
                      className="form-control"
                      style={{
                        background: "var(--input-bg)",
                        color: "var(--text)",
                        borderColor: "var(--border)"
                      }}
                    />
                  </div>

                  {/* 📸 Seção de fotos */}
                  <VisitPhotos
                    visitId={form.id}
                    existingPhotos={form.savedPhotos}
                    onRefresh={loadVisits}
                  />
                </div>
              </div>

              {/* Rodapé */}
              <div className="modal-footer border-0">
                <button
                  className="btn btn-secondary"
                  onClick={() => setOpen(false)}
                >
                  Cancelar
                </button>

                {!form.id && (
                  <button
                    className="btn btn-success"
                    onClick={handleCreateOrUpdate}
                  >
                    💾 Salvar
                  </button>
                )}

                {form.id && (
                  <>
                    <button
                      className="btn btn-outline-primary d-flex align-items-center"
                      onClick={async () => {
                        setLoading(true);
                        try {
                          if (window.innerWidth > 768) {
                            window.open(
                              `${API_BASE}visits/${form.id}/pdf`,
                              "_blank"
                            );
                          } else {
                            const res = await fetch(
                              `${API_BASE}visits/${form.id}/pdf`
                            );
                            if (!res.ok)
                              throw new Error("Erro ao gerar PDF");
                            const blob = await res.blob();
                            const url = window.URL.createObjectURL(blob);
                            const a = document.createElement("a");
                            a.href = url;
                            const clientName =
                              clients.find(
                                (c) => String(c.id) === form.client_id
                              )?.name || "Visita";
                            const safeName = clientName.replace(
                              /[^a-z0-9]/gi,
                              "_"
                            );
                            a.download = `Relatorio_${safeName}_${form.date.replace(
                              /\//g,
                              "-"
                            )}.pdf`;
                            a.click();
                            window.URL.revokeObjectURL(url);
                          }
                        } catch (err) {
                          console.error("Erro ao gerar PDF:", err);
                          alert("❌ Falha ao gerar o relatório PDF");
                        } finally {
                          setLoading(false);
                        }
                      }}
                      disabled={loading}
                    >
                      {loading ? "Gerando..." : "📄 PDF"}
                    </button>

                    <button className="btn btn-success" onClick={markDone}>
                      ✅ Concluir
                    </button>

                    <button className="btn btn-danger" onClick={handleDelete}>
                      🗑 Excluir
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 🖼️ Lightbox Modal */}
      {lightboxOpen && (
        <div className="lightbox-overlay" onClick={handleCloseLightbox}>
          <div
            className="lightbox-content"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="lightbox-nav left"
              onClick={(e) => {
                e.stopPropagation();
                handlePrevLightbox();
              }}
            >
              ⟵
            </button>
            <img src={lightboxUrl || ""} alt="Visualização ampliada" />
            <button
              className="lightbox-nav right"
              onClick={(e) => {
                e.stopPropagation();
                handleNextLightbox();
              }}
            >
              ⟶
            </button>
            <button className="lightbox-close" onClick={handleCloseLightbox}>
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CalendarPage;
