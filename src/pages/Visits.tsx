import React, { useEffect, useState } from "react";
import { API_BASE } from "../config";
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
  photos?: any[];
  planting_id?: number;
  status?: string;
};

type Client = { id: number; name: string };
type Property = { id: number; name: string };
type Plot = { id: number; name: string };
type Consultant = { id: number; name: string };
type Culture = { id: number; name: string };
type Variety = { id: number; culture: string; name: string };

// Estado do modal-resumo
type SummaryState = {
  open: boolean;
  visits: Visit[];
  header: {
    clientName: string;
    propertyName: string;
    plotName: string;
    culture: string;
    variety: string;
  };
} | null;

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

  const [filterStart, setFilterStart] = useState("");
  const [filterEnd, setFilterEnd] = useState("");

  const theme = document.body.getAttribute("data-theme") || "light";

  // Modal-resumo
  const [summary, setSummary] = useState<SummaryState>(null);

  // Abrir/fechar groups
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  // ============================================================
  // 🔁 Carregar dados
  // ============================================================
  async function loadData() {
    setLoading(true);

    try {
      let vs: Visit[] = [];

      try {
        const r1 = await fetch(`${API_BASE}visits?scope=all`, {
          cache: "no-store",
        });
        vs = r1.ok ? await r1.json() : [];
      } catch {
        vs = [];
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

  // ============================================================
  // 🔧 Utilitários
  // ============================================================
  const filteredVarieties = selectedCulture
    ? varieties.filter((v) => v.culture === selectedCulture)
    : varieties;

  function formatDateBR(d?: string) {
    if (!d) return "--";
    const clean = d.split("T")[0];
    const [y, m, day] = clean.split("-");
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

  async function handleMarkDone(v: Visit) {
    if (!v.id) return;
    try {
      const res = await fetch(`${API_BASE}visits/${v.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "done" }),
      });
      if (res.ok) {
        setVisits((list) =>
          list.map((x) =>
            x.id === v.id ? { ...x, status: "done" } : x
          )
        );
      } else {
        alert("Não foi possível marcar como concluída.");
      }
    } catch (e) {
      console.error(e);
      alert("Erro ao marcar como concluída.");
    }
  }

  // ============================================================
  // 🧩 AGRUPAMENTO — COM TIPAGEM CORRETA
  // ============================================================
  function buildGroups(): Record<string, Visit[]> {
    const groups: Record<string, Visit[]> = {};

    visits
      ?.filter((v) => {
        if (!v) return false;

        // Cliente
        if (filterClient && String(v.client_id) !== filterClient) return false;

        // Datas
        const dateClean = v.date ? v.date.split("T")[0] : null;
        const d = dateClean ? new Date(dateClean) : null;

        if (filterStart) {
          const fs = new Date(filterStart);
          if (d && d < fs) return false;
        }

        if (filterEnd) {
          const fe = new Date(filterEnd);
          if (d && d > fe) return false;
        }

        // Consultor
        if (
          selectedConsultant &&
          String(v.consultant_id) !== selectedConsultant
        )
          return false;

        // Cultura / Variedade
        if (selectedCulture && (v.culture || "").trim() !== selectedCulture)
          return false;

        if (selectedVariety && (v.variety || "").trim() !== selectedVariety)
          return false;

        return true;
      })
      .forEach((v) => {
        const groupId = v.planting_id
          ? `plant-${v.planting_id}`
          : `${v.client_id}-${v.property_id}-${v.plot_id}-${v.variety || ""}`;

        if (!groups[groupId]) groups[groupId] = [];
        groups[groupId].push(v);
      });

    // Ordenar cada grupo por data
    Object.values(groups).forEach((arr) => {
      arr.sort(
        (a, b) =>
          new Date(a.date || "1900-01-01").getTime() -
          new Date(b.date || "1900-01-01").getTime()
      );
    });

    return groups;
  }

  const groups = buildGroups();

  function toggleGroup(id: string) {
    setOpenGroups((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  // ============================================================
  // 📄 Exportar resumo para "PDF" (print)
  // ============================================================
  function exportGroupToPDF(
    group: Visit[],
    header: {
      clientName: string;
      propertyName: string;
      plotName: string;
      culture: string;
      variety: string;
    }
  ) {
    const win = window.open("", "_blank");
    if (!win) return;

    const title = `Relatório de Acompanhamento - ${header.clientName}`;

    let html = `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8" />
        <title>${title}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; }
          h1 { font-size: 20px; margin-bottom: 4px; }
          h2 { font-size: 16px; margin-top: 0; color: #555; }
          .meta { margin-bottom: 16px; font-size: 13px; color: #444; }
          .card {
            border: 1px solid #ddd;
            border-radius: 8px;
            padding: 10px 12px;
            margin-bottom: 8px;
          }
          .card strong { display: block; margin-bottom: 4px; }
          .photos { font-size: 12px; color: #555; }
        </style>
      </head>
      <body>
        <h1>${title}</h1>
        <h2>${header.culture} ${header.variety}</h2>
        <div class="meta">
          <div><strong>Cliente:</strong> ${header.clientName}</div>
          <div><strong>Fazenda:</strong> ${header.propertyName}</div>
          <div><strong>Talhão:</strong> ${header.plotName}</div>
        </div>
    `;

    group.forEach((v) => {
      html += `
        <div class="card">
          <strong>${formatDateBR(v.date)}</strong>
          <div>${v.recommendation || "--"}</div>
          ${
            (v.photos?.length ?? 0) > 0
              ? `<div class="photos">📸 ${(v.photos?.length ?? 0)} fotos registradas</div>`
              : ""
          }
        </div>
      `;
    });

    html += `
      </body>
      </html>
    `;

    win.document.open();
    win.document.write(html);
    win.document.close();
    win.focus();
    win.print();
  }

  // ============================================================
  // Render
  // ============================================================
  return (
    <div
      className={`container-fluid py-4 ${
        theme === "dark" ? "text-light" : "text-dark"
      }`}
    >
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
            <div className="col-md-2">
              <label>Início</label>
              <input
                type="date"
                value={filterStart}
                onChange={(e) => setFilterStart(e.target.value)}
                className="form-control"
              />
            </div>

            <div className="col-md-2">
              <label>Fim</label>
              <input
                type="date"
                value={filterEnd}
                onChange={(e) => setFilterEnd(e.target.value)}
                className="form-control"
              />
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
                <ul
                  className="list-group position-absolute w-100 mt-1"
                  style={{ maxHeight: 150, overflowY: "auto", zIndex: 20 }}
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
              <label>Consultor</label>
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
              <label>Cultura</label>
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
              <label>Variedade</label>
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

      {/* LISTA AGRUPADA */}
      <div className="col-12 col-lg-10 mx-auto">
        {loading && (
          <div className="text-center text-secondary py-4">Carregando…</div>
        )}

        {!loading && (
          <>
            {Object.keys(groups).length === 0 ? (
              <div className="text-center text-secondary py-4">
                Nenhum acompanhamento encontrado.
              </div>
            ) : (
              <div className="accordion">
                {Object.entries(groups).map(([gid, group]) => {
                  const first = group[0];

                  const clientName =
                    clients.find((c) => c.id === first.client_id)?.name || "—";

                  const propertyName =
                    properties.find((p) => p.id === first.property_id)?.name ||
                    "—";

                  const plotName =
                    plots.find((p) => p.id === first.plot_id)?.name || "—";

                  const hasAnyPhoto = group.some(
                    (v) => (v.photos?.length ?? 0) > 0
                  );

                  const headerData = {
                    clientName,
                    propertyName,
                    plotName,
                    culture: first.culture || "",
                    variety: first.variety || "",
                  };

                  return (
                    <div key={gid} className="mb-3">
                      {/* Cabeçalho */}
                      <div
                        className={`p-3 rounded shadow-sm d-flex justify-content-between align-items-center ${
                          hasAnyPhoto
                            ? "bg-success text-white"
                            : theme === "dark"
                            ? "bg-dark"
                            : "bg-light"
                        }`}
                        style={{ cursor: "pointer" }}
                        onClick={() => toggleGroup(gid)}
                      >
                        <div>
                          <strong>{clientName}</strong>
                          <div style={{ fontSize: "0.85rem" }}>
                            {propertyName} — {plotName}
                          </div>
                          <div style={{ fontSize: "0.85rem" }}>
                            {first.culture || ""} {first.variety || ""}
                          </div>
                        </div>

                        <div className="d-flex align-items-center gap-3">
                          <button
                            className={`btn btn-sm ${
                              hasAnyPhoto
                                ? "btn-outline-light"
                                : "btn-outline-primary"
                            }`}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSummary({
                                open: true,
                                visits: group,
                                header: headerData,
                              });
                            }}
                          >
                            👁 Ver
                          </button>

                          <button
                            className={`btn btn-sm ${
                              hasAnyPhoto
                                ? "btn-outline-light"
                                : "btn-outline-secondary"
                            }`}
                            onClick={(e) => {
                              e.stopPropagation();
                              exportGroupToPDF(group, headerData);
                            }}
                          >
                            📄 Exportar PDF
                          </button>

                          <div style={{ fontSize: "1.2rem" }}>
                            {openGroups[gid] ? "▲" : "▼"}
                          </div>
                        </div>
                      </div>

                      {/* Conteúdo expandido */}
                      {openGroups[gid] && (
                        <div
                          className={`shadow-sm rounded-bottom p-3 ${
                            theme === "dark" ? "bg-black" : "bg-white"
                          }`}
                        >
                          {/* Linha do tempo visual */}
                          <div
                            style={{
                              display: "flex",
                              overflowX: "auto",
                              paddingBottom: 8,
                              marginBottom: 12,
                              borderBottom: "1px solid rgba(0,0,0,0.1)",
                            }}
                          >
                            {group.map((v, index) => {
                              const done = (v.status || "").toLowerCase() === "done";
                              return (
                                <div
                                  key={v.id}
                                  style={{
                                    minWidth: 120,
                                    textAlign: "center",
                                    marginRight: index < group.length - 1 ? 24 : 0,
                                    position: "relative",
                                  }}
                                >
                                  {/* Linha entre os pontos */}
                                  {index < group.length - 1 && (
                                    <div
                                      style={{
                                        position: "absolute",
                                        top: 14,
                                        left: "60%",
                                        width: 40,
                                        height: 2,
                                        backgroundColor: done ? "#28a745" : "#ccc",
                                      }}
                                    />
                                  )}

                                  {/* Ponto */}
                                  <div
                                    style={{
                                      width: 18,
                                      height: 18,
                                      borderRadius: "50%",
                                      margin: "0 auto",
                                      backgroundColor: done ? "#28a745" : "#ccc",
                                      border: done
                                        ? "2px solid #155724"
                                        : "2px solid #999",
                                    }}
                                  ></div>

                                  <div
                                    style={{
                                      fontSize: "0.75rem",
                                      marginTop: 4,
                                      fontWeight: done ? 600 : 400,
                                    }}
                                  >
                                    {v.recommendation || `Visita ${index + 1}`}
                                  </div>
                                  <div
                                    style={{
                                      fontSize: "0.7rem",
                                      color: "#666",
                                    }}
                                  >
                                    {formatDateBR(v.date)}
                                  </div>
                                </div>
                              );
                            })}
                          </div>

                          {/* Lista detalhada */}
                          {group.map((v) => {
                            const hasPhotos = (v.photos?.length ?? 0) > 0;
                            const done = (v.status || "").toLowerCase() === "done";

                            return (
                              <div
                                key={v.id}
                                className="d-flex justify-content-between align-items-center p-2 border-bottom"
                                style={{
                                  background: done
                                    ? "#d1e7dd"
                                    : hasPhotos
                                    ? "#d4edda"
                                    : "transparent",
                                  borderLeft: done
                                    ? "4px solid #198754"
                                    : hasPhotos
                                    ? "4px solid #28a745"
                                    : "none",
                                }}
                              >
                                <div>
                                  <div>
                                    <strong>{formatDateBR(v.date)}</strong>{" "}
                                    {done && (
                                      <span
                                        style={{
                                          fontSize: "0.75rem",
                                          color: "#155724",
                                        }}
                                      >
                                        (concluída)
                                      </span>
                                    )}
                                  </div>
                                  <div style={{ fontSize: "0.85rem" }}>
                                    {v.recommendation || "--"}
                                  </div>
                                </div>

                                <div className="d-flex gap-2">
                                  {(v.photos?.length ?? 0) > 0 && (
                                    <span
                                      style={{
                                        fontSize: "0.8rem",
                                        alignSelf: "center",
                                      }}
                                    >
                                      📸 {(v.photos?.length ?? 0)}
                                    </span>
                                  )}

                                  {!done && (
                                    <button
                                      className="btn btn-outline-success btn-sm"
                                      onClick={() => handleMarkDone(v)}
                                    >
                                      ✅ Concluir
                                    </button>
                                  )}

                                  <button
                                    className="btn btn-outline-primary btn-sm"
                                    onClick={() =>
                                      window.open(
                                        `${API_BASE}visits/${v.id}/pdf`,
                                        "_blank"
                                      )
                                    }
                                  >
                                    PDF
                                  </button>

                                  <button
                                    className="btn btn-outline-danger btn-sm"
                                    onClick={() => handleDelete(v.id)}
                                  >
                                    Excluir
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      {/* MODAL DE RESUMO */}
      {summary?.open && (
        <div
          className="modal fade show d-block"
          style={{ background: "rgba(0,0,0,0.6)" }}
          onClick={() => setSummary(null)}
        >
          <div
            className="modal-dialog modal-dialog-centered modal-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="modal-content"
              style={{
                background: theme === "dark" ? "var(--panel)" : "#fff",
                color: "var(--text)",
              }}
            >
              <div className="modal-header">
                <h5 className="modal-title">
                  Resumo do Acompanhamento – {summary.header.clientName}
                </h5>
                <button
                  className="btn-close"
                  onClick={() => setSummary(null)}
                />
              </div>

              <div className="modal-body">
                <div className="mb-3" style={{ fontSize: "0.9rem" }}>
                  <div>
                    <strong>Fazenda:</strong> {summary.header.propertyName}
                  </div>
                  <div>
                    <strong>Talhão:</strong> {summary.header.plotName}
                  </div>
                  <div>
                    <strong>Cultura / Variedade:</strong>{" "}
                    {summary.header.culture} {summary.header.variety}
                  </div>
                </div>

                {summary.visits.map((v) => (
                  <div
                    key={v.id}
                    className="p-3 mb-2 rounded shadow-sm"
                    style={{
                      background: "var(--input-bg)",
                      borderLeft:
                        (v.photos?.length ?? 0) > 0
                          ? "4px solid #28a745"
                          : "4px solid #ccc",
                    }}
                  >
                    <strong>{formatDateBR(v.date)}</strong>
                    <div>{v.recommendation}</div>
                    {(v.photos?.length ?? 0) > 0 && (
                      <div>📸 {(v.photos?.length ?? 0)} fotos</div>
                    )}
                  </div>
                ))}
              </div>

              <div className="modal-footer">
                <button
                  className="btn btn-secondary"
                  onClick={() => setSummary(null)}
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
