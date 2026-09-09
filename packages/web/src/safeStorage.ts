/** The slice of Storage the app's storage modules actually use. */
export type AppStorage = Pick<Storage, "getItem" | "setItem">;

/**
 * localStorage that never throws. Safari private mode throws on setItem,
 * a full quota throws on setItem, and some embedded contexts throw on any
 * access. Every write lands in an in-memory overlay first and is then
 * offered to the backing; every read checks the overlay first and then the
 * backing. A session is therefore self-consistent whatever the backing
 * does, and persisted values still come back when the backing works.
 * The overlay also means a key this tab has written is never re-read from
 * the backing, so a write from another tab to the same key is not seen
 * here — accepted for a single-tab game.
 */
export function safeStorage(backing: Storage | null): AppStorage {
  const overlay = new Map<string, string>();
  return {
    getItem(key: string): string | null {
      const mine = overlay.get(key);
      if (mine !== undefined) return mine;
      if (backing === null) return null;
      try {
        return backing.getItem(key);
      } catch {
        // Read denied (private mode, sandboxed frame): behave as empty.
        return null;
      }
    },
    setItem(key: string, value: string): void {
      overlay.set(key, value);
      if (backing === null) return;
      try {
        backing.setItem(key, value);
      } catch {
        // Write denied or quota full: the overlay keeps it for this session.
      }
    },
  };
}

function detectLocalStorage(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    // Touching the global itself can throw when site data is blocked.
    return null;
  }
}

/** The app's one storage instance. Pass this, never `localStorage`. */
export const appStorage: AppStorage = safeStorage(detectLocalStorage());
