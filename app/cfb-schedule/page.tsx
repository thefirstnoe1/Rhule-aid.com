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
        <div className="grid gap-5 lg:grid-cols-[1fr_26rem] lg:items-end">
          <div>
            <h1 className="max-w-4xl text-5xl font-black leading-[0.88] tracking-[-0.085em] text-[var(--foreground)] sm:text-7xl lg:text-8xl">
              Every Kickoff. One Board.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-[var(--muted)] sm:text-lg">
              A live college football schedule board with scores, rankings, TV windows, and conference filters.
            </p>
          </div>
          <div className="overflow-hidden rounded-[2rem] border border-[var(--border)] bg-[var(--foreground)] text-[var(--background)] shadow-[0_24px_80px_rgba(23,19,18,0.18)]">
            <div className="border-b border-white/15 px-5 py-4 text-xs font-black uppercase tracking-[0.18em] opacity-70">Live Board</div>
            <div className="grid grid-cols-2 gap-px bg-white/10 text-center">
              <div className="bg-[var(--foreground)] p-5">
                <div className="text-3xl font-black tracking-[-0.08em]">5 min</div>
                <div className="mt-1 text-[0.65rem] font-black uppercase tracking-[0.16em] opacity-70">Live Refresh</div>
              </div>
              <div className="bg-[var(--foreground)] p-5">
                <div className="text-3xl font-black tracking-[-0.08em]">TV</div>
                <div className="mt-1 text-[0.65rem] font-black uppercase tracking-[0.16em] opacity-70">Networks</div>
              </div>
            </div>
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
