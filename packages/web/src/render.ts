import {
  PROBE_RADIUS,
  RINGS,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  mulberry32,
  type GameState,
  type ProbeFrame,
} from "@apogee/engine";

/** Fixed decorative starfield (render-only; never touches the sim). */
const STARS: { x: number; y: number; r: number }[] = (() => {
  const rng = mulberry32(0xa11ce);
  return Array.from({ length: 140 }, () => ({
    x: rng() * WORLD_WIDTH,
    y: rng() * WORLD_HEIGHT,
    r: 0.5 + rng() * 1.2,
  }));
})();

const RING_COLORS = ["#ffd54f", "#4fc3f7", "#7986cb"]; // 5 / 3 / 1 points

export interface RenderView {
  game: GameState;
  /** Live positions during animation; falls back to game.probes when null. */
  probeFrames: ProbeFrame[] | null;
  /** New-probe preview path while aiming. */
  previewPath: { x: number; y: number }[] | null;
  /** Current drag vector while aiming (drawn at the launch pad). */
  drag: { dx: number; dy: number } | null;
}

export function drawFrame(ctx: CanvasRenderingContext2D, view: RenderView): void {
  const { game } = view;
  ctx.clearRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

  // Space + stars
  ctx.fillStyle = "#0b0e1a";
  ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
  ctx.fillStyle = "#9fa8da";
  for (const s of STARS) {
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fill();
  }

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
