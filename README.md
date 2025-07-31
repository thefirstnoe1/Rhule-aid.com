# Nebraska Cornhuskers Football Website

A complete website for the 2025 Nebraska Cornhuskers football season, built with modern web technologies and optimized for Cloudflare Pages deployment.

## 🏗️ Project Structure

```
Rhule-aid.com/
├── public/                          # Static assets (Cloudflare Pages build output)
│   ├── css/
│   │   └── styles.css              # Main stylesheet with dark mode support
│   ├── js/
│   │   ├── script.js               # Core JavaScript functionality
│   │   └── mobile-menu.js          # Mobile menu implementation
│   ├── images/
│   │   ├── favicon-rhuleaid.png    # Site favicon
│   │   ├── rhule-aid.jpeg          # Coach Rhule image
│   │   └── logos/
│   │       ├── nebraska-logo.png   # Official Nebraska logo
│   │       └── default-logo.png    # Fallback logo
│   ├── index.html                  # Homepage with hero, stats, features, news
│   ├── gameday.html                # Game Day page with countdown functionality
│   ├── schedule.html               # Season schedule with filtering
│   ├── roster.html                 # Team roster with position filtering
│   ├── news.html                   # Latest news and updates
│   ├── rhule-aid.html              # Coach Matt Rhule dedicated page
│   ├── index_new.html              # Alternative homepage design
│   └── index_old.html              # Legacy homepage backup
├── functions/                       # Cloudflare Pages Functions (API routes)
│   └── api/
│       ├── schedule.js             # Schedule data API
│       ├── roster.js               # Roster data API
│       ├── news.js                 # News feed API
│       ├── news.ts                 # TypeScript news API
│       ├── weather.ts              # Weather data API
│       ├── conferences.js          # Conference data API
│       ├── logo.js                 # Logo service API
│       └── discord-messages.js     # Discord integration API
├── src/
│   └── migrations/
│       └── 001_create_teams_table.sql  # Database schema
├── .env.example                    # Environment variables template
├── .gitignore                      # Git ignore rules
├── package.json                    # Node.js dependencies and scripts
├── wrangler.toml                   # Cloudflare configuration (secure)
├── SECRETS.md                      # Security setup documentation
└── README.md                       # This file
```

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- Cloudflare account
- Git

### Local Development

1. **Clone the repository**
   ```bash
   git clone https://github.com/thefirstnoe1/Rhule-aid.com.git
   cd Rhule-aid.com
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your Cloudflare resource IDs
   ```

4. **Start development server**
   ```bash
   npm run dev
   # or
   npx wrangler pages dev public
   ```

### Production Deployment

1. **Configure GitHub Secrets** (see [SECRETS.md](./SECRETS.md))
   - `DATABASE_ID` - Cloudflare D1 Database ID
   - `SCHEDULE_CACHE_ID` - Schedule KV Namespace ID
   - `ROSTER_CACHE_ID` - Roster KV Namespace ID  
   - `NEWS_CACHE_ID` - News KV Namespace ID
   - `WEATHER_CACHE_ID` - Weather KV Namespace ID

2. **Deploy to Cloudflare Pages**
   ```bash
   npm run deploy
   # or
   npx wrangler pages deploy public
   ```

## 📄 Pages & Features

### 🏠 **Homepage** (`public/index.html`)
- Hero section with floating logo animation
- Season statistics and quick facts
- Feature cards linking to main sections
- Latest news with dynamic loading
- Fully responsive with mobile menu
- Dark/light mode toggle

### 🏈 **Game Day** (`public/gameday.html`)
- Live countdown to next game
- Dynamic title changes on game day
- Weather integration for game location
- Mobile-optimized countdown display

### 📅 **Schedule** (`public/schedule.html`)
- Complete 2025 season schedule
- Filter by home/away games
- Conference vs non-conference filtering
- Game status and results tracking

### 👥 **Roster** (`public/roster.html`)
- Complete team roster
- Filter by position groups
- Player search functionality
- Detailed player information

### 📰 **News** (`public/news.html`)
- Latest team news and updates
- RSS feed integration
- Image thumbnails with fallbacks
- Mobile-responsive card layout

### 🌽 **Rhule-aid** (`public/rhule-aid.html`)
- Dedicated Coach Matt Rhule showcase
- Career highlights and philosophy
- Interactive timeline of achievements

## ✨ Technical Features

### 🔒 **Security**
- Environment variables for sensitive data
- No hardcoded API keys or IDs
- Secure GitHub Actions deployment
- Clean Git history (no exposed credentials)

### 📱 **Responsive Design**
- Mobile-first approach
- Breakpoints: 768px, 1024px, 1200px
- Touch-friendly navigation
- Optimized images and assets

### 🌙 **Dark Mode**
- System preference detection
- Manual toggle with persistence
- Safari/iOS compatible
- Smooth theme transitions

### ⚡ **Performance**
- Cloudflare Pages CDN
- KV storage for caching
- Lazy loading images
- Optimized JavaScript

### 🛠️ **API Integration**
- RESTful API endpoints
- Real-time data fetching
- Error handling and fallbacks
- TypeScript support

## 🔧 Configuration

### Environment Variables
```bash
# Cloudflare Resource IDs
DATABASE_ID=your-d1-database-id
SCHEDULE_CACHE_ID=your-schedule-kv-id
ROSTER_CACHE_ID=your-roster-kv-id
NEWS_CACHE_ID=your-news-kv-id
WEATHER_CACHE_ID=your-weather-kv-id
```

### Wrangler Configuration
- **Build Output**: `public/`
- **Node.js Compatibility**: Enabled
- **D1 Database**: Configured for team data
- **KV Namespaces**: Set up for caching

## 🛠️ Development

### Available Scripts
```bash
npm run dev          # Start development server
npm run build        # Build for production  
npm run deploy       # Deploy to Cloudflare Pages
npm run preview      # Preview production build
```

### Code Structure
- **CSS**: Modern CSS with custom properties (CSS variables)
- **JavaScript**: Vanilla JS with ES6+ features
- **API**: Cloudflare Pages Functions
- **Database**: Cloudflare D1 (SQLite)
- **Caching**: Cloudflare KV

## 📱 Browser Support

- ✅ Chrome 90+
- ✅ Firefox 90+
- ✅ Safari 14+
- ✅ Edge 90+
- ✅ Mobile browsers (iOS Safari, Chrome Mobile)
- ✅ Progressive enhancement for older browsers

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📞 Support

For questions or issues:
- Check [SECRETS.md](./SECRETS.md) for setup help
- Review [PROJECT_STRUCTURE.md](./PROJECT_STRUCTURE.md) for architecture details
- Open an issue on GitHub

---

**Go Big Red!** 🌽🏈

*Built with ❤️ for Husker fans everywhere*
