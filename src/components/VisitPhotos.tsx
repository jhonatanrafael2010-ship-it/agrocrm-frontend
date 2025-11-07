import React, { useEffect, useState } from "react";
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
  // 📂 Novas fotos para upload
  const [filesToUpload, setFilesToUpload] = useState<FileList | null>(null);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const [photoCaptions, setPhotoCaptions] = useState<string[]>([]);

  // 🖼 Fotos já salvas no backend
  const [savedPhotos, setSavedPhotos] = useState<Photo[]>(existingPhotos || []);

  // 🔁 Mantém o estado sincronizado com o que vem do pai (Calendar)
  useEffect(() => {
    setSavedPhotos(existingPhotos || []);
  }, [existingPhotos]);

  // 🔗 Monta URL correta da foto (absoluta ou relativa)
  const resolvePhotoUrl = (photo: Photo): string => {
    if (!photo.url) return "";
    if (photo.url.startsWith("http")) return photo.url;

    // remove /api ou /api/ do final
    const base = API_BASE.replace(/\/api\/?$/, "");
    const path = photo.url.startsWith("/") ? photo.url : `/${photo.url}`;
    return `${base}${path}`;
  };

  // 📸 Upload de novas fotos (com legenda)
  const handleUpload = async () => {
    if (!visitId || !filesToUpload || filesToUpload.length === 0) return;

    const fd = new FormData();
    Array.from(filesToUpload).forEach((file, idx) => {
      fd.append("photos", file);
      fd.append("captions", photoCaptions[idx] || "");
    });

    try {
      const resp = await axios.post(`${API_BASE}visits/${visitId}/photos`, fd);
      const data = resp.data;

      alert("📸 Fotos enviadas com sucesso!");

      // limpa prévias
      setFilesToUpload(null);
      setPhotoPreviews([]);
      setPhotoCaptions([]);

      // se o backend devolver as fotos novas, já soma na lista local
      if (data && Array.isArray(data.photos)) {
        setSavedPhotos((prev) => [...prev, ...data.photos]);
      }

      // pede pro pai recarregar visitas (para manter tudo alinhado)
      onRefresh();
    } catch (err) {
      console.error("Erro ao enviar fotos:", err);
      alert("❌ Falha ao enviar fotos.");
    }
  };

  // 🗑 Excluir foto já salva
  const handleDeletePhoto = async (photoId: number) => {
    if (!window.confirm("Excluir esta foto?")) return;
    try {
      await axios.delete(`${API_BASE}photos/${photoId}`);
      setSavedPhotos((prev: Photo[]) => prev.filter((p) => p.id !== photoId));
      onRefresh();
    } catch (err) {
      console.error("Erro ao excluir foto:", err);
      alert("❌ Falha ao excluir foto.");
    }
  };

  // ✏️ Atualiza legenda só no front enquanto digita
  const handleLocalCaptionChange = (photoId: number, newCaption: string) => {
    setSavedPhotos((prev) =>
      prev.map((p) => (p.id === photoId ? { ...p, caption: newCaption } : p))
    );
  };

  // 💾 Salva a legenda no backend quando o usuário sai do campo
  const handleCaptionBlur = async (photoId: number, caption: string) => {
    try {
        await axios.put(`${API_BASE}photos/${photoId}`, { caption });
        console.log("📝 Legenda salva:", caption);

        // 🔁 Atualiza fotos do modal imediatamente
        onRefresh();
    } catch (err) {
        console.error("Erro ao atualizar legenda:", err);
        alert("❌ Falha ao salvar legenda.");
    }
    };

    useEffect(() => {
      const fetchPhotos = async () => {
        if (!visitId) return;
        const res = await fetch(`${API_BASE}visits/${visitId}`);
        if (res.ok) {
          const visit = await res.json();
          setPhotos(visit.photos || []);
        }
      };
      fetchPhotos();
    }, [visitId]);



  return (
    <div className="col-12 mt-3">
      <label className="form-label fw-semibold">Fotos da Visita</label>

      {/* Input de novas fotos */}
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

          setFilesToUpload(files);
          setPhotoPreviews(previews);
          setPhotoCaptions(emptyCaptions);
        }}
      />

      {/* Pré-visualização de novas fotos + legenda antes de enviar */}
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

      {/* Fotos já salvas no backend */}
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
                  src={resolvePhotoUrl(photo)}
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

                {/* Botão excluir */}
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

                {/* Legenda editável */}
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
