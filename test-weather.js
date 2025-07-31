// Test script to verify weather conversion logic
const tempC = 20.6; // From NWS API
const tempF = (tempC * 9/5) + 32;

console.log('=== Temperature Conversion Test ===');
console.log('Celsius from NWS:', tempC);
console.log('Fahrenheit conversion:', tempF);
console.log('Rounded Fahrenheit:', Math.round(tempF));

console.log('\n=== Wind Speed Conversion Test ===');
// Test both null handling and conversion
const windSpeedNull = null;
const windSpeedKmh = 18; // Example value in km/h

function convertKmhToMph(kmh) {
  if (kmh === null) return null;
  return kmh * 0.621371;
}

console.log('Wind speed (null):', convertKmhToMph(windSpeedNull));
console.log('Wind speed (18 km/h):', convertKmhToMph(windSpeedKmh), 'mph');

console.log('\n=== Date/Month Test ===');
const now = new Date();
console.log('Current date:', now.toISOString());
console.log('Current month (0-based):', now.getMonth());
console.log('July is month 6 (0-based)');

// Test fallback logic
function getFallbackTemp() {
  const month = now.getMonth();
  let temp;
  
  if (month >= 5 && month <= 8) { // Jun-Sep (summer)
    temp = 75;
  } else if (month >= 9 && month <= 11) { // Oct-Dec (fall)  
    temp = 55;
  } else if (month >= 2 && month <= 4) { // Mar-May (spring)
    temp = 65;
  } else { // Dec-Feb (winter)
    temp = 35;
  }
  
  return temp;
}

console.log('Fallback temperature for current month:', getFallbackTemp());

console.log('\n=== Expected Results ===');
console.log('Should show 69°F from NWS API');
console.log('Should show 75°F from fallback (July)');
console.log('Current issue: showing 45°F (old fallback logic)');
