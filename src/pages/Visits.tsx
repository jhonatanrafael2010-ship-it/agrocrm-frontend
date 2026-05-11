import React, { useEffect, useState } from "react";
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
  Collapse,
  Stack,
  Divider,
  Avatar,
  LinearProgress,
  Paper,
  InputAdornment,
  Tooltip,
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
  Search as SearchIcon,
} from "@mui/icons-material";
import { API_BASE } from "../config";
import { fetchWithCache, invalidateCache } from "../utils/offlineSync";
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

  // Carrossel de fotos (stories)
  const [carousel, setCarousel] = useState<{ open: boolean; photos: any[] }>({
    open: false,
    photos: [],
  });



  // ============================================================
  // 🔁 Carregar dados
  // ============================================================
  async function loadData() {
    setLoading(true);

    try {
      let vs: Visit[] = [];

      try {
        vs = (await fetchWithCache(`${API_BASE}visits?scope=all`, "visits")) as Visit[];
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
  

  async function handleDelete(id?: number) {
    if (!id) return;
    if (!confirm("Deseja excluir esta visita?")) return;

    const res = await fetch(`${API_BASE}visits/${id}`, { method: "DELETE" });

    if (res.ok) {
      invalidateCache(`${API_BASE}visits?scope=all`);
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
        if (selectedConsultant) {
          const consultantById = String(v.consultant_id || "") === selectedConsultant;

          const selectedConsultantName =
            consultants.find((c) => String(c.id) === selectedConsultant)?.name || "";

          const consultantByName =
            selectedConsultantName &&
            String(v.consultant_name || "").trim().toLowerCase() ===
              selectedConsultantName.trim().toLowerCase();

          if (!consultantById && !consultantByName) return false;
        }

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
          <TextField
            label="Cliente"
            size="small"
            value={clientSearch}
            onChange={(e) => setClientSearch(e.target.value)}
            placeholder="Buscar cliente..."
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                ),
              },
            }}
            sx={{ minWidth: 180 }}
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
              setClientSearch("");
              setFilterClient("");
              setFilterStart("");
              setFilterEnd("");
            }}
          >
            Limpar
          </Button>
        </Stack>

        {/* Autocomplete dropdown para cliente */}
        {clientSearch && (
          <Paper
            sx={{
              position: "absolute",
              zIndex: 10,
              mt: 1,
              maxHeight: 200,
              overflow: "auto",
              width: 200,
            }}
          >
            {clients
              .filter((c) => c.name.toLowerCase().includes(clientSearch.toLowerCase()))
              .slice(0, 10)
              .map((c) => (
                <MenuItem
                  key={c.id}
                  onClick={() => {
                    setFilterClient(String(c.id));
                    setClientSearch(c.name);
                  }}
                >
                  {c.name}
                </MenuItem>
              ))}
          </Paper>
        )}
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
                    onClick={() => {
                      // TODO: Abrir modal ou ir para assistente com contexto
                      alert("Em breve: adicionar visita a este ciclo");
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
                    <div className="d-flex justify-content-between align-items-center">
                      <strong>{formatDateBR(v.date)}</strong>

                      {(v.photos?.length ?? 0) > 0 && (
                        <button
                          className="btn btn-outline-success btn-sm"
                          style={{ padding: "2px 8px", fontSize: "0.75rem" }}
                          onClick={() => {
                            setSummary(null); // fecha o modal
                            setTimeout(() => {
                              setCarousel({
                                open: true,
                                photos: v.photos || [],
                              });
                            }, 150);
                          }}
                        >
                          Ver fotos
                        </button>
                      )}
                    </div>

                    <div>{v.recommendation}</div>

                    {(v.photos?.length ?? 0) > 0 && (
                      <div className="mt-1" style={{ fontSize: "0.8rem", opacity: 0.8 }}>
                        📸 {(v.photos?.length ?? 0)} fotos
                      </div>
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

      {/* CARROSSEL DE FOTOS (STORIES) */}
      {carousel.open && (
        <PhotoCarousel
          photos={carousel.photos}
          onClose={() => setCarousel({ open: false, photos: [] })}
        />
      )}
    </Box>
  );
};

export default Visits;
