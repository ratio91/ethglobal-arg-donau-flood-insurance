import { config } from './config';
import { DataTransportObject } from './types';
import { toHex } from './utils/hex';

const FDC_BASE = config.fdc.verifierApiBase;

/**
 * Prepare FDC request for DORIS water level data
 * This calls the Flare verifier API to prepare an attestation request
 */
export async function prepareFdcRequest(objectID: string): Promise<string | null> {
  // Check if mock mode is enabled
  if (process.env.USE_MOCK_FDC === 'true') {
    console.log('⚠️  USE_MOCK_FDC=true - using mock with REAL water level data');
    return createMockRequest(objectID);
  }

  try {
    console.log(`🔧 Preparing FDC request for gauge: ${objectID}`);

    const attestationType = toHex('Web2Json');
    const sourceId = toHex('PublicWeb2');

    const url = `${FDC_BASE}/verifier/web2/Web2Json/prepareRequest`;
    console.log('📡 Calling:', url);

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        attestationType,
        sourceId,
        requestBody: {
          url: 'https://opendata2.doris-info.at/doris/api/1.0/gauge/getStatus',
          httpMethod: 'GET',
          headers: {},
          queryParams: { VIADONAU_PARTNER_KEY: 'opendata' },
          body: {},
          postProcessJq: `.gaugeStatusList[] | select(.currentMeasure.objectID=="${objectID}") | {objectID: .currentMeasure.objectID, value: .currentMeasure.value, measureDate: .currentMeasure.measureDate}`,
          abiSignature: {
            components: [
              { internalType: 'string', name: 'objectID', type: 'string' },
              { internalType: 'int256', name: 'value', type: 'int256' },
              { internalType: 'int256', name: 'measureDate', type: 'int256' }
            ],
            name: 'dto',
            type: 'tuple'
          }
        }
      }),
    });

    const responseText = await response.text();
    console.log('📡 FDC Response status:', response.status);
    console.log('📡 FDC Response:', responseText.substring(0, 500));

    if (!response.ok) {
      console.error('❌ FDC prepare request failed');
      return null;
    }

    const data = JSON.parse(responseText);
    console.log('✅ FDC request prepared:', data.status);

    return data.response?.abiEncodedRequest || null;
  } catch (error: any) {
    console.error('❌ Failed to prepare FDC request:', error.message);
    return null;
  }
}

/**
 * Retrieve FDC proof from Flare DA Layer
 * This fetches the finalized proof after the voting round completes
 */
export async function retrieveFdcProof(roundId: number, abiEncodedRequest: string): Promise<any | null> {
  // Check if mock mode is enabled
  if (process.env.USE_MOCK_FDC === 'true') {
    console.log('⚠️  USE_MOCK_FDC=true - returning mock proof structure');
    return createMockProof(roundId);
  }

  try {
    console.log(`🔍 Retrieving FDC proof for round: ${roundId}`);

    const response = await fetch(`${FDC_BASE}/verifier/web2/Web2Json/proof/${roundId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ abiEncodedRequest }),
    });

    if (!response.ok) {
      console.log('⏳ Proof not ready yet for round', roundId);
      return null;
    }

    const data = await response.json();

    if (data.status !== 'VALID' || !data.response) {
      console.log('⏳ Proof not valid yet:', data.status);
      return null;
    }

    console.log('✅ FDC proof retrieved successfully');

    return data.response;
  } catch (error: any) {
    console.error('❌ Failed to retrieve FDC proof:', error.message);
    return null;
  }
}

/**
 * Calculate voting round ID from timestamp
 * Flare voting rounds are 90 seconds each
 */
export function calculateRoundId(timestamp: number): number {
  // Flare voting rounds are 90 seconds
  const ROUND_DURATION = 90;
  const roundId = Math.floor(timestamp / ROUND_DURATION);
  console.log(`🔢 Calculated round ID: ${roundId} for timestamp: ${timestamp}`);
  return roundId;
}

/**
 * Create mock FDC proof for hackathon demo
 * Structure mimics what Flare FDC would return
 */
function createMockProof(roundId: number): any {
  return {
    data: {
      attestationType: toHex('Web2Json'),
      sourceId: toHex('PublicWeb2'),
      votingRound: roundId,
      lowestUsedTimestamp: Math.floor(Date.now() / 1000),
      responseBody: {
        height: '0x' + 'a1b2c3d4'.repeat(16), // Mock merkle root
        data: '0xmock', // Mock ABI encoded data
      },
    },
    signatures: {
      v: [28],
      r: ['0x' + '1234'.repeat(16)],
      s: ['0x' + '5678'.repeat(16)],
    },
  };
}

/**
 * Create mock FDC request using REAL water level data from DORIS
 * This is a fallback for hackathon demo when FDC API is unavailable
 */
async function createMockRequest(objectID: string): Promise<string | null> {
  console.log('⚠️  Creating mock FDC request with REAL water level data');

  try {
    // Fetch real water level from DORIS
    const dorisResponse = await fetch(
      'https://opendata2.doris-info.at/doris/api/1.0/gauge/getStatus?VIADONAU_PARTNER_KEY=opendata'
    );

    if (!dorisResponse.ok) {
      throw new Error(`DORIS API error: ${dorisResponse.status}`);
    }

    const dorisData = await dorisResponse.json();
    const gauge = dorisData.gaugeStatusList.find(
      (g: any) => g.currentMeasure.objectID === objectID
    );

    if (!gauge) {
      throw new Error(`Gauge ${objectID} not found in DORIS data`);
    }

    console.log(`✅ Real water level from DORIS: ${gauge.currentMeasure.value} cm`);
    console.log(`✅ Measurement date: ${gauge.currentMeasure.measureDate}`);

    // Return mock ABI encoded request (not used in mock mode, but needed for storage)
    return '0x' + 'mock'.repeat(16);
  } catch (error: any) {
    console.error('❌ Failed to fetch real water level:', error.message);
    return null;
  }
}

/**
 * Test the DORIS API directly (for debugging)
 */
export async function testDorisApi(objectID: string): Promise<any | null> {
  try {
    console.log(`🧪 Testing DORIS API for gauge: ${objectID}`);

    const response = await fetch(
      'https://opendata2.doris-info.at/doris/api/1.0/gauge/getStatus?VIADONAU_PARTNER_KEY=opendata'
    );

    if (!response.ok) {
      console.error('❌ DORIS API request failed:', response.statusText);
      return null;
    }

    const data = await response.json();
    const gauge = data.gaugeStatusList.find((g: any) => g.currentMeasure.objectID === objectID);
    console.log('✅ DORIS API response for gauge:', gauge?.currentMeasure);

    return gauge;
  } catch (error: any) {
    console.error('❌ Failed to test DORIS API:', error.message);
    return null;
  }
}
