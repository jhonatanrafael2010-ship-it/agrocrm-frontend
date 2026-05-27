// src/pages/Login.tsx
import { useState, useEffect } from "react";
import {
  Box,
  Paper,
  TextField,
  Button,
  Typography,
  Avatar,
  CircularProgress,
  Alert,
  InputAdornment,
  IconButton,
} from "@mui/material";
import {
  Person as PersonIcon,
  Lock as LockIcon,
  Visibility,
  VisibilityOff,
  AdminPanelSettings as AdminIcon,
} from "@mui/icons-material";
import logo from "../assets/nutricrm_logo.png";
import loginBg from "../assets/login_bg.png";
import { login, saveAuth } from "../services/auth";
import { API_BASE } from "../config";

interface LoginProps {
  onSuccess: () => void;
}

const Login: React.FC<LoginProps> = ({ onSuccess }) => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Setup inicial
  const [checkingSetup, setCheckingSetup] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);

  useEffect(() => {
    async function checkSetup() {
      try {
        const res = await fetch(`${API_BASE}auth/setup`);
        const data = await res.json();
        setNeedsSetup(data.needs_setup === true);
      } catch {
        // Se erro, assume que não precisa de setup
        setNeedsSetup(false);
      } finally {
        setCheckingSetup(false);
      }
    }
    checkSetup();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!username.trim() || !password) {
      setError("Preencha usuário e senha");
      return;
    }

    if (password.length < 4) {
      setError("Senha deve ter pelo menos 4 caracteres");
      return;
    }

    setLoading(true);

    try {
      if (needsSetup) {
        // Setup inicial - criar primeiro admin
        const res = await fetch(`${API_BASE}auth/setup`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: username.trim(), password }),
        });

        const data = await res.json();

        if (!res.ok) {
          setError(data.error || "Erro ao criar admin");
          return;
        }

        saveAuth(data.token, data.user);
        onSuccess();
      } else {
        // Login normal
        const result = await login(username.trim(), password);

        if (result.ok) {
          onSuccess();
        } else {
          setError(result.error || "Erro ao fazer login");
        }
      }
    } catch (err) {
      setError("Erro de conexão. Verifique sua internet.");
    } finally {
      setLoading(false);
    }
  }

  if (checkingSetup) {
    return (
      <Box
        sx={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundImage: `linear-gradient(rgba(0, 0, 0, 0.4), rgba(0, 0, 0, 0.5)), url(${loginBg})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
        }}
      >
        <CircularProgress sx={{ color: "white" }} />
      </Box>
    );
  }

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundImage: `linear-gradient(rgba(0, 0, 0, 0.4), rgba(0, 0, 0, 0.5)), url(${loginBg})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        p: 2,
      }}
    >
      <Paper
        elevation={8}
        sx={{
          p: 4,
          maxWidth: 400,
          width: "100%",
          borderRadius: 4,
          textAlign: "center",
        }}
      >
        {/* Logo */}
        <Avatar
          src={logo}
          alt="NutriCRM"
          sx={{
            width: 80,
            height: 80,
            mx: "auto",
            mb: 2,
            boxShadow: 3,
          }}
        />

        <Typography variant="h5" sx={{ fontWeight: 700, color: "primary.main", mb: 0.5 }}>
          NutriCRM
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          {needsSetup ? "Configuração Inicial" : "Gestão Agrícola"}
        </Typography>

        {/* Setup notice */}
        {needsSetup && (
          <Alert severity="info" sx={{ mb: 3, textAlign: "left" }} icon={<AdminIcon />}>
            Crie o primeiro usuário administrador para começar.
          </Alert>
        )}

        {/* Form */}
        <Box component="form" onSubmit={handleSubmit}>
          {error && (
            <Alert severity="error" sx={{ mb: 2, textAlign: "left" }}>
              {error}
            </Alert>
          )}

          <TextField
            fullWidth
            label={needsSetup ? "Nome de usuário admin" : "Usuário"}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            disabled={loading}
            autoComplete="username"
            autoFocus
            sx={{ mb: 2 }}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <PersonIcon color="action" />
                  </InputAdornment>
                ),
              },
            }}
          />

          <TextField
            fullWidth
            label={needsSetup ? "Criar senha" : "Senha"}
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading}
            autoComplete={needsSetup ? "new-password" : "current-password"}
            sx={{ mb: 3 }}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <LockIcon color="action" />
                  </InputAdornment>
                ),
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={() => setShowPassword(!showPassword)}
                      edge="end"
                      size="small"
                    >
                      {showPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              },
            }}
          />

          <Button
            type="submit"
            variant="contained"
            fullWidth
            size="large"
            disabled={loading}
            sx={{
              py: 1.5,
              fontWeight: 600,
              fontSize: "1rem",
              borderRadius: 2,
            }}
          >
            {loading ? (
              <CircularProgress size={24} color="inherit" />
            ) : needsSetup ? (
              "Criar Admin e Entrar"
            ) : (
              "Entrar"
            )}
          </Button>
        </Box>

        {!needsSetup && (
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 3 }}>
            Esqueceu a senha? Entre em contato com o administrador.
          </Typography>
        )}
      </Paper>
    </Box>
  );
};

export default Login;
