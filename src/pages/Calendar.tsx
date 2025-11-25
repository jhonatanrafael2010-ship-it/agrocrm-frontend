import React, { useEffect, useRef, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import ptBrLocale from "@fullcalendar/core/locales/pt-br";
import DarkSelect from "../components/DarkSelect";
import "../styles/Calendar.css";
import { Geolocation } from "@capacitor/geolocation";
import { Filesystem, Directory } from '@capacitor/filesystem';
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
  getAllFromStore,   // ← ADICIONADO
} from "../utils/indexedDB";
import { deleteLocalVisit } from "../utils/indexedDB";  // ← ADICIONE ESSE IMPORT


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
};



const CalendarPage: React.FC = () => {
  const calendarRef = useRef<any>(null);

  // 🛰️ Status de conexão
  const [offline, setOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const checkConnection = () => {
      const status = !navigator.onLine;
      setOffline(status);
      console.log(status ? "📴 Offline detectado" : "🌐 Online detectado");
    };

    checkConnection();
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
  });

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
      // 1) Buscar visitas online
      const onlineVisits: Visit[] = await fetchWithCache(
        `${API_BASE}visits?scope=all`,
        "visits"
      );

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



  // ============================================================
  // 🚀 Load inicial
  // ============================================================
  useEffect(() => {
    async function loadBaseData() {
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

        setClients(cs);
        setProperties(ps);
        setPlots(pls);
        setCultures(cts);
        setVarieties(vars);
        setConsultants(cons);

        console.log("📦 Dados carregados (online ou cache).");
      } catch (err) {
        console.warn("⚠️ Falha geral ao carregar dados base:", err);
        alert("⚠️ Sem conexão — dados limitados disponíveis.");
        setClients([]);
        setProperties([]);
        setPlots([]);
        setCultures([]);
        setVarieties([]);
        setConsultants([]);
      } finally {
        await loadVisits();
        setLoading(false);
      }
    }

    loadBaseData();
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
  function savePhotoOffline(visitId: number, file: File, caption: string) {
    if (!visitId || isNaN(visitId)) {
      console.error("❌ ERRO: visitId inválido ao salvar foto offline:", visitId);
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      await savePendingPhoto({
        visit_id: visitId,
        fileName: file.name,
        mime: file.type,
        dataUrl: reader.result as string,
        caption: caption || "",
        synced: false,
      });
      console.log("🟠 Foto salva offline:", file.name);
    };

    reader.readAsDataURL(file);
  }



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

  const payload: any = {
    client_id: Number(form.client_id),
    property_id: form.property_id ? Number(form.property_id) : null,
    plot_id: form.plot_id ? Number(form.plot_id) : null,
    consultant_id: form.consultant_id ? Number(form.consultant_id) : null,
    date: iso,
    status: "planned",
    culture: cultureName || "",
    variety: form.variety || "",
    recommendation: "Plantio",
    latitude: form.latitude,
    longitude: form.longitude,
    generate_schedule: isPhenoCulture,
    genPheno: isPhenoCulture,
  };

  console.log("📦 Payload enviado:", payload);

  try {
    let result;

    // 🔵 EDITAR — garante que nada seja apagado no backend
    if (form.id) {
      console.log("🟦 Atualizando visita existente:", form.id);

      const safePayload = {
        ...payload,
        recommendation: form.recommendation || payload.recommendation,
        status: form.status || "planned",
        culture: form.culture || payload.culture,
        variety: form.variety || payload.variety,
        client_id: Number(form.client_id),
        property_id: form.property_id ? Number(form.property_id) : null,
        plot_id: form.plot_id ? Number(form.plot_id) : null,
        consultant_id: form.consultant_id ? Number(form.consultant_id) : null,
        latitude: form.latitude,
        longitude: form.longitude,
        preserve_date: true,
      };

      result = await updateVisitWithSync(API_BASE, Number(form.id), safePayload);
    }


    // 🟢 CRIAR
    else {
      console.log("🟩 Criando visita nova...");
      result = await createVisitWithSync(API_BASE, payload);
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

    setForm((f) => ({
      ...f,
      savedPhotos: [
        ...(f.savedPhotos || []),
        ...off
          .filter((p) => p.visit_id === visitId)
          .map((p) => ({
            id: p.id,
            dataUrl: p.dataUrl,
            caption: p.caption,
            pending: true,
          })),
      ],
    }));

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
  selectedFiles.forEach((file, i) => {
    fd.append("photos", file, file.name);
    fd.append("captions", selectedCaptions[i] || "");
  });

  const url = `${API_BASE}visits/${visitId}/photos`;
  const resp = await fetch(url, {
    method: "POST",
    body: fd,
  });

  if (!resp.ok) {
    alert("⚠️ Falha ao enviar fotos.");
    return;
  }

  console.log("📸 Fotos enviadas com sucesso!");
  alert("📸 Fotos enviadas!");

  // Limpa seleção
  setSelectedFiles([]);
  setSelectedCaptions([]);

  // Recarrega visitas
  await loadVisits();
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
  // ✅ Concluir (com suporte offline real)
  // ============================================================
    const markDone = async () => {
      if (!form.id) return;

      try {
        // 🟠 OFFLINE → apenas salvar status no IndexedDB
        const isReallyOffline =
          !navigator.onLine ||
          ((window as any).Capacitor?.isNativePlatform && !(await hasInternet()));

        if (isReallyOffline) {

          await updateVisitWithSync(API_BASE, form.id as number, { status: "done" });
          alert("🟠 Visita concluída offline! Será sincronizada quando voltar internet.");
          setOpen(false);
          return;
        }

        // 🟢 ONLINE → envia PUT normal
        const result = await updateVisitWithSync(API_BASE, form.id as number, {
          status: "done",
          preserve_date: true,   // 🔥 sinalizador
        });


        if (result.synced) {
          alert("✅ Visita concluída com sucesso!");
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
  const [lightboxPhotos] = useState<string[]>([]);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState<number>(0);

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
  // Render
  // ============================================================
  return (
    <div className="calendar-page">
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

      <div className="calendar-shell">
        <FullCalendar
          ref={calendarRef}
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          locales={[ptBrLocale]}
          locale="pt-br"
          initialView="dayGridMonth"
          height={window.innerWidth < 768 ? "auto" : 650}
          expandRows={true}
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
              client_id: "",
              property_id: "",
              plot_id: "",
              consultant_id: "",
              culture: "",
              variety: "",
              recommendation: "",
              genPheno: true,
              savedPhotos: [],
              clientSearch: "",
              latitude: null,
              longitude: null,
              status: "planned",
            });
            setSelectedFiles([]);
            setSelectedCaptions([]);
            setOpen(true);
          }}
          eventClick={(info) => {
            const v = info.event.extendedProps?.raw as Visit | undefined;
            if (!v) return;
            const d = v.date ? new Date(v.date) : null;

            const clientName =
              v.client_name ||
              clients.find((c) => c.id === v.client_id)?.name ||
              "";

            setForm({
              id: v.id,
              date: d ? d.toLocaleDateString("pt-BR") : "",
              client_id: String(v.client_id || ""),
              property_id: String(v.property_id || ""),
              plot_id: String(v.plot_id || ""),
              consultant_id: String(v.consultant_id || ""),
              culture: v.culture || "",
              variety: v.variety || "",
              recommendation: v.recommendation || "",
              genPheno: false,
              savedPhotos: [
                ...(v.photos || []),
                ...((v as any).offlinePhotos || []),
              ],
              clientSearch: clientName,
              latitude: v.latitude || null,
              longitude: v.longitude || null,
              status: "planned",
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
              ((v?.recommendation?.split("—").pop() || v?.recommendation || "") +
                "").trim() || "-";

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
        />
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
              client_id: "",
              property_id: "",
              plot_id: "",
              consultant_id: "",
              culture: "",
              variety: "",
              recommendation: "",
              genPheno: true,
              savedPhotos: [],
              clientSearch: "",
              latitude: null,
              longitude: null,
              status: "planned",
            });
            setOpen(true);
          }}
          aria-label="Nova visita"
        >
          <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 5c.552 0 1 .448 1 1v5h5a1 1 0 1 1 0 2h-5v5a1 1 0 1 1-2 0v-5H6a1 1 0 1 1 0-2h5V6c0-.552.448-1 1-1z" />
          </svg>
        </button>
      )}

      {/* MODAL */}
      {open && (
        <div
          className="modal fade show d-block"
          tabIndex={-1}
          role="dialog"
          style={{ backgroundColor: "rgba(0,0,0,0.7)" }}
        >
          <div
            className="modal-dialog modal-dialog-centered modal-xl"
            role="document"
          >
            <div
              className="modal-content border-0 shadow-lg"
              style={{
                background: "var(--panel)",
                color: "var(--text)",
                transition: "background 0.3s ease, color 0.3s ease",
                maxWidth: "1100px",
              }}
            >
              {/* Cabeçalho */}
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

              <div className="modal-body">
                <div className="row g-3">

                  {/* Data */}
                  <div className="col-md-4">
                    <label className="form-label fw-semibold">Data</label>
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

                  {/* Cliente com busca */}
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
                        clients.find((c) => String(c.id) === form.client_id)?.name ||
                        form.clientSearch ||
                        ""
                      }
                      onChange={(e) => {
                        const value = e.target.value;
                        setForm((f) => ({ ...f, clientSearch: value, client_id: "" }));
                      }}
                      placeholder="Digite o nome do cliente..."
                    />

                    {form.clientSearch && (
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
                            c.name.toLowerCase().startsWith(form.clientSearch.toLowerCase())
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
                                  clientSearch: c.name,
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
                          (v) => v.culture.toLowerCase() === form.culture.toLowerCase()
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
                        setForm((f) => ({ ...f, consultant_id: e.target.value }))
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

                  {/* Checkbox fenológico */}
                  <div className="col-12 form-check mt-3">
                    <input
                      id="genPheno"
                      type="checkbox"
                      className="form-check-input"
                      checked={form.genPheno}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, genPheno: e.target.checked }))
                      }
                    />
                    <label htmlFor="genPheno" className="form-check-label ms-2">
                      Gerar cronograma fenológico (milho/soja/algodão)
                    </label>
                  </div>

                  {/* Botão localização */}
                  <div className="col-12 mt-3">
                    <button
                      type="button"
                      className="btn btn-outline-info"
                      onClick={handleGetLocation}
                    >
                      📍 Capturar Localização
                    </button>
                  </div>

                  {/* Recomendação */}
                  <div className="col-12">
                    <label className="form-label fw-semibold">Recomendação</label>
                    <textarea
                      name="recommendation"
                      value={form.recommendation}
                      onChange={handleChange}
                      placeholder="Observações..."
                      className="form-control"
                      style={{
                        background: "var(--input-bg)",
                        color: "var(--text)",
                        borderColor: "var(--border)",
                      }}
                    />
                  </div>

                  {/* Fotos só aparecem depois que a visita existe */}
                    {form.id && (
                      <VisitPhotos
                        visitId={Number(form.id)}
                        existingPhotos={form.savedPhotos}
                        onFilesSelected={(files, captions) => {
                          setSelectedFiles(files);
                          setSelectedCaptions(captions);
                        }}
                      />
                    )}
                  {form.id && selectedFiles.length > 0 && (
                    <button
                      className="btn btn-success mt-3"
                      onClick={handleSavePhotos}
                    >
                      💾 Salvar Fotos
                    </button>
                  )}
                </div>
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
                      href={`/download.html?visit=${form.id}`}
                      className="btn btn-outline-primary d-flex align-items-center"
                    >
                      📄 PDF
                    </a>

                    <button
                      className="btn btn-success d-flex align-items-center"
                      onClick={async () => {
                        if (!form.id) {
                          alert("⚠️ Salve a visita antes de compartilhar o PDF.");
                          return;
                        }

                        try {
                          const pdfUrl = `${API_BASE}visits/${form.id}/pdf`;

                          // Baixar o PDF no storage interno
                          const downloaded = await Filesystem.downloadFile({
                            url: pdfUrl,
                            directory: Directory.Documents,
                            path: `relatorio_${form.id}.pdf`,
                          });

                          // Caminho real no Android
                          const pdfUri = downloaded.path ?? null;

                          if (!pdfUri) {
                            alert("❌ Não foi possível salvar o PDF no dispositivo.");
                            return;
                          }

                          // Compartilhar via share nativo
                          await (navigator as any).share({
                            title: "Relatório NutriCRM",
                            text: "Segue o relatório agronômico.",
                            url: pdfUri,  // Agora correto
                          });

                        } catch (err) {
                          console.error("Erro ao compartilhar PDF:", err);
                          alert("❌ Não foi possível compartilhar o PDF.");
                        }
                      }}
                    >
                      📤 WhatsApp
                    </button>




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
