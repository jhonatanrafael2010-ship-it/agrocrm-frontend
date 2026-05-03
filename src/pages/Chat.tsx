import React, { useEffect, useRef, useState } from "react";
import { Send, Camera, X, Loader2, Image as ImageIcon, Mic, MicOff } from "lucide-react";
import { Camera as CapCamera, CameraResultType, CameraSource } from "@capacitor/camera";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
import { SpeechRecognition } from "@capacitor-community/speech-recognition";
import { API_BASE } from "../config";
import { fetchWithCache } from "../utils/offlineSync";
import "../styles/chat.css";

interface Message {
  id: number;
  role: "user" | "bot";
  text: string;
  images?: string[];
  pdfItems?: { url: string; label: string; filename: string }[];
  timestamp: Date;
}

interface PendingPhoto {
  dataUrl: string;
  key: number;
}

function getOrCreateSession(): string {
  const key = "nutricrm_chat_session";
  let sid = localStorage.getItem(key);
  if (!sid) {
    sid = `mob_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    localStorage.setItem(key, sid);
  }
  return sid;
}

function getConsultantId(): string {
  return localStorage.getItem("nutricrm_consultant_id") || "";
}

function isNativeApp(): boolean {
  return (window as any).Capacitor?.isNativePlatform?.() === true;
}

async function webPathToDataUrl(webPath: string): Promise<string> {
  const res = await fetch(webPath);
  const blob = await res.blob();
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.readAsDataURL(blob);
  });
}

const Chat: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 0,
      role: "bot",
      text: "Olá! Como posso ajudar?",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [pendingPhotos, setPendingPhotos] = useState<PendingPhoto[]>([]);
  const [showPhotoSheet, setShowPhotoSheet] = useState(false);
  const [consultantId, setConsultantId] = useState(getConsultantId);
  const [showConsultantPicker, setShowConsultantPicker] = useState(!getConsultantId());
  const [consultantOptions, setConsultantOptions] = useState<{ id: number; name: string }[]>([]);

  const [recording, setRecording] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [toast, setToast] = useState("");

  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const photoKeyRef = useRef(0);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    fetchWithCache(`${API_BASE}consultants`, "consultants")
      .then((data) => setConsultantOptions(data || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    return () => { SpeechRecognition.stop().catch(() => {}); };
  }, []);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 2500);
  }

  function handleDownloadPdf(url: string) {
    window.open(url, "_system");
  }

  async function handleSharePdf(label: string, r2url: string, filename: string) {
    const proxyUrl = `${API_BASE}mobile/pdf-proxy?url=${encodeURIComponent(r2url)}`;
    try {
      // Baixa PDF via proxy (sem CORS)
      const res = await fetch(proxyUrl);
      if (!res.ok) throw new Error("fetch falhou");
      const blob = await res.blob();
      const base64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve((reader.result as string).split(",")[1]);
        reader.readAsDataURL(blob);
      });
      // Salva em cache temporário
      const saved = await Filesystem.writeFile({
        path: filename,
        data: base64,
        directory: Directory.Cache,
      });
      // Compartilha o arquivo real via Intent nativo do Android
      await Share.share({ title: label, url: saved.uri, dialogTitle: "Compartilhar PDF" });
      return;
    } catch {}
    // Fallback: link
    try {
      await navigator.clipboard.writeText(r2url);
      showToast("Link copiado!");
    } catch {
      showToast("Não foi possível compartilhar.");
    }
  }

  function saveConsultant(id: string) {
    localStorage.setItem("nutricrm_consultant_id", id);
    setConsultantId(id);
    setShowConsultantPicker(false);
  }

  function addPhoto(dataUrl: string) {
    setPendingPhotos((prev) => [
      ...prev,
      { dataUrl, key: photoKeyRef.current++ },
    ]);
  }

  function removePhoto(key: number) {
    setPendingPhotos((prev) => prev.filter((p) => p.key !== key));
  }

  async function handleTakePhoto() {
    setShowPhotoSheet(false);
    try {
      const img = await CapCamera.getPhoto({
        quality: 75,
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Camera,
        allowEditing: false,
      });
      if (img.dataUrl) addPhoto(img.dataUrl);
    } catch {
      // usuário cancelou
    }
  }

  async function handlePickGallery() {
    setShowPhotoSheet(false);
    if (isNativeApp()) {
      try {
        const result = await CapCamera.pickImages({ quality: 75, limit: 10 });
        for (const photo of result.photos) {
          const dataUrl = await webPathToDataUrl(photo.webPath);
          addPhoto(dataUrl);
        }
      } catch {
        // usuário cancelou
      }
    } else {
      fileInputRef.current?.click();
    }
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        if (ev.target?.result) addPhoto(ev.target.result as string);
      };
      reader.readAsDataURL(file);
    });
    e.target.value = "";
  }

  async function sendMessage(text: string) {
    const hasText = text.trim().length > 0;
    const hasPhotos = pendingPhotos.length > 0;
    if ((!hasText && !hasPhotos) || loading) return;

    const userMsg: Message = {
      id: Date.now(),
      role: "user",
      text: text.trim(),
      images: pendingPhotos.map((p) => p.dataUrl),
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    const photosToSend = [...pendingPhotos];
    setPendingPhotos([]);
    setLoading(true);

    if (textareaRef.current) textareaRef.current.style.height = "auto";

    try {
      const res = await fetch(`${API_BASE}mobile/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: getOrCreateSession(),
          consultant_id: parseInt(consultantId) || undefined,
          message: text.trim() || "(foto)",
          photos: photosToSend.map((p, i) => ({
            dataUrl: p.dataUrl,
            filename: `foto_${Date.now()}_${i}.jpg`,
          })),
        }),
      });

      const data = await res.json();
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          role: "bot",
          text: data.response || (data.ok === false ? data.error : "Sem resposta."),
          pdfItems: data.pdf_items?.length ? data.pdf_items : undefined,
          timestamp: new Date(),
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          role: "bot",
          text: "Erro de conexão. Tente novamente.",
          timestamp: new Date(),
        },
      ]);
    } finally {
      setLoading(false);
      textareaRef.current?.focus();
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    // On native mobile Enter should insert newline; only physical keyboards send on Enter
    if (e.key === "Enter" && !e.shiftKey && !isNativeApp()) {
      e.preventDefault();
      sendMessage(input);
    }
  }

  async function handleMicStart() {
    if (recording || loading) return;
    try {
      const { available } = await SpeechRecognition.available();
      if (!available) {
        alert("Reconhecimento de voz não disponível neste dispositivo.");
        return;
      }
      const perms = await SpeechRecognition.requestPermissions();
      if ((perms as any).speechRecognition !== "granted") {
        alert("Permissão de microfone negada.");
        return;
      }
      setRecording(true);
      const result = await SpeechRecognition.start({
        language: "pt-BR",
        maxResults: 1,
        partialResults: false,
        popup: true,
      });
      const text = (result as any)?.matches?.[0]?.trim() ?? "";
      if (text) {
        setInput((prev) => (prev ? `${prev} ${text}` : text));
        if (textareaRef.current) {
          textareaRef.current.style.height = "auto";
          textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 140)}px`;
        }
      }
    } catch {
      // usuário cancelou o diálogo
    } finally {
      setRecording(false);
    }
  }

  function handleMicStop() { /* popup: true — parar é feito pelo diálogo nativo */ }

  function autoResize(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInput(e.target.value);
    const el = e.target;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
  }

  function formatTime(d: Date) {
    return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  }

  // ── Seleção de consultor ──────────────────────────────────
  if (showConsultantPicker) {
    return (
      <div className="chat-consultant-picker">
        <div className="chat-picker-card">
          <h5>Quem é você?</h5>
          <p className="text-muted small">Escolha seu nome para começar</p>
          <div className="d-flex flex-column gap-2 mt-3">
            {consultantOptions.length === 0 ? (
              <p className="text-muted small text-center">Carregando...</p>
            ) : (
              consultantOptions.map((c) => (
                <button
                  key={c.id}
                  className="btn btn-outline-primary"
                  onClick={() => saveConsultant(String(c.id))}
                >
                  {c.name}
                </button>
              ))
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── Chat principal ────────────────────────────────────────
  return (
    <div className="chat-screen">
      {/* Header */}
      <div className="chat-header">
        <div className="chat-header-info">
          <div className="chat-avatar">N</div>
          <div>
            <div className="chat-header-name">Assistente NutriCRM</div>
            <div className="chat-header-status">
              {loading ? "digitando..." : "online"}
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          <button
            className="chat-icon-btn"
            title="Ajuda"
            onClick={() => setShowHelp(true)}
          >
            <span style={{ fontWeight: 700, fontSize: 15 }}>?</span>
          </button>
          <button
            className="btn btn-sm btn-link text-muted"
            title="Trocar consultor"
            onClick={() => setShowConsultantPicker(true)}
          >
            ⚙
          </button>
        </div>
      </div>

      {/* Mensagens */}
      <div className="chat-messages">
        {messages.map((msg) => (
          <div key={msg.id} className={`chat-bubble-row ${msg.role}`}>
            <div className={`chat-bubble ${msg.role}`}>
              {msg.images && msg.images.length > 0 && (
                <div className="chat-bubble-imgs">
                  {msg.images.map((src, i) => (
                    <img key={i} src={src} alt={`foto ${i + 1}`} className="chat-bubble-img" />
                  ))}
                </div>
              )}
              {msg.text && (
                <pre className="chat-bubble-text">{msg.text}</pre>
              )}
              {msg.pdfItems && msg.pdfItems.map((item, i) => (
                <div key={i} className="chat-pdf-item">
                  <span className="chat-pdf-label">{item.label}</span>
                  <div className="chat-pdf-actions">
                    <button
                      className="chat-pdf-action-btn chat-pdf-action-btn--download"
                      onClick={() => handleDownloadPdf(item.url)}
                    >
                      ⬇ Abrir
                    </button>
                    <button
                      className="chat-pdf-action-btn chat-pdf-action-btn--share"
                      onClick={() => handleSharePdf(item.label, item.url, item.filename)}
                    >
                      ↗ Enviar
                    </button>
                  </div>
                </div>
              ))}
              <span className="chat-bubble-time">{formatTime(msg.timestamp)}</span>
            </div>
          </div>
        ))}

        {loading && (
          <div className="chat-bubble-row bot">
            <div className="chat-bubble bot chat-typing">
              <Loader2 size={16} className="spin" />
              <span>processando...</span>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Preview de fotos pendentes */}
      {pendingPhotos.length > 0 && (
        <div className="chat-photos-preview">
          {pendingPhotos.map((p) => (
            <div key={p.key} className="chat-photo-thumb">
              <img src={p.dataUrl} alt="preview" />
              <button className="chat-photo-remove" onClick={() => removePhoto(p.key)}>
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Barra de input */}
      <div className="chat-input-bar">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          style={{ display: "none" }}
          onChange={handleFileInput}
        />

        <button
          className="chat-icon-btn"
          title="Foto"
          onClick={() => setShowPhotoSheet(true)}
          disabled={loading || recording}
        >
          <Camera size={20} />
        </button>

        <textarea
          ref={textareaRef}
          className="chat-input"
          rows={1}
          placeholder="Digite uma mensagem..."
          value={input}
          onChange={autoResize}
          onKeyDown={handleKeyDown}
          disabled={loading || recording}
        />

        <button
          className={`chat-icon-btn${recording ? " chat-icon-btn--recording" : ""}`}
          title={recording ? "Parar gravação" : "Gravar áudio"}
          onClick={recording ? handleMicStop : handleMicStart}
          disabled={loading}
        >
          {recording ? <MicOff size={20} /> : <Mic size={20} />}
        </button>

        <button
          className="chat-send-btn"
          onClick={() => sendMessage(input)}
          disabled={loading || recording || (!input.trim() && pendingPhotos.length === 0)}
        >
          {loading ? <Loader2 size={18} className="spin" /> : <Send size={18} />}
        </button>
      </div>

      {/* Modal de ajuda */}
      {showHelp && (
        <div className="chat-sheet-backdrop" onClick={() => setShowHelp(false)}>
          <div className="chat-sheet chat-help-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="chat-sheet-handle" />
            <div className="chat-help-title">O que posso fazer</div>
            <div className="chat-help-items">
              <div className="chat-help-item">
                <div className="chat-help-label">Lançar visita</div>
                <div className="chat-help-example">"Cliente João Silva, soja R5, ontem, observações..."</div>
              </div>
              <div className="chat-help-item">
                <div className="chat-help-label">Ver agenda da semana</div>
                <div className="chat-help-example">"Agenda da semana" ou "minha semana"</div>
              </div>
              <div className="chat-help-item">
                <div className="chat-help-label">Rotina do dia</div>
                <div className="chat-help-example">"Meu dia" ou "rotina de hoje"</div>
              </div>
              <div className="chat-help-item">
                <div className="chat-help-label">Gerar PDF de visita</div>
                <div className="chat-help-example">"Gerar PDF da visita do cliente X"</div>
              </div>
            </div>
            <button className="chat-sheet-cancel" onClick={() => setShowHelp(false)}>
              Fechar
            </button>
          </div>
        </div>
      )}

      {/* Bottom sheet — escolha de foto em português */}
      {showPhotoSheet && (
        <div className="chat-sheet-backdrop" onClick={() => setShowPhotoSheet(false)}>
          <div className="chat-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="chat-sheet-handle" />
            <button className="chat-sheet-option" onClick={handleTakePhoto}>
              <Camera size={20} />
              Tirar foto
            </button>
            <button className="chat-sheet-option" onClick={handlePickGallery}>
              <ImageIcon size={20} />
              Galeria
            </button>
            <button
              className="chat-sheet-cancel"
              onClick={() => setShowPhotoSheet(false)}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {toast && <div className="chat-toast">{toast}</div>}
    </div>
  );
};

export default Chat;
