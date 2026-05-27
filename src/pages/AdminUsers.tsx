// src/pages/AdminUsers.tsx
// Tela de gerenciamento de usuários (somente admin)

import { useEffect, useState } from "react";
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  IconButton,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  CircularProgress,
  Tooltip,
  Alert,
  InputAdornment,
} from "@mui/material";
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Lock as LockIcon,
  LockOpen as LockOpenIcon,
  Visibility,
  VisibilityOff,
  AdminPanelSettings as AdminIcon,
  Person as PersonIcon,
  Refresh as RefreshIcon,
} from "@mui/icons-material";
import { API_BASE } from "../config";
import { getToken } from "../services/auth";
import { notify } from "../utils/toast";

interface User {
  id: number;
  username: string;
  consultant_id: number | null;
  consultant_name: string | null;
  is_admin: boolean;
  active: boolean;
  created_at: string;
}

interface Consultant {
  id: number;
  name: string;
  has_user: boolean;
}

const AdminUsers: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [consultants, setConsultants] = useState<Consultant[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Dialog states
  const [createOpen, setCreateOpen] = useState(false);
  const [resetPasswordOpen, setResetPasswordOpen] = useState<User | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<User | null>(null);

  // Form states
  const [formUsername, setFormUsername] = useState("");
  const [formPassword, setFormPassword] = useState("");
  const [formConsultantId, setFormConsultantId] = useState<string>("");
  const [formIsAdmin, setFormIsAdmin] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState("");

  const token = getToken();

  async function loadData() {
    setLoading(true);
    try {
      const [usersRes, consultantsRes] = await Promise.all([
        fetch(`${API_BASE}admin/users`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${API_BASE}admin/consultants`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      if (usersRes.ok) {
        const data = await usersRes.json();
        setUsers(data.users || []);
      }

      if (consultantsRes.ok) {
        const data = await consultantsRes.json();
        setConsultants(data.consultants || []);
      }
    } catch (err) {
      notify.error("Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  function resetForm() {
    setFormUsername("");
    setFormPassword("");
    setFormConsultantId("");
    setFormIsAdmin(false);
    setShowPassword(false);
    setFormError("");
  }

  async function handleCreateUser() {
    setFormError("");

    if (!formUsername.trim()) {
      setFormError("Username é obrigatório");
      return;
    }
    if (formUsername.trim().length < 3) {
      setFormError("Username deve ter pelo menos 3 caracteres");
      return;
    }
    if (!formPassword) {
      setFormError("Senha é obrigatória");
      return;
    }
    if (formPassword.length < 4) {
      setFormError("Senha deve ter pelo menos 4 caracteres");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}admin/users`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          username: formUsername.trim().toLowerCase(),
          password: formPassword,
          consultant_id: formConsultantId ? parseInt(formConsultantId) : null,
          is_admin: formIsAdmin,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setFormError(data.error || "Erro ao criar usuário");
        return;
      }

      notify.success("Usuário criado com sucesso");
      setCreateOpen(false);
      resetForm();
      loadData();
    } catch (err) {
      setFormError("Erro de conexão");
    } finally {
      setSaving(false);
    }
  }

  async function handleResetPassword() {
    if (!resetPasswordOpen) return;

    setFormError("");

    if (!formPassword) {
      setFormError("Nova senha é obrigatória");
      return;
    }
    if (formPassword.length < 4) {
      setFormError("Senha deve ter pelo menos 4 caracteres");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}admin/users/${resetPasswordOpen.id}/reset-password`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ password: formPassword }),
      });

      const data = await res.json();

      if (!res.ok) {
        setFormError(data.error || "Erro ao resetar senha");
        return;
      }

      notify.success(`Senha de ${resetPasswordOpen.username} alterada`);
      setResetPasswordOpen(null);
      resetForm();
    } catch (err) {
      setFormError("Erro de conexão");
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActive(user: User) {
    try {
      const res = await fetch(`${API_BASE}admin/users/${user.id}/toggle-active`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const status = user.active ? "desativado" : "ativado";
        notify.success(`Usuário ${user.username} ${status}`);
        loadData();
      } else {
        const data = await res.json();
        notify.error(data.error || "Erro ao alterar status");
      }
    } catch {
      notify.error("Erro de conexão");
    }
  }

  async function handleDeleteUser() {
    if (!deleteConfirm) return;

    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}admin/users/${deleteConfirm.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        notify.success(`Usuário ${deleteConfirm.username} excluído`);
        setDeleteConfirm(null);
        loadData();
      } else {
        const data = await res.json();
        notify.error(data.error || "Erro ao excluir usuário");
      }
    } catch {
      notify.error("Erro de conexão");
    } finally {
      setSaving(false);
    }
  }

  // Consultores disponíveis (sem usuário vinculado)
  const availableConsultants = consultants.filter((c) => !c.has_user);

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100%", p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3, maxWidth: 1200, mx: "auto" }}>
      {/* Header */}
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700, display: "flex", alignItems: "center", gap: 1 }}>
            <AdminIcon color="primary" />
            Gerenciar Usuários
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Crie e gerencie os logins do sistema
          </Typography>
        </Box>
        <Box sx={{ display: "flex", gap: 1 }}>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={loadData}
          >
            Atualizar
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => {
              resetForm();
              setCreateOpen(true);
            }}
          >
            Novo Usuário
          </Button>
        </Box>
      </Box>

      {/* Info */}
      <Alert severity="info" sx={{ mb: 3 }}>
        Vincule cada usuário a um consultor para que ele veja apenas seus próprios dados.
        Usuários admin têm acesso a tudo.
      </Alert>

      {/* Table */}
      <TableContainer component={Paper} sx={{ borderRadius: 2 }}>
        <Table>
          <TableHead>
            <TableRow sx={{ bgcolor: "action.hover" }}>
              <TableCell sx={{ fontWeight: 600 }}>Usuário</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Consultor</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Tipo</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
              <TableCell sx={{ fontWeight: 600 }} align="right">Ações</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} sx={{ textAlign: "center", py: 4 }}>
                  <Typography color="text.secondary">Nenhum usuário cadastrado</Typography>
                </TableCell>
              </TableRow>
            ) : (
              users.map((user) => (
                <TableRow key={user.id} sx={{ "&:hover": { bgcolor: "action.hover" } }}>
                  <TableCell>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <PersonIcon color="action" />
                      <Typography sx={{ fontWeight: 600 }}>{user.username}</Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                    {user.consultant_name ? (
                      <Chip label={user.consultant_name} size="small" color="primary" variant="outlined" />
                    ) : (
                      <Typography variant="caption" color="text.secondary">-</Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    {user.is_admin ? (
                      <Chip
                        icon={<AdminIcon sx={{ fontSize: 16 }} />}
                        label="Admin"
                        size="small"
                        color="warning"
                      />
                    ) : (
                      <Chip label="Consultor" size="small" color="default" />
                    )}
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={user.active ? "Ativo" : "Inativo"}
                      size="small"
                      color={user.active ? "success" : "error"}
                    />
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title="Resetar senha">
                      <IconButton
                        size="small"
                        onClick={() => {
                          resetForm();
                          setResetPasswordOpen(user);
                        }}
                      >
                        <LockIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title={user.active ? "Desativar" : "Ativar"}>
                      <IconButton
                        size="small"
                        onClick={() => handleToggleActive(user)}
                        color={user.active ? "default" : "success"}
                      >
                        {user.active ? <LockOpenIcon fontSize="small" /> : <LockIcon fontSize="small" />}
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Excluir">
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => setDeleteConfirm(user)}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Create User Dialog */}
      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 600 }}>
          <AddIcon sx={{ mr: 1, verticalAlign: "middle" }} />
          Novo Usuário
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 1 }}>
            {formError && (
              <Alert severity="error">{formError}</Alert>
            )}

            <TextField
              label="Nome de usuário"
              value={formUsername}
              onChange={(e) => setFormUsername(e.target.value)}
              placeholder="Ex: joao, felipe, pedro..."
              helperText="Será usado para login (sem espaços, minúsculo)"
              fullWidth
              autoFocus
            />

            <TextField
              label="Senha"
              type={showPassword ? "text" : "password"}
              value={formPassword}
              onChange={(e) => setFormPassword(e.target.value)}
              placeholder="Mínimo 4 caracteres"
              fullWidth
              slotProps={{
                input: {
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton onClick={() => setShowPassword(!showPassword)} edge="end" size="small">
                        {showPassword ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  ),
                },
              }}
            />

            <TextField
              select
              label="Vincular a consultor"
              value={formConsultantId}
              onChange={(e) => setFormConsultantId(e.target.value)}
              helperText="O usuário só verá dados deste consultor"
              fullWidth
            >
              <MenuItem value="">Nenhum (acesso geral)</MenuItem>
              {availableConsultants.map((c) => (
                <MenuItem key={c.id} value={String(c.id)}>
                  {c.name}
                </MenuItem>
              ))}
              {availableConsultants.length === 0 && consultants.length > 0 && (
                <MenuItem disabled>
                  Todos os consultores já têm usuário
                </MenuItem>
              )}
            </TextField>

            <TextField
              select
              label="Tipo de usuário"
              value={formIsAdmin ? "admin" : "user"}
              onChange={(e) => setFormIsAdmin(e.target.value === "admin")}
              fullWidth
            >
              <MenuItem value="user">Consultor (acesso limitado)</MenuItem>
              <MenuItem value="admin">Administrador (acesso total)</MenuItem>
            </TextField>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setCreateOpen(false)} color="inherit">
            Cancelar
          </Button>
          <Button onClick={handleCreateUser} variant="contained" disabled={saving}>
            {saving ? "Criando..." : "Criar Usuário"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Reset Password Dialog */}
      <Dialog open={!!resetPasswordOpen} onClose={() => setResetPasswordOpen(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 600 }}>
          <LockIcon sx={{ mr: 1, verticalAlign: "middle" }} />
          Resetar Senha
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 1 }}>
            {formError && (
              <Alert severity="error">{formError}</Alert>
            )}

            <Typography>
              Definir nova senha para <strong>{resetPasswordOpen?.username}</strong>
            </Typography>

            <TextField
              label="Nova senha"
              type={showPassword ? "text" : "password"}
              value={formPassword}
              onChange={(e) => setFormPassword(e.target.value)}
              placeholder="Mínimo 4 caracteres"
              fullWidth
              autoFocus
              slotProps={{
                input: {
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton onClick={() => setShowPassword(!showPassword)} edge="end" size="small">
                        {showPassword ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  ),
                },
              }}
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setResetPasswordOpen(null)} color="inherit">
            Cancelar
          </Button>
          <Button onClick={handleResetPassword} variant="contained" disabled={saving}>
            {saving ? "Salvando..." : "Alterar Senha"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 600, color: "error.main" }}>
          <DeleteIcon sx={{ mr: 1, verticalAlign: "middle" }} />
          Excluir Usuário
        </DialogTitle>
        <DialogContent>
          <Typography>
            Tem certeza que deseja excluir o usuário <strong>{deleteConfirm?.username}</strong>?
          </Typography>
          <Typography variant="caption" color="error" sx={{ display: "block", mt: 1 }}>
            Esta ação não pode ser desfeita.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDeleteConfirm(null)} color="inherit">
            Cancelar
          </Button>
          <Button onClick={handleDeleteUser} variant="contained" color="error" disabled={saving}>
            {saving ? "Excluindo..." : "Excluir"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AdminUsers;
