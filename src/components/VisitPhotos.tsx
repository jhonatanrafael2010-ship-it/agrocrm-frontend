import React, { useEffect, useState } from "react";
import axios from "axios";
import { API_BASE } from "../config";
import { savePendingPhoto } from "../utils/indexedDB"; // <-- CORRETO AGORA

type Photo = {
  id: number;
  url: string;
  caption?: string;
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
  // 🧩 Atualiza lista se fotos externas mudarem
  // ============================================================
  useEffect(() => {
    if (!existingPhotos) return;
    setSavedPhotos((prev) =>
      existingPhotos.map((photo) => {
        const local = prev.find((p) => p.id === photo.id);
        return local
          ? { ...photo, caption: local.caption ?? photo.caption }
          : photo;
      })
    );
  }, [existingPhotos]);

  // ============================================================
  // 🔗 Resolve URL absoluta da foto
  // ============================================================
  const resolvePhotoUrl = (photo: Photo): string => {
    if (!photo.url) return "";
    if (photo.url.startsWith("http")) return photo.url;
    const base = API_BASE.replace(/\/api\/?$/, "");
    const path = photo.url.startsWith("/") ? photo.url : `/${photo.url}`;
    return `${base}${path}`;
  };

  // ============================================================
  // 📸 Upload de fotos (com suporte OFFLINE)
  // ============================================================
  const handleUpload = async () => {
    if (!visitId || !filesToUpload || filesToUpload.length === 0) return;

    // 🟠 OFFLINE — salvar no IndexedDB
    if (!navigator.onLine) {
      Array.from(filesToUpload).forEach((file) => {
        const reader = new FileReader();
        reader.onload = async () => {
          await savePendingPhoto({
            visit_id: visitId,
            fileName: file.name,
            mime: file.type,
            dataUrl: reader.result as string,
            synced: false,
          });
        };
        reader.readAsDataURL(file);
      });

      alert("🟠 Fotos salvas offline! Serão enviadas quando voltar à internet.");
      setFilesToUpload(null);
      setPhotoPreviews([]);
      setPhotoCaptions([]);
      return;
    }

    // 🟢 ONLINE — envia para backend
    const fd = new FormData();
    Array.from(filesToUpload).forEach((file, idx) => {
      fd.append("photos", file);
      fd.append("captions", photoCaptions[idx] || "");
    });

    try {
      const resp = await axios.post(`${API_BASE}visits/${visitId}/photos`, fd);

      alert("📸 Fotos enviadas!");

      setFilesToUpload(null);
      setPhotoPreviews([]);
      setPhotoCaptions([]);

      if (resp.data && Array.isArray(resp.data.photos)) {
        setSavedPhotos((prev) => [...prev, ...resp.data.photos]);
      }

      onRefresh();
    } catch (err) {
      console.error("Erro ao enviar fotos:", err);
      alert("❌ Falha ao enviar.");
    }
  };

  // ============================================================
  // ❌ Excluir foto — somente online
  // ============================================================
  const handleDeletePhoto = async (photoId: number) => {
    if (!navigator.onLine) {
      alert("🟠 Não é possível excluir foto offline.");
      return;
    }

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
  // ✏️ Alteração local da legenda
  // ============================================================
  const handleLocalCaptionChange = (photoId: number, newCaption: string) => {
    setSavedPhotos((prev) =>
      prev.map((p) => (p.id === photoId ? { ...p, caption: newCaption } : p))
    );
  };

  // ============================================================
  // 💾 Salvar legenda no backend — somente online
  // ============================================================
  const handleCaptionBlur = async (photoId: number, caption: string) => {
    if (!navigator.onLine) {
      alert("🟠 Não é possível alterar legenda offline.");
      return;
    }

    try {
      await axios.put(`${API_BASE}photos/${photoId}`, { caption });
    } catch (err) {
      console.error("Erro ao atualizar legenda:", err);
      alert("❌ Falha ao salvar legenda.");
    }
  };

  // ============================================================
  // 🔄 Carregar fotos do backend (somente online)
  // ============================================================
  useEffect(() => {
    const fetchPhotos = async () => {
      if (!visitId) return;

      if (!navigator.onLine) {
        console.warn("Offline — não carregando fotos do servidor.");
        return;
      }

      try {
        const res = await fetch(`${API_BASE}visits/${visitId}/photos`);
        if (res.ok) {
          const data = await res.json();
          setSavedPhotos(data);
        }
      } catch (err) {
        console.error("⚠️ Falha ao carregar fotos:", err);
      }
    };

    fetchPhotos();
  }, [visitId]);

  // ============================================================
  // Renderização
  // ============================================================
  return (
    <div className="col-12 mt-3">
      <label className="form-label fw-semibold">📸 Fotos da Visita</label>

      <input
        type="file"
        multiple
        accept="image/*"
        className="form-control"
        style={{
          background: "var(--input-bg)",
          color: "var(--text)",
          borderColor: "var(--border)",
        }}
        onChange={(e) => {
          const files = e.target.files;
          if (!files) return;
          const previews = Array.from(files).map((f) => URL.createObjectURL(f));
          const emptyCaptions = Array.from(files).map(() => "");
          setFilesToUpload(files);
          setPhotoPreviews(previews);
          setPhotoCaptions(emptyCaptions);
        }}
      />

      {/* Novas fotos */}
      {photoPreviews.length > 0 && (
        <>
          <div className="d-flex flex-wrap gap-3 mt-3">
            {photoPreviews.map((preview, i) => (
              <div
                key={i}
                style={{
                  width: "140px",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                }}
              >
                <img
                  src={preview}
                  alt={`Foto ${i + 1}`}
                  style={{
                    width: "130px",
                    height: "130px",
                    objectFit: "cover",
                    borderRadius: "10px",
                    border: "1px solid var(--border)",
                    marginBottom: "6px",
                  }}
                />
                <input
                  type="text"
                  placeholder="Legenda..."
                  value={photoCaptions[i] || ""}
                  onChange={(e) => {
                    const newCaps = [...photoCaptions];
                    newCaps[i] = e.target.value;
                    setPhotoCaptions(newCaps);
                  }}
                  className="form-control form-control-sm"
                  style={{
                    background: "var(--input-bg)",
                    color: "var(--text)",
                    borderColor: "var(--border)",
                  }}
                />
              </div>
            ))}
          </div>
          <div className="mt-2">
            <button className="btn btn-success btn-sm" onClick={handleUpload}>
              💾 Enviar Fotos
            </button>
          </div>
        </>
      )}

      {/* Fotos já salvas */}
      {savedPhotos.length > 0 && (
        <div className="mt-4">
          <label className="form-label fw-semibold">📁 Fotos Salvas</label>
          <div className="d-flex flex-wrap gap-3">
            {savedPhotos.map((photo) => (
              <div
                key={photo.id}
                style={{
                  width: "140px",
                  position: "relative",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                }}
              >
                <img
                  src={resolvePhotoUrl(photo)}
                  alt="Foto"
                  style={{
                    width: "130px",
                    height: "130px",
                    objectFit: "cover",
                    borderRadius: "10px",
                    border: "1px solid var(--border)",
                    marginBottom: "6px",
                  }}
                />

                <button
                  onClick={() => handleDeletePhoto(photo.id)}
                  title="Excluir"
                  style={{
                    position: "absolute",
                    top: "-8px",
                    right: "-8px",
                    backgroundColor: "var(--accent)",
                    color: "#fff",
                    border: "none",
                    borderRadius: "50%",
                    width: "22px",
                    height: "22px",
                    fontSize: "12px",
                    cursor: "pointer",
                    transition: "background 0.3s ease",
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.backgroundColor = "#d32f2f")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.backgroundColor = "var(--accent)")
                  }
                >
                  🗑
                </button>

                <input
                  type="text"
                  value={photo.caption || ""}
                  placeholder="Legenda..."
                  onChange={(e) =>
                    handleLocalCaptionChange(photo.id, e.target.value)
                  }
                  onBlur={(e) =>
                    handleCaptionBlur(photo.id, e.target.value || "")
                  }
                  className="form-control form-control-sm"
                  style={{
                    background: "var(--input-bg)",
                    color: "var(--text)",
                    borderColor: "var(--border)",
                    fontSize: "12px",
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
