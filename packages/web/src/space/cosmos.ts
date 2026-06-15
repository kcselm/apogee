import { activeShootingStars } from "./shootingStars";
import { parallax, twinkleAlpha, type Starfield } from "./starfield";

export interface NebulaCache {
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
}

/** Paint the nebula once into an offscreen canvas; we blit it each frame. */
export function createNebula(width: number, height: number): NebulaCache {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.floor(width));
  canvas.height = Math.max(1, Math.floor(height));
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#06070f";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const span = Math.max(canvas.width, canvas.height);
  const blobs = [
    { x: canvas.width * 0.72, y: canvas.height * 0.16, r: span * 0.5, c: "rgba(138,78,178,0.35)" },
    { x: canvas.width * 0.14, y: canvas.height * 0.9, r: span * 0.55, c: "rgba(40,98,176,0.33)" },
    { x: canvas.width * 0.5, y: canvas.height * 0.55, r: span * 0.45, c: "rgba(36,150,150,0.14)" },
  ];
  for (const b of blobs) {
    const g = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r);
    g.addColorStop(0, b.c);
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  return { canvas, width, height };
}

export interface BackdropOpts {
  width: number;
  height: number;
  nebula: NebulaCache;
  field: Starfield;
  seed: number;
  time: number;
  drag: { dx: number; dy: number } | null;
  animate: boolean;
}

export function drawBackdrop(ctx: CanvasRenderingContext2D, o: BackdropOpts): void {
  ctx.clearRect(0, 0, o.width, o.height);

  // Nebula — slow drift, drawn slightly oversized so edges never show.
  const driftX = o.animate ? Math.sin(o.time * 0.00003) * 14 : 0;
  const driftY = o.animate ? Math.cos(o.time * 0.000023) * 10 : 0;
  ctx.drawImage(o.nebula.canvas, driftX - 14, driftY - 10, o.width + 28, o.height + 20);

  // Stars — twinkle + parallax per depth.
  for (const s of o.field.stars) {
    const off = o.animate ? parallax(s.depth, o.drag, o.time) : { x: 0, y: 0 };
    ctx.globalAlpha = o.animate ? twinkleAlpha(s, o.time) : 0.8;
    ctx.fillStyle = s.tint;
    ctx.beginPath();
    ctx.arc(s.x + off.x, s.y + off.y, s.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Shooting stars (ambient only).
  if (o.animate) {
    for (const sh of activeShootingStars(o.seed, o.width, o.height, o.time)) {
      const hx = sh.sx + sh.dx * sh.progress;
      const hy = sh.sy + sh.dy * sh.progress;
      const ux = sh.dx === 0 && sh.dy === 0 ? 0 : sh.dx / Math.sqrt(sh.dx * sh.dx + sh.dy * sh.dy);
      const uy = sh.dx === 0 && sh.dy === 0 ? 0 : sh.dy / Math.sqrt(sh.dx * sh.dx + sh.dy * sh.dy);
      const tx = hx - ux * sh.len;
      const ty = hy - uy * sh.len;
      const grad = ctx.createLinearGradient(tx, ty, hx, hy);
      grad.addColorStop(0, "rgba(255,255,255,0)");
      grad.addColorStop(1, "rgba(255,255,255,0.9)");
      ctx.strokeStyle = grad;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(tx, ty);
      ctx.lineTo(hx, hy);
      ctx.stroke();
    }
  }
}
