# Implement the config gear

Session: 2026-10-08-config-gear-impl
Spec (do not edit): `.autoclaw/mateam/scratch/2026-10-08-config-gear-spec/output.md`

## Roles
- Researcher: map every current literal the spec names to a file and symbol. Write `context.md`. Do not edit application source.
- Coder: implement the registry, drawer, persistence, operator readout, and wire fetch/legend/export to the effective values. Write `output.md`.
- Reviewer: check the diff against the spec's scientific constraints and acceptance list. Write `review.md`.
- Verifier: if review has blockers, stop. Otherwise run `tsc --noEmit` and `npm test`, and check the gear in the browser. Write `verify.md`.

## Non-negotiable
- No curated Chronos fallback.
- STRING and MyGene failures show an error, not a success status.
- Hash role colors are labeled placeholders.
- `simulation.ts` is not imported.
- The drawer renders `SETTINGS`. It does not contain a second field list.
- No control writes `.env` or runs `npm run cache-depmap`.
- JWT secret is never returned.
