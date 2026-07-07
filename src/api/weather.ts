// Weather API for Cloudflare Worker
export async function handleWeatherRequest(request: Request, env: any): Promise<Response> {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(request.url);
    const location = url.searchParams.get('location') || 'Lincoln, NE';
    const hourly = url.searchParams.get('hourly') === 'true';
    const gameTime = url.searchParams.get('gameTime'); // Optional game time for proximity detection
    const source = url.searchParams.get('source');
    const useTomorrowAPI = source === 'tomorrow';
    
    // Determine if we should use high-accuracy APIs (within 120 hours of game)
    let useHighAccuracyAPI = false;
    if (gameTime) {
      const gameDateTime = new Date(gameTime);
      const now = new Date();
      const hoursUntilGame = (gameDateTime.getTime() - now.getTime()) / (1000 * 60 * 60);
      useHighAccuracyAPI = hoursUntilGame <= 120 && hoursUntilGame > 0;
      console.log(`Game in ${hoursUntilGame.toFixed(1)} hours, using high-accuracy API: ${useHighAccuracyAPI}`);
    }
    
    // Check cache first - separate cache for hourly vs daily
    const cacheKey = `weather_${location.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${hourly ? 'hourly' : 'daily'}_${useTomorrowAPI ? 'tomorrow' : useHighAccuracyAPI ? 'precise' : 'standard'}`;
    const cached = await env.WEATHER_CACHE?.get(cacheKey);
    
    if (cached) {
      return new Response(cached, {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get weather data with appropriate API priority
    const weatherData = await getWeatherForLocation(location, env, hourly, useHighAccuracyAPI, useTomorrowAPI);
    
    // Cache for 30 minutes for high-accuracy, 2 hours for standard
    const cacheTTL = useTomorrowAPI || useHighAccuracyAPI ? 1800 : 7200;
    if (env.WEATHER_CACHE) {
      await env.WEATHER_CACHE.put(cacheKey, JSON.stringify(weatherData), { expirationTtl: cacheTTL });
    }
    
    return new Response(JSON.stringify(weatherData), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Weather API error:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to fetch weather data'
    }), {
      status: 502,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

async function getWeatherForLocation(location: string, env: any, hourly: boolean = false, useHighAccuracyAPI: boolean = false, useTomorrowAPI: boolean = false) {
  console.log('Getting weather for location:', location, 'hourly:', hourly, 'high-accuracy:', useHighAccuracyAPI, 'tomorrow:', useTomorrowAPI);
  
  if (useTomorrowAPI) {
    if (!env.TOMORROW_API_KEY) {
      throw new Error('Tomorrow.io API key is not configured');
    }

    console.log('Trying Tomorrow.io API for requested weather source');
    return await getTomorrowWeatherData(location, env.TOMORROW_API_KEY, hourly);
  }
  
  // For games within 120 hours, prefer Tomorrow.io API if available
  if (useHighAccuracyAPI && env.TOMORROW_API_KEY) {
    try {
      console.log('Trying Tomorrow.io API for high-accuracy forecast');
      return await getTomorrowWeatherData(location, env.TOMORROW_API_KEY, hourly);
    } catch (error) {
      console.error('Tomorrow.io API failed:', error);
      // Fall through to other APIs
    }
  }
  
  // If OpenWeather API key is available, use it
  if (env.OPENWEATHER_API_KEY || env.WEATHER_API_KEY) {
    try {
      console.log('Trying OpenWeather API');
      const apiKey = env.OPENWEATHER_API_KEY || env.WEATHER_API_KEY;
      return await getOpenWeatherData(location, apiKey, hourly);
    } catch (error) {
      console.error('OpenWeather API failed:', error);
      // Fall through to NWS
    }
  }
  
  // Use National Weather Service (free, US only) for Lincoln/Nebraska
  if (location.includes('NE') || location.includes('Nebraska') || location.includes('Lincoln')) {
    try {
      console.log('Trying NWS API for Lincoln, NE');
      return await getNWSWeatherData(hourly);
    } catch (error) {
      console.error('NWS API failed:', error);
      // Fall through to error if no live source succeeds.
    }
  }
  
  throw new Error(`No live weather source available for ${location}`);
}

async function getTomorrowWeatherData(location: string, apiKey: string, hourly: boolean = false) {
  try {
    // For Nebraska games, use Lincoln coordinates
    const lat = location.includes('Lincoln') || location.includes('NE') || location.includes('Nebraska') ? 40.8136 : null;
    const lon = location.includes('Lincoln') || location.includes('NE') || location.includes('Nebraska') ? -96.7026 : null;
    
    if (!lat || !lon) {
      throw new Error('Tomorrow.io API requires coordinates - location not supported');
    }
    
    // Get current weather and forecast
    const forecastUrl = `https://api.tomorrow.io/v4/timelines?location=${lat},${lon}&fields=temperature,weatherCode,precipitationProbability,windSpeed,windDirection,humidity&timesteps=${hourly ? '1h' : '1d'}&units=imperial&apikey=${apiKey}`;
    
    const response = await fetch(forecastUrl);
    const data = await response.json() as any;
    
    if (!response.ok) {
      throw new Error(`Tomorrow.io API error: ${data.message || response.statusText}`);
    }
    
    const timeline = data.data.timelines[0];
    if (!timeline || !timeline.intervals) {
      throw new Error('Invalid Tomorrow.io API response structure');
    }
    
    const current = timeline.intervals[0].values;
    
    const response_data: any = {
      success: true,
      location: 'Lincoln, NE',
      current: {
        temperature: Math.round(current.temperature),
        temperatureUnit: 'F',
        conditions: getWeatherDescription(current.weatherCode),
        humidity: Math.round(current.humidity),
        windSpeed: Math.round(current.windSpeed),
        windDirection: getWindDirection(current.windDirection),
        lastUpdated: new Date().toISOString()
      }
    };
    
    if (hourly) {
      // Return 48 hours of hourly data
      response_data.forecast = timeline.intervals.slice(0, 48).map((interval: any) => {
        const date = new Date(interval.startTime);
        return {
          name: date.toLocaleDateString('en-US', { 
            weekday: 'short', 
            month: 'short', 
            day: 'numeric',
            timeZone: 'America/Chicago'
          }),
          time: date.toLocaleTimeString('en-US', { 
            hour: 'numeric', 
            hour12: true,
            timeZone: 'America/Chicago'
          }),
          datetime: interval.startTime,
          temperature: Math.round(interval.values.temperature),
          temperatureUnit: 'F',
          shortForecast: getWeatherDescription(interval.values.weatherCode),
          precipitationProbability: Math.round(interval.values.precipitationProbability || 0),
          isGameDay: false // Will be set by frontend logic
        };
      });
    } else {
      // Return daily forecast
      response_data.forecast = timeline.intervals.slice(0, 7).map((interval: any) => {
        const date = new Date(interval.startTime);
        return {
          name: date.toLocaleDateString('en-US', { 
            weekday: 'short', 
            month: 'short', 
            day: 'numeric',
            timeZone: 'America/Chicago'
          }),
          temperature: Math.round(interval.values.temperature),
          temperatureUnit: 'F',
          shortForecast: getWeatherDescription(interval.values.weatherCode),
          precipitationProbability: Math.round(interval.values.precipitationProbability || 0),
          isGameDay: false // Will be set by frontend logic
        };
      });
    }
    
    return response_data;
  } catch (error) {
    console.error('Tomorrow.io API error:', error);
    throw error;
  }
}

function getWeatherDescription(weatherCode: number): string {
  // Tomorrow.io weather codes to descriptions
  const weatherCodes: { [key: number]: string } = {
    0: 'Unknown',
    1000: 'Clear',
    1001: 'Cloudy',
    1100: 'Mostly Clear',
    1101: 'Partly Cloudy',
    1102: 'Mostly Cloudy',
    2000: 'Fog',
    2100: 'Light Fog',
    3000: 'Light Wind',
    3001: 'Wind',
    3002: 'Strong Wind',
    4000: 'Drizzle',
    4001: 'Rain',
    4200: 'Light Rain',
    4201: 'Heavy Rain',
    5000: 'Snow',
    5001: 'Flurries',
    5100: 'Light Snow',
    5101: 'Heavy Snow',
    6000: 'Freezing Drizzle',
    6001: 'Freezing Rain',
    6200: 'Light Freezing Rain',
    6201: 'Heavy Freezing Rain',
    7000: 'Ice Pellets',
    7101: 'Heavy Ice Pellets',
    7102: 'Light Ice Pellets',
    8000: 'Thunderstorm'
  };
  
  return weatherCodes[weatherCode] || 'Unknown';
}

async function getOpenWeatherData(location: string, apiKey: string, hourly: boolean = false) {
  try {
    // Get current weather
    const currentResponse = await fetch(
      `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(location)}&appid=${apiKey}&units=imperial`
    );
    const currentData = await currentResponse.json() as any;
    
    if (!currentResponse.ok) {
      throw new Error(`OpenWeather API error: ${currentData.message}`);
    }
    
    // Get forecast data - use hourly endpoint when requested
    let forecastData: any;
    if (hourly) {
      // Use 5-day forecast which includes 3-hour intervals
      const forecastResponse = await fetch(
        `https://api.openweathermap.org/data/2.5/forecast?q=${encodeURIComponent(location)}&appid=${apiKey}&units=imperial`
      );
      forecastData = await forecastResponse.json() as any;
    } else {
      // Use daily forecast
      const forecastResponse = await fetch(
        `https://api.openweathermap.org/data/2.5/forecast?q=${encodeURIComponent(location)}&appid=${apiKey}&units=imperial`
      );
      forecastData = await forecastResponse.json() as any;
    }
    
    // Format response
    const response: any = {
      success: true,
      location: `${currentData.name}, ${currentData.sys.country}`,
      current: {
        temperature: Math.round(currentData.main.temp),
        temperatureUnit: 'F',
        conditions: currentData.weather[0].description,
        humidity: currentData.main.humidity,
        windSpeed: Math.round(currentData.wind.speed),
        windDirection: getWindDirection(currentData.wind.deg),
        lastUpdated: new Date().toISOString()
      }
    };

    if (hourly) {
      // Return 48 hours of 3-hour intervals (16 periods)
      response.forecast = forecastData.list.slice(0, 16).map((item: any) => {
        const date = new Date(item.dt * 1000);
        return {
          name: date.toLocaleDateString('en-US', { 
            weekday: 'short', 
            month: 'short', 
            day: 'numeric',
            timeZone: 'America/Chicago'
          }),
          time: date.toLocaleTimeString('en-US', { 
            hour: 'numeric', 
            hour12: true,
            timeZone: 'America/Chicago'
          }),
          datetime: date.toISOString(),
          temperature: Math.round(item.main.temp),
          temperatureUnit: 'F',
          shortForecast: item.weather[0].description,
          precipitationProbability: Math.round((item.pop || 0) * 100),
          isGameDay: false // Will be set by frontend logic
        };
      });
    } else {
      // Return daily forecast (every 8th item = 24 hours apart)
      response.forecast = forecastData.list.slice(0, 35).filter((_: any, index: number) => index % 8 === 0).map((item: any) => {
        const date = new Date(item.dt * 1000);
        return {
          name: date.toLocaleDateString('en-US', { 
            weekday: 'short', 
            month: 'short', 
            day: 'numeric',
            timeZone: 'America/Chicago'
          }),
          temperature: Math.round(item.main.temp),
          temperatureUnit: 'F',
          shortForecast: item.weather[0].description,
          precipitationProbability: Math.round((item.pop || 0) * 100),
          isGameDay: false // Will be set by frontend logic
        };
      });
    }
    
    return response;
  } catch (error) {
    console.error('OpenWeather error:', error);
    throw error;
  }
}

async function getNWSWeatherData(hourly: boolean = false) {
  try {
    // Lincoln, NE coordinates
    const lat = 40.8136;
    const lon = -96.7026;
    
    // Get current weather from NWS
    const gridResponse = await fetch(`https://api.weather.gov/points/${lat},${lon}`);
    const gridData = await gridResponse.json() as any;
    
    const forecastResponse = await fetch(gridData.properties.forecast);
    const forecastData = await forecastResponse.json() as any;
    
    const currentResponse = await fetch(gridData.properties.forecastHourly);
    const currentData = await currentResponse.json() as any;
    
    const current = currentData.properties.periods[0];
    
    const response: any = {
      success: true,
      location: 'Lincoln, NE',
      current: {
        temperature: current.temperature,
        temperatureUnit: current.temperatureUnit,
        conditions: current.shortForecast,
        humidity: 'N/A', // NWS doesn't always provide humidity
        windSpeed: parseInt(current.windSpeed) || 0,
        windDirection: current.windDirection || 'N/A',
        lastUpdated: new Date().toISOString()
      }
    };

    if (hourly) {
      // Return 48 hours of hourly data
      response.forecast = currentData.properties.periods.slice(0, 48).map((period: any) => ({
        name: new Date(period.startTime).toLocaleDateString('en-US', { 
          weekday: 'short', 
          month: 'short', 
          day: 'numeric',
          timeZone: 'America/Chicago' 
        }),
        time: new Date(period.startTime).toLocaleTimeString('en-US', { 
          hour: 'numeric', 
          hour12: true, 
          timeZone: 'America/Chicago' 
        }),
        datetime: period.startTime,
        temperature: period.temperature,
        temperatureUnit: period.temperatureUnit,
        shortForecast: period.shortForecast,
        precipitationProbability: 0, // NWS hourly doesn't include precipitation probability
        isGameDay: false // Will be set by frontend logic
      }));
    } else {
      // Return daily forecast
      response.forecast = forecastData.properties.periods.slice(0, 7).map((period: any) => ({
        name: new Date(period.startTime).toLocaleDateString('en-US', { 
          weekday: 'short', 
          month: 'short', 
          day: 'numeric',
          timeZone: 'America/Chicago' 
        }),
        temperature: period.temperature,
        temperatureUnit: period.temperatureUnit,
        shortForecast: period.shortForecast,
        precipitationProbability: 0, // NWS daily may not include precipitation probability
        isGameDay: false // Will be set by frontend logic
      }));
    }
    
    return response;
  } catch (error) {
    console.error('NWS error:', error);
    throw error;
  }
}

function getWindDirection(degrees: number): string {
  if (!degrees) return 'N/A';
  
  const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  const index = Math.round(degrees / 22.5) % 16;
  return directions[index] || 'N/A';
}
