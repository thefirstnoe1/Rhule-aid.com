# Cloudflare Workers Deployment Guide

This project has been migrated from Cloudflare Pages to Cloudflare Workers for enhanced capabilities and better performance.

## Getting Your Cloudflare Resource IDs

Before deploying, you need to get the actual IDs for your Cloudflare resources. Here's how:

## 1. Get KV Namespace IDs

```bash
wrangler kv:namespace list
```

This will show all your KV namespaces with their IDs. Look for:
- Schedule cache namespace
- Roster cache namespace  
- News cache namespace
- Weather cache namespace

## 2. Get D1 Database ID

```bash
wrangler d1 list
```

This will show your D1 databases with their IDs. Look for "rhule-aid-db".

## 3. Set Environment Variables

### On Linux/Mac:
```bash
export DATABASE_ID="your-d1-database-id"
export SCHEDULE_CACHE_ID="your-schedule-kv-id"
export ROSTER_CACHE_ID="your-roster-kv-id"
export NEWS_CACHE_ID="your-news-kv-id"
export WEATHER_CACHE_ID="your-weather-kv-id"
export OPENWEATHER_API_KEY="your-openweather-api-key"
```

### On Windows:
```cmd
set DATABASE_ID=your-d1-database-id
set SCHEDULE_CACHE_ID=your-schedule-kv-id
set ROSTER_CACHE_ID=your-roster-kv-id
set NEWS_CACHE_ID=your-news-kv-id
set WEATHER_CACHE_ID=your-weather-kv-id
set OPENWEATHER_API_KEY=your-openweather-api-key
```

## 4. Deploy to Cloudflare Workers

### On Linux/Mac:
```bash
./deploy.sh
```

### On Windows:
```cmd
deploy.bat
```

Or using npm:
```bash
npm run deploy           # Linux/Mac
npm run deploy:windows   # Windows
```

## 5. Alternative: Manual Deployment

If the scripts don't work, you can manually edit `wrangler.jsonc` to replace the `$VARIABLE_NAME` placeholders with actual values, then run:

```bash
npm run build:functions
wrangler deploy
```

## Migration from Pages to Workers

This project was successfully migrated from Cloudflare Pages to Workers. The migration included:

- Converting Pages Functions to a single Worker script
- Updating configuration from `wrangler.toml` to `wrangler.jsonc`
- Adding custom domain routing and observability
- Maintaining all existing functionality (API endpoints, static assets, database bindings)

The Workers deployment provides better performance, enhanced capabilities, and improved observability.