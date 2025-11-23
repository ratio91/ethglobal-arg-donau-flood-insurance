#!/usr/bin/env tsx
/**
 * Test FDC On-Chain Integration
 *
 * This script tests the complete FDC workflow:
 * 1. Prepare request (off-chain, free)
 * 2. Submit ON-CHAIN to FdcHub (costs gas)
 * 3. Wait for voting round
 * 4. Retrieve proof from DA Layer
 */

import { completeFdcWorkflow, prepareFdcRequest, submitFdcRequest, retrieveFdcProof } from '../src/fdc';
import { config } from '../src/config';
import 'dotenv/config';

// Test gauge: Korneuburg (near Vienna)
const TEST_GAUGE_ID = 'ATKBG00001G000619415';

async function testFdcOnChain() {
  console.log('\n╔══════════════════════════════════════════╗');
  console.log('║  🧪 Testing FDC On-Chain Integration   ║');
  console.log('╚══════════════════════════════════════════╝\n');

  console.log('Configuration:');
  console.log('  Test gauge:', TEST_GAUGE_ID);
  console.log('  USE_MOCK_FDC:', process.env.USE_MOCK_FDC || 'false');
  console.log('  FDC submitter wallet:', config.fdc.submitterWallet || config.insurer.walletAddress);
  console.log('  Verifier API:', config.fdc.verifierApiBase);
  console.log('  DA Layer API:', config.fdc.daLayerApiBase);
  console.log('\n');

  const mode = process.argv[2];

  if (mode === '--step-by-step') {
    await testStepByStep();
  } else {
    await testCompleteWorkflow();
  }
}

/**
 * Test the complete workflow (prepare → submit → wait → retrieve)
 */
async function testCompleteWorkflow() {
  console.log('🔄 Running COMPLETE workflow...\n');

  const result = await completeFdcWorkflow(TEST_GAUGE_ID);

  if (!result) {
    console.error('\n❌ FDC workflow FAILED\n');
    process.exit(1);
  }

  console.log('\n✅ SUCCESS! Complete FDC workflow finished!');
  console.log('\nResults:');
  console.log('- Round ID:', result.roundId);
  console.log('- Has proof:', !!result.proof);

  if (result.proof) {
    console.log('- Proof data:', JSON.stringify(result.proof, null, 2).substring(0, 200) + '...');
  }

  console.log('\n');
  process.exit(0);
}

/**
 * Test step-by-step (useful for debugging)
 */
async function testStepByStep() {
  console.log('🔄 Running STEP-BY-STEP workflow...\n');

  try {
    // Step 1: Prepare
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('STEP 1: Prepare FDC Request');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const abiEncodedRequest = await prepareFdcRequest(TEST_GAUGE_ID);

    if (!abiEncodedRequest) {
      throw new Error('Failed to prepare FDC request');
    }

    console.log('✅ Step 1 complete!');
    console.log('   Request bytes:', abiEncodedRequest.substring(0, 50) + '...\n');

    // Step 2: Submit ON-CHAIN
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('STEP 2: Submit ON-CHAIN to FdcHub');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const roundId = await submitFdcRequest(abiEncodedRequest);

    if (!roundId) {
      throw new Error('Failed to submit FDC request on-chain');
    }

    console.log('✅ Step 2 complete!');
    console.log('   Round ID:', roundId);
    console.log('   This transaction was submitted ON-CHAIN! 🎉\n');

    // Step 3: Wait
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('STEP 3: Wait for Voting Round');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    console.log('⏳ Waiting 90 seconds for Flare validators to reach consensus...');
    console.log('   (You can check the transaction on the explorer)\n');

    await new Promise(resolve => setTimeout(resolve, 90000));

    console.log('✅ Step 3 complete! (90 seconds elapsed)\n');

    // Step 4: Retrieve proof
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('STEP 4: Retrieve Proof from DA Layer');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    let proof = await retrieveFdcProof(roundId, abiEncodedRequest, TEST_GAUGE_ID);

    if (!proof) {
      console.log('⏳ Proof not ready yet, waiting another 30 seconds...\n');
      await new Promise(resolve => setTimeout(resolve, 30000));
      proof = await retrieveFdcProof(roundId, abiEncodedRequest, TEST_GAUGE_ID);
    }

    if (!proof) {
      console.warn('\n⚠️  Proof still not ready after 2 minutes');
      console.warn('   This can happen if the voting round is delayed');
      console.warn('   You can retry later with the round ID:', roundId);
      console.warn('\n   Retry command:');
      console.warn(`   npx tsx scripts/retry-proof.ts ${roundId} ${abiEncodedRequest}\n`);
      process.exit(0);
    }

    console.log('✅ Step 4 complete!');
    console.log('   Proof retrieved successfully!\n');

    // Summary
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ ALL STEPS COMPLETE!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    console.log('Summary:');
    console.log('  Round ID:', roundId);
    console.log('  Proof status:', proof.status || 'VALID');
    console.log('  Proof data:', proof.data ? 'Retrieved' : 'null');
    console.log('\n');

    process.exit(0);

  } catch (error: any) {
    console.error('\n❌ Test failed:', error.message);
    console.error('   Stack:', error.stack);
    console.error('\n');
    process.exit(1);
  }
}

// Run the test
testFdcOnChain().catch((error) => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
