import {
  PROBE_RADIUS,
  RINGS,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  mulberry32,
  orbitPositionAt,
  type CampaignLevelState,
  type GameState,
  type ProbeFrame,
} from "@apogee/engine";
import type { Burst } from "./space/effects";
import { burstProgress } from "./space/effects";
import { COLORS } from "./space/palette";
import { PLANET_PALETTES, planetTypeFor, type PlanetType } from "./space/planetStyle";
import { pathSegments } from "./space/previewPath";

/** Near-field dust (render-only); parallaxes with the aim drag for depth. */
const DUST: { x: number; y: number; r: number }[] = (() => {
  const rng = mulberry32(0xd057);
  return Array.from({ length: 28 }, () => ({
    x: rng() * WORLD_WIDTH,
    y: rng() * WORLD_HEIGHT,
    r: 0.6 + rng() * 1.4,
  }));
})();

const RING_COLORS = COLORS.ringPoints;

function drawDust(
  ctx: CanvasRenderingContext2D,
  drag: { dx: number; dy: number } | null,
  animate: boolean,
): void {
  const ox = animate && drag ? -drag.dx * 0.012 : 0;
  const oy = animate && drag ? -drag.dy * 0.012 : 0;
  ctx.fillStyle = "rgba(200,215,255,0.5)";
  for (const d of DUST) {
    ctx.beginPath();
    ctx.arc(d.x + ox, d.y + oy, d.r, 0, Math.PI * 2);
    ctx.fill();
  }
}

export interface RenderView {
  game: GameState;
  /** Live positions during animation; falls back to game.probes when null. */
  probeFrames: ProbeFrame[] | null;
  /** New-probe preview path while aiming. */
  previewPath: { x: number; y: number }[] | null;
  /** Current drag vector while aiming (drawn at the launch pad). */
  drag: { dx: number; dy: number } | null;
  /** Recent positions of the in-flight probe (oldest→newest), or null. */
  trail: { x: number; y: number }[] | null;
  /** Active impact bursts to draw. */
  bursts: Burst[];
  /** Loop time in ms (frozen at 0 under reduced motion). */
  time: number;
  /** Whether ambient motion is enabled this frame. */
  animate: boolean;
}

const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);
const hsla = (h: number, s: number, l: number, a = 1): string =>
  `hsla(${Math.round(h)}, ${clamp(s, 8, 85)}%, ${clamp(l, 10, 92)}%, ${a})`;

/** Gas-giant color families (base hue/sat/light). One is picked per planet so no
 *  two gas giants look alike — jovian orange, pale gold, ice-blue, rust, teal,
 *  dusty violet, slate-grey. */
const GAS_THEMES: { h: number; s: number; l: number }[] = [
  { h: 32, s: 48, l: 60 },
  { h: 44, s: 40, l: 70 },
  { h: 206, s: 42, l: 56 },
  { h: 12, s: 52, l: 52 },
  { h: 165, s: 30, l: 54 },
  { h: 268, s: 26, l: 56 },
  { h: 28, s: 16, l: 58 },
];

/** Cached offscreen planet sprites — rich detail rendered once, blitted per frame. */
const planetCache = new Map<string, HTMLCanvasElement>();

/** Render a fully-shaded planet centered at (cx,cy) into `ctx` (used for the sprite). */
function renderPlanetSphere(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  type: PlanetType,
  seed: number,
): void {
  const pal = PLANET_PALETTES[type];
  const rand = mulberry32(seed);
  // Gas giants pick a color family up front so the halo matches the body.
  const theme = type === "gasGiant" ? GAS_THEMES[Math.floor(rand() * GAS_THEMES.length)]! : null;

  // Atmosphere halo.
  const haloR = r * 1.55;
  const halo = ctx.createRadialGradient(cx, cy, r * 0.82, cx, cy, haloR);
  halo.addColorStop(0, theme ? hsla(theme.h, theme.s + 8, theme.l, 0.42) : pal.halo);
  halo.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(cx, cy, haloR, 0, Math.PI * 2);
  ctx.fill();

  // Surface, clipped to the disc.
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();

  if (theme) {
    // Banded base: latitude zones/belts generated from this planet's color
    // family, with per-band hue/lightness jitter and a varied band count so no
    // two gas giants share a palette.
    const n = 12 + Math.floor(rand() * 5);
    const g = ctx.createLinearGradient(0, cy - r, 0, cy + r);
    for (let i = 0; i < n; i++) {
      const belt = i % 2 === 0;
      const l = theme.l + (belt ? 7 + rand() * 7 : -(7 + rand() * 7));
      g.addColorStop(i / (n - 1), hsla(theme.h + (rand() * 12 - 6), theme.s + (rand() * 14 - 7), l));
    }
    ctx.fillStyle = g;
    ctx.fillRect(cx - r, cy - r, 2 * r, 2 * r);

    // Turbulence: thin wavy bands tinted to the family break the straight look.
    const bands = 40 + Math.floor(rand() * 20);
    for (let i = 0; i < bands; i++) {
      const y = cy - r + (i + rand()) * ((2 * r) / bands);
      const amp = r * (0.02 + 0.05 * rand());
      const ph = rand() * 6.283;
      const th = r * (0.02 + 0.05 * rand());
      ctx.fillStyle =
        rand() < 0.5
          ? hsla(theme.h, theme.s * 0.7, theme.l * 0.4, 0.05 + 0.1 * rand())
          : hsla(theme.h, theme.s * 0.5, theme.l * 1.45, 0.04 + 0.08 * rand());
      ctx.beginPath();
      ctx.moveTo(cx - r, y);
      for (let x = -r; x <= r; x += r / 6) ctx.lineTo(cx + x, y + Math.sin((x / r) * 3.1 + ph) * amp);
      ctx.lineTo(cx + r, y + th);
      for (let x = r; x >= -r; x -= r / 6)
        ctx.lineTo(cx + x, y + th + Math.sin((x / r) * 3.1 + ph) * amp);
      ctx.closePath();
      ctx.fill();
    }

    // A storm on roughly half of them — color drawn from the family, hue-shifted,
    // not always a red spot.
    if (rand() < 0.5) {
      const sx = cx + r * (rand() * 1.2 - 0.6);
      const sy = cy + r * (rand() * 1.0 - 0.5);
      const sw = r * (0.14 + 0.14 * rand());
      const sh = theme.h + (rand() * 50 - 25);
      const spot = ctx.createRadialGradient(sx, sy, 0, sx, sy, sw);
      spot.addColorStop(0, hsla(sh, theme.s + 25, theme.l - 16, 0.8));
      spot.addColorStop(0.6, hsla(sh, theme.s + 15, theme.l - 10, 0.45));
      spot.addColorStop(1, hsla(sh, theme.s + 15, theme.l - 10, 0));
      ctx.save();
      ctx.translate(sx, sy);
      ctx.scale(1, 0.55);
      ctx.translate(-sx, -sy);
      ctx.fillStyle = spot;
      ctx.beginPath();
      ctx.arc(sx, sy, sw, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  } else {
    // Rocky / ice: shaded body gradient + soft mottling (craters / ice patches).
    const g = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.35, r * 0.1, cx, cy, r);
    g.addColorStop(0, pal.core);
    g.addColorStop(0.5, pal.mid);
    g.addColorStop(1, pal.edge);
    ctx.fillStyle = g;
    ctx.fillRect(cx - r, cy - r, 2 * r, 2 * r);

    const blobs = type === "rocky" ? 9 : 6;
    for (let i = 0; i < blobs; i++) {
      const bx = cx + (rand() * 2 - 1) * r * 0.75;
      const by = cy + (rand() * 2 - 1) * r * 0.75;
      const br = r * (0.12 + 0.22 * rand());
      const dark = type === "rocky" ? rand() < 0.6 : rand() < 0.35;
      const a = 0.1 + 0.14 * rand();
      const blob = ctx.createRadialGradient(bx, by, 0, bx, by, br);
      blob.addColorStop(0, dark ? `rgba(20,16,24,${a})` : `rgba(235,245,255,${a})`);
      blob.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = blob;
      ctx.beginPath();
      ctx.arc(bx, by, br, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();

  // Limb darkening — dark all around the rim is what sells the sphere.
  const limb = ctx.createRadialGradient(cx, cy, r * 0.55, cx, cy, r);
  limb.addColorStop(0, "rgba(0,0,0,0)");
  limb.addColorStop(1, "rgba(6,3,0,0.7)");
  ctx.fillStyle = limb;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();

  // Sun-side highlight (upper-left).
  const hl = ctx.createRadialGradient(
    cx - r * 0.35,
    cy - r * 0.4,
    0,
    cx - r * 0.35,
    cy - r * 0.4,
    r * 0.95,
  );
  hl.addColorStop(0, "rgba(255,245,225,0.2)");
  hl.addColorStop(0.5, "rgba(255,245,225,0)");
  ctx.fillStyle = hl;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();

  // Rim.
  ctx.strokeStyle = "rgba(200,215,245,0.18)";
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
}

function planetSprite(type: PlanetType, radius: number, seed: number): HTMLCanvasElement {
  const key = `${type}-${Math.round(radius)}-${seed}`;
  const cached = planetCache.get(key);
  if (cached) return cached;
  const size = Math.ceil(radius * 1.55 * 2);
  const cv = document.createElement("canvas");
  cv.width = size;
  cv.height = size;
  const sctx = cv.getContext("2d")!;
  renderPlanetSphere(sctx, size / 2, size / 2, radius, type, seed);
  planetCache.set(key, cv);
  return cv;
}

function drawPlanet(
  ctx: CanvasRenderingContext2D,
  pos: { x: number; y: number },
  radius: number,
  seedPos: { x: number; y: number } = pos,
): void {
  const type = planetTypeFor(seedPos);
  // Stable per-position seed → each planet keeps its own look across frames.
  const seed = ((Math.round(seedPos.x) * 73856093) ^ (Math.round(seedPos.y) * 19349663)) >>> 0;
  const sprite = planetSprite(type, radius, seed);
  ctx.drawImage(sprite, pos.x - sprite.width / 2, pos.y - sprite.height / 2);
}

function drawBlocker(
  ctx: CanvasRenderingContext2D,
  pos: { x: number; y: number },
  radius: number,
  time: number,
  animate: boolean,
): void {
  const g = ctx.createRadialGradient(
    pos.x - radius * 0.3,
    pos.y - radius * 0.3,
    radius * 0.1,
    pos.x,
    pos.y,
    radius,
  );
  g.addColorStop(0, "#7a2a2f");
  g.addColorStop(0.6, COLORS.blockerBody);
  g.addColorStop(1, "#1a0a0c");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.shadowColor = COLORS.blockerRim;
  ctx.shadowBlur = 10;
  ctx.strokeStyle = COLORS.blockerRim;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  // Pulsing hazard ring.
  const pulse = animate ? 0.35 + 0.15 * Math.sin(time * 0.005) : 0.35;
  ctx.strokeStyle = `rgba(224, 86, 74, ${pulse})`;
  ctx.setLineDash([4, 6]);
  ctx.beginPath();
  ctx.arc(pos.x, pos.y, radius + PROBE_RADIUS + 4, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawPortal(
  ctx: CanvasRenderingContext2D,
  p: { pos: { x: number; y: number }; radius: number; facing: { x: number; y: number } },
  hue: number,
): void {
  const ring = `hsl(${hue}, 80%, 66%)`;
  glowStroke(ctx, ring, 12, 3, () => {
    ctx.beginPath();
    ctx.arc(p.pos.x, p.pos.y, p.radius, 0, Math.PI * 2);
  });
  // Facing arrow — the direction a probe exits going.
  const tipX = p.pos.x + p.facing.x * (p.radius + 16);
  const tipY = p.pos.y + p.facing.y * (p.radius + 16);
  glowStroke(ctx, `hsl(${hue}, 85%, 72%)`, 8, 2, () => {
    ctx.beginPath();
    ctx.moveTo(p.pos.x + p.facing.x * p.radius, p.pos.y + p.facing.y * p.radius);
    ctx.lineTo(tipX, tipY);
  });
}

function glowStroke(
  ctx: CanvasRenderingContext2D,
  color: string,
  blur: number,
  lineWidth: number,
  path: () => void,
): void {
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = blur;
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  path();
  ctx.stroke();
  ctx.restore();
}

// A flying probe never moves more than ~MAX_SPEED*DT (=10) units per step (a
// collision nudges it at most ~PROBE_RADIUS more), so any larger gap between
// consecutive path points is a wormhole teleport. Lift the pen there so the
// preview/trail goes INTO one portal and OUT the other instead of drawing a
// straight line across the map.
const TELEPORT_GAP2 = 60 * 60;

/** Draw the dashed aim preview, breaking the line where the probe teleports so
 *  it goes into one portal and out the other rather than straight across. */
function strokePreviewPath(
  ctx: CanvasRenderingContext2D,
  path: { x: number; y: number }[],
): void {
  ctx.strokeStyle = COLORS.preview;
  ctx.setLineDash([6, 8]);
  ctx.lineWidth = 2;
  for (const seg of pathSegments(path, TELEPORT_GAP2)) {
    if (seg.length < 2) continue;
    ctx.beginPath();
    ctx.moveTo(seg[0]!.x, seg[0]!.y);
    for (let i = 1; i < seg.length; i++) ctx.lineTo(seg[i]!.x, seg[i]!.y);
    ctx.stroke();
  }
  ctx.setLineDash([]);
}

function drawTrail(
  ctx: CanvasRenderingContext2D,
  trail: { x: number; y: number }[] | null,
): void {
  if (!trail || trail.length < 2) return;
  let prev = trail[0]!;
  for (let i = 1; i < trail.length; i++) {
    const p = trail[i]!;
    const dx = p.x - prev.x;
    const dy = p.y - prev.y;
    // Skip the connecting segment across a wormhole teleport.
    if (dx * dx + dy * dy <= TELEPORT_GAP2) {
      const a = i / trail.length;
      ctx.strokeStyle = `rgba(180,210,255,${a * 0.5})`;
      ctx.lineWidth = a * PROBE_RADIUS * 1.2;
      ctx.beginPath();
      ctx.moveTo(prev.x, prev.y);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
    }
    prev = p;
  }
}

function drawProbe(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  landed: boolean,
  time: number,
  animate: boolean,
): void {
  const pulse = animate && landed ? 1 + 0.15 * Math.sin(time * 0.006) : 1;
  ctx.save();
  ctx.shadowColor = landed ? "rgba(165,214,167,0.9)" : "rgba(200,220,255,0.95)";
  ctx.shadowBlur = landed ? 12 : 9;
  ctx.fillStyle = landed ? COLORS.probeLanded : COLORS.probe;
  ctx.beginPath();
  ctx.arc(x, y, PROBE_RADIUS * pulse, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawBursts(
  ctx: CanvasRenderingContext2D,
  bursts: { x: number; y: number; start: number; kind: Burst["kind"] }[],
  time: number,
): void {
  for (const b of bursts) {
    const p = burstProgress(b, time);
    const r = PROBE_RADIUS + p * PROBE_RADIUS * 5;
    const fade = 1 - p;
    ctx.strokeStyle =
      b.kind === "land"
        ? `rgba(165,214,167,${fade * 0.8})`
        : b.kind === "clear"
          ? `rgba(128,203,196,${fade * 0.9})`
          : `rgba(224,86,74,${fade * 0.8})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(b.x, b.y, r, 0, Math.PI * 2);
    ctx.stroke();
  }
}

export function drawFrame(ctx: CanvasRenderingContext2D, view: RenderView): void {
  const { game } = view;
  ctx.clearRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

  // Transparent over the shared cosmos backdrop; only near-field dust here.
  drawDust(ctx, view.drag, view.animate);

  // Zone rings — glowing, semantic 5/3/1 colors.
  for (const zone of game.system.zones) {
    for (let i = RINGS.length - 1; i >= 0; i--) {
      const color = RING_COLORS[i] ?? "#fff";
      glowStroke(ctx, color, 8, 2, () => {
        ctx.beginPath();
        ctx.arc(zone.center.x, zone.center.y, RINGS[i]!.maxDist, 0, Math.PI * 2);
      });
    }
  }

  // Planets
  for (const p of game.system.planets) {
    drawPlanet(ctx, p.pos, p.radius);
  }

  // Launch pad
  const lp = game.system.launchPos;
  ctx.strokeStyle = COLORS.pad;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(lp.x, lp.y, 14, 0, Math.PI * 2);
  ctx.stroke();

  // Aiming: preview path + drag indicator
  if (view.previewPath && view.previewPath.length > 1) {
    strokePreviewPath(ctx, view.previewPath);
  }
  if (view.drag) {
    ctx.strokeStyle = COLORS.pad;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(lp.x, lp.y);
    ctx.lineTo(lp.x + view.drag.dx, lp.y + view.drag.dy);
    ctx.stroke();
  }

  // In-flight trail, then probes.
  drawTrail(ctx, view.trail);
  const frames: ProbeFrame[] =
    view.probeFrames ??
    game.probes.map((p) => ({ x: p.pos.x, y: p.pos.y, state: p.state }));
  for (const f of frames) {
    if (f.state === "lost") continue;
    drawProbe(ctx, f.x, f.y, f.state === "landed", view.time, view.animate);
  }

  drawBursts(ctx, view.bursts, view.time);
}

export interface CampaignRenderView {
  state: CampaignLevelState;
  probeFrames: ProbeFrame[] | null;
  previewPath: { x: number; y: number }[] | null;
  drag: { dx: number; dy: number } | null;
  trail: { x: number; y: number }[] | null;
  bursts: Burst[];
  time: number;
  animate: boolean;
  boardTick: number;
}

export function drawCampaignFrame(
  ctx: CanvasRenderingContext2D,
  view: CampaignRenderView,
): void {
  const { state } = view;
  const { level } = state;
  ctx.clearRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

  // Transparent over the shared cosmos backdrop; only near-field dust here.
  drawDust(ctx, view.drag, view.animate);

  // Bodies: planets, hostile blockers, and orbiting moons (with an orbit-path hint).
  for (const b of level.bodies) {
    if (b.orbit) {
      ctx.strokeStyle = COLORS.orbitPath;
      ctx.setLineDash([2, 10]);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(b.orbit.center.x, b.orbit.center.y, b.orbit.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      const pos = orbitPositionAt(b.orbit, view.boardTick);
      if (b.kind === "blocker") drawBlocker(ctx, pos, b.radius, view.time, view.animate);
      else drawPlanet(ctx, pos, b.radius, b.orbit.center);
    } else if (b.kind === "blocker") {
      drawBlocker(ctx, b.pos, b.radius, view.time, view.animate);
    } else {
      drawPlanet(ctx, b.pos, b.radius);
    }
  }

  // Wormhole portals: a faint tether per pair, then oriented mouths (hue per pair).
  const portals = level.portals ?? [];
  for (let i = 0; i < portals.length; i++) {
    const j = portals[i]!.link;
    if (i < j) {
      ctx.strokeStyle = COLORS.portalTether;
      ctx.setLineDash([2, 12]);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(portals[i]!.pos.x, portals[i]!.pos.y);
      ctx.lineTo(portals[j]!.pos.x, portals[j]!.pos.y);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }
  for (let i = 0; i < portals.length; i++) {
    const pairHue = 185 + (Math.min(i, portals[i]!.link) >> 1) * 60;
    drawPortal(ctx, portals[i]!, pairHue);
  }

  // Targets: open marks that fill + glow when hit.
  level.targets.forEach((t, i) => {
    const pos = t.orbit ? orbitPositionAt(t.orbit, view.boardTick) : t.pos;
    const hit = state.targetsHit[i] ?? false;
    const color = hit ? COLORS.targetHit : COLORS.target;
    ctx.fillStyle = hit ? "rgba(165, 214, 167, 0.5)" : "rgba(255, 183, 77, 0.12)";
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, t.radius, 0, Math.PI * 2);
    ctx.fill();
    glowStroke(ctx, color, hit ? 12 : 4, 3, () => {
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, t.radius, 0, Math.PI * 2);
    });
  });

  // Keys: glinting diamonds, dimmed once collected.
  level.keys.forEach((k, i) => {
    const pos = k.orbit ? orbitPositionAt(k.orbit, view.boardTick) : k.pos;
    const got = state.keysCollected[i] ?? false;
    const glint = view.animate && !got ? 0.6 + 0.4 * Math.sin(view.time * 0.004 + i) : 1;
    ctx.globalAlpha = got ? 0.25 : 1;
    ctx.save();
    if (!got) {
      ctx.shadowColor = COLORS.key;
      ctx.shadowBlur = 10 * glint;
    }
    ctx.fillStyle = COLORS.key;
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y - k.radius);
    ctx.lineTo(pos.x + k.radius, pos.y);
    ctx.lineTo(pos.x, pos.y + k.radius);
    ctx.lineTo(pos.x - k.radius, pos.y);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.globalAlpha = 1;
  });

  // Goal portal: dim + dashed when locked; glowing + slowly rotating when open.
  if (level.goal) {
    const goal = level.goal;
    const unlocked = state.keysCollected.every(Boolean);
    ctx.fillStyle = unlocked ? "rgba(128, 203, 196, 0.18)" : "rgba(92, 107, 138, 0.12)";
    ctx.beginPath();
    ctx.arc(goal.pos.x, goal.pos.y, goal.radius, 0, Math.PI * 2);
    ctx.fill();
    if (unlocked) {
      const rot = view.animate ? view.time * 0.001 : 0;
      ctx.save();
      ctx.translate(goal.pos.x, goal.pos.y);
      ctx.rotate(rot);
      ctx.shadowColor = COLORS.goalOpen;
      ctx.shadowBlur = 14;
      ctx.strokeStyle = COLORS.goalOpen;
      ctx.lineWidth = 4;
      ctx.setLineDash([10, 8]);
      ctx.beginPath();
      ctx.arc(0, 0, goal.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      ctx.setLineDash([]);
    } else {
      ctx.strokeStyle = COLORS.goalLocked;
      ctx.lineWidth = 4;
      ctx.setLineDash([6, 8]);
      ctx.beginPath();
      ctx.arc(goal.pos.x, goal.pos.y, goal.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  // Launch pad.
  const lp = level.launchPos;
  ctx.strokeStyle = COLORS.pad;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(lp.x, lp.y, 14, 0, Math.PI * 2);
  ctx.stroke();

  // Aiming preview + drag.
  if (view.previewPath && view.previewPath.length > 1) {
    strokePreviewPath(ctx, view.previewPath);
  }
  if (view.drag) {
    ctx.strokeStyle = COLORS.pad;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(lp.x, lp.y);
    ctx.lineTo(lp.x + view.drag.dx, lp.y + view.drag.dy);
    ctx.stroke();
  }

  // In-flight trail, then probes.
  drawTrail(ctx, view.trail);
  const frames: ProbeFrame[] =
    view.probeFrames ??
    state.probes.map((p) => ({ x: p.pos.x, y: p.pos.y, state: p.state }));
  for (const f of frames) {
    if (f.state === "lost") continue;
    drawProbe(ctx, f.x, f.y, f.state === "landed", view.time, view.animate);
  }

  drawBursts(ctx, view.bursts, view.time);
}
