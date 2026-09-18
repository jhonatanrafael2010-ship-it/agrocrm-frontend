import React, { useState } from "react";
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  TextField,
  CircularProgress,
  Chip,
  Divider,
  Alert,
  Switch,
  FormControlLabel,
} from "@mui/material";
import {
  Route as RouteIcon,
  MyLocation as OriginIcon,
  Place as PlaceIcon,
  Delete as DeleteIcon,
  Calculate as CalculateIcon,
  Download as DownloadIcon,
  Clear as ClearIcon,
  AccessTime as TimeIcon,
  Straighten as DistanceIcon,
  CheckCircle as CheckIcon,
} from "@mui/icons-material";
import { API_BASE } from "../config";
import { notify } from "../utils/toast";

type PropertyMapItem = {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  area_ha: number | null;
  city_state: string | null;
  client_id: number;
  client_name: string;
  client_region: string | null;
};

type RouteResult = {
  total_distance_km: number;
  total_duration_min: number;
  total_duration_formatted: string;
  optimized_order: number[];
  legs: {
    from: string;
    to: string;
    distance_km: number;
    duration_min: number;
    start_address: string;
    end_address: string;
  }[];
  polyline: string;
};

type Props = {
  properties: PropertyMapItem[];
  selectedIds: Set<number>;
  onToggleSelect: (id: number) => void;
  onClearSelection: () => void;
  onRouteCalculated: (polyline: string, orderedIds: number[]) => void;
  onClearRoute: () => void;
};

const RoutingPanel: React.FC<Props> = ({
  properties,
  selectedIds,
  onToggleSelect,
  onClearSelection,
  onRouteCalculated,
  onClearRoute,
}) => {
  const [origin, setOrigin] = useState<{ lat: number; lng: number; name: string } | null>(null);
  const [originInput, setOriginInput] = useState("");
  const [returnToOrigin, setReturnToOrigin] = useState(true);
  const [calculating, setCalculating] = useState(false);
  const [routeResult, setRouteResult] = useState<RouteResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedProperties = properties.filter((p) => selectedIds.has(p.id));

  const handleSetOriginFromCoords = () => {
    const parts = originInput.split(",").map((s) => s.trim());
    if (parts.length === 2) {
      const lat = parseFloat(parts[0]);
      const lng = parseFloat(parts[1]);
      if (!isNaN(lat) && !isNaN(lng)) {
        setOrigin({ lat, lng, name: "Origem" });
        setError(null);
        return;
      }
    }
    setError("Formato inválido. Use: latitude, longitude (ex: -15.5989, -56.0949)");
  };

  const handleUsePropertyAsOrigin = (prop: PropertyMapItem) => {
    setOrigin({
      lat: prop.latitude,
      lng: prop.longitude,
      name: prop.client_name,
    });
    setOriginInput(`${prop.latitude}, ${prop.longitude}`);
    onToggleSelect(prop.id); // Remove da lista de destinos
  };

  const handleCalculateRoute = async () => {
    if (!origin) {
      setError("Defina o ponto de origem");
      return;
    }
    if (selectedProperties.length === 0) {
      setError("Selecione pelo menos um destino");
      return;
    }

    setCalculating(true);
    setError(null);
    setRouteResult(null);
    onClearRoute();

    try {
      const destinations = selectedProperties.map((p) => ({
        id: p.id,
        name: p.client_name,
        lat: p.latitude,
        lng: p.longitude,
      }));

      const res = await fetch(`${API_BASE}routing/calculate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          origin: { ...origin },
          destinations,
          return_to_origin: returnToOrigin,
        }),
      });

      const data = await res.json();

      if (!data.success) {
        throw new Error(data.error || "Erro ao calcular rota");
      }

      setRouteResult(data.route);
      onRouteCalculated(data.route.polyline, data.route.optimized_order);
      notify.success("Rota calculada!");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao calcular rota";
      setError(msg);
      notify.error(msg);
    } finally {
      setCalculating(false);
    }
  };

  const handleExportRoute = () => {
    if (!routeResult) return;

    let text = `ROTEIRO DE ENTREGA\n`;
    text += `${"=".repeat(40)}\n\n`;
    text += `Data: ${new Date().toLocaleDateString("pt-BR")}\n`;
    text += `Distância total: ${routeResult.total_distance_km} km\n`;
    text += `Tempo estimado: ${routeResult.total_duration_formatted}\n\n`;
    text += `PARADAS:\n`;
    text += `${"-".repeat(40)}\n`;

    routeResult.legs.forEach((leg, idx) => {
      text += `\n${idx + 1}. ${leg.from} → ${leg.to}\n`;
      text += `   Distância: ${leg.distance_km} km | Tempo: ${leg.duration_min} min\n`;
      if (leg.end_address) {
        text += `   Endereço: ${leg.end_address}\n`;
      }
    });

    text += `\n${"=".repeat(40)}\n`;
    text += `Gerado por AgroCRM`;

    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `roteiro_${new Date().toISOString().split("T")[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);

    notify.success("Roteiro exportado!");
  };

  const handleClear = () => {
    setOrigin(null);
    setOriginInput("");
    setRouteResult(null);
    setError(null);
    onClearSelection();
    onClearRoute();
  };

  return (
    <Card sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <CardContent sx={{ pb: 1 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
          <RouteIcon color="primary" />
          <Typography variant="h6" sx={{ fontWeight: 600, flex: 1 }}>
            Roteiro de Entrega
          </Typography>
          {(selectedIds.size > 0 || origin || routeResult) && (
            <IconButton size="small" onClick={handleClear} title="Limpar tudo">
              <ClearIcon />
            </IconButton>
          )}
        </Box>

        {/* Origem */}
        <Box sx={{ mb: 2 }}>
          <Typography variant="subtitle2" sx={{ mb: 1, display: "flex", alignItems: "center", gap: 0.5 }}>
            <OriginIcon fontSize="small" color="primary" />
            Ponto de Origem
          </Typography>
          {origin ? (
            <Chip
              icon={<CheckIcon />}
              label={origin.name}
              color="primary"
              onDelete={() => {
                setOrigin(null);
                setOriginInput("");
              }}
              sx={{ width: "100%" }}
            />
          ) : (
            <Box sx={{ display: "flex", gap: 1 }}>
              <TextField
                size="small"
                placeholder="-15.5989, -56.0949"
                value={originInput}
                onChange={(e) => setOriginInput(e.target.value)}
                fullWidth
                helperText="Lat, Lng ou selecione um cliente abaixo"
              />
              <Button
                variant="outlined"
                size="small"
                onClick={handleSetOriginFromCoords}
                disabled={!originInput}
              >
                OK
              </Button>
            </Box>
          )}
        </Box>

        <Divider sx={{ my: 2 }} />

        {/* Destinos selecionados */}
        <Typography variant="subtitle2" sx={{ mb: 1, display: "flex", alignItems: "center", gap: 0.5 }}>
          <PlaceIcon fontSize="small" color="secondary" />
          Destinos ({selectedProperties.length})
        </Typography>
      </CardContent>

      {/* Lista de destinos */}
      <List sx={{ flex: 1, overflow: "auto", py: 0 }}>
        {selectedProperties.length === 0 ? (
          <Box sx={{ p: 2, textAlign: "center" }}>
            <Typography variant="body2" color="text.secondary">
              Clique nos marcadores do mapa para selecionar destinos
            </Typography>
          </Box>
        ) : (
          selectedProperties.map((prop, idx) => (
            <ListItem
              key={prop.id}
              sx={{ borderBottom: 1, borderColor: "divider", py: 1 }}
            >
              <ListItemIcon sx={{ minWidth: 32 }}>
                <Chip label={idx + 1} size="small" color="secondary" />
              </ListItemIcon>
              <ListItemText
                primary={prop.client_name}
                secondary={prop.city_state || prop.name}
                slotProps={{
                  primary: { sx: { fontWeight: 500, fontSize: "0.9rem" } },
                  secondary: { sx: { fontSize: "0.75rem" } },
                }}
              />
              <ListItemSecondaryAction>
                {!origin && (
                  <IconButton
                    size="small"
                    onClick={() => handleUsePropertyAsOrigin(prop)}
                    title="Usar como origem"
                    color="primary"
                  >
                    <OriginIcon fontSize="small" />
                  </IconButton>
                )}
                <IconButton
                  size="small"
                  onClick={() => onToggleSelect(prop.id)}
                  title="Remover"
                  color="error"
                >
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </ListItemSecondaryAction>
            </ListItem>
          ))
        )}
      </List>

      {/* Opções e ações */}
      <CardContent sx={{ pt: 1 }}>
        <FormControlLabel
          control={
            <Switch
              checked={returnToOrigin}
              onChange={(e) => setReturnToOrigin(e.target.checked)}
              size="small"
            />
          }
          label={<Typography variant="body2">Retornar à origem</Typography>}
        />

        {error && (
          <Alert severity="error" sx={{ mt: 1, py: 0 }}>
            {error}
          </Alert>
        )}

        <Button
          variant="contained"
          fullWidth
          startIcon={calculating ? <CircularProgress size={20} color="inherit" /> : <CalculateIcon />}
          onClick={handleCalculateRoute}
          disabled={calculating || !origin || selectedProperties.length === 0}
          sx={{ mt: 2 }}
        >
          {calculating ? "Calculando..." : "Calcular Rota"}
        </Button>

        {/* Resultado */}
        {routeResult && (
          <Box sx={{ mt: 2, p: 1.5, bgcolor: "success.lighter", borderRadius: 1 }}>
            <Box sx={{ display: "flex", gap: 2, mb: 1 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                <DistanceIcon fontSize="small" color="primary" />
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {routeResult.total_distance_km} km
                </Typography>
              </Box>
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                <TimeIcon fontSize="small" color="primary" />
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {routeResult.total_duration_formatted}
                </Typography>
              </Box>
            </Box>

            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1 }}>
              Ordem otimizada: {routeResult.legs.map((l) => l.to).join(" → ")}
            </Typography>

            <Button
              variant="outlined"
              size="small"
              fullWidth
              startIcon={<DownloadIcon />}
              onClick={handleExportRoute}
            >
              Exportar Roteiro
            </Button>
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

export default RoutingPanel;
