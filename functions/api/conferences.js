export async function onRequest(context) {
    const { request, env } = context;
    const url = new URL(request.url);
    
    // Handle different HTTP methods
    if (request.method === 'GET') {
        return handleGet(url, env);
    } else if (request.method === 'POST') {
        return handlePost(request, env);
    } else {
        return new Response('Method not allowed', { status: 405 });
    }
}

async function handleGet(url, env) {
    const team = url.searchParams.get('team');
    
    if (team) {
        // Get specific team's conference
        try {
            const result = await env.DB.prepare(
                'SELECT conference FROM teams WHERE name = ?'
            ).bind(team).first();
            
            if (result) {
                return Response.json({ 
                    team: team, 
                    conference: result.conference 
                });
            } else {
                return Response.json({ 
                    team: team, 
                    conference: 'Non-Conference' 
                });
            }
        } catch (error) {
            console.error('Database error:', error);
            return Response.json({ 
                team: team, 
                conference: 'Non-Conference' 
            });
        }
    } else {
        // Get all teams and conferences
        try {
            const results = await env.DB.prepare(
                'SELECT name, conference FROM teams ORDER BY conference, name'
            ).all();
            
            return Response.json({ 
                teams: results.results || []
            });
        } catch (error) {
            console.error('Database error:', error);
            return Response.json({ teams: [] });
        }
    }
}

async function handlePost(request, env) {
    try {
        const { teams } = await request.json();
        
        if (!teams || !Array.isArray(teams)) {
            return new Response('Invalid data format', { status: 400 });
        }
        
        // Clear existing data and insert new teams
        await env.DB.prepare('DELETE FROM teams').run();
        
        // Insert teams in batches
        const batchSize = 100;
        for (let i = 0; i < teams.length; i += batchSize) {
            const batch = teams.slice(i, i + batchSize);
            const stmt = env.DB.prepare('INSERT INTO teams (name, conference) VALUES (?, ?)');
            
            const queries = batch.map(team => stmt.bind(team.name, team.conference));
            await env.DB.batch(queries);
        }
        
        return Response.json({ 
            message: `Successfully inserted ${teams.length} teams` 
        });
    } catch (error) {
        console.error('Error inserting teams:', error);
        return new Response('Server error', { status: 500 });
    }
}
