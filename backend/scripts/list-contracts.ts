import { Configuration, ContractsApi } from '@curvegrid/multibaas-sdk';
import dotenv from 'dotenv';

dotenv.config();

async function listContracts() {
  console.log('📋 Listing all contracts in MultiBaas...\n');

  const mbConfig = new Configuration({
    basePath: new URL('/api/v0', process.env.MULTIBAAS_URL!).toString(),
    accessToken: process.env.MULTIBAAS_API_KEY!,
  });

  const contractsApi = new ContractsApi(mbConfig);

  try {
    // List all contracts
    const response = await contractsApi.listContracts();

    console.log('📦 Full response:', JSON.stringify(response.data, null, 2));

    if (response.data.result && Array.isArray(response.data.result)) {
      const contracts = response.data.result;

      console.log(`\n✅ Found ${contracts.length} contracts:\n`);

      contracts.forEach((contract: any) => {
        console.log(`📝 Label: ${contract.label || 'N/A'}`);
        console.log(`   Address: ${contract.address || contract.addressLabel || 'N/A'}`);
        console.log(`   Versions: ${contract.versions?.length || 0}`);
        console.log('');
      });

      // Check if fdchub11 exists
      const fdcHub = contracts.find((c: any) => c.label === 'fdchub11');
      if (fdcHub) {
        console.log('✅ Found fdchub11 contract!');
        console.log(JSON.stringify(fdcHub, null, 2));
      } else {
        console.log('❌ fdchub11 contract NOT found in list');
      }
    } else {
      console.log('⚠️ Unexpected response format');
    }

  } catch (error: any) {
    console.error('❌ Error listing contracts:', error.message);
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Data:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

listContracts();
