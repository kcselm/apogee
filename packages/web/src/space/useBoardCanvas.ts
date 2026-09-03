import { type LaunchInput, type ProbeFrame, type Vec2, PREVIEW_STEPS } from "@apogee/engine";
import { useEffect, useRef } from "react";
import { type AimDrag, pullVector, shouldFire } from "./aim";
import { type Burst, pruneBursts } from "./effects";
import { prefersReducedMotion, shouldAnimate, watchReducedMotion } from "./motion";
import {
  type Orientation,
  canvasSize,
  canvasToWorld,
  canvasTransform,
  pickOrientation,
} from "./orientation";
import { clearTrail, createTrail, pushTrail } from "./trail";

export interface BoardDrawOpts {
  probeFrames: ProbeFrame[] | null;
  previewPath: { x: number; y: number }[] | null;
  /** The aim gesture in world units (press point + pull so far), or null when not aiming. */
  drag: AimDrag | null;
  trail: { x: number; y: number }[] | null;
  bursts: Burst[];
  time: number;
  animate: boolean;
  /** Board-clock tick for this frame (drives moving-body rendering). */
  boardTick: number;
}

/** Per-board adapter: how to preview and how to draw. */
export interface BoardAdapter {
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
  /** Frame index at which the level was cleared; the clear burst fires once when playback reaches or passes that frame. */
  clearAt: number | null;
}

/** Pointer → canvas pixels (undoing CSS scaling) → world units (undoing the portrait turn). */
function toWorld(canvas: HTMLCanvasElement, e: PointerEvent, o: Orientation): Vec2 {
  const rect = canvas.getBoundingClientRect();
  const { width, height } = canvasSize(o);
  return canvasToWorld(o, {
    x: ((e.clientX - rect.left) * width) / rect.width,
    y: ((e.clientY - rect.top) * height) / rect.height,
  });
}

/**
 * Shared board behaviour for the Daily and Campaign canvases: aiming input,
 * playback of a launch trace, trails, bursts, and the board clock. The hook
 * owns the canvas element's pixel size: on portrait viewports the 1600×1000
 * world is drawn turned 90° counter-clockwise (see orientation.ts); the
 * renderers and the engine never know.
 */
export function useBoardCanvas(opts: UseBoardCanvas) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragRef = useRef<AimDrag | null>(null);
  const trailRef = useRef(createTrail());
  const burstsRef = useRef<Burst[]>([]);
  const frameIdxRef = useRef(0);
  const prevStateRef = useRef<ProbeFrame["state"]>("flying");
  const clearFiredRef = useRef(false);
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
    clearFiredRef.current = false;
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
    let orientation: Orientation = "landscape";

    const computePreview = (): { x: number; y: number }[] | null => {
      const drag = dragRef.current;
      if (!drag || !shouldFire(drag)) return null;
      const adapter = adapterRef.current;
      const trace = adapter.previewTrace({ dx: drag.dx, dy: drag.dy }, PREVIEW_STEPS, tickRef.current);
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
      // Renderers draw in world units; in portrait this matrix turns the board
      // on its side. Everything stored (playback, trail, bursts, drag) is world
      // space, so an orientation change mid-flight only changes the next frame.
      ctx.setTransform(...canvasTransform(orientation));
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
          const clearAt = clearAtRef.current;
          if (motion && clearAt !== null && !clearFiredRef.current && frameIdxRef.current >= clearAt) {
            clearFiredRef.current = true;
            const at = anim[clearAt]?.[adapter.probeIndex] ?? pf;
            burstsRef.current.push({ x: at.x, y: at.y, start: time, kind: "clear" });
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

    // Re-read the orientation on resize (and once up front). Setting width or
    // height wipes the canvas and its context state, so only touch them on a
    // real change, then redraw; the transform is re-applied every frame anyway.
    const applyOrientation = () => {
      orientation = pickOrientation(window.innerWidth, window.innerHeight);
      const { width, height } = canvasSize(orientation);
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
        canvas.style.aspectRatio = `${width} / ${height}`;
        kick();
      }
    };

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
      // Press anywhere on the board: the pull is measured from here, the launch
      // still leaves the pad. A far-off tap therefore starts at zero, not at max.
      dragRef.current = { origin: toWorld(canvas, e, orientation), dx: 0, dy: 0 };
      kick();
    };
    const onMove = (e: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      const pointer = toWorld(canvas, e, orientation);
      dragRef.current = { origin: drag.origin, ...pullVector(drag.origin, pointer) };
      kick();
    };
    const onUp = () => {
      const drag = dragRef.current;
      dragRef.current = null;
      kick();
      // Under MIN_PULL the release is a cancel: no launch consumed, no burst.
      if (drag && shouldFire(drag)) {
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
    applyOrientation();
    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointercancel", onCancel);
    window.addEventListener("resize", applyOrientation);
    document.addEventListener("visibilitychange", onVisibility);
    kick();

    return () => {
      kickRef.current = () => {};
      cancelAnimationFrame(raf);
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointercancel", onCancel);
      window.removeEventListener("resize", applyOrientation);
      document.removeEventListener("visibilitychange", onVisibility);
      unwatch();
    };
  }, []);

  return canvasRef;
}
