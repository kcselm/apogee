import {
  simulateCampaignLaunch,
  type CampaignLevelState,
  type LaunchInput,
  type ProbeFrame,
} from "@apogee/engine";
import { drawCampaignFrame } from "../render";
import { useBoardCanvas, type BoardDrawOpts } from "../space/useBoardCanvas";

interface Props {
  state: CampaignLevelState;
  disabled: boolean;
  anim: ProbeFrame[][] | null;
  clearAt: number | null;
  onLaunch: (input: LaunchInput) => void;
  onAnimDone: () => void;
}

export function CampaignCanvas({ state, disabled, anim, clearAt, onLaunch, onAnimDone }: Props) {
  const canvasRef = useBoardCanvas({
    disabled,
    anim,
    clearAt,
    onLaunch,
    onAnimDone,
    adapter: {
      probeIndex: state.probes.length,
      previewTrace: (drag, steps, tick) =>
        simulateCampaignLaunch(state, { ...drag, launchTick: tick }, steps).trace,
      draw: (ctx, o: BoardDrawOpts) =>
        drawCampaignFrame(ctx, {
          state,
          probeFrames: o.probeFrames,
          previewPath: o.previewPath,
          drag: o.drag,
          trail: o.trail,
          bursts: o.bursts,
          time: o.time,
          animate: o.animate,
          boardTick: o.boardTick,
        }),
    },
  });

  return <canvas ref={canvasRef} />;
}
