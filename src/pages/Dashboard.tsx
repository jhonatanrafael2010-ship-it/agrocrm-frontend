import React, { useEffect, useMemo, useState } from "react";
import {
  Box,
  Typography,
  Paper,
  Grid,
  TextField,
  MenuItem,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  CircularProgress,
  Card,
  CardContent,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
  Avatar,
} from "@mui/material";
import {
  FileDownload as FileDownloadIcon,
  CalendarToday as CalendarIcon,
} from "@mui/icons-material";
import { Users, Map, Sprout, Wheat, ClipboardList, Briefcase, Loader2, AlertTriangle, Calendar, BarChart3, Leaf } from "lucide-react";
import { API_BASE } from "../config";
import { fetchWithCache } from "../utils/offlineSync";
import KPICard from "../components/KPICard";
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

type StaleClient = {
  id: number;
  name: string;
  last_visit: string | null;
  days_since: number;
};

type VisitSuggestion = {
  client_id: number;
  client_name: string;
  culture: string;
  current_stage: string;
  next_stage: string;
  days_since_visit: number;
  days_until_next: number;
  priority: "high" | "medium";
  reason: "phenology" | "stale";
};

type VisitByMonth = {
  year: number;
  month: number;
  label: string;
  count: number;
};

type PhenologyStage = {
  stage: string;
  count: number;
};

type DashboardInsights = {
  stale_clients: StaleClient[];
  stale_clients_count: number;
  visit_suggestions: VisitSuggestion[];
  visit_suggestions_count: number;
  visits_by_month: VisitByMonth[];
  phenology_stages: PhenologyStage[];
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
  const [insights, setInsights] = useState<DashboardInsights | null>(null);

  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  const [clientsMap, setClientsMap] = useState<Record<number, string>>({});
  const [propsMap, setPropsMap] = useState<Record<number, string>>({});

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
      fetch(`${API_BASE}dashboard/insights`).then(r => r.ok ? r.json() : null).catch(() => null),
    ])
      .then(([cs, ps, pls, pts, vs, os, ins]) => {
        if (!mounted) return;

        setClients(cs || []);
        setProperties(ps || []);
        setPlots(pls || []);
        setPlantings(pts || []);
        setVisits(vs || []);
        setOpps(os || []);
        if (ins?.ok) setInsights(ins);

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

  const lastVisits = useMemo(() => {
    const sorted = [...visits].sort((a, b) => (b.date || "").localeCompare(a.date || ""));
    return sorted.slice(0, 12);
  }, [visits]);

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 1400, mx: "auto" }}>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 700, color: "primary.main", mb: 0.5 }}>
          Dashboard
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Acompanhe os principais indicadores de clientes, visitas e vendas.
        </Typography>
      </Box>

      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
          <CircularProgress />
        </Box>
      ) : (
        <>
          {/* KPI Cards */}
          <Grid container spacing={2} sx={{ mb: 4 }}>
            <Grid size={{ xs: 6, sm: 4, md: 2 }}>
              <KPICard icon={Users} label="Clientes" value={clients.length} variant="blue" subtitle="Carteira ativa" />
            </Grid>
            <Grid size={{ xs: 6, sm: 4, md: 2 }}>
              <KPICard icon={Map} label="Propriedades" value={properties.length} variant="emerald" subtitle="Fazendas cadastradas" />
            </Grid>
            <Grid size={{ xs: 6, sm: 4, md: 2 }}>
              <KPICard icon={Sprout} label="Talhões" value={plots.length} variant="teal" subtitle="Áreas produtivas" />
            </Grid>
            <Grid size={{ xs: 6, sm: 4, md: 2 }}>
              <KPICard icon={Wheat} label="Plantios" value={plantings.length} variant="amber" subtitle="Safras em campo" />
            </Grid>
            <Grid size={{ xs: 6, sm: 4, md: 2 }}>
              <KPICard icon={ClipboardList} label="Acompanhamentos" value={visits.filter(v => (v.photos?.length ?? 0) > 0).length} variant="violet" subtitle="Lançamentos com foto" />
            </Grid>
            <Grid size={{ xs: 6, sm: 4, md: 2 }}>
              <KPICard icon={Briefcase} label="Oportunidades" value={opps.length} variant="rose" subtitle="Pipeline ativo" />
            </Grid>
          </Grid>

          {/* Insights Section */}
          {insights && (
            <Grid container spacing={2} sx={{ mb: 4 }}>
              {/* Clientes sem visita há 30+ dias */}
              {insights.stale_clients.length > 0 && (
                <Grid size={{ xs: 12, md: 6 }}>
                  <Card sx={{ height: "100%", borderLeft: "4px solid", borderLeftColor: "warning.main" }}>
                    <CardContent>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
                        <AlertTriangle size={20} color="#f59e0b" />
                        <Typography variant="h6" sx={{ fontWeight: 600 }}>
                          Clientes sem visita há 30+ dias
                        </Typography>
                        <Chip label={insights.stale_clients.length} size="small" color="warning" />
                      </Box>
                      <List dense disablePadding>
                        {insights.stale_clients.slice(0, 5).map((client, idx) => (
                          <React.Fragment key={client.id}>
                            {idx > 0 && <Divider />}
                            <ListItem
                              sx={{ px: 0, cursor: "pointer", "&:hover": { bgcolor: "action.hover" } }}
                              onClick={() => {
                                sessionStorage.setItem("prefill_visit", JSON.stringify({ client_id: client.id }));
                                sessionStorage.setItem("open_section", "calendar");
                                sessionStorage.setItem("open_new_visit_modal", "true");
                                window.location.href = "/";
                              }}
                            >
                              <ListItemIcon sx={{ minWidth: 36 }}>
                                <Avatar sx={{ width: 28, height: 28, bgcolor: "warning.light", fontSize: 12 }}>
                                  {client.name.charAt(0)}
                                </Avatar>
                              </ListItemIcon>
                              <ListItemText
                                primary={client.name}
                                secondary={`${client.days_since} dias sem visita`}
                                slotProps={{ primary: { sx: { fontWeight: 500 } } }}
                              />
                              <Chip
                                label="Agendar"
                                size="small"
                                variant="outlined"
                                color="warning"
                                sx={{ fontSize: 11 }}
                              />
                            </ListItem>
                          </React.Fragment>
                        ))}
                      </List>
                    </CardContent>
                  </Card>
                </Grid>
              )}

              {/* Sugestões de visitas */}
              <Grid size={{ xs: 12, md: insights.stale_clients.length > 0 ? 6 : 12 }}>
                <Card sx={{ height: "100%", borderLeft: "4px solid", borderLeftColor: "primary.main" }}>
                  <CardContent>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
                      <Calendar size={20} color="#3b82f6" />
                      <Typography variant="h6" sx={{ fontWeight: 600 }}>
                        Sugestões de visitas
                      </Typography>
                      <Chip label={insights.visit_suggestions.length} size="small" color="primary" />
                    </Box>
                    {insights.visit_suggestions.length > 0 ? (
                      <List dense disablePadding>
                        {insights.visit_suggestions.slice(0, 5).map((sug, idx) => (
                          <React.Fragment key={`${sug.client_id}-${idx}`}>
                            {idx > 0 && <Divider />}
                            <ListItem
                              sx={{ px: 0, cursor: "pointer", "&:hover": { bgcolor: "action.hover" } }}
                              onClick={() => {
                                sessionStorage.setItem("prefill_visit", JSON.stringify({ client_id: sug.client_id }));
                                sessionStorage.setItem("open_section", "calendar");
                                sessionStorage.setItem("open_new_visit_modal", "true");
                                window.location.href = "/";
                              }}
                            >
                              <ListItemIcon sx={{ minWidth: 36 }}>
                                <Avatar
                                  sx={{
                                    width: 28,
                                    height: 28,
                                    bgcolor: sug.priority === "high" ? "error.light" : "primary.light",
                                    fontSize: 11,
                                  }}
                                >
                                  {sug.current_stage || "!"}
                                </Avatar>
                              </ListItemIcon>
                              <ListItemText
                                primary={sug.client_name}
                                secondary={
                                  sug.reason === "phenology"
                                    ? `${sug.culture} ${sug.current_stage} → ${sug.next_stage} (${sug.days_until_next === 0 ? "agora" : `em ~${sug.days_until_next}d`})`
                                    : `Sem visita há ${sug.days_since_visit} dias`
                                }
                                slotProps={{ primary: { sx: { fontWeight: 500 } } }}
                              />
                              <Chip
                                label="Visitar"
                                size="small"
                                variant="outlined"
                                color={sug.priority === "high" ? "error" : "primary"}
                                sx={{ fontSize: 11 }}
                              />
                            </ListItem>
                          </React.Fragment>
                        ))}
                      </List>
                    ) : (
                      <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: "center" }}>
                        Nenhuma sugestão no momento
                      </Typography>
                    )}
                  </CardContent>
                </Card>
              </Grid>

              {/* Gráfico de visitas por mês */}
              {insights.visits_by_month.length > 0 && (
                <Grid size={{ xs: 12, md: 6 }}>
                  <Card>
                    <CardContent>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
                        <BarChart3 size={20} color="#8b5cf6" />
                        <Typography variant="h6" sx={{ fontWeight: 600 }}>
                          Visitas por mês
                        </Typography>
                      </Box>
                      <Box sx={{ display: "flex", alignItems: "flex-end", gap: 1, height: 120 }}>
                        {insights.visits_by_month.map((m) => {
                          const maxCount = Math.max(...insights.visits_by_month.map(x => x.count), 1);
                          const heightPercent = (m.count / maxCount) * 100;
                          return (
                            <Box
                              key={m.label}
                              sx={{
                                flex: 1,
                                display: "flex",
                                flexDirection: "column",
                                alignItems: "center",
                                gap: 0.5,
                              }}
                            >
                              <Typography variant="caption" sx={{ fontWeight: 600 }}>
                                {m.count}
                              </Typography>
                              <Box
                                sx={{
                                  width: "100%",
                                  height: `${heightPercent}%`,
                                  minHeight: 4,
                                  bgcolor: "primary.main",
                                  borderRadius: 1,
                                  transition: "height 0.3s",
                                }}
                              />
                              <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10 }}>
                                {m.label.split("/")[0]}
                              </Typography>
                            </Box>
                          );
                        })}
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              )}

              {/* Estágios fenológicos */}
              {insights.phenology_stages.length > 0 && (
                <Grid size={{ xs: 12, md: 6 }}>
                  <Card>
                    <CardContent>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
                        <Leaf size={20} color="#22c55e" />
                        <Typography variant="h6" sx={{ fontWeight: 600 }}>
                          Fenologia atual (30 dias)
                        </Typography>
                      </Box>
                      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
                        {insights.phenology_stages.map((stage) => (
                          <Chip
                            key={stage.stage}
                            label={`${stage.stage}: ${stage.count}`}
                            size="small"
                            sx={{
                              bgcolor: stage.stage.startsWith("R") ? "success.light" : "info.light",
                              color: stage.stage.startsWith("R") ? "success.dark" : "info.dark",
                              fontWeight: 600,
                            }}
                          />
                        ))}
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              )}
            </Grid>
          )}

          {/* Filters Card */}
          <Card sx={{ mb: 4 }}>
            <CardContent>
              <Box
                sx={{
                  display: "flex",
                  flexWrap: "wrap",
                  alignItems: "center",
                  gap: 2,
                }}
              >
                <TextField
                  label="De"
                  type="date"
                  size="small"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  slotProps={{ inputLabel: { shrink: true } }}
                  sx={{ width: 160 }}
                />
                <TextField
                  label="Até"
                  type="date"
                  size="small"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  slotProps={{ inputLabel: { shrink: true } }}
                  sx={{ width: 160 }}
                />

                <Box sx={{ flex: 1 }} />

                {startDate && endDate && (
                  <Typography variant="subtitle1" sx={{ fontWeight: 600, color: "success.main" }}>
                    Vendas (fechadas): {fmtCurrency(totalSales)}
                  </Typography>
                )}

                <TextField
                  select
                  label="Região"
                  size="small"
                  value={selectedRegion}
                  onChange={(e) => setSelectedRegion(e.target.value)}
                  sx={{ minWidth: 160 }}
                >
                  <MenuItem value="">Todas as regiões</MenuItem>
                  {regions.map((r) => (
                    <MenuItem key={r} value={r}>{r}</MenuItem>
                  ))}
                </TextField>

                <TextField
                  select
                  label="Safra"
                  size="small"
                  value={selectedSeason}
                  onChange={(e) => setSelectedSeason(e.target.value)}
                  sx={{ minWidth: 160 }}
                >
                  <MenuItem value="">Todas as safras</MenuItem>
                  {seasons.map((s) => (
                    <MenuItem key={s.key} value={s.key}>{s.label}</MenuItem>
                  ))}
                </TextField>

                <Button
                  variant="contained"
                  startIcon={downloadingExcel ? <Loader2 size={16} style={{ animation: "spin 0.8s linear infinite" }} /> : <FileDownloadIcon />}
                  onClick={downloadExcel}
                  disabled={!startDate || !endDate || downloadingExcel}
                  sx={{
                    textTransform: "none",
                    fontWeight: 600,
                    "@keyframes spin": {
                      "0%": { transform: "rotate(0deg)" },
                      "100%": { transform: "rotate(360deg)" },
                    },
                  }}
                >
                  {downloadingExcel ? "Gerando..." : "Baixar Excel"}
                </Button>
              </Box>
            </CardContent>
          </Card>

          {/* Chart */}
          {startDate && endDate && days.length > 0 && (
            <Card sx={{ mb: 4 }}>
              <CardContent>
                <Typography variant="h6" sx={{ mb: 2, color: "text.secondary" }}>
                  Vendas por dia
                </Typography>

                <Box sx={{ position: "relative", overflowX: "auto" }}>
                  <svg width="100%" height="120" viewBox={`0 0 ${days.length * 30} 100`} style={{ minWidth: days.length * 30 }}>
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
                            style={{ cursor: "pointer" }}
                            onMouseEnter={(ev: any) =>
                              setTooltip({
                                x: ev.clientX,
                                y: ev.clientY,
                                text: `${days[i]}: ${fmtCurrency(v)}`,
                              })
                            }
                            onMouseLeave={() => setTooltip(null)}
                          />
                          <text x={x + 9} y={96} fontSize={10} fill="#9ca3af" textAnchor="middle">
                            {days[i].slice(5)}
                          </text>
                        </g>
                      );
                    })}

                    <defs>
                      <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#22c55e" />
                        <stop offset="100%" stopColor="#15803d" />
                      </linearGradient>
                    </defs>
                  </svg>

                  {tooltip && (
                    <Paper
                      elevation={8}
                      sx={{
                        position: "fixed",
                        left: tooltip.x + 10,
                        top: tooltip.y - 40,
                        px: 1.5,
                        py: 0.75,
                        fontSize: "0.8rem",
                        fontWeight: 500,
                        pointerEvents: "none",
                        zIndex: 1000,
                      }}
                    >
                      {tooltip.text}
                    </Paper>
                  )}
                </Box>
              </CardContent>
            </Card>
          )}

          {/* Last Visits */}
          <Card sx={{ mb: 4 }}>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2 }}>
                Últimas Visitas
              </Typography>

              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 600 }}>Data</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Cliente</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Propriedade</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {lastVisits.map((v) => (
                      <TableRow key={v.id} hover>
                        <TableCell>{v.date?.split("T")[0] ?? "--"}</TableCell>
                        <TableCell>{clientsMap[v.client_id ?? 0] ?? "-"}</TableCell>
                        <TableCell>{propsMap[v.property_id ?? 0] ?? "-"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>

          {/* Opportunities */}
          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2 }}>
                Últimas Oportunidades
              </Typography>

              <List disablePadding>
                {(startDate && endDate ? filteredOpps : opps).slice(0, 12).map((o, idx) => (
                  <React.Fragment key={o.id}>
                    {idx > 0 && <Divider />}
                    <ListItem
                      sx={{
                        display: "flex",
                        justifyContent: "space-between",
                        py: 1.5,
                      }}
                    >
                      <ListItemText
                        primary={o.title ?? "Sem título"}
                        slotProps={{
                          primary: { sx: { fontWeight: 500 } },
                        }}
                      />
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                        {o.stage && (
                          <Chip
                            label={o.stage}
                            size="small"
                            color={o.stage.toLowerCase() === "fechadas" ? "success" : "default"}
                            sx={{ fontWeight: 600 }}
                          />
                        )}
                        <Typography variant="body2" color="text.secondary">
                          {fmtCurrency(o.estimated_value || 0)}
                        </Typography>
                      </Box>
                    </ListItem>
                  </React.Fragment>
                ))}
              </List>
            </CardContent>
          </Card>
        </>
      )}
    </Box>
  );
};

export default Dashboard;
