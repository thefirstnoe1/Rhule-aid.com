import { getCloudflareContext } from '@opennextjs/cloudflare';
import { SiteHeader } from '../components/site-header';
import { PageHero } from '../components/page-hero';
import { RosterBrowser, type Player } from './roster-browser';
import { handleRosterRequest } from '../../src/api/roster';
import type { Env } from '../../src/types';
import { pageMetadata } from '../seo';

export const dynamic = 'force-dynamic';
export const metadata = pageMetadata('Nebraska Football Roster | Rhule Aid', 'Browse the Nebraska Cornhuskers football roster, players, positions, and jersey numbers.', '/roster');

type RosterResponse = {
  success: boolean;
  data: Player[];
  error?: string;
};

export default async function RosterPage() {
  const { env } = getCloudflareContext();
  const roster = await getRoster(env as Env);

  return (
    <main>
      <SiteHeader />
      <PageHero eyebrow="Nebraska Football" title="Roster" />
      <RosterBrowser players={roster.players} error={roster.error} />
    </main>
  );
}

async function getRoster(env: Env): Promise<{ players: Player[]; error?: string }> {
  try {
    const response = await handleRosterRequest(new Request('https://rhule-aid.com/api/roster'), env);
    const payload = await response.json() as RosterResponse;
    return payload.success ? { players: payload.data } : { players: [], error: payload.error || 'Roster data is unavailable right now.' };
  } catch (error) {
    console.error('Roster page data error:', error);
    return { players: [], error: 'Roster data is unavailable right now.' };
  }
}
