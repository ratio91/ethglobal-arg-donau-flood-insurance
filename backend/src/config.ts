import dotenv from 'dotenv';
dotenv.config();

export const config = {
  multibaas: {
    url: process.env.MULTIBAAS_URL!,
    apiKey: process.env.MULTIBAAS_API_KEY!,
    chainLabel: 'ethereum', // MultiBaas always uses 'ethereum' in URL path
  },
  contract: {
    label: process.env.CONTRACT_LABEL || 'water-level-policy',
    address: process.env.CONTRACT_ADDRESS!,
    chainId: parseInt(process.env.CHAIN_ID || '114'), // Actual chain ID for RPC
  },
  fdc: {
    verifierApiBase: process.env.FDC_VERIFIER_API_BASE || 'https://fdc-verification.flare.network/verifier',
  },
  server: {
    port: parseInt(process.env.PORT || '3000'),
    monitorInterval: parseInt(process.env.MONITOR_INTERVAL_MS || '120000'),
  },
  insurer: {
    walletLabel: process.env.INSURER_WALLET_LABEL || 'ethglobal-buenos-1',
    walletAddress: process.env.INSURER_WALLET_ADDRESS!,
    autoClaimEnabled: process.env.AUTO_CLAIM_ENABLED === 'true',
    checkInterval: parseInt(process.env.INSURER_CHECK_INTERVAL_MS || '30000'),
  },
};

// Validate required environment variables
const requiredEnvVars = [
  'MULTIBAAS_URL',
  'MULTIBAAS_API_KEY',
  'CONTRACT_ADDRESS',
  'INSURER_WALLET_ADDRESS',
];

for (const varName of requiredEnvVars) {
  if (!process.env[varName]) {
    throw new Error(`Missing required environment variable: ${varName}`);
  }
}

console.log('✅ Configuration loaded successfully');
console.log('📍 MultiBaaS URL:', config.multibaas.url);
console.log('📝 Contract Label:', config.contract.label);
console.log('📍 Contract Address:', config.contract.address);
console.log('🔗 Chain ID:', config.contract.chainId);
