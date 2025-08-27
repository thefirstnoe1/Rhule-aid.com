// Direct test of roster API
const { handleRosterRequest } = require('./src/index.js');

// Mock environment with cache
const mockEnv = {
  ROSTER_CACHE: {
    get: async (key) => null, // Start with empty cache
    put: async (key, value) => console.log(`Cache PUT: ${key}`)
  }
};

// Mock request
const mockRequest = {
  method: 'GET',
  url: 'http://localhost/api/roster'
};

async function testRoster() {
  console.log('🚀 Testing Roster API...');
  
  try {
    const response = await handleRosterRequest(mockRequest, mockEnv);
    const data = await response.json();
    
    console.log('✅ API Response Status:', response.status);
    console.log('📊 Response data:', {
      success: data.success,
      count: data.count,
      cached: data.cached,
      lastUpdated: data.lastUpdated
    });
    
    if (data.data && data.data.length > 0) {
      console.log('🎯 Sample players:');
      data.data.slice(0, 5).forEach(player => {
        console.log(`  #${player.number} ${player.name} - ${player.position} (${player.class})`);
      });
    } else {
      console.log('❌ No roster data returned');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testRoster();