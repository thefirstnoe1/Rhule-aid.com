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
| `DATABASE_ID` | Cloudflare D1 Database ID | `dbed4dc5-b282-40b0-a196-d90ea7cc74e0` |
| `SCHEDULE_CACHE_ID` | KV Namespace ID for schedule caching | `b6ba8e644c1447699ef2dfbd88e0527e` |
| `ROSTER_CACHE_ID` | KV Namespace ID for roster caching | `2d472c3e9eee4576952c9496876a8e5f` |
| `NEWS_CACHE_ID` | KV Namespace ID for news caching | `44fa2bcea61241cf8af0cd346d53505d` |
| `WEATHER_CACHE_ID` | KV Namespace ID for weather caching | `cc8345020c464041b7ce0af0ad277dba` |

### Local Development Setup:

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Fill in your actual Cloudflare resource IDs in the `.env` file

3. The `.env` file is already included in `.gitignore` to prevent accidental commits

### How to Find Your IDs:

- **D1 Database ID**: Run `wrangler d1 list` or check your Cloudflare dashboard
- **KV Namespace IDs**: Run `wrangler kv:namespace list` or check your Cloudflare dashboard

### CI/CD Integration:

The `wrangler.toml` file now uses environment variable substitution with the `$VARIABLE_NAME` syntax, which works with both:
- Local `.env` files for development
- GitHub repository secrets for automated deployments
- Cloudflare Pages environment variables

This approach keeps sensitive resource IDs out of your source code while maintaining compatibility with Cloudflare's deployment systems.
