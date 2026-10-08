# Local config & hard-coded presentation inventory

Researcher B snapshot for **config-gear** spec. Workspace: `/home/rswan/Documents/Network-relations` (uncommitted scientific-disc work). No application source was modified except this file.

**Legend — user control column**

| Code | Meaning |
|------|---------|
| **RT** | Already adjustable at runtime in the current UI (or via persisted preferences). |
| **CFG** | Reasonable gear/config target (not all are product requirements). |
| **RO** | Read-only provenance or external data; user sees, does not author. |
| **FIX** | Fixed presentation/engineering default; typically not user-facing. |

**Legend — kind**

| Kind | Meaning |
|------|---------|
| **SCI** | Biological or dataset claim (must cite source / not be invented in UI). |
| **DISP** | Visualization, layout, copy, or UX default. |
| **DATA** | File path, API parameter, or pipeline constant tied to data ingestion. |

---

## Header upper-right controls (gear placement)

**Location:** `src/App.tsx` — header row `flex items-center gap-2.5`, right cluster order:

1. `GeneSearch`
2. **JSON** export (`handleExportJson`, Download icon)
3. **Export PNG** (`handleExportPNG`, Camera icon)
4. **Disconnect** (`handleLogout`, LogOut icon, label hidden below `md`)

A settings **gear** should sit in this same flex group (spec: adjacent to JSON/PNG/Disconnect, not in the bottom “Control Pod”).

---

## `src/lib/simulation.ts` — exclude from gear spec

| Item | Current value | File | Kind | User |
|------|---------------|------|------|------|
| `BooleanNetwork` | Full boolean-network simulator with OmniPath-weighted edges, random fallback edges, 50-tick window | `src/lib/simulation.ts` | DISP (unused) | **Out of scope** |

**Note:** Grep shows **no imports** of `simulation` anywhere in `.ts`/`.tsx`. The live app does not run this module. Spec should **not** expose simulation parameters in the gear UI.

Internal hard-codes inside (for exclusion documentation only): `WINDOW_SIZE = 50`; OmniPath both-stim/inhib → weight `1`; no-sign → weight `1`; undirected fallback weights random ±1; initial states random; activation threshold `>0` / `<0`.

---

## `INITIAL_SEEDS` and pathway lists

| Item | Current value | File | Kind | User |
|------|---------------|------|------|------|
| `INITIAL_SEEDS` | `RAS_MAPK`: KRAS, RAF1, MAPK1; `PI3K_AKT`: PIK3CA, AKT1, PTEN; `Cell_Cycle`: TP53, RB1, CDK4; `Apoptosis`: BAX, BCL2, CASP3; `Angiogenesis`: VEGFA, KDR, HIF1A | `src/lib/api.ts` | SCI (seed gene choice) + DATA | **CFG** (changes graph content; today fixed at build) |
| Default `selectedPathways` (client) | All keys of `INITIAL_SEEDS` on first load | `src/App.tsx` | DISP | **RT** (Systems checkboxes + prefs) |
| Default `selectedPathways` (signup) | `["RAS_MAPK","PI3K_AKT","Cell_Cycle","Apoptosis","Angiogenesis"]` | `server.ts` | DISP | **CFG** (new-user default only) |
| `ALL_PATHWAYS` | `Object.keys(INITIAL_SEEDS)` | `src/App.tsx` | FIX | **FIX** — declared but **unused** in codebase |
| Systems UI pathway list | Only `hubNodes` (= keys of loaded `secondaryGraphs`), not a fixed list | `src/App.tsx` | DISP | **RT** (subset via checkboxes) |
| Expand hub pathway key | User-expanded PPI hub uses **protein symbol** as pathway key (e.g. `KRAS`) | `src/App.tsx` `handleExpandNetwork` | DATA | **RT** (action-driven) |
| `activeNodePathways` / search | Union of graph membership, `INITIAL_SEEDS`, and curated `details.pathways` if key matches a hub or initial pathway | `src/App.tsx` | DISP | **RO** (derived) |

Panel headings for pathways: **“Pathways & Systems”** → **“Active Poincaré Networks:”** (graph) and **“Canonical Biological Pathways:”** (curated/MyGene, max 5 tags). `src/components/ProteinInfoPanel.tsx`.

---

## Preferences (`auth.ts` + `server.ts` + `App.tsx`)

| Item | Current value | File | Kind | User |
|------|---------------|------|------|------|
| `Preferences` shape | `zeta`, `bloomScale`, `selectedPathways`, `context`, `visualMode` | `src/lib/auth.ts` | DATA | **RT** (saved to `/api/preferences`) |
| Client initial `zeta` | `1.0` (`ZETA_DEFAULT`) | `src/App.tsx` | DISP | **RT** (slider + prefs) |
| Client initial `bloomScale` | `1.8` | `src/App.tsx` | DISP | **RT** |
| Client initial `context` | `PAN_CANCER_ID` (`"pan-cancer"`) | `src/App.tsx` | DATA | **RT** (select + prefs) |
| Client initial `visualMode` | `"chronos"` | `src/App.tsx` | DISP | **RT** (Color toggle + prefs) |
| Signup defaults | `zeta: 1.0`, `bloomScale: 1.8`, same 5 pathways, `context: "pan-cancer"`, `visualMode: "chronos"` | `server.ts` | DISP | **CFG** |
| GET prefs fallbacks | `context \|\| "pan-cancer"`, `visualMode \|\| "chronos"` | `server.ts` | DISP | **CFG** |
| Slider bounds ζ | min `0.5`, max `2.5`, step `0.1` | `src/App.tsx` | DISP | **RT** today; bounds **CFG** |
| Slider bounds Bloom | min `1.0`, max `3.5`, step `0.2` | `src/App.tsx` | DISP | **RT** today; bounds **CFG** |
| Prefs debounce save | `1000` ms after change | `src/App.tsx` | FIX | **FIX** |

---

## DepMap measurements cache & contexts

| Item | Current value | File | Kind | User |
|------|---------------|------|------|------|
| Runtime cache path | `data/cache/measurements.json` (from `process.cwd()`) | `server.ts` `loadMeasurementCache` | DATA | **CFG** / **RO** (admin build) |
| Build output path | `data/cache/measurements.json` | `scripts/build-depmap-cache.ts` | DATA | **CFG** |
| Source CSV paths (build) | `data/depmap/Model.csv`, `CRISPRGeneEffect.csv`, `OmicsExpressionProteinCodingGenesTPMLogp1.csv` | `scripts/build-depmap-cache.ts` | DATA | **RO** (provenance) |
| `DEPMAP_RELEASE` | Required env for `npm run cache-depmap`; stored in cache `release` field | `.env.example`, build script | DATA | **RO** in UI; **CFG** for rebuild |
| Missing cache message | 503: `"DepMap cache is not built. Run npm run cache-depmap."` | `src/lib/scienceRoutes.ts`, `server.ts` warn | DISP | **RO** |
| `PAN_CANCER_ID` | `"pan-cancer"` | `src/lib/measurements.ts` | DATA | **RO** (API id); label **CFG** |
| `PAN_CANCER_LABEL` | `"Pan-cancer (all profiled cell lines)"` | `src/lib/measurements.ts` | DISP | **CFG** or **RO** |
| Lineage contexts | Each distinct `OncotreeLineage` from Model.csv; `id` and `label` both = lineage string | `src/lib/measurements.ts` `buildMeasurementCache` | SCI/DATA | **RO** (from DepMap) |
| Gene column parsing | Header regex `^([A-Za-z][A-Za-z0-9-]*?)(?:\s+\(|$)` → uppercase symbol | `src/lib/measurements.ts` | DATA | **FIX** |
| Missing numeric cells | `NA`, `NAN`, empty → null; excluded from means | `src/lib/measurements.ts` | DATA | **RO** |
| Unknown context / gene | `MeasurementSchemaError` or `null` gene entry | `src/lib/measurements.ts` | DATA | **RO** |

---

## Chronos / expression domains, missing color, scales (`App.tsx`)

| Item | Current value | File | Kind | User |
|------|---------------|------|------|------|
| `MISSING_MEASUREMENT_COLOR` | `#334155` | `src/App.tsx` | DISP | **CFG** |
| Chronos color scale domain | `[-2, -0.5, 0, 0.5]` | `src/App.tsx` `chronosColorScale` | DISP (maps SCI values) | **CFG** |
| Chronos color range | `["#e11d48", "#fb7185", "#64748b", "#38bdf8"]` | `src/App.tsx` | DISP | **CFG** |
| Chronos clamp | `.clamp(true)` on scale | `src/App.tsx` | DISP | **CFG** |
| Expression color domain | `[0, 5, 10]` | `src/App.tsx` `expressionColorScale` | DISP | **CFG** |
| Expression color range | `["#0f172a", "#22d3ee", "#f8fafc"]` | `src/App.tsx` | DISP | **CFG** |
| Expression clamp | `.clamp(true)` | `src/App.tsx` | DISP | **CFG** |
| Legend title (overlay) | `"Mean Chronos"` / `"Mean expression"` / `"Curated roles"` | `src/App.tsx` | DISP | **RO** (follows **RT** mode) |
| Caption chronos | Mean Chronos in `{contextLabel}`; more negative = stronger dependency; n = cell lines; **display clamped [-2, 0.5]** | `src/App.tsx` | SCI + DISP | **CFG** (clamp text vs scale) |
| Caption expression | Mean log2(TPM+1); file already log-transformed; **display domain 0–10** | `src/App.tsx` | SCI + DISP | **CFG** |
| Caption roles | Curated role colors; not a DepMap measurement | `src/App.tsx` | DISP | **RO** |
| Provenance line | `DepMap {release\|cache not built} · {contextLabel} · STRING human 9606, combined score ≥ 700` | `src/App.tsx` | DATA + DISP | **RO** (mostly) |
| Missing gene copy | `"Genes absent from this DepMap release stay neutral."` (when no measurement error) | `src/App.tsx` | DISP | **CFG** |
| Panel DepMap section | Heading **"DepMap measurements"**; shows Mean Chronos, Mean log2(TPM+1), n; `"missing"` if null mean | `ProteinInfoPanel.tsx` | SCI + DISP | **RO** values; **CFG** copy |

---

## Roles mode colors & hash fallbacks (`App.tsx` + `math.ts`)

| Item | Current value | File | Kind | User |
|------|---------------|------|------|------|
| Role → category | `tumor_suppressor` → azure; `oncogene` → crimson; else if `druggable` → mint; else amber | `App.tsx` `getProteinColorCat` | DISP | **CFG** |
| Uncached / unknown role | `hashString(u) % 4` → azure, mint, amber, slate | `App.tsx` | DISP | **CFG** |
| `COLOR_HEX` | azure `#00B2FF`, mint `#00FFC2`, amber `#EAB308`, crimson `#E11D48`, slate `#475569` | `src/App.tsx` | DISP | **CFG** |
| `hashString` | 32-bit string hash, `Math.abs` | `src/lib/math.ts` | FIX | **CFG** if hash palette kept |
| Secondary layout angle | `phi = (hashString(u) % 1000 / 1000) * 2π` | `src/App.tsx` `getSecondaryCoords` | DISP | **FIX** / **CFG** |
| `GRADIENT_PAIRS` | 9 named pairs for edge gradients | `src/App.tsx` | DISP | **CFG** |
| Search highlight | `#38bdf8`, `#22d3ee`, `#0ea5e9`, `#06b6d4` | `src/App.tsx` | DISP | **CFG** |
| Pathway hub fill/stroke | default fill `rgba(225,29,72,0.15)`, stroke `#e11d48`; bloom `#fde047`; highlight `#38bdf8` | `src/App.tsx` | DISP | **CFG** |
| `details.druggable` default | `false` when uncached | `App.tsx` node sizing | DISP | **RO** (from API) |

Panel role badges (separate from disc colors): labels **Oncogene**, **Tumor Suppressor**, **Essential Regulator**, **Context-Dependent**, **Molecular Target** with fixed Tailwind colors — `ProteinInfoPanel.tsx` `roleColors`. **DISP**, **CFG** for copy/colors only; role text from **SCI** (curated or MyGene inference).

---

## STRING network parameters & edge width

| Item | Current value | File | Kind | User |
|------|---------------|------|------|------|
| Species | `9606` | `src/lib/api.ts`, `exportView.ts` `STRING_SPECIES` | DATA | **CFG** / **RO** |
| Network `required_score` | `700` (STRING API 0–1000) | `src/lib/api.ts` | DATA | **CFG** |
| Export provenance score | `STRING_REQUIRED_SCORE = 700` | `src/lib/exportView.ts` | DATA | **RO** in export |
| Default network `limit` | `25` nodes (degree prune) | `src/lib/api.ts` `fetchStringNetwork` | DATA | **CFG** |
| Interactors default limit | `10`; expand uses `15` | `src/lib/api.ts`, `App.tsx` | DATA | **CFG** |
| Interactors `required_score` | `800` | `src/lib/api.ts` | DATA | **CFG** |
| `stringCombinedScore` | API 0–1 → ×1000 rounded; invalid → `0` | `src/lib/api.ts` | DATA | **FIX** |
| STRING error fallback | nodes = input proteins (truncated to limit), edges `[]` | `src/lib/api.ts` | DISP | **RO** |
| Edge width formula | `scoreWidth = 0.6 + (clamp(score,0,1000)/1000)*2.4` → ~0.6–3.0 | `src/App.tsx` | DISP | **CFG** |
| Search edge width | `max(2.5, scoreWidth)` | `src/App.tsx` | DISP | **CFG** |
| Default edge stroke (no OmniPath) | `#475569` or gradient from endpoint role categories | `src/App.tsx` | DISP | **CFG** |
| Edge opacity | search `0.95`; active focus `0.7` / `0.05`; else `0.3` | `src/App.tsx` | DISP | **CFG** |
| Edge tooltip | `{u}–{v} · {pathway} · STRING score {score} · OmniPath {regulation}` | `src/App.tsx` | DISP | **RO** |
| Status copy | `"STRING Network Integration Active."`, `"Querying STRING..."`, `"STRING API Active"` | `src/App.tsx` | DISP | **CFG** |
| PNG/JSON stamp | `STRING 9606 score≥700` | `src/App.tsx` export | DATA | **RO** |

---

## OmniPath sign colors & legend copy

| Item | Current value | File | Kind | User |
|------|---------------|------|------|------|
| `OMNIPATH_DATASETS` | `omnipath`, `pathwayextra`, `kinaseextra`, `ligrecextra` | `src/lib/omnipath.ts` | DATA | **CFG** (upstream query) |
| Edge `stimulation` color | `#34d399` | `src/App.tsx` | DISP | **CFG** |
| Edge `inhibition` color | `#fb7185` | `src/App.tsx` | DISP | **CFG** |
| Edge `both` color | `#c084fc`, dash `4,3` | `src/App.tsx` | DISP | **CFG** |
| Inhibition dash | `2,2` | `src/App.tsx` | DISP | **CFG** |
| OmniPath fetch debounce | `1000` ms; partners = all `simNodes` | `src/App.tsx` | FIX | **FIX** |
| Overlay legend lines | Loading / error / `OmniPath signs on {signed} of {total} STRING edges` | `src/App.tsx` | DISP | **RO** |
| No separate color key | Stimulation/inhibition colors are not listed in the left legend box | `src/App.tsx` | DISP | **CFG** (gap) |

---

## Hyperbolic layout & disc presentation constants

| Item | Current value | File | Kind | User |
|------|---------------|------|------|------|
| Disc radius `R` | `400` | `src/App.tsx` | DISP | **CFG** |
| Primary centrality fallback | `\|\| 1.0` max, node `\|\| 0.5` | `src/App.tsx` | DISP | **FIX** |
| Secondary shell | `R_i = min(0.25, localScale * log(n+2))`; `localScale = 0.22 * bloomScale` (or `0.22`) | `src/App.tsx` | DISP | **RT** bloom; base **CFG** |
| Poincaré boundary clamp | scale to `0.99` if `\|z\| >= 1` | `src/App.tsx` | FIX | **FIX** |
| Pathway node size | `22 + 28 * centrality` | `src/App.tsx` | DISP | **CFG** |
| Secondary node size | druggable `14`; else `max(9, 6+hover)` | `src/App.tsx` | DISP | **CFG** |
| `isCentral` | degree > 4 | `src/App.tsx` | DISP | **CFG** |
| D3 zoom extent | `[0.5, 10]` | `src/App.tsx` | DISP | **CFG** |
| Grid / horizon colors | `#22d3ee` at various opacities | `src/App.tsx` | DISP | **CFG** |
| Canvas background | `#07090E` | `src/App.tsx` | DISP | **CFG** |
| PNG export scale | `2` | `src/App.tsx` | DISP | **CFG** |

---

## `CURATED_CANCER_GENES` — what is shown and where

**Source:** `src/lib/cancerData.ts` — 18 symbols: KRAS, RAF1, MAPK1, PIK3CA, AKT1, PTEN, TP53, RB1, CDK4, BAX, BCL2, CASP3, VEGFA, KDR, HIF1A, BRAF, EGFR, MYC.

**Merge logic:** `src/lib/api.ts` `fetchProteinDetails` — if symbol in map, curated fields override inference; MyGene still supplies `go`, `disease`, and optionally `summary` / `name`.

| Curated field | Shown in UI? | Heading / location | Kind | User |
|---------------|--------------|-------------------|------|------|
| `role` | Yes | Role badge (**Role Status**) | SCI | **RO** (expert curated); not editable |
| `roleDescription` | Yes | **Curated note** (and fallback **Biological Summary** if no MyGene summary) | SCI | **RO** |
| `druggability` | Yes | **Curated note** (status, target class, inhibitor tags) | SCI | **RO** |
| `bindingSites[]` | Yes | **Curated note** (name, type, residues, description) | SCI | **RO** |
| `pathways[]` | Yes | **Canonical Biological Pathways** (slice 0–5) | SCI | **RO** |
| `depMap` (score, tier, percentile, summary) | **No** — not copied into `ProteinDetails` | N/A (data exists only in TS object) | SCI | **RO** if ever surfaced; live Chronos from DepMap cache instead |
| `name` | Yes | Italic under symbol | SCI | **RO** (MyGene name preferred when present) |

**Disc coloring in roles mode** uses `inferredRole` + `druggable`, not DepMap tier. Curated `dual_role` / `essential_regulator` use mint/amber path unless oncogene/TS.

---

## `generateFallbackGeneData` — uncurated behavior

| Item | Current value | File | Kind | User |
|------|---------------|------|------|------|
| Role inference | MyGene `summary` regex → `tumor_suppressor`, `oncogene`, else `unknown` | `cancerData.ts` | SCI (heuristic) | **RO** |
| Pathways | MyGene `pathway` object keys → `"${KEY} Pathway"` | `cancerData.ts` | SCI | **RO** |
| Name | `myGeneHit?.name \|\| symbol` | `cancerData.ts` | SCI | **RO** |
| Explicit non-generation | No DepMap, druggability, or binding sites | comment in `cancerData.ts` | FIX | **RO** |
| `uncuratedDetails` | `druggable: false`; no curated note section unless empty | `api.ts` | DISP | **RO** |
| MyGene query fields | `go,name,summary,disease,pharos,pathway,interpro` | `api.ts` | DATA | **FIX** (`pharos` not mapped to UI) |
| Summary fallback curated | `summary = hit?.summary \|\| curated.roleDescription` | `api.ts` | SCI | **RO** |
| MyGene failure + curated | Returns curated-only object (no GO) | `api.ts` | SCI | **RO** |

---

## JSON export empty / fallback paths

| Item | Current value | File | Kind | User |
|------|---------------|------|------|------|
| `emptyMeasurement` | null means, n=0 | `exportView.ts` | DATA | **RO** |
| Node measurement lookup | `measurements[symbol]` then uppercase | `exportView.ts` | FIX | **RO** |
| Omnipath in export | datasets copy of `OMNIPATH_DATASETS`, per-edge signs | `exportView.ts` | DATA | **RO** |

---

## Miscellaneous “if missing use X” paths

| Item | Current value | File | Kind | User |
|------|---------------|------|------|------|
| `contextLabel` fallback | `PAN_CANCER_LABEL` if id not in list | `App.tsx` | DISP | **RO** |
| `depmapRelease` display | `"cache not built"` / `"release unavailable"` / `"unavailable"` in exports | `App.tsx`, panel | DISP | **RO** |
| Gene search miss | `"Gene not found"`; suggests KRAS, TP53, … | `App.tsx` | DISP | **CFG** |
| `bet[u] \|\| 0` in secondary layout | zero betweenness | `App.tsx` | FIX | **FIX** |
| Single-node graph bet | `{ [node]: 1.0 }` | `App.tsx` | FIX | **FIX** |
| Auth errors | `'Signup failed'`, `'Login failed'` | `auth.ts` | DISP | **CFG** |
| JWT / HOST / PORT | `JWT_SECRET` required; `HOST` default `127.0.0.1`; `PORT` default `3000` | `server.ts`, `.env.example` | DATA | Admin **CFG**, not gear |
| `database.json` | `./database.json` preferences store | `server.ts` | DATA | Admin |

---

## Summary for spec authors

- **Already runtime + persisted:** `zeta`, `bloomScale`, `selectedPathways`, `context`, `visualMode`.
- **Strong gear candidates (display/data, not science authorship):** color domains/ranges, missing color, STRING thresholds/limits, pan-cancer label, cache path (admin), OmniPath dataset list, export/legend copy, layout constants.
- **Read-only scientific content:** `CURATED_CANCER_GENES` body, DepMap measurements from cache, MyGene summaries/GO, STRING/OmniPath API results.
- **Do not wire gear to:** `src/lib/simulation.ts` (dead code).
- **Latent curated data not shown:** per-gene `depMap` block in `cancerData.ts` (distinct from live DepMap API).
