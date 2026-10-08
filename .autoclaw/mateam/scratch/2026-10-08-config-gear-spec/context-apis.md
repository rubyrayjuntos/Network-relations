# Context: remote APIs, env, and data pins (Network-relations applet)

Scope: inventory from `server.ts`, `src/lib/api.ts`, `src/lib/omnipath.ts`, `src/lib/scienceRoutes.ts`, `src/lib/measurements.ts`, `scripts/build-depmap-cache.ts`, `.env.example`, `vite.config.ts`, `package.json`. Consumers outside those files are noted where they call into this layer (e.g. browser via `App.tsx`).

**Timeouts:** No explicit `fetch` timeouts, `AbortSignal`, or HTTP client timeouts appear in the scoped files; all remote calls use platform defaults.

---

## Environment variables

| Name | Current value / default | File · symbol (line) | Consumer | Change impact | Bad value effect |
|------|-------------------------|----------------------|----------|---------------|------------------|
| `JWT_SECRET` | Required; no default (startup throws if missing) | `server.ts` · `JWT_SECRET` (L15–17) | Express (auth JWT sign/verify) | **Server restart**; existing cookies invalid | Missing: process exit. Wrong/rotated: 403 on protected routes; login appears broken |
| `HOST` | `"127.0.0.1"` if unset | `server.ts` · `HOST` (L20); `.env.example` comment (L14–15) | Express `app.listen` | **Server restart** | `0.0.0.0` exposes bind on all interfaces (intended for remote access). Invalid: listen error |
| `PORT` | `3000` if unset or non-numeric `Number(...)` | `server.ts` · `PORT` (L64) | Express | **Server restart** | Port in use: crash; wrong port: client cannot reach app |
| `NODE_ENV` | Unset in dev; `"production"` in prod deploys | `server.ts` · `authCookie.secure` (L26), Vite vs static (L170–181) | Express, cookie flags | **Server restart**; prod also needs **frontend build** | Dev vs prod asset serving mismatch; `secure` cookies blocked on plain HTTP in production |
| `DEPMAP_RELEASE` | Required for cache script only; example `"DepMap Public 24Q4"` in `.env.example` | `scripts/build-depmap-cache.ts` · `release` (L9–12); `.env.example` (L17–18) | Cache script → `measurements.json` metadata | **Cache rebuild** (`npm run cache-depmap`); then **server restart** to reload cache | Missing: script exits 1. Mismatch with actual CSV vintage: misleading release label in UI/export (biology metadata wrong, data still from local files) |
| `GEMINI_API_KEY` | Placeholder in `.env.example`; injected at Vite build via `loadEnv` | `.env.example` (L1–4); `vite.config.ts` · `define['process.env.GEMINI_API_KEY']` (L7–11) | Vite build (browser bundle if referenced) | **Frontend rebuild** (`vite build` / dev restart) | No references in scoped `src/` files today; bad/missing key would only matter if client code uses `process.env.GEMINI_API_KEY` |
| `APP_URL` | Placeholder `"MY_APP_URL"` in `.env.example` only | `.env.example` (L6–9) | *(not referenced in scoped code)* | N/A in current code | N/A until wired |
| `DISABLE_HMR` | Unset → HMR enabled; `'true'` disables HMR | `vite.config.ts` · `server.hmr` (L19–21) | Vite dev (via Express middleware) | **Dev server restart** | Agent/editing workflow only; not science data |

**Dotenv load order:** `dotenv.config()` then `dotenv.config({ path: ".env.local", override: true })` in `server.ts` (L12–13) and `scripts/build-depmap-cache.ts` (L6–7).

**Vite env loading:** `loadEnv(mode, '.', '')` — all env files from project root, empty prefix (L7).

---

## Host / port / local paths (non-remote)

| Name | Current value | File · symbol (line) | Consumer | Change impact | Bad value effect |
|------|---------------|----------------------|----------|---------------|------------------|
| Listen URL | `http://${HOST}:${PORT}` | `server.ts` · `app.listen` / log (L184–185) | Ops / browser same-origin | Restart | Unreachable app |
| `DB_FILE` | `"./database.json"` | `server.ts` (L21) | Express auth/prefs | Restart (path is constant in code) | Missing file: empty DB recreated |
| Measurement cache path | `data/cache/measurements.json` (cwd-relative) | `server.ts` · `loadMeasurementCache` (L51) | Express science routes | **Cache rebuild** + **server restart** | Missing/invalid JSON: `null` cache → `/api/contexts` and `/api/measurements` **503** |
| DepMap source CSV paths | `data/depmap/Model.csv`, `CRISPRGeneEffect.csv`, `OmicsExpressionProteinCodingGenesTPMLogp1.csv` | `scripts/build-depmap-cache.ts` · `sourceFiles` (L16–19, L30–33) | Cache script | **Cache rebuild** | Read failure: script crash; wrong schema: `MeasurementSchemaError` at build |
| Cache output | `data/cache/measurements.json` | `scripts/build-depmap-cache.ts` (L40–43) | Cache script → server load | Rebuild + restart | Same as missing cache |
| Vite `@` alias | Project root (`__dirname`) | `vite.config.ts` (L14–16) | Browser dev/build | Rebuild | Import resolution failures |
| `npm run dev` / `start` | `tsx server.ts` | `package.json` scripts (L7, L14) | Process launcher | Restart | N/A |
| `npm run cache-depmap` | `tsx scripts/build-depmap-cache.ts` | `package.json` (L13) | Cache script | Rebuild | N/A |

---

## Auth (hard-coded cookie flags only)

| Name | Current value | File · symbol (line) | Consumer | Change impact | Bad value effect |
|------|---------------|----------------------|----------|---------------|------------------|
| Cookie name | `"token"` | `server.ts` · signup/login/logout/clearCookie (L109, L125, L130, L71) | Browser + Express | Restart + re-login | N/A |
| `authCookie.httpOnly` | `true` | `server.ts` · `authCookie` (L23–27) | Express Set-Cookie | Restart | JS could read token if false |
| `authCookie.sameSite` | `"lax"` | `server.ts` (L25) | Express | Restart | Cross-site cookie issues |
| `authCookie.secure` | `true` when `NODE_ENV === "production"` | `server.ts` (L26) | Express | Restart | On HTTP prod: cookie not set → perpetual 401 |
| JWT `expiresIn` | `"24h"` | `server.ts` (L108, L124) | Express | Restart | Shorter/longer sessions |
| Default prefs `context` | `"pan-cancer"` | `server.ts` signup defaults (L102) | New users | DB-only | Wrong default lineage filter in UI |
| Default prefs `visualMode` | `"chronos"` | `server.ts` (L103) | New users | DB-only | Wrong default coloring |
| Auth API paths | Relative `/api/signup`, `/api/login`, `/api/logout`, `/api/me`, `/api/preferences` | `server.ts`; browser `src/lib/auth.ts` (out of scope but consumer) | Browser ↔ Express | Deploy path/base URL | 404 if app not served at origin root |

No hard-coded external auth host URLs in scoped files.

---

## Express science proxy routes (same-origin)

| Route | Query / body | File · symbol (line) | Consumer | Change impact | Bad value effect |
|-------|--------------|----------------------|----------|---------------|------------------|
| `GET /api/contexts` | — | `scienceRoutes.ts` · handler (L10–16) | Browser `fetchContexts` → `api.ts` (L128–132) | Server code change + restart | No cache: **503** JSON error |
| `GET /api/measurements` | `context` (required string), `genes` (comma-separated) | `scienceRoutes.ts` (L18–39); `api.ts` `fetchMeasurements` (L135–144) | Browser | Client **refetch**; server restart if route logic changes | Missing `context`: **400**. Unknown context: **400** (`MeasurementSchemaError`). No cache: **503**. Unknown gene: `null` in map (silent missing measurement) |
| `GET /api/omnipath` | `partners` (comma-separated gene symbols) | `scienceRoutes.ts` (L42–59); `api.ts` `fetchOmnipathInteractions` (L113–125) | Browser | Client **refetch** per request | Empty partners: **400**. Invalid chars: **400**. Upstream failure: **502** with message |

Upstream for OmniPath: see OmniPath section. Measurements/contexts: served from in-memory `MeasurementCache` loaded at startup (`server.ts` L49–61, L167).

---

## Remote API: STRING DB (browser-direct)

| Item | Current value | File · symbol (line) | Consumer | Change impact | Bad value effect |
|------|---------------|----------------------|----------|---------------|------------------|
| Network URL | `https://string-db.org/api/json/network` | `api.ts` · `fetchStringNetwork` (L35) | Browser (`App.tsx` pathway graphs) | **Refetch** on next graph load (code/deploy) | CORS/network error: catch → nodes from seeds, **empty edges** (sparse/silent graph) |
| Query `identifiers` | Seed proteins joined with `\r` | `api.ts` (L28–29) | Browser | Refetch | Wrong delimiter: STRING may mis-parse IDs |
| Query `species` | `'9606'` (human) | `api.ts` (L30) | Browser | Refetch | Wrong species: non-human or empty network |
| Query `required_score` | `'700'` (STRING 0–1000 scale) | `api.ts` (L31) | Browser | Refetch | Too high: fewer edges; too low: noisier graph |
| Pruning `limit` | Default `25` nodes | `api.ts` · `fetchStringNetwork` arg (L24, L54–64) | Browser | Refetch | Too low: tiny graph; high: performance hit |
| Interaction partners URL | `https://string-db.org/api/json/interaction_partners` | `api.ts` · `fetchInteractors` (L83) | Browser (protein expand) | Refetch | Same CORS/empty-edge fallback as network |
| Query `identifiers` | Single protein symbol | `api.ts` (L77) | Browser | Refetch | — |
| Query `species` | `'9606'` | `api.ts` (L78) | Browser | Refetch | Wrong biology |
| Query `limit` | Default `10` (`limit.toString()`) | `api.ts` (L79) | Browser | Refetch | Fewer/more neighbors |
| Query `required_score` | `'800'` | `api.ts` (L80) | Browser | Refetch | Stricter than pathway network (700) |
| Score normalization | `stringCombinedScore`: 0–1 → ×1000 | `api.ts` (L15–21) | Browser edge weights | Code change + refetch | Wrong scale in simulation/export metadata |
| `INITIAL_SEEDS` | Pathway → gene lists (KRAS/RAF1/…, etc.) | `api.ts` (L4–10) | Browser | Refetch when seeds used | Wrong seeds: incorrect pathway subgraph |

**Note:** Export metadata duplicates STRING species/score constants in `src/lib/exportView.ts` (`STRING_SPECIES` / `STRING_REQUIRED_SCORE` = 9606 / 700) — not in the user’s file list but documents UI export strings; changing `api.ts` network score without updating export constants would mislabel exports.

---

## Remote API: OmniPath (Express upstream proxy)

| Item | Current value | File · symbol (line) | Consumer | Change impact | Bad value effect |
|------|---------------|----------------------|----------|---------------|------------------|
| Upstream URL | `https://omnipathdb.org/interactions` | `omnipath.ts` · `fetchOmnipathUpstream` (L37) | Express → browser | **Refetch** per `/api/omnipath` call | Non-OK: **502** to client; error surfaced in UI |
| Query `genesymbols` | `"1"` | `omnipath.ts` (L32) | Express | Refetch | Wrong param: empty or malformed upstream payload |
| Query `format` | `"json"` | `omnipath.ts` (L33) | Express | Refetch | Parse failures → 502 |
| Query `partners` | Comma-joined gene symbols from client | `omnipath.ts` (L34); validated in `scienceRoutes.ts` (L43–52) | Browser → Express | Refetch | Invalid symbols rejected **400** before upstream |
| Query `datasets` | `omnipath,pathwayextra,kinaseextra,ligrecextra` | `omnipath.ts` · `OMNIPATH_DATASETS` (L1, L35) | Express | Refetch | Subset: fewer signed edges; wrong set: missing pathway biology |
| Response filter | Both endpoints must be in partner set; stimulation/inhibition flags from row fields | `omnipath.ts` · `filterOmnipathRows` (L10–24) | Express | Server restart if logic changes | Over-filtering: signed edges disappear silently |
| Browser proxy URL | `/api/omnipath?partners=...` | `api.ts` (L116–117) | Browser | Same-origin; no CORS to omnipathdb.org | Proxy down: client `{ ok: false, error }` |

---

## Remote API: MyGene.info (browser-direct)

| Item | Current value | File · symbol (line) | Consumer | Change impact | Bad value effect |
|------|---------------|----------------------|----------|---------------|------------------|
| URL template | `https://mygene.info/v3/query?q=symbol:${upperSymbol}&species=human&fields=go,name,summary,disease,pharos,pathway,interpro` | `api.ts` · `fetchProteinDetails` (L196) | Browser (`ProteinInfoPanel` via `fetchProteinDetails`) | Refetch per protein | CORS/network: falls back to curated `cancerData` or sparse `uncuratedDetails` |
| Query `species` | `human` | `api.ts` (L196) | Browser | Refetch | Wrong species annotations |
| Query `fields` | `go,name,summary,disease,pharos,pathway,interpro` | `api.ts` (L196) | Browser | Refetch | Missing fields: thinner panel text |
| Curated merge | `CURATED_CANCER_GENES` from `./cancerData` (local, not remote) | `api.ts` (L147–154, L193–241) | Browser | Redeploy | N/A for remote config |

---

## DepMap / measurements domain constants

| Item | Current value | File · symbol (line) | Consumer | Change impact | Bad value effect |
|------|---------------|----------------------|----------|---------------|------------------|
| `PAN_CANCER_ID` | `"pan-cancer"` | `measurements.ts` (L1) | Cache build, query, server default prefs | **Cache rebuild** if IDs in cache change; prefs DB | Unknown context **400** on measurements |
| `PAN_CANCER_LABEL` | `"Pan-cancer (all profiled cell lines)"` | `measurements.ts` (L2) | Cache contexts list | Rebuild | UI label only |
| Context IDs (non–pan-cancer) | Oncotree lineage strings from `Model.csv` `OncotreeLineage` | `measurements.ts` · `buildMeasurementCache` (L185–214) | Cache, `/api/contexts` | **Cache rebuild** | Wrong lineage column: empty or wrong context list |
| Required model columns | `ModelID`, `OncotreeLineage` | `measurements.ts` (L180–183) | Cache script | Rebuild fails | `MeasurementSchemaError` at build |
| Matrix labels (error messages) | `"CRISPR gene effect"`, `"expression"` | `measurements.ts` (L192–193) | Cache script | Rebuild | Schema errors if headers don’t parse to gene symbols |
| Gene header parsing | Regex `^([A-Za-z][A-Za-z0-9-]*?)(?:\s+\(|$)` | `measurements.ts` · `geneSymbolFromHeader` (L78–82) | Cache build | Rebuild | Symbols not indexed → missing genes in cache |
| `queryMeasurements` gene key | Uppercase trim | `measurements.ts` (L224–227) | Express | Restart | Case mismatch handled; unknown symbol → `null` measurement |

---

## Package / runtime pins (from `package.json`)

Not environment-configurable; listed for release/documentation alignment.

| Item | Current value | File | Consumer | Change impact | Bad value effect |
|------|---------------|------|----------|---------------|------------------|
| App package name | `react-example` | `package.json` | npm | N/A | N/A |
| Dev server entry | `tsx server.ts` | `package.json` scripts | Local run | — | — |
| Node test runner | `tsx --test tests/*.test.ts` | `package.json` | CI/local | — | — |

---

## Consumer map (summary)

| Layer | Calls |
|-------|--------|
| **Browser** | STRING + MyGene directly; `/api/omnipath`, `/api/contexts`, `/api/measurements`, auth `/api/*` same-origin; pathway data via `fetchStringNetwork` / `fetchInteractors` / `fetchOmnipathInteractions` / `fetchMeasurements` / `fetchContexts` / `fetchProteinDetails` (`api.ts`) |
| **Express** | OmniPath upstream; measurements/contexts from file-backed cache; JWT auth; Vite middleware (dev) or `dist` static (prod) |
| **Cache script** | Reads local DepMap CSVs; writes `measurements.json`; requires `DEPMAP_RELEASE` |

---

## Change-impact cheat sheet

| Change type | Requires |
|-------------|----------|
| STRING / MyGene URL or query params in `api.ts` | Browser refetch; redeploy client bundle |
| OmniPath URL/datasets in `omnipath.ts` | Server restart if code changed; client refetch |
| DepMap CSV files or `buildMeasurementCache` logic | `npm run cache-depmap` + **server restart** |
| `DEPMAP_RELEASE` env | Cache rebuild (metadata) + restart |
| `JWT_SECRET`, `HOST`, `PORT`, `NODE_ENV` | Server restart |
| `GEMINI_API_KEY` / Vite `define` | Dev restart or production `vite build` |
| Missing `data/cache/measurements.json` | 503 on DepMap routes until cache built |
