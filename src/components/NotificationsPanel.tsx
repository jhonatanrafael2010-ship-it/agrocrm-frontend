import React, { useEffect, useState } from "react";
import {
  Box,
  IconButton,
  Badge,
  Popover,
  Typography,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Divider,
  CircularProgress,
} from "@mui/material";
import {
  Notifications as BellIcon,
  Error as AlertIcon,
  Schedule as ClockIcon,
  CheckCircle as CheckIcon,
  Close as CloseIcon,
} from "@mui/icons-material";
import { API_BASE } from "../config";

type Notification = {
  id: string;
  type: "overdue" | "pending" | "info";
  title: string;
  message: string;
  time: string;
  route?: string;
};

type Props = {
  onNavigate: (route: string) => void;
};

const TYPE_CONFIG = {
  overdue: {
    icon: <AlertIcon fontSize="small" />,
    color: "#ef4444",
    bgcolor: "#fef2f2",
  },
  pending: {
    icon: <ClockIcon fontSize="small" />,
    color: "#f59e0b",
    bgcolor: "#fffbeb",
  },
  info: {
    icon: <CheckIcon fontSize="small" />,
    color: "#10b981",
    bgcolor: "#ecfdf5",
  },
};

const NotificationsPanel: React.FC<Props> = ({ onNavigate }) => {
  const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null);
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const [visits, clients] = await Promise.all([
        fetch(`${API_BASE}visits`).then((r) => (r.ok ? r.json() : [])),
        fetch(`${API_BASE}clients`).then((r) => (r.ok ? r.json() : [])),
      ]);

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const clientMap: Record<number, string> = {};
      (clients || []).forEach((c: any) => (clientMap[c.id] = c.name));

      const notes: Notification[] = [];

      (visits || []).forEach((v: any) => {
        if (!v.date) return;
        const d = new Date(v.date);
        const days = Math.floor(
          (today.getTime() - d.getTime()) / (1000 * 60 * 60 * 24)
        );
        const isDone = v.status === "done";
        const clientName = v.client_name || clientMap[v.client_id] || "Cliente";

        if (!isDone && days > 0 && days <= 30) {
          notes.push({
            id: `overdue-${v.id}`,
            type: "overdue",
            title: "Visita atrasada",
            message: `${clientName} — ${days}d atraso`,
            time: v.date,
            route: "Acompanhamentos",
          });
        } else if (!isDone && days === 0) {
          notes.push({
            id: `today-${v.id}`,
            type: "pending",
            title: "Visita hoje",
            message: clientName,
            time: v.date,
            route: "Calendário",
          });
        }
      });

      notes.sort((a, b) => {
        if (a.type === "overdue" && b.type !== "overdue") return -1;
        if (b.type === "overdue" && a.type !== "overdue") return 1;
        return 0;
      });

      setItems(notes.slice(0, 20));
    } catch (err) {
      console.error("notifications err", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, 60000);
    return () => clearInterval(interval);
  }, []);

  const open = Boolean(anchorEl);
  const unread = items.length;

  function handleClick(n: Notification) {
    if (n.route) onNavigate(n.route);
    setAnchorEl(null);
  }

  return (
    <>
      <IconButton
        onClick={(e) => setAnchorEl(e.currentTarget)}
        sx={{
          color: "text.secondary",
          "&:hover": { color: "text.primary" },
        }}
      >
        <Badge
          badgeContent={unread > 9 ? "9+" : unread}
          color="error"
          invisible={unread === 0}
        >
          <BellIcon />
        </Badge>
      </IconButton>

      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{
          vertical: "bottom",
          horizontal: "right",
        }}
        transformOrigin={{
          vertical: "top",
          horizontal: "right",
        }}
        slotProps={{
          paper: {
            sx: {
              width: 360,
              maxHeight: 480,
              borderRadius: 3,
              mt: 1,
            },
          },
        }}
      >
        {/* Header */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            px: 2,
            py: 1.5,
            borderBottom: 1,
            borderColor: "divider",
          }}
        >
          <Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
              Notificações
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {unread === 0 ? "Tudo em dia" : `${unread} pendente(s)`}
            </Typography>
          </Box>
          <IconButton size="small" onClick={() => setAnchorEl(null)}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>

        {/* Body */}
        <Box sx={{ maxHeight: 380, overflow: "auto" }}>
          {loading && items.length === 0 && (
            <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
              <CircularProgress size={24} />
            </Box>
          )}

          {!loading && items.length === 0 && (
            <Box sx={{ py: 4, textAlign: "center" }}>
              <CheckIcon sx={{ fontSize: 40, color: "success.main", mb: 1 }} />
              <Typography color="text.secondary">
                Nenhuma notificação
              </Typography>
            </Box>
          )}

          <List disablePadding>
            {items.map((n, idx) => {
              const config = TYPE_CONFIG[n.type];
              return (
                <React.Fragment key={n.id}>
                  {idx > 0 && <Divider />}
                  <ListItemButton
                    onClick={() => handleClick(n)}
                    sx={{
                      py: 1.5,
                      px: 2,
                      "&:hover": {
                        bgcolor: config.bgcolor,
                      },
                    }}
                  >
                    <ListItemIcon
                      sx={{
                        minWidth: 36,
                        color: config.color,
                      }}
                    >
                      {config.icon}
                    </ListItemIcon>
                    <ListItemText
                      primary={n.title}
                      secondary={n.message}
                      slotProps={{
                        primary: {
                          sx: {
                            fontWeight: 600,
                            fontSize: "0.875rem",
                            color: config.color,
                          },
                        },
                        secondary: {
                          sx: { fontSize: "0.8rem" },
                        },
                      }}
                    />
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ whiteSpace: "nowrap", ml: 1 }}
                    >
                      {n.time}
                    </Typography>
                  </ListItemButton>
                </React.Fragment>
              );
            })}
          </List>
        </Box>
      </Popover>
    </>
  );
};

export default NotificationsPanel;
