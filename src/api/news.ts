// News API for Cloudflare Worker - Nebraska Huskers Only
interface NewsItem {
  title: string;
  summary: string;
  link: string;
  source: string;
  publishedAt?: string;
  category: string;
  thumbnail?: string;
  description?: string;
}

export async function handleNewsRequest(request: Request, env: any): Promise<Response> {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Check for bypass parameter to skip cache during debugging
    const url = new URL(request.url);
    const bypassCache = url.searchParams.get('fresh') === 'true';
    
    // Check cache (15 minute cache for news) unless bypassed
    const cacheKey = 'nebraska-huskers-news-v5-fresh'; // Fresh cache key
    let cached = null;
    
    if (!bypassCache) {
      cached = await env.NEWS_CACHE?.get(cacheKey);
      
      if (cached) {
        const cachedData = JSON.parse(cached);
        if (cachedData.timestamp && (Date.now() - cachedData.timestamp) < 900000) { // 15 minutes
          return new Response(JSON.stringify({
            success: true,
            data: cachedData.data,
            cached: true,
            lastUpdated: new Date(cachedData.timestamp).toISOString(),
            count: cachedData.data.length
          }), { headers: corsHeaders });
        }
      }
    }

    // Fetch fresh Nebraska Huskers news
    let newsData: NewsItem[] = [];
    let debugInfo: any = {};
    
    try {
      // Primary: Parse official Nebraska RSS feed
      console.log('Attempting to parse RSS feed...');
      const rssNews = await parseNebraskaRSSFeed();
      console.log(`RSS parsing returned ${rssNews.length} articles`);
      debugInfo.rssCount = rssNews.length;
      debugInfo.rssSuccess = true;
      newsData.push(...rssNews);
    } catch (error) {
      debugInfo.rssError = error instanceof Error ? error.message : 'Unknown RSS error';
      console.warn('Failed to parse RSS feed:', debugInfo.rssError);
      
      // Secondary source: scrape Nebraska Athletics football news
      try {
        console.log('Attempting to scrape athletics news...');
        const athleticsNews = await scrapeNebraskaFootballNews();
        console.log(`Scraping returned ${athleticsNews.length} articles`);
        debugInfo.scrapeCount = athleticsNews.length;
        debugInfo.scrapeSuccess = true;
        newsData.push(...athleticsNews);
      } catch (scrapeError2) {
        debugInfo.scrapeError = scrapeError2 instanceof Error ? scrapeError2.message : 'Unknown scrape error';
        console.warn('Failed to scrape Athletics football news:', debugInfo.scrapeError);
      }
    }
    
    if (newsData.length === 0) {
      console.warn('No news scraped. Debug info:', debugInfo);
    } else {
      console.log(`Successfully retrieved ${newsData.length} live news articles`);
    }
    
    // Sort by date and limit to most recent 15 articles
    newsData.sort((a, b) => new Date(b.publishedAt || 0).getTime() - new Date(a.publishedAt || 0).getTime());
    newsData = newsData.slice(0, 15);
    
    // Cache the result unless bypassed
    if (!bypassCache) {
      await env.NEWS_CACHE?.put(cacheKey, JSON.stringify({
        data: newsData,
        timestamp: Date.now()
      }));
    }

    return new Response(JSON.stringify({
      success: true,
      data: newsData,
      cached: false,
      lastUpdated: new Date().toISOString(),
      count: newsData.length,
      debug: bypassCache ? debugInfo : undefined
    }), { headers: corsHeaders });

  } catch (error) {
    console.error('News fetch error:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to fetch news',
      data: [],
      debug: error instanceof Error ? error.message : 'Unknown error'
    }), { 
      status: 200,
      headers: corsHeaders 
    });
  }
}

async function parseNebraskaRSSFeed(): Promise<NewsItem[]> {
  try {
    const response = await fetch('https://huskers.com/sports/football/rss', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Rhule-Aid News Reader/1.0)',
        'Accept': 'application/rss+xml, application/xml, text/xml',
        'Accept-Encoding': 'gzip, deflate, br'
      }
    });
    
    if (!response.ok) throw new Error(`RSS fetch failed: ${response.status}`);
    
    // Handle potential gzip compression
    let rssText: string;
    try {
      rssText = await response.text();
    } catch (error) {
      console.warn('Failed to decode RSS response:', error);
      throw error;
    }
    
    // Check if response looks like XML
    if (!rssText.includes('<?xml') && !rssText.includes('<rss')) {
      console.warn('Response does not appear to be valid XML/RSS');
      throw new Error('Invalid RSS format received');
    }
    
    const articles: NewsItem[] = [];
    
    // Parse RSS XML for news items
    const itemRegex = /<item>(.*?)<\/item>/gis;
    let match;
    
    while ((match = itemRegex.exec(rssText)) && articles.length < 12) {
      const itemContent = match[1];
      if (!itemContent) continue;
      
      // Extract title
      const titleMatch = itemContent.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/i) || 
                        itemContent.match(/<title>(.*?)<\/title>/i);
      const title = titleMatch?.[1]?.trim();
      
      // Extract link
      const linkMatch = itemContent.match(/<link>(.*?)<\/link>/i);
      const link = linkMatch?.[1]?.trim();
      
      // Extract description/summary
      const descMatch = itemContent.match(/<description><!\[CDATA\[(.*?)\]\]><\/description>/is) ||
                       itemContent.match(/<description>(.*?)<\/description>/is);
      let description = descMatch?.[1]?.trim();
      
      // Clean HTML from description and extract text
      if (description) {
        description = description.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
        if (description.length > 200) {
          description = description.substring(0, 200) + '...';
        }
      } else {
        description = title ? `Latest Nebraska Football news: ${title}` : 'Nebraska Football update';
      }
      
      // Extract publication date
      const pubDateMatch = itemContent.match(/<pubDate>(.*?)<\/pubDate>/i);
      const pubDateStr = pubDateMatch?.[1]?.trim();
      let publishedAt: string | undefined;
      
      if (pubDateStr) {
        try {
          const parsedDate = new Date(pubDateStr);
          if (!isNaN(parsedDate.getTime())) {
            publishedAt = parsedDate.toISOString();
          }
        } catch (e) {
          console.warn('Failed to parse date:', pubDateStr);
        }
      }
      
      // Try to extract image from content
      let thumbnail: string | undefined;
      const imgMatch = itemContent.match(/<img[^>]+src=['"]([^'"]+)['"][^>]*>/i);
      if (imgMatch?.[1]) {
        thumbnail = imgMatch[1];
        // Ensure absolute URL
        if (thumbnail && !thumbnail.startsWith('http')) {
          thumbnail = `https://huskers.com${thumbnail}`;
        }
      }
      
      // Alternative: Look for media:content or enclosure tags
      if (!thumbnail) {
        const mediaMatch = itemContent.match(/<media:content[^>]+url=['"]([^'"]+)['"][^>]*>/i) ||
                          itemContent.match(/<enclosure[^>]+url=['"]([^'"]+)['"][^>]*>/i);
        if (mediaMatch?.[1]) {
          thumbnail = mediaMatch[1];
        }
      }
      
      if (!thumbnail) {
        thumbnail = 'https://huskers.com/images/logos/site/site.png';
      }
      
      if (title && link && description) {
        articles.push({
          title: title,
          summary: description,
          description: description,
          link: link,
          source: 'Nebraska Athletics',
          publishedAt: publishedAt,
          category: 'official',
          thumbnail: thumbnail
        });
      }
    }
    
    console.log(`Parsed ${articles.length} articles from RSS feed`);
    return articles;
  } catch (error) {
    console.error('RSS parsing error:', error);
    return [];
  }
}

async function scrapeNebraskaFootballNews(): Promise<NewsItem[]> {
  try {
    const response = await fetch('https://huskers.com/sports/football/news', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    
    const html = await response.text();
    const articles: NewsItem[] = [];
    
    // Enhanced regex to capture article cards with images
    const articleRegex = /<div[^>]*class="[^"]*article-card[^"]*"[^>]*>.*?(?:<img[^>]*src="([^"]*)"[^>]*>.*?)?<h3[^>]*>.*?<a[^>]*href="([^"]*)"[^>]*>([^<]+)<\/a>.*?<\/h3>.*?(?:<p[^>]*>([^<]+)<\/p>.*?)?(?:<time[^>]*datetime="([^"]*)"[^>]*>.*?<\/time>.*?)?<\/div>/gis;
    
    let match;
    while ((match = articleRegex.exec(html)) && articles.length < 10) {
      const [, imageUrl, link, title, description, datetime] = match;
      
      if (title && link) {
        // Clean and process the extracted data
        const cleanTitle = title.trim().replace(/\s+/g, ' ');
        const cleanDescription = description ? description.trim().replace(/\s+/g, ' ') : `Latest Nebraska Football news: ${cleanTitle}`;
        const fullLink = link.startsWith('http') ? link : `https://huskers.com${link}`;
        const fullImageUrl = imageUrl && imageUrl.startsWith('http') ? imageUrl : 
                             imageUrl ? `https://huskers.com${imageUrl}` : undefined;
        
        articles.push({
          title: cleanTitle,
          summary: cleanDescription,
          description: cleanDescription,
          link: fullLink,
          source: 'Nebraska Athletics',
          publishedAt: datetime || undefined,
          category: 'official',
          thumbnail: fullImageUrl
        });
      }
    }
    
    // Try a simpler HTML structure if the article card pattern fails.
    if (articles.length === 0) {
      const simpleRegex = /<h[2-4][^>]*>.*?<a[^>]*href="([^"]*)"[^>]*>([^<]+)<\/a>.*?<\/h[2-4]>/gis;
      let simpleMatch;
      
      while ((simpleMatch = simpleRegex.exec(html)) && articles.length < 8) {
        const [, link, title] = simpleMatch;
        
        if (title && link && (title.toLowerCase().includes('football') || title.toLowerCase().includes('cornhuskers'))) {
          const fullLink = link.startsWith('http') ? link : `https://huskers.com${link}`;
          
          articles.push({
            title: title.trim(),
            summary: `Nebraska Cornhuskers Football: ${title.trim()}`,
            description: `Latest update from Nebraska Athletics about ${title.toLowerCase()}`,
            link: fullLink,
            source: 'Nebraska Athletics',
            publishedAt: undefined,
            category: 'official',
            thumbnail: 'https://huskers.com/images/logos/site/site.png'
          });
        }
      }
    }
    
    return articles;
  } catch (error) {
    console.error('Nebraska Athletics scrape error:', error);
    return [];
  }
}
