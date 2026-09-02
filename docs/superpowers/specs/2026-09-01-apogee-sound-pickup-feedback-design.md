# Apogee — Sound & Pickup Feedback Design Doc

*Brainstormed 2026-09-01. Sprint 6 of the [polish roadmap](./2026-09-01-apogee-polish-roadmap.md).
Depends on fun-debt Task 7 (skip) for cue batching; otherwise independent. Fixes finding F9.*

## Why

The game is silent, and the one piece of mid-flight feedback the engine already produces —
`SensorEvent`s with the exact step a key or target was hit — is thrown away by `CampaignLevel`.
Keys stay lit and targets stay dark until the flight ends and React re-renders. Five short cues
and frame-accurate pickups change how finished the game feels more than any further visual work.

## Decisions locked (during brainstorming)

1. **Web Audio, synthesized.** No audio files; every cue is an oscillator/noise recipe in data.
2. **Six cues**: launch, land, lost, pickup (key and target variants by pitch), clear, fail.
3. **AudioContext is created lazily** on the first `pointerdown` or `keydown` anywhere and
   resumed on `visibilitychange`, satisfying autoplay policy.
4. **Mute toggle in the HUD**, persisted as `apogee-muted`; default unmuted; master gain 0.35.
5. **Sensor events flow into playback.** The board hook receives `events` with the trace and
   fires them at the matching frame, driving both the pickup cue and a mid-flight visual (key
   dims, target lights) via a "collected as of this frame" view passed to the renderer.
6. **Cues are data, playback is an interface.** `SoundPlayer { play(cue); setMuted(b) }` with a
   `WebAudioPlayer` and a recording fake for tests.
7. **The daily board** gets launch / land / lost through the shared hook and nothing else.

## Section 1 — Cue design

`packages/web/src/space/audio/cues.ts`:

```ts
export interface Cue {
  name: CueName;
  parts: Part[];                       // played together (offsets allow arpeggios)
}
type Part =
  | { kind: "tone"; wave: OscillatorType; from: number; to: number; ms: number; gain: number; at?: number }
  | { kind: "noise"; ms: number; gain: number; at?: number };
```

| Cue | Trigger | Recipe |
|---|---|---|
| launch | `onLaunch` fires | sawtooth 220→90 Hz, 180 ms, gain 0.4 + noise 60 ms, gain 0.25 |
| land | probe state → landed (existing burst site) | sine 160 Hz flat, 90 ms, gain 0.5 + noise 40 ms, gain 0.15 |
| lost | probe state → lost | triangle 300→120 Hz, 350 ms, gain 0.35 |
| pickup-key | `SensorEvent` type key | sine 880→1320 Hz, 120 ms, gain 0.4 |
| pickup-target | `SensorEvent` type target (and goal) | sine 660→990 Hz, 120 ms, gain 0.4 |
| clear | level-over with `cleared` | three sines 523 / 659 / 784 Hz, 90 ms each, at 0 / 100 / 200 ms |
| fail | level-over without `cleared` | two triangles 392 then 294 Hz, 140 ms each, at 0 / 150 ms |

Every part uses a 5 ms attack and a linear release over its `ms`. Frequencies stay within
90–1320 Hz. Cues are ≤ 400 ms so overlapping events never smear.

## Section 2 — Architecture

- `space/audio/cues.ts` — data (above), pure, tested.
- `space/audio/player.ts` — `SoundPlayer` interface; `WebAudioPlayer` (lazy context, master gain,
  `unlock()`, `setMuted`); `RecordingPlayer` for tests; `NullPlayer` for SSR/tests.
- `space/audio/sound.ts` — module singleton `sound: SoundPlayer` plus `installUnlock(document)`
  that resumes the context on first `pointerdown`/`keydown` and on tab focus. `main.tsx` calls it
  once.
- `space/audio/events.ts` — pure `collectedAsOf(level, events, frame)` →
  `{ keys: boolean[]; targets: boolean[]; goal: boolean }` for the renderer, and
  `eventsInRange(events, fromFrame, toFrame)` for the hook.

Hook (`useBoardCanvas`):

- `anim` becomes `{ trace, events }` (daily passes `events: []`).
- Each rendered frame, events in `(prevFrame, frame]` are dispatched through
  `adapter.onEvent?.(event)`; `CampaignLevel` maps them to `pickup-key` / `pickup-target`.
- `BoardDrawOpts` gains `collected` from `collectedAsOf`, and `drawCampaignFrame` uses it instead
  of `state.keysCollected` / `state.targetsHit` while animating, so a key dims and a target lights
  on the exact frame. Outside animation `collected` mirrors `state`.
- `launch` plays in `onUp` after `shouldFire`; `land` / `lost` play where bursts are pushed.
- **Skip** (fun-debt Task 7): when the remaining frames run synchronously, dispatch the skipped
  events once, but coalesce pickups to at most one cue, then let the terminal cue play.

`CampaignLevel` plays `clear` / `fail` when `over` becomes true. `DailyGame` plays nothing extra.

## Section 3 — Mute & autoplay

A `🔊` / `🔇` button at the right end of `.hud` (both modes and the map), `aria-pressed`,
persisted through `appStorage` (sprint 4) under `apogee-muted`. Muted means `play` is a no-op;
the context is still unlocked so unmuting is instant. If the context cannot be created (old
Safari, headless), the player degrades to `NullPlayer` and the button hides.

Reduced motion does not affect sound.

## Section 4 — Testing

- `cues.test.ts`: every cue has ≥ 1 part; all frequencies within 90–1320 Hz; total length
  ≤ 400 ms; gains ≤ 0.5.
- `events.test.ts`: `collectedAsOf` at frame 0 is the pre-launch state; at the event frame the
  flag flips; after the last frame it equals the engine's post-launch state (property check over
  recorded solutions).
- Hook-adjacent logic tested through `RecordingPlayer`: given a trace with a land at frame 40 and
  a key event at frame 20, the cue sequence is `launch, pickup-key, land`; a skipped flight with
  three pickups records one pickup then the terminal cue.
- Mute persistence via the storage fake.
- Manual: iOS Safari unlock on first tap; volume sanity with the laptop at half volume; no
  autoplay warnings in the console; keys dim mid-flight.

## Out of scope

- Music, ambient loops, haptics, per-cue volume settings.
- Positional/stereo panning.
- Any daily-mode cue beyond the three flight cues.

## Success criteria

1. Every launch, landing, loss, pickup, clear, and fail is audible unless muted.
2. Keys dim and targets light on the frame they are hit, in both watched and skipped playback.
3. Mute persists across reloads; the console shows no autoplay warnings.
4. `pnpm test` and `pnpm typecheck` green; engine untouched.
