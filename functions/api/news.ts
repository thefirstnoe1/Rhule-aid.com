// Cloudflare Pages Function: /functions/api/news.ts
// Aggregates Nebraska football news from multiple sources

interface NewsItem {
  title: string;
  summary: string;
  link: string;
  source: string;
  publishedAt: string;
  category: string;
  thumbnail?: string;  // Added optional thumbnail field
}

export const onRequestGet = async (context: any) => {
  const { request, env } = context;
  
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Check cache (30 minute cache for news)
    const cacheKey = 'nebraska-news-v3';  // Changed cache key again to force refresh
    const cached = await env.NEWS_CACHE?.get(cacheKey, 'json');
    
    if (cached && cached.timestamp && (Date.now() - cached.timestamp) < 1800000) { // 30 minutes
      return Response.json({
        success: true,
        data: cached.data,
        cached: true,
        lastUpdated: new Date(cached.timestamp).toISOString(),
        count: cached.data.length
      }, { headers: corsHeaders });
    }

    // Fetch fresh news
    const newsData = await fetchNewsFromSources();
    
    // Cache the result
    await env.NEWS_CACHE?.put(cacheKey, JSON.stringify({
      data: newsData,
      timestamp: Date.now()
    }));

    return Response.json({
      success: true,
      data: newsData,
      cached: false,
      lastUpdated: new Date().toISOString(),
      count: newsData.length
    }, { headers: corsHeaders });

  } catch (error) {
    console.error('News fetch error:', error);
    
    return Response.json({
      success: false,
      error: 'Failed to fetch news',
      message: error.message,
      data: getFallbackNews()
    }, { 
      status: 200, // Still return 200 with fallback data
      headers: corsHeaders 
    });
  }
};

async function fetchNewsFromSources(): Promise<NewsItem[]> {
  const allNews: NewsItem[] = [];
  
  // RSS feeds and news sources
  const sources = [
    {
      url: 'https://huskers.com/sports/football/rss',
      name: 'Nebraska Athletics',
      category: 'official'
    },
    {
      url: 'https://www.cornnation.com/rss/current',
      name: 'Corn Nation',
      category: 'fan'
    },
    {
      url: 'https://247sports.com/college/nebraska/rss/',
      name: '247Sports',
      category: 'recruiting'
    }
  ];

  for (const source of sources) {
    try {
      const response = await fetch(source.url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; Nebraska Football Site/1.0)',
          'Accept-Encoding': 'gzip, deflate, br',  // Accept compressed content
        },
      });

      if (!response.ok) continue;
      
      const xml = await response.text();
      const items = parseRSSFeed(xml, source);
      allNews.push(...items);
      
    } catch (error) {
      console.error(`Failed to fetch news from ${source.name}:`, error);
      continue;
    }
  }

  // Sort by publish date and limit to 20 most recent
  return allNews
    .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
    .slice(0, 20);
}

function parseRSSFeed(xml: string, source: any): NewsItem[] {
  const items: NewsItem[] = [];
  
  console.log(`Parsing RSS from ${source.name}, XML length: ${xml.length}`);
  
  // Enhanced XML parsing to handle different formats
  const itemMatches = xml.matchAll(/<item[^>]*>(.*?)<\/item>/gs);
  
  let itemCount = 0;
  for (const match of itemMatches) {
    itemCount++;
    const item = match[1];
    
    // More robust parsing for different RSS formats
    const titleMatch = item.match(/<title[^>]*>(?:<!\[CDATA\[(.*?)\]\]>|(.*?))<\/title>/s);
    const linkMatch = item.match(/<link[^>]*>(?:<!\[CDATA\[(.*?)\]\]>|(.*?))<\/link>/s);
    const descMatch = item.match(/<description[^>]*>(?:<!\[CDATA\[(.*?)\]\]>|(.*?))<\/description>/s);
    const pubDateMatch = item.match(/<pubDate[^>]*>(.*?)<\/pubDate>/);
    
    // Extract thumbnail from various RSS formats
    const thumbnail = extractThumbnail(item);
    
    console.log(`Item ${itemCount}: Title found: ${!!titleMatch}, Link found: ${!!linkMatch}, Thumbnail: ${thumbnail ? 'YES' : 'NO'}`);
    
    if (titleMatch && linkMatch) {
      const title = (titleMatch[1] || titleMatch[2] || '').trim();
      const link = (linkMatch[1] || linkMatch[2] || '').trim();
      const description = descMatch ? (descMatch[1] || descMatch[2] || '') : '';
      
      // Only add if we have a valid HTTP link
      if (title && link && link.startsWith('http')) {
        const newsItem: NewsItem = {
          title: title,
          summary: stripHtml(description).substring(0, 200) + '...',
          link: link,
          source: source.name,
          publishedAt: pubDateMatch ? new Date(pubDateMatch[1]).toISOString() : new Date().toISOString(),
          category: source.category
        };
        
        // Add thumbnail if found
        if (thumbnail) {
          newsItem.thumbnail = thumbnail;
        }
        
        items.push(newsItem);
      }
    }
  }
  
  console.log(`Parsed ${items.length} items from ${source.name}`);
  return items;
}

function extractThumbnail(itemContent: string): string | null {
  // Try different image/thumbnail patterns commonly used in RSS feeds
  const imagePatterns = [
    /<media:thumbnail[^>]+url="([^"]+)"/i,           // Media RSS thumbnail (most common for huskers.com)
    /<media:content[^>]+url="([^"]+)"[^>]*type="image/i,  // Media content with image type
    /<media:content[^>]+url="([^"]+)"/i,            // Media content (any type)
    /<enclosure[^>]+url="([^"]+)"[^>]*type="image/i,  // Enclosure with image type
    /<image[^>]*>[\s\S]*?<url>([^<]+)<\/url>/i,      // RSS image tag
    /<img[^>]+src="([^"]+)"/i,                       // HTML img in description
    /<thumbnail>([^<]+)<\/thumbnail>/i               // Simple thumbnail tag
  ];
  
  for (const pattern of imagePatterns) {
    const match = itemContent.match(pattern);
    if (match && match[1] && match[1].trim() && match[1] !== '') {
      const url = match[1].trim();
      // Only return valid HTTP URLs
      if (url.startsWith('http')) {
        console.log('Found thumbnail:', url.substring(0, 100) + '...');
        return url;
      }
    }
  }
  
  console.log('No thumbnail found in item');
  return null;
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').trim();
}

function getFallbackNews(): NewsItem[] {
  const now = new Date().toISOString();
  
  return [
    {
      title: "Nebraska Football Opens Fall Practice",
      summary: "The Cornhuskers begin preparation for the 2025 season with their first official practice under head coach Matt Rhule.",
      link: "https://huskers.com/sports/football",  // Changed from 'url' to 'link'
      source: "Nebraska Athletics",
      publishedAt: now,
      category: "official"
    },
    {
      title: "Recruiting Update: 2026 Class Taking Shape", 
      summary: "Nebraska continues to build momentum on the recruiting trail with several key commitments expected soon.",
      link: "https://huskers.com/sports/football",  // Changed from 'url' to 'link'
      source: "247Sports",
      publishedAt: now,
      category: "recruiting"
    },
    {
      title: "Season Ticket Sales Reaching Record Numbers",
      summary: "Fan excitement is at an all-time high as season ticket sales approach sellout levels for Memorial Stadium.",
      link: "https://huskers.com/sports/football",  // Changed from 'url' to 'link'
      source: "Corn Nation",
      publishedAt: now,
      category: "fan"
    }
  ];
}
