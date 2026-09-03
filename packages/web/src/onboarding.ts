const KEY = "apogee-onboarded";

/**
 * Whether this profile has ever launched a probe, in either mode. Drives the
 * one-time aim hint. Anything other than the exact written value counts as
 * "never" (matches campaignStorage's "treat corrupted values as absent").
 */
export function hasLaunchedBefore(storage: Pick<Storage, "getItem">): boolean {
  return storage.getItem(KEY) === "1";
}

/** Record that the player has launched. Idempotent. */
export function markLaunched(storage: Storage): void {
  storage.setItem(KEY, "1");
}
