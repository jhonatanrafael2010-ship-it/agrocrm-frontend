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
  BottomNavigation,
  BottomNavigationAction,
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
} from "@mui/icons-material";
import logo from "../assets/nutricrm_logo.png";

interface MobileMenuProps {
  onNavigate: (route: string) => void;
  activeItem?: string;
}

const menuItems = [
  { label: "Assistente", icon: <AssistantIcon />, route: "Assistente" },
  { label: "Dashboard", icon: <HomeIcon />, route: "Dashboard" },
  { label: "Clientes", icon: <PeopleIcon />, route: "Clientes" },
  { label: "Propriedades", icon: <MapIcon />, route: "Propriedades" },
  { label: "Calendário", icon: <CalendarIcon />, route: "Calendário" },
  { label: "Acompanhamentos", icon: <AssignmentIcon />, route: "Acompanhamentos" },
  { label: "Oportunidades", icon: <BusinessIcon />, route: "Oportunidades" },
];

// Bottom nav mostra apenas os 4 mais usados
const bottomNavItems = [
  { label: "Assistente", icon: <AssistantIcon />, route: "Assistente" },
  { label: "Calendário", icon: <CalendarIcon />, route: "Calendário" },
  { label: "Acompanhar", icon: <AssignmentIcon />, route: "Acompanhamentos" },
  { label: "Menu", icon: <MenuIcon />, route: "_menu" },
];

const MobileMenu: React.FC<MobileMenuProps> = ({ onNavigate, activeItem }) => {
  const [drawerOpen, setDrawerOpen] = useState(false);

  const handleNavigate = (route: string) => {
    if (route === "_menu") {
      setDrawerOpen(true);
    } else {
      onNavigate(route);
      setDrawerOpen(false);
    }
  };

  const getBottomNavValue = () => {
    const idx = bottomNavItems.findIndex((item) => item.route === activeItem);
    return idx >= 0 ? idx : -1;
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
              width: 280,
              bgcolor: "background.paper",
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
            p: 2,
            borderBottom: 1,
            borderColor: "divider",
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
            <Avatar
              src={logo}
              alt="NutriCRM"
              variant="rounded"
              sx={{ width: 40, height: 40 }}
            />
            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
                NutriCRM
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Gestão Agrícola
              </Typography>
            </Box>
          </Box>
          <IconButton onClick={() => setDrawerOpen(false)} size="small">
            <CloseIcon />
          </IconButton>
        </Box>

        {/* Lista de navegação */}
        <List sx={{ flex: 1, py: 1 }}>
          {menuItems.map((item) => {
            const isActive = activeItem === item.route;
            return (
              <ListItem key={item.route} disablePadding>
                <ListItemButton
                  selected={isActive}
                  onClick={() => handleNavigate(item.route)}
                  sx={{
                    mx: 1,
                    borderRadius: 2,
                    mb: 0.5,
                    "&.Mui-selected": {
                      bgcolor: "primary.main",
                      color: "primary.contrastText",
                      "&:hover": {
                        bgcolor: "primary.dark",
                      },
                      "& .MuiListItemIcon-root": {
                        color: "primary.contrastText",
                      },
                    },
                  }}
                >
                  <ListItemIcon
                    sx={{
                      minWidth: 40,
                      color: isActive ? "inherit" : "text.secondary",
                    }}
                  >
                    {item.icon}
                  </ListItemIcon>
                  <ListItemText
                    primary={item.label}
                    slotProps={{
                      primary: {
                        sx: {
                          fontWeight: isActive ? 600 : 400,
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

        {/* Footer com logout */}
        <Box sx={{ p: 2 }}>
          <ListItemButton
            onClick={() => alert("Logout realizado!")}
            sx={{
              borderRadius: 2,
              color: "error.main",
              "&:hover": {
                bgcolor: "error.lighter",
              },
            }}
          >
            <ListItemIcon sx={{ minWidth: 40, color: "error.main" }}>
              <LogoutIcon />
            </ListItemIcon>
            <ListItemText primary="Sair" />
          </ListItemButton>
        </Box>
      </Drawer>

      {/* Bottom Navigation fixo */}
      <Paper
        sx={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 1100,
          borderTop: 1,
          borderColor: "divider",
          pb: "env(safe-area-inset-bottom)",
        }}
        elevation={8}
      >
        <BottomNavigation
          value={getBottomNavValue()}
          onChange={(_, newValue) => {
            handleNavigate(bottomNavItems[newValue].route);
          }}
          showLabels
          sx={{
            height: 64,
            "& .MuiBottomNavigationAction-root": {
              minWidth: 60,
              py: 1,
              "&.Mui-selected": {
                color: "primary.main",
              },
            },
            "& .MuiBottomNavigationAction-label": {
              fontSize: "0.7rem",
              "&.Mui-selected": {
                fontSize: "0.7rem",
              },
            },
          }}
        >
          {bottomNavItems.map((item) => (
            <BottomNavigationAction
              key={item.route}
              label={item.label}
              icon={item.icon}
            />
          ))}
        </BottomNavigation>
      </Paper>
    </>
  );
};

export default MobileMenu;
