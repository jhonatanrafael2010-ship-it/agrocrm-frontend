import React, { useEffect, useState, useRef } from "react";
import {
  Box,
  Typography,
  Card,
  CircularProgress,
  Button,
  TextField,
  MenuItem,
  Chip,
  IconButton,
} from "@mui/material";
import {
  Satellite as SatelliteIcon,
  Map as MapIcon,
  Refresh as RefreshIcon,
  FilterList as FilterListIcon,
} from "@mui/icons-material";
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { API_BASE } from "../config";
import { fetchWithCache } from "../utils/offlineSync";

// Fix para ícone do marker no Leaflet
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

// Cores para marcadores baseado em dias desde última visita
const getMarkerColor = (daysAgo: number | null): string => {
  if (daysAgo === null) return "#6b7280"; // Cinza - sem visita
  if (daysAgo <= 7) return "#22c55e"; // Verde - recente
  if (daysAgo <= 15) return "#eab308"; // Amarelo - atenção
  if (daysAgo <= 30) return "#f97316"; // Laranja - atrasado
  return "#ef4444"; // Vermelho - muito atrasado
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

function MapBoundsUpdater({ properties, hasInitialized }: { properties: PropertyMapItem[], hasInitialized: React.MutableRefObject<boolean> }) {
  const map = useMap();

  useEffect(() => {
    // Só ajusta bounds uma vez, quando as propriedades são carregadas pela primeira vez
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
  const [currentZoom, setCurrentZoom] = useState(5);
  const mapInitializedRef = useRef(false);

  const defaultCenter: [number, number] = [-14.235, -51.9253]; // Centro do Brasil

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
    // Carrega consultores e regiões para filtros
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
    // Reset map bounds quando filtros mudam
    mapInitializedRef.current = false;
    loadData();
  }, [filterConsultant, filterRegion]);

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "-";
    const d = new Date(dateStr);
    return d.toLocaleDateString("pt-BR");
  };

  // Filtra propriedades por status de visita
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

  const propertiesWithCoords = properties
    .filter((p) => p.latitude && p.longitude)
    .filter(filterByStatus);

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, height: "calc(100vh - 100px)" }}>
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
        <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
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
            sx={{ minWidth: 180 }}
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
            sx={{ minWidth: 180 }}
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
            label="Status"
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
        </Typography>
      </Card>

      {/* Mapa */}
      <Card sx={{ height: "calc(100% - 180px)", position: "relative" }}>
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
                {/* Camada de satélite */}
                <TileLayer
                  attribution="&copy; Esri, Maxar, Earthstar Geographics"
                  url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                  maxZoom={19}
                />
                {/* Camada de labels (cidades, estradas, etc) sobre o satélite */}
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

            {propertiesWithCoords.map((prop) => {
              const showLabel = currentZoom >= 10;
              const markerColor = getMarkerColor(prop.last_visit?.days_ago ?? null);

              return (
                <Marker
                  key={`${prop.id}-${showLabel}`}
                  position={[prop.latitude, prop.longitude]}
                  icon={createColoredIcon(markerColor, showLabel && prop.client_name ? prop.client_name : undefined)}
                  eventHandlers={{
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
                        <Typography variant="caption" color="text.secondary">
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
            <ZoomTracker onZoomChange={setCurrentZoom} />
          </MapContainer>
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
  );
};

export default PropertiesMap;
