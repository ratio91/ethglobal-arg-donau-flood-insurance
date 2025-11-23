import { config } from './config';
import { toHex } from './utils/hex';
import { nameToAddress } from '@flarenetwork/flare-periphery-contract-artifacts';
import { contractsApi } from './multibaas';

const VERIFIER_API = config.fdc.verifierApiBase;
const DA_LAYER_API = 'https://ctn2-data-availability.flare.network/api/v0/fdc';

/**
 * STEP 1: Prepare FDC request using Flare Verifier API
 * This validates and encodes the attestation request
 */
export async function prepareFdcRequest(objectID: string): Promise<string | null> {
  if (process.env.USE_MOCK_FDC === 'true') {
    console.log('⚠️  USE_MOCK_FDC=true - using mock');
    return '0x' + 'mock'.repeat(32); // Mock request bytes
  }

  try {
    console.log(`🔧 [STEP 1] Preparing FDC request for gauge: ${objectID}`);

    const attestationType = toHex('Web2Json');
    const sourceId = toHex('PublicWeb2');

    const url = `${VERIFIER_API}/verifier/web2/Web2Json/prepareRequest`;
    console.log('📡 Calling verifier:', url);

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

    const data = await response.json();
    console.log('📡 Verifier response:', data.status);

    if (!response.ok || data.status !== 'VALID') {
      console.error('❌ FDC prepare failed:', data);
      return null;
    }

    const abiEncodedRequest = data.response?.abiEncodedRequest;
    console.log('✅ [STEP 1] Request prepared, bytes:', abiEncodedRequest?.substring(0, 20) + '...');
    
    return abiEncodedRequest;
    
  } catch (error: any) {
    console.error('❌ Failed to prepare FDC request:', error.message);
    return null;
  }
}

/**
 * STEP 2: Submit FDC request ON-CHAIN to FdcHub contract
 * This is ON-CHAIN and COSTS GAS (uses funded backend wallet)
 * Returns round ID calculated from current timestamp
 */
export async function submitFdcRequest(abiEncodedRequest: string): Promise<number | null> {
  if (process.env.USE_MOCK_FDC === 'true') {
    const mockRoundId = Math.floor(Date.now() / 90000);
    console.log('⚠️  Mock submission, round ID:', mockRoundId);
    return mockRoundId;
  }

  try {
    console.log('📡 [STEP 2] Submitting FDC request ON-CHAIN to FdcHub...');
    console.log('   Request bytes:', abiEncodedRequest.substring(0, 20) + '...');

    // Get FdcHub contract address from Flare periphery artifacts
    const fdcHubAddress = nameToAddress('FdcHub', 'coston2');
    console.log('📍 FdcHub address:', fdcHubAddress);

    // Get wallet from config (same wallet used for claiming policies)
    const walletAddress = config.fdc.submitterWallet || config.insurer.walletAddress;
    console.log('💼 Using wallet:', walletAddress);

    // Submit to FdcHub contract via MultiBaas
    // This is the SAME pattern as claimPolicy!
    const result = await contractsApi.callContractFunction(
      fdcHubAddress,
      'fdchub11', // Label registered in MultiBaas
      'requestAttestation',
      {
        args: [abiEncodedRequest],
        from: walletAddress,
        signer: walletAddress,
        contractOverride: false,
        signAndSubmit: true, // Actually send the transaction!
      }
    );

    console.log('📄 FDC submission result:', result.data.message || 'success');

    const resultData = result.data.result as any;

    if (!resultData.tx?.hash) {
      console.error('❌ No transaction hash in result');
      console.error('   Result data:', JSON.stringify(resultData, null, 2));
      return null;
    }

    const txHash = resultData.tx.hash;
    console.log('📝 Transaction hash:', txHash);
    console.log('🔗 View on explorer:', `https://coston2-explorer.flare.network/tx/${txHash}`);

    // Calculate round ID from current timestamp
    // FdcHub emits events with the actual round ID, but for simplicity we calculate it
    const timestamp = Math.floor(Date.now() / 1000);
    const roundId = calculateRoundId(timestamp);

    console.log(`✅ [STEP 2] FDC request submitted on-chain!`);
    console.log(`   Round ID: ${roundId}`);
    console.log(`   Transaction: ${txHash}`);

    return roundId;

  } catch (error: any) {
    console.error('❌ Failed to submit FDC request on-chain');
    console.error('   Error:', error?.response?.data || error.message);

    if (error?.response?.data) {
      console.error('   Details:', JSON.stringify(error.response.data, null, 2));
    }

    return null;
  }
}

/**
 * STEP 3: Retrieve FDC proof from DA Layer
 * Call this after waiting 90+ seconds from submission
 */
export async function retrieveFdcProof(
  roundId: number, 
  abiEncodedRequest: string,
  objectID?: string
): Promise<any | null> {
  if (process.env.USE_MOCK_FDC === 'true') {
    console.log('⚠️  Returning mock proof with real water level');
    return createMockProof(roundId, objectID);
  }

  try {
    console.log(`🔍 [STEP 3] Retrieving FDC proof for round: ${roundId}`);

    // Convert request bytes to URL-safe format (remove 0x prefix)
    const requestBytes = abiEncodedRequest.startsWith('0x') 
      ? abiEncodedRequest.substring(2) 
      : abiEncodedRequest;

    const url = `${DA_LAYER_API}/get-attestation-proof/${roundId}/${requestBytes}`;
    console.log('📡 Calling DA Layer:', url.substring(0, 100) + '...');

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        console.log('⏳ Proof not ready yet for round', roundId);
      } else {
        const errorText = await response.text();
        console.error('❌ DA Layer error:', response.status, errorText);
      }
      return null;
    }

    const data = await response.json();
    console.log('📡 DA Layer proof response:', data.status || 'OK');

    // Check if proof is valid
    if (data.status && data.status !== 'VALID') {
      console.log('⏳ Proof not valid yet:', data.status);
      return null;
    }

    console.log('✅ [STEP 3] FDC proof retrieved successfully!');

    // Extract water level from proof
    if (data.data?.responseBody?.abiEncodedData) {
      try {
        // Decode the DTO to log water level
        console.log('📊 Proof contains ABI encoded data');
      } catch (e) {
        // Decoding optional, just for logging
      }
    }

    return data;
    
  } catch (error: any) {
    console.error('❌ Failed to retrieve FDC proof:', error.message);
    return null;
  }
}

/**
 * Complete FDC workflow: Prepare → Submit → Wait → Retrieve
 */
export async function completeFdcWorkflow(objectID: string): Promise<any | null> {
  console.log('\n╔══════════════════════════════════════════╗');
  console.log('║   🔄 Complete FDC Workflow              ║');
  console.log('╚══════════════════════════════════════════╝\n');

  try {
    // Step 1: Prepare
    const abiEncodedRequest = await prepareFdcRequest(objectID);
    if (!abiEncodedRequest) {
      throw new Error('Failed to prepare FDC request');
    }

    // Step 2: Submit
    const roundId = await submitFdcRequest(abiEncodedRequest);
    if (!roundId) {
      throw new Error('Failed to submit FDC request');
    }

    console.log('\n⏳ Waiting 90 seconds for voting round to complete...\n');
    await new Promise(resolve => setTimeout(resolve, 90000));

    // Step 3: Retrieve proof
    const proof = await retrieveFdcProof(roundId, abiEncodedRequest, objectID);
    if (!proof) {
      throw new Error('Failed to retrieve FDC proof');
    }

    console.log('\n✅ Complete FDC workflow successful!\n');
    
    return {
      abiEncodedRequest,
      roundId,
      proof,
    };
    
  } catch (error: any) {
    console.error('\n❌ FDC workflow failed:', error.message, '\n');
    return null;
  }
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
 * Calculate Flare voting round ID from timestamp
 * Flare voting rounds are 90 seconds
 */
export function calculateRoundId(timestamp: number): number {
  const ROUND_DURATION = 90; // seconds
  const roundId = Math.floor(timestamp / ROUND_DURATION);
  return roundId;
}

/**
 * Create mock FDC proof for testing/demo
 * Uses REAL water level data from DORIS API
 */
async function createMockProof(roundId: number, objectID?: string): Promise<any> {
  console.log('⚠️  Creating MOCK FDC proof with REAL water level data');

  let waterLevelData = null;

  // Fetch real water level from DORIS if objectID provided
  if (objectID) {
    try {
      const dorisResponse = await fetch(
        'https://opendata2.doris-info.at/doris/api/1.0/gauge/getStatus?VIADONAU_PARTNER_KEY=opendata'
      );

      if (dorisResponse.ok) {
        const dorisData = await dorisResponse.json();
        const gauge = dorisData.gaugeStatusList.find(
          (g: any) => g.currentMeasure.objectID === objectID
        );

        if (gauge) {
          waterLevelData = {
            objectID: gauge.currentMeasure.objectID,
            value: gauge.currentMeasure.value,
            measureDate: new Date(gauge.currentMeasure.measureDate).getTime(),
          };
          console.log(`   ✅ Real water level: ${waterLevelData.value} cm`);
        }
      }
    } catch (error) {
      console.error('   ⚠️  Failed to fetch real water level:', error);
    }
  }

  // Return mock proof structure
  return {
    status: 'VALID',
    data: {
      attestationType: toHex('Web2Json'),
      sourceId: toHex('PublicWeb2'),
      votingRound: roundId,
      lowestUsedTimestamp: Math.floor(Date.now() / 1000),
      responseBody: {
        merkleRoot: '0x' + '1234567890abcdef'.repeat(4), // Mock merkle root
        abiEncodedData: '0xmock', // Mock ABI encoded data
      },
    },
    signatures: {
      v: [28],
      r: ['0x' + '1234'.repeat(16)],
      s: ['0x' + '5678'.repeat(16)],
    },
    // Include real water level data
    waterLevel: waterLevelData?.value || 0,
    measureDate: waterLevelData?.measureDate || Date.now(),
  };
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
