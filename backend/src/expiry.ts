import { contractsApi } from './multibaas';
import { config } from './config';
import { getActivePolicies, getPolicy } from './multibaas';
import { Policy } from './types';

/**
 * Monitor active policies and expire those past their expiration timestamp
 */
export async function monitorAndExpirePolicies(): Promise<void> {
  console.log('⏰ Checking for expired policies...');

  try {
    // Get all active policies
    const activePolicyIds = await getActivePolicies();

    if (activePolicyIds.length === 0) {
      console.log('✅ No active policies to check for expiry');
      return;
    }

    console.log(`🔍 Checking ${activePolicyIds.length} active policies for expiration`);

    const now = Math.floor(Date.now() / 1000);
    const expiredPolicies: Array<{ policyId: number; policy: Policy }> = [];

    // Check each policy's expiration timestamp
    for (const policyId of activePolicyIds) {
      try {
        const policy = await getPolicy(policyId);

        if (!policy) {
          console.warn(`⚠️ Could not fetch policy ${policyId}`);
          continue;
        }

        // Check if policy has expired (convert bigint to number for comparison)
        const expirationTime = Number(policy.expirationTimestamp);
        if (now > expirationTime) {
          const expiryDate = new Date(expirationTime * 1000);
          const currentDate = new Date(now * 1000);

          console.log(`⏰ Policy ${policyId} EXPIRED!`);
          console.log(`   Gauge: ${policy.objectName} (${policy.objectID})`);
          console.log(`   Expiration: ${expiryDate.toISOString()}`);
          console.log(`   Current: ${currentDate.toISOString()}`);
          console.log(`   Coverage to return: ${policy.coverage}`);

          expiredPolicies.push({ policyId, policy });
        }
      } catch (error) {
        console.error(`❌ Error checking policy ${policyId}:`, error);
      }
    }

    if (expiredPolicies.length === 0) {
      console.log('✅ No expired policies found');
      return;
    }

    console.log(`\n📋 Found ${expiredPolicies.length} expired policies to process\n`);

    // Check if auto-expiry is enabled
    if (!config.expiry.autoExpireEnabled) {
      console.log('⚠️ AUTO_EXPIRE_ENABLED=false - skipping automatic expiry');
      console.log('   Expired policy IDs:', expiredPolicies.map(p => p.policyId));
      return;
    }

    // Expire each policy
    for (const { policyId, policy } of expiredPolicies) {
      await expirePolicyOnChain(policyId, policy);

      // Small delay between transactions to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    console.log('\n✅ Finished processing expired policies\n');

  } catch (error) {
    console.error('❌ Error in expiry monitor:', error);
  }
}

/**
 * Call expirePolicy function on-chain via MultiBaas
 */
async function expirePolicyOnChain(policyId: number, policy: Policy): Promise<void> {
  try {
    console.log(`🔄 Expiring policy ${policyId} on-chain...`);
    console.log(`   Insurer will receive: ${policy.coverage}`);

    const methodArgs = {
      args: [policyId.toString()],
      signer: config.expiry.walletAddress,  // Wallet address that will sign the transaction
      contractOverride: false,
      signAndSubmit: true,  // IMPORTANT: set to true to actually send TX!
    };

    const result = await contractsApi.callContractFunction(
      config.contract.address,
      config.contract.label,
      'expirePolicy',
      methodArgs
    );

    console.log('📄 Expire policy result:', result.data);

    const resultData = result.data.result as any;
    if (resultData.tx?.hash) {
      console.log(`✅ Policy ${policyId} expired successfully!`);
      console.log(`📝 Transaction hash: ${resultData.tx.hash}`);
      return;
    }

    if (resultData.output) {
      console.log(`✅ Policy ${policyId} expired (direct call)`);
      return;
    }

    console.warn(`⚠️ Unexpected response for policy ${policyId}`);

  } catch (error: any) {
    console.error(`❌ Failed to expire policy ${policyId}`);
    console.error(`   Error:`, error?.response?.data || error.message);
  }
}
