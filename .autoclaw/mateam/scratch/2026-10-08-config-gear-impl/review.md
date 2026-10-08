# Review — config gear implementation

Re-checked the remaining blocker against the draft-sync effect in `src/components/SettingsPanel.tsx`. Application source and the spec were not edited.

## Blockers

None.

## Checked and clear

- Reset group copies immediate fields from the newly applied preferences and keeps only apply-commit draft fields that did not change.
- Apply refetches expanded hubs from `graphsRef` and refetches MyGene for the open protein after save.
- A MyGene failure for a curated gene uses an empty summary and an Unknown badge, and keeps curated text under Curated note.
- A null DepMap release is `cache not built`, an empty release is `release unavailable`, and an unclamped scale caption says `not clamped`.
- The PNG stamp includes color mode, context, both STRING cutoffs, the DepMap token, and the date.
- Role palette and hub colors have editors, and sign rows edit color and dash.
- POST rejects invalid color lists, sign colors, role-palette hex, and a hub fill that is not `rgba(...)`.
- `GET /api/operator` returns `jwtSecret` as `present` or `absent`. The readout object does not include `JWT_SECRET`, `GEMINI_API_KEY`, cookies, or passwords.
- STRING failures set `stringError`. The status pill says `STRING request failed`, not `STRING API Active`. `keep-last-graph` keeps the previous graph when one exists and the legend states that. OmniPath failures set `omnipathError` and the legend does not say `no interactions`. Empty datasets skip `/api/omnipath` and the legend says `OmniPath signs off`. Export then has `datasets: []` and `error: null`.
- `fetchProteinDetails` does not copy `CURATED_CANCER_GENES[].depMap`. Disc color and `buildViewExport` use cache measurements. A missing measurement stays null with `n = 0` and `display.missingColor`.
- The browser OmniPath call uses `source.omnipath.proxyPath` (`/api/omnipath`). `fetchOmnipathUpstream` is server-side. No client module imports `simulation.ts`.
- The registry has 113 ids in the spec’s group order. The gear sits before JSON. Disc rows say `Edited on the disc.` and do not draw a second slider. Unknown preference keys are rejected on write. Hash placeholders are described as not curated roles. `fallback.role.uncached` repaints without Apply.

## Notes (not blockers)

- `defaultPreferences()` repeats descriptor literals instead of reading each preference-backed `setting(id).default`. Today’s values match, and `tests/settingsRegistry.test.ts` locks that match. A new preference key would not be picked up until this function is edited.
- `server.ts` and `scripts/build-depmap-cache.ts` still spell the cache path and CSV paths beside the registry defaults. The strings match.
- `operator.authRoutes` adds `/api/operator`. The spec’s list stops at `/api/preferences`.
- `view.context`’s descriptor default is the literal `pan-cancer`. `defaultPreferences().context` does read `source.depmap.panCancerId`.
- Cache-backed source rows (`source.depmap.panCancerId`, `source.contextsRoute`) show the code default, not the operator readout or the loaded context count.
- The protein header chip says `TARGET`. The retired role label `Molecular Target` is not used. Unknown has an empty description.
