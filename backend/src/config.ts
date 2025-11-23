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
    verifierApiBase: process.env.FDC_VERIFIER_API_BASE  || 'https://fdc-verifiers-testnet.flare.network',
    daLayerApiBase: process.env.COSTON2_DA_LAYER_URL || 'https://ctn2-data-availability.flare.network/api/v0/fdc',
    submitterWallet: process.env.FDC_SUBMITTER_WALLET, // If not set, will use insurer wallet
    roundDuration: 90,
  },
  server: {
    port: parseInt(process.env.PORT || '3000'),
    monitorInterval: parseInt(process.env.MONITOR_INTERVAL_MS || '120000'),
    autoSettle: process.env.AUTO_SETTLE_ENABLED === 'true', // If false, just store proofs for frontend
  },
  insurer: {
    walletLabel: process.env.INSURER_WALLET_LABEL || 'ethglobal-buenos-1',
    walletAddress: process.env.INSURER_WALLET_ADDRESS!,
    autoClaimEnabled: process.env.AUTO_CLAIM_ENABLED === 'true',
    checkInterval: parseInt(process.env.INSURER_CHECK_INTERVAL_MS || '30000'),
  },
  expiry: {
    autoExpireEnabled: process.env.AUTO_EXPIRE_ENABLED === 'true',
    walletAddress: process.env.EXPIRY_WALLET_ADDRESS || process.env.INSURER_WALLET_ADDRESS!, // Can use same as insurer
    checkInterval: parseInt(process.env.MONITOR_INTERVAL_MS || '120000'),
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
