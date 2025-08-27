#!/usr/bin/env node

// Test script to check if roster scraper is working
// This tests the scraper function directly by importing the TypeScript compiled version

console.log('🚀 Testing Roster Scraper');
console.log('=========================');

// Since we need to test the TypeScript function, let's make a simple fetch test
async function testRosterScraping() {
  try {
    console.log('📡 Fetching roster page...');
    const response = await fetch('https://huskers.com/sports/football/roster?sort=jersey_number', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const html = await response.text();
    console.log(`✅ Successfully fetched page (${html.length} characters)`);
    
    // Debug: look for different possible section markers
    console.log('🔍 Searching for roster section markers...');
    
    const possibleMarkers = [
      '# Jersey Number',
      'Jersey Number',
      'Football 2025 Roster',
      'ViewCardListTable',
      'Print Football Roster'
    ];
    
    let rosterStartIndex = -1;
    let foundMarker = '';
    
    for (const marker of possibleMarkers) {
      const index = html.indexOf(marker);
      if (index !== -1) {
        rosterStartIndex = index;
        foundMarker = marker;
        console.log(`✅ Found marker "${marker}" at position ${index}`);
        break;
      } else {
        console.log(`❌ Marker "${marker}" not found`);
      }
    }
    
    if (rosterStartIndex === -1) {
      console.log('🔍 Searching for player patterns in full HTML...');
      // Try to find some common player name patterns
      const sampleRegex = /(Dylan Raiola|Ceyair Wright|Emmett Johnson)/g;
      const sampleMatches = html.match(sampleRegex);
      if (sampleMatches) {
        console.log(`✅ Found sample players: ${sampleMatches.join(', ')}`);
        // Use a broader search
        rosterStartIndex = 0;
      } else {
        console.log('❌ No known players found in HTML');
        return;
      }
    }
    
    const rosterEndIndex = html.indexOf('Football Coaching Staff', rosterStartIndex);
    console.log(`📍 Using start: ${rosterStartIndex} (${foundMarker}), end: ${rosterEndIndex}`);
    
    if (rosterStartIndex === -1) {
      console.warn('❌ Could not find roster section boundaries');
      return;
    }
    
    console.log('✅ Found roster section boundaries');
    const rosterSection = html.substring(rosterStartIndex, rosterEndIndex);
    console.log(`📊 Roster section length: ${rosterSection.length} characters`);
    
    // Show a sample of the roster section to understand structure
    console.log('\n📝 Sample content from roster section:');
    console.log(rosterSection.substring(0, 1000));
    console.log('\n...\n');
    console.log(rosterSection.substring(1000, 2000));
    
    // Test the regex pattern
    const playerRegex = /(\d+)([A-Za-z\s\.\-']+?)((?:Quarterback|Running Back|Wide Receiver|Tight End|Offensive Lineman|Defensive Back|Defensive Lineman|Linebacker|Place Kicker|Punter|Long Snapper))(\d+-\d+)(\d+\s*lbs?)((?:Senior|Junior|Sophomore|Freshman|Redshirt Freshman))([^A-Z]*?)([A-Z][A-Za-z\s\.\-,]+?)(?:HS|High|Academy|Prep|College|CC)/g;
    
    const players = [];
    let match;
    let matchCount = 0;
    
    while ((match = playerRegex.exec(rosterSection)) !== null && players.length < 150) {
      matchCount++;
      const [, numberStr, name, position, height, weight, classYear, , hometown] = match;
      
      const number = parseInt(numberStr?.trim() || '0') || 0;
      const cleanName = name?.trim().replace(/\s+/g, ' ') || '';
      const cleanPosition = position?.trim() || '';
      const cleanHeight = height?.trim() || '';
      const cleanWeight = weight?.trim().replace(/\s*lbs?\s*/i, '') || '';
      const cleanClass = classYear?.trim() || '';
      const cleanHometown = hometown?.trim().replace(/[,\s]+$/, '') || '';
      
      if (cleanName && number > 0 && cleanPosition) {
        const player = {
          number,
          name: cleanName,
          position: cleanPosition,
          class: cleanClass,
          height: cleanHeight,
          weight: cleanWeight,
          hometown: cleanHometown
        };
        
        players.push(player);
        
        // Show first few matches for debugging
        if (players.length <= 5) {
          console.log(`🏈 Player ${players.length}: #${number} ${cleanName} (${cleanPosition})`);
        }
      }
    }
    
    console.log(`📈 Total regex matches: ${matchCount}`);
    console.log(`✅ Successfully parsed ${players.length} players`);
    
    if (players.length > 0) {
      console.log('\n🏆 Sample players:');
      players.slice(0, 10).forEach(player => {
        console.log(`  #${player.number} ${player.name} - ${player.position} (${player.class})`);
      });
    }
    
    // Try fallback pattern if main didn't work well
    if (players.length < 10) {
      console.log('\n🔄 Trying fallback pattern...');
      const simplePlayerRegex = /(\d+)([A-Za-z\s\.\-']+?)(Quarterback|Running Back|Wide Receiver|Tight End|Offensive Lineman|Defensive Back|Defensive Lineman|Linebacker|Place Kicker|Punter|Long Snapper)/g;
      
      const simplePlayers = [];
      let simpleMatch;
      
      while ((simpleMatch = simplePlayerRegex.exec(rosterSection)) !== null && simplePlayers.length < 150) {
        const [, numberStr, name, position] = simpleMatch;
        
        const number = parseInt(numberStr?.trim() || '0') || 0;
        const cleanName = name?.trim().replace(/\s+/g, ' ') || '';
        const cleanPosition = position?.trim() || '';
        
        if (cleanName && number > 0 && cleanPosition) {
          simplePlayers.push({
            number,
            name: cleanName,
            position: cleanPosition
          });
          
          if (simplePlayers.length <= 5) {
            console.log(`🏈 Fallback Player ${simplePlayers.length}: #${number} ${cleanName} (${cleanPosition})`);
          }
        }
      }
      
      console.log(`✅ Fallback parsed ${simplePlayers.length} players`);
    }
    
  } catch (error) {
    console.error('❌ Error testing roster scraper:', error.message);
  }
}

// Run the test
testRosterScraping().catch(console.error);