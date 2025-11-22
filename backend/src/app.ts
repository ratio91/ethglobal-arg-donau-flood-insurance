import express from 'express';
import { config } from './config';
import { getActivePolicies, getPolicy, resolvePolicy } from './multibaas';
import { prepareFdcRequest, retrieveFdcProof, calculateRoundId } from './fdc';
import { storage } from './storage';
import { WebhookEvent } from './types';

export const app = express();
app.use(express.json());

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

      // Calculate round ID and save submission
      const timestamp = Math.floor(Date.now() / 1000);
      const roundId = calculateRoundId(timestamp);

      await storage.saveSubmission({
        policyId,
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

      // Retrieve proof from Flare DA Layer
      const proof = await retrieveFdcProof(submission.roundId, submission.abiEncodedRequest);

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

      // Submit settlement transaction via MultiBaaS
      console.log('   🔄 Submitting settlement transaction...');
      const txHash = await resolvePolicy(submission.policyId, proof);

      if (txHash) {
        console.log(`   🎉 Policy settled! Transaction: ${txHash}`);
        await storage.updateSubmissionStatus(submission.policyId, 'completed');
      } else {
        console.log('   ❌ Failed to settle policy');
        await storage.updateSubmissionStatus(submission.policyId, 'failed');
      }
    }

    console.log('\n✅ Settlement cycle complete');
  } catch (error: any) {
    console.error('\n❌ Error in checkPendingAndSettle:', error.message);
    console.error(error.stack);
  }
}
