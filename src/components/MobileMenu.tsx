import React, { useState } from "react";
import {
  Drawer,
  Box,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Divider,
  IconButton,
  Typography,
  Paper,
  Avatar,
} from "@mui/material";
import {
  Home as HomeIcon,
  People as PeopleIcon,
  Map as MapIcon,
  CalendarMonth as CalendarIcon,
  Assignment as AssignmentIcon,
  BusinessCenter as BusinessIcon,
  SmartToy as AssistantIcon,
  Logout as LogoutIcon,
  Menu as MenuIcon,
  Close as CloseIcon,
  Link as LinkIcon,
  AdminPanelSettings as AdminIcon,
} from "@mui/icons-material";
import logo from "../assets/nutricrm_logo.png";

interface MobileMenuProps {
  onNavigate: (route: string) => void;
  activeItem?: string;
  userName?: string;
  isAdmin?: boolean;
  onLogout?: () => void;
}

const menuItems = [
  { label: "Assistente", icon: <AssistantIcon />, route: "Assistente", color: "#16a34a" },
  { label: "Dashboard", icon: <HomeIcon />, route: "Dashboard", color: "#6366f1" },
  { label: "Clientes", icon: <PeopleIcon />, route: "Clientes", color: "#3b82f6" },
  { label: "Propriedades", icon: <MapIcon />, route: "Propriedades", color: "#10b981" },
  { label: "Calendário", icon: <CalendarIcon />, route: "Calendário", color: "#ec4899" },
  { label: "Acompanhamentos", icon: <AssignmentIcon />, route: "Acompanhamentos", color: "#8b5cf6" },
  { label: "Vincular Visitas", icon: <LinkIcon />, route: "Vincular Visitas", color: "#0ea5e9" },
  { label: "Oportunidades", icon: <BusinessIcon />, route: "Oportunidades", color: "#f59e0b" },
];

const bottomNavItems = [
  { label: "Assistente", icon: <AssistantIcon />, route: "Assistente", color: "#16a34a" },
  { label: "Agenda", icon: <CalendarIcon />, route: "Calendário", color: "#ec4899" },
  { label: "Visitas", icon: <AssignmentIcon />, route: "Acompanhamentos", color: "#8b5cf6" },
  { label: "Menu", icon: <MenuIcon />, route: "_menu", color: "#6b7280" },
];

const MobileMenu: React.FC<MobileMenuProps> = ({ onNavigate, activeItem, userName, isAdmin, onLogout }) => {
  // Adiciona item de Usuários se for admin
  const allMenuItems = isAdmin
    ? [...menuItems, { label: "Usuários", icon: <AdminIcon />, route: "Usuários", color: "#ef4444" }]
    : menuItems;
  const [drawerOpen, setDrawerOpen] = useState(false);

  const handleNavigate = (route: string) => {
    if (route === "_menu") {
      setDrawerOpen(true);
    } else {
      onNavigate(route);
      setDrawerOpen(false);
    }
  };

  const isActive = (route: string) => {
    if (route === "_menu") return false;
    return activeItem === route;
  };

  return (
    <>
      {/* Drawer lateral */}
      <Drawer
        anchor="left"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        slotProps={{
          paper: {
            sx: {
              width: 300,
              bgcolor: "background.paper",
              borderTopRightRadius: 24,
              borderBottomRightRadius: 24,
            },
          },
        }}
      >
        {/* Header com logo */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            p: 2.5,
            background: "linear-gradient(135deg, #16a34a 0%, #15803d 100%)",
            color: "white",
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
            <Avatar
              src={logo}
              alt="NutriCRM"
              variant="rounded"
              sx={{
                width: 44,
                height: 44,
                bgcolor: "white",
                p: 0.5,
              }}
            />
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
                NutriCRM
              </Typography>
              <Typography variant="caption" sx={{ opacity: 0.9 }}>
                Gestão Agrícola
              </Typography>
            </Box>
          </Box>
          <IconButton
            onClick={() => setDrawerOpen(false)}
            size="small"
            sx={{ color: "white" }}
          >
            <CloseIcon />
          </IconButton>
        </Box>

        {/* Lista de navegação */}
        <List sx={{ flex: 1, py: 2, px: 1 }}>
          {allMenuItems.map((item) => {
            const active = activeItem === item.route;
            return (
              <ListItem key={item.route} disablePadding sx={{ mb: 0.5 }}>
                <ListItemButton
                  selected={active}
                  onClick={() => handleNavigate(item.route)}
                  sx={{
                    borderRadius: 3,
                    py: 1.5,
                    transition: "all 0.2s ease",
                    "&.Mui-selected": {
                      bgcolor: `${item.color}15`,
                      "&:hover": {
                        bgcolor: `${item.color}25`,
                      },
                      "& .MuiListItemIcon-root": {
                        color: item.color,
                      },
                      "& .MuiListItemText-primary": {
                        color: item.color,
                        fontWeight: 600,
                      },
                    },
                    "&:hover": {
                      bgcolor: "action.hover",
                      transform: "translateX(4px)",
                    },
                  }}
                >
                  <ListItemIcon
                    sx={{
                      minWidth: 44,
                      color: active ? item.color : "text.secondary",
                    }}
                  >
                    {item.icon}
                  </ListItemIcon>
                  <ListItemText
                    primary={item.label}
                    slotProps={{
                      primary: {
                        sx: {
                          fontWeight: active ? 600 : 500,
                          fontSize: "0.95rem",
                        },
                      },
                    }}
                  />
                </ListItemButton>
              </ListItem>
            );
          })}
        </List>

        <Divider />

        {/* Footer com usuário e logout */}
        <Box sx={{ p: 2 }}>
          {userName && (
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 2, px: 1 }}>
              <Avatar sx={{ bgcolor: "primary.main", width: 36, height: 36, fontSize: "1rem" }}>
                {userName.charAt(0).toUpperCase()}
              </Avatar>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {userName}
              </Typography>
            </Box>
          )}
          <ListItemButton
            onClick={onLogout}
            sx={{
              borderRadius: 3,
              py: 1.5,
              color: "error.main",
              "&:hover": {
                bgcolor: "error.lighter",
              },
            }}
          >
            <ListItemIcon sx={{ minWidth: 44, color: "error.main" }}>
              <LogoutIcon />
            </ListItemIcon>
            <ListItemText
              primary="Sair"
              slotProps={{
                primary: { sx: { fontWeight: 500 } },
              }}
            />
          </ListItemButton>
        </Box>
      </Drawer>

      {/* Bottom Navigation Premium */}
      <Paper
        sx={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 1100,
          pb: "env(safe-area-inset-bottom)",
          borderRadius: "24px 24px 0 0",
          overflow: "hidden",
        }}
        elevation={16}
      >
        {/* Barra decorativa no topo */}
        <Box
          sx={{
            height: 3,
            background: "linear-gradient(90deg, #16a34a, #3b82f6, #8b5cf6, #ec4899)",
          }}
        />

        <Box
          sx={{
            display: "flex",
            justifyContent: "space-around",
            alignItems: "center",
            height: 70,
            px: 1,
            bgcolor: "background.paper",
          }}
        >
          {bottomNavItems.map((item) => {
            const active = isActive(item.route);
            return (
              <Box
                key={item.route}
                onClick={() => handleNavigate(item.route)}
                sx={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  flex: 1,
                  py: 1,
                  cursor: "pointer",
                  position: "relative",
                  transition: "all 0.2s ease",
                  "&:active": {
                    transform: "scale(0.95)",
                  },
                }}
              >
                {/* Indicador ativo */}
                {active && (
                  <Box
                    sx={{
                      position: "absolute",
                      top: -3,
                      width: 24,
                      height: 3,
                      borderRadius: 2,
                      bgcolor: item.color,
                    }}
                  />
                )}

                {/* Container do ícone */}
                <Box
                  sx={{
                    width: 44,
                    height: 44,
                    borderRadius: "14px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    bgcolor: active ? `${item.color}15` : "transparent",
                    color: active ? item.color : "text.secondary",
                    transition: "all 0.2s ease",
                    mb: 0.25,
                    "& svg": {
                      fontSize: 24,
                    },
                  }}
                >
                  {item.icon}
                </Box>

                {/* Label */}
                <Typography
                  variant="caption"
                  sx={{
                    fontSize: "0.7rem",
                    fontWeight: active ? 600 : 500,
                    color: active ? item.color : "text.secondary",
                    letterSpacing: 0.2,
                  }}
                >
                  {item.label}
                </Typography>
              </Box>
            );
          })}
        </Box>
      </Paper>
    </>
  );
};

export default MobileMenu;
