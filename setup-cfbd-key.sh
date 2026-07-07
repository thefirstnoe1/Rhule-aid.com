#!/bin/bash

# Setup script for CFBD API Key
# This script helps you set the CFBD API key as a Cloudflare secret

echo "🏈 Setting up College Football Data API Key for Rhule-aid.com"
echo ""

# Check if wrangler is installed
if ! command -v wrangler &> /dev/null; then
    echo "❌ Wrangler CLI not found. Please install it first:"
    echo "npm install -g wrangler"
    exit 1
fi

echo "📋 To get your CFBD API key:"
echo "1. Go to https://collegefootballdata.com/"
echo "2. Sign up for a free account"
echo "3. Get your API key from the dashboard"
echo ""

read -p "Enter your CFBD API key: " CFBD_API_KEY

if [ -z "$CFBD_API_KEY" ]; then
    echo "❌ No API key provided. Exiting..."
    exit 1
fi

echo ""
echo "🔐 Setting CFBD API key as Cloudflare secret..."

# Set the secret using wrangler
wrangler secret put CFBD_API_KEY --value "$CFBD_API_KEY"

if [ $? -eq 0 ]; then
    echo "✅ CFBD API key set successfully!"
    echo ""
    echo "🚀 Next steps:"
    echo "1. Deploy your worker: npm run deploy"
    echo "2. The cron job will run every Monday at 1 AM to update rankings"
    echo "3. You can manually trigger it by visiting: https://rhule-aid.com/api/update/rankings"
else
    echo "❌ Failed to set CFBD API key. Please check your wrangler authentication."
    exit 1
fi