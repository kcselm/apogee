import { describe, expect, it } from "vitest";
import { ENGINE_VERSION } from "../src/index";

describe("engine package", () => {
  it("is wired up", () => {
    expect(ENGINE_VERSION).toBe("0.1.0");
  });
});
