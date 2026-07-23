# Apogee — Fun-Debt Sprint (Stars, Necessity, Playback) Design Doc

*Brainstormed 2026-07-22. Follows the [moving-mechanics design](./2026-07-21-apogee-moving-mechanics-design.md);
pays down the tuning debt that merge deliberately deferred.*

*Audience decision (this session): Apogee targets **friends & family + portfolio** — no public
launch. Phase 2 server / verified leaderboards, head-to-head, and PWA install are cut from the
roadmap. Sprint order: this fun-debt sprint → first-impression & retention sprint (tutorial,
sound, share card, stats) → deploy. Each sprint gets its own spec.*

## Why

Three known problems stand between "solid core" and "fun game":

1. **Stars don't discriminate.** `levelScore = spareLaunches×5 + bestPrecision` against
   generous budgets means clearing 6-1 (budget 4, 1-launch solution) with *zero precision*
   scores 15 — past its 3★ threshold of 11. 3★ is a participation trophy, so the mastery
   loop (the reason to replay a level) is dead.
2. **Mechanics can be incidental.** Several moving levels (chapters 6–10) clear with a
   trivial straight launch that never uses the moon or wormhole the level exists to teach.
3. **Playback is frame-rate-dependent and unskippable.** One sim step per rAF ⇒ ~2× speed
   on 120 Hz displays; a worst-case orbit locks input for ~45 s. Rage-quit material.

## Decisions locked (during brainstorming)

1. **Par-based stars: finish / efficient / perfect.** 1★ = clear, 2★ = clear at par,
   3★ = par **and** inner-ring precision. Budgets stay generous so casual players still
   finish; stars become explicit skill tiers. (Rejected: tightening budgets — punishes
   merely-clearing; retuning thresholds — keeps the formula opaque.)
2. **3★ precision bar = inner ring (`bestPrecision ≥ 3`,** first contact within 30 units of
   a sensor center, per `RINGS`). Requiring a 14-unit bullseye on top of par is too brutal
   for this audience.
3. **Necessity is defined by ablation.** A mechanic is "necessary" iff the level stops being
   solvable when that mechanic is deleted. Testable, not vibes.
4. **Chapters 1–5 and the Daily keep their layouts and sim behavior unchanged.** Audit and
   relayouts touch chapters 6–10 only; static-gravity levels' mechanic *is* gravity. (Star
   *ratings* change campaign-wide by design — that's the point of the sprint.)
5. **Playback runs at a fixed 60 sim-steps/sec and is skippable** (tap/click/Space) in both
   the daily and campaign boards (shared hook).
6. **Existing saves stand.** `campaignStorage` keeps its key and `{cleared, stars}` shape;
   previously earned (inflated) stars are not clawed back — only Kevin has a save.

## Section 1 — Par-based stars (engine)

**Type changes** (`packages/engine/src/campaign/types.ts`):

- `Level` gains `par: number` — the smallest launch count known to clear the level.
- `Level` drops `starThresholds`. `LAUNCH_BONUS` and `levelScore` disappear.

**Rating** (`packages/engine/src/campaign/scoring.ts`):

```
starRating(state) → { stars: 0 | 1 | 2 | 3 }
  0★  objectives not cleared
  1★  cleared
  2★  cleared AND launchesUsed ≤ level.par
  3★  2★ AND bestPrecision ≥ 3   (inner ring, ≤30 units at first sensor contact)
```

`bestPrecision` semantics are unchanged: the max of `precisionPoints` over every *first*
contact with a goal/target, sticky across launches. On multi-target levels one precise hit
suffices — accepted for simplicity; the playtest checkpoint judges whether it feels right.

**Par values.** Chapters 6–10 seed from the recorded `SOLUTIONS` lengths (all 1–2 today;
re-derived after relayouts). Chapters 1–5 have no recorded solutions — run the `SOLVE=1`
discovery sweep to find minimal clears, record them in `SOLUTIONS`, and set par from them.
After this sprint every level has a provable par: the solvability test asserts each recorded
solution clears **within par** (par is never aspirational).

**Web UI** (`CampaignLevel.tsx`, `CampaignMap.tsx`): the score line ("cleared — score N")
becomes launches-vs-par plus a precision word, e.g. `cleared in 1/1 · inner ring`. The
level-complete panel states the star criteria so players learn what 2★/3★ *mean*. Map tiles
are unchanged (stars only).

## Section 2 — Mechanic-necessity audit + relayouts (chapters 6–10)

**Ablation audit.** For each moving/portal level, build an ablated twin:

- *Moon levels:* orbiting bodies keep position, radius, and collision — but `mass = 0`.
  (Moving gravity is the mechanic; a moon as a mere moving wall doesn't count.)
- *Portal levels:* `portals` removed entirely.
- Orbiting sensors (keys/targets riding orbits) are pickups, not ablatable — skipped.

Run the existing discovery sweep (dx/dy/launchTick grid) against the ablated twin. **If the
ablated level is solvable within its launch budget, the level is flagged as bypassable.**
The audit lives beside `discover-solutions` as a `SOLVE=1`-gated vitest tool (too expensive
for CI; CI continues to replay recorded solutions only).

**Relayouts.** Every flagged level is relayouted until its ablated twin is unsolvable within
budget, preserving the chapter's theme and the ladder's difficulty beats. Escape hatch: if
geometry can't fully forbid a brute-force multi-launch bypass without becoming contrived,
"ablated twin needs ≥ par + 2 launches" is acceptable — documented per level in the level
file and confirmed at the playtest checkpoint. After each relayout: re-discover the
solution, update `SOLUTIONS` and `par`, regenerate that level's golden.

## Section 3 — Fixed-rate, skippable playback (web)

In `packages/web/src/space/useBoardCanvas.ts`:

- **Fixed rate:** an accumulator drives exactly 60 sim steps/sec from rAF timestamps
  (`SIM_HZ = 60`), independent of display refresh. No interpolation — at 120 Hz a step
  simply renders twice. Background tabs already pause via the existing visibility handler.
- **Skip:** during playback, pointer-down or Space runs all remaining steps synchronously
  (the sim is deterministic and cheap) and lands the end state + terminal effects
  immediately. Results are bit-identical to watching — same sim, batched.
- **Hint:** a "tap to skip" affordance fades in after ~2 s of playback, styled like the
  existing chrome.
- Reduce-motion behavior is unchanged (ambient effects stay frozen; playback still moves
  because it *is* the game — skip is the mercy mechanism).

## Section 4 — Playtest checkpoint (Kevin)

After Sections 1–3 land locally, Kevin plays chapters 6–10 and judges what automation
can't: does the slingshot read well, does the honest preview "breathe," is par
fair-but-earned (3★ takes real attempts, not luck), does skip feel right, do relayouted
levels still teach their mechanic gently? Notes become data-only tuning commits (budgets,
pars, layouts). This checkpoint is **in** the sprint — the sprint isn't done until the feel
pass is.

## Section 5 — Tests & rides-along

- **Goldens.** The daily golden (`golden.test.ts`) is untouched. The campaign golden's two
  fixture levels swap `starThresholds` for `par`; their sim fields (`probes`,
  `keysCollected`, `goalReached`, `bestPrecision`, `cleared`) must stay byte-identical and
  only the snapshotted `stars` value may change under the new rating. (The working tree's
  current golden-snap modification is line-endings-only autocrlf noise — no content to
  preserve.) Chapters 1–5 have no per-level goldens; their "unchanged" guarantee is: no
  edits to their `levels.ts` entries beyond adding `par`/removing `starThresholds`, plus
  solution replays clearing within par.
- **New unit tests:** star boundaries (at/over par; precision 1 vs 3 at par; uncleared ⇒ 0★),
  solvability-within-par for every level, plus two cheap fast-follows from last sprint:
  a direct portal re-entry-cooldown test and portal-pairing rejection of self-links
  (`p.link !== i`).
- **Engine discipline unchanged:** `+ − × ÷ sqrt` only, additive guards, determinism tests.

## Out of scope

Tutorial, sound, share card, stats/streaks (next sprint); deploy + localStorage guard
(ship-it sprint); practice mode (parked); any Daily or chapters 1–5 gameplay change;
mid-game persistence.

## Success criteria

1. On every level, 3★ requires clearing at par with inner-ring precision — verified by unit
   tests and by Kevin failing to 3★ at least some levels on the first try.
2. Every chapter 6–10 level's signature mechanic survives the ablation audit.
3. Playback speed is identical on 60 Hz and 120 Hz; any flight can be skipped instantly.
4. `pnpm test` and `pnpm typecheck` green; the daily golden and the campaign golden's sim
   fields byte-identical; chapters 1–5 layouts untouched.
