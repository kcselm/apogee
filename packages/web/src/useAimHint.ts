import { useCallback, useState } from "react";
import { hasLaunchedBefore, markLaunched } from "./onboarding";

export type HintState = "show" | "fading" | "off";

/**
 * The one-time aim hint, shared by both boards. A profile that has never
 * launched sees the caption and a breathing pad; the first launch marks the
 * profile and fades the caption out. On every later mount the caption is
 * absent entirely, so it costs no layout.
 */
export function useAimHint(): {
  hint: HintState;
  padPulse: boolean;
  noteLaunch: () => void;
} {
  const [hint, setHint] = useState<HintState>(() =>
    hasLaunchedBefore(localStorage) ? "off" : "show",
  );
  const noteLaunch = useCallback(() => {
    // Only the very first launch writes; later launches are a no-op.
    setHint((prev) => {
      if (prev !== "show") return prev;
      markLaunched(localStorage);
      return "fading";
    });
  }, []);
  return { hint, padPulse: hint === "show", noteLaunch };
}
