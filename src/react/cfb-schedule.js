import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect, useCallback } from 'react';
const CFBSchedule = () => {
    const [scheduleData, setScheduleData] = useState(null);
    const [filteredGames, setFilteredGames] = useState([]);
    const [filters, setFilters] = useState({
        week: '',
        conference: '',
        status: '',
        rankedOnly: false
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(false);
    const getGameStatusCategory = useCallback((status, isCompleted) => {
        if (isCompleted)
            return 'completed';
        if (status.includes('Q') || status.includes('Half') || status.includes('OT'))
            return 'live';
        return 'scheduled';
    }, []);
    const hasLiveGames = useCallback(() => {
        if (!filteredGames)
            return false;
        return filteredGames.some(game => getGameStatusCategory(game.status, game.isCompleted) === 'live');
    }, [filteredGames, getGameStatusCategory]);
    const loadSchedule = useCallback(async () => {
        setLoading(true);
        setError(false);
        try {
            const url = new URL('/api/cfb-schedule', window.location.origin);
            if (filters.week) {
                url.searchParams.set('week', filters.week);
            }
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            const data = await response.json();
            setScheduleData(data);
        }
        catch (err) {
            console.error('Error loading schedule:', err);
            setError(true);
        }
        finally {
            setLoading(false);
        }
    }, [filters.week]);
    const applyFilters = useCallback(() => {
        if (!scheduleData?.games)
            return;
        const filtered = scheduleData.games.filter(game => {
            // Week filter
            if (filters.week && game.week.toString() !== filters.week) {
                return false;
            }
            // Conference filter
            if (filters.conference) {
                const hasConference = game.homeTeam.conference === filters.conference ||
                    game.awayTeam.conference === filters.conference;
                if (!hasConference)
                    return false;
            }
            // Status filter
            if (filters.status) {
                const gameStatus = getGameStatusCategory(game.status, game.isCompleted);
                if (gameStatus !== filters.status)
                    return false;
            }
            // Ranked teams filter
            if (filters.rankedOnly) {
                const hasRankedTeam = game.homeTeam.rank || game.awayTeam.rank;
                if (!hasRankedTeam)
                    return false;
            }
            return true;
        });
        setFilteredGames(filtered);
    }, [scheduleData, filters, getGameStatusCategory]);
    const groupGamesByDate = useCallback((games) => {
        const grouped = {};
        games.forEach(game => {
            if (!grouped[game.date]) {
                grouped[game.date] = [];
            }
            const gameArray = grouped[game.date];
            if (gameArray) {
                gameArray.push(game);
            }
        });
        // Sort games within each date by time
        Object.keys(grouped).forEach(date => {
            const games = grouped[date];
            if (games) {
                games.sort((a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime());
            }
        });
        return grouped;
    }, []);
    // Load schedule on mount
    useEffect(() => {
        loadSchedule();
    }, [loadSchedule]);
    // Apply filters when data or filters change
    useEffect(() => {
        applyFilters();
    }, [applyFilters]);
    // Auto-refresh for live games
    useEffect(() => {
        const interval = setInterval(() => {
            if (hasLiveGames()) {
                loadSchedule();
            }
        }, 300000); // 5 minutes
        return () => clearInterval(interval);
    }, [hasLiveGames, loadSchedule]);
    const handleFilterChange = (key, value) => {
        setFilters(prev => ({ ...prev, [key]: value }));
    };
    const GameCard = ({ game }) => {
        const gameStatus = getGameStatusCategory(game.status, game.isCompleted);
        const statusClass = gameStatus === 'live' ? 'live' : gameStatus === 'completed' ? 'completed' : 'scheduled';
        return (_jsxs("div", { className: `game-card ${statusClass}`, children: [_jsxs("div", { className: "game-header", children: [_jsx("span", { className: "game-time", children: game.time }), _jsx("span", { className: `game-status ${statusClass}`, children: game.status })] }), _jsxs("div", { className: "teams", children: [_jsxs("div", { className: "team away-team", children: [_jsxs("div", { className: "team-info", children: [_jsx("img", { src: game.awayTeam.logo, alt: game.awayTeam.name, className: "team-logo", onError: (e) => {
                                                e.target.src = '/images/logos/default-logo.png';
                                            } }), _jsxs("div", { className: "team-details", children: [_jsxs("div", { className: "team-name", children: [game.awayTeam.rank && _jsxs("span", { className: "rank", children: ["#", game.awayTeam.rank] }), game.awayTeam.shortName] }), _jsx("div", { className: "team-conference", children: game.awayTeam.conference })] })] }), _jsx("div", { className: "team-score", children: (game.isCompleted || gameStatus === 'live') ? game.awayTeam.score : '' })] }), _jsx("div", { className: "vs-separator", children: "@" }), _jsxs("div", { className: "team home-team", children: [_jsxs("div", { className: "team-info", children: [_jsx("img", { src: game.homeTeam.logo, alt: game.homeTeam.name, className: "team-logo", onError: (e) => {
                                                e.target.src = '/images/logos/default-logo.png';
                                            } }), _jsxs("div", { className: "team-details", children: [_jsxs("div", { className: "team-name", children: [game.homeTeam.rank && _jsxs("span", { className: "rank", children: ["#", game.homeTeam.rank] }), game.homeTeam.shortName] }), _jsx("div", { className: "team-conference", children: game.homeTeam.conference })] })] }), _jsx("div", { className: "team-score", children: (game.isCompleted || gameStatus === 'live') ? game.homeTeam.score : '' })] })] }), _jsxs("div", { className: "game-details", children: [_jsxs("div", { className: "venue-info", children: [_jsx("span", { className: "venue", children: game.venue }), _jsx("span", { className: "location", children: game.location })] }), _jsxs("div", { className: "broadcast-info", children: [_jsx("span", { className: "tv", children: game.tv }), game.spread && _jsx("span", { className: "spread", children: game.spread })] })] })] }));
    };
    const DateSection = ({ games }) => {
        const dateObj = new Date(games[0]?.datetime || '');
        const formattedDate = dateObj.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        return (_jsxs("div", { className: "date-section", children: [_jsx("h2", { className: "date-header", children: formattedDate }), _jsx("div", { className: "games-grid", children: games.map(game => (_jsx(GameCard, { game: game }, game.id))) })] }));
    };
    const gamesByDate = groupGamesByDate(filteredGames);
    return (_jsxs(_Fragment, { children: [_jsxs("div", { className: "schedule-controls", children: [_jsxs("div", { className: "filter-controls", children: [_jsxs("div", { className: "filter-group", children: [_jsx("label", { htmlFor: "week-filter", children: "Week" }), _jsxs("select", { id: "week-filter", value: filters.week, onChange: (e) => handleFilterChange('week', e.target.value), children: [_jsx("option", { value: "", children: "All Weeks" }), scheduleData?.weeks?.map(week => (_jsx("option", { value: week.value, children: week.label }, week.value)))] })] }), _jsxs("div", { className: "filter-group", children: [_jsx("label", { htmlFor: "conference-filter", children: "Conference" }), _jsxs("select", { id: "conference-filter", value: filters.conference, onChange: (e) => handleFilterChange('conference', e.target.value), children: [_jsx("option", { value: "", children: "All Conferences" }), _jsx("option", { value: "Big Ten", children: "Big Ten" }), _jsx("option", { value: "SEC", children: "SEC" }), _jsx("option", { value: "ACC", children: "ACC" }), _jsx("option", { value: "Big 12", children: "Big 12" }), _jsx("option", { value: "Pac-12", children: "Pac-12" }), _jsx("option", { value: "Mountain West", children: "Mountain West" }), _jsx("option", { value: "American Athletic", children: "American Athletic" }), _jsx("option", { value: "Conference USA", children: "Conference USA" }), _jsx("option", { value: "MAC", children: "MAC" }), _jsx("option", { value: "Sun Belt", children: "Sun Belt" })] })] }), _jsxs("div", { className: "filter-group", children: [_jsx("label", { htmlFor: "status-filter", children: "Game Status" }), _jsxs("select", { id: "status-filter", value: filters.status, onChange: (e) => handleFilterChange('status', e.target.value), children: [_jsx("option", { value: "", children: "All Games" }), _jsx("option", { value: "scheduled", children: "Scheduled" }), _jsx("option", { value: "live", children: "Live" }), _jsx("option", { value: "completed", children: "Completed" })] })] }), _jsx("div", { className: "filter-group", children: _jsxs("label", { htmlFor: "ranked-filter", children: [_jsx("input", { type: "checkbox", id: "ranked-filter", checked: filters.rankedOnly, onChange: (e) => handleFilterChange('rankedOnly', e.target.checked) }), "Ranked Teams Only"] }) })] }), _jsxs("div", { className: "refresh-controls", children: [_jsxs("button", { id: "refresh-btn", className: "btn btn-primary", onClick: () => loadSchedule(), disabled: loading, children: [_jsx("span", { className: "refresh-icon", children: "\uD83D\uDD04" }), " Refresh"] }), scheduleData?.lastUpdated && (_jsxs("span", { className: "last-updated", children: ["Last updated: ", new Date(scheduleData.lastUpdated).toLocaleTimeString()] }))] })] }), loading && (_jsxs("div", { className: "loading", children: [_jsx("div", { className: "spinner" }), _jsx("p", { children: "Loading schedule..." })] })), error && (_jsxs("div", { className: "error-message", children: [_jsx("p", { children: "\u26A0\uFE0F Unable to load schedule data" }), _jsx("button", { id: "retry-btn", className: "btn", onClick: () => loadSchedule(), children: "Try Again" })] })), !loading && !error && (_jsx("div", { id: "schedule-container", children: filteredGames.length === 0 ? (_jsx("div", { className: "no-games", children: _jsx("p", { children: "No games found matching your filters." }) })) : (Object.keys(gamesByDate).map(date => (_jsx(DateSection, { date: date, games: gamesByDate[date] || [] }, date)))) }))] }));
};
export default CFBSchedule;
