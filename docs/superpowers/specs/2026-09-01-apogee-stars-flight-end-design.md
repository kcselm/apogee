# Apogee — Stars & Flight End Design Doc

*Brainstormed 2026-09-01. Sprint 1 of the [polish roadmap](./2026-09-01-apogee-polish-roadmap.md).
Depends on fun-debt Task 1 (par-based stars, merged). Fixes findings F3b and F4.*

## Why

Two engine-level problems make the mastery loop dead on arrival:

1. **3★ is impossible on goal levels and automatic on target levels (F4).** `bestPrecision` is
   sampled at *first sensor contact*. A goal (radius 36–40, plus the probe's 5) triggers when the
   probe is 35–45 units from its center — always outside the 30-unit inner ring, so the 3★ bar is
   unreachable unless the probe is falling faster than 900 u/s (the sweep found one such input in
   ~200 000). A target (radius 24–26) triggers at 29–31 units — inside the ring, so every clear is
   3★. The fun-debt star tiers are right; the measurement under them is wrong.
2. **The sim keeps running after the level is cleared (F3b).** `simulateCampaignLaunch` stops only
   when every probe has landed or been lost. A clearing shot that then orbits plays back for up to
   45 s before the panel appears (levels 9 and 29 today). The player has already won and is
   locked out of the UI.

## Decisions locked (during brainstorming)

1. **Precision = closest approach during the triggering pass.** After a sensor triggers, the sim
   tracks the minimum distance from the triggering probe to the sensor center for as long as that
   probe stays inside the sensor zone. `bestPrecision` takes `precisionPoints(minDist)` when the
   pass closes. Sensors stay sticky (trigger once per level).
2. **3★ moves to the bullseye ring: `bestPrecision ≥ 5` (closest approach ≤ 14 units).** With
   closest approach, the 30-unit inner ring would cover roughly three quarters of the chords
   through a goal and become automatic. The 14-unit bullseye covers about a third of goal chords
   and under half of target chords — a real tier. Sprint 5's sweep validates the resulting 3★
   rate (10–40 % of par clears) and tunes per level by sensor radius, never by editing `RINGS`.
3. **The launch result gains `clearedAtStep: number | null`** — the step at which all objectives
   first became met during this launch. Additive; existing callers ignore it.
4. **The web trims playback to `clearedAtStep + CLEAR_TAIL` (36 frames, 0.6 s).** The engine
   still simulates the whole flight; the resulting state is unchanged. Only what the player
   watches is shortened.
5. **Sim state is unchanged.** `probes`, `keysCollected`, `targetsHit`, `goalReached` are computed
   exactly as today, so the campaign golden's sim fields stay byte-identical; only `bestPrecision`
   and `stars` may change in the snapshot. The daily engine and golden are untouched.
6. **Pars are unchanged.** Par counts launches, which this sprint does not affect.

## Section 1 — Closest-approach precision (engine)

`packages/engine/src/campaign/simulate.ts`, step 3 (sensors). Today:

```
if (!triggered[i] && within(probe, center, r + PROBE_RADIUS)) {
  triggered[i] = true;
  bestPrecision = max(bestPrecision, precisionPoints(dist));   // first contact
  events.push(...)
}
```

New: a per-launch, per-sensor pass record `{ probe: number; minDist: number } | null` for each
target and for the goal. Keys carry no precision and keep today's trigger-only behaviour. Per
step, per probe that is not `lost`, per precision sensor:

- **Trigger** (sensor untriggered, probe within zone): set the sticky flag, emit the event as
  today, open a pass `{ probe, minDist: dist }`.
- **Continue** (pass open for this probe, probe within zone): `minDist = min(minDist, dist)`.
- **Close** (pass open for this probe, probe no longer within zone): fold
  `precisionPoints(minDist)` into `bestPrecision`, clear the pass.
- **Launch end** (loop exits for any reason): close every open pass the same way. A probe that
  lands inside a surface goal never leaves the zone, so its pass closes here with the minimum
  seen up to and including its landing position.

Only the probe that triggered the sensor is tracked; other probes (landed ones sitting nearby,
a second flying probe after a collision) do not affect the pass. The goal's zone test stays gated
on `keysCollected.every(Boolean)`; the key → target → goal order within a step is unchanged, so a
key collected mid-flight unlocks the goal in the same step exactly as today.

`precisionPoints` and `RINGS` are unchanged: ≤ 14 → 5, ≤ 30 → 3, ≤ 55 → 1, else 0. Numeric code
stays `+ − × ÷ sqrt`; `dist` is the same `distTo` value used today.

**Semantics note.** `bestPrecision` remains the max over all passes across all launches, sticky
in state. On multi-target levels one precise pass still suffices (unchanged from fun-debt).

## Section 2 — Star rule

```
starRating(state) → { stars }
  0★  objectives not cleared
  1★  cleared
  2★  cleared AND launchesUsed ≤ level.par
  3★  2★ AND bestPrecision ≥ 5      // bullseye: closest approach ≤ 14 units
```

`packages/web/src/campaign/ratingText.ts` third criterion text becomes
`closest approach in the bullseye`. The level-complete panel is otherwise unchanged.

Existing saves keep their stars (fun-debt decision 6 stands): no claw-back.

## Section 3 — Flight end on clear

**Engine.** `simulateCampaignLaunch` returns
`{ state, trace, events, clearedAtStep: number | null }`. After the sensor pass in each step, if
`clearedAtStep` is still null and `evaluateObjectives` over the working flags would be true,
record the current step. Computing it inline from the working `keysCollected` / `targetsHit` /
`goalReached` copies avoids constructing a state per step. `trace` and `events` are unchanged.

**Web.** `CampaignLevel.tsx` keeps the full engine result for `onAnimDone` (the next state's
probes come from the complete sim, as today) but hands the board a trimmed trace:

```ts
// packages/web/src/space/playback.ts (pure; fun-debt Task 6 creates this module)
export const CLEAR_TAIL = 36;
export function trimToClear<T>(trace: T[], clearedAtStep: number | null, tail = CLEAR_TAIL): T[]
  // clearedAtStep === null → trace unchanged; else trace.slice(0, min(len, clearedAtStep + 1 + tail))
```

The board plays the trimmed trace; `onAnimDone` fires at its end; the level-over panel appears
over the board with the probe frozen at its last drawn frame. The overlay blur covers the fact
that the engine's final probe position differs; the level is over, so nothing else reads it.

**Clear burst.** The land/lost bursts do not fire on a trimmed flight (the probe is still
flying). Instead, when the board reaches `clearedAtStep` it pushes a `clear` burst (teal ring,
same `Burst` machinery, `kind: "clear"`) at the probe's position. Fun-debt's skip runs the
remaining frames of the *trimmed* trace, so skip and watch agree.

**Daily.** `simulateLaunch` has no objectives and is untouched; the daily board never trims.

## Section 4 — Testing

**Engine unit tests** (`campaign-simulate.test.ts`, `campaign-scoring.test.ts`):

- Straight pass through a goal's center → `bestPrecision` 5; pass with closest approach 20 → 3;
  graze at 38 → 1; probe that lands on a surface goal → precision of its landing distance.
- A probe that leaves the goal zone and re-enters later does not reopen a pass (sticky trigger).
- Two targets crossed in one flight each get their own pass; `bestPrecision` is the max.
- `bestPrecision` is sticky across launches (a later worse pass does not lower it).
- Star boundaries: at par with precision 5 → 3★; at par with 3 → 2★; over par with 5 → 1★.
- `clearedAtStep` is null when not cleared; equals the step of the last needed sensor event on
  a targets-plus-goal level; the trace continues past it.

**Goldens.** `golden.test.ts` (daily) unchanged. `campaign-golden.test.ts`: sim fields
byte-identical; `bestPrecision` / `stars` updated in one deliberate commit whose message says
why.

**Solvability.** Every recorded solution still clears within par. Stars on those replays may
drop to 2★ — the test asserts clearing, not stars.

**Web.** `trimToClear` unit tests (null passthrough, tail clamped to length, exact slice);
`starCriteria` text test updated.

## Out of scope

- Retuning sensor radii, budgets, or pars (sprint 5).
- Playback speed, skip, reduced-motion behaviour (fun-debt Tasks 6–7).
- Any daily-mode change.

## Success criteria

1. On every level, at least one aim-grid input at par earns 3★, and on no level does every
   clearing input earn 3★ (checked with an ad-hoc sweep from scratch). This sprint changes no
   layouts: a level that fails the check is recorded in the sprint-5 retune table instead.
2. No flight plays more than 0.6 s past the clearing contact.
3. Campaign golden sim fields byte-identical; daily golden untouched; `pnpm test` and
   `pnpm typecheck` green.
