import React, { useEffect, useState } from "react";
import {
  Box,
  Typography,
  Button,
  Card,
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
  Chip,
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

type Client = {
  id: number;
  name: string;
  document?: string;
  segment: string;
  vendor?: string;
  region?: string;
};

const Clients: React.FC = () => {
  const [clients, setClients] = useState<Client[]>([]);
  const [regions, setRegions] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Client | null>(null);
  const [form, setForm] = useState({
    name: "",
    document: "",
    segment: "",
    vendor: "",
    region: "",
  });

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetchWithCache(`${API_BASE}clients`, "clients"),
      fetchWithCache(`${API_BASE}regions`, "cultures"),
    ])
      .then(([cs, rs]) => {
        setClients(cs as any[]);
        setRegions(Array.isArray(rs) ? (rs as any[]) : []);
      })
      .catch((err) => {
        console.error("fetch clients/regions err", err);
        setError("Erro ao carregar clientes");
      })
      .finally(() => setLoading(false));
  }, []);

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  }

  async function handleSave() {
    if (!form.name.trim()) {
      notify.warning("Nome é obrigatório");
      return;
    }
    setSubmitting(true);
    try {
      const method = editing ? "PUT" : "POST";
      const url = editing
        ? `${API_BASE}clients/${editing.id}`
        : `${API_BASE}clients`;

      const payload = {
        ...form,
        region: form.region || null,
      };

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.message || `status ${res.status}`);

      const client: Client = body.client || body;
      setClients((c) =>
        editing
          ? c.map((cl) => (cl.id === client.id ? client : cl))
          : [client, ...c]
      );
      setOpen(false);
      setEditing(null);
      setForm({ name: "", document: "", segment: "", vendor: "", region: "" });
    } catch (err: any) {
      notify.error(err?.message || "Erro ao salvar cliente");
    } finally {
      setSubmitting(false);
    }
  }

  function handleDelete(id?: number) {
    if (!id) return;
    toastConfirm("Tem certeza que deseja excluir este cliente?", async () => {
      try {
        const res = await fetch(`${API_BASE}clients/${id}`, {
          method: "DELETE",
        });
        if (!res.ok) throw new Error(`Status ${res.status}`);
        setClients((list) => list.filter((c) => c.id !== id));
      } catch (err: any) {
        notify.error(err?.message || "Erro ao excluir cliente");
      }
    });
  }

  function openModal(client?: Client) {
    setOpen(true);
    if (client) {
      setEditing(client);
      setForm({
        name: client.name || "",
        document: client.document || "",
        segment: client.segment || "",
        vendor: client.vendor || "",
        region: client.region || "",
      });
    } else {
      setEditing(null);
      setForm({ name: "", document: "", segment: "", vendor: "", region: "" });
    }
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
        }}
      >
        <Typography variant="h4" sx={{ fontWeight: 700 }}>
          Clientes
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => openModal()}
          sx={{ textTransform: "none", fontWeight: 600 }}
        >
          Novo Cliente
        </Button>
      </Box>

      {/* Content */}
      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
          <CircularProgress />
        </Box>
      ) : error ? (
        <Alert severity="error">{error}</Alert>
      ) : (
        <Card>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600 }}>Nome</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Documento</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Segmento</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Vendedor</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Região</TableCell>
                  <TableCell sx={{ fontWeight: 600 }} align="right">
                    Ações
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {clients.map((c) => (
                  <TableRow key={c.id} hover>
                    <TableCell sx={{ fontWeight: 500 }}>{c.name}</TableCell>
                    <TableCell>{c.document || "--"}</TableCell>
                    <TableCell>{c.segment || "--"}</TableCell>
                    <TableCell>{c.vendor || "--"}</TableCell>
                    <TableCell>
                      {c.region ? (
                        <Chip
                          label={c.region}
                          size="small"
                          color="success"
                          sx={{ fontWeight: 600 }}
                        />
                      ) : (
                        <Typography variant="body2" color="text.secondary">
                          --
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell align="right">
                      <IconButton
                        size="small"
                        color="primary"
                        onClick={() => openModal(c)}
                        sx={{ mr: 0.5 }}
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => handleDelete(c.id)}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
                {clients.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                      <Typography color="text.secondary">
                        Nenhum cliente cadastrado
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Card>
      )}

      {/* Modal */}
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        maxWidth="sm"
        fullWidth
        slotProps={{
          paper: { sx: { borderRadius: 3 } },
        }}
      >
        <DialogTitle sx={{ fontWeight: 600 }}>
          {editing ? "Editar Cliente" : "Novo Cliente"}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 1 }}>
            <TextField
              label="Nome"
              name="name"
              value={form.name}
              onChange={handleChange}
              placeholder="Ex.: Fazenda Boa Vista"
              fullWidth
              required
            />
            <TextField
              label="Documento"
              name="document"
              value={form.document}
              onChange={handleChange}
              placeholder="CPF ou CNPJ"
              fullWidth
            />
            <TextField
              label="Segmento"
              name="segment"
              value={form.segment}
              onChange={handleChange}
              fullWidth
            />
            <TextField
              label="Vendedor"
              name="vendor"
              value={form.vendor}
              onChange={handleChange}
              placeholder="Responsável"
              fullWidth
            />
            <TextField
              select
              label="Região"
              name="region"
              value={form.region}
              onChange={handleChange}
              fullWidth
              helperText="Usada nos relatórios para filtrar carteira por região."
            >
              <MenuItem value="">— Sem região —</MenuItem>
              {regions.map((r) => (
                <MenuItem key={r} value={r}>
                  {r}
                </MenuItem>
              ))}
            </TextField>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setOpen(false)} color="inherit">
            Cancelar
          </Button>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={submitting}
          >
            {submitting ? "Salvando..." : "Salvar"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Clients;
