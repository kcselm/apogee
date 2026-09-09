import { type LaunchInput, type ProbeFrame, type Vec2, PREVIEW_STEPS } from "@apogee/engine";
import { useEffect, useLayoutEffect, useRef } from "react";
import { type AimDrag, pullVector, shouldFire } from "./aim";
import { type Burst, pruneBursts } from "./effects";
import { prefersReducedMotion, shouldAnimate, watchReducedMotion } from "./motion";
import {
  type Orientation,
  canvasSize,
  canvasTransform,
  pickOrientation,
  pointerToWorld,
} from "./orientation";
import { advanceClock, advancePlayback, createPlaybackClock, isPlaybackDone, skipTarget } from "./playback";
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

/** Pointer event → world units, via the canvas's current on-screen rect. */
function toWorld(canvas: HTMLCanvasElement, e: PointerEvent, o: Orientation): Vec2 {
  const rect = canvas.getBoundingClientRect();
  return pointerToWorld(rect, e.clientX, e.clientY, o);
}

/** A drag in progress, tagged with the pointer that owns it so a second touch can't hijack the origin. */
type OwnedDrag = AimDrag & { pointerId: number };

/**
 * Shared board behaviour for the Daily and Campaign canvases: aiming input,
 * playback of a launch trace, trails, bursts, and the board clock. The hook
 * owns the canvas element's pixel size: on portrait viewports the 1600×1000
 * world is drawn turned 90° counter-clockwise (see orientation.ts); the
 * renderers and the engine never know.
 */
export function useBoardCanvas(opts: UseBoardCanvas) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragRef = useRef<OwnedDrag | null>(null);
  const trailRef = useRef(createTrail());
  const burstsRef = useRef<Burst[]>([]);
  const frameIdxRef = useRef(0);
  const prevStateRef = useRef<ProbeFrame["state"]>("flying");
  const clearFiredRef = useRef(false);
  // Board clock: free-runs while aiming; during anim, tick = animStart + frameIdx.
  const tickRef = useRef(0);
  const lastLaunchTickRef = useRef(0);
  const animStartTickRef = useRef(0);
  // Fixed-rate playback clock: converts rAF wall-clock timestamps into whole
  // sim steps at SIM_HZ, so playback speed is independent of display refresh.
  const clockRef = useRef(createPlaybackClock());

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
    clockRef.current = createPlaybackClock();
  }

  // Kick the loop when a new animation arrives (needed in reduced-motion idle).
  const kickRef = useRef<() => void>(() => {});
  useEffect(() => {
    if (opts.anim) kickRef.current();
  }, [opts.anim]);

  useLayoutEffect(() => {
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

    // Jump straight to the final frame of the in-flight trace. The next
    // render() then runs no consume steps (already at the end), draws the
    // final frame, fires the land/lost burst via the existing transition
    // check, fires the clear burst via the existing crossing check, and
    // completes — determinism untouched, since the trace was precomputed at
    // launch and skip only changes what gets watched.
    const skipAnim = () => {
      const anim = animRef.current;
      if (!anim) return;
      frameIdxRef.current = skipTarget(anim.length);
      clearTrail(trailRef.current);
      kick();
    };

    const render = (time: number) => {
      const adapter = adapterRef.current;
      const anim = animRef.current;
      const motion = shouldAnimate(reduce, document.hidden);
      const t = motion ? time : 0;
      // Owed sim steps for this display frame, at a fixed SIM_HZ regardless of
      // the display's refresh rate. Gated on tab visibility only (not motion):
      // reduced-motion playback still advances, just without trail/bursts.
      const steps = document.hidden ? 0 : advanceClock(clockRef.current, time);
      burstsRef.current = pruneBursts(burstsRef.current, time);
      // Renderers draw in world units; in portrait this matrix turns the board
      // on its side. Everything stored (playback, trail, bursts, drag) is world
      // space, so an orientation change mid-flight only changes the next frame.
      ctx.setTransform(...canvasTransform(orientation));
      if (anim) {
        // Consume `steps` sim frames this display frame (0 repeats the frame
        // on high-Hz displays; >1 catches up on low-Hz ones).
        const { idx, consumed } = advancePlayback(frameIdxRef.current, steps, anim.length);
        frameIdxRef.current = idx;
        if (motion) {
          for (const ci of consumed) {
            const f = anim[ci]?.[adapter.probeIndex];
            if (f && f.state === "flying") pushTrail(trailRef.current, f.x, f.y);
          }
        }
        const boardTick = animStartTickRef.current + frameIdxRef.current;
        // advancePlayback and skipAnim both cap frameIdxRef at anim.length - 1,
        // so no further clamp is needed to index into anim here.
        const probeFrames = anim[frameIdxRef.current] ?? null;
        const pf = probeFrames?.[adapter.probeIndex];
        if (pf) {
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
        if (isPlaybackDone(frameIdxRef.current, anim.length)) {
          tickRef.current = animStartTickRef.current + anim.length;
          animRef.current = null;
          clearTrail(trailRef.current);
          cbRef.current.onAnimDone();
        }
      } else {
        if (motion) tickRef.current += steps;
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
      // A tap/click during playback skips to the end instead of starting (or
      // being ignored as) a drag.
      if (animRef.current) {
        skipAnim();
        return;
      }
      // `disabled` (from the parent) lags one render behind anim start, but
      // playback is already handled above, so this is the drag-suppression
      // guard proper. A drag already in progress also blocks a new one: a
      // resting second finger must not re-anchor the origin out from under
      // the finger that's already aiming.
      if (cbRef.current.disabled || dragRef.current) return;
      canvas.setPointerCapture(e.pointerId);
      // Press anywhere on the board: the pull is measured from here, the launch
      // still leaves the pad. A far-off tap therefore starts at zero, not at max.
      dragRef.current = { origin: toWorld(canvas, e, orientation), dx: 0, dy: 0, pointerId: e.pointerId };
      kick();
    };
    const onMove = (e: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || e.pointerId !== drag.pointerId) return;
      const pointer = toWorld(canvas, e, orientation);
      dragRef.current = { ...drag, ...pullVector(drag.origin, pointer) };
      kick();
    };
    const onUp = (e: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || e.pointerId !== drag.pointerId) return;
      dragRef.current = null;
      kick();
      // Under MIN_PULL the release is a cancel: no launch consumed, no burst.
      if (shouldFire(drag)) {
        lastLaunchTickRef.current = tickRef.current;
        cbRef.current.onLaunch({ dx: drag.dx, dy: drag.dy, launchTick: tickRef.current });
      }
    };
    const onCancel = (e: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || e.pointerId !== drag.pointerId) return;
      dragRef.current = null;
      kick();
    };

    const onVisibility = () => {
      if (!document.hidden) kick();
    };
    // Space is a keyboard-only way to skip playback (mirrors onDown's tap-to-skip).
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space" && animRef.current) {
        e.preventDefault();
        skipAnim();
      }
    };
    applyOrientation();
    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointercancel", onCancel);
    window.addEventListener("resize", applyOrientation);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("keydown", onKey);
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
      window.removeEventListener("keydown", onKey);
      unwatch();
    };
  }, []);

  return canvasRef;
}
