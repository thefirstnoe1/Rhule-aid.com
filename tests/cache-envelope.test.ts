import { describe, expect, it } from "vitest";
import {
  isFresh,
  isRetained,
  selectLastKnownValid,
  selectPayload,
  type CacheEnvelope,
  type SelectedPayload,
} from "../src/lib/cache-envelope";

const now = 1_000;

function envelope<T>(payload: T, freshUntil = 2_000, retainUntil = 3_000, dataUpdatedAt = 900): CacheEnvelope<T> {
  return {
    payload,
    dataUpdatedAt,
    freshUntil,
    retainUntil,
  };
}

describe("cache envelope selection", () => {
  it("selects a retained fresh payload", () => {
    const value = envelope({ id: "fresh" });

    expect(isRetained(value, now)).toBe(true);
    expect(isFresh(value, now)).toBe(true);
    expect(selectPayload(value, now)).toEqual({
      state: "fresh",
      payload: value.payload,
      envelope: value,
    });
  });

  it("selects a retained but stale payload", () => {
    const value = envelope("stale", 1_000, 3_000);

    expect(isFresh(value, now)).toBe(false);
    expect(selectPayload(value, now)).toEqual({
      state: "stale",
      payload: "stale",
      envelope: value,
    });
  });

  it("rejects an expired payload", () => {
    const value = envelope("expired", 900, 1_000);

    expect(isRetained(value, now)).toBe(false);
    expect(selectPayload(value, now)).toEqual({ state: "none" });
  });

  it("keeps valid empty payloads", () => {
    const empty = envelope<string[]>([]);

    expect(selectPayload(empty, now)).toMatchObject({ state: "fresh", payload: [] });
    expect(
      selectLastKnownValid(empty, null, now),
    ).toEqual<SelectedPayload<string[]> | undefined>({
      payload: [],
      cacheMode: "fresh-cache",
      envelope: empty,
    });
  });

  it("falls back to previous data when candidate is expired", () => {
    const previous = {
      payload: "previous",
      cacheMode: "stale-cache" as const,
      envelope: envelope("previous", 900, 1_500),
    };

    expect(selectLastKnownValid(envelope("expired", 900, 1_000), previous, now)).toEqual(previous);
  });

  it("prefers the newest fresh candidate over previous data", () => {
    const previous = {
      payload: "old",
      cacheMode: "stale-cache" as const,
      envelope: envelope("old", 900, 3_000),
    };
    const candidate = envelope("new", 2_000, 3_000, 1_100);

    expect(selectLastKnownValid(candidate, previous, now)).toEqual({
      payload: "new",
      cacheMode: "fresh-cache",
      envelope: candidate,
    });
  });

  it("does not replace fresh previous data with a stale candidate", () => {
    const previous = {
      payload: "fresh previous",
      cacheMode: "fresh-cache" as const,
      envelope: envelope("fresh previous", 2_000, 3_000, 1_100),
    };
    const staleCandidate = envelope("stale candidate", 900, 3_000, 900);

    expect(selectLastKnownValid(staleCandidate, previous, now)).toEqual(previous);
  });
});
