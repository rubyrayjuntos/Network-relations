# Config gear specification

Session: 2026-10-08-config-gear-spec
Task: Write a complete, living specification for a gear button in the upper right that exposes every hard-coded value and local lookup the Poincaré applet uses, including remote APIs and local fallbacks. Do not implement the panel.

## Why
The scientific disc now depends on pinned sources (DepMap release and cache, STRING species and score, OmniPath datasets, MyGene, curated notes, color domains). Those choices are constants in code. The user wants them visible and configurable, and wants the same surface to grow as new features add sources.

## Roles
- Researcher A: inventory remote APIs, proxy routes, env vars, and request parameters. Write `context-apis.md`.
- Researcher B: inventory local fallbacks, caches, curated tables, color scales, preference defaults, and the current header. Write `context-local.md`.
- Coder: write the specification to `output.md`. No application code.
- Reviewer: audit the spec against the inventories. Write `review.md`.
- Verifier: confirm every inventoried constant is either in the spec or explicitly excluded, with a reason. Write `verify.md`.

## Constraints
- Specification only. Do not edit application source.
- Do not edit the scientific disc plan file.
- Defaults must preserve today's behavior.
- A failed remote call must not be silently replaced by a local lookup.
- Curated notes stay labeled as curated.
- New features must be able to register a setting without rewriting the panel.
