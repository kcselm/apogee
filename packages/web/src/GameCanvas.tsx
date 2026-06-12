import { WORLD_HEIGHT, WORLD_WIDTH, type GameState } from "@apogee/engine";
import { useEffect, useRef } from "react";
import { drawFrame } from "./render";

interface Props {
  game: GameState;
}

export function GameCanvas({ game }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    drawFrame(ctx, { game, probeFrames: null, previewPath: null, drag: null });
  }, [game]);

  return <canvas ref={canvasRef} width={WORLD_WIDTH} height={WORLD_HEIGHT} />;
}
