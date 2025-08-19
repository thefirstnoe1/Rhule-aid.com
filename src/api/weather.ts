// Weather API for Cloudflare Worker
export async function handleWeatherRequest(request: Request, env: any): Promise<Response> {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  return new Response(JSON.stringify({
    success: true,
    data: {},
    message: 'Weather data coming soon'
  }), { headers: corsHeaders });
}