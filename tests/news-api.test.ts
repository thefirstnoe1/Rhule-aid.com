import { afterEach, describe, expect, it, vi } from 'vitest';
import { handleNewsRequest } from '../src/api/news.ts';

describe('news API publication dates', () => {
  afterEach(() => vi.restoreAllMocks());

  it('preserves unknown RSS publication dates instead of fabricating one', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(
      '<?xml version="1.0"?><rss><channel><item><title>Undated story</title><link>https://huskers.com/story</link><description>Story details</description></item></channel></rss>',
      { headers: { 'content-type': 'application/rss+xml' } },
    )));

    const response = await handleNewsRequest(new Request('https://rhule-aid.com/api/news?fresh=true'), {});
    const payload = await response.json() as { data: Array<{ publishedAt?: string }> };

    expect(payload.data).toHaveLength(1);
    expect(payload.data[0]).not.toHaveProperty('publishedAt');
  });
});
