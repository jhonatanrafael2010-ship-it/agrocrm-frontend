import React, { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  MenuItem,
  Box,
  Typography,
  IconButton,
  Tabs,
  Tab,
  Stack,
  Paper,
} from "@mui/material";
import {
  Close as CloseIcon,
  MyLocation as LocationIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  Today as TodayIcon,
} from "@mui/icons-material";
import { Geolocation } from "@capacitor/geolocation";
import { notify } from "../utils/toast";

type Product = {
  product_name: string;
  dose: string;
  unit: string;
  application_date: string | null;
};

type Client = { id: number; name: string };
type Property = { id: number; client_id?: number; name: string };
type Plot = { id: number; property_id?: number; name: string };
type Culture = { id: number; name: string };
type Variety = { id: number; culture: string; name: string };
type Consultant = { id: number; name: string };

export type VisitFormModalData = {
  date: string;
  client_id: string;
  property_id: string;
  plot_id: string;
  consultant_id: string;
  culture: string;
  variety: string;
  recommendation: string;
  fenologia_real: string;
  latitude: number | null;
  longitude: number | null;
  products: Product[];
};

type Props = {
  open: boolean;
  onClose: () => void;
  onSave: (data: VisitFormModalData) => Promise<void> | void;
  theme?: string;
  title?: string;
  clients: Client[];
  properties: Property[];
  plots: Plot[];
  cultures: Culture[];
  varieties: Variety[];
  consultants: Consultant[];
  initialData?: Partial<VisitFormModalData>;
};

const buildEmptyForm = (): VisitFormModalData => ({
  date: "",
  client_id: "",
  property_id: "",
  plot_id: "",
  consultant_id: "",
  culture: "",
  variety: "",
  recommendation: "",
  fenologia_real: "",
  latitude: null,
  longitude: null,
  products: [],
});

const VisitFormModal: React.FC<Props> = ({
  open,
  onClose,
  onSave,
  title = "Nova Visita",
  clients,
  properties,
  plots,
  cultures,
  varieties,
  consultants,
  initialData,
}) => {
  const [tab, setTab] = useState(0);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<VisitFormModalData>(buildEmptyForm());

  useEffect(() => {
    if (!open) return;

    const now = new Date();
    const todayBR =
      String(now.getDate()).padStart(2, "0") +
      "/" +
      String(now.getMonth() + 1).padStart(2, "0") +
      "/" +
      now.getFullYear();

    setForm({
      ...buildEmptyForm(),
      date: initialData?.date || todayBR,
      client_id: initialData?.client_id || "",
      property_id: initialData?.property_id || "",
      plot_id: initialData?.plot_id || "",
      consultant_id: initialData?.consultant_id || "",
      culture: initialData?.culture || "",
      variety: initialData?.variety || "",
      recommendation: initialData?.recommendation || "",
      fenologia_real: initialData?.fenologia_real || "",
      latitude: initialData?.latitude ?? null,
      longitude: initialData?.longitude ?? null,
      products: initialData?.products || [],
    });

    setTab(0);
  }, [open, initialData]);

  const filteredProperties = useMemo(() => {
    return properties.filter(
      (p) => String(p.client_id || "") === String(form.client_id || "")
    );
  }, [properties, form.client_id]);

  const filteredPlots = useMemo(() => {
    return plots.filter(
      (pl) => String(pl.property_id || "") === String(form.property_id || "")
    );
  }, [plots, form.property_id]);

  const filteredVarieties = useMemo(() => {
    if (!form.culture) return [];
    return varieties.filter(
      (v) =>
        String(v.culture || "").toLowerCase() ===
        String(form.culture || "").toLowerCase()
    );
  }, [varieties, form.culture]);

  const handleChange = (name: string, value: string) => {
    setForm((f) => ({ ...f, [name]: value }));
  };

  const handleGetLocation = async () => {
    try {
      const position = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 15000,
      });

      const { latitude, longitude } = position.coords;

      setForm((f) => ({ ...f, latitude, longitude }));

      localStorage.setItem(
        "lastLocation",
        JSON.stringify({ latitude, longitude })
      );

      notify.success(`Localização capturada: ${latitude.toFixed(5)}, ${longitude.toFixed(5)}`);
    } catch (err) {
      console.error("Erro ao obter localização GPS:", err);

      const cached = localStorage.getItem("lastLocation");
      if (cached) {
        try {
          const { latitude, longitude } = JSON.parse(cached);
          setForm((f) => ({ ...f, latitude, longitude }));
          notify.warning("GPS indisponível — usando última localização conhecida");
          return;
        } catch {
          // cache corrompido
        }
      }

      notify.error("Não foi possível capturar localização. Verifique as permissões de GPS.");
    }
  };

  const handleSave = async () => {
    if (!form.date) {
      notify.warning("Data é obrigatória.");
      return;
    }

    if (!form.client_id) {
      notify.warning("Cliente é obrigatório.");
      return;
    }

    try {
      setSaving(true);
      await onSave(form);
    } finally {
      setSaving(false);
    }
  };

  const setToday = () => {
    const now = new Date();
    const tStr =
      String(now.getDate()).padStart(2, "0") +
      "/" +
      String(now.getMonth() + 1).padStart(2, "0") +
      "/" +
      now.getFullYear();
    setForm((f) => ({ ...f, date: tStr }));
  };

  const updateProduct = (index: number, field: keyof Product, value: string) => {
    const updated = [...form.products];
    updated[index] = { ...updated[index], [field]: value };
    setForm((f) => ({ ...f, products: updated }));
  };

  const removeProduct = (index: number) => {
    setForm((f) => ({
      ...f,
      products: f.products.filter((_, idx) => idx !== index),
    }));
  };

  const addProduct = () => {
    setForm((f) => ({
      ...f,
      products: [
        ...f.products,
        { product_name: "", dose: "", unit: "", application_date: null },
      ],
    }));
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

      <Box sx={{ borderBottom: 1, borderColor: "divider", px: 2 }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)}>
          <Tab label="📝 Dados da Visita" />
          <Tab label="🧪 Produtos Aplicados" />
        </Tabs>
      </Box>

      <DialogContent>
        {tab === 0 && (
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <Box sx={{ flex: 1 }}>
                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 0.5 }}>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>Data</Typography>
                  <Button size="small" startIcon={<TodayIcon />} onClick={setToday}>
                    Hoje
                  </Button>
                </Box>
                <TextField
                  fullWidth
                  size="small"
                  name="date"
                  value={form.date}
                  onChange={(e) => handleChange("date", e.target.value)}
                  placeholder="dd/mm/aaaa"
                />
              </Box>

              <TextField
                select
                fullWidth
                size="small"
                label="Cliente"
                value={form.client_id}
                onChange={(e) => handleChange("client_id", e.target.value)}
                sx={{ flex: 2 }}
              >
                <MenuItem value="">Selecione</MenuItem>
                {clients.map((c) => (
                  <MenuItem key={c.id} value={String(c.id)}>{c.name}</MenuItem>
                ))}
              </TextField>
            </Stack>

            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField
                select
                fullWidth
                size="small"
                label="Propriedade"
                value={form.property_id}
                onChange={(e) => {
                  setForm((f) => ({ ...f, property_id: e.target.value, plot_id: "" }));
                }}
              >
                <MenuItem value="">Selecione</MenuItem>
                {filteredProperties.map((p) => (
                  <MenuItem key={p.id} value={String(p.id)}>{p.name}</MenuItem>
                ))}
              </TextField>

              <TextField
                select
                fullWidth
                size="small"
                label="Talhão"
                value={form.plot_id}
                onChange={(e) => handleChange("plot_id", e.target.value)}
              >
                <MenuItem value="">Selecione</MenuItem>
                {filteredPlots.map((pl) => (
                  <MenuItem key={pl.id} value={String(pl.id)}>{pl.name}</MenuItem>
                ))}
              </TextField>
            </Stack>

            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField
                select
                fullWidth
                size="small"
                label="Cultura"
                value={form.culture}
                onChange={(e) => {
                  setForm((f) => ({ ...f, culture: e.target.value, variety: "" }));
                }}
              >
                <MenuItem value="">Selecione</MenuItem>
                {cultures.map((c) => (
                  <MenuItem key={c.id} value={c.name}>{c.name}</MenuItem>
                ))}
              </TextField>

              <TextField
                select
                fullWidth
                size="small"
                label="Variedade"
                value={form.variety}
                onChange={(e) => handleChange("variety", e.target.value)}
                disabled={!form.culture}
              >
                <MenuItem value="">Selecione</MenuItem>
                {filteredVarieties.map((v) => (
                  <MenuItem key={v.id} value={v.name}>{v.name}</MenuItem>
                ))}
              </TextField>
            </Stack>

            <TextField
              select
              fullWidth
              size="small"
              label="Consultor"
              value={form.consultant_id}
              onChange={(e) => handleChange("consultant_id", e.target.value)}
            >
              <MenuItem value="">Selecione</MenuItem>
              {consultants.map((c) => (
                <MenuItem key={c.id} value={String(c.id)}>{c.name}</MenuItem>
              ))}
            </TextField>

            <Button
              variant="outlined"
              size="small"
              startIcon={<LocationIcon />}
              onClick={handleGetLocation}
              sx={{ alignSelf: "flex-start" }}
            >
              Capturar Localização
            </Button>

            <TextField
              fullWidth
              size="small"
              label="Fenologia Observada"
              value={form.fenologia_real}
              onChange={(e) => handleChange("fenologia_real", e.target.value)}
              placeholder="Ex: V6, R1, 6 folhas..."
            />

            <TextField
              fullWidth
              size="small"
              label="Observações"
              value={form.recommendation}
              onChange={(e) => handleChange("recommendation", e.target.value)}
              placeholder="Descreva observações..."
              multiline
              rows={3}
            />
          </Stack>
        )}

        {tab === 1 && (
          <Box sx={{ mt: 1 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 2 }}>
              Produtos Aplicados
            </Typography>

            <Stack spacing={2}>
              {form.products.map((p, i) => (
                <Paper key={i} variant="outlined" sx={{ p: 2 }}>
                  <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ alignItems: "center" }}>
                    <TextField
                      size="small"
                      placeholder="Produto"
                      value={p.product_name}
                      onChange={(e) => updateProduct(i, "product_name", e.target.value)}
                      sx={{ flex: 2 }}
                    />
                    <TextField
                      size="small"
                      placeholder="Dose"
                      value={p.dose}
                      onChange={(e) => updateProduct(i, "dose", e.target.value)}
                      sx={{ flex: 1 }}
                    />
                    <TextField
                      size="small"
                      placeholder="Unidade"
                      value={p.unit}
                      onChange={(e) => updateProduct(i, "unit", e.target.value)}
                      sx={{ flex: 1 }}
                    />
                    <TextField
                      size="small"
                      type="date"
                      value={p.application_date || ""}
                      onChange={(e) => updateProduct(i, "application_date", e.target.value)}
                      sx={{ flex: 1 }}
                    />
                    <IconButton color="error" onClick={() => removeProduct(i)}>
                      <DeleteIcon />
                    </IconButton>
                  </Stack>
                </Paper>
              ))}
            </Stack>

            <Button
              variant="outlined"
              size="small"
              startIcon={<AddIcon />}
              onClick={addProduct}
              sx={{ mt: 2 }}
            >
              Adicionar Produto
            </Button>
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} color="inherit">
          Cancelar
        </Button>
        <Button
          variant="contained"
          color="success"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? "Salvando..." : "Salvar"}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default VisitFormModal;
