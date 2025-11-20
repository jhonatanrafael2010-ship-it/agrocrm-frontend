import React, { useEffect, useState } from "react";
import { API_BASE } from "../config";
import { getAllPendingPhotos } from "../utils/indexedDB";

type UnifiedPhoto = {
  id?: number;
  url?: string;
  caption?: string;

  // Offline
  pending?: boolean;
  dataUrl?: string;
  visit_id?: number;
};

interface Props {
  visitId: number | null;
  existingPhotos: UnifiedPhoto[];
  onFilesSelected?: (files: File[], captions: string[]) => void;
}

/**
 * VisitPhotos — SOMENTE UI
 *
 * - Mostra fotos do backend
 * - Mostra fotos offline
 * - Mostra previews das fotos novas
 *
 * NÃO envia fotos
 * NÃO salva offline (isso é feito no Calendar.tsx)
 */
const VisitPhotos: React.FC<Props> = ({
  visitId,
  existingPhotos,
  onFilesSelected
}) => {
  const [savedPhotos, setSavedPhotos] = useState<UnifiedPhoto[]>([]);
  const [newPreviews, setNewPreviews] = useState<string[]>([]);
  const [captions, setCaptions] = useState<string[]>([]);
  const [newFiles, setNewFiles] = useState<File[]>([]);

    // Carregar fotos offline
    async function loadOffline() {
      if (!visitId) return [];

      const all = await getAllPendingPhotos();

      return all
        .filter((p) => p.visit_id === visitId)
        .map((p) => ({
          id: p.id,           // 🔥 manter ID se existir
          pending: true,
          dataUrl: p.dataUrl,
          caption: p.caption || "", // 🔥 importante
          visit_id: p.visit_id,
        }));
    }


  // Merge online + offline
  useEffect(() => {
    async function merge() {
      const off = await loadOffline();
      setSavedPhotos([...(existingPhotos || []), ...off]);
    }
    merge();
  }, [visitId, existingPhotos]);

  // Resolver URL
  function resolvePhotoUrl(p: UnifiedPhoto) {
    if (p.dataUrl) return p.dataUrl; // offline
    if (!p.url) return "";
    if (p.url.startsWith("http")) return p.url;

    const base = API_BASE.replace("/api", "");
    return `${base}${p.url}`;
  }


  // Quando selecionar arquivos
  function handleSelectFiles(e: React.ChangeEvent<HTMLInputElement>) {
    if (!visitId) {
      alert("⚠️ Primeiro SALVE a visita antes de adicionar fotos.");
      return;
    }

    const files = e.target.files;
    if (!files) return;

    const arr = Array.from(files);

    setNewFiles(arr);
    setNewPreviews(arr.map((f) => URL.createObjectURL(f)));
    setCaptions(arr.map(() => "")); // cria legendas vazias

    if (onFilesSelected) {
      onFilesSelected(arr, arr.map(() => ""));
    }
  }

  // Quando legendas mudarem → notifica o Calendar
  useEffect(() => {
    if (onFilesSelected && newFiles.length > 0) {
      onFilesSelected(newFiles, captions);
    }
  }, [captions, newFiles]);


  return (
    <div className="col-12 mt-3">
      <label className="form-label fw-semibold">📸 Fotos</label>

      {/* Upload */}
      <input
        type="file"
        multiple
        accept="image/*"
        className="form-control"
        disabled={!visitId}
        onChange={handleSelectFiles}
      />

      {/* Previews */}
      {newPreviews.length > 0 && (
        <div className="d-flex flex-wrap gap-3 mt-3">
          {newPreviews.map((prev, i) => (
            <div key={i} style={{ width: 130 }}>
              <img
                src={prev}
                style={{
                  width: "130px",
                  height: "130px",
                  objectFit: "cover",
                  borderRadius: 10
                }}
              />
              <input
                type="text"
                placeholder="Legenda..."
                className="form-control form-control-sm mt-1"
                value={captions[i]}
                onChange={(e) => {
                  const c = [...captions];
                  c[i] = e.target.value;
                  setCaptions(c);
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
            {savedPhotos.map((p, i) => (
              <div key={i} style={{ width: 130 }}>
                <img
                  src={resolvePhotoUrl(p)}
                  style={{
                    width: "130px",
                    height: "130px",
                    objectFit: "cover",
                    borderRadius: 10
                  }}
                />
                <input
                  type="text"
                  disabled
                  className="form-control form-control-sm mt-1"
                  value={p.caption || ""}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      <input type="hidden" />
    </div>
  );
};

export default VisitPhotos;
