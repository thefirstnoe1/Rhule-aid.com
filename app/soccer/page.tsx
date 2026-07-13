import { getCloudflareContext } from '@opennextjs/cloudflare';
import { SiteHeader } from '../components/site-header';
import { PageHero } from '../components/page-hero';
import { SurfaceCard } from '../components/ui';
import { handleSoccerRequest } from '../../src/api/soccer';
import type { Env } from '../../src/types';
import { pageMetadata } from '../seo';

export const dynamic = 'force-dynamic';
export const metadata = pageMetadata('Nebraska Soccer Schedule | Rhule Aid', 'Follow Nebraska soccer fixtures, opponents, competitions, venues, and match status.', '/soccer');

type SoccerGame = {
  id: string;
  datetime?: string;
  date?: string;
  title?: string;
  opponent?: { name: string; customLogo?: { url: string }; officialLogo?: { url: string } };
  homeTeam?: { name: string; logo?: string };
  awayTeam?: { name: string; logo?: string };
  competition?: { name: string };
  venue?: { name?: string; city?: string; country?: string };
  location?: string;
  status?: string;
};

type SoccerResponse = {
  huskerWomens: SoccerGame[];
  usMens: SoccerGame[];
  usWomens: SoccerGame[];
};

export default async function SoccerPage() {
  const { env } = getCloudflareContext();
  const data = await getSoccer(env as Env);

  return (
    <main>
      <SiteHeader />
      <PageHero eyebrow="Soccer" title="Soccer" />
      <section className="container-shell grid gap-6 pb-20 lg:grid-cols-3">
        <SoccerColumn title="Nebraska Women" games={data.huskerWomens} />
        <SoccerColumn title="US Men" games={data.usMens} />
        <SoccerColumn title="US Women" games={data.usWomens} />
      </section>
    </main>
  );
}

function SoccerColumn({ title, games }: { title: string; games: SoccerGame[] }) {
  return (
    <SurfaceCard className="rounded-[2rem] p-6">
      <p className="eyebrow mb-4">{title}</p>
      <div className="grid gap-3">
        {games.slice(0, 8).map((game) => <SoccerCard key={game.id} game={game} />)}
        {games.length === 0 && <p className="text-sm text-[var(--muted)]">No upcoming matches available.</p>}
      </div>
    </SurfaceCard>
  );
}

function SoccerCard({ game }: { game: SoccerGame }) {
  const date = game.datetime || game.date;
  const title = game.title || [game.awayTeam?.name, game.homeTeam?.name].filter(Boolean).join(' at ') || 'Match TBD';
  const venue = game.location || game.venue?.name || game.venue?.city || game.competition?.name;

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-strong)] p-4">
      <div className="text-xs font-black uppercase tracking-[0.14em] text-[var(--muted)]">{formatDate(date)}</div>
      <div className="mt-2 font-black tracking-[-0.03em]">{title}</div>
      {venue ? <div className="mt-2 text-sm text-[var(--muted)]">{venue}</div> : null}
    </div>
  );
}

function formatDate(value?: string) {
  if (!value) return 'TBD';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'TBD' : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

async function getSoccer(env: Env): Promise<SoccerResponse> {
  try {
    const response = await handleSoccerRequest(new Request('https://rhule-aid.com/api/soccer'), env);
    return await response.json() as SoccerResponse;
  } catch (error) {
    console.error('Soccer page data error:', error);
    return { huskerWomens: [], usMens: [], usWomens: [] };
  }
}
