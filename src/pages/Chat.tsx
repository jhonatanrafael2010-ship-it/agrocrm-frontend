import React, { useEffect, useRef, useState } from "react";
import { Send, Camera, Loader2 } from "lucide-react";
import { API_BASE } from "../config";
import "../styles/chat.css";

interface Message {
  id: number;
  role: "user" | "bot";
  text: string;
  timestamp: Date;
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
  const [consultantId, setConsultantId] = useState(getConsultantId);
  const [showConsultantPicker, setShowConsultantPicker] = useState(!getConsultantId());
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const nextId = useRef(1);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function saveConsultant(id: string) {
    localStorage.setItem("nutricrm_consultant_id", id);
    setConsultantId(id);
    setShowConsultantPicker(false);
  }

  async function sendMessage(text: string) {
    if (!text.trim() || loading) return;

    const userMsg: Message = {
      id: nextId.current++,
      role: "user",
      text: text.trim(),
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}mobile/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: getOrCreateSession(),
          consultant_id: parseInt(consultantId) || undefined,
          message: text.trim(),
          photos: [],
        }),
      });

      const data = await res.json();
      const botMsg: Message = {
        id: nextId.current++,
        role: "bot",
        text: data.response || (data.ok === false ? data.error : "Sem resposta."),
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, botMsg]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: nextId.current++,
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

      {/* Messages */}
      <div className="chat-messages">
        {messages.map((msg) => (
          <div key={msg.id} className={`chat-bubble-row ${msg.role}`}>
            <div className={`chat-bubble ${msg.role}`}>
              <pre className="chat-bubble-text">{msg.text}</pre>
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

      {/* Input bar */}
      <div className="chat-input-bar">
        <button className="chat-icon-btn" title="Enviar foto (em breve)">
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
          disabled={loading || !input.trim()}
        >
          {loading ? <Loader2 size={18} className="spin" /> : <Send size={18} />}
        </button>
      </div>
    </div>
  );
};

export default Chat;
