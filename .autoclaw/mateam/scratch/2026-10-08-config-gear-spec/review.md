# Review — config gear spec

Census arithmetic is 28 + 12 + 43 + 8 + 22 = 113, and the ids are unique. Findings below are the blockers and important gaps only.

## 1. Scientific integrity

The ban on filling a missed measurement from `CURATED_CANCER_GENES[].depMap` or `syntheticExpressionLevel` holds: no descriptor carries a curated Chronos score, and cache-missing stays a 503 plus `display.missingColor`, distinct from gene-absent nulls.

**Blocker. `fallback.string.error` (default `seeds-no-edges`) and `display.status.string`.** The catch returns the input symbols and `edges: []`, the legend names this policy only when it is not the default, and the only status copy is the success lines (`STRING API Active` and the rest), so a failed STRING call is drawn as an ordinary empty network. Fix: on that path show the STRING error in the status and the legend, including for the `fetchInteractors` catch, and do not use the success copy.

**Blocker. `fallback.mygene.error` and `display.panel.roleBadges`.** An uncurated MyGene failure sets role `unknown`, and the unknown badge is `Molecular Target` with a biological description, while the policy is `legend: no`. Fix: keep a named error caption, and make the unknown badge say unknown rather than Molecular Target.

**Blocker. `fallback.role.uncached` (default `hash`), `display.legend.titles`, and `display.roles.caption`.** Hash buckets reuse azure, mint, amber, and slate, the title is `Curated roles`, and the legend states the policy only when it is not the default, so an unloaded symbol is drawn as a curated role. Fix: say on the roles legend that unloaded symbols are hash placeholders, or default the policy to `missing`.

**Important. `fallback.string.invalidScore` and `display.edges.tooltip`.** A non-numeric score becomes `0`, and the tooltip prints that as `STRING score {score}`. Fix: mark the edge score invalid in the tooltip and the export instead of publishing `0`.

## 2. Contradictions

`source.string.requiredScore` (`700`) and `source.string.partnerScore` (`800`) are different cutoffs, each with one default. Operator rows are readonly, absent from the preference document, and have no rebuild button.

**Blocker. `view.zeta`, `view.bloomScale`, `view.selectedPathways`, `view.context`, `view.visualMode`.** What is editable ends with “every other descriptor is `commit: readonly`,” which covers these five, while the View table marks them `commit: immediate` and Placement forbids a second control. Fix: list them as disc-edited, and state that the drawer row is inspect-only.

**Important. `source.string.partnerLimit`.** The row is `legend: yes`, and the provenance line never prints the partner limit (`partners ≥` is `source.string.partnerScore`). Fix: add the partner limit to that line.

**Important. `display.chronos.caption` and `display.chronos.clamp`.** The caption always says “Display clamped” while the clamp is a separate boolean. Fix: interpolate the caption from `display.chronos.clamp`, and do the same for `display.expression.clamp`.

**Important. PNG stamp versus `source.string.networkLimit`, `source.string.expandLimit`, `source.string.partnerLimit`, and `source.omnipath.datasets`.** `legend: yes` means the PNG stamp repeats the value, and the stamp template drops these four. Fix: state that the PNG embeds the full legend lines and that the one-line stamp is only a title, or add the four values to the stamp.

**Important. `source.string.species` and `source.mygene.species`.** STRING species is editable and MyGene species stays `human` with `legend: no`, and the protein panel still prints `HUMAN [9606]` in a file this spec edits. Fix: show both species on the provenance line, and point the panel badge at `source.string.species` or exclude that literal.

**Important. `view.context` and `source.depmap.panCancerId`.** Both hard-code `pan-cancer`. Fix: make the `view.context` default a reference to `source.depmap.panCancerId`.

**Important. `view.selectedPathways`.** The View row defaults to all keys of `source.string.initialSeeds`, and the persistence table also writes the five-name array. Fix: build `defaultPreferences().selectedPathways` from those keys and delete the literal array.

**Important. `source.depmap.panCancerId`, `source.depmap.panCancerLabel`, `source.contextsRoute`, `source.measurementsRoute`.** They are cache-backed, and the effective-value rule reads `GET /api/operator`, which does not return them. Fix: add those readouts to the operator payload.

Display rows with `legend: yes` and `export: no` are an explicit opt-out, except the template gaps named above. `display.chronos.range`, `display.expression.range`, `display.missingColor`, and `display.roles.palette` are `legend: yes` and are absent from the seven legend lines. Fix: add them to those lines, or set `legend: no` and say so.

## 3. Inventory

The crosswalk maps the inventory tables. These values are still dropped.

**Important. `depmapRelease` display tokens (`cache not built` / `release unavailable` / `unavailable`).** The spec defines the first two and never names `unavailable`, which is the token the PNG metric uses for a null release. Fix: retire `unavailable` and state which surface uses `cache not built` versus `release unavailable`.

**Important. `GET /api/omnipath`.** The inventory’s empty-partner and invalid-symbol 400s are missing from `source.omnipath.proxyPath`, and the client’s empty-partner short-circuit returns `datasets: []` with success, the same shape as signs-off. Fix: keep both 400s on that row, and say an empty partner list is not signs-off.

**Important. Vite `loadEnv(mode, '.', '')`.** It is not `operator.dotenvOrder` and it is not in Exclusions. Fix: add it beside `operator.geminiApiKey`, or exclude it with the Vite alias.

## 4. Browser writes

Sound. `GET /api/operator` is read-only, `operator.jwtSecret` is `present` or `absent`, the payload omits `JWT_SECRET`, `GEMINI_API_KEY`, cookie values, and passwords, and no control writes `.env` or runs `npm run cache-depmap`.

## 5. Are the 113 distinct?

The 113 ids are unique. They are not 113 independent constants: `pan-cancer` sits on both `view.context` and `source.depmap.panCancerId`, and the starter-pathway list sits on both `view.selectedPathways` and `source.string.initialSeeds` (fixes in section 2). `operator.listenUrl` and `operator.cookieSecure` are derived readouts, not third copies of host, port, or `operator.nodeEnv`.
