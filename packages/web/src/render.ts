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
import { COLORS } from "./space/palette";

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

export function drawFrame(ctx: CanvasRenderingContext2D, view: RenderView): void {
  const { game } = view;
  ctx.clearRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

  // Transparent over the shared cosmos backdrop; only near-field dust here.
  drawDust(ctx, view.drag, view.animate);

  // Zone rings (under planets' rims, over space)
  for (const zone of game.system.zones) {
    for (let i = RINGS.length - 1; i >= 0; i--) {
      ctx.strokeStyle = RING_COLORS[i] ?? "#fff";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(zone.center.x, zone.center.y, RINGS[i]!.maxDist, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  // Planets
  for (const p of game.system.planets) {
    ctx.fillStyle = "#26334d";
    ctx.beginPath();
    ctx.arc(p.pos.x, p.pos.y, p.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#52628a";
    ctx.lineWidth = 3;
    ctx.stroke();
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

  // Probes (animated frames take precedence over settled state)
  const frames: ProbeFrame[] =
    view.probeFrames ??
    game.probes.map((p) => ({ x: p.pos.x, y: p.pos.y, state: p.state }));
  for (const f of frames) {
    if (f.state === "lost") continue;
    ctx.fillStyle = f.state === "landed" ? "#a5d6a7" : "#ffffff";
    ctx.beginPath();
    ctx.arc(f.x, f.y, PROBE_RADIUS, 0, Math.PI * 2);
    ctx.fill();
  }
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

  // Bodies: planets (blue) vs blockers (hostile red with a hazard ring).
  for (const b of level.bodies) {
    if (b.kind === "blocker") {
      ctx.fillStyle = "#4d2026";
      ctx.beginPath();
      ctx.arc(b.pos.x, b.pos.y, b.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#e0564a";
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.strokeStyle = "rgba(224, 86, 74, 0.35)";
      ctx.setLineDash([4, 6]);
      ctx.beginPath();
      ctx.arc(b.pos.x, b.pos.y, b.radius + PROBE_RADIUS + 4, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    } else {
      ctx.fillStyle = "#26334d";
      ctx.beginPath();
      ctx.arc(b.pos.x, b.pos.y, b.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#52628a";
      ctx.lineWidth = 3;
      ctx.stroke();
    }
  }

  // Targets: open marks that fill in when hit.
  level.targets.forEach((t, i) => {
    const hit = state.targetsHit[i] ?? false;
    ctx.strokeStyle = hit ? "#a5d6a7" : "#ffb74d";
    ctx.fillStyle = hit ? "rgba(165, 214, 167, 0.5)" : "rgba(255, 183, 77, 0.12)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(t.pos.x, t.pos.y, t.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  });

  // Keys: glinting diamonds, dimmed once collected.
  level.keys.forEach((k, i) => {
    const got = state.keysCollected[i] ?? false;
    ctx.globalAlpha = got ? 0.25 : 1;
    ctx.fillStyle = "#ffd54f";
    ctx.beginPath();
    ctx.moveTo(k.pos.x, k.pos.y - k.radius);
    ctx.lineTo(k.pos.x + k.radius, k.pos.y);
    ctx.lineTo(k.pos.x, k.pos.y + k.radius);
    ctx.lineTo(k.pos.x - k.radius, k.pos.y);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
  });

  // Goal: a ring/portal — dashed + locked color until keys are collected.
  if (level.goal) {
    const unlocked = state.keysCollected.every(Boolean);
    ctx.strokeStyle = unlocked ? "#80cbc4" : "#5c6b8a";
    ctx.lineWidth = 4;
    if (!unlocked) ctx.setLineDash([6, 8]);
    ctx.beginPath();
    ctx.arc(level.goal.pos.x, level.goal.pos.y, level.goal.radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = unlocked ? "rgba(128, 203, 196, 0.18)" : "rgba(92, 107, 138, 0.12)";
    ctx.fill();
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

  // Probes.
  const frames: ProbeFrame[] =
    view.probeFrames ??
    state.probes.map((p) => ({ x: p.pos.x, y: p.pos.y, state: p.state }));
  for (const f of frames) {
    if (f.state === "lost") continue;
    ctx.fillStyle = f.state === "landed" ? "#a5d6a7" : "#ffffff";
    ctx.beginPath();
    ctx.arc(f.x, f.y, PROBE_RADIUS, 0, Math.PI * 2);
    ctx.fill();
  }
}
