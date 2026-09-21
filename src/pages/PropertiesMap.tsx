import React, { useEffect, useState, useRef, useMemo } from "react";
import {
  Box,
  Typography,
  Card,
  CardContent,
  CircularProgress,
  Button,
  TextField,
  MenuItem,
  Chip,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  ListItemIcon,
  Badge,
  ToggleButton,
  ToggleButtonGroup,
} from "@mui/material";
import {
  Satellite as SatelliteIcon,
  Map as MapIcon,
  Refresh as RefreshIcon,
  FilterList as FilterListIcon,
  LocationCity as CityIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Place as PlaceIcon,
  Route as RouteIcon,
  Visibility as ViewIcon,
} from "@mui/icons-material";
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents, Polyline } from "react-leaflet";
import L from "leaflet";
import RoutingPanel from "../components/RoutingPanel";
import "leaflet/dist/leaflet.css";
import { API_BASE } from "../config";
import { fetchWithCache } from "../utils/offlineSync";

import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

// @ts-ignore
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

const getMarkerColor = (daysAgo: number | null): string => {
  if (daysAgo === null) return "#6b7280";
  if (daysAgo <= 7) return "#22c55e";
  if (daysAgo <= 15) return "#eab308";
  if (daysAgo <= 30) return "#f97316";
  return "#ef4444";
};

const createColoredIcon = (color: string, label?: string) => {
  const trimmedLabel = label?.trim();
  if (trimmedLabel && trimmedLabel.length > 0) {
    const escapedLabel = trimmedLabel
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
    return L.divIcon({
      className: "custom-marker-with-label",
      html: `
        <div style="display: flex; flex-direction: column; align-items: center;">
          <div style="
            background-color: ${color};
            width: 24px;
            height: 24px;
            border-radius: 50%;
            border: 3px solid white;
            box-shadow: 0 2px 6px rgba(0,0,0,0.4);
          "></div>
          <div style="
            background: rgba(255,255,255,0.95);
            padding: 2px 6px;
            border-radius: 4px;
            font-size: 11px;
            font-weight: 600;
            color: #333;
            white-space: nowrap;
            margin-top: 4px;
            box-shadow: 0 1px 4px rgba(0,0,0,0.2);
            max-width: 150px;
            overflow: hidden;
            text-overflow: ellipsis;
          ">${escapedLabel}</div>
        </div>
      `,
      iconSize: [24, 50],
      iconAnchor: [12, 12],
      popupAnchor: [0, -12],
    });
  }
  return L.divIcon({
    className: "custom-marker",
    html: `
      <div style="
        background-color: ${color};
        width: 24px;
        height: 24px;
        border-radius: 50%;
        border: 3px solid white;
        box-shadow: 0 2px 6px rgba(0,0,0,0.4);
        display: flex;
        align-items: center;
        justify-content: center;
      "></div>
    `,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [0, -12],
  });
};

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
  sales_periods: string[];
  last_visit: {
    id: number;
    date: string | null;
    culture: string | null;
    variety: string | null;
    fenologia: string | null;
    days_ago: number | null;
  } | null;
};

type Consultant = {
  id: number;
  name: string;
};

type CityStats = {
  city: string;
  count: number;
  totalArea: number;
  properties: PropertyMapItem[];
  avgLat: number;
  avgLng: number;
};

function MapBoundsUpdater({ properties, hasInitialized }: { properties: PropertyMapItem[], hasInitialized: React.MutableRefObject<boolean> }) {
  const map = useMap();

  useEffect(() => {
    if (properties.length > 0 && !hasInitialized.current) {
      const bounds = L.latLngBounds(
        properties.map((p) => [p.latitude, p.longitude])
      );
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 12 });
      hasInitialized.current = true;
    }
  }, [properties, map, hasInitialized]);

  return null;
}

function MapCenterOnCity({ lat, lng, trigger }: { lat: number; lng: number; trigger: number }) {
  const map = useMap();

  useEffect(() => {
    if (trigger > 0) {
      map.setView([lat, lng], 11, { animate: true });
    }
  }, [trigger, lat, lng, map]);

  return null;
}

function ZoomTracker({ onZoomChange }: { onZoomChange: (zoom: number) => void }) {
  const map = useMapEvents({
    zoomend: () => {
      onZoomChange(map.getZoom());
    },
  });

  useEffect(() => {
    onZoomChange(map.getZoom());
  }, []);

  return null;
}

type MapFilter = "all" | "recent" | "attention" | "late" | "critical" | "no_visit";

function MapClickHandler({ onCtrlClick }: { onCtrlClick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click: (e) => {
      if (e.originalEvent.ctrlKey || e.originalEvent.metaKey) {
        onCtrlClick(e.latlng.lat, e.latlng.lng);
      }
    },
  });
  return null;
}

const SALES_PERIODS = [
  { value: "", label: "Todos" },
  { value: "no_sale", label: "Sem venda" },
  { value: "Safra 26/27", label: "Safra 26/27" },
  { value: "Safra 27/28", label: "Safra 27/28" },
  { value: "Safra 28/29", label: "Safra 28/29" },
  { value: "Safrinha 27", label: "Safrinha 27" },
  { value: "Safrinha 28", label: "Safrinha 28" },
  { value: "Safrinha 29", label: "Safrinha 29" },
];

const PropertiesMap: React.FC = () => {
  const [properties, setProperties] = useState<PropertyMapItem[]>([]);
  const [consultants, setConsultants] = useState<Consultant[]>([]);
  const [regions, setRegions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [mapType, setMapType] = useState<"street" | "satellite">("satellite");
  const [filterConsultant, setFilterConsultant] = useState("");
  const [filterStatus, setFilterStatus] = useState<MapFilter>(() => {
    const saved = sessionStorage.getItem("map_filter_status");
    sessionStorage.removeItem("map_filter_status");
    return (saved as MapFilter) || "all";
  });
  const [filterRegion, setFilterRegion] = useState("");
  const [filterCity, setFilterCity] = useState("");
  const [filterSales, setFilterSales] = useState("");
  const [currentZoom, setCurrentZoom] = useState(5);
  const [showCityPanel, setShowCityPanel] = useState(true);
  const [centerTrigger, setCenterTrigger] = useState(0);
  const [centerCoords, setCenterCoords] = useState<{ lat: number; lng: number }>({ lat: 0, lng: 0 });
  const mapInitializedRef = useRef(false);

  // Modo roteirização
  const [mapMode, setMapMode] = useState<"view" | "routing">("view");
  const [selectedForRoute, setSelectedForRoute] = useState<Set<number>>(new Set());
  const [routePolyline, setRoutePolyline] = useState<[number, number][]>([]);
  const [routeVersion, setRouteVersion] = useState(0);
  const [routeInfo, setRouteInfo] = useState<{ distanceKm: number; duration: string } | null>(null);
  const [viaPoints, setViaPoints] = useState<{ lat: number; lng: number; name: string }[]>([]);

  const defaultCenter: [number, number] = [-14.235, -51.9253];

  const loadData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterConsultant) params.append("consultant_id", filterConsultant);
      if (filterRegion) params.append("region", filterRegion);

      const url = `${API_BASE}properties/map${params.toString() ? `?${params}` : ""}`;
      const res = await fetch(url);
      const data = await res.json();
      setProperties(data);
    } catch (err) {
      console.error("Erro ao carregar mapa:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    Promise.all([
      fetchWithCache(`${API_BASE}consultants`, "consultants"),
      fetch(`${API_BASE}regions`).then((r) => r.json()).catch(() => []),
    ]).then(([cons, regs]) => {
      setConsultants(Array.isArray(cons) ? cons : []);
      setRegions(Array.isArray(regs) ? regs : []);
    });

    loadData();
  }, []);

  useEffect(() => {
    mapInitializedRef.current = false;
    loadData();
  }, [filterConsultant, filterRegion]);

  // Extrair município do city_state (formato: "Cidade - UF" ou "Cidade/UF" ou apenas "Cidade")
  const extractCity = (cityState: string | null): string => {
    if (!cityState) return "Sem município";
    const cleaned = cityState.trim();

    // Se for apenas sigla de estado (2 letras), retorna "Sem município"
    if (/^[A-Z]{2}$/i.test(cleaned)) return "Sem município";

    // Remove sufixo de estado (- MT, /MT, etc)
    const match = cleaned.match(/^(.+?)(?:\s*[-\/]\s*[A-Z]{2})?$/i);
    const city = match ? match[1].trim() : cleaned;

    // Se após remover o estado ficou vazio ou é só sigla, retorna "Sem município"
    if (!city || /^[A-Z]{2}$/i.test(city)) return "Sem município";

    return city;
  };

  // Agrupar propriedades por município
  const cityStats = useMemo(() => {
    const cityMap: Record<string, CityStats> = {};

    for (const prop of properties) {
      if (!prop.latitude || !prop.longitude) continue;

      const city = extractCity(prop.city_state);

      if (!cityMap[city]) {
        cityMap[city] = {
          city,
          count: 0,
          totalArea: 0,
          properties: [],
          avgLat: 0,
          avgLng: 0,
        };
      }

      cityMap[city].count += 1;
      cityMap[city].totalArea += prop.area_ha || 0;
      cityMap[city].properties.push(prop);
    }

    // Calcular centróide de cada município
    for (const stats of Object.values(cityMap)) {
      const sumLat = stats.properties.reduce((sum, p) => sum + p.latitude, 0);
      const sumLng = stats.properties.reduce((sum, p) => sum + p.longitude, 0);
      stats.avgLat = sumLat / stats.properties.length;
      stats.avgLng = sumLng / stats.properties.length;
    }

    return Object.values(cityMap).sort((a, b) => b.count - a.count);
  }, [properties]);

  // Lista de municípios únicos para o dropdown
  const cities = useMemo(() => {
    return cityStats.map((c) => c.city);
  }, [cityStats]);

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "-";
    const d = new Date(dateStr);
    return d.toLocaleDateString("pt-BR");
  };

  const filterByStatus = (prop: PropertyMapItem): boolean => {
    const daysAgo = prop.last_visit?.days_ago ?? null;

    switch (filterStatus) {
      case "recent":
        return daysAgo !== null && daysAgo <= 7;
      case "attention":
        return daysAgo !== null && daysAgo > 7 && daysAgo <= 15;
      case "late":
        return daysAgo !== null && daysAgo > 15 && daysAgo <= 30;
      case "critical":
        return daysAgo !== null && daysAgo > 30;
      case "no_visit":
        return daysAgo === null;
      default:
        return true;
    }
  };

  const filterByCity = (prop: PropertyMapItem): boolean => {
    if (!filterCity) return true;
    return extractCity(prop.city_state) === filterCity;
  };

  const filterBySales = (prop: PropertyMapItem): boolean => {
    if (!filterSales) return true;
    if (filterSales === "no_sale") {
      return !prop.sales_periods || prop.sales_periods.length === 0;
    }
    return prop.sales_periods?.includes(filterSales) ?? false;
  };

  const propertiesWithCoords = properties
    .filter((p) => p.latitude && p.longitude)
    .filter(filterByStatus)
    .filter(filterByCity)
    .filter(filterBySales);

  const handleCityClick = (stats: CityStats) => {
    setFilterCity(stats.city);
    setCenterCoords({ lat: stats.avgLat, lng: stats.avgLng });
    setCenterTrigger((t) => t + 1);
    mapInitializedRef.current = true; // Evita re-fit automático
  };

  const handleClearCityFilter = () => {
    setFilterCity("");
    mapInitializedRef.current = false;
  };

  // Funções de roteirização
  const handleToggleRouteSelect = (id: number) => {
    setSelectedForRoute((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const handleClearRouteSelection = () => {
    setSelectedForRoute(new Set());
  };

  const handleRouteCalculated = (
    coordinates: [number, number][],
    _orderedIds: number[],
    info?: { distanceKm: number; duration: string }
  ) => {
    setRoutePolyline(coordinates);
    setRouteInfo(info || null);
    setRouteVersion((v) => v + 1);
  };

  const handleClearRoute = () => {
    setRoutePolyline([]);
    setRouteInfo(null);
    setRouteVersion((v) => v + 1);
  };

  const handleAddViaPoint = (point: { lat: number; lng: number; name: string }) => {
    setViaPoints((prev) => [...prev, point]);
  };

  const handleRemoveViaPoint = (index: number) => {
    setViaPoints((prev) => prev.filter((_, i) => i !== index));
  };

  const handleClearViaPoints = () => {
    setViaPoints([]);
  };

  const isPropertySelected = (id: number) => selectedForRoute.has(id);

  return (
    <Box sx={{ p: { xs: 1, md: 3 }, minHeight: "100vh", height: "auto" }}>
      {/* Header */}
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          mb: 2,
          flexWrap: "wrap",
          gap: 2,
        }}
      >
        <Typography variant="h4" sx={{ fontWeight: 700 }}>
          Mapa de Propriedades
        </Typography>
        <Box sx={{ display: "flex", gap: 2, alignItems: "center" }}>
          <ToggleButtonGroup
            value={mapMode}
            exclusive
            onChange={(_, v) => v && setMapMode(v)}
            size="small"
          >
            <ToggleButton value="view">
              <ViewIcon sx={{ mr: 0.5 }} fontSize="small" />
              Visualizar
            </ToggleButton>
            <ToggleButton value="routing">
              <RouteIcon sx={{ mr: 0.5 }} fontSize="small" />
              Roteirizar
            </ToggleButton>
          </ToggleButtonGroup>
          <IconButton onClick={loadData} disabled={loading}>
            <RefreshIcon />
          </IconButton>
        </Box>
      </Box>

      {/* Filtros */}
      <Card sx={{ mb: 2, p: 2 }}>
        <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", alignItems: "center" }}>
          <FilterListIcon color="action" />
          <TextField
            select
            label="Consultor"
            value={filterConsultant}
            onChange={(e) => setFilterConsultant(e.target.value)}
            size="small"
            sx={{ minWidth: 150 }}
          >
            <MenuItem value="">Todos</MenuItem>
            {consultants.map((c) => (
              <MenuItem key={c.id} value={c.id.toString()}>
                {c.name}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label="Região"
            value={filterRegion}
            onChange={(e) => setFilterRegion(e.target.value)}
            size="small"
            sx={{ minWidth: 150 }}
          >
            <MenuItem value="">Todas</MenuItem>
            {regions.map((r) => (
              <MenuItem key={r} value={r}>
                {r}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label="Município"
            value={filterCity}
            onChange={(e) => {
              const city = e.target.value;
              if (city) {
                const stats = cityStats.find((c) => c.city === city);
                if (stats) {
                  handleCityClick(stats);
                }
              } else {
                handleClearCityFilter();
              }
            }}
            size="small"
            sx={{ minWidth: 180 }}
          >
            <MenuItem value="">Todos</MenuItem>
            {cities.map((c) => (
              <MenuItem key={c} value={c}>
                {c} ({cityStats.find((s) => s.city === c)?.count || 0})
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label="Status Visita"
            value={filterStatus}
            onChange={(e) => {
              setFilterStatus(e.target.value as MapFilter);
              mapInitializedRef.current = false;
            }}
            size="small"
            sx={{ minWidth: 180 }}
          >
            <MenuItem value="all">Todos</MenuItem>
            <MenuItem value="recent">Recentes (&lt; 7 dias)</MenuItem>
            <MenuItem value="attention">Atenção (8-15 dias)</MenuItem>
            <MenuItem value="late">Atrasados (16-30 dias)</MenuItem>
            <MenuItem value="critical">Críticos (&gt; 30 dias)</MenuItem>
            <MenuItem value="no_visit">Sem visita</MenuItem>
          </TextField>

          <TextField
            select
            label="Vendas"
            value={filterSales}
            onChange={(e) => {
              setFilterSales(e.target.value);
              mapInitializedRef.current = false;
            }}
            size="small"
            sx={{ minWidth: 150 }}
          >
            {SALES_PERIODS.map((p) => (
              <MenuItem key={p.value} value={p.value}>
                {p.label}
              </MenuItem>
            ))}
          </TextField>

          <Box sx={{ flex: 1 }} />

          {/* Legenda clicável */}
          <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
            <Chip
              size="small"
              label="< 7 dias"
              onClick={() => {
                setFilterStatus(filterStatus === "recent" ? "all" : "recent");
                mapInitializedRef.current = false;
              }}
              sx={{
                bgcolor: "#22c55e",
                color: "white",
                cursor: "pointer",
                border: filterStatus === "recent" ? "2px solid #000" : "none",
                "&:hover": { opacity: 0.85 },
              }}
            />
            <Chip
              size="small"
              label="8-15 dias"
              onClick={() => {
                setFilterStatus(filterStatus === "attention" ? "all" : "attention");
                mapInitializedRef.current = false;
              }}
              sx={{
                bgcolor: "#eab308",
                color: "white",
                cursor: "pointer",
                border: filterStatus === "attention" ? "2px solid #000" : "none",
                "&:hover": { opacity: 0.85 },
              }}
            />
            <Chip
              size="small"
              label="16-30 dias"
              onClick={() => {
                setFilterStatus(filterStatus === "late" ? "all" : "late");
                mapInitializedRef.current = false;
              }}
              sx={{
                bgcolor: "#f97316",
                color: "white",
                cursor: "pointer",
                border: filterStatus === "late" ? "2px solid #000" : "none",
                "&:hover": { opacity: 0.85 },
              }}
            />
            <Chip
              size="small"
              label="> 30 dias"
              onClick={() => {
                setFilterStatus(filterStatus === "critical" ? "all" : "critical");
                mapInitializedRef.current = false;
              }}
              sx={{
                bgcolor: "#ef4444",
                color: "white",
                cursor: "pointer",
                border: filterStatus === "critical" ? "2px solid #000" : "none",
                "&:hover": { opacity: 0.85 },
              }}
            />
            <Chip
              size="small"
              label="Sem visita"
              onClick={() => {
                setFilterStatus(filterStatus === "no_visit" ? "all" : "no_visit");
                mapInitializedRef.current = false;
              }}
              sx={{
                bgcolor: "#6b7280",
                color: "white",
                cursor: "pointer",
                border: filterStatus === "no_visit" ? "2px solid #000" : "none",
                "&:hover": { opacity: 0.85 },
              }}
            />
          </Box>
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          {propertiesWithCoords.length} propriedades com localização
          {filterCity && (
            <Chip
              label={`Município: ${filterCity}`}
              size="small"
              onDelete={handleClearCityFilter}
              sx={{ ml: 1 }}
            />
          )}
        </Typography>
      </Card>

      {/* Layout: Painel lateral + Mapa */}
      <Box sx={{ display: "flex", gap: 2, height: { xs: "auto", md: "calc(100vh - 320px)" }, minHeight: 400 }}>
        {/* Painel lateral - Municípios ou Roteirização */}
        {mapMode === "routing" ? (
          <Box
            sx={{
              width: { xs: "100%", md: 320 },
              flexShrink: 0,
              display: { xs: "block", md: "block" },
              height: "100%",
            }}
          >
            <RoutingPanel
              properties={propertiesWithCoords}
              selectedIds={selectedForRoute}
              onToggleSelect={handleToggleRouteSelect}
              onClearSelection={handleClearRouteSelection}
              onRouteCalculated={handleRouteCalculated}
              onClearRoute={handleClearRoute}
              viaPoints={viaPoints}
              onAddViaPoint={handleAddViaPoint}
              onRemoveViaPoint={handleRemoveViaPoint}
              onClearViaPoints={handleClearViaPoints}
            />
          </Box>
        ) : (
        <Card
          sx={{
            width: { xs: "100%", md: showCityPanel ? 280 : "auto" },
            flexShrink: 0,
            display: { xs: showCityPanel ? "block" : "none", md: "block" },
            overflow: "hidden",
          }}
        >
          <CardContent sx={{ p: 0, height: "100%", display: "flex", flexDirection: "column" }}>
            <Box
              sx={{
                p: showCityPanel ? 2 : 1,
                borderBottom: showCityPanel ? 1 : 0,
                borderColor: "divider",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <IconButton
                  size="small"
                  onClick={() => setShowCityPanel(!showCityPanel)}
                  sx={{ display: { xs: "none", md: "flex" } }}
                  title={showCityPanel ? "Esconder municípios" : "Mostrar municípios"}
                >
                  {showCityPanel ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                </IconButton>
                {showCityPanel && (
                  <>
                    <CityIcon color="primary" />
                    <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                      Municípios
                    </Typography>
                  </>
                )}
                {!showCityPanel && (
                  <CityIcon color="primary" sx={{ display: { xs: "none", md: "block" } }} />
                )}
              </Box>
              {showCityPanel && <Chip label={cityStats.length} size="small" color="primary" />}
            </Box>

            {showCityPanel && (
              <List sx={{ flex: 1, overflow: "auto", py: 0 }}>
                {cityStats.map((stats) => (
                  <ListItemButton
                    key={stats.city}
                    selected={filterCity === stats.city}
                    onClick={() => handleCityClick(stats)}
                    sx={{
                      borderBottom: 1,
                      borderColor: "divider",
                      "&.Mui-selected": {
                        bgcolor: "primary.lighter",
                        borderLeft: 3,
                        borderLeftColor: "primary.main",
                      },
                    }}
                  >
                    <ListItemIcon sx={{ minWidth: 36 }}>
                      <Badge
                        badgeContent={stats.count}
                        color="primary"
                        max={99}
                      >
                        <PlaceIcon color="action" />
                      </Badge>
                    </ListItemIcon>
                    <ListItemText
                      primary={`${stats.city} (${stats.totalArea.toLocaleString("pt-BR")} ha)`}
                      secondary={`${stats.count} propriedade${stats.count > 1 ? "s" : ""}`}
                      slotProps={{
                        primary: { sx: { fontWeight: filterCity === stats.city ? 600 : 400 } },
                        secondary: { sx: { fontSize: "0.75rem" } },
                      }}
                    />
                  </ListItemButton>
                ))}
                {cityStats.length === 0 && (
                  <Box sx={{ p: 3, textAlign: "center" }}>
                    <Typography color="text.secondary" variant="body2">
                      Nenhum município encontrado
                    </Typography>
                  </Box>
                )}
              </List>
            )}
          </CardContent>
        </Card>
        )}

        {/* Toggle painel mobile - só no modo visualização */}
        {mapMode === "view" && (
          <Box sx={{ display: { xs: "block", md: "none" }, mb: 1 }}>
            <Button
              size="small"
              startIcon={showCityPanel ? <ExpandLessIcon /> : <ExpandMoreIcon />}
              onClick={() => setShowCityPanel(!showCityPanel)}
            >
              {showCityPanel ? "Ocultar municípios" : "Mostrar municípios"}
            </Button>
          </Box>
        )}

        {/* Mapa */}
        <Card sx={{ flex: 1, position: "relative", minHeight: 400 }}>
          {loading ? (
            <Box
              sx={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                height: "100%",
              }}
            >
              <CircularProgress />
            </Box>
          ) : (
            <MapContainer
              center={defaultCenter}
              zoom={5}
              style={{ height: "100%", width: "100%" }}
            >
              {mapType === "satellite" ? (
                <>
                  {/* Camada de satélite Google */}
                  <TileLayer
                    attribution="&copy; Google Maps"
                    url="https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}"
                    maxZoom={20}
                  />
                  {/* Camada de limites de municípios e labels (ESRI) */}
                  <TileLayer
                    url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"
                    maxZoom={19}
                  />
                </>
              ) : (
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
              )}

              {/* Handler para Ctrl+Clique no modo roteirização */}
              {mapMode === "routing" && (
                <MapClickHandler
                  onCtrlClick={(lat, lng) => {
                    handleAddViaPoint({ lat, lng, name: `Via ${viaPoints.length + 1}` });
                  }}
                />
              )}

              {/* Polyline da rota calculada */}
              {routePolyline.length > 0 && (
                <>
                  {/* Borda branca para destaque (renderiza primeiro = fica por baixo) */}
                  <Polyline
                    key={`route-border-v${routeVersion}`}
                    positions={routePolyline}
                    color="white"
                    weight={8}
                    opacity={0.5}
                  />
                  {/* Linha principal azul */}
                  <Polyline
                    key={`route-main-v${routeVersion}`}
                    positions={routePolyline}
                    color="#2563eb"
                    weight={5}
                    opacity={0.9}
                  />
                </>
              )}

              {/* Marcadores de pontos de passagem */}
              {viaPoints.map((vp, idx) => (
                <Marker
                  key={`via-${idx}`}
                  position={[vp.lat, vp.lng]}
                  icon={createColoredIcon("#0ea5e9", `Via ${idx + 1}`)}
                />
              ))}

              {propertiesWithCoords.map((prop) => {
                const showLabel = currentZoom >= 10;
                const isSelected = isPropertySelected(prop.id);
                const markerColor = mapMode === "routing" && isSelected
                  ? "#2563eb"  // Azul quando selecionado para rota
                  : getMarkerColor(prop.last_visit?.days_ago ?? null);

                return (
                  <Marker
                    key={`${prop.id}-${showLabel}-${isSelected}`}
                    position={[prop.latitude, prop.longitude]}
                    icon={createColoredIcon(markerColor, showLabel && prop.client_name ? prop.client_name : undefined)}
                    eventHandlers={{
                      click: () => {
                        if (mapMode === "routing") {
                          handleToggleRouteSelect(prop.id);
                        }
                      },
                      mouseover: (e) => {
                        e.target.openPopup();
                      },
                      mouseout: (e) => {
                        e.target.closePopup();
                      },
                    }}
                  >
                    <Popup autoPan={false}>
                      <Box sx={{ minWidth: 200 }}>
                        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                          {prop.client_name}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {prop.name}
                        </Typography>
                        {prop.city_state && (
                          <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                            {prop.city_state}
                          </Typography>
                        )}
                        {prop.area_ha && (
                          <Typography variant="body2">
                            Área: {prop.area_ha} ha
                          </Typography>
                        )}

                        <Box
                          sx={{
                            mt: 1,
                            pt: 1,
                            borderTop: 1,
                            borderColor: "divider",
                          }}
                        >
                          {prop.last_visit ? (
                            <>
                              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                Última visita: {formatDate(prop.last_visit.date)}
                              </Typography>
                              {prop.last_visit.days_ago !== null && (
                                <Typography variant="caption" color="text.secondary">
                                  ({prop.last_visit.days_ago} dias atrás)
                                </Typography>
                              )}
                              {prop.last_visit.culture && (
                                <Typography variant="body2">
                                  {prop.last_visit.culture}
                                  {prop.last_visit.variety && ` - ${prop.last_visit.variety}`}
                                  {prop.last_visit.fenologia && ` (${prop.last_visit.fenologia})`}
                                </Typography>
                              )}
                            </>
                          ) : (
                            <Typography variant="body2" color="text.secondary">
                              Sem visitas registradas
                            </Typography>
                          )}
                        </Box>
                      </Box>
                    </Popup>
                  </Marker>
                );
              })}

              <MapBoundsUpdater properties={propertiesWithCoords} hasInitialized={mapInitializedRef} />
              <MapCenterOnCity lat={centerCoords.lat} lng={centerCoords.lng} trigger={centerTrigger} />
              <ZoomTracker onZoomChange={setCurrentZoom} />
            </MapContainer>
          )}

          {/* Overlay de distância/tempo da rota */}
          {routeInfo && (
            <Box
              sx={{
                position: "absolute",
                bottom: 20,
                left: "50%",
                transform: "translateX(-50%)",
                zIndex: 1000,
                bgcolor: "rgba(37, 99, 235, 0.95)",
                color: "white",
                px: 3,
                py: 1.5,
                borderRadius: 2,
                boxShadow: 3,
                display: "flex",
                gap: 3,
                alignItems: "center",
              }}
            >
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <RouteIcon />
                <Typography variant="h6" sx={{ fontWeight: 700 }}>
                  {routeInfo.distanceKm} km
                </Typography>
              </Box>
              <Box sx={{ width: 1, height: 24, bgcolor: "rgba(255,255,255,0.3)" }} />
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                {routeInfo.duration}
              </Typography>
            </Box>
          )}

          {/* Toggle Mapa/Satélite */}
          <Box
            sx={{
              position: "absolute",
              top: 10,
              right: 10,
              zIndex: 1000,
              display: "flex",
              bgcolor: "background.paper",
              borderRadius: 1,
              boxShadow: 2,
              overflow: "hidden",
            }}
          >
            <Button
              size="small"
              variant={mapType === "street" ? "contained" : "text"}
              onClick={() => setMapType("street")}
              sx={{
                minWidth: 40,
                px: 1.5,
                borderRadius: 0,
                color: mapType === "street" ? "white" : "text.primary",
              }}
              startIcon={<MapIcon fontSize="small" />}
            >
              Mapa
            </Button>
            <Button
              size="small"
              variant={mapType === "satellite" ? "contained" : "text"}
              onClick={() => setMapType("satellite")}
              sx={{
                minWidth: 40,
                px: 1.5,
                borderRadius: 0,
                color: mapType === "satellite" ? "white" : "text.primary",
              }}
              startIcon={<SatelliteIcon fontSize="small" />}
            >
              Satélite
            </Button>
          </Box>
        </Card>
      </Box>
    </Box>
  );
};

export default PropertiesMap;
