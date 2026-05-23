// src/components/SyncStatus.tsx
import React, { useEffect, useState, useCallback } from "react";
import {
  Badge,
  IconButton,
  Tooltip,
  Snackbar,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Typography,
  Box,
  CircularProgress,
  Chip,
} from "@mui/material";
import {
  CloudSync as SyncIcon,
  CloudOff as OfflineIcon,
  CloudDone as SyncedIcon,
  Schedule as PendingIcon,
  PhotoCamera as PhotoIcon,
  Description as VisitIcon,
  Refresh as RetryIcon,
} from "@mui/icons-material";
import { API_BASE } from "../config";
import {
  getAllPendingVisits,
  getAllPendingPhotos,
  PendingVisit,
  PendingPhoto,
} from "../utils/indexedDB";
import { syncPendingVisits, syncPendingPhotos } from "../utils/offlineSync";

type SyncState = "synced" | "pending" | "syncing" | "offline" | "error";

export default function SyncStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [syncState, setSyncState] = useState<SyncState>("synced");
  const [pendingVisits, setPendingVisits] = useState<PendingVisit[]>([]);
  const [pendingPhotos, setPendingPhotos] = useState<PendingPhoto[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: "success" | "error" | "info" }>({
    open: false,
    message: "",
    severity: "info",
  });

  const totalPending = pendingVisits.length + pendingPhotos.length;

  const loadPendingItems = useCallback(async () => {
    try {
      const [visits, photos] = await Promise.all([
        getAllPendingVisits(),
        getAllPendingPhotos(),
      ]);
      setPendingVisits(visits);
      setPendingPhotos(photos);

      if (visits.length > 0 || photos.length > 0) {
        setSyncState(navigator.onLine ? "pending" : "offline");
      } else {
        setSyncState(navigator.onLine ? "synced" : "offline");
      }
    } catch (err) {
      console.error("Erro ao carregar itens pendentes:", err);
    }
  }, []);

  const handleSync = useCallback(async () => {
    if (!navigator.onLine) {
      setSnackbar({ open: true, message: "Sem conexão com a internet", severity: "error" });
      return;
    }

    setSyncState("syncing");

    try {
      const visitResult = await syncPendingVisits(API_BASE);
      const photoResult = await syncPendingPhotos(API_BASE);

      const totalSynced = visitResult.synced + photoResult.synced;
      const totalFailed = visitResult.failed + photoResult.failed;

      await loadPendingItems();

      if (totalFailed > 0) {
        setSnackbar({
          open: true,
          message: `Sincronizado: ${totalSynced} | Falhou: ${totalFailed}`,
          severity: "error",
        });
        setSyncState("error");
      } else if (totalSynced > 0) {
        setSnackbar({
          open: true,
          message: `${totalSynced} item(s) sincronizado(s) com sucesso`,
          severity: "success",
        });
      }
    } catch (err) {
      console.error("Erro na sincronização:", err);
      setSnackbar({ open: true, message: "Erro na sincronização", severity: "error" });
      setSyncState("error");
    }
  }, [loadPendingItems]);

  // Monitor online/offline status
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setSnackbar({ open: true, message: "Conexão restaurada. Sincronizando...", severity: "info" });
      // Auto-sync when back online
      setTimeout(() => handleSync(), 1000);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setSyncState("offline");
      setSnackbar({ open: true, message: "Você está offline. Alterações serão salvas localmente.", severity: "info" });
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [handleSync]);

  // Load pending items on mount and when visits are updated
  useEffect(() => {
    loadPendingItems();

    const handleVisitsUpdated = () => loadPendingItems();
    window.addEventListener("visits-updated", handleVisitsUpdated);
    window.addEventListener("visits-synced", handleVisitsUpdated);

    // Poll every 30 seconds
    const interval = setInterval(loadPendingItems, 30000);

    return () => {
      window.removeEventListener("visits-updated", handleVisitsUpdated);
      window.removeEventListener("visits-synced", handleVisitsUpdated);
      clearInterval(interval);
    };
  }, [loadPendingItems]);

  const getIcon = () => {
    switch (syncState) {
      case "syncing":
        return <CircularProgress size={20} color="inherit" />;
      case "offline":
        return <OfflineIcon />;
      case "pending":
      case "error":
        return <SyncIcon />;
      default:
        return <SyncedIcon />;
    }
  };

  const getTooltip = () => {
    if (!isOnline) return "Offline - alterações salvas localmente";
    if (syncState === "syncing") return "Sincronizando...";
    if (totalPending > 0) return `${totalPending} item(s) aguardando sincronização`;
    return "Tudo sincronizado";
  };

  const getColor = (): "default" | "primary" | "secondary" | "error" | "info" | "success" | "warning" => {
    if (!isOnline) return "warning";
    if (syncState === "error") return "error";
    if (totalPending > 0) return "warning";
    return "success";
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <>
      <Tooltip title={getTooltip()}>
        <IconButton
          color={getColor()}
          onClick={() => totalPending > 0 ? setDialogOpen(true) : handleSync()}
          size="small"
        >
          <Badge
            badgeContent={totalPending > 0 ? totalPending : null}
            color="error"
            max={99}
          >
            {getIcon()}
          </Badge>
        </IconButton>
      </Tooltip>

      {/* Dialog com detalhes da fila */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <PendingIcon color="warning" />
            <Typography variant="h6">Fila de sincronização</Typography>
          </Box>
          <Chip
            label={isOnline ? "Online" : "Offline"}
            color={isOnline ? "success" : "warning"}
            size="small"
          />
        </DialogTitle>

        <DialogContent dividers>
          {totalPending === 0 ? (
            <Box sx={{ textAlign: "center", py: 4 }}>
              <SyncedIcon sx={{ fontSize: 48, color: "success.main", mb: 1 }} />
              <Typography color="text.secondary">Tudo sincronizado!</Typography>
            </Box>
          ) : (
            <>
              {pendingVisits.length > 0 && (
                <>
                  <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
                    Visitas pendentes ({pendingVisits.length})
                  </Typography>
                  <List dense>
                    {pendingVisits.map((pv) => (
                      <ListItem key={pv.id}>
                        <ListItemIcon>
                          <VisitIcon color="primary" />
                        </ListItemIcon>
                        <ListItemText
                          primary={pv.data?.client_name || pv.data?.clientSearch || "Visita"}
                          secondary={`Criado em ${formatDate(pv.createdAt)}`}
                        />
                      </ListItem>
                    ))}
                  </List>
                </>
              )}

              {pendingPhotos.length > 0 && (
                <>
                  <Typography variant="subtitle2" sx={{ mb: 1, mt: 2, fontWeight: 600 }}>
                    Fotos pendentes ({pendingPhotos.length})
                  </Typography>
                  <List dense>
                    {pendingPhotos.slice(0, 10).map((pp) => (
                      <ListItem key={pp.id}>
                        <ListItemIcon>
                          <PhotoIcon color="secondary" />
                        </ListItemIcon>
                        <ListItemText
                          primary={pp.fileName?.split("_").pop() || "Foto"}
                          secondary={`Visita #${pp.visit_id}`}
                        />
                      </ListItem>
                    ))}
                    {pendingPhotos.length > 10 && (
                      <ListItem>
                        <ListItemText
                          secondary={`... e mais ${pendingPhotos.length - 10} fotos`}
                        />
                      </ListItem>
                    )}
                  </List>
                </>
              )}
            </>
          )}
        </DialogContent>

        <DialogActions>
          <Button onClick={() => setDialogOpen(false)} color="inherit">
            Fechar
          </Button>
          {totalPending > 0 && (
            <Button
              onClick={() => {
                setDialogOpen(false);
                handleSync();
              }}
              variant="contained"
              startIcon={syncState === "syncing" ? <CircularProgress size={16} color="inherit" /> : <RetryIcon />}
              disabled={!isOnline || syncState === "syncing"}
            >
              {syncState === "syncing" ? "Sincronizando..." : "Sincronizar agora"}
            </Button>
          )}
        </DialogActions>
      </Dialog>

      {/* Snackbar de feedback */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
          variant="filled"
          sx={{ width: "100%" }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </>
  );
}
