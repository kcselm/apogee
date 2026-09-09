import { useEffect, useState } from "react";

/** Playback time before the "tap to skip" caption appears, in ms. */
export const SKIP_HINT_MS = 2000;

/**
 * True once a flight has been playing for SKIP_HINT_MS. Resets to false the
 * moment playback ends (or is skipped), so the caption never outlives the flight.
 */
export function useSkipHint(animating: boolean): boolean {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!animating) {
      setVisible(false);
      return;
    }
    const t = setTimeout(() => setVisible(true), SKIP_HINT_MS);
    return () => clearTimeout(t);
  }, [animating]);
  return visible;
}
