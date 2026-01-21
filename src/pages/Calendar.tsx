import React, { useEffect, useRef, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import ptBrLocale from "@fullcalendar/core/locales/pt-br";
import DarkSelect from "../components/DarkSelect";
import "../styles/Calendar.css";
import { Geolocation } from "@capacitor/geolocation";
// import { FileOpener } from '@awesome-cordova-plugins/file-opener';
// import { Capacitor } from '@capacitor/core';
import VisitPhotos from "../components/VisitPhotos";
import {
  fetchWithCache,
  createVisitWithSync,
  updateVisitWithSync,
} from "../utils/offlineSync";
import { API_BASE } from "../config";
import {
  savePendingPhoto,
  getAllPendingPhotos,
  getAllFromStore,
  deletePendingPhoto,   // ← ADICIONADO
} from "../utils/indexedDB";
import { deleteLocalVisit } from "../utils/indexedDB";  // ← ADICIONE ESSE IMPORT
import { compressImage } from "../utils/imageCompress";



/*  
// 🔁 Retry legacy (não usado no Calendar)
async function fetchWithRetry(url: string, retries = 3): Promise<Response> {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, {
        method: "GET",
        credentials: "omit",
        cache: "no-store",
      });

      if (!res.ok) throw new Error("Erro HTTP");
      return res;
    } catch (e) {
      if (i === retries - 1) throw e;
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  throw new Error("Fetch falhou");
}
*/



// ============================================================
// 🌐 Função definitiva para detectar internet real no APK
// ============================================================
async function hasInternet(): Promise<boolean> {
  try {
    // Testa diretamente sua API (método recomendado para Capacitor)
    const resp = await fetch(`${API_BASE}ping`, { method: "GET", cache: "no-cache" });
    return resp.ok;
  } catch {
    return false;
  }
}



type Client = { id: number; name: string };
type Property = { id: number; client_id: number; name: string };
type Plot = { id: number; property_id: number; name: string };
type Culture = { id: number; name: string };
type Variety = { id: number; name: string; culture: string };
type Consultant = { id: number; name: string };

type Photo = {
  id: number;
  url: string;
  caption?: string;
};

type Visit = {
  id: number;
  client_id: number;
  property_id?: number | null;
  plot_id?: number | null;
  consultant_id?: number | null;
  date: string;
  recommendation?: string;
  status?: "planned" | "done" | string;
  photos?: Photo[];
  culture?: string;
  variety?: string;
  latitude?: number | null;
  longitude?: number | null;
  client_name?: string;
  consultant_name?: string;
  offline?: boolean;
  event_name?: string;
  display_text?: string;
  fenologia_real?: string;
  products?: Product[];
};

type Product = {
  product_name: string;
  dose: string;
  unit: string;
  application_date: string | null;
};



const CalendarPage: React.FC = () => {
  const calendarRef = useRef<any>(null);

  const photosRef = useRef<HTMLDivElement | null>(null);

    // ============================================================
    // 🔄 Recalcular FullCalendar ao girar tela (Android + iOS)
    // ============================================================
    useEffect(() => {
      const handleResize = () => {
        if (calendarRef.current) {
          const api = calendarRef.current.getApi();
          api.updateSize(); // 🔥 força recalcular altura real
        }
      };

      window.addEventListener("resize", handleResize);
      window.addEventListener("orientationchange", handleResize);

      return () => {
        window.removeEventListener("resize", handleResize);
        window.removeEventListener("orientationchange", handleResize);
      };
    }, []);


  // ============================================================
  // 📱 Detecta comportamento mobile (APK + web responsivo)
  // ============================================================
  const isMobileLike = () =>
    window.innerWidth < 768 ||
    document.body.dataset.platform === "mobile";



  // 🛰️ Status de conexão
  const [offline, setOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const checkConnection = () => {
      const status = !navigator.onLine;

      // ✅ só atualiza se realmente mudou
      setOffline(prev => (prev === status ? prev : status));
    };

    checkConnection();

    // ✅ pode manter, mas agora não re-renderiza sem mudança
    const interval = setInterval(checkConnection, 3000);

    window.addEventListener("online", checkConnection);
    window.addEventListener("offline", checkConnection);

    return () => {
      clearInterval(interval);
      window.removeEventListener("online", checkConnection);
      window.removeEventListener("offline", checkConnection);
    };
  }, []);


  // dados base
  const [events, setEvents] = useState<any[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [cultures, setCultures] = useState<Culture[]>([]);
  const [varieties, setVarieties] = useState<Variety[]>([]);
  const [consultants, setConsultants] = useState<Consultant[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [plots, setPlots] = useState<Plot[]>([]);
  const [loading, setLoading] = useState(false);

  // filtros
  const [selectedConsultant, setSelectedConsultant] = useState<string>("");
  const [selectedVariety, setSelectedVariety] = useState<string>("");

  // Estado de sincronização
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);

  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [selectedCaptions, setSelectedCaptions] = useState<string[]>([]);


  // modal
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    id: null as number | null,
    date: "",
    originalDate: "",    // ← ADICIONADO
    dateBackup: "",      // ← ADICIONADO
    client_id: "",
    property_id: "",
    plot_id: "",
    consultant_id: "",
    culture: "",
    variety: "",
    recommendation: "",
    genPheno: true,
    savedPhotos: [] as any[],
    clientSearch: "",
    latitude: null as number | null,
    longitude: null as number | null,
    status: "planned",
    fenologia_real: "",
    products: [] as Product[],
  });
  // 🔵 Controle de abas do modal
  const [tab, setTab] = useState<"dados" | "produtos" | "fotos">("dados");



  // ============================================================
  // 🎨 Cor dos eventos
  // ============================================================
  const colorFor = (dateISO?: string, status?: string): string => {
    const s = (status || "").toLowerCase();

    if (s.includes("done") || s.includes("conclu")) return "#2dd36f";

    let d: Date | null = null;
    if (dateISO) {
      const [y, m, day] = dateISO.split("-");
      if (y && m && day) {
        d = new Date(Number(y), Number(m) - 1, Number(day), 0, 0, 0, 0);
      } else {
        d = new Date(dateISO);
      }
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (d && d.getTime() < today.getTime()) return "#dc3545";
    return "#2563eb";
  };

  // ============================================================
  // 🔁 Carregar visitas -> monta eventos
  // ============================================================
  const loadVisits = async () => {
    try {
    
      // Abordagem iOS: apenas visitas do mês → MUITO mais leve
      const endpoint = isIOS()
        ? `${API_BASE}visits?month=current`
        : `${API_BASE}visits?scope=all`;

      const onlineVisits: Visit[] = await fetchWithCache(endpoint, "visits");


      // 🔄 Carregar fotos offline ligadas a cada visita
      const pending = await getAllPendingPhotos();

      const offlinePhotosMap = pending.reduce((acc, p) => {
        if (!acc[p.visit_id]) acc[p.visit_id] = [];
        acc[p.visit_id].push({
          id: p.id,
          dataUrl: p.dataUrl,
          caption: p.caption || "",
          pending: true,
        });
        return acc;
      }, {} as Record<number, any[]>);


      // 🔥 Normalizar — visitas online nunca são offline
      const cleanOnline = onlineVisits.map((v) => ({
        ...v,
        offline: false,
        offlinePhotos: [], // estrutura garantida
      }));

      // 2) Buscar visitas locais do IndexedDB
      const localVisits = await getAllFromStore<Visit>("visits");

      // 3) Offline = só as que não existem no servidor
      const offlineVisits = localVisits.filter(
        (v: any) =>
          v.offline === true && !cleanOnline.some((o) => o.id === v.id)
      );

      // 4) Unir final
      const allVisits = [...cleanOnline, ...offlineVisits];

      const cs = clients || [];
      const cons = consultants || [];

      const evs = allVisits
        .filter((v) => v.date)
        .map((v) => {
          const clientName =
            v.client_name ||
            cs.find((c) => c.id === v.client_id)?.name ||
            `Cliente ${v.client_id}`;

          const consultant =
            v.consultant_name ||
            cons.find((x) => x.id === v.consultant_id)?.name ||
            "";

          const variety =
            v.variety || v.recommendation?.match(/\(([^)]+)\)/)?.[1] || "";

          let stage = "";
          if (v.recommendation) {
            stage = v.recommendation.split("—").pop()?.trim() || v.recommendation;
            stage = stage.replace(/\s*\(.*?\)\s*/g, "").trim();
          }

          const tooltip = `
  👤 ${clientName}
  🌱 ${variety || "-"}
  📍 ${stage || "-"}
  👨‍🌾 ${consultant || "-"}
          `.trim();

          const isOffline = v.offline === true;

          return {
            id: `visit-${v.id}`,
            title: clientName,
            start: v.date,

            // amarelo = offline
            backgroundColor: isOffline ? "#ffcc00" : colorFor(v.date, v.status),
            borderColor: isOffline ? "#ffaa00" : colorFor(v.date, v.status),

            extendedProps: {
              type: "visit",
              raw: {
                ...v,
                offline: isOffline,
                offlinePhotos: offlinePhotosMap[v.id] ?? [],
              },
              tooltip,
            },

            classNames: ["visit-event"],
          };
        });

      setEvents(evs);

      console.log(`✅ ${evs.length} visitas carregadas no calendário.`);
    } catch (err) {
      console.error("❌ Erro ao carregar visitas:", err);
    }
  };



  // Detectar iOS
  function isIOS() {
    return /iPhone|iPad|iPod/i.test(navigator.userAgent);
  }

  // ============================================================
  // 🚀 Load inicial (iOS continua leve nas VISITAS)
  // ============================================================
  useEffect(() => {
    let mounted = true;

    async function loadBaseDataAndVisits() {
      setLoading(true);

      try {
        const [
          cs = [],
          ps = [],
          pls = [],
          cts = [],
          vars = [],
          cons = [],
        ] = await Promise.all([
          fetchWithCache(`${API_BASE}clients`, "clients"),
          fetchWithCache(`${API_BASE}properties`, "properties"),
          fetchWithCache(`${API_BASE}plots`, "plots"),
          fetchWithCache(`${API_BASE}cultures`, "cultures"),
          fetchWithCache(`${API_BASE}varieties`, "varieties"),
          fetchWithCache(`${API_BASE}consultants`, "consultants"),
        ]);

        if (!mounted) return;

        setClients(cs);
        setProperties(ps);
        setPlots(pls);
        setCultures(cts);
        setVarieties(vars);
        setConsultants(cons);

        console.log("📦 Dados base carregados (inclui iOS).");
      } catch (err) {
        console.warn("⚠️ Falha ao carregar dados base:", err);
        // não trava a tela — ainda tenta carregar visitas
      } finally {
        // ✅ SEMPRE carrega visitas (seu loadVisits já é leve no iOS via month=current)
        await loadVisits();
        if (mounted) setLoading(false);
      }
    }

    loadBaseDataAndVisits();

    return () => {
      mounted = false;
    };
  }, []);



  // Reagir a "visits-synced" (quando voltar internet)
  useEffect(() => {
    const handleSync = async () => {
      console.log("🔄 Atualizando calendário após sincronização...");
      setSyncing(true);
      await loadVisits();
      setLastSync(
        new Date().toLocaleTimeString("pt-BR", {
          hour: "2-digit",
          minute: "2-digit",
        })
      );
      setSyncing(false);
    };

    window.addEventListener("visits-synced", handleSync);
    return () => window.removeEventListener("visits-synced", handleSync);
  }, []);

  // ============================================================
  // 📝 Form handlers
  // ============================================================
  const handleChange = (e: any) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  };

  // ============================================================
  // 📸 Salvar foto offline (IndexedDB)
  // ============================================================
  async function savePhotoOffline(
    visitId: number,
    file: File,
    caption: string
  ) {
    const compressed = await compressImage(file);

    return new Promise<void>((resolve, reject) => {
      const reader = new FileReader();

      reader.onerror = () => reject(new Error("Erro ao ler arquivo"));

      reader.onload = async () => {
        try {
          await savePendingPhoto({
            visit_id: visitId,
            fileName: compressed.name,
            mime: compressed.type,
            dataUrl: reader.result as string,
            caption: caption || "",
            synced: false,
            latitude: form.latitude,
            longitude: form.longitude,
          });

          resolve();
        } catch (e) {
          reject(e);
        }
      };

      reader.readAsDataURL(compressed);
    });
  }



// 🔥 RECEBE COORDENADAS EXIF AUTOMÁTICAS
const handleAutoSetLocation = (lat: number, lon: number) => {
  console.log("📍 Coordenadas EXIF recebidas:", lat, lon);
  setForm(f => ({
    ...f,
    latitude: lat,
    longitude: lon
  }));
};



// ============================================================
// 💾 Criar/atualizar visita (VERSÃO REVISADA)
// ============================================================
const handleCreateOrUpdate = async () => {
  if (!form.date || !form.client_id) {
    alert("Data e cliente são obrigatórios");
    return;
  }

  const [d, m, y] = form.date.split("/");
  const iso = `${y}-${m}-${d}`;

  let cultureName = "";
  if (form.culture) {
    const byId = cultures.find((c) => String(c.id) === String(form.culture));
    cultureName = byId ? byId.name : form.culture;
  }

  const normalize = (s: string | undefined | null) =>
    (s || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();

  const normalizedCulture = normalize(cultureName);
  const isPhenoCulture =
    normalizedCulture.startsWith("milho") ||
    normalizedCulture.startsWith("soja") ||
    normalizedCulture.startsWith("algodao");

  // =======================
  // 📦 MONTA PAYLOAD BASE
  // =======================
  const basePayload: any = {
    client_id: Number(form.client_id),
    property_id: form.property_id ? Number(form.property_id) : null,
    plot_id: form.plot_id ? Number(form.plot_id) : null,
    consultant_id: form.consultant_id ? Number(form.consultant_id) : null,
    date: iso,
    status: "planned",
    culture: cultureName || "",
    variety: form.variety || "",
    fenologia_real: form.fenologia_real || null,
    products: form.products || [],
    latitude: form.latitude,
    longitude: form.longitude,
    generate_schedule: isPhenoCulture,
    genPheno: isPhenoCulture,
  };

  // ⚠️ Recommendation só é enviada se o usuário escreveu algo
  if (form.recommendation && form.recommendation.trim() !== "") {
    basePayload.recommendation = form.recommendation.trim();
  }

  console.log("📦 Payload enviado:", basePayload);


  // =======================
  // 🟦 EDITAR VISITA
  // =======================
  try {
    let result;

    if (form.id) {
      console.log("🟦 Atualizando visita existente:", form.id);

      const safePayload = {
        ...basePayload,

        // 🛡️ Não deixar recommendation ser apagada
        recommendation:
          form.recommendation && form.recommendation.trim() !== ""
            ? form.recommendation.trim()
            : undefined,
        fenologia_real: form.fenologia_real || null,
        status: form.status || "planned",
        preserve_date: form.date === form.originalDate,

        latitude: form.latitude,
        longitude: form.longitude,
      };

      console.log("🛡️ Payload final (MANUTENÇÃO):", safePayload);

      result = await updateVisitWithSync(API_BASE, Number(form.id), safePayload);
    }


    // =======================
    // 🟢 CRIAR NOVA VISITA
    // =======================
    else {
      console.log("🟩 Criando visita nova...");

      const isReallyOffline =
        !navigator.onLine ||
        ((window as any).Capacitor?.isNativePlatform && !(await hasInternet()));

      if (isReallyOffline) {
        basePayload.latitude = form.latitude;
        basePayload.longitude = form.longitude;
      }

      console.log("📤 Payload final (NOVO):", basePayload);

      result = await createVisitWithSync(API_BASE, basePayload);
    }


    // 🔥 Garantir ID da visita tanto em criação quanto em edição
    let visitId: number;

    if (form.id) {
      // EDIÇÃO → o ID já é conhecido
      visitId = Number(form.id);
    } else {
      // CRIAÇÃO → pega do retorno da API
      const rawId =
        (result as any)?.id ??
        (result as any)?.visit?.id ??
        null;

      visitId = rawId ? Number(rawId) : NaN;
    }

    if (!visitId || isNaN(visitId)) {
      console.error("❌ ERRO: ID inválido retornado:", result);
      alert("Erro ao obter ID da visita. Tente novamente.");
      return;
    }

    console.log("🔵 ID da visita (real ou offline):", visitId);

    // garante que o form conheça esse ID
    setForm((f) => ({ ...f, id: visitId }));


    
    // RESET APENAS DAS FOTOS
    setSelectedFiles([]);
    setSelectedCaptions([]);

    // Mantém o modal aberto com ID válido
    alert("Visita salva com sucesso! Agora você pode adicionar fotos.");

    // Atualiza calendário
    await loadVisits();

    // 🔄 Recarrega a visita do backend para atualizar savedPhotos no modal
    if (navigator.onLine) {
      try {
        const updated = await fetch(`${API_BASE}visits/${visitId}`);
        if (updated.ok) {
          const data = await updated.json();
          setForm((f) => ({
            ...f,
            savedPhotos: data.photos || []
          }));
        }
      } catch (e) {
        console.warn("⚠️ Não foi possível atualizar fotos após salvar visita.");
      }
    }

    } catch (err) {
      console.error("❌ Erro ao salvar visita:", err);
      alert("Erro ao salvar visita. Tente novamente.");
    }
    };




const handleSavePhotos = async () => {
  if (!form.id) {
    alert("ID da visita não encontrado.");
    return;
  }

  const visitId = Number(form.id);

  // ============================================================
  // 🌐 DETECÇÃO REAL DE OFFLINE (APK + navegador)
  // ============================================================
  const isReallyOffline =
    !navigator.onLine ||
    ((window as any).Capacitor?.isNativePlatform && !(await hasInternet()));

  // ============================================================
  // 🟠 SALVAR OFFLINE
  // ============================================================
  if (isReallyOffline) {
    console.log("📸 Salvando fotos OFFLINE com ID:", visitId);

    for (let i = 0; i < selectedFiles.length; i++) {
      await savePhotoOffline(
        visitId,
        selectedFiles[i],
        selectedCaptions[i] || ""
      );
    }

    // Atualiza o modal imediatamente
    const off = await getAllPendingPhotos();

    setForm(f => {
      const merged = [...(f.savedPhotos || [])];

      off
        .filter(p => p.visit_id === visitId)
        .forEach(offPhoto => {
          const idx = merged.findIndex(p => p.id === offPhoto.id);

          if (idx >= 0) {
            merged[idx] = offPhoto; // substitui versão antiga
          } else {
            merged.push(offPhoto); // adiciona nova offline
          }
        });

      return {
        ...f,
        savedPhotos: merged,
      };
    });
    alert(
      "🟠 Fotos salvas OFFLINE! Serão sincronizadas automaticamente quando a internet voltar."
    );

    // reseta estado local
    setSelectedFiles([]);
    setSelectedCaptions([]);

    return;
  }

  // ============================================================
  // 🟢 SALVAR ONLINE
  // ============================================================
  console.log("📸 Enviando fotos ONLINE...");

  const fd = new FormData();

  for (let i = 0; i < selectedFiles.length; i++) {
    // 🔥 COMPRESSÃO AQUI
    const compressed = await compressImage(selectedFiles[i]);

    fd.append("photos", compressed, compressed.name);
    fd.append("captions", selectedCaptions[i] || "");
  }

  // ✅ latitude / longitude UMA ÚNICA VEZ
  fd.append("latitude", String(form.latitude || ""));
  fd.append("longitude", String(form.longitude || ""));


  const url = `${API_BASE}visits/${visitId}/photos`;
  const resp = await fetch(url, {
    method: "POST",
    body: fd,
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    console.error("Upload falhou:", resp.status, text);

    if (resp.status === 500 && text.includes("No space")) {
      alert("Servidor sem espaço para salvar fotos. Avise o suporte/adm do sistema.");
    } else {
      alert("⚠️ Falha ao enviar fotos.");
    }
    return;
  }


  console.log("📸 Fotos enviadas com sucesso!");
  alert("📸 Fotos enviadas!");

// 🔄 Atualiza as fotos no modal imediatamente (sem depender do calendário)
try {
  const updated = await fetch(`${API_BASE}visits/${visitId}`);
  if (updated.ok) {
    const data = await updated.json();
    setForm((f) => ({
      ...f,
      savedPhotos: [
        ...(data.photos || []),
        ...(f.savedPhotos?.filter((p: any) => p.pending) || []) // mantém offline pendentes
      ],
    }));
  }
} catch (e) {
  console.warn("⚠️ Não foi possível atualizar preview de fotos no modal.");
}


  // Limpa seleção
  setSelectedFiles([]);
  setSelectedCaptions([]);

  // Recarrega visitas
  await loadVisits();
};



const handleDeleteSavedPhoto = async (photo: any) => {
  const visitId = Number(form.id);
  if (!visitId || !photo) return;

  const isOffline =
    !navigator.onLine ||
    ((window as any).Capacitor?.isNativePlatform && !(await hasInternet()));

  // 🟠 OFFLINE → deletar só no IndexedDB
  if (isOffline || photo.pending) {

    await deletePendingPhoto(photo.id);   // ← FUNÇÃO AGORA RECONHECIDA

    setForm((f) => ({
      ...f,
      savedPhotos: f.savedPhotos.filter((p) => p.id !== photo.id),
    }));

    return;
  }

  // 🟢 ONLINE → API DELETE
  try {
    const resp = await fetch(`${API_BASE}photos/${photo.id}`, {
      method: "DELETE",
    });

    if (!resp.ok) {
      alert("Falha ao excluir foto no servidor.");
      return;
    }

    setForm((f) => ({
      ...f,
      savedPhotos: f.savedPhotos.filter((p) => p.id !== photo.id),
    }));

  } catch (err) {
    console.error(err);
    alert("Erro ao excluir foto.");
  }
};




const handleReplaceSavedPhoto = async (
  photo: any,
  newFile: File,
  newCaption: string
) => {
  const visitId = Number(form.id);
  if (!visitId) return;

  const isOffline =
    !navigator.onLine ||
    ((window as any).Capacitor?.isNativePlatform && !(await hasInternet()));

  // 🟧 1) Primeiro apagar a foto antiga
  await handleDeleteSavedPhoto(photo);

  // 🟠 2) Se estiver OFFLINE → salva nova foto no IndexedDB
  if (isOffline) {
    const reader = new FileReader();
    reader.onload = async () => {
      await savePendingPhoto({
        visit_id: visitId,
        fileName: newFile.name,
        mime: newFile.type,
        dataUrl: reader.result as string,
        caption: newCaption || "",
        synced: false,
        latitude: form.latitude,
        longitude: form.longitude,
      });

      // Atualizar modal
      const off = await getAllPendingPhotos();

      setForm((f) => ({
        ...f,
        savedPhotos: [
          ...f.savedPhotos.filter((p) => !p.pending),
          ...off.filter((p) => p.visit_id === visitId),
        ],
      }));
    };

    reader.readAsDataURL(newFile);
    return;
  }

  // 🟢 3) ONLINE → enviar nova foto ao backend
  const fd = new FormData();
  fd.append("photos", newFile);
  fd.append("captions", newCaption);

  const resp = await fetch(`${API_BASE}visits/${visitId}/photos`, {
    method: "POST",
    body: fd,
  });

  if (!resp.ok) {
    alert("Falha ao enviar nova foto.");
    return;
  }

  // 🔄 Recarrega visita
  const updated = await fetch(`${API_BASE}visits/${visitId}`);
  if (updated.ok) {
    const data = await updated.json();
    setForm((f) => ({
      ...f,
      savedPhotos: data.photos || [],
    }));
  }

  alert("Foto substituída com sucesso!");
};


const handleEditSavedPhoto = async (
  photo: any, 
  newCaption: string
) => {

  const visitId = Number(form.id);

  // 1️⃣ OFFLINE → atualizar IndexedDB
  if (photo.pending) {
    await savePendingPhoto({
      ...photo,
      caption: newCaption,
      visit_id: visitId,
    });

    // Atualiza estado local
    setForm(f => ({
      ...f,
      savedPhotos: f.savedPhotos.map(p =>
        p.id === photo.id ? { ...p, caption: newCaption } : p
      )
    }));

    return;
  }

  // 2️⃣ ONLINE → enviar pro backend
  try {
    const resp = await fetch(`${API_BASE}photos/${photo.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ caption: newCaption }),
    });

    if (resp.ok) {
      // Atualiza lugar imediato (modal)
      setForm(f => ({
        ...f,
        savedPhotos: f.savedPhotos.map(p =>
          p.id === photo.id ? { ...p, caption: newCaption } : p
        )
      }));

      // 🔥🔥🔥 TRECHO QUE FALTAVA: recarregar fotos do backend
      try {
        const up = await fetch(`${API_BASE}visits/${visitId}`);
        if (up.ok) {
          const data = await up.json();

          setForm(f => ({
            ...f,
            savedPhotos: [
              ...(data.photos || []),  
              // mantém pendentes
              ...(f.savedPhotos.filter(p => p.pending) || [])
            ]
          }));
        }
      } catch (e) {
        console.warn("⚠️ Não foi possível atualizar fotos após edição.");
      }

    } else {
      alert("Erro ao atualizar legenda no servidor.");
    }
  } catch (e) {
    console.error(e);
    alert("Falha ao atualizar legenda.");
  }
  };


  const resolvePhotoSrc = (photo: any) => {
    const u = photo?.dataUrl || photo?.url || "";
    if (!u) return "";
    if (u.startsWith("data:")) return u;   // offline base64
    if (u.startsWith("http")) return u;    // R2 público
    // caso venha "/uploads/..." (legado)
    const base = API_BASE.replace(/\/$/, "");
    return u.startsWith("/") ? `${base}${u}` : `${base}/${u}`;
  };




  // ============================================================
  // 🗑️ Excluir (AGORA CORRIGIDO)
  // ============================================================
  const handleDelete = async () => {
    if (!form.id) return;
    if (!confirm("🗑 Deseja realmente excluir esta visita?")) return;

    try {
      const id = Number(form.id);

      // 1️⃣ Se estiver online, apaga do servidor
      if (navigator.onLine) {
        try {
          await fetch(`${API_BASE}visits/${id}`, { method: "DELETE" });
        } catch {
          console.warn("⚠️ Falha ao excluir no servidor (offline)");
        }
      }

      // 2️⃣ SEMPRE remove localmente — online ou offline
      await deleteLocalVisit(id);

      // 3️⃣ Atualiza agenda
      await loadVisits();
      setOpen(false);

    } catch (e) {
      console.error("Erro ao excluir:", e);
      alert("Erro ao excluir a visita.");
    }
  };

  // ============================================================
  // 📍 GPS
  // ============================================================
  const handleGetLocation = async () => {
    try {
      const isReallyOffline =
        !navigator.onLine ||
        ((window as any).Capacitor?.isNativePlatform && !(await hasInternet()));

      if (isReallyOffline) {

        const cached = localStorage.getItem("lastLocation");
        if (cached) {
          const { latitude, longitude } = JSON.parse(cached);
          setForm((f) => ({ ...f, latitude, longitude }));
          alert(`📍 Localização recuperada: ${latitude}, ${longitude}`);
        } else {
          alert("⚠️ Sem conexão — localização anterior não encontrada.");
        }
        return;
      }

      const position = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
      });
      const { latitude, longitude } = position.coords;
      setForm((f) => ({ ...f, latitude, longitude }));

      localStorage.setItem(
        "lastLocation",
        JSON.stringify({ latitude, longitude })
      );

      alert(
        `📍 Localização salva: ${latitude.toFixed(5)}, ${longitude.toFixed(5)}`
      );
    } catch (err) {
      console.error("Erro ao obter localização:", err);
      alert("⚠️ Falha ao capturar localização.");
    }
  };

    // ============================================================
    // ✅ Concluir visita (com atualização inteligente de data)
    // ============================================================
    const markDone = async () => {
      if (!form.id) return;

      try {
        const visitId = Number(form.id);

        // -----------------------------------------
        // 1️⃣ DEFINIR DATA CONCLUÍDA
        // -----------------------------------------

        // Data final:
        // → Se o usuário alterou a data manualmente: usar form.date
        // ❗ Se não alterou a data → mantém a original
        const finalDateStr = form.date;


        // Converte para ISO (yyyy-mm-dd) para salvar corretamente
        const [d, m, y] = finalDateStr.split("/");
        const finalDateISO = `${y}-${m}-${d}`;


        // -----------------------------------------
        // 2️⃣ SE ESTIVER OFFLINE → salvar apenas no IndexedDB
        // -----------------------------------------
        const isReallyOffline =
          !navigator.onLine ||
          ((window as any).Capacitor?.isNativePlatform && !(await hasInternet()));

        if (isReallyOffline) {
          await updateVisitWithSync(API_BASE, visitId, { 
            status: "done",
            date: finalDateISO,
            fenologia_real: form.fenologia_real || null,   // 👈 ADICIONADO
            recommendation: form.recommendation || "",     // 👈 garantir consistência
            latitude: form.latitude,
            longitude: form.longitude,
            products: form.products || [],
          });

          alert("🟠 Visita concluída offline! Será sincronizada quando voltar a internet.");
          setOpen(false);
          return;
        }

        
        console.log("📦 Enviando payload ao concluir:", {
          status: "done",
          date: finalDateISO,
          recommendation: form.recommendation ?? "",
          fenologia_real: form.fenologia_real ?? null,
          preserve_date: false,
          latitude: form.latitude,
          longitude: form.longitude,
          products: form.products || [],
        });




        // -----------------------------------------
        // 3️⃣ SE ONLINE → atualizar no backend
        // -----------------------------------------
        const result = await updateVisitWithSync(API_BASE, visitId, {
          status: "done",
          date: finalDateISO,            // ← agora o backend vai aceitar
          recommendation: form.recommendation ?? "",
          fenologia_real: form.fenologia_real ?? null,
          preserve_date: false,          // ← NÃO PRESERVAR a antiga ao concluir
          latitude: form.latitude,
          longitude: form.longitude,
          products: form.products || [],
        });



        if (result.synced) {
          alert("✅ Visita concluída!");
        } else {
          alert("🟠 Visita concluída offline (pendente de sync).");
        }

        await loadVisits();
        setOpen(false);

      } catch (err) {
        console.error("Erro ao concluir:", err);
        alert("❌ Erro ao concluir visita.");
      }
    };

    

    // ============================================================
    // 🔄 FINALIZADOR GLOBAL DE SINCRONIZAÇÃO (REVISADO)
    // ============================================================
    useEffect(() => {
      async function finalizeSync() {
        const isReallyOffline =
          !navigator.onLine ||
          ((window as any).Capacitor?.isNativePlatform && !(await hasInternet()));

        if (isReallyOffline) {
          return;
        }

        try {
          await loadVisits();

          setLastSync(
            new Date().toLocaleTimeString("pt-BR", {
              hour: "2-digit",
              minute: "2-digit",
            })
          );

          console.log("✅ Sync finalizada e calendário atualizado.");
        } catch (err) {
          console.warn("⚠️ Erro ao finalizar sync:", err);
        }
      }

      window.addEventListener("visits-synced", finalizeSync);
      window.addEventListener("visits-updated", finalizeSync);

      return () => {
        window.removeEventListener("visits-synced", finalizeSync);
        window.removeEventListener("visits-updated", finalizeSync);
      };
    }, []);

    
  // ============================================================
  // 📄 Funções auxiliares PDF (APK + Web)
  // ============================================================
  /*  
  const blobToBase64 = (blob: Blob): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = reject;
      reader.onload = () => resolve((reader.result as string).split(",")[1]);
      reader.readAsDataURL(blob);
    });
   */
   
  /*  
  const sharePDF = async (blob: Blob, fileName: string) => {
    const isApp = Capacitor.isNativePlatform();

    if (!isApp) {
      alert("Compartilhamento direto só funciona no APK.");
      return;
    }

    try {
      const base64Data = await blobToBase64(blob);

      await Filesystem.writeFile({
        path: fileName,
        data: base64Data,
        directory: Directory.Documents,
      });


      await (navigator as any).share({
        title: fileName,
        text: "Relatório técnico NutriCRM",
        files: [
          new File([blob], fileName, {
            type: "application/pdf",
          }),
        ],
      });
    } catch (err) {
      console.error("Erro ao compartilhar PDF:", err);
      alert("❌ Não foi possível compartilhar o PDF.");
    }
  };
  */
  
  /*  
  const openPDF = async (blob: Blob, fileName: string) => {
    const isApp = Capacitor.isNativePlatform();

    // 🖥️ Web/PWA → download normal
    if (!isApp) {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
      return;
    }

    // 📱 APK → salva e abre no Adobe Reader
    try {
      const base64Data = await blobToBase64(blob);

      await Filesystem.writeFile({
        path: fileName,
        data: base64Data,
        directory: Directory.Documents,
      });


      await FileOpener.open(saved.uri, "application/pdf");
    } catch (err) {
      console.error("Erro ao abrir PDF no APK:", err);
      alert("❌ Não foi possível abrir o PDF no dispositivo.");
    }
  };
  */


  // ============================================================
  // 🖼️ Lightbox
  // ============================================================
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [lightboxPhotos, setLightboxPhotos] = useState<string[]>([]);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState<number>(0);



  // 👀 Preview de visita no hover (até 3 fotos + recomendação)
  const [hoverPreview, setHoverPreview] = useState<{
    x: number;
    y: number;
    visit: any;
    photos: { src: string; caption?: string }[];
  } | null>(null);


useEffect(() => {
  if (!hoverPreview) return;

  const handleKey = (e: KeyboardEvent) => {
    const el = photosRef.current;
    if (!el) return;

    const step = 120; // quanto anda por tecla

    if (e.key === "ArrowRight") {
      el.scrollLeft += step;
    }

    if (e.key === "ArrowLeft") {
      el.scrollLeft -= step;
    }
  };

  window.addEventListener("keydown", handleKey);

  return () => {
    window.removeEventListener("keydown", handleKey);
  };
}, [hoverPreview]);



  const handleCloseLightbox = () => {
    setLightboxOpen(false);
    setLightboxUrl(null);
  };

  const handlePrevLightbox = () => {
    if (lightboxPhotos.length === 0) return;
    const prevIndex =
      (currentPhotoIndex - 1 + lightboxPhotos.length) %
      lightboxPhotos.length;
    setCurrentPhotoIndex(prevIndex);
    setLightboxUrl(lightboxPhotos[prevIndex]);
  };

  const handleNextLightbox = () => {
    if (lightboxPhotos.length === 0) return;
    const nextIndex = (currentPhotoIndex + 1) % lightboxPhotos.length;
    setCurrentPhotoIndex(nextIndex);
    setLightboxUrl(lightboxPhotos[nextIndex]);
  };

  // ============================================================
  // 👀 Hover do evento: mini-card com TODAS as fotos + preload
  // ============================================================
  const handleEventMouseEnter = (info: any) => {
    const v = info.event.extendedProps?.raw as any;
    if (!v) return;

    // 🔹 Fotos online + offline (SEM limite)
    const photos = [
      ...(v.photos || []).map((p: any) => ({
        src: resolvePhotoSrc(p),
        caption: p.caption || "",
      })),
      ...(v.offlinePhotos || []).map((p: any) => ({
        src: p.dataUrl, // base64 offline
        caption: p.caption || "",
      })),
    ];

    // 🔥 PRELOAD — evita delay no hover
    photos.forEach((p) => {
      const img = new Image();
      img.src = p.src;
    });

    if (isMobileLike()) {
      setHoverPreview({
        x: 0,
        y: 0,
        visit: v,
        photos,
      });
    } else {
      setHoverPreview({
        x: info.jsEvent.clientX,
        y: info.jsEvent.clientY,
        visit: v,
        photos,
      });
    }

  };

  const handleEventMouseLeave = () => {
    setHoverPreview(null);
  };



  const renderProdutosSection = () => {
    const units = ["L/ha", "mL/ha", "kg/ha", "g/ha", "%", "p.c", "Outro"];

    return (
      <div className="product-advanced" style={{ width: "100%" }}>
        <h4 className="mb-3">Produtos Aplicados</h4>

        <table className="product-table">
          <thead>
            <tr>
              <th style={{ width: "30%" }}>Produto</th>
              <th style={{ width: "15%" }}>Dose</th>
              <th style={{ width: "20%" }}>Unidade</th>
              <th style={{ width: "25%" }}>Data Aplicação</th>
              <th style={{ width: "10%" }}>Ação</th>
            </tr>
          </thead>

          <tbody>
            {form.products.map((p, i) => (
              <tr key={i}>
                <td>
                  <input
                    className="form-control"
                    value={p.product_name}
                    placeholder="Nome do produto"
                    onChange={(e) => {
                      const updated = [...form.products];
                      updated[i].product_name = e.target.value;
                      setForm({ ...form, products: updated });
                    }}
                  />
                </td>

                <td>
                  <input
                    className="form-control"
                    value={p.dose}
                    placeholder="1.5"
                    onChange={(e) => {
                      const updated = [...form.products];
                      updated[i].dose = e.target.value;
                      setForm({ ...form, products: updated });
                    }}
                  />
                </td>

                <td>
                  <select
                    className="form-select"
                    value={p.unit}
                    onChange={(e) => {
                      const updated = [...form.products];
                      updated[i].unit = e.target.value;
                      setForm({ ...form, products: updated });
                    }}
                  >
                    <option value="">Unidade</option>
                    {units.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                </td>

                <td>
                  <input
                    type="date"
                    className="form-control"
                    value={p.application_date || ""}
                    onChange={(e) => {
                      const updated = [...form.products];
                      updated[i].application_date = e.target.value;
                      setForm({ ...form, products: updated });
                    }}
                  />
                </td>

                <td>
                  <button
                    className="btn btn-danger"
                    onClick={() =>
                      setForm({
                        ...form,
                        products: form.products.filter((_, idx) => idx !== i),
                      })
                    }
                  >
                    ❌
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <button
          className="btn btn-primary mt-3"
          onClick={() =>
            setForm({
              ...form,
              products: [
                ...form.products,
                {
                  product_name: "",
                  dose: "",
                  unit: "",
                  application_date: null,
                } as Product,
              ],
            })
          }
        >
          ➕ Adicionar Produto
        </button>
      </div>
    );
  };


  const renderHoverPreview = () => {
    if (!hoverPreview || open) return null;

    const v = hoverPreview.visit;

    const clientName =
      v.client_name ||
      clients.find((c: any) => c.id === v.client_id)?.name ||
      "Cliente";

    let dateStr = "-";
    if (v.date) {
      const [yy, mm, dd] = v.date.split("-");
      dateStr = `${dd}/${mm}/${yy}`;
    }

    const stage = v.fenologia_real?.trim() || "—";
    const rec = (v.recommendation || "").trim();

    return (
      <div
        className="calendar-hover-preview"
        style={{
          position: "fixed",
          zIndex: 9999,
          maxWidth: "320px",
          background: "var(--panel)",
          color: "var(--text)",
          border: "1px solid var(--border)",
          borderRadius: "10px",
          boxShadow: "0 8px 20px rgba(0,0,0,0.35)",
          padding: "10px 12px",
          fontSize: "0.8rem",

          ...(isMobileLike()
            ? {
                top: "10%",
                left: "50%",
                transform: "translateX(-50%)",
                maxHeight: "80vh",
                overflowY: "auto",
              }
            : {
                top: hoverPreview.y + 12,
                left: hoverPreview.x + 12,
              }),
        }}
      >
        <div style={{ fontWeight: 600, marginBottom: 4 }}>
          VISITA #{v.id} — {clientName}
        </div>

        <div>🌱 {stage}</div>
        <div>📅 {dateStr}</div>

        {rec && (
          <div style={{ marginTop: 6 }}>
            <div style={{ fontWeight: 600, color: "#A5D6A7" }}>
              Recomendações Técnicas
            </div>
            <div style={{ maxHeight: "70px", overflow: "hidden" }}>
              {rec.length > 200 ? rec.slice(0, 200) + "…" : rec}
            </div>
          </div>
        )}

        {hoverPreview.photos?.length > 0 && (
          <div style={{ marginTop: 10 }}>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>Fotos</div>

            <div
              style={{
                fontSize: "0.7rem",
                opacity: 0.6,
                marginBottom: 4,
              }}
            >
              ⬅️ ➡️ Use as setas do teclado
            </div>

            <div
              ref={photosRef}
              style={{
                display: "flex",
                gap: 8,
                overflowX: "auto",
                paddingBottom: 4,
                scrollBehavior: "smooth",
                cursor: "grab",
                scrollbarWidth: "thin",           // Firefox
                WebkitOverflowScrolling: "touch", // iOS
              }}
            >
            
              {hoverPreview.photos.map((p, idx) => (
                <div key={idx} style={{ width: "90px", flex: "0 0 auto" }}>
                  <img
                    src={p.src}
                    loading="lazy"
                    onClick={() => {
                      // 🔥 AQUI entra exatamente o código que você perguntou
                      setLightboxPhotos(hoverPreview.photos.map(ph => ph.src));
                      setCurrentPhotoIndex(idx);
                      setLightboxUrl(hoverPreview.photos[idx].src);
                      setLightboxOpen(true);
                    }}
                    style={{
                      width: "100%",
                      height: "70px",
                      objectFit: "cover",
                      borderRadius: "6px",
                      border: "1px solid rgba(255,255,255,0.1)",
                    }}
                  />

                  {p.caption && (
                    <div
                      style={{
                        fontSize: "0.65rem",
                        marginTop: 2,
                        lineHeight: "1.1",
                        opacity: 0.85,
                      }}
                    >
                      {p.caption.length > 40
                        ? p.caption.slice(0, 40) + "…"
                        : p.caption}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };



  // ============================================================
  // Render
  // ============================================================
  return (
    <div className="calendar-page d-flex flex-column">
      {/* 🔹 Cabeçalho fixo da agenda */}
      <div className="calendar-header-sticky">
        {/* 🛰️ Banner de modo offline */}
        {offline && (
          <div
            style={{
              backgroundColor: "#ffcc00",
              color: "#000",
              padding: "6px 12px",
              textAlign: "center",
              fontWeight: 600,
              fontSize: "0.9rem",
              borderRadius: "6px",
              marginBottom: "6px",
              boxShadow: "0 2px 6px rgba(0,0,0,0.2)",
            }}
          >
            📴 Você está offline — exibindo dados do cache local
          </div>
        )}

        {/* 🔸 Alerta de visitas pendentes de sincronização */}
        {events.some((e) => e.extendedProps?.raw?.offline) && (
          <div
            style={{
              backgroundColor: "#ffcc00",
              color: "#000",
              padding: "4px 8px",
              borderRadius: "6px",
              fontSize: "0.85rem",
              fontWeight: 600,
              textAlign: "center",
              marginBottom: "8px",
              boxShadow: "0 2px 5px rgba(0,0,0,0.2)",
            }}
          >
            ⚠️ Existem visitas pendentes de sincronização (
            {events.filter((e) => e.extendedProps?.raw?.offline).length})
          </div>
        )}

        {/* 🔁 Indicador de sincronização */}
        {syncing && (
          <div
            style={{
              backgroundColor: "#007bff",
              color: "#fff",
              padding: "6px 12px",
              borderRadius: "6px",
              marginBottom: "6px",
              textAlign: "center",
              fontWeight: 600,
              fontSize: "0.9rem",
              boxShadow: "0 2px 6px rgba(0,0,0,0.2)",
              animation: "pulse 1.5s infinite",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
            }}
          >
            <span className="sync-spinner"></span>
            Sincronizando visitas com o servidor...
          </div>
        )}

        {!syncing && lastSync && (
          <div
            style={{
              backgroundColor: "#28a745",
              color: "#fff",
              padding: "4px 10px",
              borderRadius: "6px",
              marginBottom: "6px",
              textAlign: "center",
              fontWeight: 500,
              fontSize: "0.8rem",
              boxShadow: "0 1px 4px rgba(0,0,0,0.15)",
            }}
          >
            ✅ Última sincronização: {lastSync}
          </div>
        )}

        <div className="title-row">
          <h2 className="mb-0">Agenda de Visitas</h2>
        </div>

        <div className="filters-row">
          <select
            value={selectedConsultant}
            onChange={(e) => setSelectedConsultant(e.target.value)}
            className="form-select form-select-sm calendar-filter"
          >
            <option value="">Todos os consultores</option>
            {consultants.map((c) => (
              <option key={c.id} value={String(c.id)}>
                {c.name}
              </option>
            ))}
          </select>

          <select
            value={selectedVariety}
            onChange={(e) => setSelectedVariety(e.target.value)}
            className="form-select form-select-sm calendar-filter"
          >
            <option value="">Todas as variedades</option>
            {varieties.map((v) => (
              <option key={v.id} value={v.name}>
                {v.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading && <div className="text-muted mb-2">Carregando...</div>}

      <div className="calendar-shell" style={{ flex: "1 1 auto" }}>
        <FullCalendar
          ref={calendarRef}
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          locales={[ptBrLocale]}
          locale="pt-br"
          initialView="dayGridMonth"

          // ✅ desktop com altura fixa (evita recalcular e “voltar”)
          // ✅ mobile pode continuar auto
          height="auto"


          // ✅ ajuda a manter layout consistente
          expandRows={false}
          stickyHeaderDates={!isMobileLike()}


          // ✅ importante para timeGrid (sem isso, pode rolar “pulo” em week/day)
          scrollTime="06:00:00"
          handleWindowResize={true}
          windowResizeDelay={150}


          headerToolbar={{
            left: "prev,next today",
            center: "title",
            right: "dayGridMonth,timeGridWeek,timeGridDay",
          }}
          dayMaxEventRows={3}
          eventDisplay="block"

          events={events.filter((e) => {
            const cid = e.extendedProps?.raw?.consultant_id;
            const variety =
              e.extendedProps?.raw?.variety ||
              e.extendedProps?.raw?.variedade ||
              "";

            const matchesConsultant =
              !selectedConsultant || String(cid || "") === selectedConsultant;

            const matchesVariety =
              !selectedVariety ||
              String(variety)
                .toLowerCase()
                .includes(selectedVariety.toLowerCase());

            return matchesConsultant && matchesVariety;
          })}
          dateClick={(info) => {
            const isMobile =
              window.innerWidth <= 768 ||
              document.body.dataset.platform === "mobile";
            if (isMobile) return;


            const dateStr = info.dateStr;
            const [y, m, d] = dateStr.split("-");
            setForm({
              id: null,
              date: `${d}/${m}/${y}`,
              originalDate: "",
              dateBackup: "",
              client_id: "",
              property_id: "",
              plot_id: "",
              consultant_id: "",
              culture: "",
              variety: "",
              recommendation: "",
              fenologia_real: "",
              genPheno: true,
              savedPhotos: [],
              clientSearch: "",
              latitude: null,
              longitude: null,
              status: "planned",
              products: [],
            });
            setSelectedFiles([]);
            setSelectedCaptions([]);
            setOpen(true);
          }}
          eventClick={(info) => {
            const v = info.event.extendedProps?.raw as Visit | undefined;
            if (!v) return;
            // ⛔ Nunca usar new Date(v.date) — causa bug de timezone
            let d = null;
            if (v.date) {
              const [yyyy, mm, dd] = v.date.split("-");
              d = `${dd}/${mm}/${yyyy}`;
            }


            setForm({
              id: v.id,
              date: d || "",
              originalDate: d || "",
              dateBackup: d || "",
              client_id: String(v.client_id || ""),
              property_id: String(v.property_id || ""),
              plot_id: String(v.plot_id || ""),
              consultant_id: String(v.consultant_id || ""),
              culture: v.culture || "",
              variety: v.variety || "",
              fenologia_real: v.fenologia_real || "",
              genPheno: false,
              savedPhotos: [
                ...(v.photos || []),
                ...((v as any).offlinePhotos || []),
              ],
              clientSearch: "",
              latitude: v.latitude || null,
              longitude: v.longitude || null,
              status: "planned",
              recommendation: v.recommendation || "",   // só o texto técnico
              products: v?.products || [],
            });
            setSelectedFiles([]);
            setSelectedCaptions([]);
            setOpen(true);
          }}
          eventContent={(arg) => {
            const v = (arg.event.extendedProps?.raw as any) || {};
            const isOffline = v.offline === true;

            const bg = isOffline
              ? "#ffcc00"
              : colorFor(v?.date || arg.event.startStr, v?.status);

            const stage =
              (v.fenologia_real && v.fenologia_real.trim() !== "")
                ? v.fenologia_real.trim()
                : (v.recommendation || "-");


            const clientName =
              v.client_name ||
              v.clientSearch ||
              clients.find((c: any) => c.id === v.client_id)?.name ||
              "Cliente offline";

            const variety = v?.variety || "—";

            const consultant =
              v.consultant_name ||
              consultants.find((x: any) => x.id === v.consultant_id)?.name ||
              "—";

            return (
              <div
                className="fc-visit-card"
                style={{
                  backgroundColor: bg,
                  borderColor: isOffline ? "#ffaa00" : bg,
                  color: isOffline ? "#000" : "#fff",
                  borderStyle: isOffline ? "dashed" : "solid",
                  opacity: isOffline ? 0.9 : 1,
                }}
              >
                <div className="fc-visit-line">
                  {isOffline ? "🔸" : "👤"} {clientName}
                </div>
                <div className="fc-visit-line">🌱 {variety}</div>
                <div className="fc-visit-line">📍 {stage}</div>
                <div className="fc-visit-line">👨‍🌾 {consultant}</div>
                {isOffline && (
                  <div
                    style={{
                      fontSize: "0.75rem",
                      fontWeight: 600,
                      color: "#663c00",
                      textAlign: "center",
                      marginTop: "2px",
                    }}
                  >
                    ⚠️ Offline – aguardando sync
                  </div>
                )}
              </div>
            );
          }}
          eventDidMount={(info) => {
            const v = info.event.extendedProps?.raw as any;
            if (v?.offline) {
              info.el.style.border = "2px dashed #ffaa00";
              info.el.style.opacity = "0.9";
              info.el.title =
                "⚠️ Visita salva offline — será sincronizada quando a internet voltar.";
            }
          }}
          eventMouseEnter={handleEventMouseEnter}
          eventMouseLeave={handleEventMouseLeave}
        />
        {renderHoverPreview()}
       </div>



            
      {/* ➕ FAB no mobile */}
      {document.body.dataset.platform === "mobile" && (
        <button
          className="fab"
          onClick={() => {
            const btn = document.querySelector(".fab");
            if (btn) {
              btn.classList.add("pressed");
              setTimeout(() => btn.classList.remove("pressed"), 180);
            }
            setForm({
              id: null,
              date: new Date().toLocaleDateString("pt-BR"),
              originalDate: "",
              dateBackup: "",
              client_id: "",
              property_id: "",
              plot_id: "",
              consultant_id: "",
              culture: "",
              variety: "",
              recommendation: "",
              fenologia_real: "",
              genPheno: true,
              savedPhotos: [],
              clientSearch: "",
              latitude: null,
              longitude: null,
              status: "planned",
              products: [],
            });
            setSelectedFiles([]);
            setSelectedCaptions([]);
            setOpen(true);
          }}
          aria-label="Nova visita"
        >
          <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 5c.552 0 1 .448 1 1v5h5a1 1 0 1 1 0 2h-5v5a1 1 0 1 1-2 0v-5H6a1 1 0 1 1 0-2h5V6c0-.552.448-1 1-1z" />
          </svg>
        </button>
      )}

      {/* ============================== */}
      {/* 🔵 MODAL DE CRIAÇÃO / EDIÇÃO  */}
      {/* ============================== */}
      {open && (
        <div
          className="modal fade show d-block"
          tabIndex={-1}
          role="dialog"
          style={{ backgroundColor: "rgba(0,0,0,0.7)" }}
        >
          <div
            className="modal-dialog modal-dialog-centered"
            role="document"
            style={{
              maxWidth: "1200px",   // ← largura maior
              width: "98%",         // ← responsivo
            }}
          >

            <div
              className="modal-content border-0 shadow-lg"
              style={{
                background: "var(--panel)",
                color: "var(--text)",
                transition: "background 0.3s ease, color 0.3s ease",
                maxHeight: "90vh",     // ← faz o modal caber na tela
                overflowY: "auto",     // ← scroll interno
                borderRadius: "14px",
                paddingBottom: "10px",
              }}
            >

              {/* 🔷 Cabeçalho */}
              <div className="modal-header border-0">
                <h5 className="modal-title">
                  {form.id ? "Editar Visita" : "Nova Visita"}
                </h5>
                <button
                  type="button"
                  className="btn-close btn-close-white"
                  aria-label="Fechar"
                  onClick={() => setOpen(false)}
                ></button>
              </div>

              {/* 🔷 Abas do modal */}
              <div
                className="modal-tabs"
                style={{
                  display: "flex",
                  borderBottom: "1px solid var(--border)",
                  marginBottom: "15px",
                }}
              >
                <button
                  onClick={() => setTab("dados")}
                  className={tab === "dados" ? "tab-active" : "tab"}
                >
                  📝 Dados da Visita
                </button>

                <button
                  onClick={() => setTab("produtos")}
                  className={tab === "produtos" ? "tab-active" : "tab"}
                >
                  🧪 Produtos Aplicados
                </button>

                {form.id && (
                  <button
                    onClick={() => setTab("fotos")}
                    className={tab === "fotos" ? "tab-active" : "tab"}
                  >
                    📸 Fotos
                  </button>
                )}
              </div>

              {/* ========================== */}
              {/* 🔵 CONTEÚDO DO MODAL       */}
              {/* ========================== */}
              <div className="modal-body">
                {/* 🔹 ABA — DADOS */}
                {tab === "dados" && (
                  <div className="row g-3">
                    {/* Data */}
                    <div className="col-md-4">
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                        }}
                      >
                        <label className="form-label fw-semibold">Data</label>

                        <button
                          type="button"
                          onClick={() => {
                            const now = new Date();
                            const tStr =
                              String(now.getDate()).padStart(2, "0") +
                              "/" +
                              String(now.getMonth() + 1).padStart(2, "0") +
                              "/" +
                              now.getFullYear();

                            setForm((f) => ({ ...f, date: tStr }));
                          }}
                          style={{
                            background: "#28a745",
                            border: "none",
                            color: "white",
                            padding: "3px 8px",
                            borderRadius: "6px",
                            fontSize: "0.75rem",
                            cursor: "pointer",
                            transition: "0.2s",
                          }}
                        >
                          Hoje
                        </button>
                      </div>

                      <input
                        name="date"
                        value={form.date}
                        onChange={handleChange}
                        placeholder="dd/mm/aaaa"
                        className="form-control"
                        style={{
                          background: "var(--input-bg)",
                          color: "var(--text)",
                          borderColor: "var(--border)",
                        }}
                      />
                    </div>

                    {/* Cliente */}
                    <div className="col-12 position-relative">
                      <label className="form-label fw-semibold">Cliente</label>
                      <input
                        type="text"
                        className="form-control"
                        style={{
                          background: "var(--input-bg)",
                          color: "var(--text)",
                          borderColor: "var(--border)",
                        }}
                        value={
                          form.clientSearch !== ""
                            ? form.clientSearch
                            : clients.find((c) => String(c.id) === form.client_id)?.name ||
                              ""
                        }
                        onChange={(e) => {
                          const value = e.target.value;
                          setForm((f) => ({
                            ...f,
                            clientSearch: value,
                            client_id: "",
                          }));
                        }}
                        placeholder="Digite o nome do cliente..."
                      />

                      {form.clientSearch.length > 0 && (
                        <ul
                          className="list-group position-absolute w-100 mt-1"
                          style={{
                            maxHeight: "150px",
                            overflowY: "auto",
                            zIndex: 20,
                          }}
                        >
                          {clients
                            .filter((c) =>
                              c.name
                                .toLowerCase()
                                .startsWith(form.clientSearch.toLowerCase())
                            )
                            .map((c) => (
                              <li
                                key={c.id}
                                className={`list-group-item list-group-item-action ${
                                  form.client_id === String(c.id)
                                    ? "active bg-success text-white"
                                    : "bg-dark text-light"
                                }`}
                                onClick={() =>
                                  setForm((f) => ({
                                    ...f,
                                    client_id: String(c.id),
                                    clientSearch: "",
                                  }))
                                }
                                style={{ cursor: "pointer" }}
                              >
                                {c.name}
                              </li>
                            ))}
                        </ul>
                      )}
                    </div>

                    {/* Propriedade */}
                    <div className="col-md-6">
                      <label className="form-label fw-semibold">Propriedade</label>
                      <DarkSelect
                        name="property_id"
                        value={form.property_id}
                        placeholder="Selecione propriedade"
                        options={[
                          { value: "", label: "Selecione propriedade" },
                          ...properties.map((p) => ({
                            value: String(p.id),
                            label: p.name,
                          })),
                        ]}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            property_id: e.target.value,
                            plot_id: "",
                          }))
                        }
                      />
                    </div>

                    {/* Talhão */}
                    <div className="col-md-6">
                      <label className="form-label fw-semibold">Talhão</label>
                      <DarkSelect
                        name="plot_id"
                        value={form.plot_id}
                        placeholder="Selecione talhão"
                        options={[
                          { value: "", label: "Selecione talhão" },
                          ...plots.map((pl) => ({
                            value: String(pl.id),
                            label: pl.name,
                          })),
                        ]}
                        onChange={handleChange}
                      />
                    </div>

                    {/* Cultura */}
                    <div className="col-md-6">
                      <label className="form-label fw-semibold">Cultura</label>
                      <select
                        name="culture"
                        value={form.culture}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            culture: e.target.value,
                            variety: "",
                          }))
                        }
                        className="form-select"
                        style={{
                          background: "var(--input-bg)",
                          color: "var(--text)",
                          borderColor: "var(--border)",
                        }}
                      >
                        <option value="">Selecione</option>
                        {cultures.map((c) => (
                          <option key={c.id} value={c.name}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Variedade */}
                    <div className="col-md-6">
                      <label className="form-label fw-semibold">Variedade</label>
                      <select
                        name="variety"
                        value={form.variety}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, variety: e.target.value }))
                        }
                        disabled={!form.culture}
                        className="form-select"
                        style={{
                          background: "var(--input-bg)",
                          color: "var(--text)",
                          borderColor: "var(--border)",
                        }}
                      >
                        <option value="">Selecione</option>
                        {varieties
                          .filter(
                            (v) =>
                              v.culture.toLowerCase() ===
                              form.culture.toLowerCase()
                          )
                          .map((v) => (
                            <option key={v.id} value={v.name}>
                              {v.name}
                            </option>
                          ))}
                      </select>
                    </div>

                    {/* Consultor */}
                    <div className="col-md-6">
                      <label className="form-label fw-semibold">Consultor</label>
                      <select
                        name="consultant_id"
                        value={form.consultant_id}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            consultant_id: e.target.value,
                          }))
                        }
                        className="form-select"
                        style={{
                          background: "var(--input-bg)",
                          color: "var(--text)",
                          borderColor: "var(--border)",
                        }}
                      >
                        <option value="">Selecione</option>
                        {consultants.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Toggle Fenológico */}
                    <div className="col-12 mt-3">
                      <label className="fw-semibold mb-1">
                        Cronograma Fenológico
                      </label>

                      <div
                        onClick={() =>
                          setForm((f) => ({ ...f, genPheno: !f.genPheno }))
                        }
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "12px",
                          cursor: "pointer",
                          padding: "10px 14px",
                          borderRadius: "12px",
                          background: "var(--input-bg)",
                          border: `1px solid ${
                            form.genPheno ? "#28a745" : "var(--border)"
                          }`,
                          transition: "all 0.25s ease",
                          userSelect: "none",
                        }}
                      >
                        <div
                          style={{
                            width: 42,
                            height: 22,
                            borderRadius: 50,
                            background: form.genPheno ? "#28a745" : "#777",
                            position: "relative",
                            transition: "all 0.2s ease-in-out",
                          }}
                        >
                          <div
                            style={{
                              width: 18,
                              height: 18,
                              background: "#fff",
                              borderRadius: "50%",
                              position: "absolute",
                              top: 2,
                              left: form.genPheno ? 22 : 2,
                              transition: "all 0.2s ease-in-out",
                              boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
                            }}
                          ></div>
                        </div>

                        <span
                          style={{
                            fontSize: "0.95rem",
                            fontWeight: 500,
                            color: form.genPheno
                              ? "#28a745"
                              : "var(--text-muted)",
                            transition: "color 0.25s ease",
                          }}
                        >
                          Gerar cronograma fenológico (milho/soja/algodão)
                        </span>
                      </div>
                    </div>

                    {/* Localização */}
                    <div className="col-12 mt-3">
                      <button
                        type="button"
                        className="btn btn-outline-info"
                        onClick={handleGetLocation}
                      >
                        📍 Capturar Localização
                      </button>
                    </div>

                    {/* Fenologia real */}
                    <div className="col-12">
                      <label className="form-label fw-semibold">
                        Fenologia Observada
                      </label>
                      <input
                        type="text"
                        name="fenologia_real"
                        value={form.fenologia_real}
                        onChange={handleChange}
                        placeholder="Ex: V6, R1, 6 folhas..."
                        className="form-control"
                        style={{
                          background: "var(--input-bg)",
                          color: "var(--text)",
                          borderColor: "var(--border)",
                        }}
                      />
                    </div>

                    {/* Observações */}
                    <div className="col-12">
                      <label className="form-label fw-semibold">
                        Observações
                      </label>
                      <textarea
                        name="recommendation"
                        value={form.recommendation}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            recommendation: e.target.value,
                          }))
                        }
                        placeholder="Descreva observações..."
                        className="form-control"
                        style={{
                          background: "var(--input-bg)",
                          color: "var(--text)",
                          borderColor: "var(--border)",
                        }}
                      />
                    </div>
                  </div>
                )}

                {/* 🔹 ABA — PRODUTOS */}
                {tab === "produtos" && (
                  <div className="p-2" style={{ overflowX: "auto" }}>
                    {renderProdutosSection()}
                  </div>
                )}

                {/* 🔹 ABA — FOTOS */}
                {tab === "fotos" && form.id && (
                  <div className="p-2">

                    {/* Componente responsável por:
                        - selecionar fotos
                        - mostrar preview
                        - editar legenda
                    */}
                    <VisitPhotos
                      visitId={form.id}
                      photos={form.savedPhotos}

                      // 🔥 AQUI ESTÁ A LIGAÇÃO QUE FALTAVA
                      onFilesSelected={(files, captions) => {
                        setSelectedFiles(files);
                        setSelectedCaptions(captions);
                      }}

                      onDelete={handleDeleteSavedPhoto}
                      onReplace={handleReplaceSavedPhoto}
                      onEdit={handleEditSavedPhoto}
                      onAutoLocation={handleAutoSetLocation}
                    />

                    {/* Botão salvar — usa o estado do Calendar */}
                    {selectedFiles.length > 0 && (
                      <button
                        className="btn btn-success mt-3 w-100"
                        onClick={handleSavePhotos}
                      >
                        💾 Salvar Fotos
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Rodapé */}
              <div className="modal-footer border-0">
                <button
                  className="btn btn-secondary"
                  onClick={() => setOpen(false)}
                >
                  Cancelar
                </button>

                {!form.id && (
                  <button
                    className="btn btn-success"
                    onClick={handleCreateOrUpdate}
                  >
                    💾 Salvar
                  </button>
                )}

                {form.id && (
                  <>
                    <a
                      href={`${API_BASE}visits/${form.id}/pdf`}
                      target="_blank"
                      rel="noreferrer"
                      className="btn btn-outline-primary d-flex align-items-center"
                    >
                      📄 PDF
                    </a>

                      <button className="btn btn-success" onClick={markDone}>
                      ✅ Concluir
                    </button>

                    <button className="btn btn-danger" onClick={handleDelete}>
                      🗑 Excluir
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 🖼️ Lightbox Modal */}
      {lightboxOpen && (
        <div className="lightbox-overlay" onClick={handleCloseLightbox}>
          <div
            className="lightbox-content"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="lightbox-nav left"
              onClick={(e) => {
                e.stopPropagation();
                handlePrevLightbox();
              }}
            >
              ⟵
            </button>

            <img src={lightboxUrl || ""} alt="Visualização ampliada" />

            <button
              className="lightbox-nav right"
              onClick={(e) => {
                e.stopPropagation();
                handleNextLightbox();
              }}
            >
              ⟶
            </button>

            <button className="lightbox-close" onClick={handleCloseLightbox}>
              ✕
            </button>
          </div>
        </div>
       )}
    </div>
  );
};

export default CalendarPage;

