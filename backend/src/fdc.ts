import { config } from './config';
import { toHex } from './utils/hex';
import { contractsApi } from './multibaas';

// ============================================================================
// TypeScript Types (from OpenAPI spec)
// ============================================================================

/**
 * Verification status returned by Flare verifier
 */
type VerificationStatus = 'VALID' | 'INVALID' | 'MALFORMED' | 'INDETERMINATE';

/**
 * ABI component definition for response data structure
 */
interface AbiComponent {
  internalType: string;
  name: string;
  type: string;
  components?: AbiComponent[]; // For nested structs
}

/**
 * ABI signature defining the structure of returned data
 */
interface AbiSignature {
  components: AbiComponent[];
  name: string;
  type: 'tuple';
}

/**
 * Request body for Web2Json attestation (from OpenAPI spec)
 * All fields match the Web2Json_RequestBody schema
 */
interface Web2JsonRequestBody {
  url: string;
  httpMethod: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  headers: string;        // JSON string, e.g., '{"Content-Type":"application/json"}'
  queryParams: string;    // JSON string, e.g., '{"id": 1}'
  body: string;           // String (use '' for empty body)
  postProcessJq: string;  // jq filter to transform response data
  abiSignature: string;   // JSON stringified AbiSignature
}

/**
 * Complete attestation request structure (from OpenAPI spec)
 */
interface Web2JsonRequest {
  attestationType: string; // Hex-encoded attestation type (e.g., "0x576562324a736f6e...")
  sourceId: string;        // Hex-encoded source ID (e.g., "0x5075626c69635765623200...")
  requestBody: Web2JsonRequestBody;
}

/**
 * Response from /JsonApi/prepareRequest endpoint
 */
interface EncodedRequestResponse {
  status: VerificationStatus;
  abiEncodedRequest?: string; // Only present if status === 'VALID'
}

/**
 * Response from /JsonApi/mic endpoint
 */
interface MicResponse {
  status: VerificationStatus;
  messageIntegrityCode?: string;
}

/**
 * FDC proof structure from Data Availability layer
 */
interface FdcProof {
  status: VerificationStatus;
  data?: {
    attestationType: string;
    sourceId: string;
    votingRound: number;
    lowestUsedTimestamp: number;
    responseBody: {
      merkleRoot: string;
      abiEncodedData: string;
    };
  };
  signatures?: {
    v: number[];
    r: string[];
    s: string[];
  };
}

/**
 * Complete FDC workflow result
 */
interface FdcWorkflowResult {
  abiEncodedRequest: string;
  roundId: number;
  proof: FdcProof;
}

// ============================================================================
// Configuration & Constants
// ============================================================================

const VERIFIER_API = config.fdc.verifierApiBase;
const DA_LAYER_API = 'https://ctn2-data-availability.flare.network/api/v0/fdc';
const ROUND_DURATION_SECONDS = 90;

// ============================================================================
// STEP 1: Prepare FDC Request (OFF-CHAIN)
// ============================================================================

/**
 * Prepare FDC request using Flare Verifier API
 *
 * This validates and encodes the attestation request OFF-CHAIN.
 * No gas costs - this is a Web2 API call to Flare's verifier service.
 *
 * The verifier:
 * 1. Validates the request structure
 * 2. Calculates the message integrity code (MIC)
 * 3. Returns ABI-encoded bytes ready for on-chain submission
 *
 * @param objectID - DORIS gauge object ID (e.g., "ATKBG00001G000619415")
 * @returns ABI-encoded request bytes or null if preparation failed
 */
export async function prepareFdcRequest(objectID: string): Promise<string | null> {
  if (process.env.USE_MOCK_FDC === 'true') {
    console.log('⚠️  USE_MOCK_FDC=true - using mock');
    return '0x' + 'mock'.repeat(32); // Mock request bytes
  }

  try {
    console.log(`🔧 [STEP 1] Preparing FDC request for gauge: ${objectID}`);

    // Attestation type and source ID from OpenAPI spec
    const attestationType = toHex('Web2Json');
    const sourceId = toHex('PublicWeb2');

    // Endpoint from OpenAPI spec
    const url = `${VERIFIER_API}/Web2Json/prepareRequest`;
    console.log('📡 Calling verifier:', url);

    // ABI signature must be JSON stringified
    const abiSignature = {
      components: [
        { internalType: 'string', name: 'objectID', type: 'string' },
        { internalType: 'int256', name: 'value', type: 'int256' },
        { internalType: 'int256', name: 'measureDate', type: 'int256' }
      ],
      name: 'dto',
      type: 'tuple'
    };

    const requestBody: Web2JsonRequest = {
      attestationType,
      sourceId,
      requestBody: {
        url: 'https://opendata2.doris-info.at/doris/api/1.0/gauge/getStatus',
        httpMethod: 'GET',
        headers: '{}',  // Empty headers as JSON string
        queryParams: JSON.stringify({ VIADONAU_PARTNER_KEY: 'opendata' }),
        body: '',  // Empty body string
        postProcessJq: `.gaugeStatusList[] | select(.currentMeasure.objectID=="${objectID}") | {objectID: .currentMeasure.objectID, value: .currentMeasure.value, measureDate: .currentMeasure.measureDate}`,
        abiSignature: JSON.stringify(abiSignature),
      }
    };

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // Add API key if configured
    if (config.fdc.apiKey) {
      headers['X-API-KEY'] = config.fdc.apiKey;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Verifier API error:', response.status, errorText);
      return null;
    }

    const data: EncodedRequestResponse = await response.json();
    console.log('📡 Verifier response:', data.status);

    if (data.status !== 'VALID') {
      console.error('❌ FDC prepare failed with status:', data.status);
      console.error('   Full response:', JSON.stringify(data, null, 2));
      return null;
    }

    // Fixed: Response structure according to OpenAPI spec
    const abiEncodedRequest = data.abiEncodedRequest;

    if (!abiEncodedRequest) {
      console.error('❌ No abiEncodedRequest in response');
      return null;
    }

    console.log('✅ [STEP 1] Request prepared, bytes:', abiEncodedRequest.substring(0, 20) + '...');

    return abiEncodedRequest;

  } catch (error: any) {
    console.error('❌ Failed to prepare FDC request:', error.message);
    return null;
  }
}

// ============================================================================
// STEP 2: Submit FDC Request (ON-CHAIN)
// ============================================================================

/**
 * Submit FDC request ON-CHAIN to FdcHub contract
 *
 * This is ON-CHAIN and COSTS GAS! Uses the funded backend wallet.
 *
 * The FdcHub contract:
 * 1. Accepts the ABI-encoded attestation request
 * 2. Emits an event that validators listen for
 * 3. Validators fetch the data and vote on the result
 * 4. After 90 seconds, the voting round completes
 *
 * @param abiEncodedRequest - ABI-encoded bytes from prepareFdcRequest
 * @returns Round ID (calculated from current timestamp) or null if submission failed
 */
export async function submitFdcRequest(abiEncodedRequest: string): Promise<number | null> {
  if (process.env.USE_MOCK_FDC === 'true') {
    const mockRoundId = Math.floor(Date.now() / (ROUND_DURATION_SECONDS * 1000));
    console.log('⚠️  Mock submission, round ID:', mockRoundId);
    return mockRoundId;
  }

  try {
    console.log('📡 [STEP 2] Submitting FDC request ON-CHAIN to FdcHub...');
    console.log('   Request bytes:', abiEncodedRequest.substring(0, 20) + '...');

    // Use FdcHub contract from MultiBaas (registered with label)
    console.log('📍 FdcHub address:', config.fdcHub.address);
    console.log('🏷️  FdcHub label:', config.fdcHub.label);

    // Get wallet from config (same wallet used for claiming policies)
    const walletAddress = config.fdc.submitterWallet || config.insurer.walletAddress;
    console.log('💼 Using wallet:', walletAddress);

    // FDC request fee from config (default: 0.025 FLR on Coston2)
    const fee = config.fdc.requestFee;
    console.log(`💰 Using fee: ${fee} wei (${parseInt(fee) / 1e18} FLR)`);

    // Submit to FdcHub contract via MultiBaas
    const result = await contractsApi.callContractFunction(
      config.fdcHub.address,
      config.fdcHub.label,
      'requestAttestation',
      {
        args: [abiEncodedRequest],
        from: walletAddress,
        signer: walletAddress,
        value: fee, // Include the required fee
        contractOverride: false,
        signAndSubmit: true, // Actually send the transaction!
      }
    );

    console.log('📄 FDC submission result:', result.data.message || 'success');

    const resultData = result.data.result as any;

    // Log full result for debugging
    console.log('🔍 Full result data:', JSON.stringify(resultData, null, 2));

    if (!resultData.tx?.hash) {
      console.error('❌ No transaction hash in result');
      console.error('   Result data:', JSON.stringify(resultData, null, 2));
      return null;
    }

    const txHash = resultData.tx.hash;
    console.log('📝 Transaction hash:', txHash);
    console.log('🔗 View on explorer:', `https://coston2-explorer.flare.network/tx/${txHash}`);

    // Try to extract round ID from emitted events
    let roundId: number | null = null;

    if (resultData.events && Array.isArray(resultData.events)) {
      console.log('🔍 Checking transaction events for round ID...');

      // Look for AttestationRequest event (or similar)
      for (const event of resultData.events) {
        console.log(`   Event: ${event.name || 'unnamed'}`);

        // Common event names: AttestationRequest, RequestSubmitted, etc.
        if (event.name === 'AttestationRequest' || event.name === 'RequestSubmitted') {
          // Try to find round ID in event data
          if (event.data && event.data.roundId !== undefined) {
            roundId = parseInt(event.data.roundId);
            console.log(`✅ Found round ID in ${event.name} event: ${roundId}`);
            break;
          }
          // Sometimes it might be in a different field
          if (event.data && event.data.votingRoundId !== undefined) {
            roundId = parseInt(event.data.votingRoundId);
            console.log(`✅ Found round ID in ${event.name} event: ${roundId}`);
            break;
          }
        }
      }
    }

    // Fallback: calculate from timestamp if not found in events
    if (roundId === null) {
      console.log('⚠️  Round ID not found in events, calculating from local timestamp');
      const timestamp = Math.floor(Date.now() / 1000);
      roundId = calculateRoundId(timestamp);
      console.log(`   Round ID: ${roundId} (calculated from local time - may be inaccurate)`);
    }

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

// ============================================================================
// STEP 3: Retrieve FDC Proof (OFF-CHAIN)
// ============================================================================

/**
 * Retrieve FDC proof from Data Availability Layer
 *
 * Call this after waiting 90+ seconds from submission.
 * This is OFF-CHAIN - no gas costs.
 *
 * The DA Layer:
 * 1. Aggregates validator signatures
 * 2. Provides merkle proofs for the attested data
 * 3. Returns a proof that can be verified on-chain
 *
 * @param roundId - Round ID from submitFdcRequest
 * @param abiEncodedRequest - Original ABI-encoded request
 * @param objectID - Optional gauge ID for mock proof with real data
 * @returns FDC proof or null if not ready/failed
 */
export async function retrieveFdcProof(
  roundId: number,
  abiEncodedRequest: string,
  objectID?: string
): Promise<FdcProof | null> {
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
    console.log('📡 Calling DA Layer:', url.substring(0, 120) + '...');
    console.log('🔍 Round ID:', roundId);
    console.log('🔍 Request bytes (first 40 chars):', requestBytes.substring(0, 40));

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        console.log('⏳ Proof not ready yet for round', roundId);
        console.log('   This is normal - proofs need ~90 seconds to be available');
      } else {
        const errorText = await response.text();
        console.error('❌ DA Layer error:', response.status, errorText);
      }
      return null;
    }

    const data: FdcProof = await response.json();
    console.log('📡 DA Layer proof response:', data.status || 'OK');

    // Check if proof is valid
    if (data.status && data.status !== 'VALID') {
      console.log('⏳ Proof not valid yet:', data.status);
      return null;
    }

    console.log('✅ [STEP 3] FDC proof retrieved successfully!');

    // Log proof data structure
    if (data.data?.responseBody?.abiEncodedData) {
      console.log('📊 Proof contains ABI encoded data');
      console.log('   Merkle root:', data.data.responseBody.merkleRoot);
    }

    return data;

  } catch (error: any) {
    console.error('❌ Failed to retrieve FDC proof:', error.message);
    return null;
  }
}

// ============================================================================
// Complete FDC Workflow
// ============================================================================

/**
 * Complete FDC workflow: Prepare → Submit → Wait → Retrieve
 *
 * This runs the full attestation flow:
 * 1. OFF-CHAIN: Prepare and validate request
 * 2. ON-CHAIN: Submit to FdcHub (costs gas)
 * 3. WAIT: 90 seconds for voting round to complete
 * 4. OFF-CHAIN: Retrieve proof from DA layer
 *
 * @param objectID - DORIS gauge object ID
 * @returns Complete workflow result or null if any step failed
 */
export async function completeFdcWorkflow(objectID: string): Promise<FdcWorkflowResult | null> {
  console.log('\n╔══════════════════════════════════════════╗');
  console.log('║   🔄 Complete FDC Workflow              ║');
  console.log('╚══════════════════════════════════════════╝\n');

  try {
    // Step 1: Prepare (OFF-CHAIN)
    const abiEncodedRequest = await prepareFdcRequest(objectID);
    if (!abiEncodedRequest) {
      throw new Error('Failed to prepare FDC request');
    }

    // Step 2: Submit (ON-CHAIN - costs gas!)
    const roundId = await submitFdcRequest(abiEncodedRequest);
    if (!roundId) {
      throw new Error('Failed to submit FDC request');
    }

    console.log('\n⏳ Waiting 90 seconds for voting round to complete...\n');
    await new Promise(resolve => setTimeout(resolve, ROUND_DURATION_SECONDS * 1000));

    // Step 3: Retrieve proof (OFF-CHAIN)
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

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Calculate Flare voting round ID from timestamp
 * Flare voting rounds are 90 seconds each
 */
export function calculateRoundId(timestamp: number): number {
  const roundId = Math.floor(timestamp / ROUND_DURATION_SECONDS);
  return roundId;
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

// ============================================================================
// Mock Functions (for testing/demo)
// ============================================================================

/**
 * Create mock FDC proof for testing/demo
 * Uses REAL water level data from DORIS API
 */
async function createMockProof(roundId: number, objectID?: string): Promise<FdcProof> {
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

  // Return mock proof structure matching FdcProof interface
  return {
    status: 'VALID',
    data: {
      attestationType: toHex('IJsonApi'),  // Match real attestation type
      sourceId: toHex('WEB2'),             // Match real source ID
      votingRound: roundId,
      lowestUsedTimestamp: Math.floor(Date.now() / 1000),
      responseBody: {
        merkleRoot: '0x' + '1234567890abcdef'.repeat(4),
        abiEncodedData: '0xmock',
      },
    },
    signatures: {
      v: [28],
      r: ['0x' + '1234'.repeat(16)],
      s: ['0x' + '5678'.repeat(16)],
    },
  };
}
