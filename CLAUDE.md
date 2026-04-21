# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Vite dev server with HMR
npm run build    # TypeScript check + Vite bundle → dist/
npm run lint     # ESLint
npm run preview  # Serve production build locally
```

No test suite is configured.

## Architecture

**AgroCRM** is a PWA/Capacitor CRM for agricultural business, built with React 19 + TypeScript + Vite. It targets both desktop browser and Android APK (via Capacitor).

### Routing

There is **no React Router**. Routing is manual string-based state in `App.tsx`. The active page is stored in component state and mirrored in `sessionStorage`. Navigation happens by setting that state. Six main sections: Dashboard, Clientes, Propriedades, Calendário, Oportunidades, Acompanhamentos.

### State Management

Per-page `useState` hooks — no global store. Cross-component communication uses **window custom events** (`visits-synced`, `visits-updated`). Persistent state lives in IndexedDB.

### API Layer

- Base URL from `VITE_API_URL` env var (default: `https://agrocrm-backend.onrender.com/api/`)
- Configured in `src/config.ts`
- Uses native `fetch` (not Axios)
- Read pattern: `fetchWithCache()` tries network first, falls back to IndexedDB cache
- Write pattern: POST/PUT directly to API; if offline, queued to `pending_visits` / `pending_photos` IndexedDB stores

### Offline / IndexedDB

All offline logic is in `src/utils/indexedDB.ts` (raw IDB operations) and `src/utils/offlineSync.ts` (sync pending data when connectivity resumes). IndexedDB stores: `clients`, `properties`, `plots`, `visits`, `varieties`, `cultures`, `photos`, `pending_visits`, `pending_photos`. Photos are stored as base64 DataURLs. Auto-sync runs on app load and when the `online` event fires.

### Platform Detection

`main.tsx` detects mobile vs desktop (user-agent + 900px breakpoint) and sets `data-platform="mobile"|"desktop"` on `<body>`. This drives CSS overrides in `src/styles/theme-agrocrm-mobile.css`. The app also detects if running inside the Android APK wrapper.

### UI

Bootstrap 5.3 for layout/components. Theme via CSS custom properties in `src/styles/theme-base.css` (key vars: `--accent: #26b96a`, `--text`, `--panel`). Light/dark mode supported. Icons via `lucide-react`. Drag-and-drop via `@hello-pangea/dnd`. Calendar via FullCalendar 6.

### Mobile / Capacitor

Capacitor 7.4 provides native plugins used in the app:
- `@capacitor/camera` — photo capture in visit forms
- `@capacitor/geolocation` — GPS coordinates on visits/photos
- `@capacitor/filesystem` — file access

Image compression before storage: `src/utils/imageCompress.ts`.

### Path Alias

`@` maps to `./src/` — use `@/components/Foo` instead of relative paths.
