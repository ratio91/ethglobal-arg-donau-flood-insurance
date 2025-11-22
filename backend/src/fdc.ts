import { config } from './config';
import { DataTransportObject } from './types';

const FDC_BASE = config.fdc.verifierApiBase;

/**
 * Prepare FDC request for DORIS water level data
 * This calls the Flare verifier API to prepare an attestation request
 */
export async function prepareFdcRequest(objectID: string): Promise<string | null> {
  try {
    console.log(`🔧 Preparing FDC request for gauge: ${objectID}`);

    const response = await fetch(`${FDC_BASE}/Web2Json/prepareRequest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: `https://hydro.oesterreich.gv.at/api/station/${objectID}/messdaten/waterlevel/now`,
        httpMethod: 'GET',
        headers: '{}',
        queryParams: '{}',
        body: '{}',
        postProcessJq: '{objectID: .objectID, value: .value, measureDate: .measureDate}',
        abiSignature: "{'components':[{'internalType':'string','name':'objectID','type':'string'},{'internalType':'int256','name':'value','type':'int256'},{'internalType':'int256','name':'measureDate','type':'int256'}],'name':'dto','type':'tuple'}",
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('❌ FDC prepare request failed:', error);
      return null;
    }

    const data = await response.json();
    console.log('✅ FDC request prepared successfully');
    console.log('📦 Encoded request length:', data.abiEncodedRequest?.length || 0);

    return data.abiEncodedRequest;
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
  try {
    console.log(`🔍 Retrieving FDC proof for round: ${roundId}`);

    const response = await fetch(`${FDC_BASE}/Web2Json/proof/${roundId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ abiEncodedRequest }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('❌ FDC proof retrieval failed:', error);
      return null;
    }

    const data = await response.json();

    if (!data.proof) {
      console.log('⏳ Proof not ready yet for round', roundId);
      return null;
    }

    console.log('✅ FDC proof retrieved successfully');
    console.log('📦 Proof data:', JSON.stringify(data.proof, null, 2));

    return data.proof;
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
 * Test the DORIS API directly (for debugging)
 */
export async function testDorisApi(objectID: string): Promise<any | null> {
  try {
    console.log(`🧪 Testing DORIS API for gauge: ${objectID}`);

    const response = await fetch(
      `https://hydro.oesterreich.gv.at/api/station/${objectID}/messdaten/waterlevel/now`
    );

    if (!response.ok) {
      console.error('❌ DORIS API request failed:', response.statusText);
      return null;
    }

    const data = await response.json();
    console.log('✅ DORIS API response:', data);

    return data;
  } catch (error: any) {
    console.error('❌ Failed to test DORIS API:', error.message);
    return null;
  }
}
