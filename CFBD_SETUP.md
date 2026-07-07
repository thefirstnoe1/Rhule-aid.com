# CFBD API Setup

This project now uses the College Football Data API (CFBD) for accurate, reliable rankings data instead of web scraping.

## Setup Instructions

### 1. Get CFBD API Key
1. Go to [collegefootballdata.com](https://collegefootballdata.com/)
2. Sign up for a free account
3. Get your API key from the dashboard

### 2. Set API Key as Cloudflare Secret
Run the setup script:
```bash
./setup-cfbd-key.sh
```

Or manually using wrangler CLI:
```bash
wrangler secret put CFBD_API_KEY
# Enter your API key when prompted
```

### 3. Deploy
```bash
npm run build && npm run deploy
```

## Features

### Automatic Weekly Updates
- **Cron Schedule**: Every Monday at 1:00 AM UTC (`0 1 * * 1`)
- **Data Source**: CFBD API `/rankings` endpoint
- **Polls Supported**: AP Top 25, CFP Rankings
- **Cache Duration**: 1 week (rankings only change weekly)

### Manual Updates
You can manually trigger a rankings update:
```bash
curl https://rhule-aid.com/api/update/rankings
```

### API Endpoints
- `GET /api/rankings/ap` - AP Top 25 poll
- `GET /api/rankings/cfp` - College Football Playoff rankings
- `POST /api/update/rankings` - Manual update trigger

## Data Structure

### AP Poll Response
```json
{
  "success": true,
  "data": [
    {
      "rank": 1,
      "team": "Georgia",
      "points": 1500,
      "firstPlaceVotes": 50
    }
  ]
}
```

### CFP Rankings Response
```json
{
  "success": true,
  "data": [
    {
      "rank": 1,
      "team": "Georgia",
      "points": null
    }
  ]
}
```

## Benefits

1. **Reliable Data**: No more broken web scraping when NCAA.com changes
2. **Weekly Caching**: Efficient with 1-week cache duration
3. **Multiple Polls**: Both AP and CFP rankings from single source
4. **Automatic Updates**: Cron job keeps data fresh weekly
5. **Fast Response**: Cached data serves instantly to users

## Monitoring

Check the Cloudflare dashboard for:
- Cron trigger execution logs
- API call metrics
- Cache hit/miss ratios
- Error rates

The system will gracefully handle API failures and continue serving cached data.