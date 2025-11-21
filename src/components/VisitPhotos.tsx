import React, { useEffect, useState, useCallback } from "react";
import { API_BASE } from "../config";
import { getAllPendingPhotos } from "../utils/indexedDB";

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
}

/**
 * VisitPhotos — 100% UI
 * - mostra fotos online
 * - mostra fotos offline
 * - mostra previews corretos (sem duplicar)
 * - envia arquivos para o Calendar APENAS UMA VEZ
 */
const VisitPhotos: React.FC<Props> = ({
  visitId,
  existingPhotos,
  onFilesSelected,
}) => {
  const [savedPhotos, setSavedPhotos] = useState<UnifiedPhoto[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [captions, setCaptions] = useState<string[]>([]);

  // ======================================================
  // 🔄 1) Carregar fotos OFFLINE corretamente
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
  // 🔄 2) Merge das fotos online + offline (apenas 1 vez)
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
  // 🖼 Resolver URL (online ou offline)
  // ======================================================
  function resolvePhotoUrl(p: UnifiedPhoto) {
    if (p.dataUrl) return p.dataUrl; // offline
    if (!p.url) return "";
    if (p.url.startsWith("http")) return p.url;

    const base = API_BASE.replace("/api", "");
    return `${base}${p.url}`;
  }

  // ======================================================
  // 📸 3) Selecionar arquivos → cria previews e inicializa legendas
  // ======================================================
  const handleSelectFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    console.log("🔥 handleSelectFiles DISPAROU");
    console.log("visitId:", visitId);

    if (!visitId || Number(visitId) < 1) {
      alert("⚠️ Primeiro SALVE a visita antes de adicionar fotos.");
      return;
    }

    const fl = e.target.files;
    if (!fl) return;

    const arr = Array.from(fl);

    setFiles(arr);
    setPreviews(arr.map((f) => URL.createObjectURL(f)));
    setCaptions(arr.map(() => ""));

    // Envia para o Calendar apenas 1 vez, com legendas vazias
    if (onFilesSelected) {
      onFilesSelected(arr, arr.map(() => ""));
    }
  };

  // ======================================================
  // 📝 4) Se legenda mudar → envia atualização para o Calendar
  // ======================================================
  useEffect(() => {
    if (!onFilesSelected) return;
    if (files.length === 0) return;

    onFilesSelected(files, captions);
  }, [captions]);

  return (
    <div className="col-12 mt-3">
      <label className="form-label fw-semibold">📸 Fotos</label>

      {/* Campo de upload */}
      <input
        type="file"
        multiple
        accept="image/*"
        className="form-control"
        onChange={handleSelectFiles}
      />

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
                value={captions[idx]}
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

      {/* FOTOS JA SALVAS */}
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
