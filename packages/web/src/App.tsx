import { createDailyGame, type LaunchInput } from "@apogee/engine";
import { useCallback, useState } from "react";
import { todayString } from "./daily";
import { GameCanvas } from "./GameCanvas";

export function App() {
  const [day] = useState(todayString);
  const [game] = useState(() => createDailyGame(day));

  const handleLaunch = useCallback((input: LaunchInput) => {
    console.log("launch", input); // Task 12 replaces this with real progression
  }, []);

  return (
    <>
      <div className="hud">
        <h1>APOGEE</h1>
        <span className="stat">{day}</span>
      </div>
      <GameCanvas game={game} disabled={false} onLaunch={handleLaunch} />
    </>
  );
}
