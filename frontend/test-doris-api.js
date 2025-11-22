// Test script to fetch and inspect DORIS API response
const DORIS_URL = 'https://opendata2.doris-info.at/doris/api/1.0/gauge/list?VIADONAU_PARTNER_KEY=opendata';

async function testDorisAPI() {
  console.log('🔍 Testing DORIS API...');
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
      console.log('📦 Number of gauges:', data.length);
      console.log('');

      if (data.length > 0) {
        console.log('🔍 First gauge object:');
        console.log(JSON.stringify(data[0], null, 2));
        console.log('');

        console.log('🔍 Available fields in first gauge:');
        console.log('Keys:', Object.keys(data[0]));
        console.log('');

        // Check for common field names
        const firstGauge = data[0];
        console.log('Field mapping:');
        console.log('  - objectID:', firstGauge.objectID || firstGauge.id || firstGauge.stationID || firstGauge.gauge_id || 'NOT FOUND');
        console.log('  - objectName:', firstGauge.objectName || firstGauge.name || firstGauge.stationName || firstGauge.gauge_name || 'NOT FOUND');
        console.log('  - riverName:', firstGauge.riverName || firstGauge.river || firstGauge.waterway || 'NOT FOUND');
        console.log('  - location:', firstGauge.location || firstGauge.place || firstGauge.city || 'NOT FOUND');
        console.log('');

        // Show first 3 gauges
        console.log('🔍 First 3 gauges:');
        data.slice(0, 3).forEach((gauge, idx) => {
          console.log(`\nGauge ${idx + 1}:`);
          console.log(JSON.stringify(gauge, null, 2));
        });
      }
    } else {
      console.log('⚠️  Data is not an array!');
      console.log('Data structure:', JSON.stringify(data, null, 2));
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
  }
}

testDorisAPI();
