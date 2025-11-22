import { Configuration, ContractsApi, ChainsApi } from '@curvegrid/multibaas-sdk';
import { config } from './config';
import { Policy } from './types';

// Initialize MultiBaaS SDK
// Important: Include the chain ID in the basePath
const mbConfig = new Configuration({
  basePath: new URL(`/api/v0/chains/${config.contract.chainId}`, config.multibaas.url).toString(),
  accessToken: config.multibaas.apiKey,
});

export const contractsApi = new ContractsApi(mbConfig);
export const chainsApi = new ChainsApi(mbConfig);

console.log('✅ MultiBaaS SDK initialized');

/**
 * Get all active policy IDs
 */
export async function getActivePolicies(): Promise<number[]> {
  try {
    const result = await contractsApi.callContractFunction(
      config.contract.address,
      config.contract.label,
      'getActivePolicies',
      {
        args: [],
        contractOverride: false,
      }
    );

    // Parse the output - returns array of policy IDs
    const output = (result.data.result as any).output;
    console.log('📋 Active policies response:', output);

    // Handle different response formats
    if (Array.isArray(output)) {
      return output.map(id => Number(id));
    }

    return [];
  } catch (error) {
    console.error('❌ Failed to get active policies:', error);
    return [];
  }
}

/**
 * Get policy details by ID
 */
export async function getPolicy(policyId: number): Promise<Policy | null> {
  try {
    const result = await contractsApi.callContractFunction(
      config.contract.address,
      config.contract.label,
      'getPolicy',
      {
        args: [policyId.toString()],
        contractOverride: false,
      }
    );

    // Parse the policy struct from output
    const output = (result.data.result as any).output;
    console.log(`📄 Policy ${policyId} response:`, output);

    // Convert to Policy interface
    if (output && typeof output === 'object') {
      return output as Policy;
    }

    return null;
  } catch (error) {
    console.error(`❌ Failed to get policy ${policyId}:`, error);
    return null;
  }
}

/**
 * Resolve policy with FDC proof
 * Note: This creates a transaction that needs to be signed
 */
export async function resolvePolicy(policyId: number, fdcProof: any): Promise<string | null> {
  try {
    console.log(`🔄 Resolving policy ${policyId} with FDC proof...`);

    const result = await contractsApi.callContractFunction(
      config.contract.address,
      config.contract.label,
      'resolvePolicy',
      {
        args: [policyId.toString(), JSON.stringify(fdcProof)],
        contractOverride: false,
        signer: config.contract.address, // Use contract address as signer
      }
    );

    console.log('✅ Resolve policy result:', result.data);

    // Check if this is a transaction that needs signing
    const resultData = result.data.result as any;
    if (resultData.tx) {
      const txHash = resultData.tx.hash;
      console.log(`📝 Transaction hash: ${txHash}`);
      return txHash;
    }

    // If it's a direct call result
    if (resultData.output) {
      console.log('✅ Policy resolved successfully');
      return 'success';
    }

    return null;
  } catch (error: any) {
    console.error(`❌ Failed to resolve policy ${policyId}:`, error?.response?.data || error.message);
    return null;
  }
}

/**
 * Get current chain status (block number, etc.)
 * Note: The chain is already specified in the Configuration basePath
 */
export async function getChainStatus(): Promise<any> {
  try {
    const result = await chainsApi.getChainStatus();
    return result.data.result;
  } catch (error) {
    console.error('❌ Failed to get chain status:', error);
    return null;
  }
}
