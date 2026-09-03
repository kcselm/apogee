import { describe, expect, it } from "vitest";
import { hasLaunchedBefore, markLaunched } from "../src/onboarding";

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

describe("onboarding flag", () => {
  it("reports no prior launch on a fresh profile", () => {
    expect(hasLaunchedBefore(fakeStorage())).toBe(false);
  });

  it("reports a prior launch once marked", () => {
    const storage = fakeStorage();
    markLaunched(storage);
    expect(hasLaunchedBefore(storage)).toBe(true);
  });

  it("writes exactly the documented key and value", () => {
    const storage = fakeStorage();
    markLaunched(storage);
    expect(storage.getItem("apogee-onboarded")).toBe("1");
  });

  it("treats an unexpected stored value as never launched", () => {
    const storage = fakeStorage();
    storage.setItem("apogee-onboarded", "yes");
    expect(hasLaunchedBefore(storage)).toBe(false);
  });

  it("is idempotent", () => {
    const storage = fakeStorage();
    markLaunched(storage);
    markLaunched(storage);
    expect(storage.getItem("apogee-onboarded")).toBe("1");
    expect(hasLaunchedBefore(storage)).toBe(true);
  });
});
