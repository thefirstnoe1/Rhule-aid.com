import { describe, expect, it } from "vitest";
import { createFreshnessMetadata } from "../src/lib/response-freshness";

describe("response freshness metadata", () => {
  it("preserves timestamps and cache semantics for fresh data", () => {
    expect(
      createFreshnessMetadata(
        {
          dataUpdatedAt: 900,
          servedAt: 1_100,
          cacheMode: "fresh-cache",
          sourceState: "fresh-cache",
        },
        1_000,
      ),
    ).toEqual({
      dataUpdatedAt: 900,
      servedAt: 1_100,
      cacheMode: "fresh-cache",
      stale: false,
      sourceState: "fresh-cache",
    });
  });

  it("marks stale-cache data stale while preserving metadata", () => {
    expect(
      createFreshnessMetadata(
        {
          dataUpdatedAt: 900,
          servedAt: 1_100,
          cacheMode: "stale-cache",
          sourceState: "stale-cache",
        },
        1_000,
      ),
    ).toMatchObject({
      dataUpdatedAt: 900,
      servedAt: 1_100,
      cacheMode: "stale-cache",
      stale: true,
    });
  });

  it("does not mark network data stale solely because timestamp is old", () => {
    expect(
      createFreshnessMetadata(
        {
          dataUpdatedAt: 900,
          servedAt: 1_100,
          cacheMode: "network",
          sourceState: "live",
        },
        1_000,
      ).stale,
    ).toBe(false);
  });
});
