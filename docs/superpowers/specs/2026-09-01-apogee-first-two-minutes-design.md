# Apogee — First Two Minutes Design Doc

*Brainstormed 2026-09-01. Sprint 3 of the [polish roadmap](./2026-09-01-apogee-polish-roadmap.md).
Depends on sprint 2 (HUD row, relative pull) and fun-debt Task 7 (tap-to-skip hint). Fixes
finding F1.*

## Why

A recruiter opens the URL, clicks Campaign, clicks level 1, and sees a small ring on the left, a
planet, and a dashed circle. Nothing says "drag to aim." The pad and the goal are both teal
rings. When a blocker, key, target, moon, or wormhole first appears, nothing names it. Landed
probes are three-pixel dots. The browser tab has no icon and a pasted link has no preview.
Everything past the first two minutes is in good shape; the first two minutes lose the player.

## Decisions locked (during brainstorming)

1. **One-time aim hint**, shown until the player's first launch ever (either mode), never again.
   Stored as `apogee-onboarded = "1"`.
2. **The pad becomes a solid emitter** (filled core + halo ring); the goal keeps its dashed ring
   and fill. The two no longer share a silhouette.
3. **`Level.intro?: string`** on the engine `Level` type — a one-line mechanic card shown the
   first time a chapter's opening level is opened. Ten strings, authored in this spec.
4. **Probes are drawn at 8 world units** (engine `PROBE_RADIUS` stays 5). Landed probes get a
   ring and a stronger glow.
5. **HUD objectives become glyph chips**: ◆ keys, ◎ targets, ⊚ goal.
6. **Page metadata**: inline SVG favicon, description, Open Graph tags with a 1200×630 image
   served from a new `packages/web/public/`, and `theme-color`.
7. **No text on the canvas.** Hint caption, cards, and chips are DOM, keeping sprint 2's rotation
   a pure transform.

## Section 1 — Aim hint

New pure module `packages/web/src/onboarding.ts`, following the `campaignStorage` pattern
(injected `Storage`, thin functions):

```ts
export function hasLaunchedBefore(storage: Pick<Storage, "getItem">): boolean;
export function markLaunched(storage: Storage): void;
```

UI: while `!hasLaunchedBefore`, the board shows a DOM caption under the canvas —
`drag anywhere to aim · release to launch` — and the pad pulses (a `padPulse: boolean` flag in
`BoardDrawOpts`, drawn as a slow-breathing halo). The first `onLaunch` from either board calls
`markLaunched`; the caption fades and the pulse stops. Reduced motion: no pulse, caption only.

## Section 2 — Pad emitter

`drawPad(ctx, pos, pulse, time)` shared by both renderers: a filled 6-unit core in `COLORS.pad`,
a 14-unit ring, a soft glow, and a 10-unit direction tick toward +x (the way every level's goals
lie). The goal ring is unchanged. The sprint-2 rubber band and pad tick draw on top.

## Section 3 — Mechanic intro cards

Engine: `Level.intro?: string`, set only on each chapter's first level. Data-only; the sim never
reads it.

| Level | Intro (≤ 90 characters) |
|---|---|
| 1-1 | Planets pull on your probe. Bend the shot into the goal ring. |
| 2-1 | Red worlds pull like planets and destroy anything that touches them. Curve around. |
| 3-1 | Keys unlock the goal. Fly through the key first; it stays collected between launches. |
| 4-1 | Marks: pass a probe through every one. Landed probes stay on the board. |
| 5-1 | Keys, marks, and guards together. Plan the order of your launches. |
| 6-1 | Moons orbit on a fixed clock. Their pull moves; time your launch. |
| 7-1 | Moons meet guards, keys, and marks. The preview is honest; watch the clock. |
| 8-1 | Wormholes: enter one mouth, leave the other, heading the way it faces. |
| 9-1 | Wormholes with keys, marks, and guards. The exit direction is the puzzle. |
| 10-1 | Capstone. Moons, wormholes, and everything before them. |

Web: `packages/web/src/campaign/intro.ts` — `introToShow(level, seen): string | null` and
storage helpers keyed `apogee-intro-seen` (JSON array of level ids). `CampaignLevel` renders the
card as an overlay panel (same `.overlay .panel` styling as the level-over card) with the level
name, the intro line, and one **Got it** button; tap anywhere, Space, or Enter dismisses. Shown
only on first open of that level; not on Retry. The board is inert underneath while the card is
up (`disabled` is already a prop).

## Section 4 — Readability

- `drawProbe` radius 8 (visual only). Landed: radius 8 plus a 14-unit ring at 0.6 alpha in the
  landed green and `shadowBlur` 16. In-flight glow unchanged; trail width scales with the new
  radius.
- The pulsing landed probe animation stays.
- Nothing about lost probes changes (still not drawn).

## Section 5 — HUD objective chips

`describeObjectives` returns structured chips instead of a string:

```ts
interface Chip { glyph: "◆" | "◎" | "⊚"; text: string; tone: "key" | "target" | "goal"; done: boolean }
// e.g. ◆ 0/1   ◎ 1/2   ⊚ locked | ⊚ open | ⊚ ✓
```

Rendered as `<span class="chip chip-key">◆ 0/1</span>` with palette colors (key gold, target
orange, goal teal) and `done` rendered brighter. Sprint 2 guarantees the row does not wrap; chips
must total ≤ 120 px at the base font on a 3-chip level.

## Section 6 — Page metadata

`packages/web/index.html`:

- `<link rel="icon" href="data:image/svg+xml,…">` — a teal ring on the deep-space background.
- `<meta name="description" content="Apogee — a space-curling puzzle. Sling probes through gravity, dodge the void, land in the rings.">`
- `<meta property="og:title|og:description|og:image|og:type">` and `twitter:card=summary_large_image`.
  `og:image` points at `/og.png` (absolute URL once sprint 4 fixes the host; relative until then).
- `<meta name="theme-color" content="#06070f">`.

`packages/web/public/og.png` — 1200×630 capture of level 13 mid-aim (the capture script is
scratch, the PNG is committed). Vite serves `public/` at the site root.

## Section 7 — Testing

- `onboarding.ts` and `intro.ts` storage helpers with an injected fake `Storage`, mirroring
  `campaignStorage.test.ts` (fresh → show; after mark → hide; corrupted JSON → treated as empty).
- `introToShow` picks the intro only for a chapter-opening level not yet seen.
- `describeObjectives` chip mapping for keys / targets / goal locked / open / reached.
- Engine: `campaign-levels.test.ts` asserts exactly the ten chapter-opening levels carry `intro`
  and each is ≤ 90 characters.
- Manual: fresh profile sees the hint once; every chapter's first level shows its card once and
  never on Retry; landed probes are visible at arm's length on a phone; a pasted link shows the
  image in a chat preview.

## Out of scope

- The tap-to-skip hint (fun-debt Task 7).
- A tutorial level or interactive walkthrough.
- Sound (sprint 6). Chapter headers on the map (sprint 5).

## Success criteria

1. A first-time player launches within ten seconds without being told how.
2. Every mechanic is named on screen before the first level that uses it.
3. Landed probes are visible at arm's length on a 390 px phone.
4. The tab has an icon and a pasted link previews with an image.
5. `pnpm test` and `pnpm typecheck` green; goldens untouched (`intro` is data the sim ignores).
