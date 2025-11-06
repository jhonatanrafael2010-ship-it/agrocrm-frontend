import React, { useState } from "react";
import axios from "axios";

const API_BASE = (import.meta as any).env.VITE_API_URL || "/api/";

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
  const [photos, setPhotos] = useState<FileList | null>(null);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const [photoCaptions, setPhotoCaptions] = useState<string[]>([]);
  const [savedPhotos, setSavedPhotos] = useState<Photo[]>(existingPhotos || []);

  // 📸 Upload de novas fotos
  const handleUpload = async () => {
    if (!visitId || !photos || photos.length === 0) return;

    const fd = new FormData();
    Array.from(photos).forEach((file, idx) => {
      fd.append("photos", file);
      fd.append("captions", photoCaptions[idx] || "");
    });

    try {
      await axios.post(`${API_BASE}visits/${visitId}/photos`, fd);
      alert("📸 Fotos enviadas com sucesso!");
      setPhotos(null);
      setPhotoPreviews([]);
      setPhotoCaptions([]);
      onRefresh();
    } catch (err) {
      console.error("Erro ao enviar fotos:", err);
      alert("❌ Falha ao enviar fotos.");
    }
  };

  // 🗑 Excluir foto
  const handleDeletePhoto = async (photoId: number) => {
    if (!window.confirm("Excluir esta foto?")) return;
    try {
      await axios.delete(`${API_BASE}photos/${photoId}`);
      setSavedPhotos((prev: Photo[]) => prev.filter((p) => p.id !== photoId));
      onRefresh();
    } catch (err) {
      console.error("Erro ao excluir foto:", err);
    }
  };

  // ✏️ Atualizar legenda
  const handleUpdateCaption = async (photoId: number, newCaption: string) => {
    try {
      await axios.put(`${API_BASE}photos/${photoId}`, {
        caption: newCaption,
      });
      setSavedPhotos((prev: Photo[]) =>
        prev.map((p) =>
          p.id === photoId ? { ...p, caption: newCaption } : p
        )
      );
    } catch (err) {
      console.error("Erro ao atualizar legenda:", err);
    }
  };

  return (
    <div className="col-12 mt-3">
      <label className="form-label fw-semibold">Fotos da Visita</label>
      <input
        type="file"
        multiple
        accept="image/*"
        className="form-control bg-dark text-light border-secondary"
        onChange={(e) => {
          const files = e.target.files;
          if (!files) return;
          const previews = Array.from(files).map((f) => URL.createObjectURL(f));
          const emptyCaptions = Array.from(files).map(() => "");
          setPhotos(files);
          setPhotoPreviews(previews);
          setPhotoCaptions(emptyCaptions);
        }}
      />

      {/* Mostra prévias */}
      {photoPreviews.length > 0 && (
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
                  border: "1px solid rgba(255,255,255,0.2)",
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
                className="form-control form-control-sm bg-dark text-light border-secondary"
              />
            </div>
          ))}
        </div>
      )}

      {photoPreviews.length > 0 && (
        <div className="mt-2">
          <button className="btn btn-success btn-sm" onClick={handleUpload}>
            💾 Enviar Fotos
          </button>
        </div>
      )}

      {/* Fotos já salvas */}
      {savedPhotos.length > 0 && (
        <div className="mt-4">
          <label className="form-label fw-semibold">Fotos salvas</label>
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
                  src={API_BASE.replace("/api", "") + photo.url}
                  alt="Foto"
                  style={{
                    width: "130px",
                    height: "130px",
                    objectFit: "cover",
                    borderRadius: "10px",
                    border: "1px solid rgba(255,255,255,0.2)",
                    marginBottom: "6px",
                  }}
                />
                <button
                  onClick={() => handleDeletePhoto(photo.id)}
                  style={{
                    position: "absolute",
                    top: "-8px",
                    right: "-8px",
                    backgroundColor: "#b71c1c",
                    color: "white",
                    border: "none",
                    borderRadius: "50%",
                    width: "22px",
                    height: "22px",
                    fontSize: "12px",
                    cursor: "pointer",
                  }}
                >
                  🗑
                </button>
                <input
                  type="text"
                  value={photo.caption || ""}
                  placeholder="Legenda..."
                  onChange={(e) =>
                    handleUpdateCaption(photo.id, e.target.value)
                  }
                  className="form-control form-control-sm bg-dark text-light border-secondary"
                  style={{ fontSize: "12px" }}
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
