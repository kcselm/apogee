import { describe, expect, it } from "vitest";
import {
  isUnlocked,
  loadProgress,
  recordResult,
  type CampaignProgress,
} from "../src/campaign/campaignStorage";

function fakeStorage(): Storage {
  const map = new Map<string, string>();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
    clear: () => map.clear(),
    key: () => null,
    get length() {
      return map.size;
    },
  };
}

describe("campaign progress storage", () => {
  it("returns empty progress when nothing is stored", () => {
    expect(loadProgress(fakeStorage())).toEqual({});
  });

  it("records a result and reloads it", () => {
    const s = fakeStorage();
    recordResult(s, "1-1", true, 2);
    expect(loadProgress(s)["1-1"]).toEqual({ cleared: true, stars: 2 });
  });

  it("keeps the best stars and sticky cleared", () => {
    const s = fakeStorage();
    recordResult(s, "1-1", true, 2);
    recordResult(s, "1-1", false, 1);
    expect(loadProgress(s)["1-1"]).toEqual({ cleared: true, stars: 2 });
    recordResult(s, "1-1", true, 3);
    expect(loadProgress(s)["1-1"]).toEqual({ cleared: true, stars: 3 });
  });

  it("treats corrupted storage as empty progress", () => {
    const s = fakeStorage();
    s.setItem("apogee-campaign-progress", "not json");
    expect(loadProgress(s)).toEqual({});
  });

  it("unlocks the first level, and later levels only when the previous is cleared", () => {
    const ids = ["1-1", "1-2", "1-3"];
    const progress: CampaignProgress = { "1-1": { cleared: true, stars: 1 } };
    expect(isUnlocked({}, ids, 0)).toBe(true);
    expect(isUnlocked({}, ids, 1)).toBe(false);
    expect(isUnlocked(progress, ids, 1)).toBe(true);
    expect(isUnlocked(progress, ids, 2)).toBe(false);
  });
});
