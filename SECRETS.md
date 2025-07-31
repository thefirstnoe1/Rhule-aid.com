# Repository Secrets Setup

## Required GitHub Repository Secrets

For this project to deploy correctly, you need to set up the following repository secrets in your GitHub repository settings:

### Navigation Path:
1. Go to your repository on GitHub
2. Click **Settings** tab
3. Click **Secrets and variables** > **Actions** in the left sidebar
4. Click **New repository secret** for each secret below

### Required Secrets:

| Secret Name | Description | Example Value |
|-------------|-------------|---------------|
| `CLOUDFLARE_API_TOKEN` | Cloudflare API Token with Pages:Edit permissions | `your-cloudflare-api-token` |
| `CLOUDFLARE_ACCOUNT_ID` | Your Cloudflare Account ID | `your-account-id` |
| `DATABASE_ID` | Cloudflare D1 Database ID | `dbed4dc5-b282-40b0-a196-d90ea7cc74e0` |
| `SCHEDULE_CACHE_ID` | KV Namespace ID for schedule caching | `b6ba8e644c1447699ef2dfbd88e0527e` |
| `ROSTER_CACHE_ID` | KV Namespace ID for roster caching | `2d472c3e9eee4576952c9496876a8e5f` |
| `NEWS_CACHE_ID` | KV Namespace ID for news caching | `44fa2bcea61241cf8af0cd346d53505d` |
| `WEATHER_CACHE_ID` | KV Namespace ID for weather caching | `cc8345020c464041b7ce0af0ad277dba` |
| `OPENWEATHER_API_KEY` | OpenWeatherMap API key for fallback weather data | `your-openweathermap-api-key` |

### Local Development Setup:

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Fill in your actual Cloudflare resource IDs in the `.env` file

3. The `.env` file is already included in `.gitignore` to prevent accidental commits

### How to Find Your IDs:

**Cloudflare API Credentials:**
- **API Token**: Go to [Cloudflare API Tokens](https://dash.cloudflare.com/profile/api-tokens) → Create Token → Custom Token with these permissions:
  - `Account:Cloudflare Pages:Edit`
  - `Zone:Zone:Read` (if using custom domains)
- **Account ID**: Found in the right sidebar of any Cloudflare dashboard page

**Resource IDs:**
- **D1 Database ID**: Run `wrangler d1 list` or check your Cloudflare dashboard
- **KV Namespace IDs**: Run `wrangler kv:namespace list` or check your Cloudflare dashboard

**OpenWeatherMap API:**
- **API Key**: Sign up at [OpenWeatherMap](https://openweathermap.org/api) → Get free API key
  - Used as fallback when National Weather Service API fails
  - Free tier includes 1,000 API calls per day (sufficient for caching setup)

### CI/CD Integration:

The `wrangler.toml` file now uses environment variable substitution with the `$VARIABLE_NAME` syntax, which works with both:
- Local `.env` files for development
- GitHub repository secrets for automated deployments
- Cloudflare Pages environment variables

This approach keeps sensitive resource IDs out of your source code while maintaining compatibility with Cloudflare's deployment systems.
