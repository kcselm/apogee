import {
  WORLD_HEIGHT,
  WORLD_WIDTH,
  simulateLaunch,
  type GameState,
  type LaunchInput,
  type ProbeFrame,
} from "@apogee/engine";
import { drawFrame } from "./render";
import { useBoardCanvas, type BoardDrawOpts } from "./space/useBoardCanvas";

interface Props {
  game: GameState;
  disabled: boolean;
  anim: ProbeFrame[][] | null;
  onLaunch: (input: LaunchInput) => void;
  onAnimDone: () => void;
}

export function GameCanvas({ game, disabled, anim, onLaunch, onAnimDone }: Props) {
  const canvasRef = useBoardCanvas({
    disabled,
    anim,
    clearAt: null,
    onLaunch,
    onAnimDone,
    worldWidth: WORLD_WIDTH,
    worldHeight: WORLD_HEIGHT,
    adapter: {
      launchPos: game.system.launchPos,
      probeIndex: game.probes.length,
      previewTrace: (drag, steps) => simulateLaunch(game, drag, steps).trace,
      draw: (ctx, o: BoardDrawOpts) =>
        drawFrame(ctx, {
          game,
          probeFrames: o.probeFrames,
          previewPath: o.previewPath,
          drag: o.drag,
          trail: o.trail,
          bursts: o.bursts,
          time: o.time,
          animate: o.animate,
        }),
    },
  });

  return <canvas ref={canvasRef} width={WORLD_WIDTH} height={WORLD_HEIGHT} />;
}
