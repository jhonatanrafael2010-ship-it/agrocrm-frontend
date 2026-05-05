import React, { useEffect, useMemo, useState } from "react";
import { API_BASE } from "../config";
import { fetchWithCache } from "../utils/offlineSync";
import KPICard from "../components/KPICard";
import { Users, Map, Sprout, Wheat, ClipboardList, Briefcase, FileSpreadsheet, Loader2 } from "lucide-react";
import { Capacitor } from "@capacitor/core";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";

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
  photos?: Array<{ id?: number; url?: string; caption?: string }>;
};

type Opportunity = {
  id: number;
  title?: string;
  stage?: string;
  estimated_value?: number;
  created_at?: string;
  client_id?: number;
};

function formatDate(d: Date) {
  if (!d || isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

async function downloadBlob(filename: string, blob: Blob) {
  if (Capacitor.isNativePlatform()) {
    try {
      const base64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve((reader.result as string).split(",")[1]);
        reader.readAsDataURL(blob);
      });
      const saved = await Filesystem.writeFile({
        path: filename,
        data: base64,
        directory: Directory.Cache,
      });
      await Share.share({
        title: filename,
        files: [saved.uri],
        dialogTitle: "Salvar relatório Excel",
      });
      return;
    } catch (err) {
      console.error("Erro ao salvar no dispositivo:", err);
      alert("Erro: " + (err instanceof Error ? err.message : String(err)));
      return;
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
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


  const [clientsMap, setClientsMap] = useState<Record<number, string>>({});
  const [propsMap, setPropsMap] = useState<Record<number, string>>({});


  // ===== Filtros do relatório Excel =====
  const [regions, setRegions] = useState<string[]>([]);
  const [seasons, setSeasons] = useState<Array<{ key: string; label: string; culture: string }>>([]);
  const [selectedRegion, setSelectedRegion] = useState<string>("");
  const [selectedSeason, setSelectedSeason] = useState<string>("");
  const [downloadingExcel, setDownloadingExcel] = useState(false);

  useEffect(() => {
    Promise.all([
      fetchWithCache(`${API_BASE}regions`, "cultures"),
      fetchWithCache(`${API_BASE}seasons`, "varieties"),
    ])
      .then(([rs, ss]) => {
        setRegions(Array.isArray(rs) ? rs : []);
        setSeasons(Array.isArray(ss) ? ss : []);
      })
      .catch((err) => {
        console.warn("Falha ao carregar regions/seasons:", err);
      });
  }, []);

  useEffect(() => {
    let mounted = true;
    setLoading(true);

    Promise.all([
      fetchWithCache(`${API_BASE}clients`, "clients"),
      fetchWithCache(`${API_BASE}properties`, "properties"),
      fetchWithCache(`${API_BASE}plots`, "plots"),
      fetchWithCache(`${API_BASE}plantings`, "plantings"),
      fetchWithCache(`${API_BASE}visits?scope=all`, "visits"),
      fetchWithCache(`${API_BASE}opportunities`, "opportunities"),
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
  // 🔍 Filtros opps (vendas)
  // ============================================================
  function inRange(dateStr?: string) {
    if (!dateStr) return false;
    const d = dateStr.slice(0, 10);
    if (startDate && d < startDate) return false;
    if (endDate && d > endDate) return false;
    return true;
  }

  const filteredOpps = startDate && endDate ? opps.filter((o) => inRange(o.created_at)) : [];

  const closedOpps = filteredOpps.filter(
    (o) => (o.stage || "").toLowerCase() === "fechadas"
  );

  const totalSales = closedOpps.reduce((s, o) => s + (o.estimated_value || 0), 0);

  function fmtCurrency(v: number) {
    return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }

  // ============================================================
  // 📈 Gráfico (vendas por dia)
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

  // ============================================================
  // ✅ Excel formatado (backend)
  // ============================================================
  async function downloadExcel() {
    if (!startDate || !endDate) {
      alert("Selecione um intervalo (De / Até) para gerar o relatório.");
      return;
    }
    setDownloadingExcel(true);
    try {
      const params = new URLSearchParams({ start: startDate, end: endDate });
      if (selectedRegion) params.append("region", selectedRegion);
      if (selectedSeason) params.append("season", selectedSeason);

      const url = `${API_BASE}reports/monthly.xlsx?${params.toString()}`;
      const res = await fetch(url);

      if (!res.ok) {
        const t = await res.text();
        throw new Error(t || "Falha ao gerar relatório");
      }

      const blob = await res.blob();
      const parts = [`relatorio_visitas_${startDate}_a_${endDate}`];
      if (selectedRegion) parts.push(selectedRegion.replace(/\s+/g, "-").toLowerCase());
      if (selectedSeason) parts.push(selectedSeason);
      await downloadBlob(`${parts.join("_")}.xlsx`, blob);
    } catch (err) {
      console.error(err);
      alert("Não foi possível gerar o Excel. Veja o console/log do backend.");
    } finally {
      setDownloadingExcel(false);
    }
  }

  // para tabela "Últimas visitas" sem renderizar 200 linhas
  const lastVisits = useMemo(() => {
    const sorted = [...visits].sort((a, b) => (b.date || "").localeCompare(a.date || ""));
    return sorted.slice(0, 12);
  }, [visits]);

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
          <div className="row g-3 mb-4">
            <div className="col-6 col-md-4 col-lg-2">
              <KPICard
                icon={Users}
                label="Clientes"
                value={clients.length}
                variant="blue"
                subtitle="Carteira ativa"
              />
            </div>
            <div className="col-6 col-md-4 col-lg-2">
              <KPICard
                icon={Map}
                label="Propriedades"
                value={properties.length}
                variant="emerald"
                subtitle="Fazendas cadastradas"
              />
            </div>
            <div className="col-6 col-md-4 col-lg-2">
              <KPICard
                icon={Sprout}
                label="Talhões"
                value={plots.length}
                variant="teal"
                subtitle="Áreas produtivas"
              />
            </div>
            <div className="col-6 col-md-4 col-lg-2">
              <KPICard
                icon={Wheat}
                label="Plantios"
                value={plantings.length}
                variant="amber"
                subtitle="Safras em campo"
              />
            </div>
            <div className="col-6 col-md-4 col-lg-2">
              <KPICard
                icon={ClipboardList}
                label="Acompanhamentos"
                value={visits.filter(v => (v.photos?.length ?? 0) > 0).length}
                variant="violet"
                subtitle="Lançamentos com foto"
              />
            </div>
            <div className="col-6 col-md-4 col-lg-2">
              <KPICard
                icon={Briefcase}
                label="Oportunidades"
                value={opps.length}
                variant="rose"
                subtitle="Pipeline ativo"
              />
            </div>
          </div>

          {/* FILTROS */}
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
                      className="form-control form-control-sm"
                      style={{
                        background: "var(--panel)",
                        color: "var(--text)",
                        borderColor: "var(--border)",
                      }}
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                    />
                  </label>

                  <label className="d-flex flex-column">
                    <small className="text-secondary">Até</small>
                    <input
                      type="date"
                      className="form-control form-control-sm"
                      style={{
                        background: "var(--panel)",
                        color: "var(--text)",
                        borderColor: "var(--border)",
                      }}
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                    />
                  </label>

                </div>

                <div className="ms-auto d-flex align-items-center gap-2 flex-wrap">
                  <div className="fw-semibold text-success">
                    {startDate && endDate ? (
                      <>Vendas (fechadas): {fmtCurrency(totalSales)}</>
                    ) : (
                      <span className="text-secondary">Selecione um intervalo</span>
                    )}
                  </div>

                  {/* ===== Filtros do relatório Excel ===== */}
                  <select
                    className="form-select form-select-sm"
                    style={{ width: "auto", minWidth: 160 }}
                    value={selectedRegion}
                    onChange={(e) => setSelectedRegion(e.target.value)}
                    title="Filtrar por região"
                  >
                    <option value="">Todas as regiões</option>
                    {regions.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>

                  <select
                    className="form-select form-select-sm"
                    style={{ width: "auto", minWidth: 160 }}
                    value={selectedSeason}
                    onChange={(e) => setSelectedSeason(e.target.value)}
                    title="Filtrar por safra (cultura + janela de datas)"
                  >
                    <option value="">Todas as safras</option>
                    {seasons.map((s) => (
                      <option key={s.key} value={s.key}>
                        {s.label}
                      </option>
                    ))}
                  </select>

                  <button
                    onClick={downloadExcel}
                    disabled={!startDate || !endDate || downloadingExcel}
                    title="Baixar relatório gerencial em Excel (PowerBI style)"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 7,
                      padding: "7px 16px",
                      background: (!startDate || !endDate || downloadingExcel)
                        ? "#9ca3af"
                        : "linear-gradient(135deg, #16a34a 0%, #15803d 100%)",
                      color: "#fff",
                      border: "none",
                      borderRadius: 8,
                      fontWeight: 600,
                      fontSize: 13,
                      cursor: (!startDate || !endDate || downloadingExcel) ? "not-allowed" : "pointer",
                      boxShadow: (!startDate || !endDate || downloadingExcel)
                        ? "none"
                        : "0 2px 8px rgba(22,163,74,0.35)",
                      transition: "all 0.15s",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {downloadingExcel
                      ? <><Loader2 size={15} style={{ animation: "spin 0.8s linear infinite" }} /> Gerando...</>
                      : <><FileSpreadsheet size={15} /> Baixar Excel</>
                    }
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* GRÁFICO */}
          {startDate && endDate && days.length > 0 && (
            <div className="row mb-5 justify-content-center">
              <div className="col-12 col-lg-10">
                <div
                  className="card border-0 shadow-sm p-4"
                  style={{ background: "var(--panel)", color: "var(--text)" }}
                >
                  <h5 className="mb-3" style={{ color: "var(--text-secondary)" }}>
                    📈 Vendas por dia
                  </h5>

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
                            <text x={x + 9} y={96} fontSize={10} fill="#9fb3b6" textAnchor="middle">
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

          {/* Últimas visitas */}
          <div className="row mb-5 justify-content-center">
            <div className="col-12 col-lg-10">
              <div
                className="card border-0 shadow-sm text-center p-3"
                style={{ background: "var(--panel)", color: "var(--text)" }}
              >
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
                      {lastVisits.map((v) => (
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

          {/* Oportunidades */}
          <div className="row justify-content-center">
            <div className="col-12 col-lg-10">
              <div
                className="card border-0 p-3 shadow-sm d-flex flex-wrap align-items-center gap-3"
                style={{ background: "var(--panel)", color: "var(--text)" }}
              >
                <h5 className="mb-3" style={{ color: "var(--text-secondary)" }}>
                  💼 Últimas Oportunidades
                </h5>

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
                          <span
                            className={`badge ${
                              o.stage.toLowerCase() === "fechadas" ? "bg-success" : "bg-secondary"
                            } me-2`}
                          >
                            {o.stage}
                          </span>
                        )}
                        <span className="text-secondary">{fmtCurrency(o.estimated_value || 0)}</span>
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
