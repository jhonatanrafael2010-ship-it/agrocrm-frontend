import React from "react";
import {
  Box,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
  Divider,
  Avatar,
  IconButton,
  Tooltip,
} from "@mui/material";
import {
  Dashboard as DashboardIcon,
  People as PeopleIcon,
  Map as MapIcon,
  CalendarMonth as CalendarIcon,
  Assignment as AssignmentIcon,
  BusinessCenter as BusinessIcon,
  SmartToy as AssistantIcon,
  Logout as LogoutIcon,
  Settings as SettingsIcon,
  ChevronRight as ChevronRightIcon,
  Link as LinkIcon,
} from "@mui/icons-material";
import logo from "../assets/nutricrm_logo.png";
import SyncStatus from "./SyncStatus";

type Props = {
  activeItem?: string;
  onNavigate?: (item: string) => void;
  userName?: string;
  userRole?: string;
};

const sections = [
  {
    title: "Principal",
    items: [
      { label: "Dashboard", icon: <DashboardIcon />, color: "#6366f1" },
    ],
  },
  {
    title: "Gestão",
    items: [
      { label: "Clientes", icon: <PeopleIcon />, color: "#3b82f6" },
      { label: "Propriedades", icon: <MapIcon />, color: "#10b981" },
      { label: "Oportunidades", icon: <BusinessIcon />, color: "#f59e0b" },
    ],
  },
  {
    title: "Operação",
    items: [
      { label: "Calendário", icon: <CalendarIcon />, color: "#ec4899" },
      { label: "Acompanhamentos", icon: <AssignmentIcon />, color: "#8b5cf6" },
      { label: "Vincular Visitas", icon: <LinkIcon />, color: "#0ea5e9" },
    ],
  },
  {
    title: "Bot",
    items: [
      { label: "Assistente", icon: <AssistantIcon />, color: "#16a34a" },
    ],
  },
];

const Navbar: React.FC<Props> = ({
  activeItem = "Dashboard",
  onNavigate = () => {},
  userName = "Usuário",
  userRole = "Consultor",
}) => {
  return (
    <Box
      component="aside"
      sx={{
        width: 260,
        height: "100vh",
        bgcolor: "background.paper",
        borderRight: 1,
        borderColor: "divider",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {/* Logo */}
      <Box
        sx={{
          p: 2,
          display: "flex",
          alignItems: "center",
          gap: 1.5,
          cursor: "pointer",
          borderBottom: 1,
          borderColor: "divider",
        }}
        onClick={() => onNavigate("Dashboard")}
      >
        <Avatar
          src={logo}
          alt="NutriCRM"
          variant="rounded"
          sx={{ width: 44, height: 44 }}
        />
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.2, color: "primary.main" }}>
            NutriCRM
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Gestão Agrícola
          </Typography>
        </Box>
      </Box>

      {/* Navigation */}
      <Box sx={{ flex: 1, overflowY: "auto", py: 1 }}>
        {sections.map((section, idx) => (
          <Box key={section.title}>
            {idx > 0 && <Divider sx={{ my: 1 }} />}
            <Typography
              variant="overline"
              sx={{
                px: 2,
                py: 1,
                display: "block",
                color: "text.secondary",
                fontWeight: 600,
                fontSize: "0.7rem",
                letterSpacing: 1,
              }}
            >
              {section.title}
            </Typography>
            <List disablePadding>
              {section.items.map((item) => {
                const isActive = activeItem === item.label;
                return (
                  <ListItem key={item.label} disablePadding sx={{ px: 1 }}>
                    <ListItemButton
                      selected={isActive}
                      onClick={() => onNavigate(item.label)}
                      sx={{
                        borderRadius: 2,
                        mb: 0.5,
                        py: 1,
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
                        },
                      }}
                    >
                      <ListItemIcon
                        sx={{
                          minWidth: 40,
                          color: isActive ? item.color : "text.secondary",
                        }}
                      >
                        {item.icon}
                      </ListItemIcon>
                      <ListItemText
                        primary={item.label}
                        slotProps={{
                          primary: {
                            sx: {
                              fontSize: "0.9rem",
                              fontWeight: isActive ? 600 : 400,
                            },
                          },
                        }}
                      />
                      {isActive && (
                        <ChevronRightIcon
                          sx={{ fontSize: 18, color: item.color, opacity: 0.7 }}
                        />
                      )}
                    </ListItemButton>
                  </ListItem>
                );
              })}
            </List>
          </Box>
        ))}
      </Box>

      {/* User section */}
      <Box sx={{ borderTop: 1, borderColor: "divider", p: 2 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 1.5 }}>
          <Avatar
            sx={{
              width: 40,
              height: 40,
              bgcolor: "primary.main",
              fontWeight: 700,
            }}
          >
            {userName.charAt(0).toUpperCase()}
          </Avatar>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography
              variant="body2"
              sx={{ fontWeight: 600, lineHeight: 1.2 }}
              noWrap
            >
              {userName}
            </Typography>
            <Typography variant="caption" color="text.secondary" noWrap>
              {userRole}
            </Typography>
          </Box>
          <SyncStatus />
          <Tooltip title="Configurações">
            <IconButton
              size="small"
              onClick={() => onNavigate("Configurações")}
            >
              <SettingsIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>

        <ListItemButton
          onClick={() => alert("Logout realizado!")}
          sx={{
            borderRadius: 2,
            color: "error.main",
            py: 1,
            "&:hover": {
              bgcolor: "error.lighter",
            },
          }}
        >
          <ListItemIcon sx={{ minWidth: 36, color: "error.main" }}>
            <LogoutIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText
            primary="Sair"
            slotProps={{
              primary: {
                sx: { fontSize: "0.9rem", fontWeight: 500 },
              },
            }}
          />
        </ListItemButton>
      </Box>
    </Box>
  );
};

export default Navbar;
