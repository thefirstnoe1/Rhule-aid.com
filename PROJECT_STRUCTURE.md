# Project Structure

This project follows Cloudflare Pages best practices with the following structure:

## Directory Structure

```
├── public/                 # Static assets served by Cloudflare Pages
│   ├── css/               # Stylesheets
│   │   └── styles.css
│   ├── js/                # Client-side JavaScript
│   │   ├── script.js
│   │   └── mobile-menu.js
│   ├── images/            # Static images and media
│   │   ├── logos/
│   │   ├── favicon-rhuleaid.png
│   │   └── rhule-aid.jpeg
│   └── *.html             # HTML pages
├── functions/             # Cloudflare Pages Functions (API routes)
│   └── api/               # API endpoints
├── src/                   # Source code and development files
│   └── migrations/        # Database migration files
├── package.json           # Node.js dependencies and scripts
├── wrangler.toml         # Cloudflare configuration
└── README.md             # This file
```

## Key Changes Made

1. **Static Assets**: All static files (HTML, CSS, JS, images) moved to `public/` directory
2. **Organized Assets**: CSS in `public/css/`, JavaScript in `public/js/`, images in `public/images/`
3. **Development Files**: Migrations and other source files moved to `src/`
4. **Updated References**: All HTML files updated to use correct asset paths
5. **Build Configuration**: Updated `wrangler.toml` and `package.json` for new structure

## Benefits

- **Cloudflare Pages Compatibility**: Follows official best practices
- **Better Organization**: Clear separation of static assets and source code
- **Easier Deployment**: Build output directory clearly defined
- **Development Friendly**: Local development and production deployment consistency

## Scripts

- `npm run dev` - Start local development server
- `npm run deploy` - Deploy to Cloudflare Pages
- `npm run build` - Type check (if using TypeScript)
