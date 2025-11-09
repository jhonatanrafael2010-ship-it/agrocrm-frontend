import React, { useEffect, useState } from "react";

type Visit = {
  id: number;
  date?: string;
  client_id?: number;
  property_id?: number;
  plot_id?: number;
  consultant_id?: number;
  checklist?: string;
  diagnosis?: string;
  recommendation?: string;
  culture?: string;
  variety?: string;
};

type Client = { id: number; name: string };
type Property = { id: number; name: string };
type Plot = { id: number; name: string };
type Consultant = { id: number; name: string };

const API_BASE = import.meta.env.VITE_API_URL || "/api/";

const Visits: React.FC = () => {
  const [visits, setVisits] = useState<Visit[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [plots, setPlots] = useState<Plot[]>([]);
  const [consultants, setConsultants] = useState<Consultant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedConsultant, setSelectedConsultant] = useState("");
  const [clientSearch, setClientSearch] = useState("");
  const [filterClient, setFilterClient] = useState("");
  const [filterVariety, setFilterVariety] = useState("");
  const [viewOpen, setViewOpen] = useState(false);
  const [activeVisit, setActiveVisit] = useState<Visit | null>(null);

  const today = new Date();
  const todayISO = today.toISOString().slice(0, 10);
  const fiveYearsAgo = new Date(today.getFullYear() - 5, today.getMonth(), today.getDate());
  const fiveYearsISO = fiveYearsAgo.toISOString().slice(0, 10);

  const [filterStart, setFilterStart] = useState<string>(fiveYearsISO);
  const [filterEnd, setFilterEnd] = useState<string>(todayISO);

  const theme = document.body.getAttribute("data-theme") || "light";

  useEffect(() => {
    let mounted = true;
    setLoading(true);

    Promise.all([
      fetch(`${API_BASE}visits?status=done`).then((r) => (r.ok ? r.json() : [])),
      fetch(`${API_BASE}clients`).then((r) => (r.ok ? r.json() : [])),
      fetch(`${API_BASE}properties`).then((r) => (r.ok ? r.json() : [])),
      fetch(`${API_BASE}plots`).then((r) => (r.ok ? r.json() : [])),
      fetch(`${API_BASE}consultants`).then((r) => (r.ok ? r.json() : [])),
    ])
      .then(([vs, cs, ps, pls, cons]) => {
        if (!mounted) return;
        setVisits(vs || []);
        setClients(cs || []);
        setProperties(ps || []);
        setPlots(pls || []);
        setConsultants(cons || []);
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

  // ✅ Função para limpar todos os filtros
  function clearFilters() {
    setFilterStart(fiveYearsISO);
    setFilterEnd(todayISO);
    setFilterClient("");
    setClientSearch("");
    setSelectedConsultant("");
    setFilterVariety("");
  }

  // 🔍 Filtragem combinada
  const filteredVisits = visits
    .filter((v) => {
      if (filterClient && String(v.client_id) !== filterClient) return false;
      if (filterVariety && v.variety?.toLowerCase() !== filterVariety.toLowerCase()) return false;
      if (filterStart && v.date && v.date < filterStart) return false;
      if (filterEnd && v.date && v.date > filterEnd) return false;
      if (selectedConsultant && String(v.consultant_id) !== selectedConsultant) return false;
      return true;
    })
    .sort((a, b) => {
      if (!a.date) return 1;
      if (!b.date) return -1;
      return new Date(a.date).getTime() - new Date(b.date).getTime();
    });

  const uniqueVarieties = Array.from(new Set(visits.map((v) => v.variety).filter(Boolean))).sort();

  return (
    <div className={`container-fluid py-4 ${theme === "dark" ? "text-light" : "text-dark"}`}>
      <div className="row mb-3">
        <div className="col-12 col-lg-10 mx-auto d-flex justify-content-between align-items-center">
          <h2 className="fw-bold">📋 Acompanhamentos</h2>
          <button className="btn btn-outline-secondary btn-sm" onClick={clearFilters}>
            🧹 Limpar filtros
          </button>
        </div>
      </div>

      {/* FILTROS */}
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

            <div className="col-md-3">
              <label className="form-label">Variedade</label>
              <select
                value={filterVariety}
                onChange={(e) => setFilterVariety(e.target.value)}
                className="form-select"
              >
                <option value="">Todas</option>
                {uniqueVarieties.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
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
          </div>
        </div>
      </div>

      {/* TABELA */}
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
                      <th>Variedade</th>
                      <th>Recomendação</th>
                      <th className="text-end">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredVisits.map((v) => (
                      <tr key={v.id}>
                        <td>{formatDateBR(v.date)}</td>
                        <td>{clients.find((c) => c.id === v.client_id)?.name ?? "—"}</td>
                        <td>{properties.find((p) => p.id === v.property_id)?.name ?? "—"}</td>
                        <td>{plots.find((p) => p.id === v.plot_id)?.name ?? "—"}</td>
                        <td>{consultants.find((c) => c.id === v.consultant_id)?.name ?? "—"}</td>
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
                    {!loading && filteredVisits.length === 0 && (
                      <tr>
                        <td colSpan={8} className="text-center text-secondary py-3">
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
    </div>
  );
};

export default Visits;
