import { useMemo } from "react";
import { loadProgress } from "./campaignStorage";
import { MAX_STARS, chapterSections, totalStars } from "./mapModel";
import { appStorage } from "../safeStorage";

interface Props {
  onExit: () => void;
  onPlay: (index: number) => void;
}

export function CampaignMap({ onExit, onPlay }: Props) {
  const progress = useMemo(() => loadProgress(appStorage), []);
  const sections = useMemo(() => chapterSections(progress), [progress]);
  const stars = totalStars(progress);

  return (
    <>
      <div className="hud">
        <button className="back" onClick={onExit} aria-label="Back to menu" title="Back to menu">←</button>
        <h1>Campaign</h1>
        <span className="stat total-stars" aria-label={`${stars} of ${MAX_STARS} stars`}>
          ★ {stars} / {MAX_STARS}
        </span>
      </div>
      <div className="chapters">
        {sections.map(({ chapter, tiles }) => (
          <section className="chapter" key={chapter.index}>
            <div className="chapter-head">
              <span className="chapter-title">Chapter {chapter.index} · {chapter.title}</span>
              <span className="chapter-mechanic">{chapter.mechanic}</span>
            </div>
            <div className="level-grid">
              {tiles.map((t) => (
                <button
                  key={t.level.id}
                  className={`level-tile${t.unlocked ? "" : " locked"}`}
                  disabled={!t.unlocked}
                  onClick={() => onPlay(t.number - 1)}
                >
                  <span className="num">{t.number}</span>
                  <span className="name">{t.level.name}</span>
                  <span className="stars">
                    {t.unlocked ? "★".repeat(t.stars) + "☆".repeat(3 - t.stars) : "🔒"}
                  </span>
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}
