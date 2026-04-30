import React, { useEffect, useRef, useState } from "react";
import { Send, Camera, X, Loader2, Image as ImageIcon } from "lucide-react";
import { Camera as CapCamera, CameraResultType, CameraSource } from "@capacitor/camera";
import { API_BASE } from "../config";
import "../styles/chat.css";

interface Message {
  id: number;
  role: "user" | "bot";
  text: string;
  images?: string[];
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

const CONSULTANT_OPTIONS = [
  { id: 1, name: "Jhonatan" },
  { id: 2, name: "Consultor 2" },
  { id: 3, name: "Consultor 3" },
  { id: 4, name: "Consultor 4" },
  { id: 5, name: "Consultor 5" },
  { id: 6, name: "Consultor 6" },
];

const Chat: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 0,
      role: "bot",
      text: "Olá! Sou o assistente NutriCRM.\n\nExemplos do que posso fazer:\n• Lançar visita: 'cliente João Silva soja R5 ontem observações...'\n• Ver agenda: 'agenda da semana'\n• Ver rotina: 'meu dia'",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [pendingPhotos, setPendingPhotos] = useState<PendingPhoto[]>([]);
  const [showPhotoSheet, setShowPhotoSheet] = useState(false);
  const [consultantId, setConsultantId] = useState(getConsultantId);
  const [showConsultantPicker, setShowConsultantPicker] = useState(!getConsultantId());

  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const photoKeyRef = useRef(0);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

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
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  }

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
            {CONSULTANT_OPTIONS.map((c) => (
              <button
                key={c.id}
                className="btn btn-outline-primary"
                onClick={() => saveConsultant(String(c.id))}
              >
                {c.name}
              </button>
            ))}
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
        <button
          className="btn btn-sm btn-link text-muted"
          title="Trocar consultor"
          onClick={() => setShowConsultantPicker(true)}
        >
          ⚙
        </button>
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
          disabled={loading}
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
          disabled={loading}
        />

        <button
          className="chat-send-btn"
          onClick={() => sendMessage(input)}
          disabled={loading || (!input.trim() && pendingPhotos.length === 0)}
        >
          {loading ? <Loader2 size={18} className="spin" /> : <Send size={18} />}
        </button>
      </div>

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
    </div>
  );
};

export default Chat;
