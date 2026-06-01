import React, { useEffect, useState } from "react";
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  CardHeader,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  CircularProgress,
  Alert,
  IconButton,
  Paper,
  Skeleton,
} from "@mui/material";
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Check as CheckIcon,
} from "@mui/icons-material";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { API_BASE } from "../config";
import { fetchWithCache } from "../utils/offlineSync";
import { notify } from "../utils/toast";
import ConfirmDialog from "../components/ConfirmDialog";

type Opportunity = {
  id: number;
  client_id?: number;
  title?: string;
  estimated_value?: number;
  stage?: string;
};

type Client = { id: number; name: string };

const STAGES = [
  { key: "prospecção", label: "Prospecção", color: "#6366f1" },
  { key: "cotação", label: "Cotação", color: "#3b82f6" },
  { key: "negociação", label: "Negociação", color: "#f59e0b" },
  { key: "fechadas", label: "Fechadas", color: "#10b981" },
  { key: "perdidas", label: "Perdidas", color: "#ef4444" },
];

const Opportunities: React.FC = () => {
  const [opps, setOpps] = useState<Opportunity[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ client_id: "", title: "", estimated_value: "" });
  const [submitting, setSubmitting] = useState(false);
  const [editing, setEditing] = useState<Opportunity | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; id: number | null; loading: boolean }>({
    open: false,
    id: null,
    loading: false,
  });

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    Promise.all([
      fetchWithCache(`${API_BASE}opportunities`, "opportunities"),
      fetchWithCache(`${API_BASE}clients`, "clients"),
    ])
      .then(([ops, cs]) => {
        if (!mounted) return;
        setOpps(ops || []);
        setClients(cs || []);
      })
      .catch((err) => {
        console.error(err);
        setError("Erro ao carregar oportunidades");
      })
      .finally(() => setLoading(false));
    return () => {
      mounted = false;
    };
  }, []);

  function clientName(id?: number) {
    return clients.find((c) => c.id === id)?.name ?? "--";
  }

  async function changeStageRemote(opId: number, newStage: string) {
    try {
      const res = await fetch(`${API_BASE}opportunities/${opId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage: newStage }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.message || `status ${res.status}`);
      const updated = body.opportunity || body;
      setOpps((list) => list.map((it) => (it.id === updated.id ? updated : it)));
    } catch (err: any) {
      notify.error(err?.message || "Erro ao atualizar oportunidade");
    }
  }

  async function handleSave() {
    if (!form.client_id || !form.title) {
      notify.warning("Cliente e título são obrigatórios");
      return;
    }
    setSubmitting(true);
    try {
      let res, body;
      if (editing) {
        res = await fetch(`${API_BASE}opportunities/${editing.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            client_id: Number(form.client_id),
            title: form.title,
            estimated_value: form.estimated_value ? Number(form.estimated_value) : undefined,
          }),
        });
        body = await res.json();
        if (!res.ok) throw new Error(body.message || `status ${res.status}`);
        const updated = body.opportunity || body;
        setOpps((o) => o.map((op) => (op.id === updated.id ? updated : op)));
      } else {
        res = await fetch(`${API_BASE}opportunities`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            client_id: Number(form.client_id),
            title: form.title,
            estimated_value: form.estimated_value ? Number(form.estimated_value) : undefined,
          }),
        });
        body = await res.json();
        if (!res.ok) throw new Error(body.message || `status ${res.status}`);
        const created = body.opportunity || body;
        setOpps((o) => [created, ...o]);
      }
      closeModal();
    } catch (err: any) {
      notify.error(err?.message || "Erro ao salvar oportunidade");
    } finally {
      setSubmitting(false);
    }
  }

  function handleDeleteClick(id?: number) {
    if (!id) return;
    setDeleteDialog({ open: true, id, loading: false });
  }

  async function handleDeleteConfirm() {
    if (!deleteDialog.id) return;
    setDeleteDialog((d) => ({ ...d, loading: true }));
    try {
      const res = await fetch(`${API_BASE}opportunities/${deleteDialog.id}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || `status ${res.status}`);
      }
      setOpps((list) => list.filter((o) => o.id !== deleteDialog.id));
      setDeleteDialog({ open: false, id: null, loading: false });
      notify.success("Oportunidade excluída");
    } catch (err: any) {
      notify.error(err?.message || "Erro ao excluir oportunidade");
      setDeleteDialog((d) => ({ ...d, loading: false }));
    }
  }

  function openModal(op?: Opportunity) {
    setOpen(true);
    if (op) {
      setEditing(op);
      setForm({
        client_id: op.client_id ? String(op.client_id) : "",
        title: op.title || "",
        estimated_value: op.estimated_value ? String(op.estimated_value) : "",
      });
    } else {
      setEditing(null);
      setForm({ client_id: "", title: "", estimated_value: "" });
    }
  }

  function closeModal() {
    setOpen(false);
    setEditing(null);
    setForm({ client_id: "", title: "", estimated_value: "" });
  }

  const grouped = STAGES.reduce((acc: Record<string, Opportunity[]>, s) => {
    acc[s.key] = opps.filter((o) => (o.stage || "prospecção").toLowerCase() === s.key);
    return acc;
  }, {} as Record<string, Opportunity[]>);

  function onDragEnd(result: any) {
    const { source, destination, draggableId } = result;
    if (!destination) return;
    const fromStage = source.droppableId;
    const toStage = destination.droppableId;
    if (fromStage === toStage) return;

    const opId = Number(draggableId);
    setOpps((list) => list.map((it) => (it.id === opId ? { ...it, stage: toStage } : it)));
    changeStageRemote(opId, toStage);
  }

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 1600, mx: "auto" }}>
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
          Oportunidades
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => openModal()}
          sx={{ textTransform: "none", fontWeight: 600 }}
        >
          Nova Oportunidade
        </Button>
      </Box>

      {loading ? (
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: {
              xs: "1fr",
              sm: "repeat(2, 1fr)",
              md: "repeat(3, 1fr)",
              lg: "repeat(5, 1fr)",
            },
            gap: 2,
          }}
        >
          {STAGES.map((s) => (
            <Card key={s.key} sx={{ minHeight: 400 }}>
              <CardHeader
                title={s.label}
                slotProps={{ title: { sx: { fontSize: "0.95rem", fontWeight: 600 } } }}
                sx={{ bgcolor: `${s.color}15`, borderBottom: `3px solid ${s.color}`, py: 1.5 }}
              />
              <CardContent sx={{ p: 1.5 }}>
                {[1, 2, 3].map((i) => (
                  <Paper key={i} sx={{ p: 1.5, mb: 1.5, borderRadius: 2 }}>
                    <Skeleton variant="text" width="70%" />
                    <Skeleton variant="text" width="50%" />
                    <Skeleton variant="text" width="40%" />
                  </Paper>
                ))}
              </CardContent>
            </Card>
          ))}
        </Box>
      ) : error ? (
        <Alert severity="error">{error}</Alert>
      ) : (
        <DragDropContext onDragEnd={onDragEnd}>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: {
                xs: "1fr",
                sm: "repeat(2, 1fr)",
                md: "repeat(3, 1fr)",
                lg: "repeat(5, 1fr)",
              },
              gap: 2,
            }}
          >
            {STAGES.map((s) => (
              <Card
                key={s.key}
                sx={{
                  minHeight: 400,
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                <CardHeader
                  title={s.label}
                  slotProps={{
                    title: {
                      sx: {
                        fontSize: "0.95rem",
                        fontWeight: 600,
                        textTransform: "capitalize",
                      },
                    },
                  }}
                  sx={{
                    bgcolor: `${s.color}15`,
                    borderBottom: `3px solid ${s.color}`,
                    py: 1.5,
                  }}
                />
                <Droppable droppableId={s.key}>
                  {(provided) => (
                    <CardContent
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      sx={{
                        flex: 1,
                        p: 1.5,
                        bgcolor: "action.hover",
                        minHeight: 200,
                      }}
                    >
                      {(grouped[s.key] || []).map((op, idx) => (
                        <Draggable key={op.id} draggableId={`${op.id}`} index={idx}>
                          {(prov) => (
                            <Paper
                              ref={prov.innerRef}
                              {...prov.draggableProps}
                              {...prov.dragHandleProps}
                              elevation={1}
                              sx={{
                                p: 1.5,
                                mb: 1.5,
                                borderRadius: 2,
                                borderLeft: `3px solid ${s.color}`,
                                transition: "box-shadow 0.2s",
                                "&:hover": {
                                  boxShadow: 4,
                                },
                              }}
                            >
                              <Typography
                                variant="subtitle2"
                                sx={{ fontWeight: 600, mb: 0.5 }}
                              >
                                {op.title}
                              </Typography>
                              <Typography
                                variant="caption"
                                color="text.secondary"
                                sx={{ display: "block", mb: 0.5 }}
                              >
                                {clientName(op.client_id)}
                              </Typography>
                              {op.estimated_value && (
                                <Typography
                                  variant="body2"
                                  sx={{ fontWeight: 700, color: "success.main" }}
                                >
                                  R$ {op.estimated_value.toLocaleString("pt-BR")}
                                </Typography>
                              )}
                              <Box
                                sx={{
                                  display: "flex",
                                  justifyContent: "flex-end",
                                  gap: 0.5,
                                  mt: 1,
                                }}
                              >
                                {s.key !== "fechadas" && (
                                  <IconButton
                                    size="small"
                                    color="success"
                                    onClick={() => changeStageRemote(op.id, "fechadas")}
                                    title="Marcar como fechada"
                                  >
                                    <CheckIcon fontSize="small" />
                                  </IconButton>
                                )}
                                <IconButton
                                  size="small"
                                  color="primary"
                                  onClick={() => openModal(op)}
                                >
                                  <EditIcon fontSize="small" />
                                </IconButton>
                                <IconButton
                                  size="small"
                                  color="error"
                                  onClick={() => handleDeleteClick(op.id)}
                                >
                                  <DeleteIcon fontSize="small" />
                                </IconButton>
                              </Box>
                            </Paper>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </CardContent>
                  )}
                </Droppable>
              </Card>
            ))}
          </Box>
        </DragDropContext>
      )}

      {/* Modal */}
      <Dialog
        open={open}
        onClose={closeModal}
        maxWidth="sm"
        fullWidth
        slotProps={{ paper: { sx: { borderRadius: 3 } } }}
      >
        <DialogTitle sx={{ fontWeight: 600 }}>
          {editing ? "Editar Oportunidade" : "Nova Oportunidade"}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 1 }}>
            <TextField
              select
              label="Cliente"
              value={form.client_id}
              onChange={(e) => setForm((f) => ({ ...f, client_id: e.target.value }))}
              fullWidth
              required
            >
              <MenuItem value="">Selecione cliente</MenuItem>
              {clients
                .slice()
                .sort((a, b) => a.name.localeCompare(b.name))
                .map((c) => (
                  <MenuItem key={c.id} value={String(c.id)}>
                    {c.name}
                  </MenuItem>
                ))}
            </TextField>
            <TextField
              label="Título"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              fullWidth
              required
            />
            <TextField
              label="Valor estimado"
              value={form.estimated_value}
              onChange={(e) => setForm((f) => ({ ...f, estimated_value: e.target.value }))}
              placeholder="0"
              fullWidth
              type="number"
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={closeModal} color="inherit">
            Cancelar
          </Button>
          <Button variant="contained" onClick={handleSave} disabled={submitting}>
            {submitting ? "Salvando..." : "Salvar"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Confirm Delete Dialog */}
      <ConfirmDialog
        open={deleteDialog.open}
        title="Excluir Oportunidade"
        message="Tem certeza que deseja excluir esta oportunidade? Esta ação não pode ser desfeita."
        confirmLabel="Excluir"
        loading={deleteDialog.loading}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteDialog({ open: false, id: null, loading: false })}
      />
    </Box>
  );
};

export default Opportunities;
