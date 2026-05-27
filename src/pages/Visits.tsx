import React, { useEffect, useState, useMemo } from "react";
import {
  Box,
  Card,
  CardContent,
  Chip,
  Typography,
  IconButton,
  Button,
  TextField,
  MenuItem,
  Menu,
  ListItemIcon,
  ListItemText,
  Collapse,
  Stack,
  Divider,
  Avatar,
  LinearProgress,
  Paper,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Autocomplete,
  createFilterOptions,
} from "@mui/material";
import {
  ExpandMore as ExpandMoreIcon,
  Visibility as VisibilityIcon,
  PictureAsPdf as PdfIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  CheckCircle as CheckCircleIcon,
  Schedule as ScheduleIcon,
  Clear as ClearIcon,
  Agriculture as AgricultureIcon,
  Place as PlaceIcon,
  Person as PersonIcon,
  PhotoCamera as PhotoIcon,
  OpenInNew as OpenInNewIcon,
  Chat as ChatIcon,
} from "@mui/icons-material";
import { API_BASE } from "../config";
import { fetchWithCache, invalidateCache } from "../utils/offlineSync";
import { authFetch } from "../services/auth";
import PhotoCarousel from "../components/PhotoCarousel";
import "../styles/acompanhamento.css";

// Ícone de cultura baseado no tipo
function CultureIcon({ culture, size = 20 }: { culture?: string; size?: number }) {
  const cultureNorm = (culture || "").toLowerCase().trim();

  const iconStyle: React.CSSProperties = {
    fontSize: size,
    lineHeight: 1,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
  };

  if (cultureNorm.includes("milho")) {
    return <span style={iconStyle} role="img" aria-label="Milho">🌽</span>;
  }
  if (cultureNorm.includes("soja")) {
    return <span style={iconStyle} role="img" aria-label="Soja">🫛</span>;
  }
  if (cultureNorm.includes("algod")) {
    return <span style={iconStyle} role="img" aria-label="Algodão">☁️</span>;
  }
  if (cultureNorm.includes("feij")) {
    return <span style={iconStyle} role="img" aria-label="Feijão">🫘</span>;
  }
  if (cultureNorm.includes("trigo")) {
    return <span style={iconStyle} role="img" aria-label="Trigo">🌾</span>;
  }
  if (cultureNorm.includes("café") || cultureNorm.includes("cafe")) {
    return <span style={iconStyle} role="img" aria-label="Café">☕</span>;
  }
  if (cultureNorm.includes("cana")) {
    return <span style={iconStyle} role="img" aria-label="Cana">🎋</span>;
  }
  // Fallback para outras culturas
  return <AgricultureIcon sx={{ fontSize: size }} />;
}

// Tipos
type Visit = {
  id: number;
  date?: string;
  client_id?: number;
  property_id?: number;
  plot_id?: number;
  consultant_id?: number;
  consultant_name?: string;
  culture?: string;
  variety?: string;
  recommendation?: string;
  diagnosis?: string;
  photos?: any[];
  planting_id?: number;
  status?: string;
};

type Client = { id: number; name: string };

const clientFilterOptions = createFilterOptions<Client>({
  matchFrom: "any",
  limit: 10,
});

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

const GROUPS_PER_PAGE = 20;

const Visits: React.FC = () => {
  const [visits, setVisits] = useState<Visit[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [plots, setPlots] = useState<Plot[]>([]);
  const [consultants, setConsultants] = useState<Consultant[]>([]);
  const [cultures, setCultures] = useState<Culture[]>([]);
  const [varieties, setVarieties] = useState<Variety[]>([]);
  const [loading, setLoading] = useState(true);

  // Pagination state (por grupos)
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [totalGroups, setTotalGroups] = useState(0);
  const [loadedGroups, setLoadedGroups] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);

  const [selectedConsultant, setSelectedConsultant] = useState("");
  const [selectedCulture, setSelectedCulture] = useState("");
  const [selectedVariety, setSelectedVariety] = useState("");
  const [filterClient, setFilterClient] = useState<Client | null>(null);

  const [filterStart, setFilterStart] = useState("");
  const [filterEnd, setFilterEnd] = useState("");

  // Modal-resumo
  const [summary, setSummary] = useState<SummaryState>(null);

  // Abrir/fechar groups
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  // Carrossel de fotos (stories)
  const [carousel, setCarousel] = useState<{ open: boolean; photos: any[] }>({
    open: false,
    photos: [],
  });

  // Menu "Adicionar visita a este ciclo"
  const [addCycleMenu, setAddCycleMenu] = useState<{
    anchorEl: HTMLElement | null;
    cycleData: {
      client_id: number;
      client_name: string;
      property_id?: number;
      property_name?: string;
      plot_id?: number;
      plot_name?: string;
      culture?: string;
      variety?: string;
      consultant_id?: number;
    } | null;
  }>({ anchorEl: null, cycleData: null });



  // ============================================================
  // 🔁 Carregar dados
  // ============================================================

  function buildVisitsUrl(page: number) {
    const params = new URLSearchParams();
    params.set("scope", "all");
    params.set("page", String(page));
    params.set("limit", String(GROUPS_PER_PAGE));
    if (filterClient) params.set("client_id", String(filterClient.id));
    if (selectedConsultant) params.set("consultant_id", selectedConsultant);
    if (selectedCulture) params.set("culture", selectedCulture);
    if (selectedVariety) params.set("variety", selectedVariety);
    if (filterStart) params.set("date_start", filterStart);
    if (filterEnd) params.set("date_end", filterEnd);
    return `${API_BASE}visits?${params.toString()}`;
  }

  async function loadVisits(page: number = 1, append: boolean = false) {
    if (!append) setLoading(true);
    else setLoadingMore(true);

    try {
      const res = await authFetch(buildVisitsUrl(page));
      if (res.ok) {
        const data = await res.json();
        if (data && data.items) {
          if (append) {
            setVisits((prev) => [...prev, ...data.items]);
            setLoadedGroups((prev) => prev + (data.groups_in_page || 0));
          } else {
            setVisits(data.items);
            setLoadedGroups(data.groups_in_page || 0);
          }
          setTotalGroups(data.total_groups || 0);
          setHasMore(data.has_next);
          setCurrentPage(page);
        }
      }
    } catch (err) {
      console.error("Erro ao carregar visitas:", err);
    } finally {
      if (!append) setLoading(false);
      else setLoadingMore(false);
    }
  }

  async function loadData() {
    setLoading(true);

    try {
      const [cs, ps, pls, cons, cul, vars] = await Promise.all([
        fetchWithCache(`${API_BASE}clients`, "clients"),
        fetchWithCache(`${API_BASE}properties`, "properties"),
        fetchWithCache(`${API_BASE}plots`, "plots"),
        fetchWithCache(`${API_BASE}consultants`, "consultants"),
        fetchWithCache(`${API_BASE}cultures`, "cultures"),
        fetchWithCache(`${API_BASE}varieties`, "varieties"),
      ]);

      setClients(cs);
      setProperties(ps);
      setPlots(pls);
      setConsultants(cons);
      setCultures(cul);
      setVarieties(vars);

      await loadVisits(1, false);
    } finally {
      setLoading(false);
    }
  }

  async function loadMore() {
    if (loadingMore || !hasMore) return;
    await loadVisits(currentPage + 1, true);
  }

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (clients.length === 0) return;
    loadVisits(1, false);
  }, [filterClient, selectedConsultant, selectedCulture, selectedVariety, filterStart, filterEnd]);

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


  function getConsultantNameFromGroup(group: Visit[]) {
    if (!group || group.length === 0) return "—";

    const visitWithConsultantName = group.find(
      (v) => v?.consultant_name && String(v.consultant_name).trim() !== ""
    );
    if (visitWithConsultantName?.consultant_name) {
      return visitWithConsultantName.consultant_name;
    }

    const visitWithConsultantId = group.find(
      (v) => v?.consultant_id !== null && v?.consultant_id !== undefined && String(v.consultant_id).trim() !== ""
    );
    if (!visitWithConsultantId) return "—";

    const found = consultants.find(
      (c) => String(c.id) === String(visitWithConsultantId.consultant_id)
    );

    return found?.name || "—";
  }



  function goToEditVisit(v: Visit) {
    if (!v?.id) return;

    sessionStorage.setItem("edit_visit_id", String(v.id));
    sessionStorage.setItem("open_section", "calendar");

    window.location.href = "/";
  }

  function handleAddToCycleModal() {
    const data = addCycleMenu.cycleData;
    if (!data) return;

    // Salva dados para pré-preencher o modal de nova visita
    sessionStorage.setItem("prefill_visit", JSON.stringify({
      client_id: data.client_id,
      property_id: data.property_id,
      plot_id: data.plot_id,
      culture: data.culture,
      variety: data.variety,
      consultant_id: data.consultant_id,
    }));
    sessionStorage.setItem("open_section", "calendar");
    sessionStorage.setItem("open_new_visit_modal", "true");

    setAddCycleMenu({ anchorEl: null, cycleData: null });
    window.location.href = "/";
  }

  function handleAddToCycleAssistant() {
    const data = addCycleMenu.cycleData;
    if (!data) return;

    // Monta mensagem inicial para o assistente
    const parts = [data.client_name];
    if (data.property_name) parts.push(`Faz. ${data.property_name}`);
    if (data.culture) parts.push(data.culture);
    if (data.variety) parts.push(data.variety);

    sessionStorage.setItem("prefill_chat_message", parts.join("\n"));
    sessionStorage.setItem("open_section", "chat");

    setAddCycleMenu({ anchorEl: null, cycleData: null });
    window.location.href = "/";
  }

  async function handleDelete(id?: number) {
    if (!id) return;
    if (!confirm("Deseja excluir esta visita?")) return;

    const res = await authFetch(`${API_BASE}visits/${id}`, { method: "DELETE" });

    if (res.ok) {
      invalidateCache(`${API_BASE}visits?scope=all`);
      setVisits((list) => list.filter((v) => v.id !== id));
    }
  }

  async function handleMarkDone(v: Visit) {
    if (!v.id) return;
    try {
      const res = await authFetch(`${API_BASE}visits/${v.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "done" }),
      });
      if (res.ok) {
        invalidateCache(`${API_BASE}visits?scope=all`);
        setVisits((list) =>
          list.map((x) => (x.id === v.id ? { ...x, status: "done" } : x))
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
  // 🧩 AGRUPAMENTO — COM MEMOIZAÇÃO PARA PERFORMANCE
  // ============================================================
  const groups = useMemo(() => {
    const result: Record<string, Visit[]> = {};

    visits
      ?.filter((v) => !!v)
      .forEach((v) => {
        const groupId = v.planting_id
          ? `plant-${v.planting_id}`
          : `${v.client_id}-${v.property_id}-${v.plot_id}-${v.variety || ""}`;

        if (!result[groupId]) result[groupId] = [];
        result[groupId].push(v);
      });

    Object.values(result).forEach((arr) => {
      arr.sort(
        (a, b) =>
          new Date(a.date || "1900-01-01").getTime() -
          new Date(b.date || "1900-01-01").getTime()
      );
    });

    return result;
  }, [visits]);

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
    <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 1200, mx: "auto" }}>
      {/* Header */}
      <Box sx={{ mb: 3, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700, display: "flex", alignItems: "center", gap: 1 }}>
            <AgricultureIcon color="primary" />
            Acompanhamentos
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Relatórios de campo e acompanhamento de ciclos
          </Typography>
        </Box>
      </Box>

      {/* Filtros - MUI */}
      <Paper sx={{ p: 2, mb: 3 }} elevation={0}>
        <Stack direction={{ xs: "column", md: "row" }} spacing={2} sx={{ flexWrap: "wrap" }} useFlexGap>
          <TextField
            label="Data início"
            type="date"
            size="small"
            value={filterStart}
            onChange={(e) => setFilterStart(e.target.value)}
            slotProps={{ inputLabel: { shrink: true } }}
            sx={{ minWidth: 140 }}
          />
          <TextField
            label="Data fim"
            type="date"
            size="small"
            value={filterEnd}
            onChange={(e) => setFilterEnd(e.target.value)}
            slotProps={{ inputLabel: { shrink: true } }}
            sx={{ minWidth: 140 }}
          />
          <Autocomplete
            size="small"
            options={clients}
            filterOptions={clientFilterOptions}
            getOptionLabel={(option) => option.name}
            value={filterClient}
            onChange={(_, newValue) => setFilterClient(newValue)}
            sx={{ minWidth: 200 }}
            renderInput={(params) => (
              <TextField {...params} label="Cliente" placeholder="Buscar cliente..." />
            )}
          />
          <TextField
            select
            label="Consultor"
            size="small"
            value={selectedConsultant}
            onChange={(e) => setSelectedConsultant(e.target.value)}
            sx={{ minWidth: 140 }}
          >
            <MenuItem value="">Todos</MenuItem>
            {consultants.map((c) => (
              <MenuItem key={c.id} value={String(c.id)}>{c.name}</MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label="Cultura"
            size="small"
            value={selectedCulture}
            onChange={(e) => { setSelectedCulture(e.target.value); setSelectedVariety(""); }}
            sx={{ minWidth: 120 }}
          >
            <MenuItem value="">Todas</MenuItem>
            {cultures.map((c) => (
              <MenuItem key={c.id} value={c.name}>{c.name}</MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label="Variedade"
            size="small"
            value={selectedVariety}
            onChange={(e) => setSelectedVariety(e.target.value)}
            sx={{ minWidth: 140 }}
          >
            <MenuItem value="">Todas</MenuItem>
            {filteredVarieties.map((v) => (
              <MenuItem key={v.name} value={v.name}>{v.name}</MenuItem>
            ))}
          </TextField>
          <Button
            variant="outlined"
            size="small"
            startIcon={<ClearIcon />}
            onClick={() => {
              setSelectedConsultant("");
              setSelectedCulture("");
              setSelectedVariety("");
              setFilterClient(null);
              setFilterStart("");
              setFilterEnd("");
            }}
          >
            Limpar
          </Button>
        </Stack>
      </Paper>

      {/* Loading */}
      {loading && <LinearProgress sx={{ mb: 2 }} />}

      {/* Empty state */}
      {!loading && Object.keys(groups).length === 0 && (
        <Paper sx={{ p: 6, textAlign: "center" }}>
          <AgricultureIcon sx={{ fontSize: 64, opacity: 0.3, mb: 2 }} />
          <Typography variant="h6" color="text.secondary">
            Nenhum acompanhamento encontrado
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Crie visitas para começar a acompanhar seus ciclos
          </Typography>
        </Paper>
      )}

      {/* Cards de acompanhamento */}
      <Stack spacing={2}>
        {Object.entries(groups).map(([gid, group]) => {
          const first = group[0];
          const clientName = clients.find((c) => c.id === first.client_id)?.name || "—";
          const propertyName = properties.find((p) => p.id === first.property_id)?.name || "—";
          const plotName = plots.find((p) => p.id === first.plot_id)?.name || "—";
          const hasAnyPhoto = group.some((v) => (v.photos?.length ?? 0) > 0);
          const doneCount = group.filter((v) => v.status === "done").length;
          const headerData = {
            clientName,
            propertyName,
            plotName,
            culture: first.culture || "",
            variety: first.variety || "",
          };

          return (
            <Card
              key={gid}
              sx={{
                borderLeft: hasAnyPhoto ? "4px solid" : "none",
                borderLeftColor: "primary.main",
              }}
            >
              <CardContent
                sx={{ cursor: "pointer", "&:hover": { bgcolor: "action.hover" } }}
                onClick={() => toggleGroup(gid)}
              >
                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="h6" sx={{ fontWeight: 700 }}>
                      {clientName}
                    </Typography>
                    <Stack direction="row" spacing={1} sx={{ alignItems: "center", mt: 0.5, color: "text.secondary" }}>
                      <PlaceIcon fontSize="small" color="primary" />
                      <Typography variant="body2">
                        {propertyName} — {plotName}
                      </Typography>
                    </Stack>
                    <Stack direction="row" spacing={1} sx={{ mt: 1.5, flexWrap: "wrap" }} useFlexGap>
                      {first.culture && (
                        <Chip
                          size="small"
                          icon={<CultureIcon culture={first.culture} size={18} />}
                          label={first.culture}
                          color="primary"
                          variant="outlined"
                        />
                      )}
                      {first.variety && (
                        <Chip size="small" label={first.variety} color="info" variant="outlined" />
                      )}
                      <Chip
                        size="small"
                        icon={<PersonIcon />}
                        label={getConsultantNameFromGroup(group)}
                        variant="outlined"
                      />
                      <Chip
                        size="small"
                        icon={hasAnyPhoto ? <PhotoIcon /> : <ScheduleIcon />}
                        label={`${doneCount}/${group.length} visitas`}
                        color={hasAnyPhoto ? "success" : "default"}
                        variant="outlined"
                      />
                    </Stack>
                  </Box>
                  <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                    <Tooltip title="Ver resumo">
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSummary({ open: true, visits: group, header: headerData });
                        }}
                      >
                        <VisibilityIcon />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Exportar PDF">
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          exportGroupToPDF(group, headerData);
                        }}
                      >
                        <PdfIcon />
                      </IconButton>
                    </Tooltip>
                    <IconButton size="small">
                      <ExpandMoreIcon
                        sx={{
                          transform: openGroups[gid] ? "rotate(180deg)" : "rotate(0deg)",
                          transition: "transform 0.2s",
                        }}
                      />
                    </IconButton>
                  </Stack>
                </Box>
              </CardContent>

              <Collapse in={openGroups[gid]}>
                <Divider />
                <CardContent>
                  {/* Timeline de visitas */}
                  <Box
                    sx={{
                      display: "flex",
                      overflowX: "auto",
                      pb: 2,
                      mb: 2,
                      gap: 0,
                    }}
                  >
                    {group.map((v, index) => {
                      const done = (v.status || "").toLowerCase() === "done";
                      const hasPhoto = (v.photos?.length ?? 0) > 0;
                      return (
                        <Box
                          key={v.id}
                          sx={{
                            minWidth: 100,
                            textAlign: "center",
                            position: "relative",
                            mr: index < group.length - 1 ? 3 : 0,
                          }}
                        >
                          {/* Linha conectora */}
                          {index < group.length - 1 && (
                            <Box
                              sx={{
                                position: "absolute",
                                top: 12,
                                left: "60%",
                                width: 40,
                                height: 3,
                                bgcolor: done ? "primary.main" : "divider",
                                borderRadius: 1,
                              }}
                            />
                          )}
                          {/* Dot */}
                          <Avatar
                            sx={{
                              width: 28,
                              height: 28,
                              mx: "auto",
                              bgcolor: done ? "primary.main" : "grey.400",
                              fontSize: "0.7rem",
                              fontWeight: 700,
                              boxShadow: hasPhoto ? "0 0 0 3px rgba(22, 163, 74, 0.3)" : "none",
                            }}
                          >
                            {done ? <CheckCircleIcon sx={{ fontSize: 16 }} /> : index + 1}
                          </Avatar>
                          <Typography variant="caption" sx={{ fontWeight: 600, mt: 1, display: "block" }}>
                            {(v.recommendation || "").slice(0, 15) || "Visita"}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {formatDateBR(v.date)}
                          </Typography>
                        </Box>
                      );
                    })}
                  </Box>

                  {/* Lista de visitas */}
                  <Stack spacing={1.5}>
                    {group.map((v) => {
                      const done = (v.status || "").toLowerCase() === "done";
                      return (
                        <Paper
                          key={v.id}
                          variant="outlined"
                          sx={{ p: 1.5, display: "flex", gap: 1.5, alignItems: "flex-start" }}
                        >
                          <Box
                            sx={{
                              width: 10,
                              height: 10,
                              borderRadius: "50%",
                              bgcolor: done ? "primary.main" : "warning.main",
                              mt: 0.5,
                              flexShrink: 0,
                            }}
                          />
                          <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.5 }}>
                              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                {v.recommendation?.split("\n")[0] || "Sem observação"}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {formatDateBR(v.date)}
                              </Typography>
                            </Box>
                            {v.recommendation && v.recommendation.includes("\n") && (
                              <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: "pre-wrap" }}>
                                {v.recommendation.split("\n").slice(1).join("\n")}
                              </Typography>
                            )}
                            {(v.photos?.length ?? 0) > 0 && (
                              <Stack direction="row" spacing={0.5} sx={{ mt: 1 }}>
                                {v.photos?.slice(0, 4).map((photo: any, i: number) => (
                                  <Box
                                    key={i}
                                    component="img"
                                    src={photo.url || photo}
                                    onClick={() => setCarousel({ open: true, photos: v.photos || [] })}
                                    sx={{
                                      width: 48,
                                      height: 48,
                                      borderRadius: 1,
                                      objectFit: "cover",
                                      cursor: "pointer",
                                      "&:hover": { opacity: 0.8 },
                                    }}
                                  />
                                ))}
                              </Stack>
                            )}
                          </Box>
                          <Stack direction="row" spacing={0.5}>
                            <Tooltip title="Editar">
                              <IconButton size="small" onClick={() => goToEditVisit(v)}>
                                <EditIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            {!done && (
                              <Tooltip title="Marcar concluída">
                                <IconButton size="small" color="primary" onClick={() => handleMarkDone(v)}>
                                  <CheckCircleIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            )}
                            <Tooltip title="Excluir">
                              <IconButton size="small" color="error" onClick={() => handleDelete(v.id)}>
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </Stack>
                        </Paper>
                      );
                    })}
                  </Stack>

                  {/* Botão adicionar visita */}
                  <Button
                    variant="outlined"
                    fullWidth
                    startIcon={<AddIcon />}
                    sx={{
                      mt: 2,
                      borderStyle: "dashed",
                      color: "text.secondary",
                      "&:hover": { borderColor: "primary.main", color: "primary.main" },
                    }}
                    onClick={(e) => {
                      if (!first.client_id) return;
                      setAddCycleMenu({
                        anchorEl: e.currentTarget,
                        cycleData: {
                          client_id: first.client_id,
                          client_name: clientName,
                          property_id: first.property_id,
                          property_name: propertyName,
                          plot_id: first.plot_id,
                          plot_name: plotName,
                          culture: first.culture,
                          variety: first.variety,
                          consultant_id: first.consultant_id,
                        },
                      });
                    }}
                  >
                    Adicionar visita a este ciclo
                  </Button>
                </CardContent>
              </Collapse>
            </Card>
          );
        })}
      </Stack>

      {/* Botão Carregar Mais */}
      {hasMore && (
        <Box sx={{ display: "flex", justifyContent: "center", mt: 3, mb: 2 }}>
          <Button
            variant="outlined"
            onClick={loadMore}
            disabled={loadingMore}
            startIcon={loadingMore ? undefined : <ExpandMoreIcon />}
            sx={{ minWidth: 200 }}
          >
            {loadingMore ? "Carregando..." : `Carregar mais (${loadedGroups} de ${totalGroups} ciclos)`}
          </Button>
        </Box>
      )}

      {!hasMore && visits.length > 0 && (
        <Typography variant="body2" color="text.secondary" sx={{ textAlign: "center", mt: 2, mb: 2 }}>
          {Object.keys(groups).length} ciclos carregados ({visits.length} visitas)
        </Typography>
      )}

      {/* MODAL DE RESUMO - MUI */}
      {summary?.open && (
        <Dialog
          open={summary.open}
          onClose={() => setSummary(null)}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              Resumo do Acompanhamento – {summary.header.clientName}
            </Typography>
            <IconButton onClick={() => setSummary(null)} size="small">
              <ClearIcon />
            </IconButton>
          </DialogTitle>

          <DialogContent dividers>
            <Box sx={{ mb: 2 }}>
              <Typography variant="body2"><strong>Fazenda:</strong> {summary.header.propertyName}</Typography>
              <Typography variant="body2"><strong>Talhão:</strong> {summary.header.plotName}</Typography>
              <Typography variant="body2"><strong>Cultura / Variedade:</strong> {summary.header.culture} {summary.header.variety}</Typography>
            </Box>

            <Stack spacing={1.5}>
              {summary.visits.map((v) => (
                <Paper
                  key={v.id}
                  variant="outlined"
                  sx={{
                    p: 2,
                    borderLeft: (v.photos?.length ?? 0) > 0 ? "4px solid" : "4px solid",
                    borderLeftColor: (v.photos?.length ?? 0) > 0 ? "success.main" : "grey.300",
                  }}
                >
                  <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                      {formatDateBR(v.date)}
                    </Typography>
                    {(v.photos?.length ?? 0) > 0 && (
                      <Button
                        size="small"
                        variant="outlined"
                        color="success"
                        onClick={() => {
                          setSummary(null);
                          setTimeout(() => {
                            setCarousel({ open: true, photos: v.photos || [] });
                          }, 150);
                        }}
                      >
                        Ver fotos
                      </Button>
                    )}
                  </Box>
                  <Typography variant="body2">{v.recommendation}</Typography>
                  {(v.photos?.length ?? 0) > 0 && (
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: "block" }}>
                      📸 {v.photos?.length} fotos
                    </Typography>
                  )}
                </Paper>
              ))}
            </Stack>
          </DialogContent>

          <DialogActions>
            <Button onClick={() => setSummary(null)} color="inherit">
              Fechar
            </Button>
          </DialogActions>
        </Dialog>
      )}

      {/* CARROSSEL DE FOTOS (STORIES) */}
      {carousel.open && (
        <PhotoCarousel
          photos={carousel.photos}
          onClose={() => setCarousel({ open: false, photos: [] })}
        />
      )}

      {/* MENU: Adicionar visita a este ciclo */}
      <Menu
        anchorEl={addCycleMenu.anchorEl}
        open={Boolean(addCycleMenu.anchorEl)}
        onClose={() => setAddCycleMenu({ anchorEl: null, cycleData: null })}
        anchorOrigin={{ vertical: "top", horizontal: "center" }}
        transformOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <MenuItem onClick={handleAddToCycleModal}>
          <ListItemIcon>
            <OpenInNewIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Abrir no modal</ListItemText>
        </MenuItem>
        <MenuItem onClick={handleAddToCycleAssistant}>
          <ListItemIcon>
            <ChatIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Abrir no assistente</ListItemText>
        </MenuItem>
      </Menu>
    </Box>
  );
};

export default Visits;
