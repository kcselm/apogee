# Apogee — Difficulty & Campaign Structure Design Doc

*Brainstormed 2026-09-01. Sprint 5 of the [polish roadmap](./2026-09-01-apogee-polish-roadmap.md).
Depends on fun-debt Task 5 (relayouts so moons and wormholes are required) and sprint 1
(closest-approach stars). Fixes finding F8.*

## Why

The forgiveness sweep (roadmap table) shows the ladder does not ramp:

- **Chapter 3 is a cliff.** Keys make levels 7–9 about ten times less forgiving than level 6
  (0.21–0.35 % of the aim grid clears in one launch versus 2.4 %).
- **Later chapters fall back to chapter-1 forgiveness.** Moons (6-x: 1.7–5.2 %) and wormholes
  (8-x: 1.5–1.9 %) are easier than keys; level 27 "Gauntlet Gate" (4.2 %) is among the easiest
  levels in the game.
- **Each chapter is teach × 3.** The third level of a chapter is rarely harder than the first
  (1-3 "Slingshot" is the most forgiving level in the campaign at 6 %).
- **Some reference shots are orbits.** The solver's clearing input for levels 9 and 29 flies for
  the full 45 s; for level 15, 26 s. Sprint 1 hides the wait, but a level whose natural clearing
  shot is an orbit reads as luck.
- **The map is a flat list** of thirty identical tiles; chapters exist only in the level ids.

Numbers above are pre-relayout. Chapters 6–10 must be re-measured after fun-debt Task 5 lands.

## Decisions locked (during brainstorming)

1. **The forgiveness sweep becomes a SOLVE-gated tool** in `packages/engine/tests/level-stats.test.ts`,
   run like the ablation audit, printing a TSV. Never in CI.
2. **Chapter shape is teach / twist / test**, measured on the fine aim grid as the share of inputs
   that clear the level in one launch (or, for par-2 levels, that make progress from the fresh
   state):

   | Role | Band |
   |---|---|
   | teach (x-1) | 2 – 6 % |
   | twist (x-2) | 0.7 – 2 % |
   | test (x-3) | 0.15 – 0.7 % |

3. **3★ share among par clears: 10 – 40 %** on every level. Tune by sensor radius or layout,
   never by editing the shared `RINGS` table.
4. **Reference flight ≤ 12 s.** The reference is the *shortest-playback* clearing input on the
   grid, not the solver's first hit.
5. **Chapters 1–5 layouts may change.** The fun-debt rule was scoped to that sprint. The daily
   engine stays untouched.
6. **Map gets chapter headers and a total-star counter.** Tiles are otherwise unchanged.
7. **Playtest checkpoint (Kevin)** before the tuning record is committed; notes become data-only
   commits.

## Section 1 — The sweep tool

`level-stats.test.ts`, `describe.skipIf(!process.env.SOLVE)`, sharing the solver helpers'
candidate grid (360 directions × 12 powers; × 8 board ticks on moving levels). Per level:

| Column | Meaning |
|---|---|
| `clear1 %` | share of grid inputs that clear in one launch |
| `progress %` | share that increases progress (key/target/goal count) from the fresh state |
| `star3 %` | share of one-launch clears that earn 3★ (par-1 levels); for par-2 levels, share of grid second launches that clear with 3★ when played after the reference sequence's first launch |
| `ref steps` | steps of the shortest-playback clearing sequence (sum across launches) |
| `max steps` | longest flight of any grid input (2700 = 45 s orbit is reachable by accident) |
| `ref input` | the reference sequence as JSON, for pasting into `SOLUTIONS` |

Runtime today is about three minutes for all thirty levels; acceptable for an authoring tool.
Command:

```
$env:SOLVE=1; pnpm --filter @apogee/engine exec vitest run level-stats
```

## Section 2 — Retune plan

Role bands apply to `clear1 %` on par-1 levels and `progress %` on par-2 levels. Actions from the
2026-09-01 sweep; every row is re-measured before and after its change, and chapters 6–10 are
re-measured *before* any action once fun-debt relayouts land.

| Level | Now | Role | Action |
|---|---|---|---|
| 1-1 First Light | 3.0 % | teach | keep |
| 1-2 Two Worlds | 3.1 % | twist | tighten slightly (goal radius or position) |
| 1-3 Slingshot | 6.0 % | test | tighten hard; the goal must sit where only a slingshot reaches it |
| 2-1 In The Way | 2.5 % | teach | keep |
| 2-2 Bent Path | 2.0 % | twist | keep |
| 2-3 Threading | 2.4 % | test | tighten (narrow the corridor) |
| 3-1 The Key | 0.21 % | teach | loosen: larger key or key on the natural arc |
| 3-2 Hidden Key | 0.23 % | twist | loosen slightly |
| 3-3 Key & Guard | 0.35 % / ref 45 s | test | relayout so the intended shot is direct; keep the band |
| 4-1 Double Tap | par 2 | teach | measure `progress %`, then act |
| 4-2 Spread | par 2 | twist | measure, then act |
| 4-3 Guarded Marks | par 2 | test | measure, then act |
| 5-1 Key & Marks | par 2 | teach | measure, then act — sprint-1 check: every clearing 2nd launch is 3★ once the reference 1st launch scores a bullseye (sticky-max precision across sensors); consider min-over-sensors precision or a layout where the first pass cannot be a bullseye |
| 5-2 Tight Squeeze | 0.46 % | twist | loosen slightly |
| 5-3 Apogee | par 2 / ref 29 s | test | relayout so the reference flight ≤ 12 s |
| 6-1 – 6-3 | 1.9 / 5.2 / 1.7 % | teach / twist / test | re-measure after relayouts; expect 6-2 and 6-3 to need tightening |
| 7-1 Moon & Guard | 3.6 % | teach | keep unless relayout moved it |
| 7-2 Keyed Orbit | 0.10 % | twist | loosen |
| 7-3 Moving Marks | 0.24 % | test | keep |
| 8-1 – 8-3 | 1.5 / 1.5 / 1.9 % | teach / twist / test | re-measure; 8-1 may need loosening, 8-3 tightening |
| 9-1 Portal Key | 0.16 % | teach | loosen |
| 9-2 Split Marks | par 2 | twist | measure, then act — sprint-1 check: every clearing 2nd launch is 3★ once the reference 1st launch scores a bullseye (sticky-max precision across sensors); consider min-over-sensors precision or a layout where the first pass cannot be a bullseye |
| 9-3 Gauntlet Gate | 4.2 % / ref 15 s | test | tighten hard; also shorten the reference flight |
| 10-1 Convergence | 0.19 % | teach | loosen |
| 10-2 Clockwork Lock | 0.27 % / ref 45 s | twist | relayout for a direct reference shot; loosen toward 0.7–2 % |
| 10-3 Event Horizon | par 2 | test | measure, then act |

Sprint-1 sweep (2026-09-02, closest-approach precision, bullseye 3★): every level has at least one
3★ input at par; 3★ share among clears ranges 0.18–0.77, above the 10–40 % band on 1-1, 2-2, 3-2,
4-2, 4-3, 5-3, 7-3, 8-1, 9-1, 10-1 — retune per sensor radius in this sprint.

Tuning levers, in order of preference: sensor radius (keys 26–36, targets 22–30, goals 32–44),
sensor position along the natural arc, blocker position, body radius/mass, launch budget last
(budgets stay generous per fun-debt; they gate clearing, not stars).

After every layout change: re-run the level's ablation check if it is a moving level, re-discover
its reference sequence, update `SOLUTIONS` and `par`, and regenerate its golden if it has one.

## Section 3 — Reference flights

The sweep's `ref input` is the shortest-playback clearing sequence. `SOLUTIONS` entries are
replaced with these references so the CI solvability test replays the shot the level is designed
around. A level whose shortest clearing flight exceeds 12 s (720 steps) is relayouted until it
does not; the escape hatch from fun-debt (documented exception in the level file) applies only if
the geometry cannot be fixed without breaking the chapter's theme.

## Section 4 — Map structure

Engine: `packages/engine/src/campaign/chapters.ts`:

```ts
export interface Chapter { index: number; title: string; mechanic: string; levelIds: string[] }
export const CHAPTERS: Chapter[]   // 10 entries, three ids each, in ladder order
```

| # | Title | Mechanic line |
|---|---|---|
| 1 | Gravity | reach the goal |
| 2 | Blockers | curve around what kills you |
| 3 | Keys | unlock, then land |
| 4 | Marks | hit every target |
| 5 | Combined | everything so far |
| 6 | Moons | moving gravity |
| 7 | Moons & more | timing meets guards and keys |
| 8 | Wormholes | in one mouth, out the other |
| 9 | Wormholes & more | portals with keys, marks, guards |
| 10 | Capstone | all of it |

Web `CampaignMap`: one section per chapter — a header row (`Chapter 3 · Keys`, mechanic line in
`--muted`) above a three-tile row. The map HUD shows `★ 23 / 90`. Locked tiles are unchanged.
Portrait: header spans the width; tiles wrap two-per-row as today.

## Section 5 — Process

1. Merge fun-debt (relayouts). Commit the sweep tool. Run it; paste the table into this spec's
   tuning record (Section 7) as "before".
2. Apply Section 2 row by row; re-measure each; keep a running table.
3. Refresh `SOLUTIONS` and `par` from `ref input`; regenerate affected goldens deliberately.
4. Run the full sweep and the ablation audit; every row in band, every moving level "mechanic
   required", every reference ≤ 12 s.
5. Playtest checkpoint (Kevin): does each chapter's third level feel like a test; is 3★ earned;
   do the relayouts still teach. Data-only follow-up commits.
6. Commit the final table as "after" in Section 7.

## Section 6 — Testing

- Sweep and ablation audit stay SOLVE-gated (too slow for CI).
- CI (existing): every recorded solution clears within par.
- CI (new): `CHAPTERS` covers every `LEVELS` id exactly once, in ladder order; each level's `intro`
  (sprint 3) sits on the chapter's first id.
- Web: `CampaignMap` grouping test (levels render under the right header; total stars sums best
  stars).
- Golden: daily untouched; campaign golden regenerated only for levels whose layout changed, in
  a commit that names them.

## Section 7 — Tuning record

### Before (2026-09-09, level-stats @ 92e4104)

Fine grid 360 × 12 (× 8 ticks on moving levels); forgiveness = clear1 % (par 1) or progress % (par 2+); 3★ % among par clears; ref = shortest-playback clearing sequence within par.

| Level | Par | Role | Forgiveness % | 3★ % | Ref steps | Max steps | Verdict |
|---|---|---|---|---|---|---|---|
| 1-1 First Light | 1 | teach | 3.17 | 48.91 | 96 | 2700 | 3★ above band (48.91 % > 40.00 %) |
| 1-2 Two Worlds | 1 | twist | 2.38 | 26.21 | 104 | 2700 | forgiveness above twist band (2.38 % > 2.00 %) |
| 1-3 Slingshot | 1 | test | 5.72 | 29.15 | 52 | 2700 | forgiveness above test band (5.72 % > 0.70 %) |
| 2-1 In The Way | 1 | teach | 2.62 | 26.55 | 87 | 2700 | in band |
| 2-2 Bent Path | 1 | twist | 2.06 | 49.44 | 98 | 2700 | forgiveness above twist band (2.06 % > 2.00 %); 3★ above band (49.44 % > 40.00 %) |
| 2-3 Threading | 1 | test | 2.04 | 29.55 | 90 | 2700 | forgiveness above test band (2.04 % > 0.70 %) |
| 3-1 The Key | 1 | teach | 0.21 | 33.33 | 133 | 2700 | forgiveness below teach band (0.21 % < 2.00 %) |
| 3-2 Hidden Key | 1 | twist | 0.23 | 50.00 | 157 | 2700 | forgiveness below twist band (0.23 % < 0.70 %); 3★ above band (50.00 % > 40.00 %) |
| 3-3 Key & Guard | 1 | test | 0.37 | 37.50 | 134 | 2700 | in band |
| 4-1 Double Tap | 2 | teach | 2.34 | 100.00 | 258 | 2700 | 3★ above band (100.00 % > 40.00 %) |
| 4-2 Spread | 2 | twist | 5.44 | 100.00 | 261 | 2025 | forgiveness above twist band (5.44 % > 2.00 %); 3★ above band (100.00 % > 40.00 %) |
| 4-3 Guarded Marks | 2 | test | 4.79 | 48.11 | 237 | 2700 | forgiveness above test band (4.79 % > 0.70 %); 3★ above band (48.11 % > 40.00 %) |
| 5-1 Key & Marks | 2 | teach | 4.51 | 25.00 | 297 | 2700 | in band |
| 5-2 Tight Squeeze | 1 | twist | 0.28 | 41.67 | 126 | 2700 | forgiveness below twist band (0.28 % < 0.70 %); 3★ above band (41.67 % > 40.00 %) |
| 5-3 Apogee | 2 | test | 6.78 | 50.00 | 202 | 2463 | forgiveness above test band (6.78 % > 0.70 %); 3★ above band (50.00 % > 40.00 %) |
| 6-1 Moonrise | 1 | teach | 1.61 | 28.90 | 89 | 2700 | forgiveness below teach band (1.61 % < 2.00 %) |
| 6-2 Slingshot Tide | 1 | twist | 0.98 | 29.29 | 120 | 2700 | in band |
| 6-3 Twin Moons | 1 | test | 1.11 | 27.79 | 92 | 2700 | forgiveness above test band (1.11 % > 0.70 %) |
| 7-1 Moon & Guard | 1 | teach | 0.78 | 33.58 | 125 | 2700 | forgiveness below teach band (0.78 % < 2.00 %) |
| 7-2 Keyed Orbit | 1 | twist | 0.11 | 34.21 | 104 | 2700 | forgiveness below twist band (0.11 % < 0.70 %) |
| 7-3 Moving Marks | 1 | test | 0.24 | 71.95 | 94 | 1557 | 3★ above band (71.95 % > 40.00 %) |
| 8-1 Through the Door | 1 | teach | 8.61 | 97.31 | 28 | 2700 | forgiveness above teach band (8.61 % > 6.00 %); 3★ above band (97.31 % > 40.00 %) |
| 8-2 Bent Passage | 1 | twist | 3.73 | 40.37 | 42 | 2700 | forgiveness above twist band (3.73 % > 2.00 %); 3★ above band (40.37 % > 40.00 %) |
| 8-3 Redirect | 1 | test | 9.42 | 37.59 | 29 | 435 | forgiveness above test band (9.42 % > 0.70 %) |
| 9-1 Portal Key | 1 | teach | 4.28 | 43.78 | 31 | 2700 | 3★ above band (43.78 % > 40.00 %) |
| 9-2 Split Marks | 2 | twist | 19.49 | 75.74 | 83 | 171 | forgiveness above twist band (19.49 % > 2.00 %); 3★ above band (75.74 % > 40.00 %) |
| 9-3 Gauntlet Gate | 1 | test | 10.37 | 40.18 | 23 | 140 | forgiveness above test band (10.37 % > 0.70 %); 3★ above band (40.18 % > 40.00 %) |
| 10-1 Convergence | 2 | teach | 1.66 | 40.47 | 79 | 280 | forgiveness below teach band (1.66 % < 2.00 %); 3★ above band (40.47 % > 40.00 %) |
| 10-2 Clockwork Lock | 2 | twist | 6.04 | 31.32 | 125 | 260 | forgiveness above twist band (6.04 % > 2.00 %) |
| 10-3 Event Horizon | 3 | test | 6.44 | 28.57 | 141 | 261 | forgiveness above test band (6.44 % > 0.70 %) |

### After

_Filled by Task 11._

### Playtest notes

_Filled by Task 12._

## Out of scope

- New mechanics or levels beyond 30; procedural levels.
- Daily generation tuning.
- Star-gated chapter unlocks (linear unlock stays).

## Success criteria

1. Every level sits in its role band; every chapter reads teach / twist / test in the sweep.
2. 3★ share among par clears is 10–40 % on every level.
3. Every reference flight ≤ 12 s; every moving level fails its ablation audit.
4. The map shows chapters and a star total.
5. Kevin fails to 3★ at least a third of the test levels on the first try, and clears every
   teach level within two attempts.
