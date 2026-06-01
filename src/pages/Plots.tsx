import React, { useEffect, useState } from "react";
import {
  Box,
  Typography,
  Button,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  FormControlLabel,
  Checkbox,
  IconButton,
  Chip,
} from "@mui/material";
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Grass as GrassIcon,
  Close as CloseIcon,
} from "@mui/icons-material";
import { API_BASE } from "../config";
import { notify, confirm as toastConfirm } from "../utils/toast";

type Property = { id: number; name: string };
type Plot = {
  id: number;
  property_id: number;
  name: string;
  area_ha?: number;
  irrigated?: boolean;
};

const Plots: React.FC = () => {
  const [properties, setProperties] = useState<Property[]>([]);
  const [plots, setPlots] = useState<Plot[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    property_id: "",
    name: "",
    area_ha: "",
    irrigated: false,
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let mounted = true;
    Promise.all([
      fetch(`${API_BASE}properties`).then((r) => (r.ok ? r.json() : [])),
      fetch(`${API_BASE}plots`).then((r) => (r.ok ? r.json() : [])),
    ])
      .then(([ps, pls]) => {
        if (!mounted) return;
        setProperties(ps || []);
        setPlots(pls || []);
      })
      .catch(console.error);
    return () => {
      mounted = false;
    };
  }, []);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const { name, value, type, checked } = e.target;
    setForm((f) => ({ ...f, [name]: type === "checkbox" ? checked : value }));
  }

  async function createPlot() {
    if (!form.property_id || !form.name) {
      notify.warning("Propriedade e nome são obrigatórios");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}plots`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          property_id: Number(form.property_id),
          name: form.name,
          area_ha: form.area_ha ? Number(form.area_ha) : undefined,
          irrigated: form.irrigated,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.message || `status ${res.status}`);
      const created = body.plot || body;
      setPlots((p) => [created, ...p]);
      setOpen(false);
      setForm({ property_id: "", name: "", area_ha: "", irrigated: false });
    } catch (err: any) {
      notify.error(err?.message || "Erro ao criar talhão");
    } finally {
      setSubmitting(false);
    }
  }

  function deletePlot(id?: number) {
    if (!id) return;
    toastConfirm("Deseja excluir este talhão?", async () => {
      try {
        const res = await fetch(`${API_BASE}plots/${id}`, { method: "DELETE" });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.message || `status ${res.status}`);
        }
        setPlots((list) => list.filter((p) => p.id !== id));
        notify.success("Talhão excluído");
      } catch (err: any) {
        notify.error(err?.message || "Erro ao excluir talhão");
      }
    });
  }

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 1200, mx: "auto" }}>
      {/* Header */}
      <Box sx={{ mb: 3, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700, display: "flex", alignItems: "center", gap: 1 }}>
            <GrassIcon color="primary" />
            Talhões
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Gerencie os talhões das propriedades
          </Typography>
        </Box>
        <Button
          variant="contained"
          color="success"
          startIcon={<AddIcon />}
          onClick={() => setOpen(true)}
        >
          Novo Talhão
        </Button>
      </Box>

      {/* Tabela */}
      <TableContainer component={Paper} elevation={0}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 600 }}>Fazenda</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Talhão</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Área (ha)</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Irrigado</TableCell>
              <TableCell align="right" sx={{ fontWeight: 600 }}>Ações</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {plots.map((pl) => (
              <TableRow key={pl.id} hover>
                <TableCell>
                  {properties.find((pp) => pp.id === pl.property_id)?.name ?? pl.property_id}
                </TableCell>
                <TableCell>{pl.name}</TableCell>
                <TableCell>{pl.area_ha ?? "—"}</TableCell>
                <TableCell>
                  {pl.irrigated ? (
                    <Chip label="Sim" color="info" size="small" />
                  ) : (
                    "—"
                  )}
                </TableCell>
                <TableCell align="right">
                  <IconButton
                    size="small"
                    color="error"
                    onClick={() => deletePlot(pl.id)}
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

      {/* Modal de Cadastro */}
      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            Novo Talhão
          </Typography>
          <IconButton onClick={() => setOpen(false)} size="small">
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          <TextField
            select
            fullWidth
            label="Propriedade"
            name="property_id"
            value={form.property_id}
            onChange={handleChange}
            sx={{ mb: 2 }}
          >
            <MenuItem value="">Selecione uma propriedade</MenuItem>
            {properties.map((p) => (
              <MenuItem key={p.id} value={String(p.id)}>
                {p.name}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            fullWidth
            label="Nome do Talhão"
            name="name"
            value={form.name}
            onChange={handleChange}
            sx={{ mb: 2 }}
          />

          <TextField
            fullWidth
            label="Área (ha)"
            name="area_ha"
            type="number"
            value={form.area_ha}
            onChange={handleChange}
            sx={{ mb: 2 }}
          />

          <FormControlLabel
            control={
              <Checkbox
                name="irrigated"
                checked={form.irrigated}
                onChange={handleChange}
              />
            }
            label="Irrigado"
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setOpen(false)} color="inherit">
            Cancelar
          </Button>
          <Button
            variant="contained"
            color="success"
            onClick={createPlot}
            disabled={submitting}
          >
            {submitting ? "Salvando..." : "Salvar"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Plots;
