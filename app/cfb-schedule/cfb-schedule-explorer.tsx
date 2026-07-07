'use client';

import { useEffect, useMemo, useState } from 'react';
import { SurfaceCard } from '../components/ui';

type Team = {
  name: string;
  shortName: string;
  logo: string;
  rank?: number;
  conference: string;
  score: number;
};

type Game = {
  id: string;
  date: string;
  time: string;
  datetime: string;
  week: number;
  homeTeam: Team;
  awayTeam: Team;
  venue: string;
  location: string;
  tv: string;
  status: string;
  isCompleted: boolean;
  spread: string | null;
};

export type CFBScheduleData = {
  games: Game[];
  weeks: Array<{ value: string; label: string }>;
  lastUpdated?: string;
  hasLiveGames?: boolean;
  error?: string;
};

type Filters = {
  week: string;
  conference: string;
  status: string;
  rankedOnly: boolean;
};

const conferences = ['Big Ten', 'SEC', 'ACC', 'Big 12', 'Pac-12', 'Mountain West', 'American', 'Conference USA', 'MAC', 'Sun Belt', 'Independent'];

const timezones = [
  { value: 'America/Chicago', label: 'Central' },
  { value: 'America/New_York', label: 'Eastern' },
  { value: 'America/Denver', label: 'Mountain' },
  { value: 'America/Los_Angeles', label: 'Pacific' },
  { value: 'UTC', label: 'UTC' }
];

export function CFBScheduleExplorer({ initialData }: { initialData: CFBScheduleData }) {
  const [scheduleData, setScheduleData] = useState(initialData);
  const [filters, setFilters] = useState<Filters>({ week: '', conference: '', status: '', rankedOnly: false });
  const [timezone, setTimezone] = useState('America/Chicago');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(Boolean(initialData.error));

  const filteredGames = useMemo(() => {
    return scheduleData.games.filter((game) => {
      if (filters.week && game.week.toString() !== filters.week) return false;
      if (filters.conference && game.homeTeam.conference !== filters.conference && game.awayTeam.conference !== filters.conference) return false;
      if (filters.status && getGameStatus(game) !== filters.status) return false;
      if (filters.rankedOnly && !game.homeTeam.rank && !game.awayTeam.rank) return false;
      return true;
    });
  }, [filters, scheduleData.games]);

  const gamesByDate = useMemo(() => {
    return filteredGames.reduce<Record<string, Game[]>>((groups, game) => {
      groups[game.date] = [...(groups[game.date] || []), game];
      return groups;
    }, {});
  }, [filteredGames]);

  async function loadSchedule() {
    setLoading(true);
    setError(false);

    try {
      const url = new URL('/api/cfb-schedule', window.location.origin);
      if (filters.week) url.searchParams.set('week', filters.week);

      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data = await response.json() as CFBScheduleData;
      setScheduleData({
        games: Array.isArray(data.games) ? data.games : [],
        weeks: Array.isArray(data.weeks) ? data.weeks : [],
        lastUpdated: data.lastUpdated,
        hasLiveGames: Boolean(data.hasLiveGames)
      });
    } catch (loadError) {
      console.error('Error loading CFB schedule:', loadError);
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const hasLiveGames = filteredGames.some((game) => getGameStatus(game) === 'live');
    if (!hasLiveGames) return undefined;

    const interval = window.setInterval(() => {
      void loadSchedule();
    }, 300000);

    return () => window.clearInterval(interval);
  }, [filteredGames, filters.week]);

  return (
    <div className="container-shell pb-20">
      <SurfaceCard className="mb-6 rounded-[1.75rem] p-4 md:p-5">
        <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <FilterSelect label="Week" value={filters.week} onChange={(value) => setFilters((current) => ({ ...current, week: value }))}>
              <option value="">All Weeks</option>
              {scheduleData.weeks.map((week) => <option key={week.value} value={week.value}>{week.label}</option>)}
            </FilterSelect>

            <FilterSelect label="Conference" value={filters.conference} onChange={(value) => setFilters((current) => ({ ...current, conference: value }))}>
              <option value="">All Conferences</option>
              {conferences.map((conference) => <option key={conference} value={conference}>{conference}</option>)}
            </FilterSelect>

            <FilterSelect label="Status" value={filters.status} onChange={(value) => setFilters((current) => ({ ...current, status: value }))}>
              <option value="">All Games</option>
              <option value="scheduled">Scheduled</option>
              <option value="live">Live</option>
              <option value="completed">Completed</option>
            </FilterSelect>

            <FilterSelect label="Timezone" value={timezone} onChange={setTimezone}>
              {timezones.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </FilterSelect>

            <label className="flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-strong)] px-4 py-3 text-sm font-black text-[var(--foreground)]">
              <input
                type="checkbox"
                checked={filters.rankedOnly}
                onChange={(event) => setFilters((current) => ({ ...current, rankedOnly: event.target.checked }))}
                className="h-4 w-4 accent-[var(--scarlet)]"
              />
              Ranked Only
            </label>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center lg:justify-end">
            <button
              type="button"
              onClick={() => void loadSchedule()}
              disabled={loading}
              className="rounded-full bg-[var(--scarlet)] px-5 py-3 text-xs font-black uppercase tracking-[0.16em] text-white shadow-[0_18px_45px_var(--scarlet-shadow)] transition hover:bg-[var(--scarlet-dark)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? 'Refreshing' : 'Refresh'}
            </button>
            {scheduleData.lastUpdated && <p className="text-xs text-[var(--muted)]">Updated {new Date(scheduleData.lastUpdated).toLocaleTimeString()}</p>}
          </div>
        </div>
      </SurfaceCard>

      {error && (
        <SurfaceCard className="mb-6 rounded-[1.75rem] p-6 text-center">
          <h2 className="text-2xl font-black tracking-[-0.04em]">Unable to load schedule data.</h2>
          <p className="mt-2 text-sm text-[var(--muted)]">Try refreshing the schedule in a moment.</p>
        </SurfaceCard>
      )}

      {!error && filteredGames.length === 0 && (
        <SurfaceCard className="rounded-[1.75rem] p-8 text-center">
          <h2 className="text-2xl font-black tracking-[-0.04em]">No games match these filters.</h2>
          <p className="mt-2 text-sm text-[var(--muted)]">Try another week, conference, or status.</p>
        </SurfaceCard>
      )}

      <div className="grid gap-8">
        {Object.keys(gamesByDate).sort().map((date) => (
          <DateSection key={date} date={date} games={gamesByDate[date] || []} timezone={timezone} />
        ))}
      </div>
    </div>
  );
}

function FilterSelect({ label, value, onChange, children }: { label: string; value: string; onChange: (value: string) => void; children: React.ReactNode }) {
  return (
    <label className="grid gap-2 text-xs font-black uppercase tracking-[0.14em] text-[var(--muted)]">
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="rounded-2xl border border-[var(--border)] bg-[var(--surface-strong)] px-4 py-3 text-sm font-bold normal-case tracking-normal text-[var(--foreground)] outline-none"
      >
        {children}
      </select>
    </label>
  );
}

function DateSection({ date, games, timezone }: { date: string; games: Game[]; timezone: string }) {
  const formattedDate = formatDate(date);
  const sortedGames = [...games].sort((a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime());

  return (
    <section>
      <div className="mb-4 flex items-end justify-between gap-4 border-b border-[var(--border)] pb-3">
        <h2 className="text-3xl font-black tracking-[-0.06em]">{formattedDate}</h2>
        <span className="text-xs font-black uppercase tracking-[0.16em] text-[var(--muted)]">{games.length} games</span>
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        {sortedGames.map((game) => <GameCard key={game.id} game={game} timezone={timezone} />)}
      </div>
    </section>
  );
}

function GameCard({ game, timezone }: { game: Game; timezone: string }) {
  const status = getGameStatus(game);

  return (
    <SurfaceCard className={`overflow-hidden rounded-[1.75rem] transition hover:-translate-y-0.5 ${status === 'live' ? 'border-[var(--scarlet)]' : ''}`}>
      <div className="grid gap-4 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            <span className={`rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.14em] ${status === 'live' ? 'bg-[var(--scarlet)] text-white' : 'border border-[var(--border)] text-[var(--muted)]'}`}>
              {game.status}
            </span>
            {game.tv !== 'TBD' && <span className="rounded-full border border-[var(--border)] px-3 py-1 text-xs font-black uppercase tracking-[0.14em] text-[var(--muted)]">{game.tv}</span>}
          </div>
          <time className="text-sm font-black text-[var(--foreground)]">{formatTime(game.datetime, timezone)}</time>
        </div>

        <div className="grid gap-3">
          <TeamRow team={game.awayTeam} showScore={status !== 'scheduled'} />
          <div className="px-2 text-xs font-black uppercase tracking-[0.18em] text-[var(--muted)]">at</div>
          <TeamRow team={game.homeTeam} showScore={status !== 'scheduled'} />
        </div>

        <div className="grid gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-strong)] p-4 text-sm sm:grid-cols-2">
          <div>
            <div className="text-xs font-black uppercase tracking-[0.14em] text-[var(--muted)]">Venue</div>
            <div className="mt-1 font-bold">{game.venue}</div>
            <div className="mt-1 text-[var(--muted)]">{game.location}</div>
          </div>
          <div className="sm:text-right">
            <div className="text-xs font-black uppercase tracking-[0.14em] text-[var(--muted)]">Line</div>
            <div className="mt-1 font-bold">{game.spread || 'TBD'}</div>
          </div>
        </div>
      </div>
    </SurfaceCard>
  );
}

function TeamRow({ team, showScore }: { team: Team; showScore: boolean }) {
  return (
    <div className="grid grid-cols-[3.5rem_1fr_auto] items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-strong)] p-3">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white p-2 shadow-sm">
        <img src={team.logo || '/images/logos/default-logo.png'} alt={`${team.name} logo`} className="max-h-full max-w-full object-contain" loading="lazy" />
      </div>
      <div className="min-w-0">
        <h3 className="truncate text-lg font-black tracking-[-0.035em]">
          {team.rank && team.rank <= 25 && <span className="mr-2 text-[var(--scarlet)]">#{team.rank}</span>}
          {team.shortName || team.name}
        </h3>
        <p className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--muted)]">{team.conference}</p>
      </div>
      <div className="text-3xl font-black tracking-[-0.08em]">{showScore ? team.score : ''}</div>
    </div>
  );
}

function getGameStatus(game: Game) {
  if (game.isCompleted) return 'completed';
  if (/\b(Q|OT)\b|half|halftime|quarter/i.test(game.status)) return 'live';
  return 'scheduled';
}

function formatTime(datetime: string, timezone: string) {
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: timezone,
    timeZoneName: 'short'
  }).format(new Date(datetime));
}

function formatDate(date: string) {
  const [year, month, day] = date.split('-').map(Number);
  const dateObject = new Date(year || new Date().getFullYear(), (month || 1) - 1, day || 1);

  return dateObject.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  });
}
