// Test script for new logo and weather APIs
console.log('🚀 Testing New APIs (Logo & Weather)');
console.log('====================================');

// Import the module
import('./src/index.js').then(async (module) => {
  const env = {
    WEATHER_API_KEY: 'test-key',
    WEATHER_CACHE: { 
      get: () => null, 
      put: () => Promise.resolve() 
    }
  };

  console.log('\n🖼️  Testing Logo API...');
  console.log('========================');
  
  try {
    // Test logo API
    const logoResponse = await module.default.fetch(
      new Request('http://localhost/api/logo?team=Nebraska'), 
      env
    );
    console.log('✅ Logo API Status:', logoResponse.status);
    console.log('Logo redirect location:', logoResponse.headers.get('Location'));
    
    // Test with another team
    const logoResponse2 = await module.default.fetch(
      new Request('http://localhost/api/logo?team=Ohio State'), 
      env
    );
    console.log('✅ Ohio State Logo Status:', logoResponse2.status);
    console.log('Ohio State redirect location:', logoResponse2.headers.get('Location'));
    
  } catch (error) {
    console.error('❌ Logo API Error:', error.message);
  }

  console.log('\n🌤️  Testing Weather API...');
  console.log('==========================');
  
  try {
    // Test weather API
    const weatherResponse = await module.default.fetch(
      new Request('http://localhost/api/weather'), 
      env
    );
    console.log('✅ Weather API Status:', weatherResponse.status);
    const weatherData = await weatherResponse.json();
    console.log('Weather for Lincoln, NE:');
    console.log(`- Temperature: ${weatherData.current.temperature}°F`);
    console.log(`- Conditions: ${weatherData.current.conditions}`);
    console.log(`- Wind: ${weatherData.current.windDirection} ${weatherData.current.windSpeed} mph`);
    
  } catch (error) {
    console.error('❌ Weather API Error:', error.message);
  }

  console.log('\n✨ New API testing complete!');
}).catch(error => {
  console.error('Module import error:', error.message);
});