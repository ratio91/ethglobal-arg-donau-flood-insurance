import { Configuration, ContractsApi, ChainsApi, SignerWallet } from '@curvegrid/multibaas-sdk';
import axios from 'axios';
import { config } from './config';
import { Policy } from './types';

// Initialize MultiBaaS SDK
// BasePath is just /api/v0, chain is passed as parameter to API calls
const mbConfig = new Configuration({
  basePath: new URL('/api/v0', config.multibaas.url).toString(),
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

/**
 * Get signer wallet from MultiBaas
 */
export async function getSignerWallet(walletLabel: string): Promise<SignerWallet | null> {
  try {
    // For now, just create a signer wallet reference
    // MultiBaas will handle the actual wallet lookup when signing
    return {
      walletName: walletLabel,
    } as SignerWallet;
  } catch (error) {
    console.error(`❌ Failed to get signer wallet ${walletLabel}:`, error);
    return null;
  }
}

/**
 * Claim a policy as insurer using MultiBaas cloud wallet
 */
export async function claimPolicyAsInsurer(policyId: number, coverage: string, walletLabel: string): Promise<string | null> {
  try {
    console.log(`💰 Claiming policy ${policyId} as insurer with coverage ${coverage}...`);

    // Use wallet address from config for both from and signer
    const walletAddress = config.insurer.walletAddress;

    console.log(`🔍 DEBUG - walletAddress from config:`, walletAddress);
    console.log(`🔍 DEBUG - typeof walletAddress:`, typeof walletAddress);

    console.log(`📝 Request params:`, {
      contractAddress: config.contract.address,
      contractLabel: config.contract.label,
      function: 'claimPolicy',
      args: [policyId.toString()],
      value: coverage,
      from: walletAddress,
      signer: walletAddress,
    });

    const methodArgs = {
      args: [policyId.toString()],
      value: coverage,
      contractOverride: false,
      from: walletAddress, // Wallet address to send transaction from
      signer: walletAddress, // Wallet address that will sign the transaction
      signAndSubmit: true // set to true to actually send TX!
    };

    console.log(`🔍 DEBUG - methodArgs object:`, JSON.stringify(methodArgs, null, 2));

    const result = await contractsApi.callContractFunction(
      config.contract.address,
      config.contract.label,
      'claimPolicy',
      methodArgs
    );

    console.log('✅ Claim policy result:', JSON.stringify(result.data, null, 2));

    // Check if this is a transaction that needs signing
    const resultData = result.data.result as any;
    if (resultData.tx) {
      const txHash = resultData.tx.hash;
      console.log(`📝 Transaction hash: ${txHash}`);
      return txHash;
    }

    return 'success';
  } catch (error: any) {
    console.error(`❌ ========== CLAIM POLICY ${policyId} ERROR ========== `);
    console.error(`Error type: ${error?.constructor?.name}`);
    console.error(`Error message: ${error?.message}`);

    if (error?.response) {
      console.error(`Response status: ${error.response.status}`);
      console.error(`Response statusText: ${error.response.statusText}`);
      console.error(`Response data:`, JSON.stringify(error.response.data, null, 2));
      console.error(`Response headers:`, JSON.stringify(error.response.headers, null, 2));
    }

    if (error?.request) {
      console.error(`Request details:`, {
        method: error.request.method,
        path: error.request.path,
        host: error.request.host,
      });
    }

    console.error(`Full error object:`, JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
    console.error(`❌ ========== END ERROR ========== `);

    return null;
  }
}
