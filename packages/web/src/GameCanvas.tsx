import {
  PREVIEW_STEPS,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  simulateLaunch,
  type GameState,
  type LaunchInput,
} from "@apogee/engine";
import { useEffect, useRef } from "react";
import { drawFrame } from "./render";

interface Props {
  game: GameState;
  /** When true (game over / animating), input is ignored. */
  disabled: boolean;
  onLaunch: (input: LaunchInput) => void;
}

/** Convert a pointer event to world coordinates (canvas is CSS-scaled). */
function toWorld(canvas: HTMLCanvasElement, e: PointerEvent): { x: number; y: number } {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((e.clientX - rect.left) * WORLD_WIDTH) / rect.width,
    y: ((e.clientY - rect.top) * WORLD_HEIGHT) / rect.height,
  };
}

export function GameCanvas({ game, disabled, onLaunch }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragRef = useRef<{ dx: number; dy: number } | null>(null);

  useEffect(() => {
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
          .map((frame) => frame[newProbeIndex])
          .filter((f) => f !== undefined && f.state === "flying")
          .map((f) => ({ x: f!.x, y: f!.y }));
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
      // Slingshot: pull back from the pad, launch the opposite way.
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

    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    redraw();
    return () => {
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
    };
  }, [game, disabled, onLaunch]);

  return <canvas ref={canvasRef} width={WORLD_WIDTH} height={WORLD_HEIGHT} />;
}
