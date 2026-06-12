# Apogee

A daily space-curling game. Every day, everyone gets the same tiny star
system. Five slingshot launches, gravity does the rest — land in scoring
rings, dodge the void, beat your friends.

Spec: `docs/superpowers/specs/2026-06-11-apogee-design.md`

## Develop

- `pnpm install`
- `pnpm dev` — run the game (packages/web)
- `pnpm test` — engine + web tests
- `pnpm typecheck`

## Architecture

- `packages/engine` — pure, deterministic simulation. Zero deps. Only
  `+ - * / sqrt` in numeric code (cross-engine float determinism).
  Same seed + same inputs → identical outcome, everywhere.
- `packages/web` — React + Vite + canvas renderer. Calls the engine,
  draws the results, computes no physics itself.

## Phase 1 scope (current)

Solo, client-only. Known limitations, by design:
- No mid-game persistence: reloading restarts today's run (best score persists).
- No leaderboard/share — Phase 2 (server, replay verification).
- No head-to-head — Phase 3.
