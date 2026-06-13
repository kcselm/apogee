import {
  LEVELS,
  createLevel,
  evaluateObjectives,
  isLevelOver,
  simulateCampaignLaunch,
  starRating,
  type CampaignLevelState,
  type LaunchInput,
  type ProbeFrame,
} from "@apogee/engine";
import { useCallback, useMemo, useState } from "react";
import { recordResult } from "./campaignStorage";
import { CampaignCanvas } from "./CampaignCanvas";

interface Props {
  index: number;
  onExit: () => void;
  onPlay: (index: number) => void;
}

interface PendingAnim {
  trace: ProbeFrame[][];
  next: CampaignLevelState;
}

export function CampaignLevel({ index, onExit, onPlay }: Props) {
  const level = LEVELS[index]!;
  const [state, setState] = useState<CampaignLevelState>(() => createLevel(level));
  const [anim, setAnim] = useState<PendingAnim | null>(null);
  const [saved, setSaved] = useState(false);

  const handleLaunch = useCallback(
    (input: LaunchInput) => {
      const { state: next, trace } = simulateCampaignLaunch(state, input);
      setAnim({ trace, next });
    },
    [state],
  );

  const handleAnimDone = useCallback(() => {
    if (!anim) return;
    const next = anim.next;
    setState(next);
    setAnim(null);
    if (isLevelOver(next) && !saved) {
      const { cleared } = evaluateObjectives(next);
      recordResult(localStorage, next.level.id, cleared, starRating(next).stars);
      setSaved(true);
    }
  }, [anim, saved]);

  const { cleared } = evaluateObjectives(state);
  const over = isLevelOver(state) && anim === null;
  const rating = starRating(state);
  const launchesLeft = level.launchBudget - state.launchesUsed;
  const hasNext = index + 1 < LEVELS.length;

  const objectiveText = useMemo(() => describeObjectives(state), [state]);

  return (
    <>
      <div className="hud">
        <button className="back" onClick={onExit}>← levels</button>
        <h1>{level.name}</h1>
        <span className="stat">{objectiveText}</span>
        <span className="stat pips">
          {"●".repeat(Math.max(0, launchesLeft))}
          {"○".repeat(state.launchesUsed)}
        </span>
      </div>
      <CampaignCanvas
        state={state}
        disabled={over || anim !== null}
        anim={anim?.trace ?? null}
        onLaunch={handleLaunch}
        onAnimDone={handleAnimDone}
      />
      {over && (
        <div className="overlay">
          <div className="total">{cleared ? "★".repeat(rating.stars) + "☆".repeat(3 - rating.stars) : "out of launches"}</div>
          <div className="stat">{cleared ? `cleared — score ${rating.levelScore}` : "objective not met"}</div>
          <div className="actions">
            <button onClick={() => onPlay(index)}>Retry</button>
            {cleared && hasNext && <button onClick={() => onPlay(index + 1)}>Next →</button>}
            <button onClick={onExit}>Levels</button>
          </div>
        </div>
      )}
    </>
  );
}

function describeObjectives(state: CampaignLevelState): string {
  const parts: string[] = [];
  if (state.level.keys.length > 0) {
    parts.push(`keys ${state.keysCollected.filter(Boolean).length}/${state.level.keys.length}`);
  }
  if (state.level.targets.length > 0) {
    parts.push(`targets ${state.targetsHit.filter(Boolean).length}/${state.level.targets.length}`);
  }
  if (state.level.objectives.some((o) => o.kind === "reach-goal")) {
    parts.push(state.goalReached ? "goal ✓" : state.keysCollected.every(Boolean) ? "reach goal" : "goal locked");
  }
  return parts.join("  ·  ");
}
