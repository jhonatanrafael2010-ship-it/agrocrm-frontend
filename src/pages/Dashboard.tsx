import React, { useEffect, useState } from "react";

const API_BASE = import.meta.env.VITE_API_URL || "/api/";

type Client = { id: number; name: string };
type Property = { id: number; name: string; client_id?: number };
type Plot = { id: number; name: string };
type Planting = { id: number; culture?: string };
type Visit = { id: number; date?: string; client_id?: number; property_id?: number };
type Opportunity = {
  id: number;
  title?: string;
  stage?: string;
  estimated_value?: number;
  created_at?: string;
  client_id?: number;
};

function formatDate(d: Date) {
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

  const today = new Date();
  const defaultEnd = formatDate(today);
  const defaultStart = formatDate(new Date(today.getTime() - 6 * 24 * 60 * 60 * 1000));
  const [startDate, setStartDate] = useState<string>(defaultStart);
  const [endDate, setEndDate] = useState<string>(defaultEnd);

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
      fetch(`${API_BASE}visits`).then((r) => (r.ok ? r.json() : [])),
      fetch(`${API_BASE}opportunities`).then((r) => (r.ok ? r.json() : [])),
    ])
      .then(([cs, ps, pls, pts, vs, os]) => {
        if (!mounted) return;
        setClients(cs || []);
        setProperties(ps || []);
        setPlots(pls || []);
        setPlantings(pts || []);
        setVisits((vs || []).slice(0, 12));
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

  function inRange(dateStr?: string) {
    if (!dateStr) return false;
    const d = dateStr.slice(0, 10);
    return d >= startDate && d <= endDate;
  }

  const filteredOpps = opps.filter((o) => inRange(o.created_at));
  const closedOpps = filteredOpps.filter((o) => (o.stage || "").toLowerCase() === "fechadas");
  const totalSales = closedOpps.reduce((s, o) => s + (o.estimated_value || 0), 0);

  const days: string[] = [];
  const dailySums: number[] = [];
  {
    const sDate = new Date(startDate);
    const eDate = new Date(endDate);
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

  const maxSum = Math.max(...dailySums, 1);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; text: string } | null>(null);

  function fmtCurrency(v: number) {
    return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }

  return (
    <div className="container-fluid py-4 text-light">
      <div className="row mb-3">
        <div className="col-12 col-lg-10 mx-auto">
          <h2 className="fw-bold mb-2 text-success">📊 Dashboard</h2>
          <p className="text-secondary mb-0">
            Acompanhe os principais indicadores de clientes, visitas e vendas.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="text-secondary text-center py-4">Carregando...</div>
      ) : (
        <>
          {/* Cards resumo */}
          <div className="row g-3 mb-4 justify-content-center">
            {[
              { icon: "👤", label: "Clientes", value: clients.length },
              { icon: "🏠", label: "Propriedades", value: properties.length },
              { icon: "🌱", label: "Talhões", value: plots.length },
              { icon: "🌾", label: "Plantios", value: plantings.length },
              { icon: "📝", label: "Acompanhamentos", value: visits.length },
              { icon: "💼", label: "Oportunidades", value: opps.length },
            ].map((c, i) => (
              <div key={i} className="col-6 col-md-4 col-lg-2">
                <div
                  className="card border-0 shadow-sm text-center p-3"
                  style={{ background: "var(--panel)", color: "var(--text)" }}
                >
                  <div className="fs-3">{c.icon}</div>
                  <div className="fw-semibold text-secondary">{c.label}</div>
                  <div className="fs-5 fw-bold text-light">{c.value}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Filtros */}
          <div className="row mb-4 justify-content-center">
            <div className="col-12 col-lg-10">
              <div
                className="card border-0 p-3 shadow-sm d-flex flex-wrap align-items-center gap-3"
                style={{ background: "var(--panel)", color: "var(--text)" }}
              >
                <div className="d-flex gap-3 align-items-center flex-wrap">
                  <label className="d-flex flex-column">
                    <small className="text-secondary">De</small>
                    <input
                      type="date"
                      className="form-control form-control-sm bg-body-tertiary text-light border-secondary"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                    />
                  </label>
                  <label className="d-flex flex-column">
                    <small className="text-secondary">Até</small>
                    <input
                      type="date"
                      className="form-control form-control-sm bg-body-tertiary text-light border-secondary"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                    />
                  </label>
                </div>
                <div className="ms-auto fw-semibold text-success">
                  Vendas (fechadas): {fmtCurrency(totalSales)}
                </div>
              </div>
            </div>
          </div>

          {/* Gráfico */}
          <div className="row mb-5 justify-content-center">
            <div className="col-12 col-lg-10">
              <div
                className="card border-0 shadow-sm p-4"
                style={{ background: "var(--panel)", color: "var(--text)" }}
              >
                <h5 className="text-secondary mb-3">📈 Vendas por dia</h5>
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

          {/* Últimas visitas */}
          <div className="row mb-5 justify-content-center">
            <div className="col-12 col-lg-10">
              <div
                className="card border-0 shadow-sm text-center p-3"
                style={{ background: "var(--panel)", color: "var(--text)" }}
              >
                <h5 style={{ color: "var(--text)" }}>🧭 Últimas Visitas</h5>
                <div className="table-responsive">
                  <table
                    className="table table-sm align-middle"
                    style={{ background: "var(--panel)", color: "var(--text)" }}
                  >
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
                          <td>{v.date ?? "--"}</td>
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

          {/* Últimas oportunidades */}
          <div className="row justify-content-center">
            <div className="col-12 col-lg-10">
              <div
                className="card border-0 p-3 shadow-sm d-flex flex-wrap align-items-center gap-3"
                style={{ background: "var(--panel)", color: "var(--text)" }}
              >
                <h5 className="text-secondary mb-3">💼 Últimas Oportunidades</h5>
                <ul className="list-group list-group-flush">
                  {filteredOpps.slice(0, 12).map((o) => (
                    <li
                      key={o.id}
                      className="list-group-item bg-dark text-light d-flex justify-content-between align-items-center border-secondary"
                    >
                      <span>{o.title ?? "Sem título"}</span>
                      <span>
                        {o.stage && (
                          <span
                            className={`badge ${
                              o.stage.toLowerCase() === "fechadas"
                                ? "bg-success"
                                : "bg-secondary"
                            } me-2`}
                          >
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
