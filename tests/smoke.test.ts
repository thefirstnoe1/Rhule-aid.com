import { describe, expect, it } from "vitest";

describe("test runner", () => {
  it("runs a TypeScript smoke test", () => {
    expect(1 + 1).toBe(2);
  });
});
