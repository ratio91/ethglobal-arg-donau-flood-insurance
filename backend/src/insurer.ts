import { config } from './config';
import { getPolicy, getSignerWallet, claimPolicyAsInsurer, contractsApi } from './multibaas';
import { Policy } from './types';

/**
 * Get nextPolicyId from contract to know total number of policies
 */
async function getNextPolicyId(): Promise<number> {
  try {
    const result = await contractsApi.callContractFunction(
      config.contract.address,
      config.contract.label,
      'nextPolicyId',
      {
        args: [],
        contractOverride: false,
      }
    );
    return Number((result.data.result as any).output);
  } catch (error) {
    console.error('❌ Failed to get nextPolicyId:', error);
    return 0;
  }
}

/**
 * Get all unclaimed policies
 */
async function getUnclaimedPolicies(): Promise<{ policyId: number; policy: Policy }[]> {
  try {
    // Get total number of policies created
    const nextPolicyId = await getNextPolicyId();

    console.log(`🔍 Checking ALL policies (0 to ${nextPolicyId - 1}) for unclaimed ones...`);

    const unclaimedPolicies: { policyId: number; policy: Policy }[] = [];

    // Check each policy from 0 to nextPolicyId-1
    for (let policyId = 0; policyId < nextPolicyId; policyId++) {
      try {
        const policy = await getPolicy(policyId);

        if (policy && policy.status === 0) { // Status 0 = Unclaimed
          unclaimedPolicies.push({ policyId, policy });
          console.log(`📋 Found unclaimed policy ${policyId}:`, {
            objectName: policy.objectName,
            premium: policy.premium,
            coverage: policy.coverage,
            threshold: policy.waterLevelThreshold,
          });
        }
      } catch (error) {
        console.error(`Error checking policy ${policyId}:`, error);
      }
    }

    console.log(`✅ Found ${unclaimedPolicies.length} unclaimed policies`);
    return unclaimedPolicies;
  } catch (error) {
    console.error('❌ Failed to get unclaimed policies:', error);
    return [];
  }
}

/**
 * Check insurer wallet is accessible
 */
async function checkWallet(): Promise<boolean> {
  try {
    const wallet = await getSignerWallet(config.insurer.walletLabel);

    if (!wallet) {
      console.error('❌ Failed to get insurer wallet');
      return false;
    }

    console.log(`💰 Insurer wallet ready: ${config.insurer.walletLabel}`);
    return true;
  } catch (error) {
    console.error('❌ Failed to check wallet:', error);
    return false;
  }
}

/**
 * Main insurer loop - monitors and claims unclaimed policies
 */
export async function monitorAndClaimPolicies() {
  console.log('🏦 Starting insurer monitor...');

  // Check wallet first
  const walletOk = await checkWallet();
  if (!walletOk) {
    console.error('❌ Cannot start insurer monitor without wallet access');
    return;
  }

  console.log(`✅ Insurer ready to claim policies`);

  // Main monitoring loop
  setInterval(async () => {
    try {
      console.log('\n🔄 Checking for unclaimed policies...');

      // Get unclaimed policies
      const unclaimedPolicies = await getUnclaimedPolicies();

      if (unclaimedPolicies.length === 0) {
        console.log('✅ No unclaimed policies found');
        return;
      }

      // KISS: Claim ALL unclaimed policies
      for (const { policyId, policy } of unclaimedPolicies) {
        console.log(`\n💰 Attempting to claim policy ${policyId}...`);
        console.log(`   Coverage required: ${policy.coverage}`);
        console.log(`   Premium to receive: ${policy.premium}`);
        console.log(`   Gauge: ${policy.objectName} (${policy.objectID})`);
        console.log(`   Threshold: ${policy.waterLevelThreshold} cm`);

        // Claim the policy
        const txHash = await claimPolicyAsInsurer(
          policyId,
          policy.coverage.toString(),
          config.insurer.walletLabel
        );

        if (txHash) {
          console.log(`✅ Successfully claimed policy ${policyId}! TX: ${txHash}`);
        } else {
          console.log(`❌ Failed to claim policy ${policyId}`);
        }

        // Small delay between claims to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      console.log('\n✅ Finished processing unclaimed policies\n');
    } catch (error) {
      console.error('❌ Error in insurer monitor loop:', error);
    }
  }, config.insurer.checkInterval);

  console.log(`✅ Insurer monitor started (checking every ${config.insurer.checkInterval}ms)`);
}
