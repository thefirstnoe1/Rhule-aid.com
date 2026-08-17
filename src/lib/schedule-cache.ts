import { isRetained, type CacheEnvelope } from './cache-envelope';
import type { CanonicalSchedule, ProviderStates } from '../contracts/gameday';

export interface RetainedScheduleCache {
  payload: CanonicalSchedule;
  dataUpdatedAt: number;
  freshUntil: number;
  retainUntil: number;
  source: string;
  season: number;
  schema?: string;
  providers?: ProviderStates;
}

export async function readRetainedScheduleCache(
  cache: any,
  key: string,
  schema: string,
  now: number = Date.now(),
): Promise<RetainedScheduleCache | null> {
  if (!cache) return null;

  try {
    let value = await cache.get(key);
    let acceptedSchemas = [schema];
    if (schema === 'v6') {
      const upgradedKey = key.replace(/_v6$/, '_v7');
      if (!value && upgradedKey !== key) value = await cache.get(upgradedKey);
      acceptedSchemas = ['v6', 'v7'];
    }
    if (!value) return null;
    const parsed = JSON.parse(value) as Partial<RetainedScheduleCache>;
    const envelope: CacheEnvelope<CanonicalSchedule> = {
      payload: parsed.payload as CanonicalSchedule,
      dataUpdatedAt: parsed.dataUpdatedAt as number,
      freshUntil: parsed.freshUntil as number,
      retainUntil: parsed.retainUntil as number,
    };
    if (typeof parsed.schema !== 'string' || !acceptedSchemas.includes(parsed.schema) || !Array.isArray(envelope.payload) || !isRetained(envelope, now)) return null;
    if (typeof parsed.source !== 'string' || typeof parsed.season !== 'number') return null;
    const payload = envelope.payload.map((game) => {
      const espnId = game?.providerIds?.espn;
      if (typeof espnId === 'string' && espnId.trim()) return game;
      if (!game?.providerIds) return game;
      const { espn: _invalidEspnId, ...providerIds } = game.providerIds;
      return { ...game, providerIds: Object.keys(providerIds).length ? providerIds : undefined };
    });
    return { ...(parsed as RetainedScheduleCache), payload };
  } catch {
    return null;
  }
}
