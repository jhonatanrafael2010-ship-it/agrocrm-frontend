import React, { useEffect, useState } from "react";
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
  CircularProgress,
  Alert,
} from "@mui/material";
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
} from "@mui/icons-material";
import { API_BASE } from "../config";
import { fetchWithCache } from "../utils/offlineSync";
import { notify, confirm as toastConfirm } from "../utils/toast";

type Plot = { id: number; name: string };
type Variety = { id: number; culture: string; name: string };
type Planting = {
  id: number;
  plot_id: number;
  culture?: string;
  variety?: string;
  planting_date?: string;
};

const CULTURES = ["Milho", "Soja", "Algodão"];

const PlantingsPage: React.FC = () => {
  const [plots, setPlots] = useState<Plot[]>([]);
  const [plantings, setPlantings] = useState<Planting[]>([]);
  const [varieties, setVarieties] = useState<Variety[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [openDialog, setOpenDialog] = useState(false);
  const [editing, setEditing] = useState<Planting | null>(null);
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
      fetchWithCache(`${API_BASE}plots`, "plots"),
      fetchWithCache(`${API_BASE}plantings`, "plantings"),
      fetch(`${API_BASE}varieties`)
        .then((r) => (r.ok ? r.json() : []))
        .catch(() => []),
    ])
      .then(([pls, pts, vars]) => {
        if (!mounted) return;
        setPlots(pls || []);
        setPlantings(pts || []);
        setVarieties(Array.isArray(vars) ? vars : []);
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

  const filteredVarieties = varieties.filter(
    (v) => v.culture.toLowerCase() === (plantForm.culture || "").toLowerCase()
  );

  function openPlantingModal(planting?: Planting) {
    if (planting) {
      setEditing(planting);
      setPlantForm({
        plot_id: planting.plot_id ? String(planting.plot_id) : "",
        culture: planting.culture || "",
        variety: planting.variety || "",
        planting_date: planting.planting_date || "",
      });
    } else {
      setEditing(null);
      setPlantForm({ plot_id: "", culture: "", variety: "", planting_date: "" });
    }
    setOpenDialog(true);
  }

  function closeDialog() {
    setOpenDialog(false);
    setEditing(null);
    setPlantForm({ plot_id: "", culture: "", variety: "", planting_date: "" });
  }

  async function handleSave() {
    if (!plantForm.plot_id) {
      notify.warning("Talhão é obrigatório");
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        plot_id: Number(plantForm.plot_id),
        culture: plantForm.culture || undefined,
        variety: plantForm.variety || undefined,
        planting_date: plantForm.planting_date || undefined,
      };

      let res, body;
      if (editing) {
        res = await fetch(`${API_BASE}plantings/${editing.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        body = await res.json();
        if (!res.ok) throw new Error(body.message || `status ${res.status}`);
        const updated = body.planting || body;
        setPlantings((p) => p.map((pt) => (pt.id === updated.id ? updated : pt)));
        notify.success("Plantio atualizado");
      } else {
        res = await fetch(`${API_BASE}plantings`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        body = await res.json();
        if (!res.ok) throw new Error(body.message || `status ${res.status}`);
        const created = body.planting || body;
        setPlantings((p) => [created, ...p]);
        notify.success("Plantio criado");
      }
      closeDialog();
    } catch (err: any) {
      notify.error(err?.message || "Erro ao salvar plantio");
    } finally {
      setSubmitting(false);
    }
  }

  function deletePlanting(id?: number) {
    if (!id) return;
    toastConfirm("Deseja excluir este plantio?", async () => {
      try {
        const res = await fetch(`${API_BASE}plantings/${id}`, { method: "DELETE" });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.message || `status ${res.status}`);
        }
        setPlantings((list) => list.filter((p) => p.id !== id));
        notify.success("Plantio excluído");
      } catch (err: any) {
        notify.error(err?.message || "Erro ao excluir plantio");
      }
    });
  }

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 1200, mx: "auto" }}>
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
          Plantios
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => openPlantingModal()}
          sx={{ textTransform: "none", fontWeight: 600 }}
        >
          Novo Plantio
        </Button>
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
        <Card>
          <CardContent>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 600 }}>Talhão</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Cultura</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Variedade</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Data Plantio</TableCell>
                    <TableCell align="right"></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {plantings.map((pt) => (
                    <TableRow key={pt.id} hover>
                      <TableCell>
                        {plots.find((pl) => pl.id === pt.plot_id)?.name ?? pt.plot_id}
                      </TableCell>
                      <TableCell sx={{ fontWeight: 500 }}>{pt.culture ?? "--"}</TableCell>
                      <TableCell>{pt.variety ?? "--"}</TableCell>
                      <TableCell>{pt.planting_date ?? "--"}</TableCell>
                      <TableCell align="right">
                        <IconButton
                          size="small"
                          color="primary"
                          onClick={() => openPlantingModal(pt)}
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => deletePlanting(pt.id)}
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
      )}

      {/* Planting Modal */}
      <Dialog
        open={openDialog}
        onClose={closeDialog}
        maxWidth="sm"
        fullWidth
        slotProps={{ paper: { sx: { borderRadius: 3 } } }}
      >
        <DialogTitle sx={{ fontWeight: 600 }}>
          {editing ? "Editar Plantio" : "Novo Plantio"}
        </DialogTitle>
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
              select
              label="Cultura"
              value={plantForm.culture}
              onChange={(e) =>
                setPlantForm((f) => ({ ...f, culture: e.target.value, variety: "" }))
              }
              fullWidth
            >
              <MenuItem value="">Selecione</MenuItem>
              {CULTURES.map((c) => (
                <MenuItem key={c} value={c}>
                  {c}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label="Variedade"
              value={plantForm.variety}
              onChange={(e) => setPlantForm((f) => ({ ...f, variety: e.target.value }))}
              fullWidth
              disabled={!plantForm.culture}
            >
              <MenuItem value="">Selecione a variedade</MenuItem>
              {filteredVarieties.map((v) => (
                <MenuItem key={v.id} value={v.name}>
                  {v.name}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="Data plantio"
              type="date"
              value={plantForm.planting_date}
              onChange={(e) =>
                setPlantForm((f) => ({ ...f, planting_date: e.target.value }))
              }
              fullWidth
              slotProps={{ inputLabel: { shrink: true } }}
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={closeDialog} color="inherit">
            Cancelar
          </Button>
          <Button variant="contained" onClick={handleSave} disabled={submitting}>
            {submitting ? "Salvando..." : "Salvar"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default PlantingsPage;
