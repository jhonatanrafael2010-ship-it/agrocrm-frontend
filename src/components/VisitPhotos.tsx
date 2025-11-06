// ==============================
// 📸 Seção de fotos da visita (revisado)
// ==============================

import { useState } from "react";
import axios from "axios";

function VisitPhotos({ visitId, existingPhotos, onRefresh }) {
  const [photos, setPhotos] = useState(existingPhotos || []);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [captions, setCaptions] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);

  // 🔹 Manipula seleção de arquivos
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setSelectedFiles(files);
    setCaptions(Array(files.length).fill("")); // cria legendas vazias
  };

  // 🔹 Atualiza legenda digitada
  const handleCaptionChange = (index: number, text: string) => {
    const newCaptions = [...captions];
    newCaptions[index] = text;
    setCaptions(newCaptions);
  };

  // 🔹 Faz upload das fotos com legendas
  const handleUpload = async () => {
    if (!selectedFiles.length) return alert("Selecione uma ou mais fotos.");

    const formData = new FormData();
    selectedFiles.forEach((file, i) => {
      formData.append("photos", file);
      formData.append("captions", captions[i] || "");
    });

    try {
      setUploading(true);
      const res = await axios.post(
        `${import.meta.env.VITE_API_URL}/visits/${visitId}/photos`,
        formData,
        { headers: { "Content-Type": "multipart/form-data" } }
      );

      // Atualiza lista de fotos após upload
      setPhotos((prev) => [...prev, ...res.data.photos]);
      setSelectedFiles([]);
      setCaptions([]);
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error("❌ Erro ao enviar fotos:", err);
      alert("Erro ao enviar fotos. Verifique sua conexão.");
    } finally {
      setUploading(false);
    }
  };

  // 🔹 Atualiza legenda de uma foto já salva
  const updateCaption = async (photoId: number, caption: string) => {
    try {
      await axios.put(`${import.meta.env.VITE_API_URL}/photos/${photoId}`, {
        caption,
      });
      setPhotos((prev) =>
        prev.map((p) => (p.id === photoId ? { ...p, caption } : p))
      );
    } catch (err) {
      console.error("⚠️ Erro ao atualizar legenda:", err);
    }
  };

  // 🔹 Exclui uma foto
  const deletePhoto = async (photoId: number) => {
    if (!confirm("Deseja excluir esta foto?")) return;
    try {
      await axios.delete(`${import.meta.env.VITE_API_URL}/photos/${photoId}`);
      setPhotos((prev) => prev.filter((p) => p.id !== photoId));
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error("⚠️ Erro ao excluir foto:", err);
      alert("Erro ao excluir foto.");
    }
  };

  return (
    <div className="photos-section mt-4">
      <h4 className="text-lg font-semibold mb-2">📸 Fotos da visita</h4>

      {/* Upload de novas fotos */}
      <input
        type="file"
        accept="image/*"
        multiple
        onChange={handleFileChange}
        className="mb-2"
      />

      {selectedFiles.map((file, i) => (
        <div
          key={i}
          className="p-2 mb-2 border rounded bg-gray-50 flex items-center"
        >
          <span className="flex-1 text-sm truncate">{file.name}</span>
          <input
            type="text"
            placeholder="Legenda..."
            value={captions[i]}
            onChange={(e) => handleCaptionChange(i, e.target.value)}
            className="ml-2 border px-2 py-1 rounded text-sm flex-1"
          />
        </div>
      ))}

      {selectedFiles.length > 0 && (
        <button
          onClick={handleUpload}
          disabled={uploading}
          className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded"
        >
          {uploading ? "Enviando..." : "Salvar Fotos"}
        </button>
      )}

      {/* Lista de fotos existentes */}
      {photos.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 mt-4">
          {photos.map((p) => (
            <div key={p.id} className="border rounded-lg overflow-hidden bg-white shadow">
              <img
                src={p.url}
                alt={p.caption || "Foto da visita"}
                className="w-full h-40 object-cover"
              />
              <input
                type="text"
                className="w-full text-sm border-t px-2 py-1 focus:outline-none"
                placeholder="Legenda..."
                value={p.caption || ""}
                onChange={(e) => updateCaption(p.id, e.target.value)}
              />
              <button
                onClick={() => deletePhoto(p.id)}
                className="text-red-500 text-xs w-full py-1 border-t hover:bg-red-50"
              >
                Excluir
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default VisitPhotos;
