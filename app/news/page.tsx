import { getCloudflareContext } from '@opennextjs/cloudflare';
import { SiteHeader } from '../components/site-header';
import { PageHero } from '../components/page-hero';
import { SurfaceCard } from '../components/ui';
import { handleNewsRequest } from '../../src/api/news';
import type { Env } from '../../src/types';

export const dynamic = 'force-dynamic';

type NewsItem = {
  title: string;
  summary?: string;
  description?: string;
  link: string;
  source: string;
  publishedAt: string;
  category?: string;
  thumbnail?: string;
};

type NewsResponse = {
  success: boolean;
  data: NewsItem[];
  lastUpdated?: string;
};

export default async function NewsPage() {
  const { env } = getCloudflareContext();
  const news = await getNews(env as Env);
  const [lead, ...articles] = news.data;

  return (
    <main>
      <SiteHeader />
      <PageHero eyebrow="Nebraska Football" title="Latest News" />
      <section className="container-shell pb-20">
        {lead ? <LeadArticle article={lead} /> : <EmptyNews />}
        <div className="mt-6 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {articles.map((article) => <ArticleCard key={`${article.link}-${article.title}`} article={article} />)}
        </div>
      </section>
    </main>
  );
}

function LeadArticle({ article }: { article: NewsItem }) {
  return (
    <SurfaceCard className="grid overflow-hidden rounded-[2rem] lg:grid-cols-[0.9fr_1.1fr]">
      <ArticleImage article={article} large />
      <div className="p-7 md:p-9">
        <p className="eyebrow mb-4">Top Story</p>
        <h2 className="text-4xl font-black leading-none tracking-[-0.06em] md:text-5xl">
          <a href={article.link} target="_blank" rel="noreferrer">{article.title}</a>
        </h2>
        <p className="mt-5 text-base leading-7 text-[var(--muted)]">{article.summary || article.description}</p>
        <ArticleMeta article={article} />
      </div>
    </SurfaceCard>
  );
}

function ArticleCard({ article }: { article: NewsItem }) {
  return (
    <SurfaceCard className="overflow-hidden rounded-[1.75rem] transition hover:-translate-y-1 hover:border-[var(--scarlet)]">
      <ArticleImage article={article} />
      <div className="p-6">
        <p className="eyebrow mb-3">{article.category || article.source}</p>
        <h2 className="text-2xl font-black leading-tight tracking-[-0.05em]">
          <a href={article.link} target="_blank" rel="noreferrer">{article.title}</a>
        </h2>
        <p className="mt-3 line-clamp-3 text-sm leading-6 text-[var(--muted)]">{article.summary || article.description}</p>
        <ArticleMeta article={article} />
      </div>
    </SurfaceCard>
  );
}

function ArticleImage({ article, large = false }: { article: NewsItem; large?: boolean }) {
  if (article.thumbnail) {
    return <img src={article.thumbnail} alt="" className={`${large ? 'min-h-80' : 'h-48'} w-full object-cover`} loading="lazy" />;
  }

  return (
    <div className={`${large ? 'min-h-80' : 'h-48'} flex items-center justify-center bg-[var(--foreground)] text-[var(--background)]`}>
      <span className="text-5xl font-black tracking-[-0.08em]">N</span>
    </div>
  );
}

function ArticleMeta({ article }: { article: NewsItem }) {
  return (
    <div className="mt-6 flex flex-wrap gap-2 text-xs font-black uppercase tracking-[0.14em] text-[var(--muted)]">
      <span>{article.source}</span>
      <span>/</span>
      <span>{formatDate(article.publishedAt)}</span>
    </div>
  );
}

function EmptyNews() {
  return (
    <SurfaceCard className="rounded-[1.75rem] p-8 text-center">
      <h2 className="text-2xl font-black tracking-[-0.04em]">News is unavailable right now.</h2>
      <p className="mt-2 text-sm text-[var(--muted)]">Check back soon for Nebraska football updates.</p>
    </SurfaceCard>
  );
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Recently' : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

async function getNews(env: Env): Promise<NewsResponse> {
  try {
    const response = await handleNewsRequest(new Request('https://rhule-aid.com/api/news'), env);
    const payload = await response.json() as NewsResponse;
    return payload.success ? payload : { success: false, data: [] };
  } catch (error) {
    console.error('News page data error:', error);
    return { success: false, data: [] };
  }
}
