import {
  PROBE_RADIUS,
  RINGS,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  mulberry32,
  type CampaignLevelState,
  type GameState,
  type ProbeFrame,
} from "@apogee/engine";
import type { Burst } from "./space/effects";
import { burstProgress } from "./space/effects";
import { COLORS } from "./space/palette";
import { PLANET_PALETTES, planetTypeFor, type PlanetType } from "./space/planetStyle";

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

/** Jupiter-like latitude palette (top→bottom): alternating warm zones & belts. */
const JUP = [
  "#cda877", "#e9d8b4", "#b98a52", "#dcc59a", "#a06a3a", "#e6d2a8", "#bb8a55",
  "#d7be90", "#8f5d33", "#e2cda0", "#ad7846", "#d2b888", "#9a6a3e", "#c7a675",
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

  // Atmosphere halo.
  const haloR = r * 1.55;
  const halo = ctx.createRadialGradient(cx, cy, r * 0.82, cx, cy, haloR);
  halo.addColorStop(0, pal.halo);
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

  if (type === "gasGiant") {
    // Banded base: many latitude colors with soft transitions.
    const g = ctx.createLinearGradient(0, cy - r, 0, cy + r);
    for (let i = 0; i < JUP.length; i++) g.addColorStop(i / (JUP.length - 1), JUP[i]!);
    ctx.fillStyle = g;
    ctx.fillRect(cx - r, cy - r, 2 * r, 2 * r);

    // Turbulence: thin wavy bands break the straight-stripe look.
    for (let i = 0; i < 48; i++) {
      const y = cy - r + (i + rand()) * ((2 * r) / 48);
      const amp = r * (0.02 + 0.05 * rand());
      const ph = rand() * 6.283;
      const th = r * (0.02 + 0.05 * rand());
      ctx.fillStyle =
        rand() < 0.5
          ? `rgba(60,35,15,${0.05 + 0.1 * rand()})`
          : `rgba(255,240,210,${0.04 + 0.08 * rand()})`;
      ctx.beginPath();
      ctx.moveTo(cx - r, y);
      for (let x = -r; x <= r; x += r / 6) ctx.lineTo(cx + x, y + Math.sin((x / r) * 3.1 + ph) * amp);
      ctx.lineTo(cx + r, y + th);
      for (let x = r; x >= -r; x -= r / 6)
        ctx.lineTo(cx + x, y + th + Math.sin((x / r) * 3.1 + ph) * amp);
      ctx.closePath();
      ctx.fill();
    }

    // Great Red Spot (placed per-planet so gas giants differ).
    const sx = cx + r * (0.15 + 0.3 * rand());
    const sy = cy + r * (0.1 + 0.25 * rand());
    const sw = r * 0.26;
    const spot = ctx.createRadialGradient(sx, sy, 0, sx, sy, sw);
    spot.addColorStop(0, "rgba(184,72,42,0.85)");
    spot.addColorStop(0.6, "rgba(150,60,38,0.5)");
    spot.addColorStop(1, "rgba(150,60,38,0)");
    ctx.save();
    ctx.translate(sx, sy);
    ctx.scale(1, 0.55);
    ctx.translate(-sx, -sy);
    ctx.fillStyle = spot;
    ctx.beginPath();
    ctx.arc(sx, sy, sw, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
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
): void {
  const type = planetTypeFor(pos);
  // Stable per-position seed → each planet keeps its own look across frames.
  const seed = ((Math.round(pos.x) * 73856093) ^ (Math.round(pos.y) * 19349663)) >>> 0;
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

function drawTrail(
  ctx: CanvasRenderingContext2D,
  trail: { x: number; y: number }[] | null,
): void {
  if (!trail || trail.length < 2) return;
  let prev = trail[0]!;
  for (let i = 1; i < trail.length; i++) {
    const p = trail[i]!;
    const a = i / trail.length;
    ctx.strokeStyle = `rgba(180,210,255,${a * 0.5})`;
    ctx.lineWidth = a * PROBE_RADIUS * 1.2;
    ctx.beginPath();
    ctx.moveTo(prev.x, prev.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
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
  bursts: { x: number; y: number; start: number; kind: "land" | "lost" }[],
  time: number,
): void {
  for (const b of bursts) {
    const p = burstProgress(b, time);
    const r = PROBE_RADIUS + p * PROBE_RADIUS * 5;
    const fade = 1 - p;
    ctx.strokeStyle =
      b.kind === "land" ? `rgba(165,214,167,${fade * 0.8})` : `rgba(224,86,74,${fade * 0.8})`;
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
    ctx.strokeStyle = COLORS.preview;
    ctx.setLineDash([6, 8]);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(view.previewPath[0]!.x, view.previewPath[0]!.y);
    for (const pt of view.previewPath) ctx.lineTo(pt.x, pt.y);
    ctx.stroke();
    ctx.setLineDash([]);
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

  // Bodies: planets vs hostile blockers.
  for (const b of level.bodies) {
    if (b.kind === "blocker") {
      drawBlocker(ctx, b.pos, b.radius, view.time, view.animate);
    } else {
      drawPlanet(ctx, b.pos, b.radius);
    }
  }

  // Targets: open marks that fill + glow when hit.
  level.targets.forEach((t, i) => {
    const hit = state.targetsHit[i] ?? false;
    const color = hit ? COLORS.targetHit : COLORS.target;
    ctx.fillStyle = hit ? "rgba(165, 214, 167, 0.5)" : "rgba(255, 183, 77, 0.12)";
    ctx.beginPath();
    ctx.arc(t.pos.x, t.pos.y, t.radius, 0, Math.PI * 2);
    ctx.fill();
    glowStroke(ctx, color, hit ? 12 : 4, 3, () => {
      ctx.beginPath();
      ctx.arc(t.pos.x, t.pos.y, t.radius, 0, Math.PI * 2);
    });
  });

  // Keys: glinting diamonds, dimmed once collected.
  level.keys.forEach((k, i) => {
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
    ctx.moveTo(k.pos.x, k.pos.y - k.radius);
    ctx.lineTo(k.pos.x + k.radius, k.pos.y);
    ctx.lineTo(k.pos.x, k.pos.y + k.radius);
    ctx.lineTo(k.pos.x - k.radius, k.pos.y);
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
    ctx.strokeStyle = COLORS.preview;
    ctx.setLineDash([6, 8]);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(view.previewPath[0]!.x, view.previewPath[0]!.y);
    for (const pt of view.previewPath) ctx.lineTo(pt.x, pt.y);
    ctx.stroke();
    ctx.setLineDash([]);
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
