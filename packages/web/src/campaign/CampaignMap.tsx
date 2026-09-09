import { LEVELS } from "@apogee/engine";
import { useMemo } from "react";
import { isUnlocked, loadProgress } from "./campaignStorage";
import { appStorage } from "../safeStorage";

interface Props {
  onExit: () => void;
  onPlay: (index: number) => void;
}

export function CampaignMap({ onExit, onPlay }: Props) {
  const progress = useMemo(() => loadProgress(appStorage), []);
  const ids = LEVELS.map((l) => l.id);

  return (
    <>
      <div className="hud">
        <button className="back" onClick={onExit} aria-label="Back to menu" title="Back to menu">←</button>
        <h1>Campaign</h1>
      </div>
      <div className="level-grid">
        {LEVELS.map((level, i) => {
          const unlocked = isUnlocked(progress, ids, i);
          const p = progress[level.id];
          const stars = p?.stars ?? 0;
          return (
            <button
              key={level.id}
              className={`level-tile${unlocked ? "" : " locked"}`}
              disabled={!unlocked}
              onClick={() => onPlay(i)}
            >
              <span className="num">{i + 1}</span>
              <span className="name">{level.name}</span>
              <span className="stars">
                {unlocked ? "★".repeat(stars) + "☆".repeat(3 - stars) : "🔒"}
              </span>
            </button>
          );
        })}
      </div>
    </>
  );
}
