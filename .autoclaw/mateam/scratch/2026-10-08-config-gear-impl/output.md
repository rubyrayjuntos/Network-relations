# Config gear implementation

Built from `.autoclaw/mateam/scratch/2026-10-08-config-gear-spec/output.md`. The spec file was not edited.

## What landed

- `src/lib/settingsRegistry.ts` is the single settings list. `defaultPreferences`, `validatePreferences`, `mergePreferences`, `settingsByGroup`, `operatorReadout`, and `edgeWidth` live there. The module does not import React, the filesystem, or `simulation.ts`.
- `src/components/SettingsPanel.tsx` is the right-hand drawer. It groups the registry, keeps source edits until Apply, repaints immediate display edits, and offers Reset group and Reset all. Escape and the close button dismiss it.
- `src/App.tsx` places the gear immediately before JSON. Accessible name: “Data sources and settings.” A pending dot shows while Apply-commit edits are unapplied. Opening the drawer does not change zeta, bloom, pathways, context, or color mode. Apply and Reset all save the full preference object and refetch STRING. Empty OmniPath datasets skip `/api/omnipath` and the legend says “OmniPath signs off.” STRING failures set an error used by the status pill and the legend. Invalid STRING scores stay null and the tooltip says “STRING score invalid.” Edge width uses `edgeWidth`. Role colors for uncached genes follow the hash-placeholder or missing-color policy, and the roles caption says which. The legend, PNG stamp, and JSON export use the effective preferences.
- `server.ts` signs up with `defaultPreferences()`, merges stored preferences on GET, rejects unknown or invalid POST bodies with 400, and serves authenticated read-only `GET /api/operator`. The readout says `present` or `absent` for the JWT secret and never returns the secret. Gemini and App URL are `unused`.
- STRING, MyGene, and OmniPath requests take the configured species, scores, limits, fields, and datasets. MyGene failure sets `mygeneError`. The protein panel badge for an unknown role is “Unknown” with no biological sentence. The taxon line is the STRING species. The curated note follows `curatedNoteVisible`.
- DepMap pan-cancer id, label, and gene-header pattern come from the registry. Cache-missing responses use `CACHE_MISSING_SENTENCE`.

## Checks already run

- `./node_modules/.bin/tsc --noEmit` passed.
- `./node_modules/.bin/tsx --test tests/*.test.ts` passed, 16 tests, including `tests/settingsRegistry.test.ts`.
- The server on `http://127.0.0.1:3471` was restarted so the new operator route is loaded. `GET /api/operator` without a cookie returns 401. The Vite transform of `App.tsx` includes the gear label, the signs-off sentence, and the STRING failure status.
- The login page renders. A logged-in click-through was not completed: filling the signup form in the browser was blocked. Console noise on that page is the existing HMR port clash on 24678, a 401 from `/api/me` while logged out, and a missing favicon.

## Review follow-up

The first review listed seven blockers. They are closed: Apply refetches starter pathways and expanded hubs and refreshes the open protein; Reset group commits that group, including disc controls, and the drawer draft follows immediate values; a curated MyGene failure shows Unknown with an empty summary while the curated note can still show; a missing cache is `cache not built` and an empty loaded release is `release unavailable`; the PNG stamp includes the color mode; the role palette, hub colors, and sign dashes are editable; POST rejects invalid color lists, sign objects, and hub fills. A second pass found the drawer draft could restore old immediate values after Reset group. The draft now takes immediate fields from the applied document and keeps only apply-commit fields that did not change. The re-review reports no blockers.

## Left as specified

- `src/lib/simulation.ts` has no importers.
- No `.env` was written and `npm run cache-depmap` was not run. With no cache, the honest state is “DepMap cache is not built. Run npm run cache-depmap.”
- The role palette row is visible and not a free-form editor (`control: "none"`). Hub, grid, background, and search colors are read from preferences when the disc paints.
