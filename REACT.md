# React Integration

This project uses a hybrid approach where most pages use vanilla JavaScript but specific complex features use React for better state management and component organization.

## Architecture

- **Base Site**: Vanilla HTML/CSS/JavaScript served by Cloudflare Pages
- **React Components**: Complex interactive features built with React
- **Build Process**: TypeScript + esbuild for React component compilation

## React Pages

### CFB Schedule (React Version)
- **Location**: `/cfb-schedule-react.html`
- **Component**: `src/react/cfb-schedule.tsx`
- **Features**: Advanced filtering, real-time updates, sophisticated state management

## Development Workflow

### Building React Components

```bash
# Development build (with sourcemaps)
npm run build:react:dev

# Production build (minified)
npm run build:react

# Full build (worker + react)
npm run build
```

### Development Server

```bash
# Standard development
npm run dev

# Development with React rebuild
npm run dev:react
```

## Adding New React Components

1. Create component in `src/react/[component-name].tsx`
2. Add build configuration in `build-react.js`
3. Create HTML page that loads React and mounts component
4. Update navigation links

## Best Practices

- Keep React components focused on complex interactive features
- Use TypeScript for type safety
- Follow existing code conventions and styling
- Maintain mobile responsiveness
- Test both development and production builds

## File Structure

```
src/react/           # React components (TSX)
public/js/react/     # Compiled React bundles
build-react.js       # React build configuration
tsconfig.json        # TypeScript configuration
```