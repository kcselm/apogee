# Apogee — Deep Space Visual Polish — Design Doc

*A visual/feel polish pass to make Apogee read as a professional, atmospheric space game. Brainstormed 2026-06-14. Builds on [the original design doc](./2026-06-11-apogee-design.md).*

## Goal

Take the current functional-but-flat presentation and give it depth, atmosphere, and motion — without touching the deterministic engine. The whole app should feel like one continuous universe, and the screens you don't play in (home, campaign map, overlays) should feel as considered as the board itself.

## Decisions (locked during brainstorming)

| Decision | Choice | Rationale |
|---|---|---|
| **Art direction** | **Deep Space** — atmospheric & rich | Nebulae, glowing planet halos, bloom. Maps onto the existing navy/cyan/amber palette, so it's enrichment, not a repaint. |
| **Scope** | **Full sweep** | Gameplay canvas *and* all chrome (home, HUD, game-over overlay, campaign map) for an end-to-end consistent look. |
| **Motion** | **Rich & playful** | Ambient twinkle/drift + shooting stars + probe particle trails + parallax that reacts to the aim drag. |
| **Architecture** | **Shared cosmos backdrop + enriched game canvas** | One animated backdrop behind every screen; the game canvas overlays only the interactive system. Most cohesive, cheapest motion. |

## Hard constraints

- **The engine is not touched.** `packages/engine` stays pure and deterministic. All visual randomness (starfield layout, planet-type assignment, nebula) is **render-only**, seeded by the existing `mulberry32` PRNG re-exported from the engine. Same seed → same look, but nothing here feeds back into the simulation.
- **Engine golden tests stay green.** The render changes live entirely in `packages/web`. The existing `golden.test.ts` / `campaign-golden.test.ts` snapshots assert *simulation* state and are unaffected.
- **`prefers-reduced-motion` is respected** everywhere motion is introduced — it is a first-class fallback, not an afterthought.
- **Mobile-first performance budget.** The game is touch-playable and responsive; every effect must hold up on a mid-range phone.

## Section 1: Architecture & layers

Three cooperating layers, back to front:

1. **`<SpaceBackdrop>`** (new React component) — a fixed, full-viewport `<canvas>` behind everything. Renders the shared cosmos: nebula, parallax starfield, occasional shooting stars. Mounted once in `App.tsx`, persists across screen changes so the sky is literally continuous as you navigate.
2. **Game `<canvas>`** — becomes transparent over the backdrop and draws only the interactive system: planets, scoring rings / goals / keys / targets, launch pad, probes, trails, aim preview, and a few near-field dust motes for parallax depth.
3. **Chrome (DOM)** — home, HUD, overlays, campaign map — styled glassy so the cosmos shows through.

**One shared clock.** A single `requestAnimationFrame` loop provides a monotonic `time` (ms) used by both the backdrop and the game renderer. The loop:
- runs continuously (not just during launches, as today), so ambient motion is always alive;
- **pauses when `document.hidden`** (no wasted battery on a backgrounded tab);
- **collapses to a one-shot static render when `prefers-reduced-motion` is set** — draw once, no ongoing loop.

**Parallax input.** The current pointer/drag vector (already tracked in `GameCanvas` for aiming) is passed to the renderers so the starfield and near-field dust shift subtly as you pull back to aim.

## Section 2: The cosmos backdrop (shared)

- **Nebula:** 3–4 layered radial gradients (violet / blue / teal) over near-black (`#06070f`). Painted **once to an offscreen canvas** and blitted each frame; it drifts *very* slowly via a sub-pixel translation so it never costs a re-gradient per frame.
- **Starfield:** three parallax depth layers, each seeded deterministically via `mulberry32`. Counts capped (~150–200 total). Each layer twinkles at its own rate (opacity driven by a cheap per-star phase) and offsets by depth against both a slow ambient drift and the aim-drag parallax.
- **Shooting stars:** an occasional streak-with-tail (every several seconds), spawned from the seeded RNG so timing is stable. Suppressed under reduced motion.

The backdrop is screen-space, not world-space — distant stars are *meant* to sit behind the action and not track world coordinates.

## Section 3: Planets & bodies (game canvas)

- **Planet types** — `gasGiant | rocky | ice` — assigned **deterministically from each body's position + the system seed** (a pure helper in the web layer; the engine still only knows radius/position/mass). Each type renders as:
  - a **body gradient** (type-specific palette),
  - an **inset terminator shadow** for sphericity,
  - an **atmosphere halo** (outer glow), tinted per type.
  - The gas giant additionally gets subtle banding.
- **Blockers** (campaign hostile bodies) keep their red identity but enriched: a molten/dark body with a **pulsing hazard ring**.
- **Launch pad:** a glowing teal ring with an inner dot and a gentle pulse.

## Section 4: Scoring rings, goal, keys, targets

- **Scoring rings** keep their **semantic colors** (amber = 5, cyan = 3, indigo = 1) — now with an outer glow and a faint inner fill on the innermost ring.
- **Goal portal** (campaign): dim + dashed when locked; glowing teal with a slow rotation/shimmer when unlocked.
- **Keys** (campaign): glinting diamonds with a sparkle; dimmed once collected.
- **Targets** (campaign): an open ring with a soft fill; a green glow "pop" when hit.

## Section 5: Probes, launch, aim, impacts

- **Probes:** white glowing dots; a **landed** probe pulses green. An in-flight probe carries a **capped particle trail** that fades behind it.
- **Aiming:** the existing dashed predicted-path preview, plus a glowing drag vector at the pad. Near-field elements parallax slightly against the drag.
- **Impact feedback:** a small, brief burst when a probe lands / scores / is lost. Subtle, and suppressed under reduced motion.

## Section 6: Chrome (React screens)

All chrome sits on the shared cosmos and adopts a small shared palette (CSS custom properties).

- **Home:** glowing "APOGEE" wordmark, refined letter-spacing, glassy space-buttons with a subtle border glow.
- **HUD:** refined typography, tabular-num stats, cleaner launch-pip styling, a quiet divider.
- **Game-over overlay:** a blurred glass panel with an animated score count-up and star pips.
- **Campaign map:** level tiles become glassy "mission" cards — unlocked cards carry a soft glow, locked cards dim with a lock, star rows refined.
- **Transitions:** screens cross-fade through the shared sky rather than hard-cutting.

## Section 7: Performance & accessibility

- Offscreen-cache the nebula; blit, don't re-gradient.
- Cap star and particle counts; trails are bounded ring buffers.
- One shared rAF clock; **pause on `document.hidden`**.
- **`prefers-reduced-motion`:** no twinkle / drift / shooting stars / parallax / trails / count-up — a single static render of the enriched scene (gradients + glow only).
- DPR-aware canvas sizing for crispness on high-density screens (verify/extend current `GameCanvas` handling).

## Section 8: Files

| File | Change |
|---|---|
| `web/src/space/SpaceBackdrop.tsx` | **New.** Shared backdrop component + its canvas and the shared rAF clock / reduced-motion / visibility handling. |
| `web/src/space/cosmos.ts` | **New.** Pure-ish draw/update helpers for nebula (offscreen cache), starfield (seeded, parallax, twinkle), and shooting stars. Take `time` + seed + pointer. |
| `web/src/render.ts` | Enrich planet (type derivation + glow), ring, goal, key, target, probe drawing; add trails; accept `time` + pointer; draw on a transparent background. |
| `web/src/GameCanvas.tsx` | Continuous rAF loop (not just during launch); transparent canvas; pass `time` + pointer; reduced-motion/visibility gating. |
| `web/src/styles.css` | Chrome restyle: palette CSS variables, glassy buttons, glass overlay, mission-card tiles, cross-fade transitions. |
| `web/src/App.tsx` | Mount `<SpaceBackdrop>` behind all views; add screen cross-fade. |
| `web/src/campaign/CampaignMap.tsx`, `CampaignLevel.tsx` | Minor class/markup tweaks for the new tile/HUD styling (no logic change). |

## Section 9: Testing & verification

- **Engine:** unchanged; existing golden/determinism tests must stay green (proves the engine wasn't touched).
- **Web:** keep existing component tests green. The renderer is visual; correctness is verified by **manual play** plus a few guards:
  - a smoke test that `SpaceBackdrop` mounts and the game canvas renders without throwing,
  - a check that with `prefers-reduced-motion` the render path takes the static branch (no rAF scheduled).
- **Determinism of look:** given a fixed seed, the starfield/planet-type assignment is stable (pure function of seed) — optionally asserted with a small unit test on the derivation helpers.
- **Manual pass:** desktop + mobile viewport, normal and reduced-motion, across home → daily → campaign map → level, confirming the sky stays continuous and the loop pauses when hidden.

## Out of scope (parked)

- Phase 2 share-images / replay re-compositing of the backdrop (the shared-backdrop choice means a future share-image must re-composite the cosmos; noted, not built now).
- Sound / music.
- Themeable palettes / multiple skins.
- Any change to gameplay, scoring, or generation.
