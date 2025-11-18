import React, { useEffect, useState } from "react";
import axios from "axios";
import { API_BASE } from "../config";
import {
  savePendingPhoto,
  getAllPendingPhotos,
} from "../utils/indexedDB";

type Photo = {
  id?: number;        // id real no backend
  url?: string;       // URL online no backend
  caption?: string;

  // 🔥 campos usados para fotos offline:
  dataUrl?: string;   // Base64
  fileName?: string;
  mime?: string;
  pending?: boolean;  // true = offline
  visit_id?: number;  // id offline ou id real
};

interface VisitPhotosProps {
  visitId: number | null;
  existingPhotos: Photo[];
  onRefresh: () => void;
}

const VisitPhotos: React.FC<VisitPhotosProps> = ({
  visitId,
  existingPhotos,
  onRefresh,
}) => {
  const [filesToUpload, setFilesToUpload] = useState<FileList | null>(null);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const [photoCaptions, setPhotoCaptions] = useState<string[]>([]);
  const [savedPhotos, setSavedPhotos] = useState<Photo[]>(existingPhotos || []);

  // ============================================================
  // 🔄 Carregar fotos salvas offline para esta visita
  // ============================================================
  async function loadOfflinePhotos() {
    if (!visitId) return [];

    const pending = await getAllPendingPhotos();
    const filtered = pending.filter((p) => p.visit_id === visitId);

    const converted: Photo[] = filtered.map((p) => ({
      id: undefined,
      url: p.dataUrl,
      caption: "",
      dataUrl: p.dataUrl,
      pending: true,
      visit_id: p.visit_id,
    }));

    return converted;
  }

  // ============================================================
  // 🧩 Atualiza lista quando abrir modal ou mudar visita
  // ============================================================
  useEffect(() => {
    async function mergePhotos() {
      const offlineOnes = await loadOfflinePhotos();
      const onlineOnes = existingPhotos || [];

      // Evitar duplicados (apenas precaução)
      const merged = [...onlineOnes, ...offlineOnes];
      setSavedPhotos(merged);
    }
    mergePhotos();
  }, [existingPhotos, visitId]);

  // ============================================================
  // 🔗 Resolve URL absoluta correta
  // ============================================================
  const resolvePhotoUrl = (photo: Photo): string => {
    // 🔥 Foto offline → já tem dataUrl
    if (photo.dataUrl) return photo.dataUrl;
    if (!photo.url) return "";

    // 🔥 Foto online com URL absoluta
    if (photo.url.startsWith("http")) return photo.url;

    // 🔥 Foto online com URL relativa
    const base = API_BASE.replace(/\/api\/?$/, "");
    const path = photo.url.startsWith("/") ? photo.url : `/${photo.url}`;
    return `${base}${path}`;
  };

  // ============================================================
  // 📸 Upload / Salvamento offline de fotos
  // ============================================================
  const handleUpload = async () => {
    if (!visitId || !filesToUpload || filesToUpload.length === 0) return;

    // ============================
    // 🔴 OFFLINE — salva e mostra
    // ============================
    if (!navigator.onLine) {
      Array.from(filesToUpload).forEach((file, idx) => {
        const reader = new FileReader();

        reader.onload = async () => {
          const dataUrl = reader.result as string;

          // 🔥 salva no IndexedDB
          await savePendingPhoto({
            visit_id: visitId,
            fileName: file.name,
            mime: file.type,
            dataUrl,
            synced: false,
          });

          // 🔥 aparece imediatamente
          setSavedPhotos((prev) => [
            ...prev,
            {
              dataUrl,
              caption: photoCaptions[idx] || "",
              pending: true,
              visit_id: visitId,
            },
          ]);
        };

        reader.readAsDataURL(file);
      });

      alert("🟠 Fotos salvas offline! Sincronizarão automaticamente depois.");
      setFilesToUpload(null);
      setPhotoPreviews([]);
      setPhotoCaptions([]);
      return;
    }

    // ============================
    // 🟢 ONLINE — envia pro backend
    // ============================
    const fd = new FormData();
    Array.from(filesToUpload).forEach((file, idx) => {
      fd.append("photos", file);
      fd.append("captions", photoCaptions[idx] || "");
    });

    try {
      const resp = await axios.post(`${API_BASE}visits/${visitId}/photos`, fd);

      alert("📸 Fotos enviadas!");

      if (resp.data && Array.isArray(resp.data.photos)) {
        setSavedPhotos((prev) => [...prev, ...resp.data.photos]);
      }

      setFilesToUpload(null);
      setPhotoPreviews([]);
      setPhotoCaptions([]);

      onRefresh();
    } catch (err) {
      console.error("❌ Erro ao enviar fotos:", err);
      alert("❌ Falha ao enviar.");
    }
  };

  // ============================================================
  // ❌ Excluir foto — somente online
  // ============================================================
  const handleDeletePhoto = async (photoId?: number, pending?: boolean) => {
    if (pending) {
      alert("🟠 Não é possível excluir foto offline.");
      return;
    }

    if (!navigator.onLine) {
      alert("🟠 Não é possível excluir foto offline.");
      return;
    }

    if (!photoId) return;

    if (!window.confirm("Excluir esta foto?")) return;

    try {
      await axios.delete(`${API_BASE}photos/${photoId}`);
      setSavedPhotos((prev) => prev.filter((p) => p.id !== photoId));
      onRefresh();
    } catch (err) {
      console.error("Erro ao excluir foto:", err);
      alert("❌ Falha ao excluir foto.");
    }
  };

  // ============================================================
  // Render
  // ============================================================
  return (
    <div className="col-12 mt-3">
      <label className="form-label fw-semibold">📸 Fotos da Visita</label>

      {/* Campo de Upload */}
      <input
        type="file"
        multiple
        accept="image/*"
        className="form-control"
        onChange={(e) => {
          const files = e.target.files;
          if (!files) return;

          setFilesToUpload(files);
          setPhotoPreviews(
            Array.from(files).map((f) => URL.createObjectURL(f))
          );
          setPhotoCaptions(Array.from(files).map(() => ""));
        }}
      />

      {/* Previews antes do upload */}
      {photoPreviews.length > 0 && (
        <>
          <div className="d-flex flex-wrap gap-3 mt-3">
            {photoPreviews.map((preview, i) => (
              <div key={i} style={{ width: "140px" }}>
                <img
                  src={preview}
                  style={{
                    width: "130px",
                    height: "130px",
                    objectFit: "cover",
                    borderRadius: "10px",
                  }}
                />
                <input
                  type="text"
                  placeholder="Legenda..."
                  value={photoCaptions[i] || ""}
                  onChange={(e) => {
                    const updated = [...photoCaptions];
                    updated[i] = e.target.value;
                    setPhotoCaptions(updated);
                  }}
                  className="form-control form-control-sm mt-1"
                />
              </div>
            ))}
          </div>

          <button
            className="btn btn-success btn-sm mt-2"
            onClick={handleUpload}
          >
            💾 Enviar Fotos
          </button>
        </>
      )}

      {/* FOTOS SALVAS */}
      {savedPhotos.length > 0 && (
        <div className="mt-4">
          <label className="form-label fw-semibold">📁 Fotos Salvas</label>

          <div className="d-flex flex-wrap gap-3">
            {savedPhotos.map((photo, idx) => (
              <div key={idx} style={{ width: "140px", position: "relative" }}>
                <img
                  src={resolvePhotoUrl(photo)}
                  style={{
                    width: "130px",
                    height: "130px",
                    objectFit: "cover",
                    borderRadius: "10px",
                  }}
                />

                {/* Botão excluir (somente online) */}
                {!photo.pending && (
                  <button
                    onClick={() =>
                      handleDeletePhoto(photo.id, photo.pending)
                    }
                    className="btn btn-danger btn-sm"
                    style={{
                      position: "absolute",
                      top: -10,
                      right: -10,
                      borderRadius: "50%",
                    }}
                  >
                    🗑
                  </button>
                )}

                {/* Legenda */}
                <input
                  type="text"
                  value={photo.caption || ""}
                  disabled={photo.pending}
                  className="form-control form-control-sm mt-1"
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
