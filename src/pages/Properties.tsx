import React, { useEffect, useState, useMemo } from "react";
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  Checkbox,
  FormControlLabel,
  CircularProgress,
  Alert,
  Grid,
  List,
  ListItemButton,
  ListItemText,
  Paper,
} from "@mui/material";
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  MyLocation as LocationIcon,
} from "@mui/icons-material";
import { API_BASE } from "../config";
import { fetchWithCache } from "../utils/offlineSync";
import { notify, confirm as toastConfirm } from "../utils/toast";

type Client = { id: number; name: string };
type Property = {
  id: number;
  client_id: number;
  name: string;
  city_state?: string | null;
  area_ha?: number | null;
  latitude?: number | null;
  longitude?: number | null;
};
type Plot = {
  id: number;
  property_id: number;
  name: string;
  area_ha?: number;
  irrigated?: boolean;
};
type Planting = {
  id: number;
  plot_id: number;
  culture?: string;
  variety?: string;
  planting_date?: string;
};

const Properties: React.FC = () => {
  const [clients, setClients] = useState<Client[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [plots, setPlots] = useState<Plot[]>([]);
  const [plantings, setPlantings] = useState<Planting[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [openProp, setOpenProp] = useState(false);
  const [openPlot, setOpenPlot] = useState(false);
  const [openPlanting, setOpenPlanting] = useState(false);
  const [editingProp, setEditingProp] = useState<Property | null>(null);

  const [propForm, setPropForm] = useState({
    client_id: "",
    name: "",
    city_state: "MT",
    area_ha: "",
    latitude: "",
    longitude: "",
  });

  const [clientSearch, setClientSearch] = useState("");
  const [showClientSuggestions, setShowClientSuggestions] = useState(false);

  const [plotForm, setPlotForm] = useState({
    property_id: "",
    name: "",
    area_ha: "",
    irrigated: false,
  });

  const [plantForm, setPlantForm] = useState({
    plot_id: "",
    culture: "",
    variety: "",
    planting_date: "",
  });

  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    Promise.all([
      fetchWithCache(`${API_BASE}clients`, "clients"),
      fetchWithCache(`${API_BASE}properties`, "properties"),
      fetchWithCache(`${API_BASE}plots`, "plots"),
      fetchWithCache(`${API_BASE}plantings`, "plantings"),
    ])
      .then(([cs, ps, pls, pts]) => {
        if (!mounted) return;
        setClients(cs || []);
        setProperties(ps || []);
        setPlots(pls || []);
        setPlantings(pts || []);
      })
      .catch((err) => {
        console.error(err);
        setError("Erro ao carregar dados");
      })
      .finally(() => setLoading(false));
    return () => {
      mounted = false;
    };
  }, []);

  const filteredClients = useMemo(() => {
    const q = clientSearch.trim().toLowerCase();
    const sorted = clients.slice().sort((a, b) => a.name.localeCompare(b.name));
    if (!q) return sorted.slice(0, 12);
    return sorted.filter((c) => c.name.toLowerCase().includes(q)).slice(0, 12);
  }, [clients, clientSearch]);

  async function fillCurrentLocation() {
    if (!navigator.geolocation) {
      notify.warning("Geolocalização não suportada neste dispositivo");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPropForm((f) => ({
          ...f,
          latitude: String(pos.coords.latitude),
          longitude: String(pos.coords.longitude),
        }));
        notify.success("Localização capturada");
      },
      (err) => {
        console.error(err);
        notify.error("Não consegui obter a localização atual");
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  }

  async function saveProperty() {
    if (!propForm.client_id || !propForm.name) {
      notify.warning("Cliente e nome são obrigatórios");
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        client_id: Number(propForm.client_id),
        name: propForm.name.trim(),
        city_state: propForm.city_state.trim() || "MT",
        area_ha: propForm.area_ha ? Number(propForm.area_ha) : null,
        latitude: propForm.latitude ? Number(propForm.latitude) : null,
        longitude: propForm.longitude ? Number(propForm.longitude) : null,
      };

      let res, body;
      if (editingProp) {
        res = await fetch(`${API_BASE}properties/${editingProp.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        body = await res.json();
        if (!res.ok) throw new Error(body.message || `status ${res.status}`);
        const updated = body.property || body;
        setProperties((p) => p.map((pr) => (pr.id === updated.id ? updated : pr)));
      } else {
        res = await fetch(`${API_BASE}properties`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        body = await res.json();
        if (!res.ok) throw new Error(body.message || `status ${res.status}`);
        const created = body.property || body;
        setProperties((p) => [created, ...p]);
      }

      closePropertyModal();
    } catch (err: any) {
      notify.error(err?.message || "Erro ao salvar propriedade");
    } finally {
      setSubmitting(false);
    }
  }

  async function createPlot() {
    if (!plotForm.property_id || !plotForm.name) {
      notify.warning("Propriedade e nome são obrigatórios");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}plots`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          property_id: Number(plotForm.property_id),
          name: plotForm.name,
          area_ha: plotForm.area_ha ? Number(plotForm.area_ha) : undefined,
          irrigated: plotForm.irrigated,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.message || `status ${res.status}`);
      const created = body.plot || body;
      setPlots((p) => [created, ...p]);
      setOpenPlot(false);
      setPlotForm({ property_id: "", name: "", area_ha: "", irrigated: false });
    } catch (err: any) {
      notify.error(err?.message || "Erro ao criar talhão");
    } finally {
      setSubmitting(false);
    }
  }

  async function createPlanting() {
    if (!plantForm.plot_id) {
      notify.warning("Talhão é obrigatório");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}plantings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plot_id: Number(plantForm.plot_id),
          culture: plantForm.culture || undefined,
          variety: plantForm.variety || undefined,
          planting_date: plantForm.planting_date || undefined,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.message || `status ${res.status}`);
      const created = body.planting || body;
      setPlantings((p) => [created, ...p]);
      setOpenPlanting(false);
      setPlantForm({ plot_id: "", culture: "", variety: "", planting_date: "" });
    } catch (err: any) {
      notify.error(err?.message || "Erro ao criar plantio");
    } finally {
      setSubmitting(false);
    }
  }

  function deleteEntity(
    id: number | undefined,
    endpoint: "properties" | "plots" | "plantings",
    setter: React.Dispatch<React.SetStateAction<any[]>>
  ) {
    if (!id) return;
    toastConfirm("Deseja excluir este registro?", async () => {
      try {
        const res = await fetch(`${API_BASE}${endpoint}/${id}`, { method: "DELETE" });
        if (!res.ok) throw new Error(`status ${res.status}`);
        setter((list) => list.filter((item: any) => item.id !== id));
      } catch (err: any) {
        notify.error(err?.message || "Erro ao excluir");
      }
    });
  }

  function closePropertyModal() {
    setOpenProp(false);
    setEditingProp(null);
    setClientSearch("");
    setShowClientSuggestions(false);
    setPropForm({
      client_id: "",
      name: "",
      city_state: "MT",
      area_ha: "",
      latitude: "",
      longitude: "",
    });
  }

  function openPropertyModal(prop?: Property) {
    if (prop) {
      setEditingProp(prop);
      const clientName = clients.find((c) => c.id === prop.client_id)?.name || "";
      setPropForm({
        client_id: String(prop.client_id),
        name: prop.name || "",
        city_state: prop.city_state || "MT",
        area_ha: prop.area_ha ? String(prop.area_ha) : "",
        latitude: prop.latitude != null ? String(prop.latitude) : "",
        longitude: prop.longitude != null ? String(prop.longitude) : "",
      });
      setClientSearch(clientName);
    } else {
      setEditingProp(null);
      setPropForm({
        client_id: "",
        name: "",
        city_state: "MT",
        area_ha: "",
        latitude: "",
        longitude: "",
      });
      setClientSearch("");
    }
    setShowClientSuggestions(false);
    setOpenProp(true);
  }

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 1400, mx: "auto" }}>
      {/* Header */}
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          mb: 3,
          flexWrap: "wrap",
          gap: 2,
        }}
      >
        <Typography variant="h4" sx={{ fontWeight: 700 }}>
          Propriedades & Talhões
        </Typography>
        <Box sx={{ display: "flex", gap: 1 }}>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => openPropertyModal()}
            sx={{ textTransform: "none", fontWeight: 600 }}
          >
            Nova Propriedade
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setOpenPlot(true)}
            sx={{ textTransform: "none", fontWeight: 600 }}
          >
            Novo Talhão
          </Button>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
          <CircularProgress />
        </Box>
      ) : (
        <>
          <Grid container spacing={3}>
            {/* Properties Table */}
            <Grid size={{ xs: 12, lg: 6 }}>
              <Card>
                <CardContent>
                  <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                    Propriedades
                  </Typography>
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell sx={{ fontWeight: 600 }}>Cliente</TableCell>
                          <TableCell sx={{ fontWeight: 600 }}>Propriedade</TableCell>
                          <TableCell sx={{ fontWeight: 600 }}>Cidade/UF</TableCell>
                          <TableCell sx={{ fontWeight: 600 }}>Área</TableCell>
                          <TableCell align="right"></TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {properties.map((p) => (
                          <TableRow key={p.id} hover>
                            <TableCell>
                              {clients.find((c) => c.id === p.client_id)?.name ?? p.client_id}
                            </TableCell>
                            <TableCell sx={{ fontWeight: 500 }}>{p.name}</TableCell>
                            <TableCell>{p.city_state ?? "--"}</TableCell>
                            <TableCell>{p.area_ha ?? "--"}</TableCell>
                            <TableCell align="right">
                              <IconButton
                                size="small"
                                color="primary"
                                onClick={() => openPropertyModal(p)}
                              >
                                <EditIcon fontSize="small" />
                              </IconButton>
                              <IconButton
                                size="small"
                                color="error"
                                onClick={() => deleteEntity(p.id, "properties", setProperties)}
                              >
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </TableCell>
                          </TableRow>
                        ))}
                        {properties.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={5} align="center" sx={{ py: 4 }}>
                              <Typography color="text.secondary">
                                Nenhuma propriedade cadastrada
                              </Typography>
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </CardContent>
              </Card>
            </Grid>

            {/* Plots Table */}
            <Grid size={{ xs: 12, lg: 6 }}>
              <Card>
                <CardContent>
                  <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                    Talhões
                  </Typography>
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell sx={{ fontWeight: 600 }}>Fazenda</TableCell>
                          <TableCell sx={{ fontWeight: 600 }}>Talhão</TableCell>
                          <TableCell sx={{ fontWeight: 600 }}>Área</TableCell>
                          <TableCell sx={{ fontWeight: 600 }}>Irrig.</TableCell>
                          <TableCell align="right"></TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {plots.map((pl) => (
                          <TableRow key={pl.id} hover>
                            <TableCell>
                              {properties.find((pp) => pp.id === pl.property_id)?.name ?? pl.property_id}
                            </TableCell>
                            <TableCell sx={{ fontWeight: 500 }}>{pl.name}</TableCell>
                            <TableCell>{pl.area_ha ?? "--"}</TableCell>
                            <TableCell>{pl.irrigated ? "Sim" : "—"}</TableCell>
                            <TableCell align="right">
                              <IconButton
                                size="small"
                                color="error"
                                onClick={() => deleteEntity(pl.id, "plots", setPlots)}
                              >
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </TableCell>
                          </TableRow>
                        ))}
                        {plots.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={5} align="center" sx={{ py: 4 }}>
                              <Typography color="text.secondary">
                                Nenhum talhão cadastrado
                              </Typography>
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* Plantings Table */}
          <Card sx={{ mt: 3 }}>
            <CardContent>
              <Box
                sx={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  mb: 2,
                }}
              >
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                  Plantios
                </Typography>
                <Button
                  variant="contained"
                  size="small"
                  startIcon={<AddIcon />}
                  onClick={() => setOpenPlanting(true)}
                  sx={{ textTransform: "none", fontWeight: 600 }}
                >
                  Novo Plantio
                </Button>
              </Box>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 600 }}>Talhão</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Cultura</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Variedade</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Plantio</TableCell>
                      <TableCell align="right"></TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {plantings.map((pt) => (
                      <TableRow key={pt.id} hover>
                        <TableCell>
                          {plots.find((pl) => pl.id === pt.plot_id)?.name ?? pt.plot_id}
                        </TableCell>
                        <TableCell>{pt.culture ?? "--"}</TableCell>
                        <TableCell>{pt.variety ?? "--"}</TableCell>
                        <TableCell>{pt.planting_date ?? "--"}</TableCell>
                        <TableCell align="right">
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => deleteEntity(pt.id, "plantings", setPlantings)}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                    {plantings.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} align="center" sx={{ py: 4 }}>
                          <Typography color="text.secondary">
                            Nenhum plantio cadastrado
                          </Typography>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </>
      )}

      {/* Property Modal */}
      <Dialog
        open={openProp}
        onClose={closePropertyModal}
        maxWidth="sm"
        fullWidth
        slotProps={{ paper: { sx: { borderRadius: 3 } } }}
      >
        <DialogTitle sx={{ fontWeight: 600 }}>
          {editingProp ? "Editar Propriedade" : "Nova Propriedade"}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 1 }}>
            <Box sx={{ position: "relative" }}>
              <TextField
                label="Cliente"
                value={clientSearch}
                onChange={(e) => {
                  setClientSearch(e.target.value);
                  setShowClientSuggestions(true);
                  setPropForm((f) => ({ ...f, client_id: "" }));
                }}
                onFocus={() => setShowClientSuggestions(true)}
                placeholder="Digite o nome do cliente"
                fullWidth
                error={!propForm.client_id && clientSearch.length > 0}
                helperText={
                  propForm.client_id
                    ? `Cliente selecionado: ${clientSearch}`
                    : "Selecione um cliente da lista"
                }
                color={propForm.client_id ? "success" : undefined}
              />
              {showClientSuggestions && (
                <Paper
                  sx={{
                    position: "absolute",
                    top: "100%",
                    left: 0,
                    right: 0,
                    zIndex: 10,
                    maxHeight: 220,
                    overflow: "auto",
                    mt: 0.5,
                  }}
                  elevation={4}
                >
                  <List disablePadding>
                    {filteredClients.length > 0 ? (
                      filteredClients.map((c) => (
                        <ListItemButton
                          key={c.id}
                          onClick={() => {
                            setPropForm((f) => ({ ...f, client_id: String(c.id) }));
                            setClientSearch(c.name);
                            setShowClientSuggestions(false);
                          }}
                        >
                          <ListItemText primary={c.name} />
                        </ListItemButton>
                      ))
                    ) : (
                      <ListItemButton disabled>
                        <ListItemText primary="Nenhum cliente encontrado" />
                      </ListItemButton>
                    )}
                  </List>
                </Paper>
              )}
            </Box>

            <TextField
              label="Nome"
              value={propForm.name}
              onChange={(e) => setPropForm((f) => ({ ...f, name: e.target.value }))}
              fullWidth
              required
            />
            <TextField
              label="Cidade/UF"
              value={propForm.city_state}
              onChange={(e) => setPropForm((f) => ({ ...f, city_state: e.target.value }))}
              fullWidth
            />
            <Grid container spacing={2}>
              <Grid size={{ xs: 6 }}>
                <TextField
                  label="Latitude"
                  value={propForm.latitude}
                  onChange={(e) => setPropForm((f) => ({ ...f, latitude: e.target.value }))}
                  placeholder="-13.0581"
                  fullWidth
                />
              </Grid>
              <Grid size={{ xs: 6 }}>
                <TextField
                  label="Longitude"
                  value={propForm.longitude}
                  onChange={(e) => setPropForm((f) => ({ ...f, longitude: e.target.value }))}
                  placeholder="-55.9172"
                  fullWidth
                />
              </Grid>
            </Grid>
            <Button
              variant="outlined"
              startIcon={<LocationIcon />}
              onClick={fillCurrentLocation}
              sx={{ alignSelf: "flex-start" }}
            >
              Usar localização atual
            </Button>
            <TextField
              label="Área (ha)"
              value={propForm.area_ha}
              onChange={(e) => setPropForm((f) => ({ ...f, area_ha: e.target.value }))}
              fullWidth
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={closePropertyModal} color="inherit">
            Cancelar
          </Button>
          <Button variant="contained" onClick={saveProperty} disabled={submitting}>
            {submitting ? "Salvando..." : "Salvar"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Plot Modal */}
      <Dialog
        open={openPlot}
        onClose={() => setOpenPlot(false)}
        maxWidth="sm"
        fullWidth
        slotProps={{ paper: { sx: { borderRadius: 3 } } }}
      >
        <DialogTitle sx={{ fontWeight: 600 }}>Novo Talhão</DialogTitle>
        <DialogContent>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 1 }}>
            <TextField
              select
              label="Propriedade"
              value={plotForm.property_id}
              onChange={(e) => setPlotForm((f) => ({ ...f, property_id: e.target.value }))}
              fullWidth
              required
            >
              <MenuItem value="">Selecione uma propriedade</MenuItem>
              {properties
                .slice()
                .sort((a, b) => a.name.localeCompare(b.name))
                .map((p) => (
                  <MenuItem key={p.id} value={String(p.id)}>
                    {p.name}
                  </MenuItem>
                ))}
            </TextField>
            <TextField
              label="Nome"
              value={plotForm.name}
              onChange={(e) => setPlotForm((f) => ({ ...f, name: e.target.value }))}
              fullWidth
              required
            />
            <TextField
              label="Área (ha)"
              value={plotForm.area_ha}
              onChange={(e) => setPlotForm((f) => ({ ...f, area_ha: e.target.value }))}
              fullWidth
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={plotForm.irrigated}
                  onChange={(e) => setPlotForm((f) => ({ ...f, irrigated: e.target.checked }))}
                />
              }
              label="Irrigado"
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setOpenPlot(false)} color="inherit">
            Cancelar
          </Button>
          <Button variant="contained" onClick={createPlot} disabled={submitting}>
            {submitting ? "Salvando..." : "Salvar"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Planting Modal */}
      <Dialog
        open={openPlanting}
        onClose={() => setOpenPlanting(false)}
        maxWidth="sm"
        fullWidth
        slotProps={{ paper: { sx: { borderRadius: 3 } } }}
      >
        <DialogTitle sx={{ fontWeight: 600 }}>Novo Plantio</DialogTitle>
        <DialogContent>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 1 }}>
            <TextField
              select
              label="Talhão"
              value={plantForm.plot_id}
              onChange={(e) => setPlantForm((f) => ({ ...f, plot_id: e.target.value }))}
              fullWidth
              required
            >
              <MenuItem value="">Selecione um talhão</MenuItem>
              {plots
                .slice()
                .sort((a, b) => a.name.localeCompare(b.name))
                .map((p) => (
                  <MenuItem key={p.id} value={String(p.id)}>
                    {p.name}
                  </MenuItem>
                ))}
            </TextField>
            <TextField
              label="Cultura"
              value={plantForm.culture}
              onChange={(e) => setPlantForm((f) => ({ ...f, culture: e.target.value }))}
              fullWidth
            />
            <TextField
              label="Variedade"
              value={plantForm.variety}
              onChange={(e) => setPlantForm((f) => ({ ...f, variety: e.target.value }))}
              fullWidth
            />
            <TextField
              label="Data plantio"
              type="date"
              value={plantForm.planting_date}
              onChange={(e) => setPlantForm((f) => ({ ...f, planting_date: e.target.value }))}
              fullWidth
              slotProps={{ inputLabel: { shrink: true } }}
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setOpenPlanting(false)} color="inherit">
            Cancelar
          </Button>
          <Button variant="contained" onClick={createPlanting} disabled={submitting}>
            {submitting ? "Salvando..." : "Salvar"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Properties;
