import { getCloudflareContext } from '@opennextjs/cloudflare';
import { SiteHeader } from '../components/site-header';
import { PageHero } from '../components/page-hero';
import { SurfaceCard, ButtonLink } from '../components/ui';
import { handleScheduleRequest } from '../../src/api/schedule';
import type { Env } from '../../src/types';
import type { ScheduleGame } from '../schedule/schedule-explorer';

export const dynamic = 'force-dynamic';

type ScheduleResponse = {
  success: boolean;
  data: ScheduleGame[];
};

export default async function GameDayPage() {
  const { env } = getCloudflareContext();
  const games = await getSchedule(env as Env);
  const nextGame = getNextGame(games) || games[0];

  return (
    <main>
      <SiteHeader />
      <PageHero eyebrow="Nebraska Football" title="Game Day" />
      <section className="container-shell grid gap-6 pb-20 lg:grid-cols-[1.1fr_0.9fr]">
        {nextGame ? <NextGamePanel game={nextGame} /> : <NoGamePanel />}
        <div className="grid content-start gap-4">
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
              <span className="text-sm font-black uppercase tracking-[0.2em] text-white/55">{game.isHome ? 'vs' : 'at'}</span>
              <Logo src={game.opponentLogo} alt={game.opponent} />
            </div>
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-white/60">{game.date} / {game.time}</p>
            <h2 className="mt-4 text-5xl font-black leading-[0.9] tracking-[-0.075em] md:text-7xl">
              Nebraska {game.isHome ? 'vs.' : 'at'} {game.opponent}
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

function getNextGame(games: ScheduleGame[]) {
  const now = Date.now();
  return games.find((game) => new Date(game.date).getTime() >= now);
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
