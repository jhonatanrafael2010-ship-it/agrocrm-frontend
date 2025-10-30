import React, { useEffect, useState } from "react";
import DarkSelect from "../components/DarkSelect";

type Visit = {
  id: number;
  date?: string;
  client_id?: number;
  property_id?: number;
  plot_id?: number;
  checklist?: string;
  diagnosis?: string;
  recommendation?: string;
};

type Client = { id: number; name: string };
type Property = { id: number; name: string };
type Plot = { id: number; name: string };

const API_BASE = import.meta.env.VITE_API_URL || "/api/";

const Visits: React.FC = () => {
  const [visits, setVisits] = useState<Visit[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [plots, setPlots] = useState<Plot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const today = new Date();
  const todayISO = today.toISOString().slice(0, 10);
  const fiveYearsAgo = new Date(today.getFullYear() - 5, today.getMonth(), today.getDate());
  const fiveYearsISO = fiveYearsAgo.toISOString().slice(0, 10);

  const [filterStart, setFilterStart] = useState<string>(fiveYearsISO);
  const [filterEnd, setFilterEnd] = useState<string>(todayISO);
  const [filterClient, setFilterClient] = useState("");
  const [viewOpen, setViewOpen] = useState(false);
  const [activeVisit, setActiveVisit] = useState<Visit | null>(null);

  const theme = document.body.getAttribute("data-theme") || "light";

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    Promise.all([
      fetch(`${API_BASE}visits`).then((r) => (r.ok ? r.json() : [])),
      fetch(`${API_BASE}clients`).then((r) => (r.ok ? r.json() : [])),
      fetch(`${API_BASE}properties`).then((r) => (r.ok ? r.json() : [])),
      fetch(`${API_BASE}plots`).then((r) => (r.ok ? r.json() : [])),
    ])
      .then(([vs, cs, ps, pls]) => {
        if (!mounted) return;
        setVisits(vs || []);
        setClients(cs || []);
        setProperties(ps || []);
        setPlots(pls || []);
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

  return (
    <div className={`container-fluid py-4 ${theme === "dark" ? "text-light" : "text-dark"}`}>
      <div className="row mb-3">
        <div className="col-12 col-lg-10 mx-auto d-flex justify-content-between align-items-center">
          <h2 className="fw-bold">📋 Acompanhamentos</h2>
        </div>
      </div>

      {/* FILTROS */}
      <div className="col-12 col-lg-10 mx-auto mb-3">
        <div
          className={`p-3 rounded shadow-sm ${
            theme === "dark" ? "bg-dark-subtle" : "bg-light"
          }`}
        >
          <div className="row g-3 align-items-end">
            <div className="col-md-3">
              <label className="form-label">Início</label>
              <input
                type="date"
                value={filterStart}
                onChange={(e) => setFilterStart(e.target.value)}
                className="form-control"
              />
            </div>
            <div className="col-md-3">
              <label className="form-label">Fim</label>
              <input
                type="date"
                value={filterEnd}
                onChange={(e) => setFilterEnd(e.target.value)}
                className="form-control"
              />
            </div>
            <div className="col-md-4">
              <label className="form-label">Cliente</label>
              <DarkSelect
                name="filterClient"
                value={filterClient}
                options={[
                  { value: "", label: "Todos" },
                  ...clients.map((c) => ({ value: String(c.id), label: c.name })),
                ]}
                onChange={(e: any) => setFilterClient(e.target.value)}
                placeholder="Todos"
              />
            </div>
            <div className="col-md-2 d-flex justify-content-end">
              <button
                className="btn btn-outline-secondary mt-4 w-100"
                onClick={() => {
                  setFilterStart(fiveYearsISO);
                  setFilterEnd(todayISO);
                  setFilterClient("");
                }}
              >
                Limpar filtros
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* TABELA DE VISITAS */}
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
                        return true;
                      })
                      .sort((a, b) => {
                        if (!a.date) return 1;
                        if (!b.date) return -1;
                        return new Date(a.date).getTime() - new Date(b.date).getTime();
                      })
                      .map((v) => (
                        <tr key={v.id}>
                          <td>{formatDateBR(v.date)}</td>
                          <td>
                            {clients.find((c) => c.id === v.client_id)?.name ?? v.client_id}
                          </td>
                          <td>
                            {properties.find((p) => p.id === v.property_id)?.name ?? v.property_id}
                          </td>
                          <td>{plots.find((p) => p.id === v.plot_id)?.name ?? v.plot_id}</td>
                          <td>{v.recommendation ?? "--"}</td>
                          <td className="text-end">
                            <button
                              className="btn btn-outline-primary btn-sm me-1"
                              onClick={() => openView(v)}
                            >
                              Ver
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
                        <td colSpan={6} className="text-center text-secondary py-3">
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
                <div className="mb-2">
                  <strong>Data:</strong> {formatDateBR(activeVisit.date)}
                </div>
                <div className="mb-2">
                  <strong>Cliente:</strong>{" "}
                  {clients.find((c) => c.id === activeVisit.client_id)?.name ??
                    activeVisit.client_id}
                </div>
                <div className="mb-2">
                  <strong>Fazenda:</strong>{" "}
                  {properties.find((p) => p.id === activeVisit.property_id)?.name ??
                    activeVisit.property_id}
                </div>
                <div className="mb-2">
                  <strong>Talhão:</strong>{" "}
                  {plots.find((p) => p.id === activeVisit.plot_id)?.name ??
                    activeVisit.plot_id}
                </div>
                <div className="mb-2">
                  <strong>Diagnóstico:</strong> {activeVisit.diagnosis ?? "--"}
                </div>
                <div className="mb-2">
                  <strong>Recomendação:</strong> {activeVisit.recommendation ?? "--"}
                </div>
              </div>
              <div className="modal-footer border-0">
                <button
                  className="btn btn-secondary"
                  onClick={() => {
                    setViewOpen(false);
                    setActiveVisit(null);
                  }}
                >
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
