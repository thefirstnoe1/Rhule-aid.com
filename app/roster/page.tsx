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
};

export default async function RosterPage() {
  const { env } = getCloudflareContext();
  const players = await getRoster(env as Env);

  return (
    <main>
      <SiteHeader />
      <PageHero eyebrow="Nebraska Football" title="Roster" />
      <RosterBrowser players={players} />
    </main>
  );
}

async function getRoster(env: Env): Promise<Player[]> {
  try {
    const response = await handleRosterRequest(new Request('https://rhule-aid.com/api/roster'), env);
    const payload = await response.json() as RosterResponse;
    return payload.success ? payload.data : [];
  } catch (error) {
    console.error('Roster page data error:', error);
    return [];
  }
}
