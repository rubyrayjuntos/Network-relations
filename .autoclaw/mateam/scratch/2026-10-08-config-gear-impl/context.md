# Config gear — implementation research map

Research for session `2026-10-08-config-gear-impl`. Spec: `.autoclaw/mateam/scratch/2026-10-08-config-gear-spec/output.md`. **No application source was edited.**

---

## Registry module constraints

- **New file:** `src/lib/settingsRegistry.ts` (does not exist yet).
- Must be importable from **Node** (`server.ts`, `scripts/build-depmap-cache.ts`) and **Vite** (browser bundles).
- **Must not import:** React, `simulation.ts`, or `fs`.
- Safe dependency direction: registry holds literals + `defaultPreferences()` + validation; `measurements.ts`, `omnipath.ts`, `exportView.ts`, `api.ts`, `scienceRoutes.ts`, `server.ts`, `App.tsx`, `SettingsPanel.tsx` import registry — **not** the reverse through `api.ts` → `cancerData.ts` (browser-oriented curated data).
- **Split recommendation:** keep `Preferences` TypeScript type in `auth.ts` (or derive keys from registry), but **values** only from `defaultPreferences()`. Do not put `Preferences` in a file that pulls `cancerData`.

---

## `src/lib/api.ts`

### Exports and signatures (current)

```ts
export const INITIAL_SEEDS: Record<string, string[]> = { ... };

export function stringCombinedScore(value: unknown): number;

export async function fetchStringNetwork(proteins: string[], limit: number = 25): Promise<GraphData>;

export async function fetchInteractors(protein: string, limit: number = 10): Promise<GraphData>;

export async function fetchOmnipathInteractions(proteins: string[]): Promise<OmnipathFetchResult>;

export async function fetchProteinDetails(symbol: string): Promise<ProteinDetails | null>;
```

### Current defaults (literals in code)

| Concern | Current value | Registry id(s) |
|--------|----------------|----------------|
| Network URL | `https://string-db.org/api/json/network` | `source.string.networkUrl` |
| Partners URL | `https://string-db.org/api/json/interaction_partners` | `source.string.partnersUrl` |
| Identifier delimiter | `proteins.join('\r')` | `source.string.identifierDelimiter` |
| Species | `'9606'` (network + partners) | `source.string.species` |
| Network `required_score` | `'700'` | `source.string.requiredScore` |
| Partner `required_score` | `'800'` | `source.string.partnerScore` |
| Network prune limit | param default `25` | `source.string.networkLimit` |
| Partner limit | param default `10` | `source.string.partnerLimit` |
| Initial seeds map | 5 pathways × 3 genes (see `INITIAL_SEEDS` lines 4–9) | `source.string.initialSeeds` |
| Score scale | `stringCombinedScore`: `raw <= 1 ? raw * 1000 : raw`, round; invalid → **`0`** (spec wants invalid score handling via `fallback.string.invalidScore`, not published as 0 in export) | `source.string.scoreScale`, `fallback.string.invalidScore` |
| MyGene URL | `` `https://mygene.info/v3/query?q=symbol:${upperSymbol}&species=human&fields=go,name,summary,disease,pharos,pathway,interpro` `` | `source.mygene.url`, `source.mygene.species`, `source.mygene.fields` |
| OmniPath client | `GET /api/omnipath?partners=...` (no `datasets` query today) | `source.omnipath.proxyPath`, `source.omnipath.datasets` |

### STRING catch behavior (today)

**`fetchStringNetwork`** (lines 67–70):

- Logs error, returns `{ nodes: proteins.slice(0, limit), edges: [] }`.
- Matches spec default policy **`seeds-no-edges`** (seed nodes, no edges). No `keep-last-graph` branch yet.

**`fetchInteractors`** (lines 101–103):

- Returns `{ nodes: [protein], edges: [] }` on failure (single-node hub, no edges).

**Implementation note:** catch paths must read **`fallback.string.error`** from effective preferences; `keep-last-graph` needs caller/state in `App.tsx` to retain last successful `GraphData` per pathway/hub.

### MyGene catch behavior (today)

**`fetchProteinDetails`** (lines 228–244):

- On catch: if curated symbol → return curated fields **without** `depMap` (never copied from `CURATED_CANCER_GENES[].depMap` — correct per spec).
- Else → `uncuratedDetails(upperSymbol)` (heuristic role, empty summary if no hit).
- Does not surface explicit **`MyGene request failed`** in return type; panel infers from loading/empty summary. Spec: `fallback.mygene.error` copy in UI.

### `INITIAL_SEEDS`

- Defined in `api.ts`; re-export target is registry (`source.string.initialSeeds`).
- `App.tsx` imports `INITIAL_SEEDS` from `./lib/api` (lines 12–15, 25, 116, 303, 482–497, etc.).

### `fetchOmnipathInteractions`

- Empty proteins → `{ ok: true, datasets: [], interactions: [] }`.
- Does not skip fetch when datasets empty (client always hits proxy); spec: **signs-off** = no `/api/omnipath` call when applied dataset set is `[]`.

---

## `src/App.tsx` (~1492 lines)

### View / preference state (disc + debounced save)

| Concern | Lines | Current default / behavior |
|--------|-------|----------------------------|
| `ZETA_DEFAULT` | 24, 110 | `1.0` → `view.zeta` |
| `bloomScale` | 111 | `1.8` → `view.bloomScale` |
| `selectedPathways` | 116 | `Object.keys(INITIAL_SEEDS)` → `view.selectedPathways` |
| `contextId` | 127–129 | `PAN_CANCER_ID` (`"pan-cancer"`) → `view.context` |
| `visualMode` | 134 | `"chronos"` → `view.visualMode` |
| Hydrate from GET prefs | 184–195 | zeta, bloom, pathways, context, visualMode only |
| **Preference save** (1000 ms debounce) | 212–218 | `api.savePreferences({ zeta, bloomScale, selectedPathways, context: contextId, visualMode })` — **5 keys only** |
| Zeta slider | 1417–1424 | min `0.5`, max `2.5`, step `0.1` → `view.zetaBounds` |
| Bloom slider | 1427–1435 | min `1.0`, max `3.5`, step `0.2` → `view.bloomBounds` |
| Context `<select>` | 1355–1365 | pod bottom-left |
| Color mode toggles | 1367–1410 | chronos / expression / roles |
| Pathway checkboxes | 1440–1454 | `hubNodes` (derived), not static seed keys |

### STRING / expand

| Concern | Lines |
|--------|-------|
| Initial STRING load | 220–225 → `handleRefreshString` 299–321 |
| Uses `INITIAL_SEEDS` + `fetchStringNetwork(seeds)` **no explicit limit** (default 25) | 303–304 |
| **`handleExpandNetwork`** | 323–341 |
| Expand limit literal **`15`** | 327: `fetchInteractors(protein, 15)` → `source.string.expandLimit` |
| STRING status (top-right) | 992–994: `"Querying STRING..."` / `"STRING API Active"`; separate from `statusMsg` bottom messages |
| `loadingString` | 136, 299–319 |

### Legend overlay (on-disc)

| Concern | Lines |
|--------|-------|
| Legend block | 948–987 |
| Title by mode | 950 → `display.legend.titles` |
| `measurementCaption` | 813–817 → caption templates + hard-coded clamp/domain text |
| Provenance line | **954**: `DepMap {depmapRelease ?? "cache not built"} · {contextLabel} · STRING human 9606, combined score ≥ 700` |
| Chronos gradient swatch | 956–963 (`#e11d48`, `#64748b`, `#38bdf8`) |
| Expression swatch | 966–973 |
| Gene absent sentence | 976–979 (shown when no `measurementError`) |
| OmniPath line | 981–986 |

### PNG stamp

| Concern | Lines |
|--------|-------|
| `handleExportPNG` | 369–472 |
| html2canvas `backgroundColor` | 377: `'#07090E'` → `display.layout.background` |
| `scale` | 378: `2` → `display.export.pngScale` |
| Primary stamp | **396**: `` `POINCARÉ DISC • ${metric} • STRING 9606 score≥700 • ${dateStr}` `` |
| Fallback stamp | **449** (same STRING literals) |
| Spec stamp shape | context label, both score cutoffs, DepMap release token — **not fully implemented** |

### JSON export

| Concern | Lines |
|--------|-------|
| `handleExportJson` | 819–842 |
| Calls `buildViewExport({ generatedAt, context, depmapRelease, nodes: simNodes, measurements, edges, omnipathInteractions, omnipathError })` |
| Download name | `poincare-view-${contextId}.json` |
| Header **JSON button** | 898–906 (gear must insert **before** this, same cluster 889–940) |

### Colors / edges

| Concern | Lines |
|--------|-------|
| `MISSING_MEASUREMENT_COLOR` | 26, 800, 805 → `#334155` |
| `getProteinColorCat` | 761–773 (loaded roles + hash `% 4`) |
| `COLOR_HEX` palette | 775–781 |
| `getNodeColor` | 797–809 |
| `chronosColorScale` | 783–788: domain `[-2,-0.5,0,0.5]`, range 4 hex, `clamp(true)` |
| `expressionColorScale` | 790–795: domain `[0,5,10]`, range 3 hex, `clamp(true)` |
| Edge width formula | **1209**: `0.6 + (clamp(score,0,1000)/1000)*2.4` |
| Sign colors / dashes | **1211–1218**, **1232**: stimulation `#34d399`, inhibition `#fb7185` dash `2,2`, both `#c084fc` dash `4,3` |
| Search highlight stroke | `#38bdf8`, `#0ea5e9`, `#06b6d4`, `#22d3ee` (1212, 1323–1325) |
| Default edge stroke | `#475569` (1221) |
| Hub pathway colors | **1140–1141**, highlight `#38bdf8`, bloom `#fde047` |
| Grid / horizon | **1031**, **1087–1098**: `#22d3ee`, bg `#07090E` |
| `GRADIENT_PAIRS` | 844–848 → `display.edges.gradientPairs` |
| Disc radius `R` | 850: `400` |

### Measurements / OmniPath effects

| Concern | Lines |
|--------|-------|
| `fetchContexts` on login | 688–698 |
| `fetchMeasurements(simNodes, contextId)` | 701–716 |
| OmniPath debounce **1000 ms** | 718–744 |
| `fetchOmnipathInteractions(nodes)` — always calls API when edges exist | 731 |

### Unused / exclusions

- `ALL_PATHWAYS` line 25 — unused; do not registry.

---

## `server.ts`

### Signup defaults (lines 96–104) — duplicate literals to replace with `defaultPreferences()`

```json
{
  "zeta": 1.0,
  "bloomScale": 1.8,
  "selectedPathways": ["RAS_MAPK", "PI3K_AKT", "Cell_Cycle", "Apoptosis", "Angiogenesis"],
  "context": "pan-cancer",
  "visualMode": "chronos"
}
```

### GET `/api/preferences` (138–150)

- Returns stored fields; fillers: `context: prefs.context || "pan-cancer"`, `visualMode: prefs.visualMode || "chronos"`.
- **No merge** with full default object for missing new keys (client/server must overlay `defaultPreferences()` per spec).

### POST `/api/preferences` (153–165)

- Accepts only `{ zeta, bloomScale, selectedPathways, context, visualMode }` from body — **no validation**, no 400 on unknown keys.
- Must expand to full preference document + registry validation.

### Cookie flags (lines 23–27, 71, 109, 125, 130)

- Name: **`"token"`** (hardcoded in `req.cookies.token`, `res.cookie`, `clearCookie`) → `operator.cookieName`
- `authCookie`: `httpOnly: true`, `sameSite: "lax"`, `secure: process.env.NODE_ENV === "production"` → operator cookie rows
- JWT `expiresIn: "24h"` (lines 108, 124) → `operator.jwtExpiresIn`

### Cache load (49–56, 61)

- Path: `path.join(process.cwd(), "data/cache/measurements.json")` → `operator.measurementCachePath`
- `measurementCache` null → 503 messages in science routes
- **Track `cacheLoaded: boolean`** for `GET /api/operator` (not exposed today)

### Where to mount `GET /api/operator`

- After `authenticateToken` is defined (~69–79).
- Logical placement: **with other authenticated API routes** (e.g. after `/api/preferences`, ~165) and **before** `mountScienceRoutes(app, measurementCache)` (~167) — same pattern as prefs.
- Handler needs: env (`HOST`, `PORT`, `NODE_ENV`, `DEPMAP_RELEASE`), `measurementCache` (release, pan-cancer id/label from cache or registry defaults), `cacheLoaded`, registry paths for DB/cookie/JWT metadata — **never** secret values.

### Other server literals

- `DB_FILE = "./database.json"` (21) → `operator.databasePath`
- `HOST` / `PORT` (20, 64) → operator rows
- Dotenv order (12–13) → `operator.dotenvOrder`

---

## `src/lib/auth.ts` — `Preferences` type (lines 6–12)

```ts
export type Preferences = {
  zeta: number;
  bloomScale: number;
  selectedPathways: string[];
  context: string;
  visualMode: "chronos" | "expression" | "roles";
};
```

**Extend** with spec persistence keys (`stringSpecies`, `stringRequiredScore`, … `fallbackRoleUncached`). Client `savePreferences` must POST **full** object after gear (including disc fields + apply/immediate fields).

---

## Registry literals by file (must not remain duplicated)

### `src/lib/exportView.ts`

| Literal / behavior | Lines | Registry |
|--------------------|-------|----------|
| `STRING_SPECIES = "9606"` | 4 | `source.string.species` — **remove export** |
| `STRING_REQUIRED_SCORE = 700` | 5 | `source.string.requiredScore` — **remove** |
| `buildViewExport` hardcodes string block | 70 | snapshot: species, both scores, limits, expand, scoreScale, initialSeeds, visualMode, fallbacks |
| `OMNIPATH_DATASETS` import from omnipath | 1, 72 | effective `source.omnipath.datasets` |
| `emptyMeasurement` null means / n=0 | 33–38 | `fallback.depmap.geneAbsent` |

### `src/lib/omnipath.ts`

| Literal | Lines | Registry |
|---------|-------|----------|
| `OMNIPATH_DATASETS` | 1 | allow-list + default preference set |
| Upstream URL | 37 | `source.omnipath.host` |
| `genesymbols: "1"`, `format: "json"` | 32–33 | `source.omnipath.genesymbols`, `source.omnipath.format` |
| `datasets: OMNIPATH_DATASETS.join(",")` | 35 | effective datasets param |
| `filterOmnipathRows` endpoint filter | 10–24 | `source.omnipath.endpointFilter` |

### `src/lib/scienceRoutes.ts`

| Literal | Lines | Registry |
|---------|-------|----------|
| Cache missing 503 message | 12, 20 | `fallback.depmap.cacheMissing` (exact sentence) |
| `/api/omnipath` — no `datasets` query | 42–59 | must accept `datasets`, validate ⊆ four names |
| Partner regex | 50 | documented under proxy path |

### `src/lib/measurements.ts`

| Literal | Lines | Registry |
|---------|-------|----------|
| `PAN_CANCER_ID = "pan-cancer"` | 1 | `source.depmap.panCancerId` |
| `PAN_CANCER_LABEL = "Pan-cancer (all profiled cell lines)"` | 2 | `source.depmap.panCancerLabel` |
| Gene header regex | 81 | `source.depmap.geneHeaderPattern` |
| `parseNumber` NA/NAN/empty | 85–90 | `source.depmap.missingCell` |
| `queryMeasurements` uppercase trim | 225–227 | `source.depmap.geneJoin` |
| Model columns `ModelID`, `OncotreeLineage` | 180–183 | `operator.depmapModelColumns` |
| Schema labels `"CRISPR gene effect"`, `"expression"` | 192–193 | `operator.depmapMatrixLabels` |

### `src/components/ProteinInfoPanel.tsx`

| Literal / copy | Lines | Registry |
|----------------|-------|----------|
| `HUMAN [9606]` badge | 94 | `source.string.species` + `source.mygene.species` (not hard-coded) |
| `DepMap measurements` heading | 141 | `display.panel.depmapHeading` |
| `"missing"` token | 157, 164 | `display.panel.missingToken` |
| `"release unavailable"` | 144 | align with legend tokens (`cache not built` / `release unavailable`) |
| `roleColors` / Unknown **`Molecular Target`** | 48–79, 76–77 | `display.panel.roleBadges` — spec retires Molecular Target → Unknown without biological sentence |
| **`Curated note`** section | 172+ | gate with `view.curatedNoteVisible` |
| Pathway headings (rest of file) | — | `display.panel.pathwayHeadings` |

### `scripts/build-depmap-cache.ts`

| Literal | Lines | Registry |
|---------|-------|----------|
| Dotenv order | 6–7 | `operator.dotenvOrder` |
| CSV paths under `data/depmap/` | 17–19, 31–33 | `operator.depmapSourceFiles` |
| Output `data/cache/measurements.json` | 40–42 | `operator.measurementCachePath` |
| `DEPMAP_RELEASE` required | 9–12 | `operator.depmapRelease` (env) |

---

## Apply flow (from spec) — wiring gaps in current code

1. **Draft state** for `commit: apply` rows (sources + `fallback.string.error`) — not present; gear UI new.
2. **Apply** must POST full preferences (disc + draft), refetch STRING for **selected pathways** + expanded hubs, OmniPath (or skip if datasets `[]`), MyGene for open panel, repaint.
3. **`handleRefreshString`** today iterates **all** `INITIAL_SEEDS` keys, not `selectedPathways` only — align with spec Apply + pathway selection.
4. **`fetchStringNetwork`/`fetchInteractors`** need effective species/scores/limits from snapshot, not literals.
5. **Legend composer** — new shared function (spec); replace duplicated provenance in 954, 396, 449.
6. **`getOperator` API** — add to `auth.ts` `api` client for SettingsPanel Operator group.

---

## Risks

### 1. `App.tsx` size (~1492 lines)

- Gear drawer, draft/apply/pending state, effective snapshot, legend builder, and preference hydration for ~30 new keys will **grow** an already large file.
- Mitigation: extract `useEffectiveSettings`, `buildLegendLines`, `refetchAfterApply` hooks/modules (not in spec file list but reduces regression risk). Keep `simulation.ts` out.

### 2. Legacy preference documents without new keys

- DB rows only have 5 fields; GET currently does not overlay defaults.
- Spec: GET returns **stored ∪ `defaultPreferences()`** so old users resolve `stringRequiredScore: 700`, etc.
- POST must **reject** unknown keys (400) and validate all known keys.
- Client must merge on read before hydrating React state (including future apply-draft separate from saved prefs until Apply).

### 3. Server importing browser-only modules

- **Today:** `server.ts` → `measurements.ts` only (safe). `scienceRoutes` → `omnipath.ts` (safe).
- **Risk if registry re-exports from `api.ts`:** `api.ts` imports `cancerData.ts` — pulling registry through api breaks Node purity.
- **Risk if validation imports App or exportView with DOM assumptions:** avoid.
- **Vite:** registry in client bundle is fine if tree-shaken; keep operator env reads **server-only** in route handler, not in shared init that runs in browser.

### 4. STRING error policy vs current catch

- `fetchStringNetwork` always seeds-no-edges; **`keep-last-graph`** requires App to store last good graph per key and catch to branch on preference.

### 5. Invalid STRING scores

- `stringCombinedScore` returns `0`; edge tooltips/export may show `0` — spec wants `null` + `STRING score invalid` (`fallback.string.invalidScore`).

### 6. OmniPath datasets

- Server ignores client dataset preference; export always full four datasets. Signs-off requires client skip + server optional `datasets` query param.

### 7. DepMap release display tokens

- PNG stamp uses `"unavailable"` (392–394); legend uses `"cache not built"` (954). Spec unifies tokens — implement via registry/operator readout.

---

## New / changed files (spec checklist)

| File | Action |
|------|--------|
| `src/lib/settingsRegistry.ts` | **Create** — SETTINGS, defaults, validation, preference key map |
| `src/components/SettingsPanel.tsx` | **Create** — registry-driven drawer |
| `src/App.tsx` | Gear, snapshot, legend, wire fetches, expand limit, prefs |
| `src/lib/auth.ts` | Extend `Preferences`; optional `getOperator()` |
| `server.ts` | defaults, validate POST, merge GET, `/api/operator`, registry paths |
| `src/lib/api.ts` | Params from snapshot; catch policies; re-export seeds from registry |
| `src/lib/exportView.ts` | Snapshot input; drop STRING constants |
| `src/lib/omnipath.ts` | Registry URLs/params; parameterized datasets |
| `src/lib/scienceRoutes.ts` | datasets query; registry error string |
| `src/lib/measurements.ts` | Import pan-cancer id/label/pattern from registry |
| `scripts/build-depmap-cache.ts` | Registry paths |
| `src/components/ProteinInfoPanel.tsx` | curated note visibility; badge copy |
| `tests/exportView.test.ts` | Snapshot fields |
| `tests/settingsRegistry.test.ts` | **Create** |

---

## Acceptance mapping (quick)

| # | Research anchor |
|---|-----------------|
| 1 | Header 889–940; disc 1355–1454; default visualMode 134 |
| 2 | New SettingsPanel + registry groups |
| 3 | View rows inspect-only (no second controls in drawer) |
| 4–5 | api.ts 28–31, 76–80; exportView 70; omnipath proxy |
| 6–7 | scienceRoutes 503; measurements null; MISSING color 26 |
| 8 | omnipath legend 981–986 |
| 9 | api catch 67–70 + new keep-last-graph state |
| 10 | getProteinColorCat 761–773 |
| 11 | buildViewExport extension |
| 12 | ProteinInfoPanel 172+ |
| 13 | SettingsPanel generic row renderer |
| 14 | server operator route |
| 15 | defaultPreferences reset |
| 16 | no simulation import |
