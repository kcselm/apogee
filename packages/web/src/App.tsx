import { createDailyGame } from "@apogee/engine";
import { useState } from "react";
import { todayString } from "./daily";
import { GameCanvas } from "./GameCanvas";

export function App() {
  const [day] = useState(todayString);
  const [game] = useState(() => createDailyGame(day));

  return (
    <>
      <div className="hud">
        <h1>APOGEE</h1>
        <span className="stat">{day}</span>
      </div>
      <GameCanvas game={game} />
    </>
  );
}
