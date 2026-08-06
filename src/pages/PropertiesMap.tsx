import React, { useEffect, useState } from "react";
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
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
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

const createColoredIcon = (color: string) => {
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

function MapBoundsUpdater({ properties }: { properties: PropertyMapItem[] }) {
  const map = useMap();

  useEffect(() => {
    if (properties.length > 0) {
      const bounds = L.latLngBounds(
        properties.map((p) => [p.latitude, p.longitude])
      );
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 12 });
    }
  }, [properties, map]);

  return null;
}

const PropertiesMap: React.FC = () => {
  const [properties, setProperties] = useState<PropertyMapItem[]>([]);
  const [consultants, setConsultants] = useState<Consultant[]>([]);
  const [regions, setRegions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [mapType, setMapType] = useState<"street" | "satellite">("satellite");
  const [filterConsultant, setFilterConsultant] = useState("");
  const [filterRegion, setFilterRegion] = useState("");

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
    loadData();
  }, [filterConsultant, filterRegion]);

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "-";
    const d = new Date(dateStr);
    return d.toLocaleDateString("pt-BR");
  };

  const propertiesWithCoords = properties.filter(
    (p) => p.latitude && p.longitude
  );

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

          <Box sx={{ flex: 1 }} />

          {/* Legenda */}
          <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
            <Chip
              size="small"
              label="< 7 dias"
              sx={{ bgcolor: "#22c55e", color: "white" }}
            />
            <Chip
              size="small"
              label="8-15 dias"
              sx={{ bgcolor: "#eab308", color: "white" }}
            />
            <Chip
              size="small"
              label="16-30 dias"
              sx={{ bgcolor: "#f97316", color: "white" }}
            />
            <Chip
              size="small"
              label="> 30 dias"
              sx={{ bgcolor: "#ef4444", color: "white" }}
            />
            <Chip
              size="small"
              label="Sem visita"
              sx={{ bgcolor: "#6b7280", color: "white" }}
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
              <TileLayer
                attribution="&copy; Esri, Maxar, Earthstar Geographics"
                url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                maxZoom={19}
              />
            ) : (
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
            )}

            {propertiesWithCoords.map((prop) => (
              <Marker
                key={prop.id}
                position={[prop.latitude, prop.longitude]}
                icon={createColoredIcon(
                  getMarkerColor(prop.last_visit?.days_ago ?? null)
                )}
              >
                <Popup>
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
            ))}

            <MapBoundsUpdater properties={propertiesWithCoords} />
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
