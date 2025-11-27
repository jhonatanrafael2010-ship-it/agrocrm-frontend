import React, { useEffect, useState } from "react";
import { API_BASE } from "../config";
/* eslint-disable @typescript-eslint/no-unused-vars */
/* @ts-nocheck */
import { fetchWithCache } from "../utils/offlineSync";

// Tipos
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

const Visits: React.FC = () => {
  const [visits, setVisits] = useState<Visit[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [plots, setPlots] = useState<Plot[]>([]);
  const [consultants, setConsultants] = useState<Consultant[]>([]);
  const [cultures, setCultures] = useState<Culture[]>([]);
  const [varieties, setVarieties] = useState<Variety[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedConsultant, setSelectedConsultant] = useState("");
  const [selectedCulture, setSelectedCulture] = useState("");
  const [selectedVariety, setSelectedVariety] = useState("");
  const [clientSearch, setClientSearch] = useState("");
  const [filterClient, setFilterClient] = useState("");

  const todayISO = new Date().toISOString().slice(0, 10);
  const [filterStart, setFilterStart] = useState("2020-01-01");
  const [filterEnd, setFilterEnd] = useState(todayISO);

  const theme = document.body.getAttribute("data-theme") || "light";

  // ============================================================
  // 🔁 Carregar tudo
  // ============================================================
  async function loadData() {
    setLoading(true);

    try {
      let vs = [];

      // visitas completas
      try {
        const r1 = await fetch(`${API_BASE}visits?scope=all`, { cache: "no-store" });
        vs = r1.ok ? await r1.json() : [];
      } catch {
        vs = [];
      }

      // detectar bug de plantio
      const onlyPlantio =
        vs.length > 0 &&
        vs.every((v: Visit) =>
          String(v.recommendation || "").toLowerCase().includes("plantio")
        );

      if (onlyPlantio) {
        try {
          const r2 = await fetch(`${API_BASE}visits?scope=all`);
          if (r2.ok) {
            const data2 = await r2.json();
            if (Array.isArray(data2) && data2.length > vs.length) {
              vs = data2;
            }
          }
        } catch {}
      }

      const [cs, ps, pls, cons, cul, vars] = await Promise.all([
        fetchWithCache(`${API_BASE}clients`, "clients"),
        fetchWithCache(`${API_BASE}properties`, "properties"),
        fetchWithCache(`${API_BASE}plots`, "plots"),
        fetchWithCache(`${API_BASE}consultants`, "consultants"),
        fetchWithCache(`${API_BASE}cultures`, "cultures"),
        fetchWithCache(`${API_BASE}varieties`, "varieties"),
      ]);

      setVisits(vs);
      setClients(cs);
      setProperties(ps);
      setPlots(pls);
      setConsultants(cons);
      setCultures(cul);
      setVarieties(vars);

    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    const update = () => loadData();

    window.addEventListener("visits-synced", update);
    window.addEventListener("visits-updated", update);

    const debugFiltered = visits.filter((v) => {
    const c1 = !(filterClient && String(v.client_id) !== filterClient);
    const d = v.date ? new Date(v.date) : null;
    const c2 = !(d && d < new Date(filterStart));
    const c3 = !(d && d > new Date(filterEnd));
    const c4 = !(selectedConsultant && String(v.consultant_id) !== selectedConsultant);
    const c5 = !(selectedCulture && String(v.culture || "").trim() !== selectedCulture);
    const c6 = !(selectedVariety && String(v.variety || "").trim() !== selectedVariety);

    console.log("VISITA", v.id, { c1, c2, c3, c4, c5, c6 });

    return c1 && c2 && c3 && c4 && c5 && c6;
  });

  console.log("DEBUG_VISITS_FILTRADAS", debugFiltered);


    return () => {
      window.removeEventListener("visits-synced", update);
      window.removeEventListener("visits-updated", update);
    };
  }, []);

  // ============================================================
  // 🔧 Auxiliares
  // ============================================================
  const filteredVarieties = selectedCulture
    ? varieties.filter((v) => v.culture === selectedCulture)
    : varieties;

  function formatDateBR(d?: string) {
    if (!d) return "--";
    if (!d.includes("-")) return d;
    const [y, m, day] = d.split("-");
    return `${day}/${m}/${y}`;
  }

  async function handleDelete(id?: number) {
    if (!id) return;
    if (!confirm("Deseja excluir esta visita?")) return;

    const res = await fetch(`${API_BASE}visits/${id}`, { method: "DELETE" });
    if (res.ok) {
      setVisits((list) => list.filter((v) => v.id !== id));
    }
  }

  // ============================================================
  // Render
  // ============================================================
  return (
    <div className={`container-fluid py-4 ${theme === "dark" ? "text-light" : "text-dark"}`}>
      <div className="row mb-3">
        <div className="col-12 col-lg-10 mx-auto d-flex justify-content-between align-items-center">
          <h2 className="fw-bold">📋 Acompanhamentos</h2>
        </div>
      </div>

      {/* FILTROS */}
      <div className="col-12 col-lg-10 mx-auto mb-3">
        <div className={`p-3 rounded shadow-sm ${theme === "dark" ? "bg-dark-subtle" : "bg-light"}`}>
          <div className="row g-3 align-items-end">
            <div className="col-md-2">
              <label>Início</label>
              <input type="date" value={filterStart} onChange={(e) => setFilterStart(e.target.value)} className="form-control" />
            </div>

            <div className="col-md-2">
              <label>Fim</label>
              <input type="date" value={filterEnd} onChange={(e) => setFilterEnd(e.target.value)} className="form-control" />
            </div>

            <div className="col-md-3 position-relative">
              <label>Cliente</label>
              <input
                type="text"
                className="form-control"
                placeholder="Buscar cliente..."
                value={clientSearch}
                onChange={(e) => setClientSearch(e.target.value)}
              />
              {clientSearch && (
                <ul className="list-group position-absolute w-100 mt-1" style={{ maxHeight: 150, overflowY: "auto", zIndex: 20 }}>
                  {clients
                    .filter((c) => c.name.toLowerCase().includes(clientSearch.toLowerCase()))
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
              <label>Consultor</label>
              <select value={selectedConsultant} onChange={(e) => setSelectedConsultant(e.target.value)} className="form-select">
                <option value="">Todos</option>
                {consultants.map((c) => (
                  <option key={c.id} value={String(c.id)}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="col-md-1">
              <label>Cultura</label>
              <select value={selectedCulture} onChange={(e) => { setSelectedCulture(e.target.value); setSelectedVariety(""); }} className="form-select">
                <option value="">Todas</option>
                {cultures.map((c) => (
                  <option key={c.id} value={c.name}>{c.name}</option>
                ))}
              </select>
            </div>

            <div className="col-md-2">
              <label>Variedade</label>
              <select value={selectedVariety} onChange={(e) => setSelectedVariety(e.target.value)} className="form-select">
                <option value="">Todas</option>
                {filteredVarieties.map((v) => (
                  <option key={v.name} value={v.name}>{v.name}</option>
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
              <div className="text-center text-secondary py-4">Carregando…</div>
            ) : (
              <div className="table-responsive">
                <table className={`table table-sm align-middle ${theme === "dark" ? "table-dark" : "table-striped"}`}>
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
                      <th></th>
                    </tr>
                  </thead>

                  <tbody>
                    {visits
                      .filter((v) => {
                        if (filterClient && String(v.client_id) !== filterClient) return false;

                        const d = v.date ? new Date(v.date) : null;
                        if (d) {
                          if (d < new Date(filterStart)) return false;
                          if (d > new Date(filterEnd)) return false;
                        }

                        if (selectedConsultant && String(v.consultant_id) !== selectedConsultant) return false;

                        if (selectedCulture && String(v.culture || "").trim() !== selectedCulture) return false;

                        if (selectedVariety && String(v.variety || "").trim() !== selectedVariety) return false;

                        return true;
                      })
                      .sort((a, b) => new Date(b.date!).getTime() - new Date(a.date!).getTime())
                      .map((v) => (
                        <tr key={v.id}>
                          <td>{formatDateBR(v.date)}</td>
                          <td>{clients.find((c) => c.id === v.client_id)?.name ?? "—"}</td>
                          <td>{properties.find((p) => p.id === v.property_id)?.name ?? "—"}</td>
                          <td>{plots.find((p) => p.id === v.plot_id)?.name ?? "—"}</td>
                          <td>{consultants.find((c) => c.id === v.consultant_id)?.name ?? "—"}</td>
                          <td>{v.culture || "—"}</td>
                          <td>{v.variety || "—"}</td>
                          <td>{v.recommendation || "--"}</td>
                          <td className="text-end">
                            <button
                              className="btn btn-outline-primary btn-sm me-1"
                              onClick={() => window.open(`${API_BASE}visits/${v.id}/pdf`, "_blank")}
                            >
                              PDF
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

                    {visits.length === 0 && (
                      <tr>
                        <td colSpan={9} className="text-center py-4 text-secondary">
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
