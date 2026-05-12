// src/components/VisitPhotos.tsx

import React, { useEffect, useState, useCallback } from "react";
import {
  Box,
  Button,
  Typography,
  TextField,
  IconButton,
  Paper,
  Stack,
} from "@mui/material";
import {
  CameraAlt as CameraIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Save as SaveIcon,
  SwapHoriz as SwapIcon,
  Close as CloseIcon,
} from "@mui/icons-material";
import { getAllPendingPhotos, savePendingPhoto } from "../utils/indexedDB";
import { Camera, CameraResultType } from "@capacitor/camera";
import EXIF from "exif-js";
import { API_BASE } from "../config";
import { notify, confirm as toastConfirm } from "../utils/toast";


// =========================================
// Tipagens
// =========================================
export type UnifiedPhoto = {
  id?: number;
  url?: string;
  caption?: string;

  pending?: boolean;
  dataUrl?: string;
  visit_id?: number;

  latitude?: number | null;
  longitude?: number | null;
};

interface Props {
  visitId: number | null;

  // fotos existentes (online)
  photos: UnifiedPhoto[];

  // upload de novas fotos
  onFilesSelected?: (files: File[], captions: string[]) => void;

  // EXIF → atualizar localização automaticamente
  onAutoLocation?: (lat: number, lon: number) => void;

  // nomes antigos (mantidos para compatibilidade)
  onEditSavedPhoto?: (photo: UnifiedPhoto, newCaption: string) => void;
  onDeleteSavedPhoto?: (photo: UnifiedPhoto) => void;
  onReplaceSavedPhoto?: (
    photo: UnifiedPhoto,
    newFile: File,
    newCaption: string
  ) => void;

  // nomes usados pelo Calendar (aliases)
  onEdit?: (photo: UnifiedPhoto, newCaption: string) => void;
  onDelete?: (photo: UnifiedPhoto) => void;
  onReplace?: (
    photo: UnifiedPhoto,
    newFile: File,
    newCaption: string
  ) => void;
}




// =========================================
// Componente principal
// =========================================
const VisitPhotos: React.FC<Props> = ({
  visitId,
  photos,
  onFilesSelected,
  onAutoLocation,
  onEditSavedPhoto,
  onDeleteSavedPhoto,
  onReplaceSavedPhoto,

  // aliases recebidos do Calendar
  onEdit,
  onDelete,
  onReplace
}) => {

  // Estado local REAL usado no render
  const [savedPhotos, setSavedPhotos] = useState<UnifiedPhoto[]>([]);

  // Upload de novas fotos (não salvas ainda)
  const [previews, setPreviews] = useState<string[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [captions, setCaptions] = useState<string[]>([]);

  // Edição de foto salva
  const [editingPhoto, setEditingPhoto] = useState<UnifiedPhoto | null>(null);
  const [editCaption, setEditCaption] = useState<string>("");
  const [editFile, setEditFile] = useState<File | null>(null);
  const [editPreview, setEditPreview] = useState<string | null>(null);

  const isMobileApp =
    typeof window !== "undefined" &&
    (window as any).Capacitor?.isNativePlatform === true &&
    !window.location.href.startsWith("http");

  const effectiveOnEdit = onEditSavedPhoto ?? onEdit;
  const effectiveOnDelete = onDeleteSavedPhoto ?? onDelete;
  const effectiveOnReplace = onReplaceSavedPhoto ?? onReplace;

  const resolveSrc = (p: UnifiedPhoto) => {
    const u = p?.dataUrl || p?.url || "";
    if (!u) return "";

    // offline base64
    if (u.startsWith("data:")) return u;

    // R2/public URL
    if (u.startsWith("http")) return u;

    // legado "/uploads/..."
    // ATENÇÃO: API_BASE normalmente termina com "/api/"
    // então precisamos da origem do backend sem "/api"
    const backendOrigin = API_BASE.replace(/\/api\/?$/, "");

    return u.startsWith("/") ? `${backendOrigin}${u}` : `${backendOrigin}/${u}`;
  };



  // ======================================================
  // Carregar fotos Offline
  // ======================================================
  const loadOffline = useCallback(async () => {
    if (!visitId) return [];

    const all = await getAllPendingPhotos();

    return all
      .filter((p) => p.visit_id === visitId)
      .map((p) => ({
        id: p.id,
        pending: true,
        dataUrl: p.dataUrl,
        caption: p.caption || "",
        visit_id: p.visit_id,
        latitude: p.latitude ?? null,
        longitude: p.longitude ?? null,
      }));
  }, [visitId]);

  // ======================================================
  // Merge online + offline sem duplicadas
  // ======================================================
  useEffect(() => {
    let mounted = true;

    async function merge() {
      const off = await loadOffline();

      // Começa com as fotos online
      const merged: UnifiedPhoto[] = [...(photos || [])];

      // Vai substituir ou adicionar offline
      off.forEach((offPhoto) => {
        const idx = merged.findIndex((p) => p.id === offPhoto.id);
        if (idx >= 0) {
          merged[idx] = offPhoto; // substitui online
        } else {
          merged.push(offPhoto); // adiciona pendente
        }
      });

      if (mounted) setSavedPhotos(merged);
    }

    merge();
    return () => {
      mounted = false;
    };
  }, [photos, loadOffline]);



  useEffect(() => {
    // só limpa quando mudar a visita (abrir outro modal / trocar id)
    setFiles([]);
    setCaptions([]);
    previews.forEach((u) => URL.revokeObjectURL(u));
    setPreviews([]);
  }, [visitId]);






  function extractGpsFromDataUrl(
    dataUrl: string
  ): Promise<{ latitude: number | null; longitude: number | null }> {
    return new Promise((resolve) => {
      try {
        const img = new Image();
        img.src = dataUrl;

        img.onload = () => {
          EXIF.getData(img as any, function (this: any) {
            const lat = EXIF.getTag(this, "GPSLatitude");
            const lon = EXIF.getTag(this, "GPSLongitude");
            const latRef = EXIF.getTag(this, "GPSLatitudeRef");
            const lonRef = EXIF.getTag(this, "GPSLongitudeRef");

            if (!lat || !lon) return resolve({ latitude: null, longitude: null });

            const toDecimal = (dms: number[]) =>
              dms[0] + dms[1] / 60 + dms[2] / 3600;

            let latitude = toDecimal(lat);
            let longitude = toDecimal(lon);

            if (latRef === "S") latitude *= -1;
            if (lonRef === "W") longitude *= -1;

            resolve({ latitude, longitude });
          });
        };

        img.onerror = () => resolve({ latitude: null, longitude: null });
      } catch {
        resolve({ latitude: null, longitude: null });
      }
    });
  }



  // ======================================================
  // Capturar pelo APK
  // ======================================================
  async function handleCameraCapture() {
    if (!visitId || visitId < 1) {
      notify.warning("Salve a visita antes de adicionar fotos");
      return;
    }

    try {
      const img = await Camera.getPhoto({
        quality: 80,
        resultType: CameraResultType.DataUrl,
        allowEditing: false,
      });

      if (!img.dataUrl) return;

      const dataUrl = img.dataUrl;
      const fileName = `foto_${Date.now()}.jpg`;

      // ✅ AGORA SIM: espera extrair EXIF antes de salvar
      const { latitude, longitude } = await extractGpsFromDataUrl(dataUrl);

      if (latitude != null && longitude != null) {
        onAutoLocation?.(latitude, longitude);
      }

      await savePendingPhoto({
        visit_id: visitId,
        fileName,
        mime: "image/jpeg",
        dataUrl,
        caption: "",
        synced: false,
        latitude,
        longitude,
      });

      notify.success("Foto salva offline");

      // Atualizar lista local imediatamente
      const off = await loadOffline();
      const merged: UnifiedPhoto[] = [...(photos || [])];

      off.forEach((p) => {
        const idx = merged.findIndex((x) => x.id === p.id);
        if (idx >= 0) merged[idx] = p;
        else merged.push(p);
      });

      setSavedPhotos(merged);
    } catch (err: any) {
      console.error("Erro Camera/Salvar:", err);
      notify.error(`Falha ao capturar/salvar foto: ${err?.message || err?.name || "erro desconhecido"}`);
    }
  }


  // ======================================================
  // Upload Web (novas fotos)
  // ======================================================
  const handleSelectFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!visitId || visitId < 1) {
      notify.warning("Salve a visita antes de adicionar fotos");
      return;
    }

    const fl = e.target.files;
    if (!fl) return;

    const arr = Array.from(fl);

    // 🔥 LIMPA previews antigos (evita bug e vazamento de memória)
    previews.forEach((u) => URL.revokeObjectURL(u));

    // 📍 EXIF da primeira foto (auto localização)
    if (arr.length > 0 && onAutoLocation) {
      const first = arr[0];

      EXIF.getData(first, function (this: any) {
        const lat = EXIF.getTag(this, "GPSLatitude");
        const lon = EXIF.getTag(this, "GPSLongitude");
        const latRef = EXIF.getTag(this, "GPSLatitudeRef");
        const lonRef = EXIF.getTag(this, "GPSLongitudeRef");

        if (lat && lon) {
          const toDecimal = (dms: number[]) =>
            dms[0] + dms[1] / 60 + dms[2] / 3600;

          let latitude = toDecimal(lat);
          let longitude = toDecimal(lon);

          if (latRef === "S") latitude *= -1;
          if (lonRef === "W") longitude *= -1;

          onAutoLocation(latitude, longitude);
        }
      });
    }

    // 📸 gera previews novos
    const nextPreviews = arr.map((f) => URL.createObjectURL(f));

    setFiles(arr);
    setPreviews(nextPreviews);
    setCaptions(arr.map(() => ""));

    console.log("📥 VisitPhotos handleSelectFiles files:", arr.length);

   
    onFilesSelected?.(arr, arr.map(() => ""));
    e.target.value = "";
  };


  useEffect(() => {
    return () => {
      previews.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [previews]);


  // ======================================================
  // Sincronizar legendas dos previews
  // ======================================================
  useEffect(() => {
    if (!onFilesSelected || files.length === 0) return;
    onFilesSelected(files, captions);
  }, [captions, files, onFilesSelected]);

  // ======================================================
  // Abertura do painel de edição
  // ======================================================
  const openEditPanel = (photo: UnifiedPhoto) => {
    setEditingPhoto(photo);
    setEditCaption(photo.caption || "");
    setEditFile(null);
    setEditPreview(photo.dataUrl || photo.url || null);
  };

  const handleEditFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fl = e.target.files;
    if (!fl || fl.length === 0) return;

    const file = fl[0];
    setEditFile(file);
    setEditPreview(URL.createObjectURL(file));
  };

  const handleSaveCaption = () => {
    if (!editingPhoto) return;

    // Atualiza local
    setSavedPhotos((prev) =>
      prev.map((p) =>
        p.id === editingPhoto.id ? { ...p, caption: editCaption } : p
      )
    );

    // Dispara para o pai (Calendar) salvar de fato
    effectiveOnEdit?.(editingPhoto, editCaption);
  };

  const handleDeletePhoto = () => {
    if (!editingPhoto) return;
    toastConfirm("Deseja realmente excluir esta foto?", () => {
      setSavedPhotos((prev) => prev.filter((p) => p.id !== editingPhoto.id));
      effectiveOnDelete?.(editingPhoto);
      setEditingPhoto(null);
    });
  };

  const handleReplacePhoto = () => {
    if (!editingPhoto || !editFile) {
      notify.warning("Selecione uma nova imagem para substituir");
      return;
    }

    // Dispara para o pai (apagar/criar nova + salvar legenda)
    effectiveOnReplace?.(editingPhoto, editFile, editCaption);

    // Atualiza render localmente (preview novo + legenda)
    const previewUrl = URL.createObjectURL(editFile);

    setSavedPhotos((prev) =>
      prev.map((p) =>
        p.id === editingPhoto.id
          ? { ...p, caption: editCaption, dataUrl: previewUrl }
          : p
      )
    );
  };

  // ======================================================
  // Render
  // ======================================================
  return (
    <Box sx={{ mt: 2 }}>
      <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
        📸 Fotos
      </Typography>

      {isMobileApp ? (
        <Button
          variant="contained"
          fullWidth
          startIcon={<CameraIcon />}
          onClick={handleCameraCapture}
        >
          Tirar Foto
        </Button>
      ) : (
        <TextField
          type="file"
          fullWidth
          size="small"
          slotProps={{
            htmlInput: { multiple: true, accept: "image/*" },
          }}
          onChange={handleSelectFiles}
        />
      )}

      {/* Previews de novas fotos (ainda não salvas) */}
      {previews.length > 0 && (
        <Box sx={{ mt: 2 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
            {savedPhotos.length > 0 ? "🆕 Novas fotos" : "📸 Fotos"}
          </Typography>

          <Stack direction="row" spacing={2} sx={{ flexWrap: "wrap" }} useFlexGap>
            {previews.map((src, idx) => (
              <Box key={idx} sx={{ width: 130 }}>
                <Box
                  component="img"
                  src={src}
                  sx={{
                    width: 130,
                    height: 130,
                    objectFit: "cover",
                    borderRadius: 2,
                  }}
                />
                <TextField
                  size="small"
                  fullWidth
                  placeholder="Legenda..."
                  value={captions[idx] || ""}
                  onChange={(e) => {
                    const arr = [...captions];
                    arr[idx] = e.target.value;
                    setCaptions(arr);
                  }}
                  sx={{ mt: 1 }}
                />
              </Box>
            ))}
          </Stack>
        </Box>
      )}

      {/* Fotos salvas (online + offline) */}
      {savedPhotos.length > 0 && (
        <Box sx={{ mt: 3 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
            {previews.length > 0 ? "📁 Fotos salvas" : "📸 Fotos"}
          </Typography>

          <Stack direction="row" spacing={2} sx={{ flexWrap: "wrap" }} useFlexGap>
            {savedPhotos.map((p) => (
              <Box key={p.id ?? p.url ?? p.dataUrl ?? Math.random()} sx={{ width: 130 }}>
                <Box
                  component="img"
                  src={resolveSrc(p)}
                  sx={{
                    width: 130,
                    height: 130,
                    objectFit: "cover",
                    borderRadius: 2,
                  }}
                />
                <Typography
                  variant="caption"
                  sx={{
                    display: "block",
                    mt: 0.5,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                  title={p.caption || ""}
                >
                  {p.caption || <span style={{ opacity: 0.5 }}>Sem legenda</span>}
                </Typography>

                <Stack direction="row" spacing={0.5} sx={{ mt: 0.5 }}>
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => openEditPanel(p)}
                    sx={{ flex: 1, minWidth: 0 }}
                  >
                    <EditIcon fontSize="small" />
                  </Button>
                  <IconButton
                    size="small"
                    color="error"
                    onClick={() => {
                      toastConfirm("Deseja realmente excluir esta foto?", () => {
                        setSavedPhotos((prev) => prev.filter((x) => x.id !== p.id));
                        effectiveOnDelete?.(p);
                        if (editingPhoto?.id === p.id) setEditingPhoto(null);
                      });
                    }}
                    disabled={!effectiveOnDelete}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Stack>
              </Box>
            ))}
          </Stack>
        </Box>
      )}

      {/* Painel de edição de foto salva */}
      {editingPhoto && (
        <Paper
          variant="outlined"
          sx={{ mt: 3, p: 2 }}
        >
          <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 2 }}>
            Editar foto selecionada
          </Typography>

          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <Box
              component="img"
              src={editPreview || editingPhoto.dataUrl || editingPhoto.url || ""}
              sx={{
                width: 180,
                height: 180,
                objectFit: "cover",
                borderRadius: 2,
              }}
            />

            <Box sx={{ flex: 1, minWidth: 220 }}>
              <TextField
                fullWidth
                size="small"
                label="Legenda"
                value={editCaption}
                onChange={(e) => setEditCaption(e.target.value)}
                sx={{ mb: 2 }}
              />

              <TextField
                fullWidth
                size="small"
                type="file"
                label="Substituir imagem (opcional)"
                slotProps={{
                  htmlInput: { accept: "image/*" },
                  inputLabel: { shrink: true },
                }}
                onChange={handleEditFileChange}
                sx={{ mb: 2 }}
              />

              <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }} useFlexGap>
                <Button
                  size="small"
                  variant="contained"
                  color="success"
                  startIcon={<SaveIcon />}
                  onClick={handleSaveCaption}
                >
                  Salvar
                </Button>
                <Button
                  size="small"
                  variant="contained"
                  color="warning"
                  startIcon={<SwapIcon />}
                  onClick={handleReplacePhoto}
                  disabled={!effectiveOnReplace}
                >
                  Substituir
                </Button>
                <Button
                  size="small"
                  variant="contained"
                  color="error"
                  startIcon={<DeleteIcon />}
                  onClick={handleDeletePhoto}
                  disabled={!effectiveOnDelete}
                >
                  Excluir
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<CloseIcon />}
                  onClick={() => setEditingPhoto(null)}
                >
                  Cancelar
                </Button>
              </Stack>
            </Box>
          </Stack>
        </Paper>
      )}
    </Box>
  );
};

export default VisitPhotos;
