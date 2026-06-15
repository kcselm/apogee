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
import { PLANET_PALETTES, planetTypeFor } from "./space/planetStyle";

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

function drawPlanet(
  ctx: CanvasRenderingContext2D,
  pos: { x: number; y: number },
  radius: number,
): void {
  const type = planetTypeFor(pos);
  const pal = PLANET_PALETTES[type];

  // Atmosphere halo.
  const haloR = radius * 1.5;
  const halo = ctx.createRadialGradient(pos.x, pos.y, radius * 0.85, pos.x, pos.y, haloR);
  halo.addColorStop(0, pal.halo);
  halo.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(pos.x, pos.y, haloR, 0, Math.PI * 2);
  ctx.fill();

  // Body.
  const g = ctx.createRadialGradient(
    pos.x - radius * 0.3,
    pos.y - radius * 0.35,
    radius * 0.1,
    pos.x,
    pos.y,
    radius,
  );
  g.addColorStop(0, pal.core);
  g.addColorStop(0.5, pal.mid);
  g.addColorStop(1, pal.edge);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
  ctx.fill();

  // Gas-giant banding (clipped to the disc).
  if (type === "gasGiant") {
    ctx.save();
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
    ctx.clip();
    ctx.globalAlpha = 0.12;
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = radius * 0.12;
    for (let i = -3; i <= 3; i++) {
      ctx.beginPath();
      ctx.moveTo(pos.x - radius, pos.y + i * radius * 0.28);
      ctx.lineTo(pos.x + radius, pos.y + i * radius * 0.28 + radius * 0.1);
      ctx.stroke();
    }
    ctx.restore();
  }

  // Terminator shadow.
  const term = ctx.createRadialGradient(
    pos.x + radius * 0.5,
    pos.y + radius * 0.5,
    radius * 0.2,
    pos.x,
    pos.y,
    radius,
  );
  term.addColorStop(0, "rgba(0,0,0,0)");
  term.addColorStop(1, "rgba(0,0,10,0.55)");
  ctx.fillStyle = term;
  ctx.beginPath();
  ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
  ctx.fill();

  // Rim light.
  ctx.strokeStyle = "rgba(180,200,240,0.25)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
  ctx.stroke();
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
  ctx.strokeStyle = "#80cbc4";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(lp.x, lp.y, 14, 0, Math.PI * 2);
  ctx.stroke();

  // Aiming: preview path + drag indicator
  if (view.previewPath && view.previewPath.length > 1) {
    ctx.strokeStyle = "rgba(255, 213, 79, 0.8)";
    ctx.setLineDash([6, 8]);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(view.previewPath[0]!.x, view.previewPath[0]!.y);
    for (const pt of view.previewPath) ctx.lineTo(pt.x, pt.y);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  if (view.drag) {
    ctx.strokeStyle = "#80cbc4";
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
  ctx.strokeStyle = "#80cbc4";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(lp.x, lp.y, 14, 0, Math.PI * 2);
  ctx.stroke();

  // Aiming preview + drag.
  if (view.previewPath && view.previewPath.length > 1) {
    ctx.strokeStyle = "rgba(255, 213, 79, 0.8)";
    ctx.setLineDash([6, 8]);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(view.previewPath[0]!.x, view.previewPath[0]!.y);
    for (const pt of view.previewPath) ctx.lineTo(pt.x, pt.y);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  if (view.drag) {
    ctx.strokeStyle = "#80cbc4";
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
