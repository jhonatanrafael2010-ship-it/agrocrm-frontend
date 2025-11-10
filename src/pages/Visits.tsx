import React, { useEffect, useState } from "react";

type Visit = {
  id: number;
  date?: string;
  client_id?: number;
  property_id?: number;
  plot_id?: number;
  consultant_id?: number;
  culture?: string;
  variety?: string;
  recommendation?: string;
  diagnosis?: string;
};

type Client = { id: number; name: string };
type Property = { id: number; name: string };
type Plot = { id: number; name: string };
type Consultant = { id: number; name: string };
type Culture = { id: number; name: string };
type Variety = { id: number; culture: string; name: string };

const API_BASE = import.meta.env.VITE_API_URL || "/api/";

const Visits: React.FC = () => {
  const [visits, setVisits] = useState<Visit[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [plots, setPlots] = useState<Plot[]>([]);
  const [consultants, setConsultants] = useState<Consultant[]>([]);
  const [cultures, setCultures] = useState<Culture[]>([]);
  const [varieties, setVarieties] = useState<Variety[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedConsultant, setSelectedConsultant] = useState("");
  const [selectedCulture, setSelectedCulture] = useState("");
  const [selectedVariety, setSelectedVariety] = useState("");
  const [clientSearch, setClientSearch] = useState("");
  const [filterClient, setFilterClient] = useState("");

  const [viewOpen, setViewOpen] = useState(false);
  const [activeVisit, setActiveVisit] = useState<Visit | null>(null);

  const today = new Date();
  const todayISO = today.toISOString().slice(0, 10);
  const fiveYearsAgo = new Date(today.getFullYear() - 5, today.getMonth(), today.getDate());
  const fiveYearsISO = fiveYearsAgo.toISOString().slice(0, 10);

  const [filterStart, setFilterStart] = useState<string>(fiveYearsISO);
  const [filterEnd, setFilterEnd] = useState<string>(todayISO);

  const theme = document.body.getAttribute("data-theme") || "light";

  // 🔄 Carrega dados
  useEffect(() => {
    let mounted = true;
    setLoading(true);

    Promise.all([
      fetch(`${API_BASE}visits`).then((r) => (r.ok ? r.json() : [])),
      fetch(`${API_BASE}clients`).then((r) => (r.ok ? r.json() : [])),
      fetch(`${API_BASE}properties`).then((r) => (r.ok ? r.json() : [])),
      fetch(`${API_BASE}plots`).then((r) => (r.ok ? r.json() : [])),
      fetch(`${API_BASE}consultants`).then((r) => (r.ok ? r.json() : [])),
      fetch(`${API_BASE}cultures`).then((r) => (r.ok ? r.json() : [])),
      fetch(`${API_BASE}varieties`).then((r) => (r.ok ? r.json() : [])),
    ])
      .then(([vs, cs, ps, pls, cons, cul, vars]) => {
        if (!mounted) return;
        setVisits(vs || []);
        setClients(cs || []);
        setProperties(ps || []);
        setPlots(pls || []);
        setConsultants(cons || []);
        setCultures(cul || []);
        setVarieties(vars || []);
      })
      .catch((err) => {
        console.error(err);
        setError("Erro ao carregar acompanhamentos");
      })
      .finally(() => setLoading(false));

    return () => {
      mounted = false;
    };
  }, []);

  // 🔧 Atualiza variedades conforme cultura
  const filteredVarieties = selectedCulture
    ? varieties.filter((v) => v.culture === selectedCulture)
    : varieties;

  // 🧭 Utilitários
  function formatDateBR(dateStr?: string) {
    if (!dateStr) return "--";
    const parts = String(dateStr).split("-");
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    return String(dateStr);
  }

  function openView(v: Visit) {
    setActiveVisit(v);
    setViewOpen(true);
  }

  async function handleDelete(id?: number) {
    if (!id) return;
    if (!confirm("Deseja excluir esta visita?")) return;
    try {
      const res = await fetch(`${API_BASE}visits/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || `status ${res.status}`);
      }
      setVisits((list) => list.filter((v) => v.id !== id));
    } catch (err: any) {
      console.error("Erro ao excluir visita", err);
      alert(err?.message || "Erro ao excluir visita");
    }
  }

  // ========================
  // 🧩 RENDERIZAÇÃO PRINCIPAL
  // ========================
  return (
    <div className={`container-fluid py-4 ${theme === "dark" ? "text-light" : "text-dark"}`}>
      <div className="row mb-3">
        <div className="col-12 col-lg-10 mx-auto d-flex justify-content-between align-items-center">
          <h2 className="fw-bold">📋 Acompanhamentos</h2>
        </div>
      </div>

      {/* 🎯 FILTROS */}
      <div className="col-12 col-lg-10 mx-auto mb-3">
        <div className={`p-3 rounded shadow-sm ${theme === "dark" ? "bg-dark-subtle" : "bg-light"}`}>
          <div className="row g-3 align-items-end">
            <div className="col-md-2">
              <label className="form-label">Início</label>
              <input
                type="date"
                value={filterStart}
                onChange={(e) => setFilterStart(e.target.value)}
                className="form-control"
              />
            </div>

            <div className="col-md-2">
              <label className="form-label">Fim</label>
              <input
                type="date"
                value={filterEnd}
                onChange={(e) => setFilterEnd(e.target.value)}
                className="form-control"
              />
            </div>

            <div className="col-md-3 position-relative">
              <label className="form-label">Cliente</label>
              <input
                type="text"
                className="form-control"
                placeholder="Buscar cliente..."
                value={clientSearch}
                onChange={(e) => setClientSearch(e.target.value)}
              />
              {clientSearch && (
                <ul
                  className="list-group position-absolute w-100 mt-1"
                  style={{ maxHeight: "150px", overflowY: "auto", zIndex: 20 }}
                >
                  {clients
                    .filter((c) =>
                      c.name.toLowerCase().includes(clientSearch.toLowerCase())
                    )
                    .map((c) => (
                      <li
                        key={c.id}
                        className="list-group-item list-group-item-action"
                        onClick={() => {
                          setFilterClient(String(c.id));
                          setClientSearch(c.name);
                        }}
                        style={{ cursor: "pointer" }}
                      >
                        {c.name}
                      </li>
                    ))}
                </ul>
              )}
            </div>

            <div className="col-md-2">
              <label className="form-label">Consultor</label>
              <select
                value={selectedConsultant}
                onChange={(e) => setSelectedConsultant(e.target.value)}
                className="form-select"
              >
                <option value="">Todos</option>
                {consultants.map((c) => (
                  <option key={c.id} value={String(c.id)}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="col-md-1">
              <label className="form-label">Cultura</label>
              <select
                value={selectedCulture}
                onChange={(e) => {
                  setSelectedCulture(e.target.value);
                  setSelectedVariety("");
                }}
                className="form-select"
              >
                <option value="">Todas</option>
                {cultures.map((c) => (
                  <option key={c.id} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="col-md-2">
              <label className="form-label">Variedade</label>
              <select
                value={selectedVariety}
                onChange={(e) => setSelectedVariety(e.target.value)}
                className="form-select"
              >
                <option value="">Todas</option>
                {filteredVarieties.map((v) => (
                  <option key={v.name} value={v.name}>
                    {v.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* 📋 TABELA DE VISITAS */}
      <div className="col-12 col-lg-10 mx-auto">
        <div className={`card border-0 shadow-sm ${theme === "dark" ? "bg-dark" : "bg-white"}`}>
          <div className="card-body">
            {loading ? (
              <div className="text-center text-secondary py-3">Carregando...</div>
            ) : error ? (
              <div className="alert alert-danger">{error}</div>
            ) : (
              <div className="table-responsive">
                <table
                  className={`table table-sm align-middle ${
                    theme === "dark" ? "table-dark" : "table-striped"
                  }`}
                >
                  <thead>
                    <tr>
                      <th>Data</th>
                      <th>Cliente</th>
                      <th>Fazenda</th>
                      <th>Talhão</th>
                      <th>Consultor</th>
                      <th>Cultura</th>
                      <th>Variedade</th>
                      <th>Recomendação</th>
                      <th className="text-end">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visits
                      .filter((v) => {
                        if (filterClient && String(v.client_id) !== filterClient) return false;
                        if (filterStart && v.date && v.date < filterStart) return false;
                        if (filterEnd && v.date && v.date > filterEnd) return false;
                        if (selectedConsultant && String(v.consultant_id) !== selectedConsultant)
                          return false;
                        if (selectedCulture && v.culture !== selectedCulture) return false;
                        if (selectedVariety && v.variety !== selectedVariety) return false;
                        return true;
                      })
                      .sort((a, b) => new Date(b.date!).getTime() - new Date(a.date!).getTime())
                      .map((v) => (
                        <tr key={v.id}>
                          <td>{formatDateBR(v.date)}</td>
                          <td>{clients.find((c) => c.id === v.client_id)?.name ?? v.client_id}</td>
                          <td>{properties.find((p) => p.id === v.property_id)?.name ?? v.property_id}</td>
                          <td>{plots.find((p) => p.id === v.plot_id)?.name ?? v.plot_id}</td>
                          <td>{consultants.find((c) => c.id === v.consultant_id)?.name || "—"}</td>
                          <td>{v.culture || "—"}</td>
                          <td>{v.variety || "—"}</td>
                          <td>{v.recommendation ?? "--"}</td>
                          <td className="text-end">
                            <button
                              className="btn btn-outline-primary btn-sm me-1"
                              onClick={() => openView(v)}
                            >
                              Ver
                            </button>
                            <button
                              className="btn btn-outline-success btn-sm me-1"
                              onClick={() => window.open(`${API_BASE}visits/${v.id}/pdf`, "_blank")}
                            >
                              📄 PDF
                            </button>
                            <button
                              className="btn btn-outline-danger btn-sm"
                              onClick={() => handleDelete(v.id)}
                            >
                              Excluir
                            </button>
                          </td>
                        </tr>
                      ))}
                    {!loading && visits.length === 0 && (
                      <tr>
                        <td colSpan={9} className="text-center text-secondary py-3">
                          Nenhum acompanhamento encontrado
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* MODAL VISUALIZAÇÃO */}
      {viewOpen && activeVisit && (
        <div className="modal fade show d-block" style={{ background: "rgba(0,0,0,0.6)" }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className={`modal-content ${theme === "dark" ? "bg-dark text-light" : ""}`}>
              <div className="modal-header border-0">
                <h5 className="modal-title">Detalhes da Visita</h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => {
                    setViewOpen(false);
                    setActiveVisit(null);
                  }}
                ></button>
              </div>
              <div className="modal-body">
                <div className="mb-2"><strong>Consultor:</strong> {consultants.find((c) => c.id === activeVisit.consultant_id)?.name || "—"}</div>
                <div className="mb-2"><strong>Cultura:</strong> {activeVisit.culture || "—"}</div>
                <div className="mb-2"><strong>Variedade:</strong> {activeVisit.variety || "—"}</div>
                <div className="mb-2"><strong>Data:</strong> {formatDateBR(activeVisit.date)}</div>
                <div className="mb-2"><strong>Cliente:</strong> {clients.find((c) => c.id === activeVisit.client_id)?.name ?? activeVisit.client_id}</div>
                <div className="mb-2"><strong>Fazenda:</strong> {properties.find((p) => p.id === activeVisit.property_id)?.name ?? activeVisit.property_id}</div>
                <div className="mb-2"><strong>Talhão:</strong> {plots.find((p) => p.id === activeVisit.plot_id)?.name ?? activeVisit.plot_id}</div>
                <div className="mb-2"><strong>Diagnóstico:</strong> {activeVisit.diagnosis ?? "--"}</div>
                <div className="mb-2 mt-3"><strong>Recomendação:</strong> {activeVisit.recommendation ?? "--"}</div>
              </div>
              <div className="modal-footer border-0">
                <button className="btn btn-success" onClick={() => window.open(`${API_BASE}visits/${activeVisit.id}/pdf`, "_blank")}>
                  📄 Exportar PDF
                </button>
                <button className="btn btn-secondary" onClick={() => { setViewOpen(false); setActiveVisit(null); }}>
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Visits;
