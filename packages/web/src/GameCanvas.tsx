import {
  PREVIEW_STEPS,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  simulateLaunch,
  type GameState,
  type LaunchInput,
  type ProbeFrame,
} from "@apogee/engine";
import { useEffect, useRef } from "react";
import { drawFrame } from "./render";

interface Props {
  game: GameState;
  disabled: boolean;
  /** Trace to play back, or null when idle. */
  anim: ProbeFrame[][] | null;
  onLaunch: (input: LaunchInput) => void;
  onAnimDone: () => void;
}

function toWorld(canvas: HTMLCanvasElement, e: PointerEvent): { x: number; y: number } {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((e.clientX - rect.left) * WORLD_WIDTH) / rect.width,
    y: ((e.clientY - rect.top) * WORLD_HEIGHT) / rect.height,
  };
}

export function GameCanvas({ game, disabled, anim, onLaunch, onAnimDone }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragRef = useRef<{ dx: number; dy: number } | null>(null);

  // Animation playback: one sim step per display frame (60Hz ≈ real time).
  useEffect(() => {
    if (!anim) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) {
      onAnimDone();
      return;
    }
    let frame = 0;
    let raf = 0;
    const tick = () => {
      const probeFrames = anim[Math.min(frame, anim.length - 1)] ?? null;
      drawFrame(ctx, { game, probeFrames, previewPath: null, drag: null });
      frame++;
      if (frame < anim.length) {
        raf = requestAnimationFrame(tick);
      } else {
        onAnimDone();
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [anim, game, onAnimDone]);

  // Idle rendering + aiming input.
  useEffect(() => {
    if (anim) return; // animation effect owns the canvas right now
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const redraw = () => {
      const drag = dragRef.current;
      let previewPath: { x: number; y: number }[] | null = null;
      if (drag && (drag.dx !== 0 || drag.dy !== 0)) {
        const { trace } = simulateLaunch(game, drag, PREVIEW_STEPS);
        const newProbeIndex = game.probes.length;
        previewPath = trace
          .map((f) => f[newProbeIndex])
          .filter((f): f is ProbeFrame => f !== undefined && f.state === "flying")
          .map((f) => ({ x: f.x, y: f.y }));
      }
      drawFrame(ctx, { game, probeFrames: null, previewPath, drag });
    };

    const onDown = (e: PointerEvent) => {
      if (disabled) return;
      canvas.setPointerCapture(e.pointerId);
      dragRef.current = { dx: 0, dy: 0 };
      redraw();
    };
    const onMove = (e: PointerEvent) => {
      if (!dragRef.current) return;
      const w = toWorld(canvas, e);
      dragRef.current = {
        dx: game.system.launchPos.x - w.x,
        dy: game.system.launchPos.y - w.y,
      };
      redraw();
    };
    const onUp = () => {
      const drag = dragRef.current;
      dragRef.current = null;
      redraw();
      if (drag && (drag.dx !== 0 || drag.dy !== 0)) onLaunch(drag);
    };
    const onCancel = () => {
      dragRef.current = null;
      redraw();
    };

    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointercancel", onCancel);
    redraw();
    return () => {
      dragRef.current = null;
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointercancel", onCancel);
    };
  }, [game, disabled, anim, onLaunch]);

  return <canvas ref={canvasRef} width={WORLD_WIDTH} height={WORLD_HEIGHT} />;
}
