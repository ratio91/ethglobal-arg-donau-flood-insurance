import { prepareFdcRequest, retrieveFdcProof, calculateRoundId } from './src/fdc';
import 'dotenv/config';

async function testFdcIntegration() {
  console.log('🧪 Testing FDC Integration');
  console.log('==========================\n');

  // Test with Korneuburg gauge
  const testGaugeId = 'ATKBG00001G000619415';

  try {
    console.log('📍 Testing gauge:', testGaugeId);
    console.log('🔗 FDC Base URL:', process.env.FDC_VERIFIER_API_BASE);
    console.log('🔑 API Key:', process.env.FDC_VERIFIER_API_KEY ? '✅ Set' : '❌ Not set');
    console.log();

    // Step 1: Prepare FDC request
    console.log('Step 1: Preparing FDC request...');
    const abiEncodedRequest = await prepareFdcRequest(testGaugeId);

    if (!abiEncodedRequest) {
      throw new Error('Failed to prepare FDC request');
    }

    console.log('✅ FDC request prepared successfully');
    console.log('📦 ABI Encoded Request:', abiEncodedRequest.substring(0, 66) + '...');
    console.log();

    // Step 2: Calculate round ID
    const timestamp = Math.floor(Date.now() / 1000);
    const roundId = calculateRoundId(timestamp);
    console.log('Step 2: Calculated round ID:', roundId);
    console.log('⏰ Current timestamp:', timestamp);
    console.log('⏱️  Next round in:', 90 - (timestamp % 90), 'seconds');
    console.log();

    // Step 3: Try to retrieve proof (will likely not be ready yet)
    console.log('Step 3: Attempting to retrieve proof...');
    console.log('⚠️  Note: Proof may not be ready yet (needs 90s voting round)');
    const proof = await retrieveFdcProof(roundId, abiEncodedRequest);

    if (proof) {
      console.log('✅ Proof retrieved!');
      console.log('📦 Proof structure:', JSON.stringify(proof, null, 2));
    } else {
      console.log('⏳ Proof not ready yet (expected - voting round in progress)');
    }

    console.log('\n✅ TEST COMPLETED!');
    console.log('\n📋 Summary:');
    console.log('   ✅ FDC request preparation: SUCCESS');
    console.log('   ✅ Round ID calculation: SUCCESS');
    console.log('   ⏳ Proof retrieval: Not ready (needs 90s wait)');

    process.exit(0);

  } catch (error: any) {
    console.error('\n❌ TEST FAILED!');
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

testFdcIntegration();
