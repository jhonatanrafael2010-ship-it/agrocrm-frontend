import React, { useEffect, useState } from "react";
import {
  Box,
  Typography,
  Chip,
  Breadcrumbs,
  Link,
  Paper,
} from "@mui/material";
import {
  ChevronRight as ChevronRightIcon,
  Search as SearchIcon,
  Sync as SyncIcon,
  CheckCircle as CheckCircleIcon,
  WifiOff as WifiOffIcon,
} from "@mui/icons-material";
import SearchModal from "./SearchModal";
import NotificationsPanel from "./NotificationsPanel";

type Props = {
  activeItem: string;
  lastSync?: string | null;
  syncing?: boolean;
  offline?: boolean;
  onNavigate: (route: string) => void;
};

const PAGE_META: Record<string, { subtitle: string; section: string }> = {
  Dashboard: { subtitle: "Visão geral do negócio", section: "Principal" },
  Clientes: { subtitle: "Gerencie sua carteira", section: "Gestão" },
  Propriedades: { subtitle: "Fazendas e talhões", section: "Gestão" },
  Oportunidades: { subtitle: "Funil de vendas", section: "Gestão" },
  Calendário: { subtitle: "Agenda de visitas", section: "Operação" },
  Acompanhamentos: { subtitle: "Histórico de visitas", section: "Operação" },
  Assistente: { subtitle: "Bot de lançamento de visitas", section: "Bot" },
};

const Topbar: React.FC<Props> = ({
  activeItem,
  lastSync,
  syncing,
  offline,
  onNavigate,
}) => {
  const meta = PAGE_META[activeItem] || { subtitle: "", section: "" };
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  return (
    <>
      <Box
        component="header"
        sx={{
          px: 3,
          py: 2,
          bgcolor: "background.paper",
          borderBottom: 1,
          borderColor: "divider",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 2,
        }}
      >
        {/* Left side - Breadcrumb & Title */}
        <Box sx={{ minWidth: 0 }}>
          <Breadcrumbs
            separator={<ChevronRightIcon sx={{ fontSize: 14, color: "text.secondary" }} />}
            sx={{ mb: 0.5 }}
          >
            <Link
              component="button"
              underline="hover"
              color="text.secondary"
              onClick={() => onNavigate("Dashboard")}
              sx={{
                fontSize: "0.75rem",
                fontWeight: 500,
                cursor: "pointer",
                border: "none",
                background: "none",
              }}
            >
              NutriCRM
            </Link>
            <Typography
              variant="caption"
              sx={{ color: "text.secondary", fontWeight: 500 }}
            >
              {meta.section}
            </Typography>
            <Typography
              variant="caption"
              sx={{ color: "text.primary", fontWeight: 600 }}
            >
              {activeItem}
            </Typography>
          </Breadcrumbs>

          <Box sx={{ display: "flex", alignItems: "baseline", gap: 1.5 }}>
            <Typography
              variant="h5"
              component="h1"
              sx={{ fontWeight: 700, lineHeight: 1.2 }}
            >
              {activeItem}
            </Typography>
            {meta.subtitle && (
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ display: { xs: "none", md: "block" } }}
              >
                {meta.subtitle}
              </Typography>
            )}
          </Box>
        </Box>

        {/* Right side - Search & Status */}
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          {/* Search Button */}
          <Paper
            component="button"
            onClick={() => setSearchOpen(true)}
            elevation={0}
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1,
              px: 1.5,
              py: 0.75,
              bgcolor: "action.hover",
              border: 1,
              borderColor: "divider",
              borderRadius: 2,
              cursor: "pointer",
              transition: "all 0.2s",
              "&:hover": {
                bgcolor: "action.selected",
                borderColor: "primary.main",
              },
            }}
          >
            <SearchIcon sx={{ fontSize: 18, color: "text.secondary" }} />
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ display: { xs: "none", sm: "block" } }}
            >
              Buscar...
            </Typography>
            <Box
              component="kbd"
              sx={{
                display: { xs: "none", md: "flex" },
                alignItems: "center",
                px: 0.75,
                py: 0.25,
                bgcolor: "background.paper",
                border: 1,
                borderColor: "divider",
                borderRadius: 1,
                fontSize: "0.7rem",
                fontFamily: "monospace",
                color: "text.secondary",
              }}
            >
              ⌘K
            </Box>
          </Paper>

          {/* Sync Status */}
          <Box sx={{ display: { xs: "none", sm: "flex" }, alignItems: "center" }}>
            {offline ? (
              <Chip
                icon={<WifiOffIcon sx={{ fontSize: 16 }} />}
                label="Offline"
                size="small"
                color="error"
                variant="outlined"
                sx={{ fontWeight: 500 }}
              />
            ) : syncing ? (
              <Chip
                icon={
                  <SyncIcon
                    sx={{
                      fontSize: 16,
                      animation: "spin 1s linear infinite",
                      "@keyframes spin": {
                        "0%": { transform: "rotate(0deg)" },
                        "100%": { transform: "rotate(360deg)" },
                      },
                    }}
                  />
                }
                label="Sincronizando"
                size="small"
                color="primary"
                variant="outlined"
                sx={{ fontWeight: 500 }}
              />
            ) : lastSync ? (
              <Chip
                icon={<CheckCircleIcon sx={{ fontSize: 16 }} />}
                label={lastSync}
                size="small"
                color="success"
                variant="outlined"
                sx={{ fontWeight: 500 }}
              />
            ) : null}
          </Box>

          {/* Notifications */}
          <NotificationsPanel onNavigate={onNavigate} />
        </Box>
      </Box>

      <SearchModal
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        onNavigate={onNavigate}
      />
    </>
  );
};

export default Topbar;
