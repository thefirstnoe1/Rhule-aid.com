// Cloudflare Pages Function to fetch and parse RSS news feed
export async function onRequest(context) {
    const { request, env } = context;
    
    const CACHE_KEY = 'nebraska_news_rss_v2'; // Changed to force cache refresh
    const CACHE_TTL = 60 * 60 * 2; // 2 hours in seconds
    
    try {
        // Try to get cached data first
        let cachedData = null;
        if (env.NEWS_CACHE) {
            try {
                const cached = await env.NEWS_CACHE.get(CACHE_KEY);
                if (cached) {
                    cachedData = JSON.parse(cached);
                    console.log('Found cached news data');
                }
            } catch (error) {
                console.log('Cache read error:', error);
            }
        }
        
        // If we have cached data and it's not too old, return it
        if (cachedData && cachedData.timestamp && (Date.now() - cachedData.timestamp) < (CACHE_TTL * 1000)) {
            return new Response(JSON.stringify({
                success: true,
                data: cachedData.data,
                cached: true,
                lastUpdated: new Date(cachedData.timestamp).toISOString(),
                source: 'cache',
                count: cachedData.data.length
            }), {
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'GET',
                    'Access-Control-Allow-Headers': 'Content-Type',
                    'Cache-Control': 'public, max-age=3600'
                }
            });
        }

        console.log('Fetching fresh news data from huskers.com RSS...');
        
        const rssResponse = await fetch('https://huskers.com/sports/football/rss', {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        
        if (!rssResponse.ok) {
            throw new Error(`HTTP error! status: ${rssResponse.status}`);
        }
        
        const rssText = await rssResponse.text();
        console.log('RSS response length:', rssText.length);
        console.log('RSS sample (first 500 chars):', rssText.substring(0, 500));
        
        // Parse RSS XML
        const articles = parseRSSFeed(rssText);
        
        if (articles.length === 0) {
            throw new Error('No articles found in RSS feed');
        }
        
        console.log(`Parsed ${articles.length} articles from RSS feed`);

        // Cache the fresh data
        if (env.NEWS_CACHE && articles.length > 0) {
            try {
                await env.NEWS_CACHE.put(CACHE_KEY, JSON.stringify({
                    data: articles,
                    timestamp: Date.now()
                }), { expirationTtl: CACHE_TTL });
                console.log(`Cached ${articles.length} articles to NEWS_CACHE`);
            } catch (error) {
                console.log('Cache write error:', error);
            }
        }

        return new Response(JSON.stringify({
            success: true,
            data: articles,
            cached: false,
            lastUpdated: new Date().toISOString(),
            count: articles.length,
            source: 'rss_feed_fresh'
        }), {
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Cache-Control': 'public, max-age=3600'
            }
        });
        
    } catch (error) {
        console.error('Error fetching news data:', error);
        
        // Try to return stale cached data if available
        if (cachedData && cachedData.data) {
            console.log('Returning stale cached data due to error');
            return new Response(JSON.stringify({
                success: true,
                data: cachedData.data,
                cached: true,
                stale: true,
                lastUpdated: new Date(cachedData.timestamp).toISOString(),
                source: 'stale-cache'
            }), {
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'GET',
                    'Access-Control-Allow-Headers': 'Content-Type',
                    'Cache-Control': 'public, max-age=300'
                }
            });
        }

        return new Response(JSON.stringify({
            success: false,
            error: error.message,
            data: []
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

function parseRSSFeed(rssText) {
    const articles = [];
    
    try {
        // Extract items using regex since we can't use DOMParser in Workers
        const itemPattern = /<item>([\s\S]*?)<\/item>/gi;
        let match;
        
        while ((match = itemPattern.exec(rssText)) !== null) {
            const itemContent = match[1];
            
            // Extract individual fields
            const title = extractTag(itemContent, 'title');
            const link = extractTag(itemContent, 'link') || extractTag(itemContent, 'guid');
            const description = extractTag(itemContent, 'description');
            const pubDate = extractTag(itemContent, 'pubDate');
            const category = extractTag(itemContent, 'category');
            
            // Extract thumbnail/image - check multiple possible tags
            const thumbnail = extractImage(itemContent);
            
            // Debug: Log what we're extracting
            console.log('Parsing article:', {
                title: title ? title.substring(0, 50) + '...' : 'NO TITLE',
                link: link || 'NO LINK',
                linkLength: link ? link.length : 0,
                thumbnail: thumbnail || 'NO THUMBNAIL',
                hasDescription: !!description
            });
            
            if (title && link && link !== 'undefined' && link.startsWith('http')) {
                articles.push({
                    title: cleanHtml(title),
                    link: link, // Don't trim excessively
                    description: description ? cleanHtml(description).substring(0, 300) + '...' : '',
                    pubDate: pubDate ? new Date(pubDate).toISOString() : null,
                    category: category ? cleanHtml(category) : 'Football',
                    publishedFormatted: pubDate ? formatDate(new Date(pubDate)) : '',
                    thumbnail: thumbnail
                });
            } else {
                console.log('Skipping article due to missing/invalid link:', { title, link });
            }
        }
        
        // Sort by publication date (newest first)
        articles.sort((a, b) => {
            if (!a.pubDate || !b.pubDate) return 0;
            return new Date(b.pubDate) - new Date(a.pubDate);
        });
        
    } catch (error) {
        console.error('Error parsing RSS feed:', error);
    }
    
    return articles;
}

function extractTag(content, tagName) {
    // Try standard tag format first
    let pattern = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, 'i');
    let match = content.match(pattern);
    
    if (match && match[1] && match[1].trim()) {
        let result = match[1].trim();
        // Special handling for links - just remove whitespace, don't truncate
        if (tagName === 'link' || tagName === 'guid') {
            return result.replace(/\s+/g, '').replace(/\n/g, '');
        }
        return result;
    }
    
    // Try self-closing tag format for link
    if (tagName === 'link') {
        pattern = new RegExp(`<${tagName}[^>]*href=['"](.*?)['"][^>]*\/?>`, 'i');
        match = content.match(pattern);
        if (match && match[1]) {
            return match[1].trim();
        }
    }
    
    // Try CDATA format
    pattern = new RegExp(`<${tagName}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tagName}>`, 'i');
    match = content.match(pattern);
    if (match && match[1]) {
        let result = match[1].trim();
        // Special handling for links in CDATA too
        if (tagName === 'link' || tagName === 'guid') {
            return result.replace(/\s+/g, '').replace(/\n/g, '');
        }
        return result;
    }
    
    return null;
}

// Helper function to extract image/thumbnail from RSS item
function extractImage(content) {
    // Try different image tags commonly used in RSS feeds
    const imagePatterns = [
        /<enclosure[^>]+url="([^"]+)"[^>]*type="image/i,  // Enclosure with image type
        /<media:thumbnail[^>]+url="([^"]+)"/i,           // Media RSS thumbnail
        /<media:content[^>]+url="([^"]+)"[^>]*type="image/i,  // Media content
        /<image[^>]*>[\s\S]*?<url>([^<]+)<\/url>/i,      // RSS image tag
        /<img[^>]+src="([^"]+)"/i,                       // HTML img in description
        /<thumbnail>([^<]+)<\/thumbnail>/i               // Simple thumbnail tag
    ];
    
    for (const pattern of imagePatterns) {
        const match = content.match(pattern);
        if (match && match[1]) {
            return match[1].trim();
        }
    }
    return null;
}

function cleanHtml(text) {
    if (!text) return '';
    
    return text
        .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1') // Remove CDATA
        .replace(/<[^>]*>/g, '') // Remove HTML tags
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&nbsp;/g, ' ')
        .trim();
}

function formatDate(date) {
    const options = { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        timeZone: 'America/Chicago'
    };
    return date.toLocaleDateString('en-US', options);
}
