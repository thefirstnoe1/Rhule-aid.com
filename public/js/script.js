// Nebraska Football Website - API-Driven Script
console.log('Nebraska Football script loading...');

// Mobile menu toggle function
function toggleMobileMenu() {
    const nav = document.getElementById('site-nav');
    if (nav) {
        nav.classList.toggle('active');
    }
}

// Close mobile menu when clicking outside
document.addEventListener('click', function(event) {
    const nav = document.getElementById('site-nav');
    const toggle = document.querySelector('.mobile-menu-toggle');
    
    if (nav && toggle && nav.classList.contains('active')) {
        if (!nav.contains(event.target) && !toggle.contains(event.target)) {
            nav.classList.remove('active');
        }
    }
});

// Fallback data (minimal, only used if API completely fails)
const fallbackScheduleData = [
    {
        date: "Thursday, August 28, 2025",
        time: "9:00 PM",
        opponent: "Cincinnati Bearcats",
        location: "Arrowhead Stadium, Kansas City, MO",
        tvNetwork: "ESPN",
        isHome: false,
        isNeutral: true
    },
    {
        date: "Saturday, September 6, 2025", 
        opponent: "Akron Zips",
        time: "7:30 PM",
        location: "Memorial Stadium, Lincoln, NE",
        tvNetwork: "BTN",
        isHome: true
    }
];

const fallbackRosterData = [
    { number: "8", name: "Dylan Raiola", position: "QB", height: "6'3\"", weight: "220", class: "Fr.", hometown: "Buford, GA", stats: "5-star recruit", group: "offense" }
];

// Current filters
let currentScheduleFilter = 'all';
let currentTimezone = 'America/Chicago'; // Default to Central Time (Nebraska's timezone)

// Timezone conversion function
function convertTimeToTimezone(timeString, targetTimezone) {
    if (!timeString || timeString === 'TBD') {
        return timeString;
    }
    
    try {
        // Parse the time string (e.g., "7:00 PM" or "7:00 PM ET")
        const cleanTime = timeString.replace(/ (CT|ET|MT|PT)$/i, '');
        
        const [time, period] = cleanTime.split(' ');
        const [hours, minutes] = time.split(':').map(Number);
        let hour24 = hours;
        
        if (period && period.toLowerCase() === 'pm' && hours !== 12) {
            hour24 += 12;
        } else if (period && period.toLowerCase() === 'am' && hours === 12) {
            hour24 = 0;
        }
        
        // Create a date object for a game day (using a future Saturday for proper timezone handling)
        // FBSchedules.com times are in Eastern Time
        const gameDate = new Date('2025-09-01'); // Use a date in the football season
        gameDate.setHours(hour24, minutes || 0, 0, 0);
        
        // Convert from Eastern Time to target timezone
        // First create the time as if it's in Eastern Time
        const easternTime = new Date(gameDate.getTime());
        
        // Create formatter for Eastern Time to get the actual time
        const easternFormatter = new Intl.DateTimeFormat('en-US', {
            timeZone: 'America/New_York',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        });
        
        // Create formatter for target timezone
        const targetFormatter = new Intl.DateTimeFormat('en-US', {
            timeZone: targetTimezone,
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });
        
        // Create a proper Eastern Time date
        const easternDateStr = `2025-09-01T${hour24.toString().padStart(2, '0')}:${(minutes || 0).toString().padStart(2, '0')}:00-04:00`; // EDT offset
        const properEasternDate = new Date(easternDateStr);
        
        // Format in target timezone
        const convertedTime = targetFormatter.format(properEasternDate);
        const timezoneAbbr = getTimezoneAbbreviation(targetTimezone);
        
        return convertedTime + ' ' + timezoneAbbr;
    } catch (error) {
        console.warn('Error converting time:', error);
        return timeString;
    }
}

function getTimezoneAbbreviation(timezone) {
    const abbrevMap = {
        'America/Chicago': 'CT',
        'America/New_York': 'ET', 
        'America/Denver': 'MT',
        'America/Los_Angeles': 'PT',
        'Europe/London': 'GMT'
    };
    return abbrevMap[timezone] || 'UTC';
}

// API Configuration - using our own Cloudflare Pages Functions as proxy
const API_BASE_URL = window.location.origin; // Use the same domain

// Client-side cache configuration
const CLIENT_CACHE_TTL = 10 * 60 * 1000; // 10 minutes in milliseconds
let rosterCache = null;
let scheduleCache = null;

// Get cached data if still valid
function getCachedData(cache, ttl = CLIENT_CACHE_TTL) {
    if (!cache || !cache.timestamp) return null;
    if (Date.now() - cache.timestamp > ttl) return null;
    return cache.data;
}

// Set cache data
function setCacheData(cache, data) {
    return {
        data: data,
        timestamp: Date.now()
    };
}

// Fetch roster data via our serverless function with client-side caching
async function fetchRosterData() {
    try {
        // Check client-side cache first
        const cachedData = getCachedData(rosterCache);
        if (cachedData) {
            console.log('Using client-side cached roster data');
            return cachedData;
        }
        
        console.log('Fetching roster data via Cloudflare Pages Function...');
        
        const response = await fetch(`${API_BASE_URL}/api/roster`);
        
        if (!response.ok) {
            if (response.status === 500) {
                const errorData = await response.json();
                console.error('Server error:', errorData.error);
            }
            throw new Error(`API request failed: ${response.status}`);
        }
        
        const apiResponse = await response.json();
        
        // Check if we got an error response
        if (apiResponse.error) {
            console.error('API error:', apiResponse.error);
            throw new Error(apiResponse.error);
        }
        
        // Extract the data array from the response
        const apiRosterData = apiResponse.data || apiResponse;
        
        console.log('API response received:', apiRosterData.length, 'players');
        
        // Log cache status
        const cacheStatus = response.headers.get('X-Cache-Status');
        if (cacheStatus) {
            console.log('Server cache status:', cacheStatus);
        }
        
        // The data is already transformed by our serverless function, just add the group categorization
        const transformedRoster = apiRosterData.map(player => {
            let group = 'offense'; // default
            
            // Categorize by position abbreviations
            const position = player.position || '';
            if (['QB', 'RB', 'FB', 'WR', 'TE', 'OL', 'OT', 'OG', 'C'].includes(position)) {
                group = 'offense';
            } else if (['DL', 'DE', 'DT', 'NT', 'LB', 'ILB', 'OLB', 'DB', 'CB', 'S', 'FS', 'SS'].includes(position)) {
                group = 'defense';
            } else if (['K', 'P', 'KR', 'PR', 'LS'].includes(position)) {
                group = 'special';
            }
            
            return {
                number: player.number || 'N/A',
                name: player.name || 'N/A',
                position: player.position || 'N/A',
                height: player.height || 'N/A',
                weight: player.weight || 'N/A',
                class: player.class || 'N/A',
                hometown: player.hometown || 'N/A',
                group: group
            };
        });
        
        console.log('Transformed roster data:', transformedRoster.length, 'players');
        
        // Cache the transformed data on client-side
        rosterCache = setCacheData(rosterCache, transformedRoster);
        
        return transformedRoster;
        
    } catch (error) {
        console.error('Failed to fetch roster data:', error);
        // Return minimal fallback data if API fails
        return fallbackRosterData;
    }
}

// Fetch schedule data via our serverless function with client-side caching
async function fetchScheduleData() {
    try {
        // Temporarily disable client-side cache for debugging
        // const cachedData = getCachedData(scheduleCache);
        // if (cachedData) {
        //     console.log('Using client-side cached schedule data');
        //     return cachedData;
        // }
        
        console.log('Fetching schedule data via Cloudflare Pages Function...');
        
        const response = await fetch(`${API_BASE_URL}/api/schedule`);
        
        if (!response.ok) {
            if (response.status === 500) {
                const errorData = await response.json();
                console.error('Server error:', errorData.error);
            }
            throw new Error(`API request failed: ${response.status}`);
        }
        
        const apiResponse = await response.json();
        
        // Check if we got an error response
        if (apiResponse.error) {
            console.error('API error:', apiResponse.error);
            throw new Error(apiResponse.error);
        }
        
        // Extract the data array from the response
        const apiScheduleData = apiResponse.data || apiResponse;
        
        console.log('API schedule received:', apiScheduleData.length, 'games');
        console.log('Sample API schedule data:', apiScheduleData.slice(0, 2).map(g => `${g.opponent}: ${g.location}`));
        
        // Log cache status
        const cacheStatus = response.headers.get('X-Cache-Status');
        if (cacheStatus) {
            console.log('Server cache status:', cacheStatus);
        }
        
        // The data is already transformed by our serverless function, just use it directly
        const transformedSchedule = apiScheduleData.map(game => {
            // Use proper TV network or provide a realistic one only if it's missing or invalid date format
            let tvNetwork = game.tvNetwork;
            if (!tvNetwork || tvNetwork.includes('Aug') || tvNetwork.includes('Sep') || tvNetwork.includes('Oct') || tvNetwork.includes('Nov')) {
                tvNetwork = getLikelyTVNetwork(game.opponent, game.isHome, game.date);
            }
            
            return {
                date: game.date,
                time: game.time,
                opponent: game.opponent,
                location: game.location,
                tvNetwork: tvNetwork,
                isHome: game.isHome,
                isNeutral: game.isNeutral
            };
        });
        
        // Cache the transformed data on client-side
        scheduleCache = setCacheData(scheduleCache, transformedSchedule);
        
        return transformedSchedule;
        
    } catch (error) {
        console.error('Failed to fetch schedule data:', error);
        // Return minimal fallback data if API fails
        return fallbackScheduleData;
    }
}

// Global variables for current data (initialized with minimal fallback)
let currentRosterData = fallbackRosterData;
let currentScheduleData = fallbackScheduleData;

// Function to get likely TV network based on opponent and game details
function getLikelyTVNetwork(opponent, isHome, date) {
    // Map important opponents to likely networks
    const networkMap = {
        'Michigan': 'FOX',
        'Ohio State': 'CBS',
        'Penn State': 'NBC',
        'USC': 'CBS',
        'UCLA': 'FOX',
        'Michigan State': 'BTN',
        'Minnesota': 'BTN',
        'Maryland': 'BTN',
        'Iowa': 'CBS', // Rivalry game
        'Cincinnati': 'ESPN',
        'Akron': 'BTN'
    };
    
    return networkMap[opponent] || 'TBD';
}

// Function to get opponent logo from Loodibee
function getOpponentLogoUrl(opponent) {
    // Map opponent names to Loodibee URL naming convention
    const loodibeeTeamMap = {
        'Cincinnati Bearcats': 'Cincinnati_Bearcats_logo',
        'Akron Zips': 'Akron_Zips_logo',
        'HCU Huskies': null, // Not in Big Ten, will fall back to initial
        'Michigan Wolverines': 'Michigan_Wolverines_logo',
        'Michigan State Spartans': 'Michigan_State_Spartans_logo',
        'Maryland Terrapins': 'Maryland_Terrapins_logo',
        'Minnesota Golden Gophers': 'Minnesota_Golden_Gophers_logo',
        'Northwestern Wildcats': 'Northwestern_Wildcats_logo',
        'USC Trojans': 'USC_Trojans_logo',
        'UCLA Bruins': 'UCLA_Bruins', // Note: UCLA uses different naming pattern
        'Penn State Nittany Lions': 'Penn_State_Nittany_Lions_logo',
        'Iowa Hawkeyes': 'Iowa_Hawkeyes_logo'
    };
    
    const teamLogo = loodibeeTeamMap[opponent];
    if (teamLogo) {
        return `https://loodibee.com/wp-content/uploads/${teamLogo}.png`;
    }
    return null;
}

// Function to get team initial and color (fallback)
function getTeamInitial(opponent) {
    const teamColors = {
        'Cincinnati': '#e00122',
        'Akron': '#041e42',
        'Houston Christian': '#663399',
        'Michigan': '#ffcb05',
        'Michigan State': '#18453b',
        'Maryland': '#e03a3e',
        'Minnesota': '#7a0019',
        'Northwestern': '#4e2a84',
        'USC': '#990000',
        'UCLA': '#2774ae',
        'Penn State': '#041e42',
        'Iowa': '#ffcd00'
    };
    
    const initial = opponent.charAt(0);
    const color = teamColors[opponent] || '#666666';
    
    return { initial, color };
}

// Render schedule function
function renderSchedule(filter = 'all') {
    console.log('renderSchedule called with filter:', filter);
    console.log('Current schedule data:', currentScheduleData);
    console.log('First 3 games locations:', currentScheduleData.slice(0, 3).map(g => `${g.opponent}: ${g.location}`));
    
    const scheduleContainer = document.getElementById('schedule-container');
    if (!scheduleContainer) {
        console.error('Schedule container not found!');
        return;
    }
    
    currentScheduleFilter = filter;
    
    // Filter games
    let filteredGames = currentScheduleData;
    if (filter === 'home') {
        filteredGames = currentScheduleData.filter(game => game.isHome);
    } else if (filter === 'away') {
        filteredGames = currentScheduleData.filter(game => !game.isHome);
    } else if (filter === 'conference') {
        const bigTenTeams = [
            'Illinois Fighting Illini', 'Purdue Boilermakers', 'Northwestern Wildcats', 
            'Wisconsin Badgers', 'Minnesota Golden Gophers', 'Iowa Hawkeyes', 
            'Rutgers Scarlet Knights', 'Indiana Hoosiers', 'Ohio State Buckeyes', 
            'UCLA Bruins', 'USC Trojans', 'Michigan Wolverines', 'Michigan State Spartans', 
            'Penn State Nittany Lions', 'Maryland Terrapins', 'Oregon Ducks', 'Washington Huskies'
        ];
        filteredGames = currentScheduleData.filter(game => bigTenTeams.includes(game.opponent));
    }
    
    console.log('Filtered games:', filteredGames.length);
    
    const scheduleHTML = filteredGames.map(game => {
        const logoUrl = getOpponentLogoUrl(game.opponent);
        const teamInfo = getTeamInitial(game.opponent);
        const gameDate = new Date(game.date);
        const dayOfWeek = gameDate.toLocaleDateString('en-US', { weekday: 'short' });
        const month = gameDate.toLocaleDateString('en-US', { month: 'short' });
        const day = gameDate.getDate();
        const convertedTime = convertTimeToTimezone(game.time, currentTimezone);
        
        return `
        <div class="game-card ${game.isNeutral ? 'neutral' : (game.isHome ? 'home' : 'away')}">
            <div class="game-card-header">
                <div class="game-date-section">
                    <div class="day-of-week">${dayOfWeek}</div>
                    <div class="date-info">
                        <span class="month">${month}</span>
                        <span class="day">${day}</span>
                    </div>
                </div>
                <div class="game-status">
                    <span class="time-badge">${convertedTime}</span>
                </div>
            </div>
            
            <div class="game-matchup">
                <div class="teams-section">
                    <div class="team nebraska-team">
                        <img src="./images/logos/nebraska-logo.png" alt="Nebraska logo" class="team-logo nebraska-logo">
                        <div class="team-name">Nebraska</div>
                    </div>
                    
                    <div class="vs-section">
                        <span class="vs-text">${game.isHome || game.isNeutral ? 'VS' : '@'}</span>
                    </div>
                    
                    <div class="team opponent-team">
                        ${logoUrl ? 
                            `<img src="${logoUrl}" alt="${game.opponent} logo" class="team-logo opponent-logo" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                             <div class="team-logo team-initial" style="background-color: ${teamInfo.color}; display: none;">${teamInfo.initial}</div>` :
                            `<div class="team-logo team-initial" style="background-color: ${teamInfo.color};">${teamInfo.initial}</div>`
                        }
                        <div class="team-name">${game.opponent}</div>
                    </div>
                </div>
                
                <div class="game-venue">
                    <i class="location-icon">📍</i>
                    <span class="venue-name">${game.location}</span>
                </div>
                
                ${game.tvNetwork && game.tvNetwork !== 'TBD' ? 
                    `<div class="broadcast-info">
                        <i class="tv-icon">📺</i>
                        <span class="tv-network">${game.tvNetwork}</span>
                    </div>` : ''
                }
            </div>
        </div>
        `;
    }).join('');
    
    scheduleContainer.innerHTML = scheduleHTML;
    console.log('Schedule rendered with HTML length:', scheduleHTML.length);
}

// Render roster function  
function renderRoster(position = 'all') {
    console.log('renderRoster called with position:', position);
    
    const rosterContainer = document.getElementById('roster-container');
    if (!rosterContainer) {
        console.error('Roster container not found!');
        return;
    }
    
    // Filter players
    let filteredRoster = currentRosterData;
    if (position !== 'all') {
        filteredRoster = currentRosterData.filter(player => player.group === position);
    }
    
    console.log('Filtered roster:', filteredRoster.length);
    
    const rosterHTML = filteredRoster.map(player => `
        <div class="player-card">
            <div class="player-number">#${player.number}</div>
            <div class="player-info">
                <h3>${player.name}</h3>
                <p class="position">${player.position}</p>
                <p class="details">${player.height} | ${player.weight} | ${player.class}</p>
                <p class="hometown">${player.hometown}</p>
            </div>
        </div>
    `).join('');
    
    rosterContainer.innerHTML = rosterHTML;
    console.log('Roster rendered with HTML length:', rosterHTML.length);
}

// Initialize countdown timer
function initializeCountdown() {
    console.log('initializeCountdown called');
    
    const daysElement = document.getElementById('days');
    const hoursElement = document.getElementById('hours');
    const minutesElement = document.getElementById('minutes');
    const secondsElement = document.getElementById('seconds');
    const nextGameInfo = document.getElementById('next-game-info');
    
    if (!daysElement || !hoursElement || !minutesElement || !secondsElement) {
        console.error('Countdown elements not found!');
        console.log('Days:', daysElement, 'Hours:', hoursElement, 'Minutes:', minutesElement, 'Seconds:', secondsElement);
        return;
    }

    function updateCountdown() {
        const now = new Date().getTime();
        let nextGame = null;
        
        // Find next game
        for (let game of currentScheduleData) {
            // Parse the date more reliably for Safari
            const gameDate = new Date(game.date);
            if (isNaN(gameDate.getTime())) {
                console.warn('Invalid date:', game.date);
                continue;
            }
            
            // Set time if available
            let gameDateTime = gameDate.getTime();
            if (game.time && game.time !== 'TBD') {
                const timeStr = game.time.replace(' CT', '').replace(' ET', '');
                const [time, period] = timeStr.split(' ');
                if (time && period) {
                    let [hours, minutes] = time.split(':').map(Number);
                    if (period.toLowerCase() === 'pm' && hours !== 12) hours += 12;
                    if (period.toLowerCase() === 'am' && hours === 12) hours = 0;
                    
                    gameDate.setHours(hours, minutes || 0, 0, 0);
                    gameDateTime = gameDate.getTime();
                }
            }
            
            if (gameDateTime > now) {
                nextGame = { ...game, dateTime: gameDateTime };
                break;
            }
        }

        if (!nextGame) {
            daysElement.textContent = '00';
            hoursElement.textContent = '00';
            minutesElement.textContent = '00';
            secondsElement.textContent = '00';
            if (nextGameInfo) {
                nextGameInfo.textContent = 'Season Complete!';
            }
            return;
        }

        const distance = nextGame.dateTime - now;
        
        if (distance < 0) {
            daysElement.textContent = '00';
            hoursElement.textContent = '00';
            minutesElement.textContent = '00';
            secondsElement.textContent = '00';
            if (nextGameInfo) {
                nextGameInfo.textContent = 'Game Day!';
            }
            return;
        }
        
        const days = Math.floor(distance / (1000 * 60 * 60 * 24));
        const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((distance % (1000 * 60)) / 1000);

        daysElement.textContent = days.toString().padStart(2, '0');
        hoursElement.textContent = hours.toString().padStart(2, '0');
        minutesElement.textContent = minutes.toString().padStart(2, '0');
        secondsElement.textContent = seconds.toString().padStart(2, '0');
        
        if (nextGameInfo) {
            const convertedTime = convertTimeToTimezone(nextGame.time, currentTimezone);
            nextGameInfo.textContent = `vs ${nextGame.opponent} • ${nextGame.date.replace(', 2025', '')} • ${convertedTime}`;
        }
        
        console.log('Countdown updated:', days, 'days', hours, 'hours');
    }

    updateCountdown();
    setInterval(updateCountdown, 1000);
    console.log('Countdown timer started');
}

// Filter functions
function filterSchedule(filter) {
    console.log('filterSchedule called with:', filter);
    
    // Update button states
    const buttons = document.querySelectorAll('.schedule-controls .filter-btn');
    buttons.forEach(btn => btn.classList.remove('active'));
    
    const activeButton = Array.from(buttons).find(btn => btn.dataset.filter === filter);
    if (activeButton) {
        activeButton.classList.add('active');
    }
    
    renderSchedule(filter);
}

function filterRoster(position) {
    console.log('filterRoster called with:', position);
    
    // Update button states
    const buttons = document.querySelectorAll('.position-filter');
    buttons.forEach(btn => btn.classList.remove('active'));
    
    const activeButton = Array.from(buttons).find(btn => btn.dataset.position === position);
    if (activeButton) {
        activeButton.classList.add('active');
    }
    
    renderRoster(position);
}

// Make functions globally available
window.filterSchedule = filterSchedule;

// Initialize everything when DOM loads
document.addEventListener('DOMContentLoaded', async function() {
    console.log('DOM loaded - initializing site...');
    
    // Show loading states
    const scheduleContainer = document.getElementById('schedule-container');
    const rosterContainer = document.getElementById('roster-container');
    
    if (scheduleContainer) {
        scheduleContainer.innerHTML = '<div class="loading-message">Loading schedule data...</div>';
    }
    if (rosterContainer) {
        rosterContainer.innerHTML = '<div class="loading-message">Loading roster data...</div>';
    }
    
    // Initialize countdown with fallback data first
    initializeCountdown();
    
    // Try to load fresh API data
    try {
        console.log('Loading fresh data from APIs...');
        const [apiScheduleData, apiRosterData] = await Promise.all([
            fetchScheduleData(),
            fetchRosterData()
        ]);
        
        currentScheduleData = apiScheduleData;
        currentRosterData = apiRosterData;
        
        console.log('Successfully loaded API data - Schedule:', apiScheduleData.length, 'games, Roster:', apiRosterData.length, 'players');
        console.log('First schedule game location:', apiScheduleData[0]?.location);
        console.log('Schedule data sample:', apiScheduleData.slice(0, 2));
    } catch (error) {
        console.error('Failed to load API data, using minimal fallback:', error);
        // currentScheduleData and currentRosterData remain as fallback values
    }
    
    // Render components with whatever data we have
    renderSchedule();
    renderRoster();
    
    // Update countdown with final data
    initializeCountdown();
    
    // Set up event listeners
    const scheduleButtons = document.querySelectorAll('.schedule-controls .filter-btn');
    console.log('Found', scheduleButtons.length, 'schedule filter buttons');
    scheduleButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            const filter = e.target.dataset.filter;
            filterSchedule(filter);
        });
    });
    
    // Set up timezone selector
    const timezoneSelect = document.getElementById('timezone-select');
    if (timezoneSelect) {
        timezoneSelect.addEventListener('change', (e) => {
            currentTimezone = e.target.value;
            console.log('Timezone changed to:', currentTimezone);
            // Re-render the schedule with new timezone
            renderSchedule(currentScheduleFilter);
            // Update the countdown display
            initializeCountdown();
        });
    }
    
    const rosterButtons = document.querySelectorAll('.position-filter');
    console.log('Found', rosterButtons.length, 'roster filter buttons');
    rosterButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            const position = e.target.dataset.position;
            filterRoster(position);
        });
    });
    
    console.log('Site initialization complete!');
});

// Export for debugging
window.NebraskaFootball = {
    fallbackScheduleData,
    fallbackRosterData,
    currentScheduleData,
    currentRosterData,
    renderSchedule,
    renderRoster,
    initializeCountdown,
    filterSchedule,
    filterRoster,
    fetchRosterData,
    fetchScheduleData
};

console.log('Script loaded successfully!');
