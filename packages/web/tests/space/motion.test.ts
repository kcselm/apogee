import { describe, expect, it } from "vitest";
import { shouldAnimate } from "../../src/space/motion";

describe("shouldAnimate", () => {
  it("animates only when motion is allowed and tab is visible", () => {
    expect(shouldAnimate(false, false)).toBe(true);
  });
  it("does not animate when reduced motion is requested", () => {
    expect(shouldAnimate(true, false)).toBe(false);
  });
  it("does not animate when the tab is hidden", () => {
    expect(shouldAnimate(false, true)).toBe(false);
  });
});
