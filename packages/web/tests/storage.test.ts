import { describe, expect, it } from "vitest";
import { loadBest, recordScore } from "../src/storage";

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

describe("best-score storage", () => {
  it("returns null when nothing is stored", () => {
    expect(loadBest(fakeStorage(), "2026-06-11")).toBeNull();
  });

  it("records and reloads a score", () => {
    const s = fakeStorage();
    expect(recordScore(s, "2026-06-11", 12)).toBe(12);
    expect(loadBest(s, "2026-06-11")).toBe(12);
  });

  it("keeps the higher score", () => {
    const s = fakeStorage();
    recordScore(s, "2026-06-11", 12);
    expect(recordScore(s, "2026-06-11", 8)).toBe(12);
    expect(recordScore(s, "2026-06-11", 15)).toBe(15);
  });

  it("is per-day", () => {
    const s = fakeStorage();
    recordScore(s, "2026-06-11", 12);
    expect(loadBest(s, "2026-06-12")).toBeNull();
  });

  it("treats corrupted values as absent", () => {
    const s = fakeStorage();
    s.setItem("apogee-best-2026-06-11", "garbage");
    expect(loadBest(s, "2026-06-11")).toBeNull();
  });
});
