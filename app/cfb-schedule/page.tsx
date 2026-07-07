import { getCloudflareContext } from '@opennextjs/cloudflare';
import { SiteHeader } from '../components/site-header';
import { onRequest as handleCFBScheduleRequest } from '../../src/api/cfb-schedule';
import type { Env } from '../../src/types';
import { CFBScheduleExplorer, type CFBScheduleData } from './cfb-schedule-explorer';

export const dynamic = 'force-dynamic';

export default async function CFBSchedulePage() {
  const { env } = getCloudflareContext();
  const schedule = await getCFBSchedule(env as Env);

  return (
    <main>
      <SiteHeader />
      <section className="container-shell pb-8 pt-10 md:pt-14">
        <p className="eyebrow mb-4">College Football</p>
        <div className="grid gap-5 lg:grid-cols-[1fr_24rem] lg:items-end">
          <div>
            <h1 className="text-5xl font-black leading-[0.9] tracking-[-0.075em] text-[var(--foreground)] sm:text-7xl">
              Full CFB Schedule
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-[var(--muted)] sm:text-lg">
              Live scores, TV info, rankings, and conference filters across the college football slate.
            </p>
          </div>
          <div className="rounded-[1.75rem] border border-[var(--border)] bg-[var(--surface)] p-5 text-sm leading-6 text-[var(--muted)] backdrop-blur">
            Data refreshes automatically during live games. Times default to Central and can be changed below.
          </div>
        </div>
      </section>

      <CFBScheduleExplorer initialData={schedule} />
    </main>
  );
}

async function getCFBSchedule(env: Env): Promise<CFBScheduleData> {
  try {
    const response = await handleCFBScheduleRequest({
      request: new Request('https://rhule-aid.com/api/cfb-schedule'),
      env
    });
    const payload = await response.json() as CFBScheduleData;

    return {
      games: Array.isArray(payload.games) ? payload.games : [],
      weeks: Array.isArray(payload.weeks) ? payload.weeks : [],
      lastUpdated: payload.lastUpdated,
      hasLiveGames: Boolean(payload.hasLiveGames)
    };
  } catch (error) {
    console.error('CFB schedule page data error:', error);
    return {
      games: [],
      weeks: [],
      lastUpdated: new Date().toISOString(),
      hasLiveGames: false,
      error: 'Live data unavailable'
    };
  }
}
