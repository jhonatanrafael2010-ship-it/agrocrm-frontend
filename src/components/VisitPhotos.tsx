import React, { useEffect, useState, useCallback } from "react";
import { API_BASE } from "../config";
import { getAllPendingPhotos, savePendingPhoto } from "../utils/indexedDB";
import { Camera, CameraResultType } from "@capacitor/camera";
import EXIF from "exif-js";


type UnifiedPhoto = {
  id?: number;
  url?: string;
  caption?: string;

  // offline
  pending?: boolean;
  dataUrl?: string;
  visit_id?: number;
};

interface Props {
  visitId: number | null;
  existingPhotos: UnifiedPhoto[];
  onFilesSelected?: (files: File[], captions: string[]) => void;

  // 🔥 NOVO → envia coordenadas EXIF para o Calendar
  onAutoSetLocation?: (lat: number, lon: number) => void;
}


/**
 * VisitPhotos — UI pura
 * - Web: input file normal
 * - APK: botão da câmera
 * - exibe fotos online + offline
 * - exibe previews SEM duplicar
 */
const VisitPhotos: React.FC<Props> = ({
  visitId,
  existingPhotos,
  onFilesSelected,
  onAutoSetLocation,   // 🔥 AGORA EXISTE
}) => {
  const [savedPhotos, setSavedPhotos] = useState<UnifiedPhoto[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [captions, setCaptions] = useState<string[]>([]);

  // 🔍 DETECÇÃO SEGURA DO APK
  const isMobileApp =
    typeof window !== "undefined" &&
    (window as any).Capacitor?.isNativePlatform === true &&
    !window.location.href.startsWith("http");

  // ======================================================
  // 🔄 Carregar fotos OFFLINE corretamente
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
      }));
  }, [visitId]);

  // ======================================================
  // 🔄 Merge inicial: online + offline
  // ======================================================
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
  // 📸 APK — captura via câmera nativa
  // ======================================================
  async function handleCameraCapture() {
    if (!visitId || Number(visitId) < 1) {
      alert("⚠️ Primeiro SALVE a visita antes de adicionar fotos.");
      return;
    }

    try {
      const img = await Camera.getPhoto({
        quality: 80,
        resultType: CameraResultType.DataUrl,
        allowEditing: false,
      });

      const dataUrl = img.dataUrl || "";

      if (!dataUrl) {
        alert("❌ Erro: a câmera não retornou imagem.");
        return;
      }

      const fileName = `foto_${Date.now()}.jpg`;


      // 🔥 Extração EXIF via DataURL — versão correta
      if (onAutoSetLocation) {
        try {
          const imgElement = new Image();
          imgElement.src = dataUrl;

          imgElement.onload = () => {
            EXIF.getData(imgElement, function (this: any) {
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

                console.log("📍 GPS EXIF (APK):", latitude, longitude);
                onAutoSetLocation(latitude, longitude);
              }
            });
          };
        } catch (err) {
          console.warn("⚠️ EXIF do APK não pôde ser extraído", err);
        }
      }



      await savePendingPhoto({
        visit_id: visitId,
        fileName,
        mime: "image/jpeg",
        dataUrl,
        caption: "",
        synced: false,
      });

      alert("📸 Foto salva offline!");

      // Atualiza a lista imediatamente
      const off = await loadOffline();
      setSavedPhotos([...(existingPhotos || []), ...off]);

    } catch (err) {
      console.error("Erro ao capturar foto:", err);
      alert("❌ Falha ao capturar foto.");
    }
  }

  // ======================================================
  // 🖼 Resolver URL
  // ======================================================
  function resolvePhotoUrl(p: UnifiedPhoto) {
    if (p.dataUrl) return p.dataUrl;
    if (!p.url) return "";
    if (p.url.startsWith("http")) return p.url;

    const base = API_BASE.replace("/api", "");
    return `${base}${p.url}`;
  }

  // ======================================================
  // 📁 Web — selecionar arquivos
  // ======================================================
  const handleSelectFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    console.log("🔥 handleSelectFiles DISPAROU");

    if (!visitId || Number(visitId) < 1) {
      alert("⚠️ Primeiro SALVE a visita antes de adicionar fotos.");
      return;
    }

    const fl = e.target.files;
    if (!fl) return;

    const arr = Array.from(fl);

    // 🔥 EXTRAIR GPS EXIF DA PRIMEIRA FOTO
    const first = arr[0];
    if (first && onAutoSetLocation) {
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

          // hemisférios
          if (latRef === "S") latitude *= -1;
          if (lonRef === "W") longitude *= -1;

          console.log("📍 GPS EXIF encontrado:", latitude, longitude);

          onAutoSetLocation(latitude, longitude);
        }
      });
    }


    setFiles(arr);
    setPreviews(arr.map((f) => URL.createObjectURL(f)));

    // captions sempre com o mesmo número de itens
    setCaptions(arr.map(() => ""));

    // notifica apenas 1 vez
    if (onFilesSelected) {
      onFilesSelected(arr, arr.map(() => ""));
    }
  };

  // ======================================================
  // 📝 Atualiza legendas
  // ======================================================
  useEffect(() => {
    if (!onFilesSelected) return;
    if (files.length === 0) return;

    onFilesSelected(files, captions);
  }, [captions]);

  // ======================================================
  // 🛑 Garantia de sincronização (evita legenda travar)
  // ======================================================
  if (previews.length !== captions.length) {
    setCaptions(previews.map(() => ""));
  }

  return (
    <div className="col-12 mt-3">
      <label className="form-label fw-semibold">📸 Fotos</label>

      {isMobileApp ? (
        <button
          type="button"
          className="btn btn-primary w-100"
          onClick={handleCameraCapture}
        >
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

      {/* PREVIEWS NOVOS */}
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

      {/* FOTOS SALVAS */}
      {savedPhotos.length > 0 && (
        <div className="mt-4">
          <label className="form-label fw-semibold">📁 Fotos salvas</label>

          <div className="d-flex flex-wrap gap-3">
            {savedPhotos.map((p, idx) => (
              <div key={idx} style={{ width: 130 }}>
                <img
                  src={resolvePhotoUrl(p)}
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
