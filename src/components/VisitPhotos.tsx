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

  // EXIF → atualiza coordenadas no Calendar.tsx
  onAutoSetLocation?: (lat: number, lon: number) => void;
}

// =========================================
// Componente principal
// =========================================
const VisitPhotos: React.FC<Props> = ({
  visitId,
  existingPhotos,
  onFilesSelected,
  onAutoSetLocation,
}) => {
  const [savedPhotos, setSavedPhotos] = useState<UnifiedPhoto[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [captions, setCaptions] = useState<string[]>([]);

  const isMobileApp =
    typeof window !== "undefined" &&
    (window as any).Capacitor?.isNativePlatform === true &&
    !window.location.href.startsWith("http");

  // ======================================================
  // Carregar fotos Off-line com EXIF
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

  useEffect(() => {
    let mounted = true;

    async function merge() {
      const off = await loadOffline();
      if (mounted) {
        setSavedPhotos([...(existingPhotos || []), ...off]);
      }
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

      const dataUrl = img.dataUrl;
      if (!dataUrl) return;

      const fileName = `foto_${Date.now()}.jpg`;

      let latitude: number | null = null;
      let longitude: number | null = null;

      // EXTRAIR EXIF
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

              console.log("📍 EXIF APK:", latitude, longitude);

              if (onAutoSetLocation) onAutoSetLocation(latitude, longitude);
            }
          });
        };
      } catch {}

      // SALVAR OFFLINE
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

      const off = await loadOffline();
      setSavedPhotos([...(existingPhotos || []), ...off]);

    } catch (err) {
      console.error("Erro:", err);
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

    // Extrair EXIF da primeira foto
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

          console.log("📍 EXIF WEB:", latitude, longitude);
          onAutoSetLocation(latitude, longitude);
        }
      });
    }

    // Previews e controle normal
    setFiles(arr);
    setPreviews(arr.map((f) => URL.createObjectURL(f)));
    setCaptions(arr.map(() => ""));

    if (onFilesSelected) {
      onFilesSelected(arr, arr.map(() => ""));
    }
  };

  // ======================================================
  // Sincronizar legendas
  // ======================================================
  useEffect(() => {
    if (!onFilesSelected || files.length === 0) return;
    onFilesSelected(files, captions);
  }, [captions]);

  if (previews.length !== captions.length) {
    setCaptions(previews.map(() => ""));
  }

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
            {savedPhotos.map((p, idx) => (
              <div key={idx} style={{ width: 130 }}>
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
                  disabled
                  value={p.caption || ""}
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
