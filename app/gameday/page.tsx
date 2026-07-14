import { getCloudflareContext } from '@opennextjs/cloudflare';
import { SiteHeader } from '../components/site-header';
import { PageHero } from '../components/page-hero';
import { SurfaceCard, ButtonLink } from '../components/ui';
import { handleScheduleRequest } from '../../src/api/schedule';
import { handleWeatherRequest } from '../../src/api/weather';
import type { Env } from '../../src/types';
import type { ScheduleGame } from '../schedule/schedule-explorer';
import { pageMetadata } from '../seo';
import { selectNextGame } from '../schedule/schedule-utils';

export const dynamic = 'force-dynamic';
export const metadata = pageMetadata('Nebraska Football Game Day | Rhule Aid', 'Nebraska football game day details, including the next matchup, kickoff, venue, and where to watch.', '/gameday');

type ScheduleResponse = {
  success: boolean;
  data: ScheduleGame[];
};

type ForecastDay = {
  dateKey: string;
  temperature: number;
  temperatureUnit: string;
  shortForecast: string;
  precipitationProbability: number;
};

type WeatherResponse = {
  success: boolean;
  location?: string;
  forecast?: ForecastDay[];
  error?: string;
};

type WeatherState = 'outside-window' | 'unavailable' | 'loaded';

type GameVenue = {
  city: string;
  state: string;
};

const opponentCities: Record<string, GameVenue> = {
  Ohio: { city: 'Athens', state: 'OH' },
  'Bowling Green': { city: 'Bowling Green', state: 'OH' },
  'North Dakota': { city: 'Grand Forks', state: 'ND' },
  'Michigan State': { city: 'East Lansing', state: 'MI' },
  Maryland: { city: 'College Park', state: 'MD' },
  Indiana: { city: 'Bloomington', state: 'IN' },
  Oregon: { city: 'Eugene', state: 'OR' },
  Illinois: { city: 'Champaign', state: 'IL' },
  Rutgers: { city: 'Piscataway', state: 'NJ' },
  'Ohio State': { city: 'Columbus', state: 'OH' },
  Iowa: { city: 'Iowa City', state: 'IA' }
};

export default async function GameDayPage() {
  const { env } = getCloudflareContext();
  const games = await getSchedule(env as Env);
  const nextGame = selectNextGame(games, new Date());
  const withinForecastWindow = nextGame ? isWithinForecastWindow(nextGame) : false;
  const weather = withinForecastWindow && nextGame ? await getGameDayWeather(nextGame, env as Env) : null;
  const weatherState: WeatherState = !withinForecastWindow ? 'outside-window' : weather ? 'loaded' : 'unavailable';

  return (
    <main>
      <SiteHeader />
      <PageHero eyebrow="Nebraska Football" title="Game Day" />
      <section className="container-shell grid gap-6 pb-20 lg:grid-cols-[1.1fr_0.9fr]">
        {nextGame ? <NextGamePanel game={nextGame} /> : <NoGamePanel />}
        <div className="grid content-start gap-4">
          <WeatherCard game={nextGame} weather={weather} state={weatherState} />
          <InfoCard label="Where To Watch" value={nextGame?.network || nextGame?.tvNetwork || 'TBD'} detail="Broadcast information comes from the official Huskers schedule when available." />
          <InfoCard label="Venue" value={nextGame?.location || 'TBD'} detail={nextGame?.isHome ? 'Home game' : nextGame?.isNeutral ? 'Neutral site' : 'Road game'} />
          <SurfaceCard className="rounded-[1.75rem] p-6">
            <p className="eyebrow mb-3">Useful Links</p>
            <div className="grid gap-3">
              <ButtonLink href="/schedule" variant="secondary">Full Schedule</ButtonLink>
              <a href="https://huskers.com/football-game-day-information" target="_blank" rel="noreferrer" className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-7 py-4 text-center text-sm font-black uppercase tracking-[0.16em] text-[var(--foreground)] transition hover:border-[var(--foreground)] hover:bg-[var(--surface-strong)]">
                Game Day Info
              </a>
            </div>
          </SurfaceCard>
        </div>
      </section>
    </main>
  );
}

function WeatherCard({ game, weather, state }: { game?: ScheduleGame; weather: WeatherResponse | null; state: WeatherState }) {
  const venue = game ? getGameVenue(game) : null;
  const forecast = weather?.forecast?.find((day) => day.dateKey === getGameDateKey(game?.date || ''));

  return (
    <SurfaceCard className="rounded-[1.75rem] p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="eyebrow mb-3">Game Day Forecast</p>
          <h2 className="text-2xl font-black tracking-[-0.05em]">{venue ? `${venue.city}, ${venue.state}` : 'Forecast unavailable'}</h2>
        </div>
        {game ? <span className="rounded-full bg-[var(--surface-strong)] px-3 py-2 text-xs font-black uppercase tracking-[0.14em] text-[var(--muted)]">{game.date}</span> : null}
      </div>

      {!game ? <p className="mt-4 text-sm leading-6 text-[var(--muted)]">No upcoming game to forecast yet.</p> : null}
      {game && state === 'unavailable' ? <p className="mt-4 text-sm leading-6 text-[var(--muted)]">Forecast is temporarily unavailable for this venue.</p> : null}
      {game && state === 'outside-window' ? <p className="mt-4 text-sm leading-6 text-[var(--muted)]">This game is outside Tomorrow.io&apos;s available 7-day forecast window.</p> : null}
      {game && state === 'loaded' && weather && !forecast ? <p className="mt-4 text-sm leading-6 text-[var(--muted)]">Forecast is not available for this game date.</p> : null}
      {forecast ? (
        <div className="mt-5 grid grid-cols-3 gap-3 border-t border-[var(--border)] pt-5">
          <WeatherStat label="High" value={`${forecast.temperature}°${forecast.temperatureUnit}`} />
          <WeatherStat label="Conditions" value={forecast.shortForecast} />
          <WeatherStat label="Rain chance" value={`${forecast.precipitationProbability}%`} />
        </div>
      ) : null}
      <a href="https://www.tomorrow.io/weather-api/" target="_blank" rel="noreferrer" className="mt-5 inline-block text-xs text-[var(--muted)] underline decoration-[var(--border)] underline-offset-4 transition hover:text-[var(--foreground)]">
        Weather by Tomorrow.io
      </a>
    </SurfaceCard>
  );
}

function WeatherStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-black uppercase tracking-[0.12em] text-[var(--muted)]">{label}</p>
      <p className="mt-2 text-lg font-black leading-tight tracking-[-0.04em]">{value}</p>
    </div>
  );
}

function NextGamePanel({ game }: { game: ScheduleGame }) {
  return (
    <SurfaceCard className="overflow-hidden rounded-[2rem]">
      <div className="relative min-h-[500px] bg-[var(--hero-panel)] p-7 text-white md:p-9">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(208,0,0,0.92),transparent_34%),linear-gradient(135deg,rgba(23,19,18,0.12),var(--hero-panel-soft))]" />
        <div className="relative z-10 flex min-h-[430px] flex-col justify-between">
          <div className="flex items-center justify-between gap-4">
            <span className="rounded-full border border-white/20 px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-white/75">Next Up</span>
            <span className="rounded-full bg-white px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-[var(--scarlet-dark)]">{game.isHome ? 'Home' : game.isNeutral ? 'Neutral' : 'Away'}</span>
          </div>
          <div>
            <div className="mb-8 flex items-center gap-5">
              <Logo src={game.nebraskaLogo} alt="Nebraska" />
              <span className="text-sm font-black uppercase tracking-[0.2em] text-white/55">{getMatchupLabel(game)}</span>
              <Logo src={game.opponentLogo} alt={game.opponent} />
            </div>
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-white/60">{game.date} / {game.time}</p>
            <h2 className="mt-4 text-5xl font-black leading-[0.9] tracking-[-0.075em] md:text-7xl">
              Nebraska {getMatchupLabel(game)} {game.opponent}
            </h2>
          </div>
        </div>
      </div>
    </SurfaceCard>
  );
}

function InfoCard({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <SurfaceCard className="rounded-[1.75rem] p-6">
      <p className="eyebrow mb-3">{label}</p>
      <div className="text-3xl font-black tracking-[-0.06em]">{value}</div>
      {detail ? <p className="mt-3 text-sm leading-6 text-[var(--muted)]">{detail}</p> : null}
    </SurfaceCard>
  );
}

function Logo({ src, alt }: { src: string; alt: string }) {
  return (
    <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-white p-3 shadow-xl">
      <img src={src} alt={alt} className="max-h-full max-w-full object-contain" />
    </div>
  );
}

function NoGamePanel() {
  return (
    <SurfaceCard className="rounded-[2rem] p-8">
      <h2 className="text-3xl font-black tracking-[-0.05em]">No upcoming game found.</h2>
      <p className="mt-3 text-[var(--muted)]">Check the schedule page for the latest updates.</p>
    </SurfaceCard>
  );
}

function getMatchupLabel(game: ScheduleGame) {
  return game.isHome || game.isNeutral ? 'vs.' : 'at';
}

function getGameVenue(game: ScheduleGame): GameVenue | null {
  return game.isHome ? { city: 'Lincoln', state: 'NE' } : opponentCities[game.opponent] || null;
}

function getGameDateKey(value: string): string {
  const isoDate = value.match(/\d{4}-\d{2}-\d{2}/)?.[0];
  if (isoDate) return isoDate;

  const match = value.match(/\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),\s+(\d{4})\b/i);
  if (!match) return '';

  const month = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'].indexOf(match[0].split(' ')[0]!.toLowerCase());
  return `${match[2]}-${String(month + 1).padStart(2, '0')}-${String(Number(match[1])).padStart(2, '0')}`;
}

function getTodayDateKey(timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function isWithinForecastWindow(game: ScheduleGame): boolean {
  const venue = getGameVenue(game);
  const gameDateKey = getGameDateKey(game.date);
  if (!venue || !gameDateKey) return false;

  const today = Date.parse(`${getTodayDateKey(getVenueTimeZone(venue.state))}T00:00:00Z`);
  const gameDate = Date.parse(`${gameDateKey}T00:00:00Z`);
  const daysAway = (gameDate - today) / 86400000;
  return daysAway >= 0 && daysAway <= 6;
}

function getVenueTimeZone(state: string): string {
  if (['OH', 'MI', 'MD', 'IN', 'NJ'].includes(state)) return 'America/New_York';
  if (state === 'OR') return 'America/Los_Angeles';
  return 'America/Chicago';
}

async function getGameDayWeather(game: ScheduleGame, env: Env): Promise<WeatherResponse | null> {
  const venue = getGameVenue(game);
  if (!venue) {
    console.error(`Game day weather location missing for ${game.opponent}`);
    return null;
  }

  try {
    const location = `${venue.city}, ${venue.state}`;
    const params = new URLSearchParams({ location, source: 'tomorrow' });
    const response = await handleWeatherRequest(new Request(`https://rhule-aid.com/api/weather?${params.toString()}`), env);
    const payload = await response.json() as WeatherResponse;
    return response.ok && payload.success ? payload : null;
  } catch (error) {
    console.error('Game day weather error:', error);
    return null;
  }
}

async function getSchedule(env: Env): Promise<ScheduleGame[]> {
  try {
    const response = await handleScheduleRequest(new Request('https://rhule-aid.com/api/schedule'), env);
    const payload = await response.json() as ScheduleResponse;
    return payload.success ? payload.data : [];
  } catch (error) {
    console.error('Game day schedule error:', error);
    return [];
  }
}
