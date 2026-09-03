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
import { useCallback, useEffect, useMemo, useState } from "react";
import { trimToClear } from "../space/playback";
import { recordResult } from "./campaignStorage";
import { CampaignCanvas } from "./CampaignCanvas";
import { introToShow, loadSeen, markSeen } from "./intro";
import { starCriteria } from "./ratingText";
import { useAimHint } from "../useAimHint";

interface Props {
  index: number;
  onExit: () => void;
  onPlay: (index: number) => void;
}

interface PendingAnim {
  trace: ProbeFrame[][];
  next: CampaignLevelState;
  /** Frame at which the level was cleared (a burst is drawn there), or null. */
  clearAt: number | null;
}

export function CampaignLevel({ index, onExit, onPlay }: Props) {
  const level = LEVELS[index]!;
  const [state, setState] = useState<CampaignLevelState>(() => createLevel(level));
  const [anim, setAnim] = useState<PendingAnim | null>(null);
  const [saved, setSaved] = useState(false);
  const { hint, padPulse, noteLaunch } = useAimHint();

  // First open of a chapter's opening level: name the mechanic before play.
  // Keyed remounts (level change and Retry) re-run this initializer, so the
  // "not on Retry" rule rests on the persisted list, not on component state.
  const [intro, setIntro] = useState<string | null>(() =>
    introToShow(level, loadSeen(localStorage)),
  );
  const dismissIntro = useCallback(() => {
    markSeen(localStorage, level.id);
    setIntro(null);
  }, [level.id]);

  useEffect(() => {
    if (intro === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        dismissIntro();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [intro, dismissIntro]);

  const handleLaunch = useCallback(
    (input: LaunchInput) => {
      noteLaunch();
      const { state: next, trace, clearedAtStep } = simulateCampaignLaunch(state, input);
      setAnim({ trace: trimToClear(trace, clearedAtStep), next, clearAt: clearedAtStep });
    },
    [state, noteLaunch],
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
        <button className="back" onClick={onExit} aria-label="Back to levels" title="Back to levels">←</button>
        <h1>{level.name}</h1>
        <span className="stat">{objectiveText}</span>
        <span className="stat pips">
          {"●".repeat(Math.max(0, launchesLeft))}
          {"○".repeat(state.launchesUsed)}
        </span>
      </div>
      <CampaignCanvas
        state={state}
        disabled={over || anim !== null || intro !== null}
        anim={anim?.trace ?? null}
        clearAt={anim?.clearAt ?? null}
        padPulse={padPulse}
        onLaunch={handleLaunch}
        onAnimDone={handleAnimDone}
      />
      {hint !== "off" && (
        <p className={hint === "fading" ? "aim-hint gone" : "aim-hint"}>
          drag anywhere to aim · release to launch
        </p>
      )}
      {over && (
        <div className="overlay">
          <div className="panel">
            <div className="total">{cleared ? "★".repeat(rating.stars) + "☆".repeat(3 - rating.stars) : "out of launches"}</div>
            <div className="stat">{cleared ? `cleared in ${state.launchesUsed}/${level.par}` : "objective not met"}</div>
            {cleared && (
              <ul className="star-criteria">
                {starCriteria(state).map((c) => (
                  <li key={c.text} className={c.met ? "met" : "unmet"}>
                    {c.met ? "★" : "☆"} {c.text}
                  </li>
                ))}
              </ul>
            )}
            <div className="actions">
              <button onClick={() => onPlay(index)}>Retry</button>
              {cleared && hasNext && <button onClick={() => onPlay(index + 1)}>Next →</button>}
              <button onClick={onExit}>Levels</button>
            </div>
          </div>
        </div>
      )}
      {intro !== null && (
        <div className="overlay" onClick={dismissIntro}>
          <div className="panel intro-card">
            <div className="intro-name">{level.name}</div>
            <p className="intro-text">{intro}</p>
            <div className="actions">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  dismissIntro();
                }}
              >
                Got it
              </button>
            </div>
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
