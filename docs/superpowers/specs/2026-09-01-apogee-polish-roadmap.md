# Apogee — Polish Roadmap (Review → Six Sprints)

*Reviewed and brainstormed 2026-09-01. Follows the
[fun-debt design](./2026-07-22-apogee-fun-debt-design.md). Goal: a game Kevin can send to a
recruiter or a technical friend without caveats.*

This document captures the 2026-09-01 playability review and decomposes its findings into six
spec-sized sprints. Each sprint has its own design doc (linked below) and, when it starts, its
own implementation plan. The in-flight **fun-debt sprint** (relayouts, fixed-rate skippable
playback) finishes first and is a dependency of sprints 1, 3, and 5.

## Where the game stands (review findings)

**Method.** Read the engine, web, and specs; ran `pnpm test` (118 tests pass), `pnpm typecheck`
(fails only on the untracked `_scratch.test.ts`), `vite build` (73 kB gzipped); ran the
SOLVE-gated ablation audit; ran a forgiveness sweep over every level (360 directions × 12 powers,
× 8 launch ticks on moving levels); played both modes headless at 1280×800, 1600×900, 390×844
portrait, and 844×390 landscape.

**Strengths (keep and lead with these).**

- The engine is the portfolio piece: pure TypeScript, zero deps, `+ − × ÷ sqrt` only, seeded
  generation, golden snapshot tests, brute-force solvability tests, an ablation audit tool.
- Visual polish is above the bar for a side project: procedural planets, hostile blockers, glass
  panels, parallax cosmos, comet trails, shooting stars.
- Content volume: 30 hand-authored levels, 10 chapters, 6 mechanics.

**Findings.** Numbered for reference from the sprint specs.

| # | Finding | Evidence | Sprint |
|---|---|---|---|
| F1 | Nothing teaches the controls. Level 1 shows a tiny ring, a planet, and a dashed circle; no aim hint, no pad label; goal and pad look alike. | Played fresh profile | 3 |
| F2 | A stray touch fires a max-power launch. The drag vector is pad − pointer (absolute), so a jittery tap far from the pad launches at max speed in a random direction. | `useBoardCanvas.ts` `onMove` | 2 |
| F3 | Flights are unskippable and frame-rate dependent (one sim step per rAF; 2× speed at 120 Hz). Fun-debt Tasks 6–7 are unstarted. | `useBoardCanvas.ts` | fun-debt |
| F3b | The sim keeps running after the objective is met. Reference solutions for levels 9 and 29 clear the level and then orbit for the full 45 s before the panel appears. | Sweep: solution steps 2700 | 1 |
| F4 | 3★ is geometrically impossible on goal levels and automatic on target levels. Precision is sampled at *first sensor contact*: goals (r 36–40 + probe 5) trigger 35–45 units out, outside the 30-unit inner ring; targets (r 24–26) trigger inside it. | Sweep: 0 3★ one-launch clears on every goal level but one (1-3, one input); 100 % of clears are 3★ on 7-3, 9-2, 10-1, 10-3 | 1 |
| F5 | Every moon and wormhole level is bypassable. All 13 auditable levels in chapters 6–10 clear with the mechanic deleted, 10 of them in one launch. | `SOLVE=1 vitest run ablation-audit` | fun-debt |
| F6 | Mobile portrait is unusable: 358×224 px board, HUD wraps to three lines, back button breaks across lines. Max pull (200 world units) is unreachable when the pad sits 80 units from the board edge. | 390×844 screenshots | 2 |
| F7 | No public URL, no CI, no favicon/meta, README has no image or link, scratch tests break typecheck. | Repo | 4 |
| F8 | Difficulty curve is not monotonic: chapter 3 (keys) is ~10× less forgiving than chapter 2; chapters 6 and 8 are back to chapter-1 forgiveness; level 27 is among the easiest; each chapter is teach ×3 rather than teach / twist / test. | Sweep table below | 5 |
| F9 | No sound; sensor pickups render only after the flight ends because `events` are discarded. | `CampaignLevel.tsx` | 6 |

**Forgiveness sweep (2026-09-01, pre-fun-debt relayouts).** "1-launch clear %" is the share of
the fine aim grid that clears the level in one launch; "3★ %" the share that also earns 3★ under
the current first-contact rule; "playback" is the reference solution's flight time at 60 Hz.

| Level | Budget / par | 1-launch clear % | 3★ % | Solution steps | Playback |
|---|---|---|---|---|---|
| 1-1 First Light | 3 / 1 | 3.03 | 0 | 180 | 3.0 s |
| 1-2 Two Worlds | 3 / 1 | 3.06 | 0 | 156 | 2.6 s |
| 1-3 Slingshot | 4 / 1 | 6.04 | 0.02 | 61 | 1.0 s |
| 2-1 In The Way | 4 / 1 | 2.52 | 0 | 164 | 2.7 s |
| 2-2 Bent Path | 4 / 1 | 1.99 | 0 | 167 | 2.8 s |
| 2-3 Threading | 5 / 1 | 2.41 | 0 | 325 | 5.4 s |
| 3-1 The Key | 3 / 1 | 0.21 | 0 | 237 | 4.0 s |
| 3-2 Hidden Key | 3 / 1 | 0.23 | 0 | 327 | 5.5 s |
| 3-3 Key & Guard | 4 / 1 | 0.35 | 0 | 2700 | 45.0 s |
| 4-1 Double Tap | 4 / 2 | 0 (par 2) | — | 182 + 274 | 7.6 s |
| 4-2 Spread | 5 / 2 | 0 (par 2) | — | 167 + 625 | 13.2 s |
| 4-3 Guarded Marks | 5 / 2 | 0 (par 2) | — | 267 + 191 | 7.6 s |
| 5-1 Key & Marks | 5 / 2 | 0 (par 2) | — | 165 + 356 | 8.7 s |
| 5-2 Tight Squeeze | 4 / 1 | 0.46 | 0 | 239 | 4.0 s |
| 5-3 Apogee | 6 / 2 | 0 (par 2) | — | 1575 + 172 | 29.1 s |
| 6-1 Moonrise | 4 / 1 | 1.94 | 0 | 197 | 3.3 s |
| 6-2 Slingshot Tide | 4 / 1 | 5.19 | 0 | 224 | 3.7 s |
| 6-3 Twin Moons | 5 / 1 | 1.68 | 0 | 171 | 2.9 s |
| 7-1 Moon & Guard | 5 / 1 | 3.64 | 0 | 164 | 2.7 s |
| 7-2 Keyed Orbit | 4 / 1 | 0.10 | 0 | 178 | 3.0 s |
| 7-3 Moving Marks | 5 / 1 | 0.24 | 0.24 (all) | 155 | 2.6 s |
| 8-1 Through the Door | 4 / 1 | 1.50 | 0 | 494 | 8.2 s |
| 8-2 Bent Passage | 4 / 1 | 1.53 | 0 | 171 | 2.9 s |
| 8-3 Redirect | 5 / 1 | 1.88 | 0 | 183 | 3.0 s |
| 9-1 Portal Key | 5 / 1 | 0.16 | 0 | 236 | 3.9 s |
| 9-2 Split Marks | 5 / 2 | 0.05 | 0.05 (all) | 190 + 672 | 14.4 s |
| 9-3 Gauntlet Gate | 5 / 1 | 4.19 | 0 | 912 | 15.2 s |
| 10-1 Convergence | 6 / 1 | 0.19 | 0.19 (all) | 343 | 5.7 s |
| 10-2 Clockwork Lock | 6 / 1 | 0.27 | 0 | 2700 | 45.0 s |
| 10-3 Event Horizon | 7 / 2 | 0.04 | 0.04 (all) | 384 + 192 | 9.6 s |

The sweep tool itself is committed in sprint 5; until then it lives in scratch.

## The sprint series

| # | Spec | Layer | Fixes | Depends on | Size |
|---|---|---|---|---|---|
| 1 | [Stars & flight end](./2026-09-01-apogee-stars-flight-end-design.md) | engine + small web | F3b, F4 | fun-debt Task 1 (par stars) | S |
| 2 | [Aim input & board layout](./2026-09-01-apogee-aim-input-layout-design.md) | web input/layout | F2, F6 | — | M |
| 3 | [First two minutes](./2026-09-01-apogee-first-two-minutes-design.md) | web onboarding | F1 | 2 (HUD row), fun-debt Task 7 (skip hint) | M |
| 4 | [Ship it](./2026-09-01-apogee-ship-it-design.md) | infra + docs | F7 | 1 (so the first public build has honest stars) | S |
| 5 | [Difficulty & campaign structure](./2026-09-01-apogee-difficulty-structure-design.md) | content + map | F8 | fun-debt Task 5 (relayouts), 1 | L |
| 6 | [Sound & pickup feedback](./2026-09-01-apogee-sound-pickup-feedback-design.md) | web | F9 | 1 (trimmed traces), fun-debt Task 7 (skip batching) | M |

**Order.** fun-debt → 1 → 2 → 3 → 4 → 5 → 6. Sprint 4 can move earlier (any time after 1) if a
URL is wanted sooner; sprint 6 is independent of 5 and can swap with it.

```
fun-debt ──► 1 ──► 4
   │         │
   │         ├──► 2 ──► 3
   │         │
   └─────────┴──► 5
             └──► 6
```

**Sizing.** S ≈ 3–5 plan tasks, M ≈ 5–8, L ≈ 8–12. Each sprint ends with a playtest checkpoint
(Kevin) before its last commit, as in fun-debt.

## Definition of done (the recruiter bar)

1. A public URL loads in under two seconds on a phone and a laptop, with no console errors.
2. A first-time player launches within ten seconds without being told how.
3. No flight holds input for more than ~12 s, and any flight can be skipped instantly.
4. A jittery tap never wastes a launch; the whole board and HUD are visible on a 390×844 phone.
5. Three stars is attainable on every level and not automatic on any; Kevin fails to 3★ at least
   a third of the "test" levels on the first try.
6. Every moon and wormhole level fails its ablation audit (mechanic required).
7. Every chapter reads teach / twist / test in the forgiveness sweep.
8. Every launch has audible feedback; keys and targets react the instant they are hit.
9. `pnpm test`, `pnpm typecheck`, and `pnpm --filter @apogee/web build` are green in CI on `main`;
   the README has a hero image, a live link, and the determinism story.

## Decisions carried across sprints

- **Daily mode stays as is.** No share string, streak, countdown, or practice mode this roadmap.
  The daily board still receives whatever the shared board hook gains (input model, playback,
  orientation, flight cues) because it is the same hook.
- **Engine discipline unchanged.** `+ − × ÷ sqrt` only; additive changes to the launch result;
  the daily golden never changes; campaign golden sim fields stay byte-identical unless a sprint
  says otherwise in its own spec.
- **No text drawn on the canvas.** Captions, hints, and cards are DOM, so the portrait rotation
  in sprint 2 stays a pure transform.
- **Chapters 1–5 layouts may change in sprint 5.** The fun-debt rule ("chapters 1–5 unchanged")
  was scoped to that sprint; the difficulty sprint retunes campaign-wide.

## Parked (not in this roadmap)

- Daily mode retention: share grid, countdown, streak, practice seed, mid-game persistence.
- New mechanics. Candidates that fit the engine cheaply: repulsor body (negative mass), one-tap
  mid-flight burn with a per-level budget, a comet on a fixed line as a moving blocker, a
  checkpoint planet that becomes a second launch pad.
- Server, verified leaderboards, head-to-head, PWA install, level editor, procedural campaign.
- Keyboard-only aiming (accessibility). Worth a small spec after sprint 3.

## Open decision for Kevin (not a sprint)

The git history carries `Co-Authored-By: Claude` trailers and the docs live under
`docs/superpowers/`. Some reviewers like seeing an AI-assisted process, some discount the work.
Pick one stance before sharing the URL and make the README match it (sprint 4 writes the README;
it does not decide this).
