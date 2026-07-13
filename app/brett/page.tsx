import { getCloudflareContext } from '@opennextjs/cloudflare';
import { SiteHeader } from '../components/site-header';
import { PageHero } from '../components/page-hero';
import { SurfaceCard, ButtonLink } from '../components/ui';
import { handleScheduleRequest } from '../../src/api/schedule';
import type { Env } from '../../src/types';
import type { ScheduleGame } from '../schedule/schedule-explorer';
import { pageMetadata } from '../seo';

export const dynamic = 'force-dynamic';
export const metadata = pageMetadata('Nebraska Football Game Safety | Rhule Aid', 'A Nebraska football game-day guide for kickoff timing, matchup context, and the next Husker game.', '/brett');

type ScheduleResponse = {
  success: boolean;
  data: ScheduleGame[];
};

type SafetyStatus = {
  tone: 'safe' | 'caution' | 'unavailable';
  label: string;
  message: string;
  game?: ScheduleGame;
  daysUntilGame?: number;
  isToday?: boolean;
};

export default async function BrettPage() {
  const { env } = getCloudflareContext();
  const games = await getSchedule(env as Env);
  const status = analyzeOvenSafety(games);

  return (
    <main>
      <SiteHeader />
      <PageHero eyebrow="Lincoln Check" title="Oven Safety" />
      <section className="container-shell grid gap-6 pb-20 lg:grid-cols-[1fr_0.85fr]">
        <SafetyPanel status={status} />
        <div className="grid content-start gap-4">
          {status.game ? <GameCard game={status.game} /> : null}
          <SurfaceCard className="rounded-[1.75rem] p-6">
            <p className="eyebrow mb-3">Rule</p>
            <p className="text-sm leading-6 text-[var(--muted)]">
              Home game today means avoid downtown. Home game within three days means use caution. Away and neutral-site games are treated as safe.
            </p>
            <div className="mt-6">
              <ButtonLink href="/schedule" variant="secondary">View Schedule</ButtonLink>
            </div>
          </SurfaceCard>
        </div>
      </section>
    </main>
  );
}

function SafetyPanel({ status }: { status: SafetyStatus }) {
  const colors = {
    safe: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600',
    caution: 'border-[var(--scarlet)]/40 bg-[var(--scarlet)]/10 text-[var(--scarlet)]',
    unavailable: 'border-[var(--border)] bg-[var(--surface-strong)] text-[var(--muted)]'
  };

  return (
    <SurfaceCard className="rounded-[2rem] p-8 md:p-10">
      <div className={`inline-flex rounded-full border px-4 py-2 text-xs font-black uppercase tracking-[0.16em] ${colors[status.tone]}`}>
        {status.label}
      </div>
      <h2 className="mt-8 text-5xl font-black leading-[0.9] tracking-[-0.075em] md:text-7xl">
        {status.message}
      </h2>
      {status.daysUntilGame !== undefined ? (
        <p className="mt-6 text-lg leading-8 text-[var(--muted)]">
          Next relevant home game is {status.isToday ? 'today' : `in ${status.daysUntilGame} day${status.daysUntilGame === 1 ? '' : 's'}`}.
        </p>
      ) : null}
    </SurfaceCard>
  );
}

function GameCard({ game }: { game: ScheduleGame }) {
  return (
    <SurfaceCard className="rounded-[1.75rem] p-6">
      <p className="eyebrow mb-4">Relevant Game</p>
      <div className="mb-5 flex items-center gap-4">
        <Logo src={game.nebraskaLogo} alt="Nebraska" />
        <span className="text-xs font-black uppercase tracking-[0.16em] text-[var(--muted)]">{game.isHome ? 'vs' : 'at'}</span>
        <Logo src={game.opponentLogo} alt={game.opponent} />
      </div>
      <h3 className="text-3xl font-black tracking-[-0.06em]">Nebraska {game.isHome ? 'vs.' : 'at'} {game.opponent}</h3>
      <div className="mt-5 grid gap-3 text-sm">
        <Detail label="Date" value={game.date} />
        <Detail label="Time" value={game.time} />
        <Detail label="Venue" value={game.location} />
        <Detail label="TV" value={game.network || game.tvNetwork || 'TBD'} />
      </div>
    </SurfaceCard>
  );
}

function Logo({ src, alt }: { src: string; alt: string }) {
  return (
    <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-[var(--border)] bg-white p-2 shadow-sm">
      <img src={src} alt={alt} className="max-h-full max-w-full object-contain" />
    </div>
  );
}

function Detail({ label, value }: { label: string; value?: string }) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-strong)] p-4">
      <div className="text-[0.65rem] font-black uppercase tracking-[0.14em] text-[var(--muted)]">{label}</div>
      <div className="mt-1 font-black">{value || 'TBD'}</div>
    </div>
  );
}

function analyzeOvenSafety(games: ScheduleGame[]): SafetyStatus {
  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const sortedGames = [...games].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const relevantGame = sortedGames.find((game) => new Date(game.date).getTime() >= todayStart);

  if (!relevantGame) {
    return {
      tone: 'safe',
      label: 'Safe',
      message: 'Safe to go.'
    };
  }

  const gameDate = new Date(relevantGame.date);
  const gameStart = new Date(gameDate.getFullYear(), gameDate.getMonth(), gameDate.getDate()).getTime();
  const daysUntilGame = Math.ceil((gameStart - todayStart) / (1000 * 60 * 60 * 24));
  const isToday = daysUntilGame === 0;

  if (relevantGame.isHome && isToday) {
    return {
      tone: 'caution',
      label: 'Not Safe',
      message: 'Avoid downtown.',
      game: relevantGame,
      daysUntilGame,
      isToday
    };
  }

  if (relevantGame.isHome && daysUntilGame <= 3) {
    return {
      tone: 'caution',
      label: 'Caution',
      message: 'Downtown will be busier soon.',
      game: relevantGame,
      daysUntilGame,
      isToday
    };
  }

  return {
    tone: 'safe',
    label: 'Safe',
    message: 'Safe to go.',
    game: relevantGame,
    daysUntilGame,
    isToday
  };
}

async function getSchedule(env: Env): Promise<ScheduleGame[]> {
  try {
    const response = await handleScheduleRequest(new Request('https://rhule-aid.com/api/schedule'), env);
    const payload = await response.json() as ScheduleResponse;
    return payload.success ? payload.data : [];
  } catch (error) {
    console.error('Brett page schedule error:', error);
    return [];
  }
}
