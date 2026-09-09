import { useCallback, useEffect, useRef, useState } from "react";
import { hasLaunchedBefore, markLaunched } from "./onboarding";
import { appStorage } from "./safeStorage";

export type HintState = "show" | "fading" | "off";

/**
 * Time to hold "fading" before dropping to "off", in ms. Longer than
 * styles.css's `.aim-hint` opacity transition (0.45s) so the fade finishes
 * before the caption's `<p>` leaves the DOM — cutting it short would pop
 * the overlay away mid-fade instead of after it.
 */
const FADE_MS = 500;

/**
 * The one-time aim hint, shared by both boards. A profile that has never
 * launched sees the caption (an overlay on the board's bottom edge, see
 * `.aim-hint` in styles.css) and a breathing pad; the first launch marks
 * the profile, fades the caption out, and — once the fade finishes — drops
 * it to "off" so its `<p>` unmounts. On every later mount the caption is
 * absent entirely.
 */
export function useAimHint(): {
  hint: HintState;
  padPulse: boolean;
  noteLaunch: () => void;
} {
  const [hint, setHint] = useState<HintState>(() =>
    hasLaunchedBefore(appStorage) ? "off" : "show",
  );
  // Whether the one write this hook is allowed has already happened. Seeded
  // from the initial render's hint (a profile that had already launched
  // starts "fired" so noteLaunch is a permanent no-op), then flipped by the
  // first real launch. A ref, not the `hint` state, so the guard can't be
  // fooled by a stale closure or re-run by a re-render.
  const firedRef = useRef(hint !== "show");
  const fadeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (fadeTimer.current !== null) clearTimeout(fadeTimer.current);
    };
  }, []);

  const noteLaunch = useCallback(() => {
    // Only the very first launch writes; later launches (and a profile that
    // had already launched before this mount) are a no-op. The write runs
    // once, right here in the event handler — not inside the setState
    // updater below. React requires updaters to be pure and <StrictMode>
    // double-invokes them in development, so a write placed there would run
    // twice.
    if (firedRef.current) return;
    firedRef.current = true;
    markLaunched(appStorage);
    setHint("fading");
    fadeTimer.current = setTimeout(() => setHint("off"), FADE_MS);
  }, []);

  return { hint, padPulse: hint === "show", noteLaunch };
}
