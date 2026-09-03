import { describe, expect, it } from "vitest";
import { introToShow, loadSeen, markSeen } from "../../src/campaign/intro";

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

describe("intro card storage", () => {
  it("returns nothing seen on a fresh profile", () => {
    expect(loadSeen(fakeStorage())).toEqual([]);
  });

  it("records a level under the documented key", () => {
    const storage = fakeStorage();
    markSeen(storage, "3-1");
    expect(loadSeen(storage)).toEqual(["3-1"]);
    expect(storage.getItem("apogee-intro-seen")).toBe('["3-1"]');
  });

  it("does not record the same level twice", () => {
    const storage = fakeStorage();
    markSeen(storage, "3-1");
    markSeen(storage, "3-1");
    expect(loadSeen(storage)).toEqual(["3-1"]);
  });

  it("keeps earlier entries when a new level is seen", () => {
    const storage = fakeStorage();
    markSeen(storage, "1-1");
    markSeen(storage, "2-1");
    expect(loadSeen(storage)).toEqual(["1-1", "2-1"]);
  });

  it("treats corrupted JSON as nothing seen", () => {
    const storage = fakeStorage();
    storage.setItem("apogee-intro-seen", "{not json");
    expect(loadSeen(storage)).toEqual([]);
  });

  it("treats a non-array payload as nothing seen", () => {
    const storage = fakeStorage();
    storage.setItem("apogee-intro-seen", '{"1-1":true}');
    expect(loadSeen(storage)).toEqual([]);
  });

  it("drops non-string entries from a stored array", () => {
    const storage = fakeStorage();
    storage.setItem("apogee-intro-seen", '["1-1",7,null,"2-1"]');
    expect(loadSeen(storage)).toEqual(["1-1", "2-1"]);
  });
});

describe("introToShow", () => {
  it("shows the intro of an unseen chapter-opening level", () => {
    expect(introToShow({ id: "1-1", intro: "Planets pull." }, [])).toBe("Planets pull.");
  });

  it("shows nothing once that level has been seen", () => {
    expect(introToShow({ id: "1-1", intro: "Planets pull." }, ["1-1"])).toBeNull();
  });

  it("shows nothing for a level with no intro", () => {
    expect(introToShow({ id: "1-2", intro: undefined }, [])).toBeNull();
  });

  it("is not confused by a different level having been seen", () => {
    expect(introToShow({ id: "2-1", intro: "Red worlds." }, ["1-1"])).toBe("Red worlds.");
  });
});
