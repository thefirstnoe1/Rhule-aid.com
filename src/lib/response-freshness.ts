export type CacheMode = "network" | "fresh-cache" | "stale-cache" | "miss";

export type SourceState = "live" | "fresh-cache" | "stale-cache" | "unavailable";

export interface ResponseFreshnessMetadata {
  dataUpdatedAt: number;
  servedAt: number;
  cacheMode: CacheMode;
  stale: boolean;
  sourceState: SourceState;
}

export interface FreshnessInput {
  dataUpdatedAt: number;
  servedAt: number;
  cacheMode: CacheMode;
  sourceState: SourceState;
}

export function createFreshnessMetadata(
  input: FreshnessInput,
  now: number = Date.now(),
): ResponseFreshnessMetadata {
  return {
    dataUpdatedAt: input.dataUpdatedAt,
    servedAt: input.servedAt,
    cacheMode: input.cacheMode,
    stale: input.dataUpdatedAt > now ? false : input.cacheMode === "stale-cache",
    sourceState: input.sourceState,
  };
}
