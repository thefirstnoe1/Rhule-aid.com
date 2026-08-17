import type { CacheMode } from "./response-freshness";

export interface CacheEventInput {
  requestId: string;
  source: string;
  latencyMs: number;
  cacheMode: CacheMode;
  resultCount: number;
  status: number;
}

export interface CacheEvent extends CacheEventInput {
  event: "response-cache";
}

export type EventSink = (event: CacheEvent) => void;

export function createCacheEvent(input: CacheEventInput): CacheEvent {
  return {
    event: "response-cache",
    requestId: input.requestId,
    source: input.source,
    latencyMs: input.latencyMs,
    cacheMode: input.cacheMode,
    resultCount: input.resultCount,
    status: input.status,
  };
}

export function emitCacheEvent(input: CacheEventInput, sink: EventSink): CacheEvent {
  const event = createCacheEvent(input);
  sink(event);
  return event;
}
