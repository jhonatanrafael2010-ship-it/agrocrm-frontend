// src/components/VisitPhotos.tsx

import React, { useEffect, useState, useCallback } from "react";
import { getAllPendingPhotos, savePendingPhoto } from "../utils/indexedDB";
import { Camera, CameraResultType } from "@capacitor/camera";
import EXIF from "exif-js";

// =========================================
// Tipagens
// =========================================
type UnifiedPhoto = {
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
  existingPhotos: UnifiedPhoto[];
  onFilesSelected?: (files: File[], captions: string[]) => void;
  onAutoSetLocation?: (lat: number, lon: number) => void;

  //  ✅ Permite editar legenda de fotos já salvas
  onEditSavedPhoto?: (photo: UnifiedPhoto, newCaption: string) => void;
}

// =========================================
// Componente principal
// =========================================
const VisitPhotos: React.FC<Props> = ({
  visitId,
  existingPhotos,
  onFilesSelected,
  onAutoSetLocation,
  onEditSavedPhoto,
}) => {

  // Estado local REAL usado no render
  const [savedPhotos, setSavedPhotos] = useState<UnifiedPhoto[]>([]);

  const [previews, setPreviews] = useState<string[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [captions, setCaptions] = useState<string[]>([]);

  const isMobileApp =
    typeof window !== "undefined" &&
    (window as any).Capacitor?.isNativePlatform === true &&
    !window.location.href.startsWith("http");

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
      const merged = [...(existingPhotos || [])];

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
  }, [existingPhotos, loadOffline]);

  // ======================================================
  // Capturar pelo APK
  // ======================================================
  async function handleCameraCapture() {
    if (!visitId || visitId < 1) {
      alert("⚠️ Primeiro SALVE a visita antes de adicionar fotos.");
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

      let latitude: number | null = null;
      let longitude: number | null = null;

      // Extrair EXIF
      try {
        const el = new Image();
        el.src = dataUrl;

        el.onload = () => {
          EXIF.getData(el, function (this: any) {
            const lat = EXIF.getTag(this, "GPSLatitude");
            const lon = EXIF.getTag(this, "GPSLongitude");
            const latRef = EXIF.getTag(this, "GPSLatitudeRef");
            const lonRef = EXIF.getTag(this, "GPSLongitudeRef");

            if (lat && lon) {
              const toDecimal = (dms: number[]) =>
                dms[0] + dms[1] / 60 + dms[2] / 3600;

              latitude = toDecimal(lat);
              longitude = toDecimal(lon);

              if (latRef === "S") latitude *= -1;
              if (lonRef === "W") longitude *= -1;

              if (onAutoSetLocation) onAutoSetLocation(latitude, longitude);
            }
          });
        };
      } catch {}

      // Salva offline
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

      alert("📸 Foto salva offline!");

      // Atualizar lista local imediatamente
      const off = await loadOffline();
      const merged = [...(existingPhotos || [])];

      off.forEach((p) => {
        const idx = merged.findIndex((x) => x.id === p.id);
        if (idx >= 0) merged[idx] = p;
        else merged.push(p);
      });

      setSavedPhotos(merged);
    } catch (err) {
      console.error("Erro Camera:", err);
      alert("❌ Falha ao capturar foto.");
    }
  }

  // ======================================================
  // Upload Web
  // ======================================================
  const handleSelectFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!visitId || visitId < 1) {
      alert("⚠️ Salve a visita antes de adicionar fotos.");
      return;
    }

    const fl = e.target.files;
    if (!fl) return;

    const arr = Array.from(fl);

    // EXIF da primeira foto
    if (arr.length > 0 && onAutoSetLocation) {
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

          onAutoSetLocation(latitude, longitude);
        }
      });
    }

    setFiles(arr);
    setPreviews(arr.map((f) => URL.createObjectURL(f)));
    setCaptions(arr.map(() => ""));

    if (onFilesSelected) onFilesSelected(arr, arr.map(() => ""));
  };

  // ======================================================
  // Sincronizar legendas dos previews
  // ======================================================
  useEffect(() => {
    if (!onFilesSelected || files.length === 0) return;
    onFilesSelected(files, captions);
  }, [captions]);

  // ======================================================
  // Render
  // ======================================================
  return (
    <div className="col-12 mt-3">
      <label className="form-label fw-semibold">📸 Fotos</label>

      {isMobileApp ? (
        <button className="btn btn-primary w-100" onClick={handleCameraCapture}>
          📸 Tirar Foto
        </button>
      ) : (
        <input
          type="file"
          multiple
          accept="image/*"
          className="form-control"
          onChange={handleSelectFiles}
        />
      )}

      {/* Previews */}
      {previews.length > 0 && (
        <div className="d-flex flex-wrap gap-3 mt-3">
          {previews.map((src, idx) => (
            <div key={idx} style={{ width: 130 }}>
              <img
                src={src}
                style={{
                  width: "130px",
                  height: "130px",
                  objectFit: "cover",
                  borderRadius: 10,
                }}
              />

              <input
                type="text"
                placeholder="Legenda..."
                className="form-control form-control-sm mt-1"
                value={captions[idx] || ""}
                onChange={(e) => {
                  const arr = [...captions];
                  arr[idx] = e.target.value;
                  setCaptions(arr);
                }}
              />
            </div>
          ))}
        </div>
      )}

      {/* Fotos salvas */}
      {savedPhotos.length > 0 && (
        <div className="mt-4">
          <label className="form-label fw-semibold">📁 Fotos salvas</label>

          <div className="d-flex flex-wrap gap-3">
            {savedPhotos.map((p) => (
              <div key={p.id} style={{ width: 130 }}>
                <img
                  src={p.dataUrl || p.url || ""}
                  style={{
                    width: "130px",
                    height: "130px",
                    objectFit: "cover",
                    borderRadius: 10,
                  }}
                />

                <input
                  type="text"
                  className="form-control form-control-sm mt-1"
                  value={p.caption || ""}
                  onChange={(e) => {
                    // Atualiza imediatamente no componente
                    setSavedPhotos((prev) =>
                      prev.map((x) =>
                        x.id === p.id ? { ...x, caption: e.target.value } : x
                      )
                    );

                    // E dispara para o Calendar salvar no backend/IndexedDB
                    onEditSavedPhoto?.(p, e.target.value);
                  }}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default VisitPhotos;
