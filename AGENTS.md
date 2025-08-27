# AGENTS.md - Development Guidelines

## Build/Test Commands
- `npm run build` - TypeScript compilation
- `npm run dev` - Start Wrangler dev server  
- `npm run deploy` - Deploy to Cloudflare Workers
- `npm test` - No tests configured (exits 0)
- No lint command available

## Code Style Guidelines

### TypeScript Configuration
- Target: ES2022, strict mode enabled
- Use `noUncheckedIndexedAccess: true`
- Generate declaration files with source maps

### Imports & Structure
- Use ES6 imports: `import { func } from './module'`
- Group imports: external deps first, then local modules
- Organize by API routes in `src/api/` directory

### Naming Conventions
- Interfaces: PascalCase with descriptive names (e.g., `ScheduleGame`, `ScheduleResponse`)
- Functions: camelCase with clear action verbs (e.g., `handleScheduleRequest`)
- Constants: UPPER_SNAKE_CASE (e.g., `CACHE_KEY`, `CACHE_TTL`)
- Files: kebab-case for routes, camelCase for utilities

### Error Handling
- Always wrap API handlers in try-catch blocks
- Return structured JSON responses with error details
- Use console.error for logging errors
- Provide fallback data when possible
- Use appropriate HTTP status codes (404, 500, etc.)