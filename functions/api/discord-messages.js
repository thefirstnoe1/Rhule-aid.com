export async function onRequest(context) {
  // CORS headers for browser requests
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  // Handle preflight requests
  if (context.request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Discord API configuration - these need to be set as environment variables
    const DISCORD_BOT_TOKEN = context.env.DISCORD_BOT_TOKEN;
    const DISCORD_CHANNEL_ID = context.env.DISCORD_CHANNEL_ID;
    const DISCORD_USER_ID = context.env.DISCORD_USER_ID; // Optional: filter by specific user
    
    if (!DISCORD_BOT_TOKEN || !DISCORD_CHANNEL_ID) {
      return new Response(JSON.stringify({
        error: 'Discord configuration missing. Please set DISCORD_BOT_TOKEN and DISCORD_CHANNEL_ID environment variables.'
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Fetch messages from Discord API
    const discordUrl = `https://discord.com/api/v10/channels/${DISCORD_CHANNEL_ID}/messages?limit=20`;
    
    const discordResponse = await fetch(discordUrl, {
      headers: {
        'Authorization': `Bot ${DISCORD_BOT_TOKEN}`,
        'Content-Type': 'application/json',
      },
    });

    if (!discordResponse.ok) {
      throw new Error(`Discord API error: ${discordResponse.status}`);
    }

    const discordMessages = await discordResponse.json();
    
    // Filter and format messages
    let filteredMessages = discordMessages;
    
    // Filter by specific user if USER_ID is provided
    if (DISCORD_USER_ID) {
      filteredMessages = discordMessages.filter(msg => msg.author.id === DISCORD_USER_ID);
    }
    
    // Format messages for our frontend
    const formattedMessages = filteredMessages
      .filter(msg => msg.content && msg.content.trim().length > 0) // Only messages with content
      .slice(0, 10) // Limit to 10 most recent messages
      .map(msg => ({
        id: msg.id,
        author: msg.author.username,
        content: msg.content,
        timestamp: msg.timestamp,
        createdAt: new Date(msg.timestamp).toISOString()
      }));

    return new Response(JSON.stringify({
      messages: formattedMessages,
      count: formattedMessages.length,
      lastUpdated: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Discord API Error:', error);
    
    return new Response(JSON.stringify({
      error: 'Failed to fetch Discord messages',
      details: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}
