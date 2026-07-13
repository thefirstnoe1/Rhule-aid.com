import { getCloudflareContext } from '@opennextjs/cloudflare';
import { SiteHeader } from '../components/site-header';
import { ScheduleExplorer, type ScheduleGame } from './schedule-explorer';
import { handleScheduleRequest } from '../../src/api/schedule';
import { handleBigTenStandingsRequest } from '../../src/api/bigten-standings';
import type { Env } from '../../src/types';
import { pageMetadata } from '../seo';

export const dynamic = 'force-dynamic';
export const metadata = pageMetadata('Nebraska Football Schedule | Rhule Aid', 'Nebraska Cornhuskers football schedule with game times, opponents, venues, TV networks, and Big Ten standings.', '/schedule');

type ScheduleResponse = {
  success: boolean;
  data: ScheduleGame[];
  season?: number;
  lastUpdated?: string;
};

type StandingsResponse = {
  success: boolean;
  data: Array<{
    market: string;
    team_rank: string;
    data: Array<{
      conf_record?: string;
      ovr_record?: string;
    }>;
  }>;
};

export default async function SchedulePage() {
  const { env } = getCloudflareContext();
  const [schedule, standings] = await Promise.all([
    getSchedule(env as Env),
    getStandings(env as Env)
  ]);

  return (
    <main>
      <SiteHeader />
      <section className="container-shell pb-10 pt-10 md:pt-14">
        <p className="eyebrow mb-4">Nebraska Football</p>
        <h1 className="text-5xl font-black leading-[0.9] tracking-[-0.075em] text-[var(--foreground)] sm:text-7xl">
          {schedule.season} Schedule
        </h1>
      </section>

      <ScheduleExplorer
        games={schedule.data}
        standings={standings.data}
        lastUpdated={schedule.lastUpdated}
      />
    </main>
  );
}

async function getSchedule(env: Env): Promise<{ data: ScheduleGame[]; season: number; lastUpdated?: string }> {
  try {
    const response = await handleScheduleRequest(new Request('https://rhule-aid.com/api/schedule'), env);
    const payload = await response.json() as ScheduleResponse;

    return {
      data: payload.success ? payload.data : [],
      season: payload.season || new Date().getFullYear(),
      lastUpdated: payload.lastUpdated
    };
  } catch (error) {
    console.error('Schedule page data error:', error);
    return { data: [], season: new Date().getFullYear() };
  }
}

async function getStandings(env: Env): Promise<StandingsResponse> {
  try {
    const response = await handleBigTenStandingsRequest(new Request('https://rhule-aid.com/api/standings/big-ten'), env);
    const payload = await response.json() as StandingsResponse;
    return payload.success ? payload : { success: false, data: [] };
  } catch (error) {
    console.error('Schedule standings data error:', error);
    return { success: false, data: [] };
  }
}
