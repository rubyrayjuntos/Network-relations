# Config gear — implementation specification

Session `2026-10-08-config-gear-spec`. This document is the implementation spec. It does not contain application code. Defaults below are today’s behavior, taken from `context-apis.md` and `context-local.md` in this directory.

The panel is how a reader sees what feeds the applet. Every hard-coded value and every local lookup in those inventories is a registry entry below, or it is named in [Exclusions](#exclusions) with a reason. The panel renders the registry. A new feature adds a descriptor. It does not add a field list inside the panel component.

Census: **113 registry entries**. Sources 28, Local fallbacks 12, Display 43, View 8, Operator 22. The hypothetical descriptor in [Adding a setting](#adding-a-setting) is not one of the 113.

---

## Placement

The header row in `src/App.tsx` is the cluster `flex items-center gap-2.5`. Today’s order is Gene search, JSON export, PNG export, Disconnect.

Insert a gear button in that cluster, immediately before JSON. Resulting order:

1. Gene search
2. Gear
3. JSON
4. PNG
5. Disconnect

Use the same icon button sizing as JSON. Accessible name: `Data sources and settings`. The control is a toggle. It opens a right-hand drawer (`role="dialog"`, labelled `Data sources and settings`). Escape and a close control dismiss it. The disc stays mounted. Opening the drawer does not change context, color mode, zeta, bloom, or the selected pathways.

The drawer is not the bottom control pod. These disc controls stay where they are and keep their current behavior:

| Disc control | Registry id | Where it stays |
|---|---|---|
| Context selector | `view.context` | Existing selector |
| Color mode (Chronos / expression / roles) | `view.visualMode` | Existing color toggle |
| Zeta slider | `view.zeta` | Existing slider |
| Bloom slider | `view.bloomScale` | Existing slider |
| Pathway checkboxes | `view.selectedPathways` | Existing Systems checkboxes |

The gear rows for those five ids show the effective value and the code default. They do not draw a second slider, select, or checkbox. A short line on each row says `Edited on the disc.`

A pending dot on the gear icon is visible while any `commit: apply` edit is unapplied, including while the drawer is closed.

## Three jobs

Every row in the drawer does one or more of these jobs.

1. **Inspect.** Show the code default, the effective value, the store (code default, user preference, env, cache file), and the apply effect (refetch, repaint, rebuild+restart, nothing).
2. **Edit what is safe at runtime.** Only descriptors with `commit` of `apply` or `immediate` render an editor. The editable set is fixed in [What is editable](#what-is-editable).
3. **Name every local fallback.** A failed remote call stays a named state. The drawer shows the policy sentence. A failure must not be drawn as an ordinary empty result.

## Registry

One module owns the descriptors: `src/lib/settingsRegistry.ts`. It imports no React and no `simulation.ts`. `src/App.tsx`, `src/components/SettingsPanel.tsx`, `src/lib/api.ts`, `src/lib/exportView.ts`, `src/lib/omnipath.ts`, `src/lib/measurements.ts`, `src/lib/scienceRoutes.ts`, `scripts/build-depmap-cache.ts`, and `server.ts` read this module. They do not keep a second copy of a default.

`SettingsPanel.tsx` maps `SETTINGS` grouped by `group`. It has no literal field list, no switch per source, and no color input that is not driven by a descriptor.

### Descriptor

| Field | Meaning |
|---|---|
| `id` | Stable dotted id. Preference keys, export keys, and legend keys use this id. |
| `label` | Drawer text. |
| `group` | `Sources`, `Local fallbacks`, `Display`, `View`, or `Operator`. Drawer section order is that order. |
| `kind` | `source`, `display`, `view`, `fallback-policy`, or `operator`. |
| `default` | Code default. Equal to today’s behavior. |
| `storage` | One or more of: `code default`, `user preference`, `env`, `cache file`. |
| `commit` | `apply` (draft until Apply), `immediate` (write-through), `readonly` (no editor). |
| `effect` | What a committed change does: `refetch`, `repaint`, `rebuild+restart`, or `nothing`. |
| `legend` | `yes` if the on-disc legend and the PNG stamp must repeat the effective value. |
| `export` | `yes` if JSON export must repeat the effective value. |
| `editable` | `yes` only for the runtime set in [What is editable](#what-is-editable). Readonly rows still render. |

Effective value, in order:

1. Operator and cache rows: the `GET /api/operator` readout. The browser does not read `.env`, `database.json`, or the cache file itself.
2. Preference-backed rows: the stored preference when the key is present, otherwise `default`.
3. Every other row: `default`.

A disc control and the drawer read the same effective value. There is one zeta, one context, one visual mode.

### How the panel stays stable

`SettingsPanel` groups `SETTINGS` by `group`, then renders each descriptor with the same row component. The row component switches on `kind`, `commit`, and a small `control` tag on the descriptor (`text`, `number`, `color`, `color-list`, `dataset-set`, `gene-map`, `enum`, `boolean`). Adding a descriptor with one of those controls is enough. Adding a new `control` value is the only panel change, and only when no existing control can render the value.

Unknown ids in a saved preference document are dropped on read and rejected on write (HTTP 400, stored document unchanged).

## Persistence

Extend `Preferences` in `src/lib/auth.ts`. The stored document keeps the five current keys and gains only the keys whose `storage` includes `user preference`. Inspect-only code defaults are not written to `database.json`. Operator values are not written there.

Current keys, unchanged in meaning:

| Key | Code default |
|---|---|
| `zeta` | `1.0` |
| `bloomScale` | `1.8` |
| `selectedPathways` | `["RAS_MAPK","PI3K_AKT","Cell_Cycle","Apoptosis","Angiogenesis"]` |
| `context` | `"pan-cancer"` |
| `visualMode` | `"chronos"` |

New preference keys (names the server accepts):

| Key | Registry id | Code default |
|---|---|---|
| `stringSpecies` | `source.string.species` | `"9606"` |
| `stringRequiredScore` | `source.string.requiredScore` | `700` |
| `stringPartnerScore` | `source.string.partnerScore` | `800` |
| `stringNetworkLimit` | `source.string.networkLimit` | `25` |
| `stringPartnerLimit` | `source.string.partnerLimit` | `10` |
| `stringExpandLimit` | `source.string.expandLimit` | `15` |
| `omnipathDatasets` | `source.omnipath.datasets` | `["omnipath","pathwayextra","kinaseextra","ligrecextra"]` |
| `mygeneFields` | `source.mygene.fields` | `["go","name","summary","disease","pharos","pathway","interpro"]` |
| `initialSeeds` | `source.string.initialSeeds` | The five pathway lists in the Sources table |
| `missingColor` | `display.missingColor` | `"#334155"` |
| `chronosDomain` | `display.chronos.domain` | `[-2,-0.5,0,0.5]` |
| `chronosRange` | `display.chronos.range` | `["#e11d48","#fb7185","#64748b","#38bdf8"]` |
| `chronosClamp` | `display.chronos.clamp` | `true` |
| `expressionDomain` | `display.expression.domain` | `[0,5,10]` |
| `expressionRange` | `display.expression.range` | `["#0f172a","#22d3ee","#f8fafc"]` |
| `expressionClamp` | `display.expression.clamp` | `true` |
| `signStimulation` | `display.signs.stimulation` | `{ "color": "#34d399", "dash": null }` |
| `signInhibition` | `display.signs.inhibition` | `{ "color": "#fb7185", "dash": "2,2" }` |
| `signBoth` | `display.signs.both` | `{ "color": "#c084fc", "dash": "4,3" }` |
| `rolePalette` | `display.roles.palette` | azure `#00B2FF`, mint `#00FFC2`, amber `#EAB308`, crimson `#E11D48`, slate `#475569` |
| `edgeDefaultStroke` | `display.edges.defaultStroke` | `"#475569"` |
| `searchHighlight` | `display.search.highlight` | `["#38bdf8","#22d3ee","#0ea5e9","#06b6d4"]` |
| `hubColors` | `display.hub.colors` | fill `rgba(225,29,72,0.15)`, stroke `#e11d48`, bloom `#fde047`, highlight `#38bdf8` |
| `gridColor` | `display.layout.grid` | `"#22d3ee"` |
| `background` | `display.layout.background` | `"#07090E"` |
| `curatedNoteVisible` | `view.curatedNoteVisible` | `true` |
| `fallbackStringError` | `fallback.string.error` | `"seeds-no-edges"` |
| `fallbackRoleUncached` | `fallback.role.uncached` | `"hash"` |

`stringExpandLimit` is the third STRING limit. `handleExpandNetwork` in `src/App.tsx` passes `15` today, while `fetchInteractors` defaults its argument to `10` and has no other caller. Both numbers stay. The expand button sends `stringExpandLimit`. A caller that omits a limit uses `stringPartnerLimit`. Shipping both as preferences keeps either number from remaining a second literal, and the defaults keep today’s requests.

`server.ts` signup, and the GET `/api/preferences` fillers that currently rewrite a missing `context` to `"pan-cancer"` and a missing `visualMode` to `"chronos"`, call `defaultPreferences()` from the registry. Delete those duplicated literals from `server.ts`. GET returns the stored object overlaid on `defaultPreferences()`, so a document saved before this change still resolves every new key to today’s default. The client keeps the existing 1000 ms debounce for `immediate` writes. That debounce is not a registry entry.

POST `/api/preferences` accepts the full preference object and no other keys. Validation lives next to the descriptors (the server imports the same module):

| Key | Rule |
|---|---|
| `stringSpecies` | Non-empty numeric taxon string |
| `stringRequiredScore`, `stringPartnerScore` | Integers from 0 through 1000 |
| `stringNetworkLimit` | Integer from 1 through 100 |
| `stringPartnerLimit`, `stringExpandLimit` | Integers from 1 through 50 |
| `omnipathDatasets` | Subset of `omnipath`, `pathwayextra`, `kinaseextra`, `ligrecextra`. Duplicates dropped. Order kept. Empty array allowed |
| `mygeneFields` | Non-empty subset of `go`, `name`, `summary`, `disease`, `pharos`, `pathway`, `interpro`. Order kept |
| `initialSeeds` | At least one pathway. Each gene matches `^[A-Za-z][A-Za-z0-9-]*$`. Symbols stored uppercased |
| Color strings | `#` plus six hex digits, except `hubColors.fill`, which stays a `rgba(...)` string matching the current fill form |
| Domains | Chronos: four ascending numbers. Expression: three ascending numbers |
| `chronosClamp`, `expressionClamp`, `curatedNoteVisible` | Booleans |
| `fallbackStringError` | `seeds-no-edges` or `keep-last-graph` |
| `fallbackRoleUncached` | `hash` or `missing` |
| Existing `zeta`, `bloomScale`, `selectedPathways`, `context`, `visualMode` | Same ranges and values the disc already enforces. Zeta stays on 0.5–2.5 step 0.1. Bloom stays on 1.0–3.5 step 0.2. `visualMode` stays `chronos`, `expression`, or `roles` |

An invalid body returns 400 and does not write. `selectedPathways` entries that are not keys of the applied `initialSeeds` and not currently expanded hub symbols are dropped on Apply.

### Operator readout

Add authenticated `GET /api/operator`. It is a read. It has no POST. The handler returns:

| JSON field | Rule |
|---|---|
| `jwtSecret` | `"present"` or `"absent"`. Never the secret. A running server has already refused to boot without it, so a live process reports `present` |
| `host` | `process.env.HOST` or `"127.0.0.1"` |
| `port` | Numeric `PORT` or `3000` |
| `nodeEnv` | `process.env.NODE_ENV` or `"unset"` |
| `listenUrl` | `http://{host}:{port}` |
| `databasePath` | `"./database.json"` |
| `measurementCachePath` | `"data/cache/measurements.json"` |
| `cacheLoaded` | `true` or `false` from the startup load |
| `depmapRelease` | The `release` string in the cache file, or `null` |
| `depmapReleaseEnv` | `process.env.DEPMAP_RELEASE` or `null`. The disc uses the cache field. When both are non-null and differ, the drawer shows both and labels the cache field as the value on the disc |
| `panCancerId` | The cache’s pan-cancer id, or the registry default `pan-cancer` when the cache is not loaded. This is the same value as `source.depmap.panCancerId` |
| `panCancerLabel` | The cache’s pan-cancer label, or the registry default when the cache is not loaded |
| `depmapSourceFiles` | The three CSV paths |
| `cookieName` | `"token"` |
| `cookieHttpOnly` | `true` |
| `cookieSameSite` | `"lax"` |
| `cookieSecure` | `true` when `NODE_ENV === "production"`, otherwise `false` |
| `jwtExpiresIn` | `"24h"` |
| `authRoutes` | `/api/signup`, `/api/login`, `/api/logout`, `/api/me`, `/api/preferences` |
| `dotenvOrder` | `.env`, then `.env.local` with override |
| `geminiApiKey` | The literal `"unused"` |
| `appUrl` | The literal `"unused"` |
| `disableHmr` | `"true"` or `"unset"` from `process.env.DISABLE_HMR` |
| `depmapModelColumns` | `ModelID`, `OncotreeLineage` |
| `depmapMatrixLabels` | `CRISPR gene effect`, `expression` |

The response omits `JWT_SECRET`, `GEMINI_API_KEY`, cookie values, and passwords. The drawer does not offer a control that writes `.env`, rewrites `database.json` by hand, or runs `npm run cache-depmap`.

## Scientific constraints

These are part of the implementation, not commentary.

- A failed remote call is never replaced by a local number. `fetchProteinDetails` continues to omit `CURATED_CANCER_GENES[symbol].depMap`. The panel, the disc color, and `buildViewExport` do not read `ProteinDetails.depMap`, `syntheticExpressionLevel`, or `CURATED_CANCER_GENES[].depMap`. There is no descriptor whose values include a curated Chronos score. There is no switch labeled “use curated DepMap when the cache misses.”
- A missing measurement cache is the error `DepMap cache is not built. Run npm run cache-depmap.` (`fallback.depmap.cacheMissing`). It is not the gene-absent sentence, and it is not a curated score. Disc nodes use `display.missingColor`. Routes stay HTTP 503.
- A gene absent from the loaded release is `fallback.depmap.geneAbsent`: null means, `n = 0`, missing color, sentence `Genes absent from this DepMap release stay neutral.` That state is not an error.
- Gene identity is exact HGNC. `source.depmap.geneJoin` uppercases and trims. The header parser stays `^([A-Za-z][A-Za-z0-9-]*?)(?:\s+\(|$)`. This spec adds no alias map. An alias map would be a future descriptor in Local fallbacks, default an empty map so the join stays exact, `editable` only when that future spec says so. It is not one of the 113 entries.
- An OmniPath failure stays the error caption returned to the client. The legend does not substitute “no interactions” or the success sentence with a zero count. STRING edges still draw, without signs (`fallback.omnipath.error`).
- Curated role text, drug text, and binding sites render under the heading `Curated note`. `view.curatedNoteVisible` may hide that block. The implementation must not label that block, or the role badge, as a DepMap result or a Pharos result. `pharos` may remain in the MyGene field list; the panel still does not map it to a section.
- After Apply, the legend, the PNG stamp, and the JSON export use the effective species, score cutoffs, limits, OmniPath datasets, DepMap release, context, and visual mode. They do not import `STRING_SPECIES`, `STRING_REQUIRED_SCORE`, or a hard-coded `9606` / `700` / dataset list.
- `src/lib/simulation.ts` and `BooleanNetwork` stay out of the UI and out of the registry. Do not import the module.
- `GEMINI_API_KEY` stays unused. `operator.geminiApiKey` says so. Do not call Gemini and do not read the Vite `process.env.GEMINI_API_KEY` define from the client.

## What is editable

Runtime editable, stored in the preference document:

- STRING species, network cutoff `700`, partner cutoff `800`, network limit `25`, partner limit `10`, and expand limit `15`.
- OmniPath dataset set. Any subset of the four names, including the empty set. The empty set is labeled `signs off` on the control, in the legend, and in the export (`datasets: []`, `error: null`). Signs-off skips `GET /api/omnipath`. It is a configured state, distinct from `fallback.omnipath.error`.
- MyGene field list. The host and `source.mygene.species` (`human`) are visible and are not preference keys.
- Display domains and colors listed with `commit: immediate` in the Display table: missing color, both scales’ domains, ranges, and clamps, the three sign colors and their dashes, the role palette, the default edge stroke, search-highlight colors, hub colors, grid color, and canvas background.
- Starter pathway membership `source.string.initialSeeds`.
- Curated-note visibility.
- The two fallback enums: `fallback.string.error` and `fallback.role.uncached`.

Operator rows are read-only in the drawer. Each row shows the file or env name and the command that changes it. Changing them is a process restart, a frontend rebuild, or `npm run cache-depmap`, as the Operator table says. No button in the drawer performs those actions.

The five disc controls (`view.zeta`, `view.bloomScale`, `view.selectedPathways`, `view.context`, `view.visualMode`) are edited on the disc. Their drawer rows are inspect-only: the View table’s `immediate` value is the disc control’s commit, and the drawer does not draw a second control. `defaultPreferences().selectedPathways` is the keys of `source.string.initialSeeds`. `defaultPreferences().context` is `source.depmap.panCancerId`. Those two defaults are not written a second time as literals.

Every remaining descriptor is `commit: readonly`. The drawer still shows default and effective value. Call sites read the registry default so the number exists in one place. A later feature sets `editable` and `storage` on that descriptor; the panel does not need a new form.

## Apply, reset, and pending

Source rows (`commit: apply`) edit a draft. The row shows `Pending` until Apply. The draft survives closing the drawer and is dropped on logout.

Apply:

1. Writes the draft into the preference document (one POST of the full object, including the current disc values so zeta and the rest are not wiped).
2. Refetches STRING for each selected pathway and for each expanded hub.
3. Refetches OmniPath for the visible partner set, or skips that call and clears signs when the applied dataset set is empty.
4. Refetches MyGene for the protein whose panel is open. Other symbols refetch the next time the panel opens them.
5. Repaints.

`fallback.string.error` is in that same draft. Apply persists it. The policy takes effect on the next STRING failure. Apply still refetches, because Apply always refetches STRING and OmniPath. `keep-last-graph` cannot reconstruct a graph the previous failure already replaced with seeds; it only changes the next failure.

`fallback.role.uncached` is `commit: immediate`. It repaints and uses the existing preference debounce. It does not wait for Apply.

Display rows with `commit: immediate` repaint on change and save on the same debounce. They do not refetch.

Operator rows have no Apply and no draft.

Reset group restores code defaults for every preference-backed descriptor in that group and commits them immediately (a source-group reset refetches; a display-group reset repaints; a view-group reset updates the disc controls). Reset all does that for every preference-backed descriptor, including zeta, bloom, selected pathways, context, and visual mode, then refetches and repaints. Operator rows are unchanged by either reset. After Reset all, visual mode is `chronos` and context is `pan-cancer`.

## Registry tables

Columns: `commit` is `apply`, `immediate`, or `readonly`. `effect` is `refetch`, `repaint`, `rebuild+restart`, or `nothing`. `legend` and `export` are `yes` or `no`. Storage words are the four allowed stores.

Preference-backed rows resolve stored over code default. Readonly rows with storage `code default` have effective value equal to the default.

### Sources

Kind `source` for every row in this section. Group `Sources`.

| id | label | default | storage | commit | effect | legend | export |
|---|---|---|---|---|---|---|---|
| `source.string.networkUrl` | STRING network URL | `https://string-db.org/api/json/network` | code default | readonly | nothing | no | no |
| `source.string.partnersUrl` | STRING interaction-partners URL | `https://string-db.org/api/json/interaction_partners` | code default | readonly | nothing | no | no |
| `source.string.identifierDelimiter` | STRING network identifier delimiter | CR (`\r`) between seed symbols. The partner request sends one symbol and does not use this delimiter | code default | readonly | nothing | no | no |
| `source.string.species` | STRING species | `9606`. Both the network request and the partner request send this effective value | code default, user preference | apply | refetch | yes | yes |
| `source.string.requiredScore` | STRING network score cutoff | `700` on the 0–1000 scale. Query `required_score` | code default, user preference | apply | refetch | yes | yes |
| `source.string.partnerScore` | STRING partner score cutoff | `800`. Query `required_score` on the partner request | code default, user preference | apply | refetch | yes | yes |
| `source.string.networkLimit` | STRING network node limit | `25`. Degree prune after the network response | code default, user preference | apply | refetch | yes | yes |
| `source.string.partnerLimit` | STRING partner default limit | `10`. Argument default of `fetchInteractors` when the caller omits a limit | code default, user preference | apply | refetch | yes | yes |
| `source.string.expandLimit` | STRING expand limit | `15`. The value `handleExpandNetwork` sends | code default, user preference | apply | refetch | yes | yes |
| `source.string.scoreScale` | STRING score scale | Combined score is 0–1000. API values in 0–1 are multiplied by 1000 and rounded. Values already above 1 are rounded as 0–1000. See `fallback.string.invalidScore` for a non-numeric score | code default | readonly | nothing | yes | yes |
| `source.string.initialSeeds` | Starter pathway membership | `RAS_MAPK`: KRAS, RAF1, MAPK1. `PI3K_AKT`: PIK3CA, AKT1, PTEN. `Cell_Cycle`: TP53, RB1, CDK4. `Apoptosis`: BAX, BCL2, CASP3. `Angiogenesis`: VEGFA, KDR, HIF1A | code default, user preference | apply | refetch | no | yes |
| `source.omnipath.host` | OmniPath host | `https://omnipathdb.org/interactions` | code default | readonly | nothing | no | no |
| `source.omnipath.proxyPath` | OmniPath proxy | `GET /api/omnipath` with query `partners`. Same-origin. Empty `partners` is HTTP 400, not signs-off and not an empty biological result. A partner that fails `^[A-Za-z0-9-]+$` is HTTP 400. Upstream failure returns 502 and the message the legend shows | code default | readonly | nothing | no | no |
| `source.omnipath.genesymbols` | OmniPath genesymbols flag | `1` | code default | readonly | nothing | no | no |
| `source.omnipath.format` | OmniPath format | `json` | code default | readonly | nothing | no | no |
| `source.omnipath.datasets` | OmniPath datasets | `omnipath`, `pathwayextra`, `kinaseextra`, `ligrecextra`. Editor is a subset of those four. Empty selection is labeled `signs off` | code default, user preference | apply | refetch | yes | yes |
| `source.omnipath.endpointFilter` | OmniPath row filter | Keep a row only when both endpoints are in the requested partner set. Stimulation and inhibition come from that row’s flags | code default | readonly | nothing | no | no |
| `source.mygene.url` | MyGene URL | `https://mygene.info/v3/query` with `q=symbol:{UPPER}`. Species and fields are the next two rows | code default | readonly | nothing | no | no |
| `source.mygene.species` | MyGene species | `human`. The protein-panel badge reads `source.string.species` for the taxon line and this value for the MyGene query. It does not hard-code `HUMAN [9606]` | code default | readonly | nothing | yes | no |
| `source.mygene.fields` | MyGene fields | `go`, `name`, `summary`, `disease`, `pharos`, `pathway`, `interpro`. `pharos` is requested and is not rendered. The panel must not present a Pharos section | code default, user preference | apply | refetch | no | no |
| `source.mygene.roleInference` | MyGene role heuristic | On a successful hit for a symbol that is not one of the 18 curated genes, the summary text is classified as `tumor_suppressor`, `oncogene`, or `unknown`. Pathways become `"{KEY} Pathway"` from the MyGene pathway object. Name is the hit name, or the symbol when the hit has no name. This heuristic does not invent DepMap numbers, drugs, or binding sites | code default | readonly | nothing | no | no |
| `source.depmap.panCancerId` | Pan-cancer context id | `pan-cancer` | code default, cache file | readonly | rebuild+restart | no | no |
| `source.depmap.panCancerLabel` | Pan-cancer context label | `Pan-cancer (all profiled cell lines)` | code default, cache file | readonly | rebuild+restart | yes | yes |
| `source.depmap.geneHeaderPattern` | DepMap gene header parser | `^([A-Za-z][A-Za-z0-9-]*?)(?:\s+\(|$)`, then uppercase | code default | readonly | rebuild+restart | no | no |
| `source.depmap.geneJoin` | Gene join | Exact HGNC. Uppercase and trim. No alias map | code default | readonly | nothing | no | no |
| `source.depmap.missingCell` | DepMap empty cell | `NA`, `NAN`, and empty cells are null and are excluded from means | code default | readonly | nothing | no | no |
| `source.contextsRoute` | Contexts route | `GET /api/contexts`. No cache: 503 with the cache-missing sentence. Effective value in the drawer includes the loaded context count when the cache is loaded | code default, cache file | readonly | nothing | no | no |
| `source.measurementsRoute` | Measurements route | `GET /api/measurements` requires `context` and comma-separated `genes`. Missing context: 400. Unknown context: 400. No cache: 503. A gene missing from the release: null in the map (`fallback.depmap.geneAbsent`) | code default, cache file | readonly | nothing | no | no |

`source.depmap.panCancerId` and `source.depmap.panCancerLabel` are the cache’s pan-cancer identity. Lineage context ids are not descriptors: they are the distinct `OncotreeLineage` strings written into the cache. The drawer shows them as the effective list on `source.contextsRoute`, and the disc selector still chooses one. `view.context` is the choice.

`source.string.initialSeeds` is the starter membership. The disc checkboxes (`view.selectedPathways`) choose which of those pathways are active. An expanded hub still uses the protein symbol as its pathway key. That key is action-driven and is not a member of `initialSeeds`.

Export of `source.string.initialSeeds` is the applied map, so a reader can see which starter set produced the graph. The on-disc legend does not print the gene lists. `source.depmap.panCancerLabel` is repeated only as the context label when that context is selected (`view.context` / export `context.label`). `source.string.scoreScale` is repeated as the clause that the cutoffs are on 0–1000.

### Local fallbacks

Group `Local fallbacks`. Kind is `fallback-policy` except `local.curated.table`, whose kind is `source` because it is local text, not a failure switch. The drawer still places it in this group.

| id | label | default | storage | commit | effect | legend | export |
|---|---|---|---|---|---|---|---|
| `fallback.string.error` | STRING error | `seeds-no-edges`. Alternative `keep-last-graph`. Either value shows the STRING error in the status and the legend. Neither value uses `STRING API Active` | code default, user preference | apply | nothing | yes | yes |
| `fallback.mygene.error` | MyGene error | The panel shows `MyGene request failed` and does not use the success summary. If the symbol is one of the 18, curated identity fields may still appear under `Curated note`. Otherwise the summary is empty. The role badge says `Unknown`, not `Molecular Target`, and it has no biological sentence. `druggable` is false. No DepMap number | code default | readonly | nothing | yes | no |
| `fallback.depmap.cacheMissing` | DepMap cache missing | Error sentence `DepMap cache is not built. Run npm run cache-depmap.` HTTP 503 on `/api/contexts` and `/api/measurements`. Disc uses `display.missingColor`. Provenance token `cache not built` | code default | readonly | nothing | yes | no |
| `fallback.depmap.geneAbsent` | Gene absent from release | Null Chronos mean, null expression mean, `n = 0`, missing color. Sentence `Genes absent from this DepMap release stay neutral.` Not an error. Export uses the same nulls | code default | readonly | nothing | yes | no |
| `fallback.role.uncached` | Uncached role color | `hash`. Alternative `missing`. See below | code default, user preference | immediate | repaint | no | yes |
| `fallback.omnipath.error` | OmniPath error | Show the error caption. Draw the STRING edges with no signs. Do not relabel the error as “no interactions” | code default | readonly | nothing | yes | no |
| `fallback.role.druggableDefault` | Druggable before details load | `false` | code default | readonly | nothing | no | no |
| `fallback.layout.centrality` | Missing pathway centrality | Pathway node uses `0.5` when its centrality is missing. The max uses `1.0` when it would otherwise be missing | code default | readonly | nothing | no | no |
| `fallback.layout.betweenness` | Missing betweenness | A missing betweenness value is `0`. A one-node graph uses `{ [node]: 1.0 }` | code default | readonly | nothing | no | no |
| `fallback.context.unknownLabel` | Unknown context label | When the selected id is not in the loaded context list, the label is `source.depmap.panCancerLabel` | code default | readonly | nothing | yes | yes |
| `fallback.string.invalidScore` | Non-numeric STRING score | A score that is not a finite number, or is negative, is not published as `0`. The tooltip says `STRING score invalid`. The JSON `stringScore` is `null`. Stroke width may use the floor of `display.edges.width` so the edge still draws. This is a bad field inside a successful response, not a substitute for a failed request | code default | readonly | nothing | no | yes |
| `local.curated.table` | Curated note source | The 18 symbols in `src/lib/cancerData.ts`: KRAS, RAF1, MAPK1, PIK3CA, AKT1, PTEN, TP53, RB1, CDK4, BAX, BCL2, CASP3, VEGFA, KDR, HIF1A, BRAF, EGFR, MYC. On a successful MyGene response, curated `role`, `roleDescription`, druggability, binding sites, and pathways override the heuristic. MyGene still supplies `go`, `disease`, and, when present, `name` and `summary`. The `depMap` property on those records is unused | code default | readonly | nothing | no | no |

`fallback.string.error` values:

| Value | Behavior |
|---|---|
| `seeds-no-edges` (default) | The catch path returns the input symbols truncated to the effective network limit, and edges `[]`. The status and the legend say the STRING request failed. They do not say `STRING API Active` |
| `keep-last-graph` | Keep the last successful graph for that pathway. The status and the legend say the STRING request failed and that the drawn graph is the previous success. There is still no local edge score |

`fallback.role.uncached` values. The trigger is the current branch in `getProteinColorCat`: the symbol has no loaded details. A loaded role that is neither tumor suppressor, nor oncogene, nor druggable stays on `display.roles.categoryMap` (amber). This enum does not change that branch.

| Value | Behavior |
|---|---|
| `hash` (default) | `hashString(symbol) % 4` maps 0 azure, 1 mint, 2 amber, 3 slate, using `display.roles.palette` |
| `missing` | `display.missingColor` |

`hashString` stays the current 32-bit `Math.abs` implementation in `src/lib/math.ts`. The function is not a descriptor. The policy is.

Legend and export repeat a non-default fallback id when that policy changed a result. A STRING failure always prints the error, including when the policy is still `seeds-no-edges`. The roles caption always says whether unloaded symbols are hash placeholders or the missing color, including when the policy is still `hash`. Fixed policies are already the legend’s ordinary captions (cache missing, gene absent, OmniPath error), so their `export` flag is `no` and their words are the caption text, not an extra policy id. `fallback.context.unknownLabel` is `export: yes` because `context.label` in the JSON must be the label the disc showed, including this fallback.

`local.curated.table` is not editable text. Hiding the note is `view.curatedNoteVisible`. Hiding removes the `Curated note` block (`roleDescription`, druggability, binding sites). The role badge and the `Canonical Biological Pathways` tags stay. Those tags are labeled as curated or MyGene pathway names, not as a DepMap or Pharos query.

### Display

Kind `display`. Group `Display`. Immediate rows repaint and persist. Readonly rows are shown so a later feature can set `editable` without a panel edit. Call sites read the registry so the literal is not copied into `App.tsx`.

| id | label | default | storage | commit | effect | legend | export |
|---|---|---|---|---|---|---|---|
| `display.missingColor` | Missing measurement color | `#334155` | code default, user preference | immediate | repaint | yes | no |
| `display.chronos.domain` | Chronos color domain | `[-2, -0.5, 0, 0.5]` | code default, user preference | immediate | repaint | yes | no |
| `display.chronos.range` | Chronos color range | `#e11d48`, `#fb7185`, `#64748b`, `#38bdf8` | code default, user preference | immediate | repaint | yes | no |
| `display.chronos.clamp` | Chronos scale clamp | `true` | code default, user preference | immediate | repaint | yes | no |
| `display.expression.domain` | Expression color domain | `[0, 5, 10]` | code default, user preference | immediate | repaint | yes | no |
| `display.expression.range` | Expression color range | `#0f172a`, `#22d3ee`, `#f8fafc` | code default, user preference | immediate | repaint | yes | no |
| `display.expression.clamp` | Expression scale clamp | `true` | code default, user preference | immediate | repaint | yes | no |
| `display.chronos.caption` | Chronos caption | `Mean Chronos gene effect in {contextLabel}. More negative means stronger dependency. n is the number of cell lines with a score.` When `display.chronos.clamp` is true, append `Display clamped to [{domain0}, {domainLast}].` When it is false, append `Display domain is [{domain0}, {domainLast}], not clamped.` The numbers come from `display.chronos.domain` | code default | readonly | repaint | yes | no |
| `display.expression.caption` | Expression caption | `Mean log2(TPM+1) in {contextLabel}. The DepMap file is already log-transformed.` When `display.expression.clamp` is true, append `Display clamped to {domain0}–{domainLast}.` When it is false, append `Display domain is {domain0} to {domainLast}, not clamped.` The numbers come from `display.expression.domain` | code default | readonly | repaint | yes | no |
| `display.roles.caption` | Roles caption | `Curated role colors. These are annotations, not a DepMap measurement.` Always append the effective `fallback.role.uncached` sentence: hash placeholders are not curated roles, or unloaded symbols use the missing color | code default | readonly | repaint | yes | no |
| `display.legend.titles` | Legend titles | Chronos: `Mean Chronos`. Expression: `Mean expression`. Roles: `Curated roles` | code default | readonly | repaint | yes | no |
| `display.panel.depmapHeading` | Protein-panel DepMap heading | `DepMap measurements`. Values under it are the cache means, or the word from `display.panel.missingToken` | code default | readonly | nothing | no | no |
| `display.panel.pathwayHeadings` | Pathway headings | `Pathways & Systems`. `Active Poincaré Networks:`. `Canonical Biological Pathways:` (at most five tags) | code default | readonly | nothing | no | no |
| `display.panel.roleBadges` | Role badge styles | Oncogene, Tumor Suppressor, Essential Regulator, Context-Dependent, and Unknown. Unknown has no biological sentence. The old `Molecular Target` label is retired. Classes stay the current Tailwind set in `ProteinInfoPanel.tsx` (`roleColors`) except that unknown copy | code default | readonly | nothing | no | no |
| `display.panel.missingToken` | Panel missing mean | `missing` | code default | readonly | nothing | no | no |
| `display.roles.categoryMap` | Loaded role colors | `tumor_suppressor` → azure. `oncogene` → crimson. Else if `druggable` → mint. Else amber. Uses `display.roles.palette` | code default | readonly | repaint | no | no |
| `display.roles.palette` | Role palette | azure `#00B2FF`, mint `#00FFC2`, amber `#EAB308`, crimson `#E11D48`, slate `#475569` | code default, user preference | immediate | repaint | yes | no |
| `display.layout.secondaryAngle` | Secondary layout angle | `phi = (hashString(symbol) % 1000 / 1000) * 2π` | code default | readonly | nothing | no | no |
| `display.edges.gradientPairs` | Edge gradient pairs | azure–mint, azure–amber, mint–amber, azure–azure, mint–mint, amber–amber, crimson–amber, crimson–azure, slate–slate. Colors come from the palette | code default | readonly | repaint | no | no |
| `display.search.highlight` | Search highlight colors | `#38bdf8`, `#22d3ee`, `#0ea5e9`, `#06b6d4` | code default, user preference | immediate | repaint | no | no |
| `display.hub.colors` | Pathway hub colors | Fill `rgba(225,29,72,0.15)`, stroke `#e11d48`, bloom `#fde047`, highlight `#38bdf8` | code default, user preference | immediate | repaint | no | no |
| `display.edges.width` | Edge width | `0.6 + (clamp(score, 0, 1000) / 1000) * 2.4`, about 0.6–3.0. The clamp ends are `source.string.scoreScale` | code default | readonly | repaint | no | no |
| `display.edges.searchWidth` | Search edge width | `max(2.5, scoreWidth)` | code default | readonly | repaint | no | no |
| `display.edges.defaultStroke` | Edge stroke without a sign | `#475569`, or the gradient of the endpoint role categories | code default, user preference | immediate | repaint | no | no |
| `display.edges.opacity` | Edge opacity | Search `0.95`. Active focus `0.7` / `0.05`. Otherwise `0.3` | code default | readonly | repaint | no | no |
| `display.edges.tooltip` | Edge tooltip | `{u}–{v} · {pathway} · STRING score {score} · OmniPath {regulation}`. An invalid score uses the words from `fallback.string.invalidScore`, not `0` | code default | readonly | nothing | no | no |
| `display.status.string` | STRING status copy | Loading: `Querying STRING...` Success: `STRING API Active`. Failure: the error text from `fallback.string.error`, which replaces the success line for both the network request and `fetchInteractors` | code default | readonly | nothing | no | no |
| `display.signs.stimulation` | Stimulation color | `#34d399`, solid | code default, user preference | immediate | repaint | yes | no |
| `display.signs.inhibition` | Inhibition color | `#fb7185`, dash `2,2` | code default, user preference | immediate | repaint | yes | no |
| `display.signs.both` | Both-sign color | `#c084fc`, dash `4,3` | code default, user preference | immediate | repaint | yes | no |
| `display.signs.legend` | Sign legend line | Loading: `Loading OmniPath signs...` Success: `OmniPath signs on {signed} of {total} STRING edges.` Signs off: `OmniPath signs off`. The error line is `fallback.omnipath.error`, not this template | code default | readonly | repaint | yes | no |
| `display.layout.radius` | Disc radius | `400` | code default | readonly | nothing | no | no |
| `display.layout.secondaryShell` | Secondary shell | `R_i = min(0.25, localScale * log(n+2))`. `localScale = 0.22 * bloomScale`, or `0.22` when bloom is off | code default | readonly | repaint | no | no |
| `display.layout.boundaryClamp` | Poincaré boundary | Scale to `0.99` when `\|z\| >= 1` | code default | readonly | nothing | no | no |
| `display.layout.pathwayNodeSize` | Pathway node size | `22 + 28 * centrality` | code default | readonly | nothing | no | no |
| `display.layout.secondaryNodeSize` | Secondary node size | Druggable `14`. Otherwise `max(9, 6 + hover)` | code default | readonly | nothing | no | no |
| `display.layout.centralDegree` | Central-node degree | Degree greater than `4` | code default | readonly | nothing | no | no |
| `display.layout.zoom` | Zoom extent | `[0.5, 10]` | code default | readonly | nothing | no | no |
| `display.layout.grid` | Grid and horizon color | `#22d3ee` at the current opacities (rings `0.05`, spokes `0.03`) | code default, user preference | immediate | repaint | no | no |
| `display.layout.background` | Canvas background | `#07090E` | code default, user preference | immediate | repaint | no | no |
| `display.export.pngScale` | PNG pixel scale | `2` | code default | readonly | nothing | no | no |
| `display.search.miss` | Gene search miss | `Gene not found: "{query}". Try KRAS, TP53, PIK3CA, CDK4, etc.` | code default | readonly | nothing | no | no |
| `display.auth.errors` | Auth error text | `Signup failed`. `Login failed` | code default | readonly | nothing | no | no |

The sign colors are drawn in the on-disc legend (stimulation, inhibition, both). That closes the current gap where those colors are painted on edges and omitted from the key. When datasets are empty, the key is replaced by `OmniPath signs off`.

Caption templates do not store a second copy of `[-2, 0.5]` or `0–10`. The renderer interpolates the domain descriptor.

### View

Kind `view`. Group `View`. The first five are the disc controls. The drawer inspects them.

| id | label | default | storage | commit | effect | legend | export |
|---|---|---|---|---|---|---|---|
| `view.zeta` | Zeta | `1.0`. Bounds live on `view.zetaBounds` | code default, user preference | immediate | repaint | no | no |
| `view.bloomScale` | Bloom | `1.8`. Bounds live on `view.bloomBounds` | code default, user preference | immediate | repaint | no | no |
| `view.zetaBounds` | Zeta slider bounds | min `0.5`, max `2.5`, step `0.1` | code default | readonly | nothing | no | no |
| `view.bloomBounds` | Bloom slider bounds | min `1.0`, max `3.5`, step `0.2` | code default | readonly | nothing | no | no |
| `view.selectedPathways` | Active starter pathways | All keys of `source.string.initialSeeds` | code default, user preference | immediate | refetch | no | no |
| `view.context` | DepMap context | The value of `source.depmap.panCancerId` (`pan-cancer`). Not a second literal | code default, user preference | immediate | refetch | yes | yes |
| `view.visualMode` | Color mode | `chronos` | code default, user preference | immediate | repaint | yes | yes |
| `view.curatedNoteVisible` | Curated note | `true` (the note is shown). `false` hides the `Curated note` block only | code default, user preference | immediate | repaint | no | no |

`view.context` and `view.visualMode` stay on their disc controls (`commit: immediate` describes the disc, which already saves them). The drawer does not duplicate those controls. Reset group / Reset all may still restore their defaults, and the disc updates from the preference document.

`view.selectedPathways` refetches the graphs that the checkbox change already refetches today. `view.context` refetches measurements. `view.visualMode` repaints and does not refetch.

Opening the app, before a preference document loads, uses these defaults. The first color mode is Chronos.

### Operator

Kind `operator`. Group `Operator`. `commit` is `readonly` for every row. No Apply. The drawer shows the change command in the row. `effect` names what that command requires. The effective value comes from `GET /api/operator`.

| id | label | default / effective | storage | effect | change command | legend | export |
|---|---|---|---|---|---|---|---|
| `operator.jwtSecret` | JWT secret | Effective `present` or `absent`. Never the secret. Startup throws when the env var is missing | env | rebuild+restart | Set `JWT_SECRET` in `.env` and restart the server. Existing cookies become invalid | no | no |
| `operator.host` | Listen host | `127.0.0.1` when `HOST` is unset | env | rebuild+restart | Set `HOST` and restart. `0.0.0.0` binds all interfaces | no | no |
| `operator.port` | Listen port | `3000` when `PORT` is unset or not numeric | env | rebuild+restart | Set `PORT` and restart | no | no |
| `operator.nodeEnv` | Node environment | `unset` in dev. `production` turns on `cookieSecure` and serves `dist` instead of the Vite middleware | env | rebuild+restart | Set `NODE_ENV` and restart. Production also needs a frontend build | no | no |
| `operator.depmapRelease` | DepMap release | Effective value is the cache file’s `release`, or `null` with the cache-missing sentence. Also show `DEPMAP_RELEASE` from the environment when this process has it. The disc uses the cache field. Example env value in `.env.example` is `DepMap Public 24Q4` | env, cache file | rebuild+restart | Set `DEPMAP_RELEASE`, run `npm run cache-depmap`, restart the server | yes | yes |
| `operator.geminiApiKey` | Gemini API key | `unused`. The Vite define may still inject `process.env.GEMINI_API_KEY`. No client reads it | env | nothing | Leave it unwired. Do not add a Gemini client | no | no |
| `operator.appUrl` | App URL | `unused`. Present only as a placeholder in `.env.example`. No scoped code reads it | env | nothing | None until a future descriptor wires it | no | no |
| `operator.disableHmr` | Vite HMR flag | `unset` (HMR on). `true` disables HMR | env | rebuild+restart | Set `DISABLE_HMR` and restart the dev server. Not a scientific input | no | no |
| `operator.listenUrl` | Listen URL | `http://{host}:{port}` | env | rebuild+restart | Change `HOST` or `PORT` and restart | no | no |
| `operator.databasePath` | Preference store | `./database.json` | code default | rebuild+restart | Change the path in the registry default and restart. A missing file is recreated empty | no | no |
| `operator.measurementCachePath` | DepMap cache path | `data/cache/measurements.json` (cwd-relative). The build script writes this path and the server loads it. One registry default, not two strings | cache file | rebuild+restart | Run `npm run cache-depmap`, then restart | no | no |
| `operator.cacheLoaded` | DepMap cache loaded | `true` or `false` from the startup read of `operator.measurementCachePath` | cache file | rebuild+restart | Same command as the cache path. `false` uses `fallback.depmap.cacheMissing` | yes | no |
| `operator.depmapSourceFiles` | DepMap source CSVs | `data/depmap/Model.csv`, `data/depmap/CRISPRGeneEffect.csv`, `data/depmap/OmicsExpressionProteinCodingGenesTPMLogp1.csv` | code default | rebuild+restart | Replace the files and run `npm run cache-depmap`. Schema failure is `MeasurementSchemaError` at build time | no | no |
| `operator.cookieName` | Auth cookie name | `token` | code default | rebuild+restart | Change the registry default and restart. Users log in again | no | no |
| `operator.cookieHttpOnly` | Cookie HttpOnly | `true` | code default | rebuild+restart | Change the registry default and restart | no | no |
| `operator.cookieSameSite` | Cookie SameSite | `lax` | code default | rebuild+restart | Change the registry default and restart | no | no |
| `operator.cookieSecure` | Cookie Secure | `true` when `operator.nodeEnv` is `production`, otherwise `false` | code default, env | rebuild+restart | Change `NODE_ENV` and restart | no | no |
| `operator.jwtExpiresIn` | JWT lifetime | `24h` | code default | rebuild+restart | Change the registry default and restart | no | no |
| `operator.authRoutes` | Auth routes | `/api/signup`, `/api/login`, `/api/logout`, `/api/me`, `/api/preferences` | code default | nothing | A path change is a code change in the registry and in `src/lib/auth.ts` callers, then a restart | no | no |
| `operator.dotenvOrder` | Env file order | `dotenv.config()` then `dotenv.config({ path: ".env.local", override: true })` in `server.ts` and in `scripts/build-depmap-cache.ts` | code default | rebuild+restart | Restart after editing env files. The cache script reads env only when it runs | no | no |
| `operator.depmapModelColumns` | Model.csv columns | `ModelID`, `OncotreeLineage` | code default | rebuild+restart | A column change is a registry default change plus `npm run cache-depmap` | no | no |
| `operator.depmapMatrixLabels` | Matrix names in build errors | `CRISPR gene effect`, `expression` | code default | rebuild+restart | Change the registry default and rebuild the cache | no | no |

`operator.depmapRelease` is the release the legend and the JSON `depmapRelease` field use when the cache is loaded. When the cache is missing, the legend prints `cache not built` and the JSON field is `null`. A loaded cache whose `release` field is empty prints `release unavailable`. The token `unavailable` is not used. Do not fill any of these tokens from curated Chronos.

## Export and legend contract

One function builds the legend lines from the effective settings. `src/App.tsx` uses it for the on-disc overlay and for the PNG stamp. `buildViewExport` in `src/lib/exportView.ts` receives the same effective snapshot. Delete the independent constants `STRING_SPECIES` and `STRING_REQUIRED_SCORE`. `OMNIPATH_DATASETS` remains only as the allow-list inside the registry (the four names). The request and the export use the effective subset.

### Legend lines, in order

1. Title from `display.legend.titles` for `view.visualMode`.
2. The matching caption template, with domain numbers taken from the domain descriptor.
3. Provenance: `DepMap {release or cache not built or release unavailable} · {context label} · STRING {species} (MyGene {mygeneSpecies}), combined score ≥ {requiredScore} (partners ≥ {partnerScore}, partner limit {partnerLimit}, expand limit {expandLimit}, network limit {networkLimit}), scale 0–1000`. The color bar under a Chronos or expression caption is `display.chronos.range` or `display.expression.range`, plus a swatch of `display.missingColor`. The roles caption names `display.roles.palette` only by the words already in `display.roles.caption`; it does not print hex codes.
4. OmniPath: the dataset list, or `OmniPath signs off`, or the error caption, or the loading line, or `OmniPath signs on {signed} of {total} STRING edges.`
5. When datasets are non-empty, the stimulation, inhibition, and both color key.
6. The STRING error line whenever the last STRING request failed, including when `fallback.string.error` is still the default. The roles caption always states the uncached-role policy, so line 6 does not wait for a non-default role policy.
7. The missing-gene sentence when there is no measurement error. The cache-missing sentence when the cache is not loaded. These two sentences are never shown as the same state. The word `unavailable` is retired. A missing cache says `cache not built`. A loaded cache with an empty `release` says `release unavailable`.

### PNG stamp

`POINCARÉ DISC • {visualMode} • {context label} • STRING {species} score≥{requiredScore} partners≥{partnerScore} • DepMap {release or cache not built} • {date}`

The stamp is a one-line title. The PNG also captures the on-disc legend, so network limit, partner limit, expand limit, and the OmniPath dataset list are in the image as legend lines rather than repeated on the stamp. The stamp itself reads the snapshot and includes species, both score cutoffs, context, release token, and date. A change to species or the network cutoff changes the next stamp.

### JSON fields that follow the registry

Add these to `ViewExport` and fill them from the snapshot. Existing node measurements stay the cache means, looked up by exact symbol then uppercase, with `fallback.depmap.geneAbsent` (`emptyMeasurement`: null means, `n = 0`) when the key is missing.

| Field | Source id |
|---|---|
| `string.species` | `source.string.species` |
| `string.requiredScore` | `source.string.requiredScore` |
| `string.partnerScore` | `source.string.partnerScore` |
| `string.networkLimit` | `source.string.networkLimit` |
| `string.partnerLimit` | `source.string.partnerLimit` |
| `string.expandLimit` | `source.string.expandLimit` |
| `string.scoreScale` | `source.string.scoreScale` (`{ "min": 0, "max": 1000 }`) |
| `string.initialSeeds` | `source.string.initialSeeds` |
| `omnipath.datasets` | `source.omnipath.datasets` |
| `depmapRelease` | `operator.depmapRelease` cache field, or `null` |
| `context` | `view.context` plus the label actually shown |
| `visualMode` | `view.visualMode` |
| `fallbacks` | Only ids whose effective value is not the default. At minimum the keys are `fallback.string.error` and `fallback.role.uncached` when they differ |

Per-edge `stringScore` and OmniPath sign flags stay. `omnipath.error` stays the error string or `null`. Signs-off exports `datasets: []` and `error: null`.

No exported field is read from `syntheticExpressionLevel` or from `CURATED_CANCER_GENES[].depMap`.

## Files that change when this is implemented

| File | Change |
|---|---|
| `src/lib/settingsRegistry.ts` | New. The descriptor list, `defaultPreferences()`, validation shared with the server, legend-field ids, export-field ids |
| `src/components/SettingsPanel.tsx` | New. Renders the registry. No second field list |
| `src/App.tsx` | Gear button before JSON. Drawer host. Disc color, width, status, and layout read descriptors. Legend and PNG stamp use the snapshot. Expand sends `stringExpandLimit`. Passes the snapshot into fetch and export |
| `src/lib/auth.ts` | `Preferences` gains the keys in the persistence table |
| `server.ts` | Signup and GET use `defaultPreferences()`. POST validates with the registry. `GET /api/operator`. Cookie and path constants read from the registry |
| `src/lib/scienceRoutes.ts` | `/api/omnipath` accepts `datasets`, rejects any name outside the four, and allows an empty set to be handled by the client by not calling. Cache-missing copy stays the registry sentence |
| `src/lib/omnipath.ts` | Upstream URL, `genesymbols`, `format`, and the dataset allow-list come from the registry. The request sends the effective subset |
| `src/lib/api.ts` | `fetchStringNetwork`, `fetchInteractors`, and `fetchProteinDetails` take the effective species, scores, limits, and MyGene fields. `INITIAL_SEEDS` is re-exported from the registry. The STRING catch path follows `fallback.string.error`. The MyGene catch path follows `fallback.mygene.error` and still does not copy `depMap` |
| `src/lib/measurements.ts` | Pan-cancer id and label, header pattern, and the missing-cell rule are imported from the registry |
| `scripts/build-depmap-cache.ts` | Cache path, CSV paths, and matrix labels come from the registry. `DEPMAP_RELEASE` remains required in the environment |
| `src/lib/exportView.ts` | `buildViewExport` takes the snapshot. Remove the parallel STRING constants |
| `src/components/ProteinInfoPanel.tsx` | `Curated note` obeys `view.curatedNoteVisible`. DepMap section still shows cache means only |
| `tests/exportView.test.ts` | Expect the snapshot fields, not a hard-coded 700 |
| `tests/settingsRegistry.test.ts` | New. Every descriptor id is unique. Preference keys match `storage`. A fixture descriptor appended to the array is returned by the group iterator the panel uses |

`src/lib/simulation.ts` is not modified and is not imported. `.env` and `.env.example` gain no gear keys. `GEMINI_API_KEY` stays a Vite define with no reader.

## Acceptance checks

An implementer can run these against the running app and the registry module.

1. The gear is in the header cluster, immediately before JSON. Context, color mode, zeta, and bloom are still on the disc. Opening the drawer leaves visual mode at its current value. A fresh signup is Chronos.
2. The drawer sections are Sources, Local fallbacks, Display, View, Operator, in that order, and every section is produced by grouping the registry. `simulation` does not appear. No Gemini control appears. `operator.geminiApiKey` reads `unused`.
3. View rows for zeta, bloom, context, visual mode, and selected pathways show the disc’s effective value and the code default, and they do not contain a second slider or select.
4. Change the network cutoff, press Apply. The next request to `https://string-db.org/api/json/network` sends that `required_score`. The legend and the next PNG stamp show the same number. JSON `string.requiredScore` matches. The partner cutoff is a different field and still defaults to 800 until it is changed.
5. Change species, both limits, the expand limit, and the dataset set; Apply. The next STRING and OmniPath requests use those values. An empty dataset set does not call `/api/omnipath`, the legend says `OmniPath signs off`, and the export has `datasets: []` with `error: null`.
6. With the cache file absent, the disc shows the missing color, the copy is `DepMap cache is not built. Run npm run cache-depmap.`, and that state is not the gene-absent sentence. No curated Chronos value appears in the panel, the legend, or the JSON.
7. With the cache present, a symbol that is not in the release has null means, missing color, and `Genes absent from this DepMap release stay neutral.`
8. Force an OmniPath 502. The legend shows the error. STRING edges remain, without signs. The caption is not `no interactions`.
9. Force a STRING failure under the default policy. The pathway shows the seed nodes and no edges. Switch to `keep-last-graph`, Apply, and fail again. The previous successful graph remains and the error is visible.
10. A symbol whose details have not loaded uses the hash palette by default. Switching `fallback.role.uncached` to `missing` repaints those nodes with `#334155` without waiting for Apply. A loaded non-druggable `unknown` role stays amber.
11. JSON after Apply matches the applied species, both cutoffs, all three limits, datasets, release, context, and visual mode. `fallbacks` contains only policies that are not the default. The document has no field taken from `syntheticExpressionLevel` or `CURATED_CANCER_GENES[].depMap`.
12. Hide the curated note. The `Curated note` heading and its drug and binding-site text disappear. The role badge remains, and it is not labeled as DepMap or Pharos.
13. Append one descriptor to `SETTINGS` with an existing `control` and do not edit `SettingsPanel.tsx`. The new row appears in its group.
14. Operator rows show env or file names and the restart or `npm run cache-depmap` command. JWT is `present` or `absent` only. There is no control that writes `.env` or rebuilds the cache.
15. Reset all restores Chronos, pan-cancer, zeta `1.0`, bloom `1.8`, cutoffs 700 and 800, limits 25, 10, and 15, the four OmniPath datasets, and the five starter pathways, then refetches.
16. No simulation control is present. `src/lib/simulation.ts` has no new importers.

## Adding a setting

Add one object to `SETTINGS`. Give it an `id`, `label`, `group`, `kind`, `default`, `storage`, `commit`, `effect`, `legend`, `export`, and a `control` the panel already implements. If it is preference-backed, `defaultPreferences()` and the server validator pick it up from that object. Do not add a JSX field.

Legend and export stay opt-in. `legend: no` and `export: no` mean the on-disc legend, the PNG stamp, and the JSON snapshot ignore the value. Set either flag to `yes` only when a reader of that artifact must see the value. The flags are on the descriptor, not implied by the group.

Example, not one of the 113. A future signed-regulon source:

| Field | Value |
|---|---|
| `id` | `source.dorothea.confidence` |
| `label` | DoRothEA confidence letters |
| `group` | `Sources` |
| `kind` | `source` |
| `default` | `["A","B"]` |
| `storage` | `code default`, `user preference` |
| `commit` | `apply` |
| `effect` | `refetch` |
| `legend` | `yes` |
| `export` | `yes` |
| `control` | `dataset-set` |
| `editable` | `yes` |

`legend: yes` puts the effective letters on the provenance line. `export: yes` adds `dorothea.confidence` to the snapshot. Leaving either flag `no` would keep the value in the drawer only. That choice is written on the descriptor when the feature lands. The panel is not edited. This example is not implemented with the gear.

A future gene-alias map is the same shape in group `Local fallbacks`, default `{}`, so an empty map means the join stays exact HGNC. It is not added by this spec.

## Exclusions

These inventory rows are not registry entries.

| Item | Reason |
|---|---|
| `src/lib/simulation.ts` `BooleanNetwork`, `WINDOW_SIZE` 50, edge weights, random initial state, activation thresholds | The live app does not import the module. It stays out of the UI and out of the registry |
| `ALL_PATHWAYS` in `src/App.tsx` | Declared and unused. Do not surface it |
| Systems pathway list derived from loaded `secondaryGraphs` | Derived from loaded graphs plus `view.selectedPathways`, not a constant |
| Expand-hub pathway key equal to the protein symbol | Action result, not a constant. Documented under `source.string.initialSeeds` |
| `activeNodePathways` / search membership | Derived union of graph membership, starter seeds, and curated pathway tags |
| Preference-save debounce `1000` ms and OmniPath fetch debounce `1000` ms | Scheduling. Keep both at 1000 ms. Not data feeds |
| Fetch timeouts | No timeout constant exists. This spec does not add one |
| Vite `@` alias, package name `react-example`, `npm run dev` / `start`, `tsx --test`, Vite `loadEnv(mode, '.', '')` | Build and process launch. `loadEnv` is how Vite reads env for the unused Gemini define. It is not a second dotenv order beside `operator.dotenvOrder`, and it is not a scientific input |
| Lineage context ids and labels from `OncotreeLineage` | Rows in the cache, shown as the effective value of `source.contextsRoute` |
| Partner-request identifier shape (one symbol) | Request shape of `source.string.partnersUrl`, not a second delimiter |
| `CURATED_CANCER_GENES[].depMap` and any `syntheticExpressionLevel` | Must stay unread. A descriptor would invite a switch that replaces a missed measurement with a local number |
| The literal provenance string `STRING human 9606, combined score ≥ 700` and the PNG literal `STRING 9606 score≥700` | Removed as constants. The legend composer interpolates the registry |
| `hashString` implementation | The uncached-role policy names the behavior. The function stays in `src/lib/math.ts` |
| Primary-centrality `\|\| 1.0` / `\|\| 0.5` and betweenness `\|\| 0` as scattered expressions | Covered once by `fallback.layout.centrality` and `fallback.layout.betweenness`, not entered again as display constants |
| Cache output path as a second string beside the server load path | One entry, `operator.measurementCachePath` |
| Signup default block and GET fillers in `server.ts` | They become `defaultPreferences()`. Not a second set of entries beside the View defaults |

## Inventory crosswalk

Every row of the two inventories maps here.

### `context-apis.md`

| Inventory row | Entry |
|---|---|
| `JWT_SECRET` | `operator.jwtSecret` |
| `HOST` | `operator.host` |
| `PORT` | `operator.port` |
| `NODE_ENV` | `operator.nodeEnv` |
| `DEPMAP_RELEASE` | `operator.depmapRelease` |
| `GEMINI_API_KEY` | `operator.geminiApiKey` |
| `APP_URL` | `operator.appUrl` |
| `DISABLE_HMR` | `operator.disableHmr` |
| Listen URL | `operator.listenUrl` |
| `DB_FILE` `./database.json` | `operator.databasePath` |
| Measurement cache path | `operator.measurementCachePath` |
| DepMap source CSV paths | `operator.depmapSourceFiles` |
| Cache output path | `operator.measurementCachePath` (same file) |
| Vite `@` alias | Exclusions |
| `npm run dev` / `start` | Exclusions. Restart is the operator change command |
| `npm run cache-depmap` | Change command on the DepMap operator rows |
| Cookie name `token` | `operator.cookieName` |
| `httpOnly` | `operator.cookieHttpOnly` |
| `sameSite` `lax` | `operator.cookieSameSite` |
| `secure` | `operator.cookieSecure` |
| JWT `expiresIn` `24h` | `operator.jwtExpiresIn` |
| Default prefs `context` | `view.context` |
| Default prefs `visualMode` | `view.visualMode` |
| Auth API paths | `operator.authRoutes` |
| `GET /api/contexts` | `source.contextsRoute` |
| `GET /api/measurements` | `source.measurementsRoute` |
| `GET /api/omnipath` | `source.omnipath.proxyPath` |
| STRING network URL | `source.string.networkUrl` |
| STRING network identifiers `\r` | `source.string.identifierDelimiter` |
| STRING network species `9606` | `source.string.species` |
| STRING network `required_score` `700` | `source.string.requiredScore` |
| STRING network limit `25` | `source.string.networkLimit` |
| STRING partners URL | `source.string.partnersUrl` |
| STRING partners identifier (one symbol) | Exclusions, under `source.string.partnersUrl` |
| STRING partners species `9606` | `source.string.species` |
| STRING partners limit `10` | `source.string.partnerLimit` |
| STRING partners `required_score` `800` | `source.string.partnerScore` |
| `stringCombinedScore` 0–1 ×1000 | `source.string.scoreScale` and `fallback.string.invalidScore` |
| `INITIAL_SEEDS` | `source.string.initialSeeds` |
| OmniPath upstream URL | `source.omnipath.host` |
| OmniPath `genesymbols` `1` | `source.omnipath.genesymbols` |
| OmniPath `format` `json` | `source.omnipath.format` |
| OmniPath `partners` query | Request payload of `source.omnipath.proxyPath`, built from the visible symbols |
| OmniPath `datasets` | `source.omnipath.datasets` |
| OmniPath response filter | `source.omnipath.endpointFilter` |
| Browser `/api/omnipath` | `source.omnipath.proxyPath` |
| MyGene URL template | `source.mygene.url` |
| MyGene species `human` | `source.mygene.species` |
| MyGene fields | `source.mygene.fields` |
| Curated merge | `local.curated.table` |
| `PAN_CANCER_ID` | `source.depmap.panCancerId` |
| `PAN_CANCER_LABEL` | `source.depmap.panCancerLabel` |
| Oncotree lineage context ids | Exclusions. Effective list on `source.contextsRoute` |
| Model columns `ModelID`, `OncotreeLineage` | `operator.depmapModelColumns` |
| Matrix labels | `operator.depmapMatrixLabels` |
| Gene header regex | `source.depmap.geneHeaderPattern` |
| `queryMeasurements` uppercase | `source.depmap.geneJoin` |
| Package name, dev entry, test runner | Exclusions |
| No fetch timeout | Exclusions |

### `context-local.md`

| Inventory row | Entry |
|---|---|
| `BooleanNetwork` | Exclusions |
| `INITIAL_SEEDS` | `source.string.initialSeeds` |
| Client default `selectedPathways` | `view.selectedPathways` |
| Signup `selectedPathways` | `view.selectedPathways` via `defaultPreferences()` |
| `ALL_PATHWAYS` | Exclusions |
| Systems UI list from `hubNodes` | Exclusions |
| Expand hub pathway key | Exclusions |
| `activeNodePathways` | Exclusions |
| Panel headings | `display.panel.pathwayHeadings` |
| `Preferences` shape | Persistence section. Each field is a View or new preference key |
| Client zeta `1.0` | `view.zeta` |
| Client bloom `1.8` | `view.bloomScale` |
| Client context | `view.context` |
| Client visual mode | `view.visualMode` |
| Signup defaults for zeta, bloom, pathways, context, visual mode | Those View defaults, written by `defaultPreferences()` |
| GET fillers `pan-cancer` and `chronos` | Same defaults |
| Zeta slider bounds | `view.zetaBounds` |
| Bloom slider bounds | `view.bloomBounds` |
| Prefs debounce 1000 ms | Exclusions |
| Runtime cache path | `operator.measurementCachePath` |
| Build output path | `operator.measurementCachePath` |
| Source CSV paths | `operator.depmapSourceFiles` |
| `DEPMAP_RELEASE` | `operator.depmapRelease` |
| Missing cache message | `fallback.depmap.cacheMissing` |
| `PAN_CANCER_ID` / `PAN_CANCER_LABEL` | `source.depmap.panCancerId`, `source.depmap.panCancerLabel` |
| Lineage contexts | Exclusions |
| Gene column parsing | `source.depmap.geneHeaderPattern` |
| Missing numeric cells | `source.depmap.missingCell` |
| Unknown context / unknown gene | `source.measurementsRoute`, `fallback.depmap.geneAbsent` |
| `MISSING_MEASUREMENT_COLOR` `#334155` | `display.missingColor` |
| Chronos domain, range, clamp | `display.chronos.domain`, `display.chronos.range`, `display.chronos.clamp` |
| Expression domain, range, clamp | `display.expression.domain`, `display.expression.range`, `display.expression.clamp` |
| Legend titles | `display.legend.titles` |
| Chronos, expression, and roles captions | `display.chronos.caption`, `display.expression.caption`, `display.roles.caption` |
| Provenance line | Legend contract. Not a stored literal |
| Missing-gene copy | `fallback.depmap.geneAbsent` |
| Panel DepMap section | `display.panel.depmapHeading`, `display.panel.missingToken` |
| Role category map | `display.roles.categoryMap` |
| Uncached / unknown hash color | `fallback.role.uncached` |
| `COLOR_HEX` | `display.roles.palette` |
| `hashString` | Exclusions |
| Secondary layout angle | `display.layout.secondaryAngle` |
| `GRADIENT_PAIRS` | `display.edges.gradientPairs` |
| Search highlight colors | `display.search.highlight` |
| Pathway hub fill and stroke | `display.hub.colors` |
| `details.druggable` default `false` | `fallback.role.druggableDefault` |
| Panel role badges | `display.panel.roleBadges` |
| STRING species and export `STRING_SPECIES` | `source.string.species` |
| Network score and export `STRING_REQUIRED_SCORE` | `source.string.requiredScore` |
| Network limit 25 | `source.string.networkLimit` |
| Interactors default 10 and expand 15 | `source.string.partnerLimit`, `source.string.expandLimit` |
| Interactors score 800 | `source.string.partnerScore` |
| `stringCombinedScore` | `source.string.scoreScale` |
| STRING error fallback | `fallback.string.error` |
| Edge width formula | `display.edges.width` |
| Search edge width | `display.edges.searchWidth` |
| Default edge stroke | `display.edges.defaultStroke` |
| Edge opacity | `display.edges.opacity` |
| Edge tooltip | `display.edges.tooltip` |
| STRING status copy | `display.status.string` |
| PNG/JSON stamp literals | Legend contract and PNG stamp |
| `OMNIPATH_DATASETS` | `source.omnipath.datasets` |
| Stimulation, inhibition, both colors and dashes | `display.signs.stimulation`, `display.signs.inhibition`, `display.signs.both` |
| OmniPath debounce | Exclusions |
| Overlay legend lines | `display.signs.legend` and `fallback.omnipath.error` |
| Missing sign color key | Required legend key on the three sign descriptors |
| Disc radius, secondary shell, boundary clamp, node sizes, central degree, zoom, grid, background, PNG scale | The `display.layout.*` rows, `display.layout.grid`, `display.layout.background`, `display.export.pngScale` |
| Primary centrality fallback | `fallback.layout.centrality` |
| Curated role, role description, druggability, binding sites, pathways, name | `local.curated.table` and `view.curatedNoteVisible` |
| Curated `depMap` block | Exclusions. Stays unused |
| `generateFallbackGeneData` role, pathways, name | `source.mygene.roleInference` |
| Explicit non-generation of DepMap, drugs, and sites for uncurated genes | `source.mygene.roleInference` and `fallback.mygene.error` |
| `uncuratedDetails` | `fallback.mygene.error` and `fallback.role.druggableDefault` |
| MyGene fields including unmapped `pharos` | `source.mygene.fields` |
| Summary fallback to `roleDescription` | `local.curated.table` |
| MyGene failure plus curated | `fallback.mygene.error` |
| `emptyMeasurement` | `fallback.depmap.geneAbsent` |
| Export measurement lookup by uppercase | `source.depmap.geneJoin` |
| Omnipath block in export | Export contract |
| `contextLabel` fallback | `fallback.context.unknownLabel` |
| `depmapRelease` display tokens | `operator.depmapRelease` and `fallback.depmap.cacheMissing` |
| Gene search miss | `display.search.miss` |
| `bet[u] \|\| 0` and single-node betweenness | `fallback.layout.betweenness` |
| Auth error strings | `display.auth.errors` |
| JWT / HOST / PORT | Operator rows |
| `database.json` | `operator.databasePath` |

## Census

| Group | Kind | Count |
|---|---|---|
| Sources | `source` | 28 |
| Local fallbacks | `fallback-policy` (11) and `source` (1, `local.curated.table`) | 12 |
| Display | `display` | 43 |
| View | `view` | 8 |
| Operator | `operator` | 22 |
| **Total** | | **113** |
