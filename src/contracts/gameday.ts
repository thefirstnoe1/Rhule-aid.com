export type ProviderState = 'live' | 'unavailable' | 'invalid' | 'timeout' | 'error' | 'skipped';
export type SourceState = ProviderState;

/** Optional freshness envelope shared by weather and alert responses. */
export interface FreshnessMetadata {
  cached?: boolean;
  stale?: boolean;
  dataUpdatedAt?: string;
  servedAt?: string;
  sourceState?: ProviderState;
}

export interface WeatherFreshness extends FreshnessMetadata {
  source?: string;
}

export interface AlertFreshness extends FreshnessMetadata {
  source?: string;
}

/** Safe, non-sensitive source health suitable for degraded-state UI. */
export interface SourceHealth {
  state: ProviderState;
  stale?: boolean;
  lastSuccessAt?: string;
}

export type SourceHealthMap = Record<string, SourceHealth>;

export interface SourceHealthResponse {
  success: boolean;
  sourceHealth: SourceHealthMap;
  freshness?: FreshnessMetadata;
  error?: 'unavailable' | 'timeout' | 'invalid' | 'error';
}

export type ProviderStates = {
  cfbdGames: ProviderState;
  cfbdMedia: ProviderState;
  huskers: ProviderState;
  espn: ProviderState;
};

export interface CanonicalScheduleGame {
  season: number;
  gameKey: string;
  id?: number;
  date: string;
  opponent: string;
  opponentId?: number;
  homeTeam: string;
  awayTeam: string;
  homeTeamId?: number;
  awayTeamId?: number;
  nebraskaLogo: string;
  opponentLogo: string;
  time: string;
  location: string;
  network: string;
  tvNetwork: string;
  isHome: boolean;
  isNeutral?: boolean;
  result?: string;
  score?: string;
  kickoffAt?: string;
  kickoffStatus?: 'confirmed' | 'tba';
  venue?: { name: string; timezone: 'America/Chicago' | null; address?: { street: string; city: string; region: string; postalCode: string } };
  providerIds?: { cfbd?: number; espn?: string };
  fieldProvenance?: { kickoffAt?: 'cfbd' | 'espn' | 'huskers'; venue?: 'cfbd' | 'espn' | 'huskers' | 'unknown' };
}

export type CanonicalSchedule = CanonicalScheduleGame[];
export type ScheduleGame = CanonicalScheduleGame;

export type LiveGameState = 'scheduled' | 'pre' | 'live' | 'in_progress' | 'final' | 'postponed' | 'canceled' | 'unknown';

export interface LiveGameStatus {
  season: number;
  gameKey: string;
  status: LiveGameState;
  detail?: string;
  score?: { nebraska?: number; opponent?: number };
  homeTeam: string;
  awayTeam: string;
  homeScore?: number;
  awayScore?: number;
  clock?: string;
  period?: string;
  providerIds?: { espn?: string };
  updatedAt?: string;
  freshness?: {
    cached: boolean;
    stale: boolean;
    source: 'espn';
    dataUpdatedAt: string;
    servedAt: string;
  };
  nextPollSeconds: number;
}

export interface LiveGameStatusResponse {
  success: boolean;
  data: LiveGameStatus;
  cached: boolean;
  lastUpdated: string;
  source: 'espn';
  error?: string;
  meta?: {
    servedAt: string;
    sourceState: ProviderState;
    sources: Partial<ProviderStates>;
  };
}
