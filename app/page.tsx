import Image from 'next/image';
import Link from 'next/link';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { SiteHeader } from './components/site-header';
import { ButtonLink, SurfaceCard } from './components/ui';
import { handleScheduleRequest } from '../src/api/schedule';
import { handleNewsRequest } from '../src/api/news';
import { handleWeatherRequest } from '../src/api/weather';
import type { Env } from '../src/types';

export const dynamic = 'force-dynamic';

type HomeGame = {
  date: string;
  opponent: string;
  time: string;
  location: string;
  network?: string;
  tvNetwork?: string;
  isHome: boolean;
  isNeutral?: boolean;
  nebraskaLogo: string;
  opponentLogo: string;
};

type NewsItem = {
  title: string;
  link: string;
  source: string;
  publishedAt: string;
};

type WeatherData = {
  location: string;
  current: {
    temperature: number;
    temperatureUnit: string;
    conditions: string;
    humidity: number | string;
    windSpeed: number;
    windDirection: string;
  };
};

const quickLinks = [
  {
    label: 'Schedule',
    title: 'Kickoffs, TV, and venues',
    href: '/schedule'
  },
  {
    label: 'Game Day',
    title: 'Next matchup details',
    href: '/gameday'
  },
  {
    label: 'Roster',
    title: 'Players and positions',
    href: '/roster'
  },
  {
    label: 'News',
    title: 'Latest Husker updates',
    href: '/news'
  }
];

export default async function Home() {
  const { env } = getCloudflareContext();
  const [games, news, weather] = await Promise.all([
    getSchedule(env as Env),
    getNews(env as Env),
    getWeather(env as Env)
  ]);
  const nextGame = getNextGame(games) || games[0];
  const leadNews = news[0];

  return (
    <main>
      <SiteHeader />

      <section className="container-shell grid min-h-[calc(100vh-118px)] items-center gap-10 pb-12 pt-8 lg:grid-cols-[1fr_0.95fr] lg:pb-20 lg:pt-14">
        <div>
          <p className="eyebrow mb-5">Rhule Aid</p>
          <h1 className="max-w-4xl text-5xl font-black leading-[0.9] tracking-[-0.075em] text-[var(--foreground)] sm:text-7xl lg:text-8xl">
            Nebraska football, without the clutter.
          </h1>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <ButtonLink href="/schedule">View Schedule</ButtonLink>
            <ButtonLink href="/gameday" variant="secondary">Game Day</ButtonLink>
          </div>
        </div>

        {nextGame ? <NextGameCard game={nextGame} /> : <FallbackHeroCard />}
      </section>

      <section className="container-shell grid gap-5 pb-10 md:grid-cols-4">
        {quickLinks.map((item) => (
          <Link key={item.href} href={item.href} className="surface-card rounded-[1.75rem] p-6 no-underline transition hover:-translate-y-1 hover:border-[var(--scarlet)]">
            <div className="eyebrow">{item.label}</div>
            <h2 className="mt-5 text-2xl font-black leading-tight tracking-[-0.05em]">{item.title}</h2>
            <div className="mt-8 text-sm font-black uppercase tracking-[0.16em] text-[var(--scarlet)]">Open</div>
          </Link>
        ))}
      </section>

      <section className="container-shell grid gap-6 pb-20 lg:grid-cols-[1fr_0.75fr]">
        <SurfaceCard className="rounded-[2rem] p-7 md:p-9">
          <p className="eyebrow mb-4">Latest</p>
          {leadNews ? (
            <>
              <h2 className="text-4xl font-black leading-none tracking-[-0.06em] md:text-5xl">
                <a href={leadNews.link} target="_blank" rel="noreferrer">{leadNews.title}</a>
              </h2>
              <div className="mt-6 flex flex-wrap gap-2 text-xs font-black uppercase tracking-[0.14em] text-[var(--muted)]">
                <span>{leadNews.source}</span>
                <span>/</span>
                <span>{formatDate(leadNews.publishedAt)}</span>
              </div>
              <div className="mt-8">
                <ButtonLink href="/news" variant="secondary">More News</ButtonLink>
              </div>
            </>
          ) : (
            <h2 className="text-3xl font-black tracking-[-0.05em]">Latest news is unavailable right now.</h2>
          )}
        </SurfaceCard>

        <WeatherCard weather={weather} />
      </section>
    </main>
  );
}

function WeatherCard({ weather }: { weather: WeatherData | null }) {
  return (
    <SurfaceCard className="rounded-[2rem] p-7 md:p-9">
      <p className="eyebrow mb-4">Lincoln Weather</p>
      {weather ? (
        <>
          <div className="flex items-start justify-between gap-5">
            <div>
              <div className="text-7xl font-black leading-none tracking-[-0.08em] text-[var(--scarlet)]">
                {weather.current.temperature}°
              </div>
              <h2 className="mt-4 text-3xl font-black leading-none tracking-[-0.06em]">{weather.current.conditions}</h2>
            </div>
            <div className="rounded-3xl bg-[var(--surface-soft)] px-4 py-3 text-right text-xs font-black uppercase tracking-[0.14em] text-[var(--muted)]">
              {weather.location}
            </div>
          </div>
          <div className="mt-8 grid grid-cols-2 gap-3 text-sm font-bold text-[var(--muted)]">
            <div className="rounded-2xl bg-[var(--surface-soft)] p-4">
              <div className="text-xs uppercase tracking-[0.14em]">Wind</div>
              <div className="mt-2 text-[var(--foreground)]">{weather.current.windDirection} {weather.current.windSpeed} mph</div>
            </div>
            <div className="rounded-2xl bg-[var(--surface-soft)] p-4">
              <div className="text-xs uppercase tracking-[0.14em]">Humidity</div>
              <div className="mt-2 text-[var(--foreground)]">{weather.current.humidity}{typeof weather.current.humidity === 'number' ? '%' : ''}</div>
            </div>
          </div>
        </>
      ) : (
        <h2 className="text-3xl font-black tracking-[-0.05em]">Lincoln weather is unavailable right now.</h2>
      )}
    </SurfaceCard>
  );
}

function NextGameCard({ game }: { game: HomeGame }) {
  return (
    <SurfaceCard className="overflow-hidden rounded-[2rem]">
      <div className="relative min-h-[470px] bg-[var(--hero-panel)] p-7 text-white sm:p-8">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(208,0,0,0.92),transparent_32%),linear-gradient(135deg,rgba(23,19,18,0.12),var(--hero-panel-soft))]" />
        <div className="relative z-10 flex min-h-[410px] flex-col justify-between">
          <div className="flex items-center justify-between gap-4">
            <span className="rounded-full border border-white/20 px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-white/80">Next Game</span>
            <span className="rounded-full bg-white px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-[var(--scarlet-dark)]">{game.network || game.tvNetwork || 'TBD'}</span>
          </div>
          <div>
            <div className="mb-8 flex items-center gap-5">
              <Logo src={game.nebraskaLogo} alt="Nebraska logo" />
              <span className="text-sm font-black uppercase tracking-[0.2em] text-white/55">{game.isHome ? 'vs' : 'at'}</span>
              <Logo src={game.opponentLogo} alt={`${game.opponent} logo`} />
            </div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-white/60">{game.date} / {game.time}</p>
            <h2 className="mt-3 text-5xl font-black leading-[0.9] tracking-[-0.075em] md:text-6xl">
              Nebraska {game.isHome ? 'vs.' : 'at'} {game.opponent}
            </h2>
            <p className="mt-5 text-sm font-bold uppercase tracking-[0.16em] text-white/65">{game.location}</p>
          </div>
        </div>
      </div>
    </SurfaceCard>
  );
}

function FallbackHeroCard() {
  return (
    <SurfaceCard className="overflow-hidden rounded-[2rem]">
      <div className="relative min-h-[470px] bg-[var(--hero-panel)] p-8 text-white">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(208,0,0,0.92),transparent_32%),linear-gradient(135deg,rgba(23,19,18,0.12),var(--hero-panel-soft))]" />
        <div className="relative z-10 flex min-h-[410px] flex-col justify-between">
          <Image src="/images/logos/nebraska-logo.png" alt="Nebraska N" width={72} height={72} className="h-16 w-16 object-contain" />
          <h2 className="text-5xl font-black leading-[0.9] tracking-[-0.075em]">Go Big Red.</h2>
        </div>
      </div>
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

function getNextGame(games: HomeGame[]) {
  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  return games.find((game) => new Date(game.date).getTime() >= todayStart);
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Recently' : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

async function getSchedule(env: Env): Promise<HomeGame[]> {
  try {
    const response = await handleScheduleRequest(new Request('https://rhule-aid.com/api/schedule'), env);
    const payload = await response.json() as { success: boolean; data: HomeGame[] };
    return payload.success ? payload.data : [];
  } catch (error) {
    console.error('Homepage schedule error:', error);
    return [];
  }
}

async function getNews(env: Env): Promise<NewsItem[]> {
  try {
    const response = await handleNewsRequest(new Request('https://rhule-aid.com/api/news'), env);
    const payload = await response.json() as { success: boolean; data: NewsItem[] };
    return payload.success ? payload.data : [];
  } catch (error) {
    console.error('Homepage news error:', error);
    return [];
  }
}

async function getWeather(env: Env): Promise<WeatherData | null> {
  try {
    const response = await handleWeatherRequest(new Request('https://rhule-aid.com/api/weather?location=Lincoln%2C%20NE&source=tomorrow'), env);
    const payload = await response.json() as { success: boolean } & WeatherData;
    return payload.success ? payload : null;
  } catch (error) {
    console.error('Homepage weather error:', error);
    return null;
  }
}
