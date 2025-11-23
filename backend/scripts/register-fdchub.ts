#!/usr/bin/env tsx
/**
 * Register FdcHub contract in MultiBaas
 * This is a one-time setup step needed for on-chain FDC submission
 */

import { nameToAbi, nameToAddress } from '@flarenetwork/flare-periphery-contract-artifacts';
import { contractsApi } from '../src/multibaas';
import { config } from '../src/config';

async function registerFdcHub() {
  console.log('\n╔══════════════════════════════════════════╗');
  console.log('║  📝 Registering FdcHub in MultiBaas     ║');
  console.log('╚══════════════════════════════════════════╝\n');

  try {
    // Get FdcHub contract info from Flare periphery artifacts
    const network = 'coston2';
    const address = nameToAddress('FdcHub', network);
    const abi = nameToAbi('FdcHub', network);

    console.log('📍 FdcHub Address:', address);
    console.log('🌐 Network:', network);
    console.log('📄 ABI methods:', abi.filter((item: any) => item.type === 'function').map((item: any) => item.name).join(', '));

    // Check if already registered
    try {
      const existing = await contractsApi.getContract(address, 'FdcHub');
      console.log('\n✅ FdcHub already registered in MultiBaas!');
      console.log('   Address:', address);
      console.log('   Label: FdcHub');
      return;
    } catch (error: any) {
      // Contract not found, proceed with registration
      if (error?.response?.status === 404) {
        console.log('📝 FdcHub not found in MultiBaas, registering now...');
      } else {
        throw error;
      }
    }

    // Register the contract
    console.log('\n📤 Registering FdcHub contract...');
    await contractsApi.createContract({
      label: 'FdcHub',
      address: address,
      // @ts-ignore - ABI type mismatch but it works
      abi: abi,
    });

    console.log('\n✅ FdcHub registered successfully!');
    console.log('   Label: FdcHub');
    console.log('   Address:', address);
    console.log('   Network:', network);
    console.log('\n💡 You can now submit FDC requests on-chain using this contract!');

  } catch (error: any) {
    console.error('\n❌ Failed to register FdcHub');
    console.error('   Error:', error?.response?.data || error.message);

    if (error?.response?.data) {
      console.error('   Details:', JSON.stringify(error.response.data, null, 2));
    }

    throw error;
  }
}

// Get contract info only (for manual registration)
function printContractInfo() {
  console.log('\n╔══════════════════════════════════════════╗');
  console.log('║  📋 FdcHub Contract Information         ║');
  console.log('╚══════════════════════════════════════════╝\n');

  const network = 'coston2';
  const address = nameToAddress('FdcHub', network);
  const abi = nameToAbi('FdcHub', network);

  console.log('Address:', address);
  console.log('Network:', network);
  console.log('\nABI (copy this for manual registration):');
  console.log(JSON.stringify(abi, null, 2));
}

// Run the script
const mode = process.argv[2];

if (mode === '--info') {
  printContractInfo();
} else {
  registerFdcHub()
    .then(() => {
      console.log('\n✅ Setup complete!\n');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Setup failed!\n');
      process.exit(1);
    });
}
