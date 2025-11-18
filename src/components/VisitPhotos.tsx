import React, { useEffect, useState } from "react";
import { API_BASE } from "../config";
import { getAllPendingPhotos } from "../utils/indexedDB";

// Tipo unificado de foto
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
  onRefresh?: () => void | Promise<void>;
}


/**
 * VisitPhotos — APENAS UI
 *
 * - mostra fotos do backend
 * - mostra fotos offline
 * - mostra previews das fotos escolhidas
 *
 * NÃO envia fotos
 * NÃO salva offline
 *
 * Todo o processamento real está no Calendar.tsx
 */
const VisitPhotos: React.FC<Props> = ({ visitId, existingPhotos }) => {
  const [savedPhotos, setSavedPhotos] = useState<UnifiedPhoto[]>([]);
  const [newPreviews, setNewPreviews] = useState<string[]>([]);
  const [captions, setCaptions] = useState<string[]>([]);

  // Carregar fotos offline
  async function loadOffline() {
    if (!visitId) return [];
    const all = await getAllPendingPhotos();
    return all
      .filter((p) => p.visit_id === visitId)
      .map((p) => ({
        pending: true,
        dataUrl: p.dataUrl,
        caption: "",
        visit_id: p.visit_id,
      }));
  }

  // Merge de fotos online + offline
  useEffect(() => {
    async function merge() {
      const off = await loadOffline();
      setSavedPhotos([...(existingPhotos || []), ...off]);
    }
    merge();
  }, [visitId, existingPhotos]);

  // Resolve URL real
  function resolvePhotoUrl(p: UnifiedPhoto) {
    if (p.dataUrl) return p.dataUrl; // offline
    if (!p.url) return "";
    if (p.url.startsWith("http")) return p.url;
    const base = API_BASE.replace("/api", "");
    return `${base}${p.url}`;
  }

  return (
    <div className="col-12 mt-3">
      <label className="form-label fw-semibold">📸 Fotos</label>

      {/* Upload */}
      <input
        type="file"
        multiple
        accept="image/*"
        className="form-control"
        disabled={!visitId}     // 🔥 impede fotos sem ID
        onChange={(e) => {
          if (!visitId) {
            alert("⚠️ Primeiro clique em SALVAR a visita antes de adicionar fotos.");
            return;
          }
          const files = e.target.files;
          if (!files) return;
  
          setNewPreviews(Array.from(files).map((f) => URL.createObjectURL(f)));
          setCaptions(Array.from(files).map(() => ""));
        }}
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
                  borderRadius: 10,
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
                    borderRadius: 10,
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

      {/* Expor dados ao pai */}
      <input type="hidden" name="photoFiles" value="" />
    </div>
  );
};

export default VisitPhotos;
