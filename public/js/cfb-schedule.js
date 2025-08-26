class CFBSchedule {
    constructor() {
        this.scheduleData = null;
        this.filteredGames = [];
        this.currentFilters = {
            week: '',
            conference: '',
            status: '',
            rankedOnly: false
        };
        
        this.init();
    }
    
    init() {
        this.bindEvents();
        this.loadSchedule();
    }
    
    bindEvents() {
        // Filter controls
        document.getElementById('week-filter').addEventListener('change', (e) => {
            this.currentFilters.week = e.target.value;
            this.applyFilters();
        });
        
        document.getElementById('conference-filter').addEventListener('change', (e) => {
            this.currentFilters.conference = e.target.value;
            this.applyFilters();
        });
        
        document.getElementById('status-filter').addEventListener('change', (e) => {
            this.currentFilters.status = e.target.value;
            this.applyFilters();
        });
        
        document.getElementById('ranked-filter').addEventListener('change', (e) => {
            this.currentFilters.rankedOnly = e.target.checked;
            this.applyFilters();
        });
        
        // Refresh button
        document.getElementById('refresh-btn').addEventListener('click', () => {
            this.loadSchedule(true);
        });
        
        // Retry button
        document.getElementById('retry-btn').addEventListener('click', () => {
            this.loadSchedule(true);
        });
        
        // Auto-refresh every 5 minutes for live games
        setInterval(() => {
            if (this.hasLiveGames()) {
                this.loadSchedule();
            }
        }, 300000); // 5 minutes
    }
    
    async loadSchedule(forceRefresh = false) {
        this.showLoading();
        this.hideError();
        
        try {
            const url = new URL('/api/cfb-schedule', window.location.origin);
            if (this.currentFilters.week) {
                url.searchParams.set('week', this.currentFilters.week);
            }
            
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            
            this.scheduleData = await response.json();
            this.populateWeekFilter();
            this.applyFilters();
            this.updateLastUpdated();
            
        } catch (error) {
            console.error('Error loading schedule:', error);
            this.showError();
        } finally {
            this.hideLoading();
        }
    }
    
    populateWeekFilter() {
        if (!this.scheduleData?.weeks) return;
        
        const weekFilter = document.getElementById('week-filter');
        const currentValue = weekFilter.value;
        
        // Clear existing options except "All Weeks"
        weekFilter.innerHTML = '<option value="">All Weeks</option>';
        
        this.scheduleData.weeks.forEach(week => {
            const option = document.createElement('option');
            option.value = week.value;
            option.textContent = week.label;
            weekFilter.appendChild(option);
        });
        
        // Restore previous selection
        weekFilter.value = currentValue;
    }
    
    applyFilters() {
        if (!this.scheduleData?.games) return;
        
        this.filteredGames = this.scheduleData.games.filter(game => {
            // Week filter
            if (this.currentFilters.week && game.week.toString() !== this.currentFilters.week) {
                return false;
            }
            
            // Conference filter
            if (this.currentFilters.conference) {
                const hasConference = game.homeTeam.conference === this.currentFilters.conference ||
                                    game.awayTeam.conference === this.currentFilters.conference;
                if (!hasConference) return false;
            }
            
            // Status filter
            if (this.currentFilters.status) {
                const gameStatus = this.getGameStatusCategory(game.status, game.isCompleted);
                if (gameStatus !== this.currentFilters.status) return false;
            }
            
            // Ranked teams filter
            if (this.currentFilters.rankedOnly) {
                const hasRankedTeam = game.homeTeam.rank || game.awayTeam.rank;
                if (!hasRankedTeam) return false;
            }
            
            return true;
        });
        
        this.renderSchedule();
    }
    
    renderSchedule() {
        const container = document.getElementById('schedule-container');
        
        if (!this.filteredGames || this.filteredGames.length === 0) {
            container.innerHTML = `
                <div class="no-games">
                    <p>No games found matching your filters.</p>
                </div>
            `;
            return;
        }
        
        // Group games by date
        const gamesByDate = this.groupGamesByDate(this.filteredGames);
        
        let html = '';
        Object.keys(gamesByDate).forEach(date => {
            html += this.renderDateSection(date, gamesByDate[date]);
        });
        
        container.innerHTML = html;
    }
    
    groupGamesByDate(games) {
        const grouped = {};
        games.forEach(game => {
            if (!grouped[game.date]) {
                grouped[game.date] = [];
            }
            grouped[game.date].push(game);
        });
        
        // Sort games within each date by time
        Object.keys(grouped).forEach(date => {
            grouped[date].sort((a, b) => new Date(a.datetime) - new Date(b.datetime));
        });
        
        return grouped;
    }
    
    renderDateSection(date, games) {
        const dateObj = new Date(games[0].datetime);
        const formattedDate = dateObj.toLocaleDateString('en-US', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        });
        
        let html = `
            <div class="date-section">
                <h2 class="date-header">${formattedDate}</h2>
                <div class="games-grid">
        `;
        
        games.forEach(game => {
            html += this.renderGameCard(game);
        });
        
        html += `
                </div>
            </div>
        `;
        
        return html;
    }
    
    renderGameCard(game) {
        const gameStatus = this.getGameStatusCategory(game.status, game.isCompleted);
        const statusClass = gameStatus === 'live' ? 'live' : gameStatus === 'completed' ? 'completed' : 'scheduled';
        
        return `
            <div class="game-card ${statusClass}">
                <div class="game-header">
                    <span class="game-time">${game.time}</span>
                    <span class="game-status ${statusClass}">${game.status}</span>
                </div>
                
                <div class="teams">
                    <div class="team away-team">
                        <div class="team-info">
                            <img src="${game.awayTeam.logo}" alt="${game.awayTeam.name}" class="team-logo" 
                                 onerror="this.src='/images/logos/default-logo.png'">
                            <div class="team-details">
                                <div class="team-name">
                                    ${game.awayTeam.rank ? `<span class="rank">#${game.awayTeam.rank}</span>` : ''}
                                    ${game.awayTeam.shortName}
                                </div>
                                <div class="team-conference">${game.awayTeam.conference}</div>
                            </div>
                        </div>
                        <div class="team-score">${game.isCompleted || gameStatus === 'live' ? game.awayTeam.score : ''}</div>
                    </div>
                    
                    <div class="vs-separator">@</div>
                    
                    <div class="team home-team">
                        <div class="team-info">
                            <img src="${game.homeTeam.logo}" alt="${game.homeTeam.name}" class="team-logo"
                                 onerror="this.src='/images/logos/default-logo.png'">
                            <div class="team-details">
                                <div class="team-name">
                                    ${game.homeTeam.rank ? `<span class="rank">#${game.homeTeam.rank}</span>` : ''}
                                    ${game.homeTeam.shortName}
                                </div>
                                <div class="team-conference">${game.homeTeam.conference}</div>
                            </div>
                        </div>
                        <div class="team-score">${game.isCompleted || gameStatus === 'live' ? game.homeTeam.score : ''}</div>
                    </div>
                </div>
                
                <div class="game-details">
                    <div class="venue-info">
                        <span class="venue">${game.venue}</span>
                        <span class="location">${game.location}</span>
                    </div>
                    <div class="broadcast-info">
                        <span class="tv">${game.tv}</span>
                        ${game.spread ? `<span class="spread">${game.spread}</span>` : ''}
                    </div>
                </div>
            </div>
        `;
    }
    
    getGameStatusCategory(status, isCompleted) {
        if (isCompleted) return 'completed';
        if (status.includes('Q') || status.includes('Half') || status.includes('OT')) return 'live';
        return 'scheduled';
    }
    
    hasLiveGames() {
        if (!this.filteredGames) return false;
        return this.filteredGames.some(game => 
            this.getGameStatusCategory(game.status, game.isCompleted) === 'live'
        );
    }
    
    updateLastUpdated() {
        if (!this.scheduleData?.lastUpdated) return;
        
        const lastUpdated = new Date(this.scheduleData.lastUpdated);
        const timeString = lastUpdated.toLocaleTimeString();
        
        document.getElementById('last-updated').textContent = `Last updated: ${timeString}`;
    }
    
    showLoading() {
        document.getElementById('loading').style.display = 'block';
        document.getElementById('schedule-container').style.display = 'none';
    }
    
    hideLoading() {
        document.getElementById('loading').style.display = 'none';
        document.getElementById('schedule-container').style.display = 'block';
    }
    
    showError() {
        document.getElementById('error-message').style.display = 'block';
        document.getElementById('schedule-container').style.display = 'none';
    }
    
    hideError() {
        document.getElementById('error-message').style.display = 'none';
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new CFBSchedule();
});

// Add CSS styles for the schedule page
const scheduleStyles = `
    .schedule-controls {
        background: var(--card-bg);
        padding: 1.5rem;
        border-radius: 8px;
        margin-bottom: 2rem;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    
    .filter-controls {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 1rem;
        margin-bottom: 1rem;
    }
    
    .filter-group {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
    }
    
    .filter-group label {
        font-weight: 500;
        color: var(--text-color);
        display: flex;
        align-items: center;
        gap: 0.5rem;
    }
    
    .filter-group select, .filter-group input[type="checkbox"] {
        padding: 0.5rem;
        border: 1px solid var(--border-color);
        border-radius: 4px;
        background: var(--bg-color);
        color: var(--text-color);
    }
    
    .refresh-controls {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding-top: 1rem;
        border-top: 1px solid var(--border-color);
    }
    
    .refresh-icon {
        display: inline-block;
        transition: transform 0.3s ease;
    }
    
    .btn:hover .refresh-icon {
        transform: rotate(180deg);
    }
    
    .last-updated {
        font-size: 0.875rem;
        color: var(--text-muted);
    }
    
    .date-section {
        margin-bottom: 2rem;
    }
    
    .date-header {
        font-size: 1.5rem;
        margin-bottom: 1rem;
        color: var(--primary-color);
        border-bottom: 2px solid var(--primary-color);
        padding-bottom: 0.5rem;
    }
    
    .games-grid {
        display: grid;
        gap: 1rem;
        grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
    }
    
    .game-card {
        background: var(--card-bg);
        border-radius: 8px;
        padding: 1rem;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        transition: transform 0.2s ease, box-shadow 0.2s ease;
        border-left: 4px solid var(--border-color);
    }
    
    .game-card:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 8px rgba(0,0,0,0.15);
    }
    
    .game-card.live {
        border-left-color: #e74c3c;
        background: linear-gradient(135deg, var(--card-bg) 0%, rgba(231, 76, 60, 0.05) 100%);
    }
    
    .game-card.completed {
        border-left-color: #27ae60;
    }
    
    .game-card.scheduled {
        border-left-color: var(--primary-color);
    }
    
    .game-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 1rem;
    }
    
    .game-time {
        font-weight: 500;
        color: var(--text-color);
    }
    
    .game-status {
        padding: 0.25rem 0.5rem;
        border-radius: 4px;
        font-size: 0.75rem;
        font-weight: 500;
        text-transform: uppercase;
    }
    
    .game-status.live {
        background: #e74c3c;
        color: white;
    }
    
    .game-status.completed {
        background: #27ae60;
        color: white;
    }
    
    .game-status.scheduled {
        background: var(--border-color);
        color: var(--text-color);
    }
    
    .teams {
        display: flex;
        align-items: center;
        gap: 1rem;
        margin-bottom: 1rem;
    }
    
    .team {
        flex: 1;
        display: flex;
        justify-content: space-between;
        align-items: center;
    }
    
    .team-info {
        display: flex;
        align-items: center;
        gap: 0.75rem;
    }
    
    .team-logo {
        width: 32px;
        height: 32px;
        object-fit: contain;
    }
    
    .team-details {
        display: flex;
        flex-direction: column;
    }
    
    .team-name {
        font-weight: 500;
        display: flex;
        align-items: center;
        gap: 0.5rem;
    }
    
    .rank {
        background: var(--primary-color);
        color: white;
        padding: 0.125rem 0.375rem;
        border-radius: 4px;
        font-size: 0.75rem;
        font-weight: 600;
    }
    
    .team-conference {
        font-size: 0.75rem;
        color: var(--text-muted);
    }
    
    .team-score {
        font-size: 1.25rem;
        font-weight: 600;
        color: var(--primary-color);
        min-width: 2rem;
        text-align: center;
    }
    
    .vs-separator {
        font-size: 0.875rem;
        color: var(--text-muted);
        font-weight: 500;
    }
    
    .game-details {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding-top: 1rem;
        border-top: 1px solid var(--border-color);
        font-size: 0.875rem;
    }
    
    .venue-info {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
    }
    
    .venue {
        font-weight: 500;
    }
    
    .location {
        color: var(--text-muted);
    }
    
    .broadcast-info {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
        text-align: right;
    }
    
    .tv {
        font-weight: 500;
        color: var(--primary-color);
    }
    
    .spread {
        color: var(--text-muted);
    }
    
    .no-games {
        text-align: center;
        padding: 3rem;
        color: var(--text-muted);
    }
    
    .loading {
        text-align: center;
        padding: 3rem;
    }
    
    .spinner {
        border: 4px solid var(--border-color);
        border-top: 4px solid var(--primary-color);
        border-radius: 50%;
        width: 40px;
        height: 40px;
        animation: spin 1s linear infinite;
        margin: 0 auto 1rem;
    }
    
    @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
    }
    
    .error-message {
        text-align: center;
        padding: 3rem;
        color: var(--text-muted);
    }
    
    @media (max-width: 768px) {
        .games-grid {
            grid-template-columns: 1fr;
        }
        
        .filter-controls {
            grid-template-columns: 1fr;
        }
        
        .refresh-controls {
            flex-direction: column;
            gap: 1rem;
            align-items: stretch;
        }
        
        .teams {
            flex-direction: column;
            gap: 0.5rem;
        }
        
        .vs-separator {
            transform: rotate(90deg);
        }
        
        .game-details {
            flex-direction: column;
            gap: 1rem;
            align-items: stretch;
        }
        
        .broadcast-info {
            text-align: left;
        }
    }
`;

// Add styles to page
const styleSheet = document.createElement('style');
styleSheet.textContent = scheduleStyles;
document.head.appendChild(styleSheet);