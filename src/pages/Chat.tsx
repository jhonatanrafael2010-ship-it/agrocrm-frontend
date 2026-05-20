import React, { useEffect, useRef, useState } from "react";
import {
  Box,
  Typography,
  IconButton,
  TextField,
  Avatar,
  Button,
  Paper,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  List,
  Drawer,
  Chip,
  Divider,
} from "@mui/material";
import {
  Send as SendIcon,
  CameraAlt as CameraIcon,
  Close as CloseIcon,
  Image as ImageIcon,
  Mic as MicIcon,
  MicOff as MicOffIcon,
  Help as HelpIcon,
  Settings as SettingsIcon,
} from "@mui/icons-material";
import { Camera as CapCamera, CameraResultType, CameraSource } from "@capacitor/camera";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
import { SpeechRecognition } from "@capacitor-community/speech-recognition";
import { API_BASE } from "../config";
import { fetchWithCache } from "../utils/offlineSync";

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

const CHAT_HISTORY_KEY = "nutricrm_chat_history";
const MAX_HISTORY = 80;

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

function loadHistory(): Message[] {
  try {
    const raw = localStorage.getItem(CHAT_HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return parsed.map((m: any) => ({ ...m, timestamp: new Date(m.timestamp) }));
  } catch {
    return [];
  }
}

function saveHistory(messages: Message[]) {
  try {
    const toSave = messages.slice(-MAX_HISTORY).map((m) => ({
      ...m,
      images: undefined,
    }));
    localStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(toSave));
  } catch {}
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
  const [messages, setMessages] = useState<Message[]>(() => {
    const history = loadHistory();
    return history.length > 0
      ? history
      : [{ id: 0, role: "bot", text: "Olá! Como posso ajudar?", timestamp: new Date() }];
  });
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
    saveHistory(messages);
  }, [messages]);

  useEffect(() => {
    fetchWithCache(`${API_BASE}consultants`, "consultants")
      .then((data) => setConsultantOptions(data || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    return () => {
      SpeechRecognition.stop().catch(() => {});
    };
  }, []);

  const consultantName = consultantOptions.find((c) => String(c.id) === consultantId)?.name || "";

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
      const res = await fetch(proxyUrl);
      if (!res.ok) throw new Error("fetch falhou");
      const blob = await res.blob();
      const base64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve((reader.result as string).split(",")[1]);
        reader.readAsDataURL(blob);
      });
      const saved = await Filesystem.writeFile({
        path: filename,
        data: base64,
        directory: Directory.Cache,
      });
      await Share.share({ title: label, url: saved.uri, dialogTitle: "Compartilhar PDF" });
      return;
    } catch {}
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
    setPendingPhotos((prev) => [...prev, { dataUrl, key: photoKeyRef.current++ }]);
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
    } catch {}
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
      } catch {}
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

  function handleKeyDown(e: React.KeyboardEvent) {
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
      if (text) setInput((prev) => (prev ? `${prev} ${text}` : text));
    } catch {
    } finally {
      setRecording(false);
    }
  }

  function formatTime(d: Date) {
    return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  }

  function renderFormattedText(text: string, isUser: boolean): React.ReactNode {
    const lines = text.split("\n");
    return (
      <Box component="span">
        {lines.map((line, i) => {
          if (!line.trim()) return <br key={i} />;

          // Linha numerada: "1. Nome do Cliente - Cultura - Variedade" ou "1. Nome - 45 dias"
          if (/^\d+\.\s/.test(line)) {
            const dashIdx = line.indexOf(" - ");
            if (dashIdx !== -1) {
              const bold = line.slice(0, dashIdx);
              const rest = line.slice(dashIdx);
              return (
                <Typography
                  key={i}
                  component="div"
                  variant="body2"
                  sx={{ color: isUser ? "inherit" : "text.primary" }}
                >
                  <strong>{bold}</strong>
                  {rest}
                </Typography>
              );
            }
            return (
              <Typography
                key={i}
                component="div"
                variant="body2"
                sx={{ fontWeight: 600, color: isUser ? "inherit" : "text.primary" }}
              >
                {line}
              </Typography>
            );
          }

          return (
            <Typography key={i} component="div" variant="body2">
              {line}
            </Typography>
          );
        })}
      </Box>
    );
  }

  if (showConsultantPicker) {
    return (
      <Box
        sx={{
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          p: 3,
        }}
      >
        <Paper sx={{ p: 4, maxWidth: 400, width: "100%", borderRadius: 3, textAlign: "center" }}>
          <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>
            Quem é você?
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Escolha seu nome para começar
          </Typography>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
            {consultantOptions.length === 0 ? (
              <CircularProgress size={24} sx={{ mx: "auto" }} />
            ) : (
              consultantOptions.map((c) => (
                <Button
                  key={c.id}
                  variant="outlined"
                  onClick={() => saveConsultant(String(c.id))}
                  sx={{ textTransform: "none", fontWeight: 600 }}
                >
                  {c.name}
                </Button>
              ))
            )}
          </Box>
        </Paper>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        bgcolor: "background.default",
      }}
    >
      {/* Header Premium */}
      <Paper
        elevation={0}
        sx={{
          position: "sticky",
          top: 0,
          zIndex: 100,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          px: 2,
          py: 1.5,
          borderRadius: 0,
          background: "linear-gradient(135deg, #16a34a 0%, #15803d 100%)",
          color: "white",
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <Avatar
            sx={{
              bgcolor: "rgba(255,255,255,0.2)",
              fontWeight: 700,
              border: "2px solid rgba(255,255,255,0.3)",
            }}
          >
            N
          </Avatar>
          <Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 600, lineHeight: 1.2 }}>
              Assistente NutriCRM
            </Typography>
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
              <Box
                sx={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  bgcolor: loading ? "#fbbf24" : "#4ade80",
                  animation: loading ? "pulse 1.5s infinite" : "none",
                  "@keyframes pulse": {
                    "0%, 100%": { opacity: 1 },
                    "50%": { opacity: 0.5 },
                  },
                }}
              />
              <Typography variant="caption" sx={{ opacity: 0.9 }}>
                {loading ? "digitando..." : consultantName ? `online · ${consultantName}` : "online"}
              </Typography>
            </Box>
          </Box>
        </Box>
        <Box sx={{ display: "flex", gap: 0.5 }}>
          <IconButton
            size="small"
            onClick={() => setShowHelp(true)}
            sx={{
              color: "white",
              bgcolor: "rgba(255,255,255,0.1)",
              "&:hover": { bgcolor: "rgba(255,255,255,0.2)" },
            }}
          >
            <HelpIcon fontSize="small" />
          </IconButton>
          <IconButton
            size="small"
            onClick={() => setShowConsultantPicker(true)}
            sx={{
              color: "white",
              bgcolor: "rgba(255,255,255,0.1)",
              "&:hover": { bgcolor: "rgba(255,255,255,0.2)" },
            }}
          >
            <SettingsIcon fontSize="small" />
          </IconButton>
        </Box>
      </Paper>

      {/* Messages */}
      <Box sx={{ flex: 1, overflow: "auto", p: 2, display: "flex", flexDirection: "column", gap: 1.5 }}>
        {messages.map((msg) => (
          <Box
            key={msg.id}
            sx={{
              display: "flex",
              justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
            }}
          >
            <Paper
              elevation={0}
              sx={{
                maxWidth: "80%",
                p: 1.5,
                borderRadius: 2,
                bgcolor: msg.role === "user" ? "primary.main" : "action.hover",
                color: msg.role === "user" ? "primary.contrastText" : "text.primary",
              }}
            >
              {msg.images && msg.images.length > 0 && (
                <Box sx={{ display: "flex", gap: 0.5, mb: 1, flexWrap: "wrap" }}>
                  {msg.images.map((src, i) => (
                    <Box
                      key={i}
                      component="img"
                      src={src}
                      alt={`foto ${i + 1}`}
                      sx={{ width: 80, height: 80, objectFit: "cover", borderRadius: 1 }}
                    />
                  ))}
                </Box>
              )}
              {msg.text && renderFormattedText(msg.text, msg.role === "user")}
              {msg.pdfItems &&
                msg.pdfItems.map((item, i) => (
                  <Box key={i} sx={{ mt: 1, p: 1, bgcolor: "background.paper", borderRadius: 1 }}>
                    <Typography variant="caption" sx={{ fontWeight: 600, display: "block", mb: 0.5 }}>
                      {item.label}
                    </Typography>
                    <Box sx={{ display: "flex", gap: 1 }}>
                      <Button size="small" variant="outlined" onClick={() => handleDownloadPdf(item.url)}>
                        Abrir
                      </Button>
                      <Button
                        size="small"
                        variant="contained"
                        onClick={() => handleSharePdf(item.label, item.url, item.filename)}
                      >
                        Enviar
                      </Button>
                    </Box>
                  </Box>
                ))}
              <Typography
                variant="caption"
                sx={{
                  display: "block",
                  textAlign: "right",
                  mt: 0.5,
                  opacity: 0.7,
                }}
              >
                {formatTime(msg.timestamp)}
              </Typography>
            </Paper>
          </Box>
        ))}

        {loading && (
          <Box sx={{ display: "flex", justifyContent: "flex-start" }}>
            <Paper
              elevation={0}
              sx={{
                p: 1.5,
                borderRadius: 2,
                bgcolor: "action.hover",
                display: "flex",
                alignItems: "center",
                gap: 1,
              }}
            >
              <CircularProgress size={16} />
              <Typography variant="body2" color="text.secondary">
                processando...
              </Typography>
            </Paper>
          </Box>
        )}

        <div ref={bottomRef} />
      </Box>

      {/* Photo previews */}
      {pendingPhotos.length > 0 && (
        <Box sx={{ display: "flex", gap: 1, p: 1, borderTop: 1, borderColor: "divider" }}>
          {pendingPhotos.map((p) => (
            <Box key={p.key} sx={{ position: "relative" }}>
              <Box
                component="img"
                src={p.dataUrl}
                sx={{ width: 60, height: 60, objectFit: "cover", borderRadius: 1 }}
              />
              <IconButton
                size="small"
                onClick={() => removePhoto(p.key)}
                sx={{
                  position: "absolute",
                  top: -8,
                  right: -8,
                  bgcolor: "error.main",
                  color: "white",
                  "&:hover": { bgcolor: "error.dark" },
                  width: 20,
                  height: 20,
                }}
              >
                <CloseIcon sx={{ fontSize: 14 }} />
              </IconButton>
            </Box>
          ))}
        </Box>
      )}

      {/* Input bar Premium */}
      <Paper
        elevation={0}
        sx={{
          display: "flex",
          alignItems: "flex-end",
          gap: 1,
          p: 1.5,
          borderRadius: 0,
          borderTop: 1,
          borderColor: "divider",
          bgcolor: "background.paper",
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          style={{ display: "none" }}
          onChange={handleFileInput}
        />

        <IconButton
          onClick={() => setShowPhotoSheet(true)}
          disabled={loading || recording}
          sx={{
            width: 44,
            height: 44,
            bgcolor: "action.hover",
            borderRadius: 3,
            color: "primary.main",
            "&:hover": { bgcolor: "primary.light", color: "white" },
            "&.Mui-disabled": { bgcolor: "action.disabledBackground" },
          }}
        >
          <CameraIcon />
        </IconButton>

        <TextField
          inputRef={textareaRef}
          multiline
          minRows={1}
          maxRows={6}
          fullWidth
          placeholder={isNativeApp() ? "Digite a visita..." : "Digite... (Shift+Enter = nova linha)"}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={loading || recording}
          size="small"
          sx={{
            "& .MuiOutlinedInput-root": {
              borderRadius: 3,
              bgcolor: "action.hover",
              "&:hover": {
                bgcolor: "action.selected",
              },
              "&.Mui-focused": {
                bgcolor: "background.paper",
              },
            },
            "& textarea": {
              lineHeight: 1.4,
            },
          }}
        />

        <IconButton
          onClick={handleMicStart}
          disabled={loading}
          sx={{
            width: 44,
            height: 44,
            bgcolor: recording ? "error.main" : "action.hover",
            borderRadius: 3,
            color: recording ? "white" : "text.secondary",
            "&:hover": { bgcolor: recording ? "error.dark" : "action.selected" },
          }}
        >
          {recording ? <MicOffIcon /> : <MicIcon />}
        </IconButton>

        <IconButton
          onClick={() => sendMessage(input)}
          disabled={loading || recording || (!input.trim() && pendingPhotos.length === 0)}
          sx={{
            width: 44,
            height: 44,
            borderRadius: 3,
            bgcolor: "primary.main",
            color: "white",
            "&:hover": { bgcolor: "primary.dark" },
            "&.Mui-disabled": { bgcolor: "action.disabledBackground", color: "text.disabled" },
          }}
        >
          {loading ? <CircularProgress size={18} color="inherit" /> : <SendIcon />}
        </IconButton>
      </Paper>

      {/* Help Dialog */}
      <Dialog open={showHelp} onClose={() => setShowHelp(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 600 }}>O que posso fazer</DialogTitle>
        <DialogContent>
          <List disablePadding>
            {[
              { label: "Lançar visita completa", example: "Nome do cliente, cultura, fenologia, data e observações (uma por linha)" },
              { label: "Lançar visita simples", example: '"Cliente João Silva" e siga o fluxo guiado' },
              { label: "Agenda da semana", example: '"Agenda da semana" · "visitas da semana"' },
              { label: "Rotina do dia", example: '"Meu dia" · "agenda de hoje"' },
              { label: "Visitas do mês", example: '"Visitas do mês"' },
              { label: "Dias de plantado", example: '"Dias de plantado"' },
              { label: "Clientes atrasados", example: '"Clientes atrasados"' },
              { label: "Gerar PDF", example: '"PDF da última visita" · "PDF do cliente X"' },
              { label: "Cancelar", example: '"Cancelar" a qualquer momento' },
            ].map((item, i) => (
              <Box key={i} sx={{ py: 1.5, borderBottom: 1, borderColor: "divider" }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                  {item.label}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {item.example}
                </Typography>
              </Box>
            ))}
          </List>
          <Box sx={{ mt: 2, p: 1.5, bgcolor: "action.hover", borderRadius: 1 }}>
            <Typography variant="caption" color="text.secondary" component="div">
              <strong>Dica de formatação:</strong> Use uma linha para cada informação.
              {!isNativeApp() && " Shift+Enter adiciona nova linha."}
            </Typography>
          </Box>
          <Button fullWidth variant="outlined" onClick={() => setShowHelp(false)} sx={{ mt: 2 }}>
            Fechar
          </Button>
        </DialogContent>
      </Dialog>

      {/* Photo Sheet */}
      <Drawer anchor="bottom" open={showPhotoSheet} onClose={() => setShowPhotoSheet(false)}>
        <Box sx={{ p: 2, pb: 4 }}>
          <Box sx={{ width: 40, height: 4, bgcolor: "divider", borderRadius: 2, mx: "auto", mb: 2 }} />
          <Button
            fullWidth
            startIcon={<CameraIcon />}
            onClick={handleTakePhoto}
            sx={{ justifyContent: "flex-start", py: 1.5, mb: 1, textTransform: "none" }}
          >
            Tirar foto
          </Button>
          <Button
            fullWidth
            startIcon={<ImageIcon />}
            onClick={handlePickGallery}
            sx={{ justifyContent: "flex-start", py: 1.5, mb: 1, textTransform: "none" }}
          >
            Galeria
          </Button>
          <Divider sx={{ my: 1 }} />
          <Button fullWidth onClick={() => setShowPhotoSheet(false)} sx={{ textTransform: "none" }}>
            Cancelar
          </Button>
        </Box>
      </Drawer>

      {/* Toast */}
      {toast && (
        <Chip
          label={toast}
          sx={{
            position: "fixed",
            bottom: 100,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 1400,
          }}
        />
      )}
    </Box>
  );
};

export default Chat;
