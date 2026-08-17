import { describe, expect, it } from "vitest";
import { createCacheEvent, emitCacheEvent } from "../src/lib/structured-event-log";

const input = {
  requestId: "request-1",
  source: "schedule",
  latencyMs: 42,
  cacheMode: "fresh-cache" as const,
  resultCount: 0,
  status: 200,
};

describe("structured cache event log", () => {
  it("creates a payload-free cache event", () => {
    const event = createCacheEvent(input);

    expect(event).toEqual({ event: "response-cache", ...input });
    expect(event).not.toHaveProperty("payload");
  });

  it("sends and returns the payload-free event", () => {
    const received: unknown[] = [];

    expect(emitCacheEvent(input, (event) => received.push(event))).toEqual({
      event: "response-cache",
      ...input,
    });
    expect(received).toHaveLength(1);
    expect(received[0]).not.toHaveProperty("payload");
  });
});
