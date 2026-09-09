import {
  LAUNCHES_PER_DAY,
  createDailyGame,
  isGameOver,
  scoreGame,
  simulateLaunch,
  type GameState,
  type LaunchInput,
  type ProbeFrame,
} from "@apogee/engine";
import { useCallback, useState } from "react";
import { todayString } from "./daily";
import { loadBest, recordScore } from "./storage";
import { appStorage } from "./safeStorage";
import { GameCanvas } from "./GameCanvas";
import { CountUp } from "./CountUp";
import { useAimHint } from "./useAimHint";
import { useSkipHint } from "./useSkipHint";

interface PendingAnim {
  trace: ProbeFrame[][];
  next: GameState;
}

export function DailyGame({ onExit }: { onExit: () => void }) {
  const [day] = useState(todayString);
  const [game, setGame] = useState(() => createDailyGame(day));
  const [anim, setAnim] = useState<PendingAnim | null>(null);
  const [best, setBest] = useState<number | null>(() => loadBest(appStorage, day));
  const { hint, padPulse, noteLaunch } = useAimHint();
  const skipHint = useSkipHint(anim !== null);

  const handleLaunch = useCallback(
    (input: LaunchInput) => {
      noteLaunch();
      const { state, trace } = simulateLaunch(game, input);
      setAnim({ trace, next: state });
    },
    [game, noteLaunch],
  );

  const handleAnimDone = useCallback(() => {
    if (!anim) return;
    setGame(anim.next);
    setAnim(null);
    if (isGameOver(anim.next)) {
      setBest(recordScore(appStorage, day, scoreGame(anim.next).total));
    }
  }, [anim, day]);

  const score = scoreGame(game);
  const over = isGameOver(game);

  return (
    <>
      <div className="hud">
        <button className="back" onClick={onExit} aria-label="Back to menu" title="Back to menu">←</button>
        <h1>APOGEE</h1>
        <span className="stat">{day}</span>
        <span className="stat pips">
          {"●".repeat(LAUNCHES_PER_DAY - game.launchesUsed)}
          {"○".repeat(game.launchesUsed)}
        </span>
        <span className="stat">score {score.total}</span>
      </div>
      <GameCanvas
        game={game}
        disabled={over || anim !== null}
        anim={anim?.trace ?? null}
        padPulse={padPulse}
        onLaunch={handleLaunch}
        onAnimDone={handleAnimDone}
      />
      {hint !== "off" && (
        <p className={hint === "fading" ? "aim-hint gone" : "aim-hint"}>
          drag anywhere to aim · release to launch
        </p>
      )}
      {skipHint && <p className="aim-hint skip-hint">tap to skip</p>}
      {over && anim === null && (
        <div className="overlay">
          <div className="panel">
            <div className="total"><CountUp value={score.total} /> pts</div>
            <div className="pips">{score.perProbe.join(" · ")}</div>
            {best !== null && <div className="stat">best today: {best}</div>}
            <div className="stat">come back tomorrow for a new system</div>
          </div>
        </div>
      )}
    </>
  );
}
