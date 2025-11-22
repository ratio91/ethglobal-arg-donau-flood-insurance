// Test script to fetch and inspect DORIS water level API response
const DORIS_URL = 'https://opendata2.doris-info.at/doris/api/1.0/gauge/getStatus?VIADONAU_PARTNER_KEY=opendata';

async function testWaterLevelAPI() {
  console.log('🔍 Testing DORIS Water Level API...');
  console.log('URL:', DORIS_URL);
  console.log('');

  try {
    const response = await fetch(DORIS_URL);

    console.log('📊 Response Status:', response.status, response.statusText);
    console.log('📋 Content-Type:', response.headers.get('content-type'));
    console.log('');

    if (!response.ok) {
      console.error('❌ Failed to fetch:', response.statusText);
      const text = await response.text();
      console.error('Response body:', text);
      return;
    }

    const data = await response.json();

    console.log('✅ Successfully fetched data');
    console.log('');

    console.log('📦 Data type:', typeof data);
    console.log('📦 Is Array:', Array.isArray(data));

    if (Array.isArray(data)) {
      console.log('📦 Number of gauge readings:', data.length);
      console.log('');

      if (data.length > 0) {
        console.log('🔍 First gauge reading:');
        console.log(JSON.stringify(data[0], null, 2));
        console.log('');

        console.log('🔍 Available fields in first reading:');
        console.log('Keys:', Object.keys(data[0]));
        console.log('');

        // Show first 3 readings
        console.log('🔍 First 3 gauge readings:');
        data.slice(0, 3).forEach((reading, idx) => {
          console.log(`\nReading ${idx + 1}:`);
          console.log(JSON.stringify(reading, null, 2));
        });
      }
    } else {
      console.log('📦 Data structure:');
      console.log(JSON.stringify(data, null, 2));
      console.log('');

      if (data.gaugeStatusList) {
        console.log('📦 Number of readings:', data.gaugeStatusList.length);
        console.log('');
        console.log('🔍 First reading:');
        console.log(JSON.stringify(data.gaugeStatusList[0], null, 2));
        console.log('');
        console.log('Keys:', Object.keys(data.gaugeStatusList[0]));
      }
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
  }
}

testWaterLevelAPI();
