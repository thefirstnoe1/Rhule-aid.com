'use client';

import { useMemo, useState } from 'react';
import { SurfaceCard } from '../components/ui';

export type ScheduleGame = {
  date: string;
  opponent: string;
  opponentId?: number;
  time: string;
  location: string;
  network?: string;
  tvNetwork: string;
  homeTeam: string;
  awayTeam: string;
  homeTeamId?: number;
  awayTeamId?: number;
  nebraskaLogo: string;
  opponentLogo: string;
  isHome: boolean;
  isNeutral?: boolean;
  result?: string;
  score?: string;
};

type Standing = {
  market: string;
  team_rank: string;
  data: Array<{
    conf_record?: string;
    ovr_record?: string;
  }>;
};

type ScheduleExplorerProps = {
  games: ScheduleGame[];
  standings: Standing[];
  lastUpdated?: string;
};

type Filter = 'all' | 'home' | 'away' | 'neutral' | 'conference';

const bigTenOpponents = new Set([
  'Illinois',
  'Indiana',
  'Iowa',
  'Maryland',
  'Michigan',
  'Michigan State',
  'Minnesota',
  'Northwestern',
  'Ohio State',
  'Oregon',
  'Penn State',
  'Purdue',
  'Rutgers',
  'UCLA',
  'USC',
  'Washington',
  'Wisconsin'
]);

const filters: Array<{ label: string; value: Filter }> = [
  { label: 'All', value: 'all' },
  { label: 'Home', value: 'home' },
  { label: 'Away', value: 'away' },
  { label: 'Neutral', value: 'neutral' },
  { label: 'Big Ten', value: 'conference' }
];

const timezones = [
  { label: 'Central', value: 'America/Chicago' },
  { label: 'Eastern', value: 'America/New_York' },
  { label: 'Mountain', value: 'America/Denver' },
  { label: 'Pacific', value: 'America/Los_Angeles' }
];

export function ScheduleExplorer({ games, standings, lastUpdated }: ScheduleExplorerProps) {
  const [filter, setFilter] = useState<Filter>('all');
  const [timezone, setTimezone] = useState('America/Chicago');

  const filteredGames = useMemo(() => {
    return games.filter((game) => {
      if (filter === 'home') return game.isHome && !game.isNeutral;
      if (filter === 'away') return !game.isHome && !game.isNeutral;
      if (filter === 'neutral') return game.isNeutral;
      if (filter === 'conference') return bigTenOpponents.has(game.opponent);
      return true;
    });
  }, [filter, games]);

  return (
    <div className="container-shell pb-20">
      <div className="mb-6 flex flex-col gap-4 rounded-[1.75rem] border border-[var(--border)] bg-[var(--surface)] p-4 backdrop-blur md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap gap-2">
          {filters.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => setFilter(item.value)}
              className={`rounded-full px-4 py-2 text-xs font-black uppercase tracking-[0.14em] transition ${filter === item.value ? 'bg-[var(--foreground)] text-[var(--background)]' : 'border border-[var(--border)] text-[var(--muted)] hover:border-[var(--foreground)] hover:text-[var(--foreground)]'}`}
            >
              {item.label}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-3 text-xs font-black uppercase tracking-[0.14em] text-[var(--muted)]">
          Timezone
          <select
            value={timezone}
            onChange={(event) => setTimezone(event.target.value)}
            className="rounded-full border border-[var(--border)] bg-[var(--surface-strong)] px-4 py-2 text-sm font-bold normal-case tracking-normal text-[var(--foreground)] outline-none"
          >
            {timezones.map((item) => (
              <option key={item.value} value={item.value}>{item.label}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <section className="grid gap-4">
          {filteredGames.length > 0 ? filteredGames.map((game, index) => (
            <GameCard key={`${game.date}-${game.opponent}-${index}`} game={game} timezone={timezone} index={index} />
          )) : (
            <SurfaceCard className="rounded-[1.75rem] p-8 text-center">
              <h2 className="text-2xl font-black tracking-[-0.04em]">No games match this filter.</h2>
              <p className="mt-2 text-sm text-[var(--muted)]">Try another schedule view.</p>
            </SurfaceCard>
          )}
        </section>

        <aside className="grid content-start gap-4">
          <SurfaceCard className="rounded-[1.75rem] p-6">
            <p className="eyebrow mb-4">Big Ten Standings</p>
            <div className="grid gap-3">
              {standings.slice(0, 8).map((team) => (
                <div key={team.market} className={`grid grid-cols-[2rem_1fr_auto] items-center gap-3 rounded-2xl border border-[var(--border)] p-3 text-sm ${team.market.toLowerCase().includes('nebraska') ? 'bg-[var(--scarlet)] text-white' : 'bg-[var(--surface-strong)]'}`}>
                  <span className="font-black">{team.team_rank}</span>
                  <span className="font-bold">{team.market}</span>
                  <span className="text-xs font-black opacity-80">{getRecord(team, 'conf_record')}</span>
                </div>
              ))}
              {standings.length === 0 && <p className="text-sm text-[var(--muted)]">Standings are not available yet.</p>}
            </div>
            {lastUpdated && (
              <p className="mt-5 text-xs leading-5 text-[var(--muted)]">Schedule updated {new Date(lastUpdated).toLocaleString()}</p>
            )}
          </SurfaceCard>
        </aside>
      </div>
    </div>
  );
}

function GameCard({ game, timezone, index }: { game: ScheduleGame; timezone: string; index: number }) {
  const gameType = game.isNeutral ? 'Neutral' : game.isHome ? 'Home' : 'Away';
  const convertedTime = formatGameTime(game, timezone);
  const dateParts = getDateParts(game.date);
  const network = game.network || game.tvNetwork || 'TBD';

  return (
    <SurfaceCard className="overflow-hidden rounded-[1.75rem] transition hover:-translate-y-0.5 hover:border-[var(--scarlet)]">
      <div className="grid gap-5 p-5 md:grid-cols-[6.5rem_1fr_auto] md:items-center md:p-6">
        <div className="rounded-2xl bg-[var(--foreground)] p-4 text-center text-[var(--background)]">
          <div className="text-xs font-black uppercase tracking-[0.16em] opacity-70">{dateParts.month}</div>
          <div className="mt-1 text-4xl font-black tracking-[-0.08em]">{dateParts.day}</div>
          <div className="mt-1 text-[0.65rem] font-black uppercase tracking-[0.16em] opacity-70">{dateParts.weekday}</div>
        </div>
        <div>
          <div className="mb-3 flex flex-wrap gap-2">
            <span className="rounded-full bg-[var(--scarlet)] px-3 py-1 text-xs font-black uppercase tracking-[0.14em] text-white">{gameType}</span>
            {bigTenOpponents.has(game.opponent) && <span className="rounded-full border border-[var(--border)] px-3 py-1 text-xs font-black uppercase tracking-[0.14em] text-[var(--muted)]">Big Ten</span>}
            {game.result && <span className="rounded-full border border-[var(--border)] px-3 py-1 text-xs font-black uppercase tracking-[0.14em] text-[var(--muted)]">{game.result} {game.score}</span>}
          </div>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <TeamLogo src={game.nebraskaLogo} alt="Nebraska logo" />
            <div className="text-sm font-black uppercase tracking-[0.16em] text-[var(--muted)]">{game.isHome ? 'vs' : 'at'}</div>
            <TeamLogo src={game.opponentLogo} alt={`${game.opponent} logo`} />
            <h2 className="text-3xl font-black tracking-[-0.06em] sm:text-4xl">{game.isHome ? 'Nebraska vs.' : 'Nebraska at'} {game.opponent}</h2>
          </div>
          <p className="mt-3 text-sm leading-6 text-[var(--muted)]">{game.date} at {convertedTime}</p>
        </div>
        <div className="min-w-48 rounded-2xl border border-[var(--border)] bg-[var(--surface-strong)] p-4 md:text-right">
          <div className="text-xs font-black uppercase tracking-[0.14em] text-[var(--muted)]">Venue</div>
          <div className="mt-1 font-black">{game.location || 'TBA'}</div>
          <div className="mt-4 text-xs font-black uppercase tracking-[0.14em] text-[var(--muted)]">TV</div>
          <div className="mt-1 font-black">{network}</div>
        </div>
      </div>
    </SurfaceCard>
  );
}

function TeamLogo({ src, alt }: { src: string; alt: string }) {
  return (
    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-[var(--border)] bg-white p-2 shadow-sm">
      <img src={src} alt={alt} className="max-h-full max-w-full object-contain" loading="lazy" />
    </div>
  );
}

function getRecord(team: Standing, key: 'conf_record' | 'ovr_record') {
  return team.data.find((item) => item[key])?.[key] || '0-0';
}

function getDateParts(dateString: string) {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) {
    return { month: 'TBD', day: '--', weekday: 'Date' };
  }

  return {
    month: date.toLocaleDateString('en-US', { month: 'short' }),
    day: date.toLocaleDateString('en-US', { day: 'numeric' }),
    weekday: date.toLocaleDateString('en-US', { weekday: 'short' })
  };
}

function formatGameTime(game: ScheduleGame, timezone: string) {
  if (!game.time || game.time === 'TBD' || !game.date || game.date === 'TBD') {
    return 'TBD';
  }

  if (timezone === 'America/Chicago' && /\bC[DS]T\b/.test(game.time)) {
    return game.time;
  }

  const date = new Date(game.date);
  if (Number.isNaN(date.getTime())) {
    return `${game.time} CT`;
  }

  const [timePart, period, abbreviation] = game.time.split(' ');
  if (!timePart) {
    return `${game.time} CT`;
  }

  const [rawHour, rawMinute = '0'] = timePart.split(':');
  let hour = Number(rawHour);
  const minute = Number(rawMinute);

  if (Number.isNaN(hour) || Number.isNaN(minute)) {
    return `${game.time} CT`;
  }

  if (period?.toLowerCase() === 'pm' && hour !== 12) hour += 12;
  if (period?.toLowerCase() === 'am' && hour === 12) hour = 0;

  const offsetHours = abbreviation === 'CST' ? 6 : 5;
  const centralDate = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), hour + offsetHours, minute));

  return new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short'
  }).format(centralDate);
}
