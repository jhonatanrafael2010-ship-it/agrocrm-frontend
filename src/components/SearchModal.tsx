import React, { useEffect, useRef, useState } from "react";
import {
  Dialog,
  Box,
  InputBase,
  Typography,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Chip,
  CircularProgress,
} from "@mui/material";
import {
  Search as SearchIcon,
  Close as CloseIcon,
  People as PeopleIcon,
  Map as MapIcon,
  BusinessCenter as BusinessIcon,
  Assignment as AssignmentIcon,
} from "@mui/icons-material";
import { API_BASE } from "../config";

type Result = {
  type: "client" | "property" | "visit" | "opportunity";
  id: number;
  title: string;
  subtitle?: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onNavigate: (route: string) => void;
};

const ICONS = {
  client: <PeopleIcon fontSize="small" />,
  property: <MapIcon fontSize="small" />,
  visit: <AssignmentIcon fontSize="small" />,
  opportunity: <BusinessIcon fontSize="small" />,
};

const COLORS = {
  client: "#3b82f6",
  property: "#10b981",
  visit: "#8b5cf6",
  opportunity: "#f59e0b",
};

const LABELS = {
  client: "Cliente",
  property: "Propriedade",
  visit: "Visita",
  opportunity: "Oportunidade",
};

const ROUTES = {
  client: "Clientes",
  property: "Propriedades",
  visit: "Acompanhamentos",
  opportunity: "Oportunidades",
};

const SearchModal: React.FC<Props> = ({ open, onClose, onNavigate }) => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setQuery("");
      setResults([]);
      setSelectedIdx(0);
    }
  }, [open]);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const q = query.toLowerCase().trim();
        const [clients, properties, visits, opps] = await Promise.all([
          fetch(`${API_BASE}clients`).then((r) => (r.ok ? r.json() : [])),
          fetch(`${API_BASE}properties`).then((r) => (r.ok ? r.json() : [])),
          fetch(`${API_BASE}visits`).then((r) => (r.ok ? r.json() : [])),
          fetch(`${API_BASE}opportunities`).then((r) => (r.ok ? r.json() : [])),
        ]);

        const matched: Result[] = [];

        (clients || [])
          .filter((c: any) =>
            (c.name || "").toLowerCase().includes(q) ||
            (c.document || "").toLowerCase().includes(q)
          )
          .slice(0, 5)
          .forEach((c: any) =>
            matched.push({
              type: "client",
              id: c.id,
              title: c.name,
              subtitle: c.segment || c.document || "",
            })
          );

        (properties || [])
          .filter((p: any) => (p.name || "").toLowerCase().includes(q))
          .slice(0, 5)
          .forEach((p: any) =>
            matched.push({
              type: "property",
              id: p.id,
              title: p.name,
              subtitle: p.city || "",
            })
          );

        (visits || [])
          .filter(
            (v: any) =>
              (v.client_name || "").toLowerCase().includes(q) ||
              (v.culture || "").toLowerCase().includes(q) ||
              (v.variety || "").toLowerCase().includes(q)
          )
          .slice(0, 5)
          .forEach((v: any) =>
            matched.push({
              type: "visit",
              id: v.id,
              title: `${v.client_name || "Visita"} — ${v.date || ""}`,
              subtitle: `${v.culture || ""} ${v.variety || ""}`.trim(),
            })
          );

        (opps || [])
          .filter((o: any) => (o.title || "").toLowerCase().includes(q))
          .slice(0, 5)
          .forEach((o: any) =>
            matched.push({
              type: "opportunity",
              id: o.id,
              title: o.title,
              subtitle: o.stage || "",
            })
          );

        setResults(matched);
        setSelectedIdx(0);
      } catch (err) {
        console.error("search err", err);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  function handleSelect(r: Result) {
    onNavigate(ROUTES[r.type]);
    onClose();
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === "Escape") onClose();
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIdx((i) => Math.min(i + 1, results.length - 1));
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIdx((i) => Math.max(i - 1, 0));
    }
    if (e.key === "Enter" && results[selectedIdx]) {
      handleSelect(results[selectedIdx]);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      slotProps={{
        paper: {
          sx: {
            borderRadius: 3,
            overflow: "hidden",
            maxHeight: "70vh",
          },
        },
      }}
    >
      {/* Search Header */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          px: 2,
          py: 1.5,
          borderBottom: 1,
          borderColor: "divider",
          gap: 1.5,
        }}
      >
        <SearchIcon sx={{ color: "text.secondary" }} />
        <InputBase
          inputRef={inputRef}
          fullWidth
          placeholder="Buscar clientes, propriedades, visitas..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKey}
          sx={{
            fontSize: "1rem",
            "& input::placeholder": {
              color: "text.secondary",
              opacity: 1,
            },
          }}
        />
        <IconButton size="small" onClick={onClose}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>

      {/* Results Body */}
      <Box sx={{ maxHeight: 400, overflow: "auto" }}>
        {loading && (
          <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
            <CircularProgress size={24} />
          </Box>
        )}

        {!loading && query && results.length === 0 && (
          <Box sx={{ py: 4, textAlign: "center" }}>
            <Typography color="text.secondary">Nenhum resultado</Typography>
          </Box>
        )}

        {!loading && !query && (
          <Box sx={{ py: 3, textAlign: "center" }}>
            <Typography variant="body2" color="text.secondary">
              <Box component="kbd" sx={kbdStyle}>↑</Box>{" "}
              <Box component="kbd" sx={kbdStyle}>↓</Box> navegar{" "}
              <Box component="kbd" sx={kbdStyle}>↵</Box> abrir{" "}
              <Box component="kbd" sx={kbdStyle}>esc</Box> fechar
            </Typography>
          </Box>
        )}

        {results.length > 0 && (
          <List disablePadding>
            {results.map((r, idx) => (
              <ListItemButton
                key={`${r.type}-${r.id}`}
                selected={idx === selectedIdx}
                onClick={() => handleSelect(r)}
                onMouseEnter={() => setSelectedIdx(idx)}
                sx={{
                  py: 1.5,
                  px: 2,
                  "&.Mui-selected": {
                    bgcolor: `${COLORS[r.type]}10`,
                  },
                }}
              >
                <ListItemIcon
                  sx={{
                    minWidth: 40,
                    color: COLORS[r.type],
                  }}
                >
                  {ICONS[r.type]}
                </ListItemIcon>
                <ListItemText
                  primary={r.title}
                  secondary={r.subtitle}
                  slotProps={{
                    primary: { sx: { fontWeight: 500, fontSize: "0.9rem" } },
                    secondary: { sx: { fontSize: "0.8rem" } },
                  }}
                />
                <Chip
                  label={LABELS[r.type]}
                  size="small"
                  sx={{
                    bgcolor: `${COLORS[r.type]}15`,
                    color: COLORS[r.type],
                    fontWeight: 600,
                    fontSize: "0.7rem",
                  }}
                />
              </ListItemButton>
            ))}
          </List>
        )}
      </Box>
    </Dialog>
  );
};

const kbdStyle = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  px: 0.75,
  py: 0.25,
  mx: 0.25,
  bgcolor: "action.hover",
  border: 1,
  borderColor: "divider",
  borderRadius: 1,
  fontSize: "0.75rem",
  fontFamily: "monospace",
  minWidth: 24,
};

export default SearchModal;
