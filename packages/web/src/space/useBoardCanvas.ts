import { type LaunchInput, type ProbeFrame, PREVIEW_STEPS } from "@apogee/engine";
import { useEffect, useRef } from "react";
import { type Burst, pruneBursts } from "./effects";
import { prefersReducedMotion, shouldAnimate, watchReducedMotion } from "./motion";
import { clearTrail, createTrail, pushTrail } from "./trail";

export interface BoardDrawOpts {
  probeFrames: ProbeFrame[] | null;
  previewPath: { x: number; y: number }[] | null;
  drag: { dx: number; dy: number } | null;
  trail: { x: number; y: number }[] | null;
  bursts: Burst[];
  time: number;
  animate: boolean;
  /** Board-clock tick for this frame (drives moving-body rendering). */
  boardTick: number;
}

/** Per-board adapter: where the launch pad is, how to preview, and how to draw. */
export interface BoardAdapter {
  launchPos: { x: number; y: number };
  /** Index of the just-launched probe in preview/anim frame arrays. */
  probeIndex: number;
  /** Live-sim a preview trace for the given drag at the current board tick. */
  previewTrace: (drag: LaunchInput, steps: number, tick: number) => ProbeFrame[][];
  /** Draw one frame. */
  draw: (ctx: CanvasRenderingContext2D, opts: BoardDrawOpts) => void;
}

export interface UseBoardCanvas {
  disabled: boolean;
  anim: ProbeFrame[][] | null;
  onLaunch: (input: LaunchInput) => void;
  onAnimDone: () => void;
  adapter: BoardAdapter;
  worldWidth: number;
  worldHeight: number;
  /** Frame index at which the level was cleared; a clear burst is drawn there. */
  clearAt: number | null;
}

function toWorld(
  canvas: HTMLCanvasElement,
  e: PointerEvent,
  w: number,
  h: number,
): { x: number; y: number } {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((e.clientX - rect.left) * w) / rect.width,
    y: ((e.clientY - rect.top) * h) / rect.height,
  };
}

export function useBoardCanvas(opts: UseBoardCanvas) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragRef = useRef<{ dx: number; dy: number } | null>(null);
  const trailRef = useRef(createTrail());
  const burstsRef = useRef<Burst[]>([]);
  const frameIdxRef = useRef(0);
  const prevStateRef = useRef<ProbeFrame["state"]>("flying");
  // Board clock: free-runs while aiming; during anim, tick = animStart + frameIdx.
  const tickRef = useRef(0);
  const lastLaunchTickRef = useRef(0);
  const animStartTickRef = useRef(0);

  // Refs kept fresh every render so the persistent loop reads current values.
  const animRef = useRef(opts.anim);
  const clearAtRef = useRef(opts.clearAt);
  clearAtRef.current = opts.clearAt;
  const adapterRef = useRef(opts.adapter);
  const cbRef = useRef({ onLaunch: opts.onLaunch, onAnimDone: opts.onAnimDone, disabled: opts.disabled });
  adapterRef.current = opts.adapter;
  cbRef.current = { onLaunch: opts.onLaunch, onAnimDone: opts.onAnimDone, disabled: opts.disabled };

  // Detect a newly-started animation (reset playback + trail + transition tracking).
  if (opts.anim !== animRef.current) {
    animRef.current = opts.anim;
    frameIdxRef.current = 0;
    animStartTickRef.current = lastLaunchTickRef.current;
    prevStateRef.current = "flying";
    clearTrail(trailRef.current);
  }

  // Kick the loop when a new animation arrives (needed in reduced-motion idle).
  const kickRef = useRef<() => void>(() => {});
  useEffect(() => {
    if (opts.anim) kickRef.current();
  }, [opts.anim]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    let reduce = prefersReducedMotion();
    let raf = 0;

    const computePreview = (): { x: number; y: number }[] | null => {
      const drag = dragRef.current;
      if (!drag || (drag.dx === 0 && drag.dy === 0)) return null;
      const adapter = adapterRef.current;
      const trace = adapter.previewTrace(drag, PREVIEW_STEPS, tickRef.current);
      return trace
        .map((f) => f[adapter.probeIndex])
        .filter((f): f is ProbeFrame => f !== undefined && f.state === "flying")
        .map((f) => ({ x: f.x, y: f.y }));
    };

    const render = (time: number) => {
      const adapter = adapterRef.current;
      const anim = animRef.current;
      const motion = shouldAnimate(reduce, document.hidden);
      const t = motion ? time : 0;
      burstsRef.current = pruneBursts(burstsRef.current, time);
      if (anim) {
        const boardTick = animStartTickRef.current + frameIdxRef.current;
        const i = Math.min(frameIdxRef.current, anim.length - 1);
        const probeFrames = anim[i] ?? null;
        const pf = probeFrames?.[adapter.probeIndex];
        if (pf) {
          if (motion && pf.state === "flying") pushTrail(trailRef.current, pf.x, pf.y);
          if (pf.state !== prevStateRef.current && pf.state !== "flying") {
            if (motion) {
              burstsRef.current.push({
                x: pf.x,
                y: pf.y,
                start: time,
                kind: pf.state === "landed" ? "land" : "lost",
              });
            }
            prevStateRef.current = pf.state;
          }
          if (motion && clearAtRef.current !== null && frameIdxRef.current === clearAtRef.current) {
            burstsRef.current.push({ x: pf.x, y: pf.y, start: time, kind: "clear" });
          }
        }
        adapter.draw(ctx, {
          probeFrames,
          previewPath: null,
          drag: null,
          trail: motion ? trailRef.current.points.slice() : null,
          bursts: burstsRef.current,
          time: t,
          animate: motion,
          boardTick,
        });
        frameIdxRef.current++;
        if (frameIdxRef.current >= anim.length) {
          tickRef.current = animStartTickRef.current + anim.length;
          animRef.current = null;
          clearTrail(trailRef.current);
          cbRef.current.onAnimDone();
        }
      } else {
        if (motion) tickRef.current++;
        adapter.draw(ctx, {
          probeFrames: null,
          previewPath: computePreview(),
          drag: dragRef.current,
          trail: null,
          bursts: burstsRef.current,
          time: t,
          animate: motion,
          boardTick: tickRef.current,
        });
      }
    };

    const wantLoop = () =>
      !document.hidden &&
      (animRef.current !== null ||
        dragRef.current !== null ||
        burstsRef.current.length > 0 ||
        !reduce);

    const loop = (time: number) => {
      render(time);
      raf = wantLoop() ? requestAnimationFrame(loop) : 0;
    };
    const kick = () => {
      if (!raf) raf = requestAnimationFrame(loop);
    };
    kickRef.current = kick;

    // Respect live OS reduce-motion changes. On re-enabling motion, resume the
    // ambient loop; on disabling, the loop stops itself next frame via wantLoop().
    const unwatch = watchReducedMotion((r) => {
      reduce = r;
      if (!r) kick();
    });

    const onDown = (e: PointerEvent) => {
      // `disabled` (from the parent) lags one render behind anim start, so also
      // gate on animRef to never begin a drag mid-animation.
      if (cbRef.current.disabled || animRef.current) return;
      canvas.setPointerCapture(e.pointerId);
      dragRef.current = { dx: 0, dy: 0 };
      kick();
    };
    const onMove = (e: PointerEvent) => {
      if (!dragRef.current) return;
      const w = toWorld(canvas, e, opts.worldWidth, opts.worldHeight);
      const lp = adapterRef.current.launchPos;
      dragRef.current = { dx: lp.x - w.x, dy: lp.y - w.y };
      kick();
    };
    const onUp = () => {
      const drag = dragRef.current;
      dragRef.current = null;
      kick();
      if (drag && (drag.dx !== 0 || drag.dy !== 0)) {
        lastLaunchTickRef.current = tickRef.current;
        cbRef.current.onLaunch({ dx: drag.dx, dy: drag.dy, launchTick: tickRef.current });
      }
    };
    const onCancel = () => {
      dragRef.current = null;
      kick();
    };

    const onVisibility = () => {
      if (!document.hidden) kick();
    };
    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointercancel", onCancel);
    document.addEventListener("visibilitychange", onVisibility);
    kick();

    return () => {
      kickRef.current = () => {};
      cancelAnimationFrame(raf);
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointercancel", onCancel);
      document.removeEventListener("visibilitychange", onVisibility);
      unwatch();
    };
  }, [opts.worldWidth, opts.worldHeight]);

  return canvasRef;
}
