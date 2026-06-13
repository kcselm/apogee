import { useState } from "react";
import { DailyGame } from "./DailyGame";
import { CampaignMap } from "./campaign/CampaignMap";
import { CampaignLevel } from "./campaign/CampaignLevel";

type View =
  | { name: "home" }
  | { name: "daily" }
  | { name: "map" }
  | { name: "level"; index: number };

export function App() {
  const [view, setView] = useState<View>({ name: "home" });
  const [playCount, setPlayCount] = useState(0);

  const play = (index: number) => {
    setPlayCount((n) => n + 1);
    setView({ name: "level", index });
  };

  if (view.name === "daily") {
    return <DailyGame onExit={() => setView({ name: "home" })} />;
  }
  if (view.name === "map") {
    return <CampaignMap onExit={() => setView({ name: "home" })} onPlay={play} />;
  }
  if (view.name === "level") {
    return (
      <CampaignLevel
        key={`${view.index}-${playCount}`}
        index={view.index}
        onExit={() => setView({ name: "map" })}
        onPlay={play}
      />
    );
  }
  return (
    <div className="home">
      <h1>APOGEE</h1>
      <p className="tagline">gravity is the only rule</p>
      <button onClick={() => setView({ name: "daily" })}>Daily Challenge</button>
      <button onClick={() => setView({ name: "map" })}>Campaign</button>
    </div>
  );
}
