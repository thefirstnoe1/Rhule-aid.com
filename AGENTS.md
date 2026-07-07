# AGENTS.md - AI Coding Guidelines

## Build/Test Commands
- `npm run build` - Build TypeScript and React components
- `npm run build:worker` - Build TypeScript only (`tsc`)
- `npm run build:react` - Build React components only
- `npm run dev` - Start Wrangler development server
- `npm test` - No tests configured (exits 0)
- Single test: Not applicable (no test framework)

## Code Style Guidelines
- **Types**: Use TypeScript with strict mode, define interfaces for all API responses
- **Imports**: ES modules only (`type: "module"` in package.json)
- **Naming**: camelCase for variables/functions, PascalCase for interfaces/types
- **Error Handling**: Always try/catch async operations, provide fallback data
- **Comments**: Minimal comments, prefer self-documenting code
- **API Responses**: Include CORS headers, use consistent response interfaces
- **Caching**: Implement TTL-based caching with KV storage for external APIs
- **Formatting**: 2-space indentation, semicolons required
- **Async**: Use async/await over Promises, handle errors gracefully
- **Environment**: Use env bindings for Cloudflare resources (KV, D1)

This codebase uses vanilla JS/TS with Cloudflare Workers/Pages - no frameworks except React for specific components.