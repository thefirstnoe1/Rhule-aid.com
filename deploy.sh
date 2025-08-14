#!/bin/bash

# Deployment script for Cloudflare Workers migration
# This script handles environment variable substitution and deployment

set -e

echo "🚀 Starting Cloudflare Workers deployment..."

# Step 1: Build functions
echo "📦 Building Pages Functions..."
npm run build:functions

# Step 2: Create a temporary wrangler.jsonc with substituted values
echo "🔧 Preparing configuration with environment variables..."

# Check if we have the required environment variables
if [ -z "$DATABASE_ID" ] || [ -z "$SCHEDULE_CACHE_ID" ] || [ -z "$ROSTER_CACHE_ID" ] || [ -z "$NEWS_CACHE_ID" ] || [ -z "$WEATHER_CACHE_ID" ] || [ -z "$OPENWEATHER_API_KEY" ]; then
    echo "❌ Error: Missing required environment variables!"
    echo "Please set the following environment variables:"
    echo "  - DATABASE_ID"
    echo "  - SCHEDULE_CACHE_ID" 
    echo "  - ROSTER_CACHE_ID"
    echo "  - NEWS_CACHE_ID"
    echo "  - WEATHER_CACHE_ID"
    echo "  - OPENWEATHER_API_KEY"
    echo ""
    echo "Example:"
    echo "  export DATABASE_ID=\"your-database-id\""
    echo "  export SCHEDULE_CACHE_ID=\"your-kv-namespace-id\""
    echo "  # ... set other variables"
    echo "  ./deploy.sh"
    exit 1
fi

# Create temporary config file with substituted values
cp wrangler.jsonc wrangler.tmp.jsonc

# Substitute environment variables
sed -i "s/\$DATABASE_ID/$DATABASE_ID/g" wrangler.tmp.jsonc
sed -i "s/\$SCHEDULE_CACHE_ID/$SCHEDULE_CACHE_ID/g" wrangler.tmp.jsonc
sed -i "s/\$ROSTER_CACHE_ID/$ROSTER_CACHE_ID/g" wrangler.tmp.jsonc
sed -i "s/\$NEWS_CACHE_ID/$NEWS_CACHE_ID/g" wrangler.tmp.jsonc
sed -i "s/\$WEATHER_CACHE_ID/$WEATHER_CACHE_ID/g" wrangler.tmp.jsonc
sed -i "s/\$OPENWEATHER_API_KEY/$OPENWEATHER_API_KEY/g" wrangler.tmp.jsonc

# Step 3: Deploy using the temporary config
echo "🚀 Deploying to Cloudflare Workers..."
npx wrangler@latest deploy --config wrangler.tmp.jsonc

# Step 4: Clean up temporary file
rm wrangler.tmp.jsonc

echo "✅ Deployment completed successfully!"
echo "🌐 Your Worker should now be available at: https://rhule-aid.your-subdomain.workers.dev"