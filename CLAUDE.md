# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development (from root or backend/)
npm run dev              # Start backend with nodemon (port 3000)
npm start                # Start backend (production)

# E2E Tests (Playwright)
npm run test:e2e                 # Run test-cotacao.mjs
node tests/test-cotacao.mjs      # Run specific test directly
```

Frontend has no build step — pure HTML/CSS/JS served statically by Express from `frontend/`.

## Architecture

### Request Flow
Browser → Express (port 3000) → static `frontend/` OR `/api/*` routes → PostgreSQL

All API routes require `Authorization: Bearer <token>` except `/api/auth/*`. The `authMiddleware` validates JWT and populates `req.usuario`.

### Backend (`backend/src/`)

- **`server.js`** — Registers all routes under `/api` prefix; auto-starts `AlertasService` and `WhatsAppService` on boot
- **`config/database.js`** — `pg` Pool; exported as `{ pool }`. Uses raw SQL, not Prisma Client
- **`middleware/auth.middleware.js`** — `authMiddleware`, `checkPerfil(...roles)`, `optionalAuth`
- **`routes/`** — One file per entity: `auth`, `usuarios`, `clientes`, `fornecedores`, `bilhetes`, `cotacoes`, `dashboard`, `voos`, `reservas`, `alertas`
- **`services/`** — `whatsapp.service.js` (whatsapp-web.js), `alertas.service.js` (email + WhatsApp), `amadeus.service.js`, `flightSearch.service.js`, `kiwi.service.js`, `googleFlights.service.js`, `serpapi.service.js`, `pdfExtractor.js`

Route pattern: logic lives directly in route files (no separate controllers).

### Database

PostgreSQL via raw `pg` Pool — **not Prisma Client** (Prisma is only used for schema/migrations).

**Critical SQL rules:**
- Column names are camelCase → always quote them: `"clienteId"`, `"dataEmissao"`, `"fornecedorId"`
- Use `gen_random_uuid()` for UUIDs in INSERT statements
- Parameterized queries with `$1, $2, ...` placeholders

Key tables: `clientes`, `fornecedores`, `bilhetes`, `cotacoes`, `reservas`, `usuarios`, `configuracoes`

`GET /api/reservas` JOINs clientes and fornecedores to return `clienteNome`, `fornecedorNome`.
`GET /api/clientes` uses limit 1000 (no paginating constraint).

### Frontend (`frontend/js/`)

Vanilla JS SPA with hash-based routing. No framework, no bundler.

- **`app.js`** — `App.init()` initializes all modules; `App.navigate(page)` switches pages; `App.onPageLoad(page)` dispatches to page-specific logic via `switch(page)`
- **`config.js`** — Global `window.CONFIG` object (empresa info, taxas, API URLs)
- **`modules/storage.js`** — `apiCall(endpoint, options)` global helper (adds Bearer header, redirects 401 → login). Also `Storage.*` CRUD per entity for compatibility
- **`modules/report.js`** — `ReportModule`: PDF generation with standard header/footer pattern
- **`data/airports.js`** — `AIRPORTS[]`, `getAirportByCode(code)`, `searchAirports(query)`
- **`utils/`** — `api.js`, `formatter.js`, `validators.js`
- **`services/`** — frontend-side service helpers

**Module pattern:** Each module exports an object with `init()`, `render()`, `save()`, `loadList()`, etc. Called from `app.js`.

**`apiCall()` is the standard way** to hit the backend from frontend modules — do not fetch directly.

### PDF Header Pattern (report.js)

Blue rect (y=0→45), rounded logo rect, "GiraMundoTour" text + slogan, contact info on right. Footer at `pageHeight - 18`. Airline logos via `https://pics.avs.io/200/80/{IATA}.png` (AD=Azul, G3=GOL, LA=LATAM).

### Authentication

- JWT, 7-day expiry, secret from `JWT_SECRET` env var
- Login: `POST /api/auth/login` → returns `{ token, usuario }`
- Token stored in localStorage; `storage.js` injects it on every `apiCall()`

### WhatsApp (whatsapp-web.js)

`whatsapp.service.js` — session stored in `backend/data/whatsapp_session/`. Painel QR modal on Reservas page. Integrated with `alertas.service.js` to send WhatsApp + email together.

### External APIs

- **Amadeus** (`AMADEUS_CLIENT_ID`, `AMADEUS_CLIENT_SECRET`) — flight search
- **RapidAPI / Sky Scrapper** (`RAPIDAPI_KEY`) — flight data
- **Email** — Gmail SMTP (`EMAIL_USER`, `EMAIL_PASS`)
- **Puppeteer** — headless Chrome for PDF capture; `PUPPETEER_EXECUTABLE_PATH` for server

### Environment Variables (`backend/.env`)

`DATABASE_URL`, `PORT`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `EMAIL_USER`, `EMAIL_PASS`, `PUPPETEER_EXECUTABLE_PATH`, `RAPIDAPI_KEY`, `AMADEUS_CLIENT_ID`, `AMADEUS_CLIENT_SECRET`

### Deploy

Server: **Render** (https://giramundotour.onrender.com). Deploy automático via `git push origin main` — Render detecta e faz deploy em ~5 min. Banco: Neon PostgreSQL. Ver `memory/reference_server.md` para detalhes de conexão.
