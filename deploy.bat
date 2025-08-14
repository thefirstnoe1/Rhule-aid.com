@echo off
REM Deployment script for Cloudflare Workers migration (Windows)
REM This script handles environment variable substitution and deployment

echo 🚀 Starting Cloudflare Workers deployment...

REM Step 1: Build functions
echo 📦 Building Pages Functions...
call npm run build:functions
if %errorlevel% neq 0 (
    echo ❌ Error: Failed to build functions
    exit /b %errorlevel%
)

REM Step 2: Check for required environment variables
if "%DATABASE_ID%"=="" (
    echo ❌ Error: DATABASE_ID environment variable is not set
    goto :usage
)
if "%SCHEDULE_CACHE_ID%"=="" (
    echo ❌ Error: SCHEDULE_CACHE_ID environment variable is not set
    goto :usage
)
if "%ROSTER_CACHE_ID%"=="" (
    echo ❌ Error: ROSTER_CACHE_ID environment variable is not set
    goto :usage
)
if "%NEWS_CACHE_ID%"=="" (
    echo ❌ Error: NEWS_CACHE_ID environment variable is not set
    goto :usage
)
if "%WEATHER_CACHE_ID%"=="" (
    echo ❌ Error: WEATHER_CACHE_ID environment variable is not set
    goto :usage
)
if "%OPENWEATHER_API_KEY%"=="" (
    echo ❌ Error: OPENWEATHER_API_KEY environment variable is not set
    goto :usage
)

REM Step 3: Create temporary config with substituted values
echo 🔧 Preparing configuration with environment variables...
copy wrangler.jsonc wrangler.tmp.jsonc >nul

REM Substitute environment variables using PowerShell
powershell -Command "(Get-Content wrangler.tmp.jsonc) -replace '\$DATABASE_ID', '%DATABASE_ID%' | Set-Content wrangler.tmp.jsonc"
powershell -Command "(Get-Content wrangler.tmp.jsonc) -replace '\$SCHEDULE_CACHE_ID', '%SCHEDULE_CACHE_ID%' | Set-Content wrangler.tmp.jsonc"
powershell -Command "(Get-Content wrangler.tmp.jsonc) -replace '\$ROSTER_CACHE_ID', '%ROSTER_CACHE_ID%' | Set-Content wrangler.tmp.jsonc"
powershell -Command "(Get-Content wrangler.tmp.jsonc) -replace '\$NEWS_CACHE_ID', '%NEWS_CACHE_ID%' | Set-Content wrangler.tmp.jsonc"
powershell -Command "(Get-Content wrangler.tmp.jsonc) -replace '\$WEATHER_CACHE_ID', '%WEATHER_CACHE_ID%' | Set-Content wrangler.tmp.jsonc"
powershell -Command "(Get-Content wrangler.tmp.jsonc) -replace '\$OPENWEATHER_API_KEY', '%OPENWEATHER_API_KEY%' | Set-Content wrangler.tmp.jsonc"

REM Step 4: Deploy using the temporary config
echo 🚀 Deploying to Cloudflare Workers...
call npx wrangler@latest deploy --config wrangler.tmp.jsonc
if %errorlevel% neq 0 (
    echo ❌ Error: Deployment failed
    del wrangler.tmp.jsonc >nul 2>&1
    exit /b %errorlevel%
)

REM Step 5: Clean up temporary file
del wrangler.tmp.jsonc >nul 2>&1

echo ✅ Deployment completed successfully!
echo 🌐 Your Worker should now be available at: https://rhule-aid.your-subdomain.workers.dev
goto :end

:usage
echo.
echo Please set the following environment variables:
echo   set DATABASE_ID=your-database-id
echo   set SCHEDULE_CACHE_ID=your-kv-namespace-id
echo   set ROSTER_CACHE_ID=your-kv-namespace-id
echo   set NEWS_CACHE_ID=your-kv-namespace-id
echo   set WEATHER_CACHE_ID=your-kv-namespace-id
echo   set OPENWEATHER_API_KEY=your-openweather-key
echo.
echo Then run: deploy.bat
exit /b 1

:end