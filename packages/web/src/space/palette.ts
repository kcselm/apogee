// packages/web/src/space/palette.ts

/** Canvas colors shared by render.ts and cosmos.ts. Mirrors the chrome palette. */
export const COLORS = {
  ringPoints: ["#ffd54f", "#4fc3f7", "#7986cb"], // 5 / 3 / 1 points
  pad: "#80cbc4",
  probe: "#ffffff",
  probeLanded: "#a5d6a7",
  preview: "rgba(255, 213, 79, 0.85)",
  blockerBody: "#4d2026",
  blockerRim: "#e0564a",
  goalLocked: "#5c6b8a",
  goalOpen: "#80cbc4",
  key: "#ffd54f",
  target: "#ffb74d",
  targetHit: "#a5d6a7",
} as const;
