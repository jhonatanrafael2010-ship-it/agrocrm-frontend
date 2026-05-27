import React, { useEffect, useState, useMemo } from "react";
import {
  Box,
  Typography,
  Paper,
  Card,
  CardContent,
  CardHeader,
  TextField,
  MenuItem,
  Chip,
  CircularProgress,
  Avatar,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Divider,
  Autocomplete,
  createFilterOptions,
  Tooltip,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import {
  Person as PersonIcon,
  Landscape as PropertyIcon,
  GridView as PlotIcon,
  Grass as CultureIcon,
  CalendarMonth as DateIcon,
  Link as LinkIcon,
  LinkOff as UnlinkIcon,
  Add as AddIcon,
  Warning as WarningIcon,
  CheckCircle as CheckIcon,
  DragIndicator as DragIcon,
  PhotoCamera as PhotoIcon,
  Delete as DeleteIcon,
} from "@mui/icons-material";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { API_BASE } from "../config";
import { fetchWithCache } from "../utils/offlineSync";
import { authFetch } from "../services/auth";
import { notify } from "../utils/toast";

type Client = { id: number; name: string };

const clientFilterOptions = createFilterOptions<Client>({
  matchFrom: "any",
  limit: 15,
});

type Property = { id: number; name: string; client_id: number };
type Plot = { id: number; name: string; property_id: number };
type Planting = {
  id: number;
  plot_id: number | null;
  culture: string | null;
  variety: string | null;
  planting_date: string | null;
};
type Photo = {
  id: number;
  url: string;
  thumbnail_url?: string;
};
type Visit = {
  id: number;
  client_id: number;
  property_id: number | null;
  plot_id: number | null;
  planting_id: number | null;
  date: string | null;
  culture: string | null;
  variety: string | null;
  fenologia_real: string | null;
  status: string | null;
  recommendation: string | null;
  photos?: Photo[];
};

const VisitLinking: React.FC = () => {
  const [clients, setClients] = useState<Client[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [plots, setPlots] = useState<Plot[]>([]);
  const [plantings, setPlantings] = useState<Planting[]>([]);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [selectedClient, setSelectedClient] = useState<string>("");
  const [selectedCulture, setSelectedCulture] = useState<string>("");

  const [newCycleOpen, setNewCycleOpen] = useState(false);
  const [newCycleForm, setNewCycleForm] = useState({
    culture: "",
    variety: "",
    planting_date: "",
    plot_id: "",
  });
  const [detailVisit, setDetailVisit] = useState<Visit | null>(null);
  const [deleteVisitConfirm, setDeleteVisitConfirm] = useState<Visit | null>(null);
  const [deleteCycleConfirm, setDeleteCycleConfirm] = useState<Planting | null>(null);

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  // Load data
  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetchWithCache(`${API_BASE}clients`, "clients"),
      fetchWithCache(`${API_BASE}properties`, "properties"),
      fetchWithCache(`${API_BASE}plots`, "plots"),
      fetchWithCache(`${API_BASE}plantings`, "plantings"),
      fetchWithCache(`${API_BASE}visits?scope=all`, "visits"),
    ])
      .then(([cs, ps, pls, pts, vs]) => {
        setClients(cs || []);
        setProperties(ps || []);
        setPlots(pls || []);
        setPlantings(pts || []);
        setVisits(vs || []);
      })
      .catch((err) => {
        console.error(err);
        notify.error("Erro ao carregar dados");
      })
      .finally(() => setLoading(false));
  }, []);

  // Helpers
  const getClientName = (id: number) => clients.find((c) => c.id === id)?.name || `Cliente ${id}`;
  const getPropertyName = (id: number | null) => {
    if (!id) return null;
    return properties.find((p) => p.id === id)?.name || null;
  };
  const getPlotName = (id: number | null) => {
    if (!id) return null;
    return plots.find((p) => p.id === id)?.name || null;
  };
  const getPlotProperty = (plotId: number | null) => {
    if (!plotId) return null;
    const plot = plots.find((p) => p.id === plotId);
    if (!plot) return null;
    return properties.find((p) => p.id === plot.property_id) || null;
  };

  // Filtered data
  const filteredVisits = useMemo(() => {
    if (!selectedClient) return [];
    let result = visits.filter((v) => v.client_id === Number(selectedClient));
    if (selectedCulture) {
      result = result.filter((v) => v.culture?.toLowerCase() === selectedCulture.toLowerCase());
    }
    return result;
  }, [visits, selectedClient, selectedCulture]);

  const clientPlantings = useMemo(() => {
    if (!selectedClient) return [];
    const clientPropertyIds = properties
      .filter((p) => p.client_id === Number(selectedClient))
      .map((p) => p.id);
    const clientPlotIds = plots
      .filter((p) => clientPropertyIds.includes(p.property_id))
      .map((p) => p.id);

    let result = plantings.filter((p) => p.plot_id && clientPlotIds.includes(p.plot_id));

    // Also include plantings that have visits from this client
    const plantingIdsFromVisits = new Set(
      filteredVisits.filter((v) => v.planting_id).map((v) => v.planting_id)
    );
    const additionalPlantings = plantings.filter(
      (p) => plantingIdsFromVisits.has(p.id) && !result.some((r) => r.id === p.id)
    );
    result = [...result, ...additionalPlantings];

    if (selectedCulture) {
      result = result.filter((p) => p.culture?.toLowerCase() === selectedCulture.toLowerCase());
    }

    return result;
  }, [plantings, plots, properties, selectedClient, selectedCulture, filteredVisits]);

  const orphanVisits = useMemo(() => {
    return filteredVisits.filter((v) => !v.planting_id);
  }, [filteredVisits]);

  const linkedVisitsByPlanting = useMemo(() => {
    const map: Record<number, Visit[]> = {};
    filteredVisits
      .filter((v) => v.planting_id)
      .forEach((v) => {
        if (!map[v.planting_id!]) map[v.planting_id!] = [];
        map[v.planting_id!].push(v);
      });
    // Sort visits by date within each planting
    Object.keys(map).forEach((key) => {
      map[Number(key)].sort((a, b) => (a.date || "").localeCompare(b.date || ""));
    });
    return map;
  }, [filteredVisits]);

  const cultures = useMemo(() => {
    const set = new Set<string>();
    filteredVisits.forEach((v) => {
      if (v.culture) set.add(v.culture);
    });
    return Array.from(set).sort();
  }, [filteredVisits]);

  const clientProperties = useMemo(() => {
    if (!selectedClient) return [];
    return properties.filter((p) => p.client_id === Number(selectedClient));
  }, [properties, selectedClient]);

  const clientPlots = useMemo(() => {
    const propIds = clientProperties.map((p) => p.id);
    return plots.filter((p) => propIds.includes(p.property_id));
  }, [plots, clientProperties]);

  // Drag & Drop
  async function onDragEnd(result: any) {
    const { source, destination, draggableId } = result;
    if (!destination) return;

    const visitId = Number(draggableId.replace("visit-", ""));
    const fromId = source.droppableId;
    const toId = destination.droppableId;

    if (fromId === toId) return;

    const newPlantingId = toId === "orphans" ? null : Number(toId.replace("planting-", ""));

    // Optimistic update
    setVisits((prev) =>
      prev.map((v) => (v.id === visitId ? { ...v, planting_id: newPlantingId } : v))
    );

    // Save to backend
    setSaving(true);
    try {
      const res = await authFetch(`${API_BASE}visits/${visitId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planting_id: newPlantingId }),
      });
      if (!res.ok) throw new Error("Falha ao salvar");
      notify.success(newPlantingId ? "Visita vinculada ao ciclo" : "Visita desvinculada");
    } catch (err) {
      // Revert on error
      setVisits((prev) =>
        prev.map((v) =>
          v.id === visitId ? { ...v, planting_id: fromId === "orphans" ? null : Number(fromId.replace("planting-", "")) } : v
        )
      );
      notify.error("Erro ao atualizar vínculo");
    } finally {
      setSaving(false);
    }
  }

  // Create new cycle
  async function handleCreateCycle() {
    if (!newCycleForm.culture) {
      notify.warning("Cultura é obrigatória");
      return;
    }
    setSaving(true);
    try {
      const res = await authFetch(`${API_BASE}plantings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plot_id: newCycleForm.plot_id ? Number(newCycleForm.plot_id) : null,
          culture: newCycleForm.culture,
          variety: newCycleForm.variety || null,
          planting_date: newCycleForm.planting_date || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Erro ao criar ciclo");

      const created = data.planting || data;
      setPlantings((prev) => [created, ...prev]);
      setNewCycleOpen(false);
      setNewCycleForm({ culture: "", variety: "", planting_date: "", plot_id: "" });
      notify.success("Ciclo criado com sucesso");
    } catch (err: any) {
      notify.error(err?.message || "Erro ao criar ciclo");
    } finally {
      setSaving(false);
    }
  }

  // Delete visit
  async function handleDeleteVisit() {
    if (!deleteVisitConfirm) return;
    setSaving(true);
    try {
      const res = await authFetch(`${API_BASE}visits/${deleteVisitConfirm.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Falha ao excluir");
      setVisits((prev) => prev.filter((v) => v.id !== deleteVisitConfirm.id));
      notify.success("Visita excluída");
      setDeleteVisitConfirm(null);
      setDetailVisit(null);
    } catch (err) {
      notify.error("Erro ao excluir visita");
    } finally {
      setSaving(false);
    }
  }

  // Delete cycle (planting)
  async function handleDeleteCycle() {
    if (!deleteCycleConfirm) return;
    const cycleVisits = linkedVisitsByPlanting[deleteCycleConfirm.id] || [];

    setSaving(true);
    try {
      // First unlink all visits from this cycle
      for (const visit of cycleVisits) {
        await authFetch(`${API_BASE}visits/${visit.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ planting_id: null }),
        });
      }

      // Then delete the cycle
      const res = await authFetch(`${API_BASE}plantings/${deleteCycleConfirm.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Falha ao excluir ciclo");

      // Update local state
      setPlantings((prev) => prev.filter((p) => p.id !== deleteCycleConfirm.id));
      setVisits((prev) =>
        prev.map((v) =>
          v.planting_id === deleteCycleConfirm.id ? { ...v, planting_id: null } : v
        )
      );
      notify.success("Ciclo excluído");
      setDeleteCycleConfirm(null);
    } catch (err) {
      notify.error("Erro ao excluir ciclo");
    } finally {
      setSaving(false);
    }
  }

  function formatDate(dateStr: string | null) {
    if (!dateStr) return null;
    const [y, m, d] = dateStr.split("-");
    return `${d}/${m}/${y}`;
  }

  // Build visit tooltip content
  function buildVisitTooltip(visit: Visit) {
    const propName = getPropertyName(visit.property_id);
    const plotName = getPlotName(visit.plot_id);
    const clientName = getClientName(visit.client_id);
    const photos = visit.photos || [];

    return (
      <Box sx={{ p: 1, maxWidth: 320 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
          Detalhes da Visita #{visit.id}
        </Typography>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
          <Typography variant="caption"><strong>Data:</strong> {formatDate(visit.date) || "Sem data"}</Typography>
          <Typography variant="caption"><strong>Cliente:</strong> {clientName}</Typography>
          {propName && <Typography variant="caption"><strong>Fazenda:</strong> {propName}</Typography>}
          {plotName && <Typography variant="caption"><strong>Talhão:</strong> {plotName}</Typography>}
          {visit.culture && <Typography variant="caption"><strong>Cultura:</strong> {visit.culture}</Typography>}
          {visit.variety && <Typography variant="caption"><strong>Variedade:</strong> {visit.variety}</Typography>}
          {visit.fenologia_real && <Typography variant="caption"><strong>Fenologia:</strong> {visit.fenologia_real}</Typography>}
          <Typography variant="caption"><strong>Status:</strong> {visit.status === "done" ? "Concluída" : "Planejada"}</Typography>
          {visit.recommendation && (
            <Typography variant="caption" sx={{ mt: 0.5 }}>
              <strong>Observação:</strong> {visit.recommendation.length > 100 ? visit.recommendation.slice(0, 100) + "..." : visit.recommendation}
            </Typography>
          )}
          {photos.length > 0 && (
            <Box sx={{ mt: 1 }}>
              <Typography variant="caption" sx={{ display: "flex", alignItems: "center", gap: 0.5, mb: 0.5 }}>
                <PhotoIcon sx={{ fontSize: 14 }} />
                <strong>{photos.length} foto{photos.length > 1 ? "s" : ""}</strong>
              </Typography>
              <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap" }}>
                {photos.slice(0, 4).map((photo, idx) => (
                  <Box
                    key={photo.id || idx}
                    component="img"
                    src={photo.thumbnail_url || photo.url}
                    alt={`Foto ${idx + 1}`}
                    sx={{
                      width: 50,
                      height: 50,
                      objectFit: "cover",
                      borderRadius: 1,
                      border: "1px solid",
                      borderColor: "divider",
                    }}
                  />
                ))}
                {photos.length > 4 && (
                  <Box
                    sx={{
                      width: 50,
                      height: 50,
                      borderRadius: 1,
                      bgcolor: "action.hover",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Typography variant="caption" sx={{ fontWeight: 600 }}>
                      +{photos.length - 4}
                    </Typography>
                  </Box>
                )}
              </Box>
            </Box>
          )}
        </Box>
      </Box>
    );
  }

  // Render visit card
  function renderVisitCard(visit: Visit, index: number) {
    const propName = getPropertyName(visit.property_id);
    const plotName = getPlotName(visit.plot_id);

    const cardContent = (
      <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1 }}>
        <Box sx={{ cursor: "grab", color: "text.secondary", mt: 0.5 }}>
          <DragIcon fontSize="small" />
        </Box>

        <Box
          sx={{ flex: 1, minWidth: 0, cursor: isMobile ? "pointer" : "default" }}
          onClick={isMobile ? () => setDetailVisit(visit) : undefined}
        >

          {/* Date & Status */}
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
            <DateIcon sx={{ fontSize: 16, color: "primary.main" }} />
            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
              {formatDate(visit.date) || "Sem data"}
            </Typography>
            {visit.status === "done" && (
              <Chip
                icon={<CheckIcon sx={{ fontSize: 14 }} />}
                label="Concluída"
                size="small"
                color="success"
                sx={{ height: 20, fontSize: "0.7rem" }}
              />
            )}
          </Box>

          {/* Culture & Variety */}
          {(visit.culture || visit.variety) && (
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mb: 0.5 }}>
              <CultureIcon sx={{ fontSize: 14, color: "success.main" }} />
              <Typography variant="caption" sx={{ fontWeight: 600, color: "success.main" }}>
                {visit.culture}
                {visit.variety && ` - ${visit.variety}`}
              </Typography>
            </Box>
          )}

          {/* Fenologia */}
          {visit.fenologia_real && (
            <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
              {visit.fenologia_real}
            </Typography>
          )}

          {/* Property & Plot */}
          {(propName || plotName) && (
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 0.5, flexWrap: "wrap" }}>
              {propName && (
                <Chip
                  icon={<PropertyIcon sx={{ fontSize: 12 }} />}
                  label={propName}
                  size="small"
                  variant="outlined"
                  sx={{ height: 18, fontSize: "0.65rem" }}
                />
              )}
              {plotName && (
                <Chip
                  icon={<PlotIcon sx={{ fontSize: 12 }} />}
                  label={plotName}
                  size="small"
                  variant="outlined"
                  sx={{ height: 18, fontSize: "0.65rem" }}
                />
              )}
            </Box>
          )}
        </Box>

        {/* Delete button */}
        <Tooltip title="Excluir visita" placement="top">
          <Box
            component="span"
            onClick={(e) => {
              e.stopPropagation();
              setDeleteVisitConfirm(visit);
            }}
            sx={{
              cursor: "pointer",
              color: "text.disabled",
              transition: "color 0.2s",
              "&:hover": { color: "error.main" },
              mt: 0.5,
            }}
          >
            <DeleteIcon sx={{ fontSize: 18 }} />
          </Box>
        </Tooltip>
      </Box>
    );

    return (
      <Draggable key={visit.id} draggableId={`visit-${visit.id}`} index={index}>
        {(provided, snapshot) => (
          <Tooltip
            title={!isMobile ? buildVisitTooltip(visit) : ""}
            placement="right"
            arrow
            enterDelay={300}
            disableHoverListener={isMobile}
            disableFocusListener={isMobile}
            disableTouchListener
          >
            <Paper
              ref={provided.innerRef}
              {...provided.draggableProps}
              {...provided.dragHandleProps}
              elevation={snapshot.isDragging ? 8 : 1}
              sx={{
                p: 1.5,
                mb: 1,
                borderRadius: 2,
                borderLeft: 4,
                borderColor: visit.status === "done" ? "success.main" : "warning.main",
                bgcolor: snapshot.isDragging ? "action.selected" : "background.paper",
                transition: "all 0.2s",
                "&:hover": {
                  boxShadow: 3,
                },
              }}
            >
              {cardContent}
            </Paper>
          </Tooltip>
        )}
      </Draggable>
    );
  }

  // Render planting column
  function renderPlantingColumn(planting: Planting) {
    const linkedVisits = linkedVisitsByPlanting[planting.id] || [];
    const plotProperty = getPlotProperty(planting.plot_id);
    const plotName = getPlotName(planting.plot_id);

    return (
      <Card
        key={planting.id}
        sx={{
          minWidth: 280,
          maxWidth: 320,
          flex: "0 0 auto",
          display: "flex",
          flexDirection: "column",
          borderRadius: 3,
          overflow: "hidden",
        }}
      >
        <CardHeader
          sx={{
            bgcolor: "success.main",
            color: "white",
            py: 1.5,
          }}
          action={
            <Tooltip title="Excluir ciclo">
              <Box
                component="span"
                onClick={() => setDeleteCycleConfirm(planting)}
                sx={{
                  cursor: "pointer",
                  color: "rgba(255,255,255,0.7)",
                  transition: "color 0.2s",
                  "&:hover": { color: "white" },
                  display: "flex",
                  alignItems: "center",
                  p: 0.5,
                }}
              >
                <DeleteIcon sx={{ fontSize: 20 }} />
              </Box>
            </Tooltip>
          }
          title={
            <Box>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
                <CultureIcon />
                <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                  {planting.culture || "Sem cultura"}
                </Typography>
              </Box>
              {planting.variety && (
                <Typography variant="caption" sx={{ opacity: 0.9 }}>
                  Variedade: <strong>{planting.variety}</strong>
                </Typography>
              )}
            </Box>
          }
          subheader={
            <Box sx={{ mt: 1 }}>
              {planting.planting_date && (
                <Chip
                  icon={<DateIcon sx={{ fontSize: 14, color: "white !important" }} />}
                  label={`Plantio: ${formatDate(planting.planting_date)}`}
                  size="small"
                  sx={{
                    bgcolor: "rgba(255,255,255,0.2)",
                    color: "white",
                    fontWeight: 600,
                    fontSize: "0.7rem",
                    mr: 0.5,
                    mb: 0.5,
                  }}
                />
              )}
              {plotProperty && (
                <Chip
                  icon={<PropertyIcon sx={{ fontSize: 14, color: "white !important" }} />}
                  label={plotProperty.name}
                  size="small"
                  sx={{
                    bgcolor: "rgba(255,255,255,0.2)",
                    color: "white",
                    fontSize: "0.7rem",
                    mr: 0.5,
                    mb: 0.5,
                  }}
                />
              )}
              {plotName && (
                <Chip
                  icon={<PlotIcon sx={{ fontSize: 14, color: "white !important" }} />}
                  label={plotName}
                  size="small"
                  sx={{
                    bgcolor: "rgba(255,255,255,0.2)",
                    color: "white",
                    fontSize: "0.7rem",
                    mb: 0.5,
                  }}
                />
              )}
            </Box>
          }
        />
        <Droppable droppableId={`planting-${planting.id}`}>
          {(provided, snapshot) => (
            <CardContent
              ref={provided.innerRef}
              {...provided.droppableProps}
              sx={{
                flex: 1,
                minHeight: 150,
                bgcolor: snapshot.isDraggingOver ? "success.light" : "background.default",
                transition: "background 0.2s",
                p: 1.5,
              }}
            >
              {linkedVisits.length === 0 && !snapshot.isDraggingOver && (
                <Box
                  sx={{
                    height: "100%",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "text.secondary",
                    py: 4,
                  }}
                >
                  <LinkIcon sx={{ fontSize: 32, opacity: 0.3, mb: 1 }} />
                  <Typography variant="caption">Arraste visitas aqui</Typography>
                </Box>
              )}
              {linkedVisits.map((v, idx) => renderVisitCard(v, idx))}
              {provided.placeholder}
            </CardContent>
          )}
        </Droppable>
        <Box sx={{ p: 1, bgcolor: "action.hover", textAlign: "center" }}>
          <Typography variant="caption" color="text.secondary">
            {linkedVisits.length} visita{linkedVisits.length !== 1 ? "s" : ""}
          </Typography>
        </Box>
      </Card>
    );
  }

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100%", p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* Header */}
      <Box sx={{ p: 2, borderBottom: 1, borderColor: "divider" }}>
        <Typography variant="h5" sx={{ fontWeight: 700, mb: 2 }}>
          <LinkIcon sx={{ mr: 1, verticalAlign: "middle" }} />
          Vincular Visitas aos Ciclos
        </Typography>

        {/* Filters */}
        <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", alignItems: "center" }}>
          <Autocomplete
            options={clients.slice().sort((a, b) => a.name.localeCompare(b.name))}
            filterOptions={clientFilterOptions}
            getOptionLabel={(option) => option.name}
            value={clients.find((c) => String(c.id) === selectedClient) || null}
            onChange={(_, newValue) => {
              setSelectedClient(newValue ? String(newValue.id) : "");
              setSelectedCulture("");
            }}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Cliente"
                placeholder="Digite para pesquisar..."
                size="small"
                required
              />
            )}
            renderOption={(props, option) => (
              <li {...props} key={option.id}>
                <PersonIcon sx={{ fontSize: 18, mr: 1, color: "primary.main" }} />
                {option.name}
              </li>
            )}
            sx={{ minWidth: 300 }}
            noOptionsText="Nenhum cliente encontrado"
            clearText="Limpar"
            openText="Abrir"
            closeText="Fechar"
          />

          {selectedClient && cultures.length > 0 && (
            <TextField
              select
              label="Filtrar por cultura"
              value={selectedCulture}
              onChange={(e) => setSelectedCulture(e.target.value)}
              size="small"
              sx={{ minWidth: 180 }}
            >
              <MenuItem value="">Todas as culturas</MenuItem>
              {cultures.map((c) => (
                <MenuItem key={c} value={c}>
                  <CultureIcon sx={{ fontSize: 18, mr: 1, color: "success.main" }} />
                  {c}
                </MenuItem>
              ))}
            </TextField>
          )}

          {selectedClient && (
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setNewCycleOpen(true)}
              sx={{ ml: "auto" }}
            >
              Novo Ciclo
            </Button>
          )}
        </Box>

        {/* Selected client info */}
        {selectedClient && (
          <Box sx={{ mt: 2, display: "flex", alignItems: "center", gap: 1 }}>
            <Avatar sx={{ bgcolor: "primary.main", width: 32, height: 32 }}>
              <PersonIcon sx={{ fontSize: 18 }} />
            </Avatar>
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
              {getClientName(Number(selectedClient))}
            </Typography>
            <Chip
              label={`${filteredVisits.length} visitas`}
              size="small"
              color="primary"
              variant="outlined"
            />
            {orphanVisits.length > 0 && (
              <Chip
                icon={<WarningIcon />}
                label={`${orphanVisits.length} sem vínculo`}
                size="small"
                color="warning"
              />
            )}
          </Box>
        )}
      </Box>

      {/* Content */}
      {!selectedClient ? (
        <Box
          sx={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexDirection: "column",
            color: "text.secondary",
          }}
        >
          <PersonIcon sx={{ fontSize: 64, opacity: 0.3, mb: 2 }} />
          <Typography variant="h6">Selecione um cliente para começar</Typography>
          <Typography variant="body2">
            Você poderá visualizar e vincular as visitas aos ciclos de cultivo
          </Typography>
        </Box>
      ) : (
        <DragDropContext onDragEnd={onDragEnd}>
          <Box sx={{ flex: 1, overflow: "auto", p: 2 }}>
            <Box
              sx={{
                display: "flex",
                gap: 2,
                alignItems: "flex-start",
                minHeight: "100%",
              }}
            >
              {/* Orphan visits column */}
              <Card
                sx={{
                  minWidth: 280,
                  maxWidth: 320,
                  flex: "0 0 auto",
                  display: "flex",
                  flexDirection: "column",
                  borderRadius: 3,
                  overflow: "hidden",
                  border: orphanVisits.length > 0 ? 2 : 1,
                  borderColor: orphanVisits.length > 0 ? "warning.main" : "divider",
                }}
              >
                <CardHeader
                  sx={{
                    bgcolor: orphanVisits.length > 0 ? "warning.main" : "grey.500",
                    color: "white",
                    py: 1.5,
                  }}
                  avatar={<UnlinkIcon />}
                  title={
                    <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                      Sem Vínculo
                    </Typography>
                  }
                  subheader={
                    <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.9)" }}>
                      Arraste para um ciclo
                    </Typography>
                  }
                />
                <Droppable droppableId="orphans">
                  {(provided, snapshot) => (
                    <CardContent
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      sx={{
                        flex: 1,
                        minHeight: 200,
                        bgcolor: snapshot.isDraggingOver ? "warning.light" : "background.default",
                        transition: "background 0.2s",
                        p: 1.5,
                      }}
                    >
                      {orphanVisits.length === 0 && !snapshot.isDraggingOver && (
                        <Box
                          sx={{
                            height: "100%",
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "text.secondary",
                            py: 4,
                          }}
                        >
                          <CheckIcon sx={{ fontSize: 32, color: "success.main", mb: 1 }} />
                          <Typography variant="caption">Todas vinculadas!</Typography>
                        </Box>
                      )}
                      {orphanVisits.map((v, idx) => renderVisitCard(v, idx))}
                      {provided.placeholder}
                    </CardContent>
                  )}
                </Droppable>
                <Box sx={{ p: 1, bgcolor: "action.hover", textAlign: "center" }}>
                  <Typography variant="caption" color="text.secondary">
                    {orphanVisits.length} visita{orphanVisits.length !== 1 ? "s" : ""}
                  </Typography>
                </Box>
              </Card>

              {/* Divider */}
              <Divider orientation="vertical" flexItem sx={{ mx: 1 }} />

              {/* Planting cycles */}
              {clientPlantings.length === 0 ? (
                <Box
                  sx={{
                    flex: 1,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexDirection: "column",
                    color: "text.secondary",
                    py: 4,
                  }}
                >
                  <CultureIcon sx={{ fontSize: 48, opacity: 0.3, mb: 2 }} />
                  <Typography variant="subtitle1">Nenhum ciclo encontrado</Typography>
                  <Typography variant="body2" sx={{ mb: 2 }}>
                    Crie um novo ciclo para vincular as visitas
                  </Typography>
                  <Button variant="outlined" startIcon={<AddIcon />} onClick={() => setNewCycleOpen(true)}>
                    Criar Ciclo
                  </Button>
                </Box>
              ) : (
                clientPlantings.map((p) => renderPlantingColumn(p))
              )}
            </Box>
          </Box>
        </DragDropContext>
      )}

      {/* Saving indicator */}
      {saving && (
        <Box
          sx={{
            position: "fixed",
            bottom: 100,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 1400,
          }}
        >
          <Chip
            icon={<CircularProgress size={16} color="inherit" />}
            label="Salvando..."
            color="primary"
          />
        </Box>
      )}

      {/* New Cycle Dialog */}
      <Dialog open={newCycleOpen} onClose={() => setNewCycleOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 600 }}>
          <AddIcon sx={{ mr: 1, verticalAlign: "middle" }} />
          Novo Ciclo de Cultivo
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 1 }}>
            <TextField
              label="Cultura"
              value={newCycleForm.culture}
              onChange={(e) => setNewCycleForm((f) => ({ ...f, culture: e.target.value }))}
              placeholder="Ex: Soja, Milho, Algodão..."
              required
              fullWidth
            />
            <TextField
              label="Variedade"
              value={newCycleForm.variety}
              onChange={(e) => setNewCycleForm((f) => ({ ...f, variety: e.target.value }))}
              placeholder="Ex: M8644, AG9025..."
              fullWidth
            />
            <TextField
              label="Data de Plantio"
              type="date"
              value={newCycleForm.planting_date}
              onChange={(e) => setNewCycleForm((f) => ({ ...f, planting_date: e.target.value }))}
              slotProps={{ inputLabel: { shrink: true } }}
              fullWidth
            />
            <TextField
              select
              label="Talhão (opcional)"
              value={newCycleForm.plot_id}
              onChange={(e) => setNewCycleForm((f) => ({ ...f, plot_id: e.target.value }))}
              fullWidth
            >
              <MenuItem value="">Nenhum</MenuItem>
              {clientPlots.map((p) => {
                const prop = properties.find((pr) => pr.id === plots.find((pl) => pl.id === p.id)?.property_id);
                return (
                  <MenuItem key={p.id} value={String(p.id)}>
                    {p.name}
                    {prop && ` (${prop.name})`}
                  </MenuItem>
                );
              })}
            </TextField>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setNewCycleOpen(false)} color="inherit">
            Cancelar
          </Button>
          <Button variant="contained" onClick={handleCreateCycle} disabled={saving || !newCycleForm.culture}>
            {saving ? "Criando..." : "Criar Ciclo"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Visit Detail Dialog (Mobile) */}
      <Dialog
        open={!!detailVisit}
        onClose={() => setDetailVisit(null)}
        maxWidth="sm"
        fullWidth
      >
        {detailVisit && (
          <>
            <DialogTitle sx={{ fontWeight: 600, display: "flex", alignItems: "center", gap: 1 }}>
              <DateIcon color="primary" />
              Visita #{detailVisit.id}
            </DialogTitle>
            <DialogContent>
              <Box sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 1 }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <Chip
                    label={detailVisit.status === "done" ? "Concluída" : "Planejada"}
                    color={detailVisit.status === "done" ? "success" : "warning"}
                    size="small"
                  />
                  <Typography variant="body2" color="text.secondary">
                    {formatDate(detailVisit.date) || "Sem data"}
                  </Typography>
                </Box>

                <Divider />

                <Box>
                  <Typography variant="caption" color="text.secondary">Cliente</Typography>
                  <Typography variant="body1" sx={{ fontWeight: 600 }}>
                    <PersonIcon sx={{ fontSize: 16, mr: 0.5, verticalAlign: "middle" }} />
                    {getClientName(detailVisit.client_id)}
                  </Typography>
                </Box>

                {getPropertyName(detailVisit.property_id) && (
                  <Box>
                    <Typography variant="caption" color="text.secondary">Fazenda</Typography>
                    <Typography variant="body1">
                      <PropertyIcon sx={{ fontSize: 16, mr: 0.5, verticalAlign: "middle" }} />
                      {getPropertyName(detailVisit.property_id)}
                    </Typography>
                  </Box>
                )}

                {getPlotName(detailVisit.plot_id) && (
                  <Box>
                    <Typography variant="caption" color="text.secondary">Talhão</Typography>
                    <Typography variant="body1">
                      <PlotIcon sx={{ fontSize: 16, mr: 0.5, verticalAlign: "middle" }} />
                      {getPlotName(detailVisit.plot_id)}
                    </Typography>
                  </Box>
                )}

                {(detailVisit.culture || detailVisit.variety) && (
                  <Box>
                    <Typography variant="caption" color="text.secondary">Cultura / Variedade</Typography>
                    <Typography variant="body1" sx={{ color: "success.main", fontWeight: 600 }}>
                      <CultureIcon sx={{ fontSize: 16, mr: 0.5, verticalAlign: "middle" }} />
                      {detailVisit.culture}
                      {detailVisit.variety && ` - ${detailVisit.variety}`}
                    </Typography>
                  </Box>
                )}

                {detailVisit.fenologia_real && (
                  <Box>
                    <Typography variant="caption" color="text.secondary">Fenologia</Typography>
                    <Typography variant="body1">{detailVisit.fenologia_real}</Typography>
                  </Box>
                )}

                {detailVisit.recommendation && (
                  <Box>
                    <Typography variant="caption" color="text.secondary">Observação</Typography>
                    <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>
                      {detailVisit.recommendation}
                    </Typography>
                  </Box>
                )}

                {(detailVisit.photos?.length ?? 0) > 0 && (
                  <Box>
                    <Typography variant="caption" color="text.secondary" sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                      <PhotoIcon sx={{ fontSize: 14 }} />
                      Fotos ({detailVisit.photos!.length})
                    </Typography>
                    <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", mt: 1 }}>
                      {detailVisit.photos!.map((photo, idx) => (
                        <Box
                          key={photo.id || idx}
                          component="img"
                          src={photo.thumbnail_url || photo.url}
                          alt={`Foto ${idx + 1}`}
                          onClick={() => window.open(photo.url, "_blank")}
                          sx={{
                            width: 80,
                            height: 80,
                            objectFit: "cover",
                            borderRadius: 2,
                            border: "2px solid",
                            borderColor: "divider",
                            cursor: "pointer",
                            transition: "transform 0.2s, box-shadow 0.2s",
                            "&:hover": {
                              transform: "scale(1.05)",
                              boxShadow: 3,
                            },
                          }}
                        />
                      ))}
                    </Box>
                  </Box>
                )}
              </Box>
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2, justifyContent: "space-between" }}>
              <Button
                onClick={() => setDeleteVisitConfirm(detailVisit)}
                color="error"
                startIcon={<DeleteIcon />}
              >
                Excluir
              </Button>
              <Button onClick={() => setDetailVisit(null)} variant="contained">
                Fechar
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>

      {/* Delete Visit Confirmation Dialog */}
      <Dialog
        open={!!deleteVisitConfirm}
        onClose={() => setDeleteVisitConfirm(null)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 600, color: "error.main", display: "flex", alignItems: "center", gap: 1 }}>
          <DeleteIcon />
          Excluir Visita
        </DialogTitle>
        <DialogContent>
          <Typography>
            Tem certeza que deseja excluir esta visita?
          </Typography>
          {deleteVisitConfirm && (
            <Box sx={{ mt: 2, p: 2, bgcolor: "action.hover", borderRadius: 2 }}>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {formatDate(deleteVisitConfirm.date) || "Sem data"}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {deleteVisitConfirm.culture}
                {deleteVisitConfirm.variety && ` - ${deleteVisitConfirm.variety}`}
              </Typography>
            </Box>
          )}
          <Typography variant="caption" color="error" sx={{ display: "block", mt: 2 }}>
            Esta ação não pode ser desfeita.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDeleteVisitConfirm(null)} color="inherit">
            Cancelar
          </Button>
          <Button
            onClick={handleDeleteVisit}
            variant="contained"
            color="error"
            disabled={saving}
          >
            {saving ? "Excluindo..." : "Excluir"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Cycle Confirmation Dialog */}
      <Dialog
        open={!!deleteCycleConfirm}
        onClose={() => setDeleteCycleConfirm(null)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 600, color: "error.main", display: "flex", alignItems: "center", gap: 1 }}>
          <DeleteIcon />
          Excluir Ciclo
        </DialogTitle>
        <DialogContent>
          <Typography>
            Tem certeza que deseja excluir este ciclo?
          </Typography>
          {deleteCycleConfirm && (
            <Box sx={{ mt: 2, p: 2, bgcolor: "action.hover", borderRadius: 2 }}>
              <Typography variant="body2" sx={{ fontWeight: 600, color: "success.main" }}>
                {deleteCycleConfirm.culture || "Sem cultura"}
                {deleteCycleConfirm.variety && ` - ${deleteCycleConfirm.variety}`}
              </Typography>
              {deleteCycleConfirm.planting_date && (
                <Typography variant="caption" color="text.secondary">
                  Plantio: {formatDate(deleteCycleConfirm.planting_date)}
                </Typography>
              )}
              {(linkedVisitsByPlanting[deleteCycleConfirm.id]?.length || 0) > 0 && (
                <Chip
                  label={`${linkedVisitsByPlanting[deleteCycleConfirm.id].length} visita(s) vinculada(s)`}
                  size="small"
                  color="warning"
                  sx={{ mt: 1 }}
                />
              )}
            </Box>
          )}
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 2 }}>
            As visitas vinculadas serão desvinculadas, mas não excluídas.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDeleteCycleConfirm(null)} color="inherit">
            Cancelar
          </Button>
          <Button
            onClick={handleDeleteCycle}
            variant="contained"
            color="error"
            disabled={saving}
          >
            {saving ? "Excluindo..." : "Excluir Ciclo"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default VisitLinking;
