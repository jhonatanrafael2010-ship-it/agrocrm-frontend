import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  IconButton,
  TextField,
  Stack,
} from "@mui/material";
import {
  MyLocation as MyLocationIcon,
  Close as CloseIcon,
  Search as SearchIcon,
} from "@mui/icons-material";
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { notify } from "../utils/toast";

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

type Props = {
  open: boolean;
  onClose: () => void;
  onSelect: (lat: number, lng: number) => void;
  initialLat?: number;
  initialLng?: number;
  title?: string;
};

function MapClickHandler({ onLocationSelect }: { onLocationSelect: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onLocationSelect(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function MapCenterUpdater({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, map.getZoom());
  }, [center, map]);
  return null;
}

const LocationPicker: React.FC<Props> = ({
  open,
  onClose,
  onSelect,
  initialLat,
  initialLng,
  title = "Selecionar Localização",
}) => {
  // Centro padrão: Brasil central (Goiânia)
  const defaultCenter: [number, number] = [-16.6869, -49.2648];

  const [position, setPosition] = useState<[number, number]>(
    initialLat && initialLng ? [initialLat, initialLng] : defaultCenter
  );
  const [searchText, setSearchText] = useState("");
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (initialLat && initialLng) {
      setPosition([initialLat, initialLng]);
    }
  }, [initialLat, initialLng]);

  const handleLocationSelect = (lat: number, lng: number) => {
    setPosition([lat, lng]);
  };

  const handleGetCurrentLocation = async () => {
    try {
      const { Geolocation } = await import("@capacitor/geolocation");
      const pos = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 15000,
      });
      const { latitude, longitude } = pos.coords;
      setPosition([latitude, longitude]);
    } catch (err) {
      console.error("Erro ao obter localização:", err);
      notify.error("Não foi possível obter sua localização atual");
    }
  };

  const handleSearch = async () => {
    if (!searchText.trim()) return;

    setSearching(true);
    try {
      // Usa Nominatim (OpenStreetMap) para geocoding gratuito
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchText)}&limit=1`
      );
      const data = await response.json();

      if (data && data.length > 0) {
        const { lat, lon } = data[0];
        setPosition([parseFloat(lat), parseFloat(lon)]);
      } else {
        notify.warning("Localização não encontrada");
      }
    } catch (err) {
      console.error("Erro na busca:", err);
      notify.error("Erro ao buscar localização");
    } finally {
      setSearching(false);
    }
  };

  const handleConfirm = () => {
    onSelect(position[0], position[1]);
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Typography variant="h6" sx={{ fontWeight: 600 }}>
          {title}
        </Typography>
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ p: 0 }}>
        {/* Barra de busca */}
        <Box sx={{ p: 2, borderBottom: 1, borderColor: "divider" }}>
          <Stack direction="row" spacing={1}>
            <TextField
              size="small"
              fullWidth
              placeholder="Buscar endereço, cidade ou fazenda..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              disabled={searching}
            />
            <Button
              variant="outlined"
              onClick={handleSearch}
              disabled={searching}
              sx={{ minWidth: 50 }}
            >
              <SearchIcon />
            </Button>
            <Button
              variant="contained"
              onClick={handleGetCurrentLocation}
              startIcon={<MyLocationIcon />}
              sx={{ whiteSpace: "nowrap" }}
            >
              Minha Localização
            </Button>
          </Stack>
        </Box>

        {/* Mapa */}
        <Box sx={{ height: 400 }}>
          <MapContainer
            center={position}
            zoom={13}
            style={{ height: "100%", width: "100%" }}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <Marker
              position={position}
              draggable
              eventHandlers={{
                dragend: (e) => {
                  const marker = e.target;
                  const pos = marker.getLatLng();
                  setPosition([pos.lat, pos.lng]);
                },
              }}
            />
            <MapClickHandler onLocationSelect={handleLocationSelect} />
            <MapCenterUpdater center={position} />
          </MapContainer>
        </Box>

        {/* Coordenadas selecionadas */}
        <Box sx={{ p: 2, bgcolor: "action.hover" }}>
          <Typography variant="body2" color="text.secondary">
            Coordenadas selecionadas:
          </Typography>
          <Typography variant="body1" sx={{ fontWeight: 600, fontFamily: "monospace" }}>
            {position[0].toFixed(6)}, {position[1].toFixed(6)}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Clique no mapa ou arraste o marcador para ajustar
          </Typography>
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} color="inherit">
          Cancelar
        </Button>
        <Button variant="contained" onClick={handleConfirm}>
          Confirmar Localização
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default LocationPicker;
