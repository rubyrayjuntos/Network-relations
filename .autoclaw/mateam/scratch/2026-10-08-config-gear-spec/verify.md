# Verify — config gear spec

Reviewed `output.md` after the corrections in this session.

The four review blockers are closed in the spec:

- A failed STRING request shows the error in the status and the legend for both `seeds-no-edges` and `keep-last-graph`. The success line is not used.
- A MyGene failure says `MyGene request failed`. The unknown badge says `Unknown` and has no biological sentence.
- The roles caption always says that hash colors are placeholders, including at the default.
- The five disc controls are edited on the disc. Their drawer rows are inspect-only. `view.context` defaults to `source.depmap.panCancerId`. `view.selectedPathways` defaults to the keys of `source.string.initialSeeds`.

Important gaps closed in the same edit: partner limit on the provenance line, clamp wording follows the clamp flag, the PNG stamp is a title and the captured legend carries limits and datasets, operator readout includes pan-cancer id and label, `unavailable` is retired, OmniPath empty partners stay HTTP 400, Vite `loadEnv` is excluded, and an invalid STRING score is null in the export rather than `0`.

No application source was changed. Tests were not run because this session produced a specification only.
