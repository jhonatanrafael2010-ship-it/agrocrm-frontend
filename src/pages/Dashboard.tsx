import React, { useEffect, useState } from "react";
import { API_BASE } from "../config";

type Client = { id: number; name: string };
type Property = { id: number; name: string; client_id?: number };
type Plot = { id: number; name: string };
type Planting = { id: number; culture?: string };
type Visit = {
  id: number;
  date?: string;

  client_id?: number;
  property_id?: number;
  plot_id?: number;

  client_name?: string;
  consultant_id?: number;
  consultant_name?: string;

  status?: string;
  culture?: string;
  variety?: string;

  recommendation?: string;
  fenologia_real?: string;

  products?: Array<{
    id?: number;
    product_name?: string;
    dose?: string;
    unit?: string;
    application_date?: string | null;
  }>;
};


type Opportunity = {
  id: number;
  title?: string;
  stage?: string;
  estimated_value?: number;
  created_at?: string;
  client_id?: number;
};

function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function csvEscape(value: any) {
  const s = String(value ?? "");
  const needsQuotes = /[;"\n\r,]/.test(s);
  const escaped = s.replace(/"/g, '""');
  return needsQuotes ? `"${escaped}"` : escaped;
}

function toCsv(rows: Record<string, any>[], headers: string[]) {
  const sep = ";";
  const headerLine = headers.map(csvEscape).join(sep);
  const lines = rows.map((r) => headers.map((h) => csvEscape(r[h])).join(sep));
  return "\uFEFF" + [headerLine, ...lines].join("\n"); // BOM p/ Excel
}

function monthRange(month: string) {
  const [y, m] = month.split("-").map(Number);
  const start = new Date(y, m - 1, 1);
  const end = new Date(y, m, 1);
  return { start, end };
}

function parseISODate(dateStr?: string) {
  const d = (dateStr ?? "").slice(0, 10); // YYYY-MM-DD
  const [y, m, day] = d.split("-").map(Number);
  if (!y || !m || !day) return null;
  return new Date(y, m - 1, day);
}


function formatDate(d: Date) {
  if (!d || isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

const Dashboard: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [clients, setClients] = useState<Client[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [plots, setPlots] = useState<Plot[]>([]);
  const [plantings, setPlantings] = useState<Planting[]>([]);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [opps, setOpps] = useState<Opportunity[]>([]);

  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [reportMonth, setReportMonth] = useState<string>(() => {
    const now = new Date();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    return `${now.getFullYear()}-${m}`; // YYYY-MM
  });



  const [clientsMap, setClientsMap] = useState<Record<number, string>>({});
  const [propsMap, setPropsMap] = useState<Record<number, string>>({});

  useEffect(() => {
    let mounted = true;
    setLoading(true);

    Promise.all([
      fetch(`${API_BASE}clients`).then((r) => (r.ok ? r.json() : [])),
      fetch(`${API_BASE}properties`).then((r) => (r.ok ? r.json() : [])),
      fetch(`${API_BASE}plots`).then((r) => (r.ok ? r.json() : [])),
      fetch(`${API_BASE}plantings`).then((r) => (r.ok ? r.json() : [])),
      fetch(`${API_BASE}visits?scope=all`).then((r) => (r.ok ? r.json() : [])),
      fetch(`${API_BASE}opportunities`).then((r) => (r.ok ? r.json() : [])),
    ])
      .then(([cs, ps, pls, pts, vs, os]) => {
        if (!mounted) return;

        setClients(cs || []);
        setProperties(ps || []);
        setPlots(pls || []);
        setPlantings(pts || []);
        setVisits(vs || []);
        setOpps(os || []);

        const cMap: Record<number, string> = {};
        (cs || []).forEach((c: any) => (cMap[c.id] = c.name));
        setClientsMap(cMap);

        const pMap: Record<number, string> = {};
        (ps || []).forEach((p: any) => (pMap[p.id] = p.name));
        setPropsMap(pMap);
      })
      .catch(console.error)
      .finally(() => setLoading(false));

    return () => {
      mounted = false;
    };
  }, []);

  // ============================================================
  // 🔍 Filtros
  // ============================================================
  function inRange(dateStr?: string) {
    if (!dateStr) return false;
    const d = dateStr.slice(0, 10);

    if (startDate && d < startDate) return false;
    if (endDate && d > endDate) return false;

    return true;
  }

  const filteredOpps = startDate && endDate
    ? opps.filter((o) => inRange(o.created_at))
    : [];

  const closedOpps = filteredOpps.filter(
    (o) => (o.stage || "").toLowerCase() === "fechadas"
  );

  const totalSales = closedOpps.reduce((s, o) => s + (o.estimated_value || 0), 0);

  // ============================================================
  // 📈 Gráfico
  // ============================================================
  let days: string[] = [];
  let dailySums: number[] = [];

  if (startDate && endDate) {
    const sDate = new Date(startDate);
    const eDate = new Date(endDate);

    if (!isNaN(sDate.getTime()) && !isNaN(eDate.getTime())) {
      for (let d = new Date(sDate); d <= eDate; d.setDate(d.getDate() + 1)) {
        const ds = formatDate(new Date(d));
        days.push(ds);

        const sum = opps.reduce((acc, o) => {
          if (!o.created_at) return acc;
          const odate = o.created_at.slice(0, 10);
          if (odate === ds && (o.stage || "").toLowerCase() === "fechadas")
            return acc + (o.estimated_value || 0);
          return acc;
        }, 0);

        dailySums.push(sum);
      }
    }
  }

  const maxSum = Math.max(...dailySums, 1);

  const [tooltip, setTooltip] = useState<{ x: number; y: number; text: string } | null>(null);

  function fmtCurrency(v: number) {
    return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }


async function downloadExcel() {
  try {
    if (!startDate || !endDate) {
      alert("Selecione um intervalo (De / Até) para gerar o relatório.");
      return;
    }

    const url = `${API_BASE}reports/monthly.xlsx?start=${startDate}&end=${endDate}`;
    const res = await fetch(url);

    if (!res.ok) {
      const t = await res.text();
      throw new Error(t || "Falha ao gerar relatório");
    }

    const blob = await res.blob();
    const fileName = `relatorio_visitas_${startDate}_a_${endDate}.xlsx`;

    const a = document.createElement("a");
    a.href = window.URL.createObjectURL(blob);
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
  } catch (err: any) {
    console.error(err);
    alert("Não foi possível gerar o Excel. Veja o console/log do backend.");
  }
}


function exportMonthlyVisitsCSV() {
  const { start, end } = monthRange(reportMonth);

  const monthVisits = visits.filter((v) => {
    const d = parseISODate(v.date);
    return d && d >= start && d < end;
  });

  const rows = monthVisits
    .sort((a, b) => (a.date || "").localeCompare(b.date || ""))
    .map((v) => ({
      Data: (v.date ?? "").slice(0, 10),
      Cliente: v.client_name ?? clientsMap[v.client_id ?? 0] ?? "",
      Consultor: v.consultant_name ?? "—",
      Propriedade: propsMap[v.property_id ?? 0] ?? "",
      Cultura: v.culture ?? "—",
      Variedade: v.variety ?? "—",
      Fenologia: v.fenologia_real ?? "",
      Status: v.status ?? "",
      Observacao: v.recommendation ?? "",
      Produtos: (v.products ?? [])
        .map((p) => `${p.product_name ?? ""} ${p.dose ?? ""}${p.unit ? " " + p.unit : ""}`.trim())
        .filter(Boolean)
        .join(" | "),
    }));

  const headers = [
    "Data",
    "Cliente",
    "Consultor",
    "Propriedade",
    "Cultura",
    "Variedade",
    "Fenologia",
    "Status",
    "Observacao",
    "Produtos",
  ];

  const csv = toCsv(rows, headers);
  downloadBlob(`relatorio_visitas_${reportMonth}.csv`, new Blob([csv], { type: "text/csv;charset=utf-8" }));
}


  // ============================================================
  // Render
  // ============================================================
  return (
    <div className="container-fluid py-4 text-light">
      <div className="row mb-3">
        <div className="col-12 col-lg-10 mx-auto">
          <h2 className="fw-bold mb-2 text-success">📊 Dashboard</h2>
          <p className="mb-0" style={{ color: "var(--text-secondary)" }}>
            Acompanhe os principais indicadores de clientes, visitas e vendas.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="text-secondary text-center py-4">Carregando...</div>
      ) : (
        <>
          {/* CARDS DE RESUMO */}
          <div className="row g-3 mb-4 justify-content-center">
            {[{ icon: "👤", label: "Clientes", value: clients.length },
              { icon: "🏠", label: "Propriedades", value: properties.length },
              { icon: "🌱", label: "Talhões", value: plots.length },
              { icon: "🌾", label: "Plantios", value: plantings.length },
              { icon: "📝", label: "Acompanhamentos", value: visits.length },
              { icon: "💼", label: "Oportunidades", value: opps.length }]
              .map((card, i) => (
                <div key={i} className="col-6 col-md-4 col-lg-2">
                  <div className="card border-0 shadow-sm text-center p-3" style={{ background: "var(--panel)", color: "var(--text)" }}>
                    <div className="fs-3">{card.icon}</div>
                    <div className="fw-semibold" style={{ color: "var(--text-secondary)" }}>{card.label}</div>
                    <div className="fs-5 fw-bold">{card.value}</div>
                  </div>
                </div>
              ))}
          </div>

          {/* FILTROS */}
          <div className="row mb-4 justify-content-center">
            <div className="col-12 col-lg-10">
              <div className="card border-0 p-3 shadow-sm d-flex flex-wrap align-items-center gap-3" style={{ background: "var(--panel)", color: "var(--text)" }}>
                <div className="d-flex gap-3 align-items-center flex-wrap">
                  <label className="d-flex flex-column">
                    <small className="text-secondary">De</small>
                    <input
                      type="date"
                      className="form-control form-control-sm"
                      style={{ background: "var(--panel)", color: "var(--text)", borderColor: "var(--border)" }}
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                    />
                  </label>
                  <label className="d-flex flex-column">
                    <small className="text-secondary">Até</small>
                    <input
                      type="date"
                      className="form-control form-control-sm"
                      style={{ background: "var(--panel)", color: "var(--text)", borderColor: "var(--border)" }}
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                    />
                  </label>

                 <label className="d-flex flex-column">
                    <small className="text-secondary">Mês (Relatório)</small>
                    <input
                      type="month"
                      className="form-control form-control-sm"
                      style={{ background: "var(--panel)", color: "var(--text)", borderColor: "var(--border)" }}
                      value={reportMonth}
                      onChange={(e) => setReportMonth(e.target.value)}
                    />
                  </label>

                  <button className="btn btn-outline-success btn-sm" onClick={exportMonthlyVisitsCSV}>
                    ⬇️ Exportar Visitas (CSV/Excel)
                  </button>

                </div>
                <div className="ms-auto d-flex align-items-center gap-2 flex-wrap">
                  <div className="fw-semibold text-success">
                    {startDate && endDate ? (
                      <>Vendas (fechadas): {fmtCurrency(totalSales)}</>
                    ) : (
                      <span className="text-secondary">Selecione um intervalo</span>
                    )}
                  </div>

                  <button
                    className="btn btn-sm btn-outline-success"
                    onClick={downloadExcel}
                    disabled={!startDate || !endDate}
                    title="Baixar Excel formatado"
                  >
                    ⬇️ Baixar Excel
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* GRÁFICO */}
          {startDate && endDate && days.length > 0 && (
            <div className="row mb-5 justify-content-center">
              <div className="col-12 col-lg-10">
                <div className="card border-0 shadow-sm p-4" style={{ background: "var(--panel)", color: "var(--text)" }}>
                  <h5 className="mb-3" style={{ color: "var(--text-secondary)" }}>📈 Vendas por dia</h5>

                  <div className="chart-container position-relative">
                    <svg width="100%" height="120" viewBox={`0 0 ${days.length * 30} 100`}>
                      {dailySums.map((v, i) => {
                        const barH = Math.round((v / maxSum) * 60);
                        const x = i * 30 + 10;
                        const y = 80 - barH;

                        return (
                          <g key={i}>
                            <rect
                              x={x}
                              y={y}
                              width={18}
                              height={barH}
                              fill="url(#barGradient)"
                              rx="5"
                              onMouseEnter={(ev: any) =>
                                setTooltip({
                                  x: ev.clientX,
                                  y: ev.clientY,
                                  text: `${days[i]}: ${fmtCurrency(v)}`,
                                })
                              }
                              onMouseLeave={() => setTooltip(null)}
                            />
                            <text
                              x={x + 9}
                              y={96}
                              fontSize={10}
                              fill="#9fb3b6"
                              textAnchor="middle"
                            >
                              {days[i].slice(5)}
                            </text>
                          </g>
                        );
                      })}

                      <defs>
                        <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#2dd36f" />
                          <stop offset="100%" stopColor="#0a3d2c" />
                        </linearGradient>
                      </defs>
                    </svg>

                    {tooltip && (
                      <div
                        className="position-absolute bg-dark text-light px-2 py-1 rounded border border-success"
                        style={{
                          left: tooltip.x - 250,
                          top: tooltip.y - 80,
                          fontSize: "0.8rem",
                          pointerEvents: "none",
                        }}
                      >
                        {tooltip.text}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Últimas visitas e Oportunidades */}
          <div className="row mb-5 justify-content-center">
            {/* TABELA DE VISITAS */}
            <div className="col-12 col-lg-10">
              <div className="card border-0 shadow-sm text-center p-3" style={{ background: "var(--panel)", color: "var(--text)" }}>
                <h5 style={{ color: "var(--text)" }}>🧭 Últimas Visitas</h5>
                <div className="table-responsive">
                  <table className="table table-sm align-middle" style={{ background: "var(--panel)", color: "var(--text)" }}>
                    <thead>
                      <tr>
                        <th>Data</th>
                        <th>Cliente</th>
                        <th>Propriedade</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visits.map((v) => (
                        <tr key={v.id}>
                          <td>{v.date?.split("T")[0] ?? "--"}</td>
                          <td>{clientsMap[v.client_id ?? 0] ?? "-"}</td>
                          <td>{propsMap[v.property_id ?? 0] ?? "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>

          {/* TABELA DE OPORTUNIDADES */}
          <div className="row justify-content-center">
            <div className="col-12 col-lg-10">
              <div className="card border-0 p-3 shadow-sm d-flex flex-wrap align-items-center gap-3" style={{ background: "var(--panel)", color: "var(--text)" }}>
                <h5 className="mb-3" style={{ color: "var(--text-secondary)" }}>💼 Últimas Oportunidades</h5>

                <ul className="list-group list-group-flush">
                  {(startDate && endDate ? filteredOpps : opps).slice(0, 12).map((o) => (
                    <li
                      key={o.id}
                      className="list-group-item d-flex justify-content-between align-items-center"
                      style={{
                        background: "var(--panel)",
                        color: "var(--text)",
                        borderColor: "var(--border)",
                      }}
                    >
                      <span>{o.title ?? "Sem título"}</span>
                      <span>
                        {o.stage && (
                          <span className={`badge ${
                            o.stage.toLowerCase() === "fechadas"
                              ? "bg-success"
                              : "bg-secondary"
                          } me-2`}>
                            {o.stage}
                          </span>
                        )}
                        <span className="text-secondary">
                          {fmtCurrency(o.estimated_value || 0)}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Dashboard;
