import { describe, expect, it } from "vitest";
import { safeStorage } from "../src/safeStorage";

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

/** A Storage whose reads and/or writes throw, like Safari private mode or a full quota. */
function throwingStorage(opts: { read: boolean; write: boolean }): Storage {
  const inner = fakeStorage();
  return {
    ...inner,
    getItem: (k) => {
      if (opts.read) throw new DOMException("Access is denied for this document.", "SecurityError");
      return inner.getItem(k);
    },
    setItem: (k, v) => {
      if (opts.write) throw new DOMException("The quota has been exceeded.", "QuotaExceededError");
      inner.setItem(k, v);
    },
  };
}

describe("safeStorage", () => {
  it("round-trips through a working backing", () => {
    const backing = fakeStorage();
    const s = safeStorage(backing);
    s.setItem("k", "v");
    expect(s.getItem("k")).toBe("v");
    expect(backing.getItem("k")).toBe("v");
  });

  it("reads values the backing already holds", () => {
    const backing = fakeStorage();
    backing.setItem("persisted", "1");
    expect(safeStorage(backing).getItem("persisted")).toBe("1");
  });

  it("returns null for an unknown key", () => {
    expect(safeStorage(fakeStorage()).getItem("missing")).toBeNull();
    expect(safeStorage(null).getItem("missing")).toBeNull();
  });

  it("works in memory when there is no backing at all", () => {
    const s = safeStorage(null);
    s.setItem("k", "v");
    expect(s.getItem("k")).toBe("v");
  });

  it("never throws when the backing throws on write, and keeps the value for the session", () => {
    const s = safeStorage(throwingStorage({ read: false, write: true }));
    expect(() => s.setItem("k", "v")).not.toThrow();
    expect(s.getItem("k")).toBe("v");
  });

  it("never throws when the backing throws on read", () => {
    const s = safeStorage(throwingStorage({ read: true, write: false }));
    expect(() => s.getItem("k")).not.toThrow();
    expect(s.getItem("k")).toBeNull();
    s.setItem("k", "v");
    expect(s.getItem("k")).toBe("v");
  });

  it("prefers this session's write over a stale backing value", () => {
    const backing = fakeStorage();
    backing.setItem("k", "old");
    const s = safeStorage(backing);
    s.setItem("k", "new");
    expect(s.getItem("k")).toBe("new");
  });

  it("works entirely in the overlay when both read and write throw (Safari private mode)", () => {
    const s = safeStorage(throwingStorage({ read: true, write: true }));
    expect(s.getItem("k")).toBeNull();
    expect(() => s.setItem("k", "v")).not.toThrow();
    expect(s.getItem("k")).toBe("v");
  });

  it("keeps a session's writes readable across a read throw and a write throw", () => {
    const s = safeStorage(throwingStorage({ read: true, write: true }));
    s.setItem("a", "1");
    s.setItem("b", "2");
    expect(s.getItem("a")).toBe("1");
    expect(s.getItem("b")).toBe("2");
    expect(s.getItem("c")).toBeNull();
  });
});
