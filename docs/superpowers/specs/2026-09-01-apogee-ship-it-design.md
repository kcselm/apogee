# Apogee — Ship It Design Doc

*Brainstormed 2026-09-01. Sprint 4 of the [polish roadmap](./2026-09-01-apogee-polish-roadmap.md).
Depends on sprint 1 (so the first public build has honest stars); can otherwise run any time.
Fixes finding F7.*

## Why

There is no URL. A recruiter cannot play a repo. The build is already a 73 kB static bundle, so
hosting is an afternoon; what is missing is the plumbing around it: CI that proves `main` is
green, a README that shows the game before it explains it, a license, and two hygiene items
(scratch tests that break `tsc`, and `localStorage` calls that throw in Safari private mode).

## Decisions locked (during brainstorming)

1. **Cloudflare Pages, connected to the GitHub repo** (`kcselm/apogee`). Production deploys from
   `main`; every other branch gets a preview URL. No Wrangler config needed; the project is
   configured in the Cloudflare dashboard with the values in Section 1. Fallback documented (not
   implemented): GitHub Pages via Actions with `base: "/apogee/"` in `vite.config.ts`.
2. **GitHub Actions CI** on push and pull request: install with a frozen lockfile, test,
   typecheck, build. Node 24, pnpm via corepack (the `packageManager` field already pins 10.32).
3. **Scratch tests stay out of git and out of `tsc`**: `.gitignore` gains
   `packages/engine/tests/_*.test.ts`; `packages/engine/tsconfig.json` gains
   `"exclude": ["tests/_*"]`. Vitest still runs them locally (they are already `SOLVE`/env
   gated). The two files currently in the working tree are left in place, untracked.
4. **`safeStorage`**: a tiny wrapper around `localStorage` with try/catch and an in-memory
   fallback, implementing the `Pick<Storage, "getItem" | "setItem">` shape the storage modules
   already accept. Callers pass it instead of `localStorage`.
5. **MIT license.**
6. **README rewritten** to the outline in Section 4. `docs/` is unchanged.
7. **`vite.config.ts` `base` stays `/`.** Cloudflare serves at the root.

## Section 1 — Hosting

Cloudflare Pages project settings:

| Setting | Value |
|---|---|
| Framework preset | None |
| Build command | `pnpm install --frozen-lockfile && pnpm --filter @apogee/web build` |
| Build output directory | `packages/web/dist` |
| Root directory | `/` |
| Environment variable | `NODE_VERSION=24` |
| Production branch | `main` |

No SPA redirect rules are needed: the app has no router and every entry is `/`. The site URL is
`https://<project>.pages.dev`; a custom domain is optional and out of scope.

Sprint 3's `og:image` URL becomes absolute (`https://<project>.pages.dev/og.png`) once the URL
exists; `og:url` is added at the same time.

## Section 2 — CI

`.github/workflows/ci.yml`:

```yaml
name: ci
on: { push: { branches: [main] }, pull_request: {} }
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 24 }
      - run: corepack enable
      - uses: actions/cache@v4            # pnpm store keyed on pnpm-lock.yaml
      - run: pnpm install --frozen-lockfile
      - run: pnpm test
      - run: pnpm typecheck
      - run: pnpm --filter @apogee/web build
```

The workflow badge goes at the top of the README. SOLVE-gated suites stay skipped in CI (no env
var set), as today.

## Section 3 — Hygiene

- **Scratch tests** as in decision 3. `pnpm typecheck` passes on a tree that still contains
  `_scratch.test.ts` and `_task5_probe.test.ts`.
- **`safeStorage`** in `packages/web/src/safeStorage.ts`:

  ```ts
  export function safeStorage(backing: Storage | null): Pick<Storage, "getItem" | "setItem">
  // getItem/setItem wrapped in try/catch; on throw (private mode, quota) fall back to an in-memory Map
  export const appStorage = safeStorage(typeof localStorage === "undefined" ? null : localStorage);
  ```

  `DailyGame`, `CampaignMap`, `CampaignLevel`, and the sprint-3 onboarding/intro helpers use
  `appStorage`. The storage modules' signatures already accept the picked shape; `recordScore`
  and `recordResult` currently demand full `Storage` and are loosened to the same pick.
- **`LICENSE`** (MIT, Kevin Selm, 2026). `package.json` gains `"license": "MIT"` at the root and
  in both packages.
- **`.gitignore`** is otherwise unchanged. PNGs are committed on purpose (sprint 3's `og.png`,
  the README hero image).

## Section 4 — README

Outline (replaces the current README; the "Phase 1 scope" section is dropped as stale):

1. **Title + one-liner + Play link + CI badge.** `Apogee — a space-curling puzzle. Play →`
2. **Hero image**: `docs/media/hero.png` (level 18 or 30 mid-flight, 1600×1000) — captured once
   and committed.
3. **How it plays**: three bullets (drag to aim, gravity does the rest, land in the rings /
   clear the objective). Mention both modes in one line each.
4. **Why the engine is interesting** (the recruiter paragraph): deterministic pure engine, only
   `+ − × ÷ sqrt` in the sim, seeded generation, golden tests, brute-force solvability tests,
   SOLVE-gated ablation audit and forgiveness sweep, replay-verifiable inputs (~40 bytes per run).
5. **Develop**: `pnpm install`, `pnpm dev`, `pnpm test`, `pnpm typecheck`; the SOLVE tools with
   their commands.
6. **Architecture** (kept from today, two bullets) and a link to the design docs and the roadmap.
7. **License.**

The README does not take a position on the AI-assisted history (roadmap open decision); it links
to `docs/superpowers/` as "design docs and plans".

## Section 5 — Verification

- CI green on the PR that adds it, and again on `main` after merge.
- The preview URL for the branch loads; the production URL loads on a phone and a laptop with no
  console errors (favicon 404 is fixed by sprint 3; if sprint 4 lands first, a placeholder
  `favicon.ico` in `public/` avoids the error).
- A fresh clone: `pnpm install && pnpm test && pnpm typecheck` clean with the scratch files
  present.
- Safari private window: the game plays, best score and progress simply do not persist, no
  uncaught exception.

## Out of scope

- Analytics, custom domain, PWA/offline, a server of any kind.
- Deciding the AI-attribution stance (roadmap open decision).
- Lint/format tooling (ESLint/Prettier). `tsc --strict` with `noUncheckedIndexedAccess` is the
  bar today and is enough for this roadmap.

## Success criteria

1. `https://<project>.pages.dev` is playable on phone and desktop with a clean console.
2. The README shows the game (image + link) before it explains it, and carries a green CI badge.
3. `pnpm test`, `pnpm typecheck`, and the web build pass in CI on `main` and locally with scratch
   files present.
4. Storage failures never surface as errors.
