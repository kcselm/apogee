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
import { GameCanvas } from "./GameCanvas";

interface PendingAnim {
  trace: ProbeFrame[][];
  next: GameState;
}

export function App() {
  const [day] = useState(todayString);
  const [game, setGame] = useState(() => createDailyGame(day));
  const [anim, setAnim] = useState<PendingAnim | null>(null);

  const handleLaunch = useCallback(
    (input: LaunchInput) => {
      const { state, trace } = simulateLaunch(game, input);
      setAnim({ trace, next: state });
    },
    [game],
  );

  const handleAnimDone = useCallback(() => {
    if (!anim) return;
    setGame(anim.next);
    setAnim(null);
  }, [anim]);

  const score = scoreGame(game);
  const over = isGameOver(game);

  return (
    <>
      <div className="hud">
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
        onLaunch={handleLaunch}
        onAnimDone={handleAnimDone}
      />
    </>
  );
}
