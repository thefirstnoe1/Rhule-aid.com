# CLAUDE.md

This file provides guidance to AI assistants when working with code in this repository.

## Project Overview

This is a Nebraska Cornhuskers football fan website built with Cloudflare Pages and Functions. It's a static site with serverless API endpoints that provides schedule, roster, news, and weather data for the 2025 football season.

## Development Commands

### Local Development
```bash
npm run dev                    # Start Wrangler development server
# Alternative: npx wrangler pages dev public --compatibility-date=2024-01-01
```

### Build & Deploy
```bash
npm run build                  # TypeScript type checking
npm run deploy                 # Deploy to Cloudflare Pages
```

### Data Scripts
```bash
npm run schedule               # Test schedule data fetching
npm run roster                 # Test roster data fetching
```

### Testing
```bash
npm test                       # Currently returns exit 0, no tests configured
```

## Architecture

### Project Structure
- **`public/`** - Static assets served by Cloudflare Pages (HTML, CSS, JS, images)
- **`functions/api/`** - Cloudflare Pages Functions (serverless API endpoints)
- **`src/migrations/`** - Database schema migrations for Cloudflare D1
- **`package.json`** - Dependencies and scripts
- **`wrangler.toml`** - Cloudflare configuration with bindings

### Key Technologies
- **Frontend**: Vanilla HTML/CSS/JavaScript (no framework)
- **Backend**: Cloudflare Pages Functions (JavaScript/TypeScript)
- **Database**: Cloudflare D1 (SQLite)
- **Caching**: Cloudflare KV Storage
- **Deployment**: Cloudflare Pages with GitHub Actions

### Data Flow
1. API endpoints (`functions/api/`) fetch data from external sources (FBSchedules.com, roster data)
2. Data is cached in Cloudflare KV namespaces with TTL
3. Frontend JavaScript fetches from API endpoints
4. Fallback data is embedded in client-side code for resilience

### API Endpoints
- **`/api/schedule`** - Football schedule data (cached 24 hours, auto-refreshes from FBSchedules.com)
- **`/api/roster`** - Team roster data
- **`/api/news`** - Latest news feed
- **`/api/weather`** - Weather data (NWS API primary, OpenWeatherMap fallback)
- **`/api/conferences`** - Conference information from D1 database
- **`/api/logo`** - Team logo service
- **`/api/discord-messages`** - Discord integration

### Weather System Architecture
The weather API (`functions/api/weather.ts`) implements a sophisticated caching and fallback system:
- **Primary**: National Weather Service API (free, no API key required)
- **Fallback**: OpenWeatherMap API (requires `OPENWEATHER_API_KEY`)
- **Caching**: Separate cache keys for current conditions (5 min) and forecast (12 hours)
- **Game Day Integration**: Marks forecast days with games

### Environment Variables
Required for deployment (stored in GitHub Secrets and Cloudflare Pages):
```bash
DATABASE_ID=              # Cloudflare D1 database ID
SCHEDULE_CACHE_ID=         # KV namespace for schedule caching
ROSTER_CACHE_ID=           # KV namespace for roster caching  
NEWS_CACHE_ID=             # KV namespace for news caching
WEATHER_CACHE_ID=          # KV namespace for weather caching
OPENWEATHER_API_KEY=       # OpenWeatherMap API key (fallback)
```

### Database Schema
Single table `teams` with conference information:
- `id`, `name`, `conference`, `created_at`, `updated_at`
- Includes all major college football conferences (Big Ten, SEC, ACC, Big 12, etc.)

### Caching Strategy
- **Schedule**: 24 hours TTL (daily refresh from FBSchedules.com)
- **Weather Current**: 5 minutes TTL  
- **Weather Forecast**: 12 hours TTL
- **News**: Varies by endpoint
- **Roster**: Varies by endpoint

### Schedule System Architecture
The schedule API (`functions/api/schedule.js`) implements a robust data fetching system:
- **Primary**: Live scraping from FBSchedules.com (respects robots, uses proper user agent)
- **Fallback**: Hardcoded schedule data for resilience
- **Caching**: 24-hour cache to minimize requests to FBSchedules.com
- **Features**: 
  - Automatic parsing of game dates, times, opponents, and TV networks
  - Stadium mapping for away games
  - Neutral site game detection (e.g., Cincinnati at Arrowhead Stadium)
  - Team name normalization (e.g., "Michigan" → "Michigan Wolverines")

### Frontend Features
- **Responsive Design**: Mobile-first with breakpoints at 768px, 1024px, 1200px
- **Dark Mode**: System preference detection with manual toggle
- **Mobile Menu**: Touch-friendly navigation
- **Game Day Countdown**: Live countdown functionality
- **Weather Integration**: Real-time weather for Lincoln, NE
- **Schedule Filtering**: Home/away and conference filters

## Development Guidelines

### When working with APIs:
- Always implement caching with appropriate TTL
- Include CORS headers for cross-origin requests
- Provide fallback data for resilience
- Log errors appropriately for debugging

### When modifying frontend:
- Follow existing vanilla JS patterns (no frameworks)
- Maintain mobile-responsive design
- Test dark mode compatibility
- Use semantic HTML structure

### When updating data:
- Static schedule data is in `functions/api/schedule.js`
- Conference data is in `src/migrations/001_create_teams_table.sql`
- Fallback data is embedded in `public/js/script.js`

### Security Notes:
- Never commit API keys or sensitive IDs to version control
- Use environment variable substitution in `wrangler.toml`
- All sensitive data should be in GitHub Secrets or Cloudflare environment variables