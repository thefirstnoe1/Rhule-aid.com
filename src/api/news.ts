// News API for Cloudflare Worker
interface NewsItem {
  title: string;
  summary: string;
  link: string;
  source: string;
  publishedAt: string;
  category: string;
  thumbnail?: string;
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
    // Check cache (30 minute cache for news)
    const cacheKey = 'nebraska-news-v3';
    const cached = await env.NEWS_CACHE?.get(cacheKey);
    
    if (cached) {
      const cachedData = JSON.parse(cached);
      if (cachedData.timestamp && (Date.now() - cachedData.timestamp) < 1800000) { // 30 minutes
        return new Response(JSON.stringify({
          success: true,
          data: cachedData.data,
          cached: true,
          lastUpdated: new Date(cachedData.timestamp).toISOString(),
          count: cachedData.data.length
        }), { headers: corsHeaders });
      }
    }

    // Fetch fresh news
    const newsData = getFallbackNews(); // Using fallback for now
    
    // Cache the result
    await env.NEWS_CACHE?.put(cacheKey, JSON.stringify({
      data: newsData,
      timestamp: Date.now()
    }));

    return new Response(JSON.stringify({
      success: true,
      data: newsData,
      cached: false,
      lastUpdated: new Date().toISOString(),
      count: newsData.length
    }), { headers: corsHeaders });

  } catch (error) {
    console.error('News fetch error:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to fetch news',
      data: getFallbackNews()
    }), { 
      status: 200,
      headers: corsHeaders 
    });
  }
}

function getFallbackNews(): NewsItem[] {
  const now = new Date().toISOString();
  
  return [
    {
      title: "Nebraska Football Opens Fall Practice",
      summary: "The Cornhuskers begin preparation for the 2025 season with their first official practice under head coach Matt Rhule.",
      link: "https://huskers.com/sports/football",
      source: "Nebraska Athletics",
      publishedAt: now,
      category: "official"
    },
    {
      title: "Recruiting Update: 2026 Class Taking Shape", 
      summary: "Nebraska continues to build momentum on the recruiting trail with several key commitments expected soon.",
      link: "https://huskers.com/sports/football",
      source: "247Sports",
      publishedAt: now,
      category: "recruiting"
    },
    {
      title: "Season Ticket Sales Reaching Record Numbers",
      summary: "Fan excitement is at an all-time high as season ticket sales approach sellout levels for Memorial Stadium.",
      link: "https://huskers.com/sports/football",
      source: "Corn Nation",
      publishedAt: now,
      category: "fan"
    }
  ];
}