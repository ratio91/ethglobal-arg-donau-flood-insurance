import express from 'express';
import { config } from './config';
import { getActivePolicies, getPolicy, resolvePolicy } from './multibaas';
import { prepareFdcRequest, submitFdcRequest, retrieveFdcProof, calculateRoundId } from './fdc';
import { storage } from './storage';
import { WebhookEvent } from './types';
import { monitorAndExpirePolicies } from './expiry';

export const app = express();
app.use(express.json());

// Enable CORS for frontend
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  next();
});

/**
 * Health check endpoint
 */
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    config: {
      contract: config.contract.address,
      chainId: config.contract.chainId,
    },
  });
});

/**
 * Webhook endpoint for MultiBaaS events
 * MultiBaaS will POST here when contract events are emitted
 */
app.post('/webhook', async (req, res) => {
  console.log('\n📥 ========== WEBHOOK RECEIVED ==========');
  console.log('Raw body:', JSON.stringify(req.body, null, 2));

  try {
    const events: WebhookEvent[] = Array.isArray(req.body) ? req.body : [req.body];

    for (const event of events) {
      console.log(`\n🔔 Event Type: ${event.event}`);

      if (event.event === 'event.emitted') {
        const eventName = event.data?.eventName;
        const args = event.data?.args;

        console.log(`   Event Name: ${eventName}`);
        console.log(`   Args:`, args);

        // Trigger monitoring when new policies are created/claimed
        if (eventName === 'PolicyCreated' || eventName === 'PolicyClaimed') {
          console.log('   ⚡ Triggering policy monitoring...');
          // Wait a bit to ensure blockchain state is updated
          setTimeout(() => monitorAndSubmit(), 5000);
        }

        if (eventName === 'PolicySettled') {
          console.log('   🎉 Policy settled event detected!');
        }
      }
    }

    res.status(200).json({ received: true, processedEvents: events.length });
  } catch (error: any) {
    console.error('❌ Webhook processing error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Manual trigger endpoint for testing
 */
app.post('/trigger/monitor', async (req, res) => {
  console.log('\n🔧 Manual monitoring trigger received');
  try {
    await monitorAndSubmit();
    res.json({ success: true, message: 'Monitoring triggered' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Manual trigger for settlement check
 */
app.post('/trigger/settle', async (req, res) => {
  console.log('\n🔧 Manual settlement trigger received');
  try {
    await checkPendingAndSettle();
    res.json({ success: true, message: 'Settlement check triggered' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Manual trigger for expiry check
 */
app.post('/trigger/expire', async (req, res) => {
  console.log('\n🔧 Manual expiry check triggered');
  try {
    await monitorAndExpirePolicies();
    res.json({ success: true, message: 'Expiry check completed' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get all submissions (for debugging)
 */
app.get('/submissions', async (req, res) => {
  try {
    const all = await storage.getAllSubmissions();
    res.json({ total: all.length, submissions: all });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get proof for a specific policy (for frontend settlement)
 * IMPORTANT: Only returns hasProof=true if threshold was EXCEEDED
 */
app.get('/api/policy/:policyId/proof', async (req, res) => {
  try {
    const policyId = parseInt(req.params.policyId);
    const submission = await storage.getSubmissionByPolicyId(policyId);

    if (!submission || !submission.proof) {
      return res.json({ hasProof: false });
    }

    // Get policy details to check threshold
    const policy = await getPolicy(policyId);
    if (!policy) {
      return res.json({ hasProof: false });
    }

    // Check if water level exceeded threshold
    const waterLevel = submission.waterLevel || 0;
    const threshold = Number(policy.waterLevelThreshold);
    const thresholdExceeded = waterLevel > threshold;

    console.log(`📊 Policy ${policyId} threshold check:`);
    console.log(`   Water level: ${waterLevel} cm`);
    console.log(`   Threshold: ${threshold} cm`);
    console.log(`   Exceeded: ${thresholdExceeded}`);

    // Only return proof if threshold was exceeded
    if (!thresholdExceeded) {
      return res.json({
        hasProof: false,
        waterLevel,
        threshold,
        thresholdExceeded: false,
      });
    }

    res.json({
      hasProof: true,
      policyId,
      proof: submission.proof,
      waterLevel: submission.waterLevel,
      threshold,
      thresholdExceeded: true,
      roundId: submission.roundId,
      proofTimestamp: submission.proofTimestamp,
      measureDate: submission.timestamp,
    });
  } catch (error: any) {
    console.error(`Error fetching proof for policy ${req.params.policyId}:`, error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Debug endpoint to test FDC API connectivity
 */
app.get('/api/test/fdc', async (req, res) => {
  try {
    const objectID = req.query.objectID as string || 'ATKBG00001G000619415'; // Default to Korneuburg

    console.log('\n🧪 ========== TESTING FDC API ==========');
    console.log(`Testing with gauge: ${objectID}`);
    console.log(`USE_MOCK_FDC: ${process.env.USE_MOCK_FDC}`);
    console.log(`FDC_VERIFIER_API_BASE: ${process.env.FDC_VERIFIER_API_BASE}`);

    // Step 1: Test DORIS API
    console.log('\n1️⃣ Testing DORIS API...');
    const dorisResponse = await fetch(
      'https://opendata2.doris-info.at/doris/api/1.0/gauge/getStatus?VIADONAU_PARTNER_KEY=opendata'
    );
    const dorisOk = dorisResponse.ok;
    let dorisData = null;
    if (dorisOk) {
      const data = await dorisResponse.json();
      const gauge = data.gaugeStatusList.find((g: any) => g.currentMeasure.objectID === objectID);
      dorisData = gauge?.currentMeasure;
    }
    console.log(`   DORIS API: ${dorisOk ? '✅ OK' : '❌ FAILED'}`);
    if (dorisData) {
      console.log(`   Water level: ${dorisData.value} cm`);
    }

    // Step 2: Test FDC prepare request (temporarily disable mock)
    console.log('\n2️⃣ Testing FDC prepareRequest...');
    const originalMock = process.env.USE_MOCK_FDC;
    process.env.USE_MOCK_FDC = 'false'; // Temporarily disable mock

    const { prepareFdcRequest } = await import('./fdc');
    const abiEncodedRequest = await prepareFdcRequest(objectID);

    process.env.USE_MOCK_FDC = originalMock; // Restore

    const fdcPrepareOk = abiEncodedRequest !== null;
    console.log(`   FDC prepare: ${fdcPrepareOk ? '✅ OK' : '❌ FAILED'}`);

    res.json({
      success: true,
      tests: {
        doris: {
          ok: dorisOk,
          data: dorisData,
        },
        fdcPrepare: {
          ok: fdcPrepareOk,
          abiEncodedRequest: abiEncodedRequest?.substring(0, 100) + '...',
        },
      },
      config: {
        useMockFdc: process.env.USE_MOCK_FDC,
        fdcVerifierBase: process.env.FDC_VERIFIER_API_BASE,
      },
    });

  } catch (error: any) {
    console.error('❌ FDC test error:', error);
    res.status(500).json({ error: error.message, stack: error.stack });
  }
});

/**
 * Debug endpoint to view policy statuses and expiry information
 */
app.get('/api/policies/status', async (req, res) => {
  try {
    const activePolicyIds = await getActivePolicies();
    const now = Math.floor(Date.now() / 1000);

    const policies = [];
    for (const policyId of activePolicyIds) {
      const policy = await getPolicy(policyId);
      if (!policy) continue;

      // Convert bigint to number for comparison and display
      const expirationTime = Number(policy.expirationTimestamp);
      const isExpired = now > expirationTime;
      const timeRemaining = expirationTime - now;

      policies.push({
        policyId,
        objectName: policy.objectName,
        objectID: policy.objectID,
        status: policy.status,
        expirationTimestamp: expirationTime,
        expiryDate: new Date(expirationTime * 1000).toISOString(),
        isExpired,
        timeRemaining: isExpired ? 0 : timeRemaining,
        timeRemainingHours: isExpired ? 0 : Math.floor(timeRemaining / 3600),
        coverage: policy.coverage.toString(),
        premium: policy.premium.toString(),
        waterLevelThreshold: Number(policy.waterLevelThreshold),
      });
    }

    res.json({
      currentTime: now,
      currentDate: new Date(now * 1000).toISOString(),
      activePolicies: policies.length,
      expiredPolicies: policies.filter(p => p.isExpired).length,
      policies,
    });

  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Monitor active policies and submit FDC requests
 */
export async function monitorAndSubmit() {
  console.log('\n🔍 ========== MONITORING ACTIVE POLICIES ==========');

  try {
    const policyIds = await getActivePolicies();
    console.log(`📋 Found ${policyIds.length} active policies`);

    if (policyIds.length === 0) {
      console.log('   No active policies to monitor');
      return;
    }

    for (const policyId of policyIds) {
      console.log(`\n📄 Processing Policy #${policyId}`);

      // Check if we already have a pending submission for this policy
      const existing = await storage.getSubmissionByPolicyId(policyId);
      if (existing && existing.status === 'pending') {
        console.log(`   ⏭️  Already have pending submission (round ${existing.roundId})`);
        continue;
      }

      const policy = await getPolicy(policyId);
      if (!policy) {
        console.log('   ❌ Failed to fetch policy details');
        continue;
      }

      console.log(`   Name: ${policy.objectName}`);
      console.log(`   Gauge: ${policy.objectID}`);
      console.log(`   Threshold: ${policy.waterLevelThreshold} cm`);
      console.log(`   Status: ${policy.status} (1=Open)`);

      // Only process Open policies
      if (policy.status !== 1) {
        console.log(`   ⏭️  Policy status is not Open, skipping`);
        continue;
      }

      // Prepare FDC request
      console.log('   🔧 Preparing FDC request...');
      const abiEncodedRequest = await prepareFdcRequest(policy.objectID);

      if (!abiEncodedRequest) {
        console.log('   ❌ Failed to prepare FDC request');
        continue;
      }

      console.log('   ✅ FDC request prepared');

      // Submit FDC request ON-CHAIN
      console.log('   📡 Submitting FDC request on-chain...');
      const roundId = await submitFdcRequest(abiEncodedRequest);

      if (!roundId) {
        console.log('   ❌ Failed to submit FDC request on-chain');
        continue;
      }

      console.log('   ✅ FDC request submitted on-chain');

      // Save submission for later proof retrieval
      const timestamp = Math.floor(Date.now() / 1000);

      await storage.saveSubmission({
        policyId,
        objectID: policy.objectID, // Store gauge ID for later water level fetching
        abiEncodedRequest,
        roundId,
        timestamp,
        status: 'pending',
      });

      console.log(`   💾 Saved submission (round ${roundId})`);
      console.log(`   ⏰ Proof will be ready after: ${new Date((timestamp + 90) * 1000).toISOString()}`);
    }

    console.log('\n✅ Monitoring cycle complete');
  } catch (error: any) {
    console.error('\n❌ Error in monitorAndSubmit:', error.message);
    console.error(error.stack);
  }
}

/**
 * Check pending submissions and settle policies
 */
export async function checkPendingAndSettle() {
  console.log('\n⏳ ========== CHECKING PENDING SUBMISSIONS ==========');

  try {
    const pending = await storage.getPendingSubmissions();
    console.log(`📝 Found ${pending.length} pending submissions`);

    if (pending.length === 0) {
      console.log('   No pending submissions to process');
      return;
    }

    const now = Math.floor(Date.now() / 1000);

    for (const submission of pending) {
      const elapsed = now - submission.timestamp;
      console.log(`\n📦 Processing submission for Policy #${submission.policyId}`);
      console.log(`   Round ID: ${submission.roundId}`);
      console.log(`   Elapsed time: ${elapsed}s (need 90s)`);

      // Wait at least 90 seconds before retrieving proof
      if (elapsed < 90) {
        console.log(`   ⏰ Not ready yet (need ${90 - elapsed}s more)`);
        continue;
      }

      console.log('   🔍 Retrieving proof from Flare DA Layer...');

      // Retrieve proof from Flare DA Layer (pass objectID for mock mode)
      const proof = await retrieveFdcProof(submission.roundId, submission.abiEncodedRequest, submission.objectID);

      if (!proof) {
        console.log('   ❌ No proof available yet');
        // If it's been more than 5 minutes, mark as failed
        if (elapsed > 300) {
          console.log('   ⏰ Timeout - marking as failed');
          await storage.updateSubmissionStatus(submission.policyId, 'failed');
        }
        continue;
      }

      console.log('   ✅ Proof retrieved successfully!');

      // Extract water level from proof
      let waterLevel = 0;
      try {
        // Try multiple possible proof structures
        if (proof?.data?.responseBody?.abiEncodedData) {
          // Real FDC proof - would need ABI decoding
          console.log('   📦 FDC proof structure detected');
          waterLevel = 0; // TODO: Decode ABI data
        } else if (proof?.data?.dto?.value) {
          waterLevel = Number(proof.data.dto.value);
          console.log(`   📊 Water level from proof: ${waterLevel} cm`);
        } else if (proof?.dto?.value) {
          waterLevel = Number(proof.dto.value);
          console.log(`   📊 Water level from proof: ${waterLevel} cm`);
        }
      } catch (error) {
        console.error('   ⚠️  Could not extract water level from proof');
      }

      // Store proof for frontend to display
      await storage.updateSubmissionWithProof(submission.policyId, proof, waterLevel);

      // Only auto-settle if configured to do so
      if (config.server.autoSettle) {
        console.log('   🔄 Auto-settle enabled, submitting settlement transaction...');
        const txHash = await resolvePolicy(submission.policyId, proof);

        if (txHash) {
          console.log(`   🎉 Policy settled! Transaction: ${txHash}`);
          await storage.updateSubmissionStatus(submission.policyId, 'completed');
        } else {
          console.log('   ❌ Failed to settle policy');
          await storage.updateSubmissionStatus(submission.policyId, 'failed');
        }
      } else {
        console.log('   💾 Auto-settle disabled, proof stored for user settlement from frontend');
      }
    }

    console.log('\n✅ Settlement cycle complete');
  } catch (error: any) {
    console.error('\n❌ Error in checkPendingAndSettle:', error.message);
    console.error(error.stack);
  }
}
