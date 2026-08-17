import type { CacheMode } from "./response-freshness";

export interface CacheEnvelope<T> {
  payload: T;
  dataUpdatedAt: number;
  freshUntil: number;
  retainUntil: number;
}

export type CacheSelection<T> =
  | { state: "fresh"; payload: T; envelope: CacheEnvelope<T> }
  | { state: "stale"; payload: T; envelope: CacheEnvelope<T> }
  | { state: "none"; payload?: undefined; envelope?: undefined };

export interface SelectedPayload<T> {
  payload: T;
  cacheMode: Exclude<CacheMode, "network" | "miss">;
  envelope: CacheEnvelope<T>;
}

export function isRetained<T>(
  envelope: CacheEnvelope<T> | null | undefined,
  now: number = Date.now(),
): envelope is CacheEnvelope<T> {
  return Boolean(
    envelope &&
      Number.isFinite(envelope.dataUpdatedAt) &&
      Number.isFinite(envelope.freshUntil) &&
      Number.isFinite(envelope.retainUntil) &&
      envelope.retainUntil > now,
  );
}

export function isFresh<T>(
  envelope: CacheEnvelope<T> | null | undefined,
  now: number = Date.now(),
): envelope is CacheEnvelope<T> {
  return isRetained(envelope, now) && envelope.freshUntil > now;
}

export function selectPayload<T>(
  envelope: CacheEnvelope<T> | null | undefined,
  now: number = Date.now(),
): CacheSelection<T> {
  if (!isRetained(envelope, now)) {
    return { state: "none" };
  }

  if (envelope.freshUntil > now) {
    return { state: "fresh", payload: envelope.payload, envelope };
  }

  return { state: "stale", payload: envelope.payload, envelope };
}

/** Keeps the previous valid value when candidate is missing or outside retention. */
export function selectLastKnownValid<T>(
  candidate: CacheEnvelope<T> | null | undefined,
  previous: SelectedPayload<T> | null | undefined,
  now: number = Date.now(),
): SelectedPayload<T> | undefined {
  const candidateSelection = selectPayload(candidate, now);
  const previousSelection = selectPayload(previous?.envelope, now);
  const retainedSelections = [candidateSelection, previousSelection].filter(
    (selection): selection is Exclude<CacheSelection<T>, { state: "none" }> =>
      selection.state !== "none",
  );
  const newest = retainedSelections.reduce<
    Exclude<CacheSelection<T>, { state: "none" }> | undefined
  >((selected, current) => {
    if (!selected || current.envelope.dataUpdatedAt >= selected.envelope.dataUpdatedAt) {
      return current;
    }
    return selected;
  }, undefined);

  if (!newest) {
    return undefined;
  }

  return {
    payload: newest.payload,
    cacheMode: newest.state === "fresh" ? "fresh-cache" : "stale-cache",
    envelope: newest.envelope,
  };
}
