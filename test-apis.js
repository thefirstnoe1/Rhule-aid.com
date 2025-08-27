#!/usr/bin/env node

// Test script to check if rankings and standings APIs are working
// This tests the scraper functions directly

const { scrapeAPPoll, scrapeCFPPoll, scrapeBigTenStandings } = require('./src/scrapers.js');

async function testAPPoll() {
  console.log('\n🏈 Testing AP Poll Rankings...');
  console.log('================================');
  try {
    const results = await scrapeAPPoll();
    if (results.length > 0) {
      console.log(`✅ Successfully scraped ${results.length} teams from AP Poll`);
      console.log('\nTop 5 teams:');
      results.slice(0, 5).forEach(team => {
        console.log(`${team.rank}. ${team.team} - ${team.points} points ${team.firstPlaceVotes ? `(${team.firstPlaceVotes} first-place votes)` : ''}`);
      });
    } else {
      console.log('❌ No AP Poll data found');
    }
  } catch (error) {
    console.error('❌ Error testing AP Poll:', error.message);
  }
}

async function testCFPPoll() {
  console.log('\n🏆 Testing CFP Poll Rankings...');
  console.log('================================');
  try {
    const results = await scrapeCFPPoll();
    if (results.length > 0) {
      console.log(`✅ Successfully scraped ${results.length} teams from CFP Poll`);
      console.log('\nTop 5 teams:');
      results.slice(0, 5).forEach(team => {
        console.log(`${team.rank}. ${team.team}`);
      });
    } else {
      console.log('❌ No CFP Poll data found');
    }
  } catch (error) {
    console.error('❌ Error testing CFP Poll:', error.message);
  }
}

async function testBigTenStandings() {
  console.log('\n🏟️  Testing Big Ten Standings...');
  console.log('==================================');
  try {
    const results = await scrapeBigTenStandings();
    if (results.length > 0) {
      console.log(`✅ Successfully scraped ${results.length} teams from Big Ten standings`);
      console.log('\nTop 5 teams:');
      results.slice(0, 5).forEach(team => {
        console.log(`${team.school}: ${team.confWins}-${team.confLosses} (conf), ${team.overallWins}-${team.overallLosses} (overall)`);
      });
    } else {
      console.log('❌ No Big Ten standings data found');
    }
  } catch (error) {
    console.error('❌ Error testing Big Ten standings:', error.message);
  }
}

async function testAPIs() {
  console.log('🚀 Testing Rankings and Standings APIs');
  console.log('======================================');
  
  await testAPPoll();
  await testCFPPoll();
  await testBigTenStandings();
  
  console.log('\n✨ API testing complete!');
}

// Run the tests
testAPIs().catch(console.error);