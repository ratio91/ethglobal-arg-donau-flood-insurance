# FDC On-Chain Integration - Setup Guide

## 🎯 What Was Fixed

The previous implementation was **submitting FDC requests to an off-chain API** instead of **on-chain to the FdcHub contract**. This has been fixed!

### Before (WRONG ❌)
```
Prepare Request → Submit to DA Layer API → Retrieve Proof
     ↓ FREE            ↓ FREE (but wrong!)       ↓ FREE
```

### After (CORRECT ✅)
```
Prepare Request → Submit ON-CHAIN (FdcHub) → Wait 90s → Retrieve Proof
     ↓ FREE           ↓ COSTS GAS (blockchain)    ↓ FREE
```

## 📋 Prerequisites

1. ✅ Backend wallet funded with FLR (should already be done)
2. ✅ MultiBaas configured and running
3. ✅ `@flarenetwork/flare-periphery-contract-artifacts` installed
4. 📝 FdcHub contract registered in MultiBaas (see Step 1 below)

## 🚀 Setup Steps

### Step 1: Register FdcHub in MultiBaas (ONE-TIME SETUP)

**FdcHub contract details for Coston2:**
- **Address:** `0x52308001b46cB6b1d0E978A79e71D03996d891E6`
- **Network:** Coston2 Testnet
- **Label:** `FdcHub` (use this exact label in your code)

**How to register in MultiBaas UI:**

1. **Go to your MultiBaas deployment** → Contracts section
2. **Click "Add Contract"**
3. **Fill in the contract details:**
   - **Label:** `FdcHub` (important: must match the code!)
   - **Address:** `0x52308001b46cB6b1d0E978A79e71D03996d891E6`
   - **Network/Chain:** Select your Coston2 network
   - **ABI:** See below ↓

4. **Get the FdcHub ABI:**

You have two options:

**Option A: Get ABI from your installed package**
```bash
cd backend
node -e "const {nameToAbi} = require('@flarenetwork/flare-periphery-contract-artifacts'); console.log(JSON.stringify(nameToAbi('FdcHub', 'coston2'), null, 2))" > fdchub-abi.json
# Then copy the contents of fdchub-abi.json and paste into MultiBaas
```

**Option B: Get ABI from Flare Docs**
- Visit: https://dev.flare.network/fdc/reference/contracts
- Find FdcHub ABI for Coston2
- Copy and paste into MultiBaas

5. **Click "Save" or "Create Contract"**

**Verification:**
After registration, you should see FdcHub in your MultiBaas contracts list. The backend will now be able to call `requestAttestation()` on it.

### Step 2: Configure Environment Variables

Update your `.env` file (or create one from `.env.example`):

```bash
# Required
MULTIBAAS_URL=https://your-deployment.multibaas.com
MULTIBAAS_API_KEY=your-api-key
CONTRACT_ADDRESS=0x9fd9f4DeD5691B67E55D35E7f1789c75e760249F
INSURER_WALLET_ADDRESS=0xYourWalletAddress

# FDC Configuration
USE_MOCK_FDC=false  # Set to false for REAL on-chain submission
FDC_VERIFIER_API_BASE=https://fdc-verifiers-testnet.flare.network
FDC_SUBMITTER_WALLET=0xYourWalletAddress  # Optional, defaults to INSURER_WALLET_ADDRESS
```

**Important:**
- `FDC_SUBMITTER_WALLET` defaults to `INSURER_WALLET_ADDRESS` if not set
- This wallet needs FLR balance for gas (same wallet used for claiming policies)
- Set `USE_MOCK_FDC=true` to test without on-chain submission

### Step 3: Install Dependencies

Make sure the Flare periphery artifacts package is installed:

```bash
cd backend
npm install
```

This should install `@flarenetwork/flare-periphery-contract-artifacts` which is needed for getting the FdcHub address.

### Step 4: Test the Integration

**Option A: Quick Test (Complete Workflow)**

```bash
npm run fdc:test
```

This runs the complete FDC workflow:
1. Prepare request (off-chain)
2. Submit ON-CHAIN to FdcHub
3. Wait 90 seconds
4. Retrieve proof from DA Layer

**Option B: Step-by-Step Test (Detailed)**

```bash
npm run fdc:test:steps
```

This shows detailed output for each step and is useful for debugging.

### Step 5: Verify On-Chain Submission

After running the test, you should see:

```
📡 [STEP 2] Submitting FDC request ON-CHAIN to FdcHub...
📍 FdcHub address: 0x...
💼 Using wallet: 0x...
📝 Transaction hash: 0x...
🔗 View on explorer: https://coston2-explorer.flare.network/tx/0x...
✅ [STEP 2] FDC request submitted on-chain!
   Round ID: 12345678
   Transaction: 0x...
```

**Verify on Coston2 Explorer:**
1. Click the explorer link or go to https://coston2-explorer.flare.network
2. Search for the transaction hash
3. You should see:
   - Transaction to FdcHub contract
   - Function: `requestAttestation`
   - Status: Success ✅

## 🔧 How It Works

### Code Changes

1. **Import FdcHub artifacts** (`backend/src/fdc.ts:3-4`):
   ```typescript
   import { nameToAddress } from '@flarenetwork/flare-periphery-contract-artifacts';
   import { contractsApi } from './multibaas';
   ```

2. **Submit ON-CHAIN** (`backend/src/fdc.ts:78-147`):
   ```typescript
   export async function submitFdcRequest(abiEncodedRequest: string): Promise<number | null> {
     const fdcHubAddress = nameToAddress('FdcHub', 'coston2');
     const walletAddress = config.fdc.submitterWallet || config.insurer.walletAddress;

     const result = await contractsApi.callContractFunction(
       fdcHubAddress,
       'FdcHub',
       'requestAttestation',
       {
         args: [abiEncodedRequest],
         from: walletAddress,
         signer: walletAddress,
         signAndSubmit: true, // Actually send the transaction!
       }
     );

     const txHash = resultData.tx.hash;
     const roundId = calculateRoundId(timestamp);
     return roundId;
   }
   ```

3. **Same pattern as claimPolicy**:
   - Uses MultiBaas SDK (`contractsApi.callContractFunction`)
   - Uses same wallet as insurer
   - Sets `signAndSubmit: true` to actually send TX
   - Returns transaction hash for verification

### The Three Steps

```typescript
// Step 1: Prepare (off-chain, free)
const abiEncodedRequest = await prepareFdcRequest(objectID);

// Step 2: Submit ON-CHAIN (costs gas) ← THIS IS THE FIX!
const roundId = await submitFdcRequest(abiEncodedRequest);

// Step 3: Retrieve proof (off-chain, free)
await new Promise(resolve => setTimeout(resolve, 90000)); // Wait 90s
const proof = await retrieveFdcProof(roundId, abiEncodedRequest);
```

## 🧪 Testing

### Mock Mode (No Gas, No Blockchain)

```bash
USE_MOCK_FDC=true npm run fdc:test
```

- No on-chain submission
- No gas cost
- Returns mock proof
- Good for testing the flow

### Real Mode (On-Chain, Costs Gas)

```bash
USE_MOCK_FDC=false npm run fdc:test
```

- Submits to FdcHub on-chain
- Costs gas (~0.0025 FLR per submission)
- Gets real proof from Flare validators
- Required for production

## 📊 Cost Analysis

**Per FDC Submission:**
- Gas: ~100,000 gas
- Gas price (Coston2): ~25 gwei
- Cost: **~0.0025 FLR** per submission

**With 100 FLR in wallet:**
- ~40,000 submissions possible
- For hackathon: negligible cost

## 🐛 Troubleshooting

### Error: "Contract FdcHub not found"

**Solution:** Register FdcHub in MultiBaas UI first (see Step 1 above). Make sure:
- Label is exactly `FdcHub` (case-sensitive)
- Address is `0x52308001b46cB6b1d0E978A79e71D03996d891E6`
- Contract is saved and visible in your MultiBaas contracts list

### Error: "Insufficient funds for gas"

**Solution:** Check wallet balance:
- The wallet in `FDC_SUBMITTER_WALLET` (or `INSURER_WALLET_ADDRESS`) needs FLR
- This should be the same wallet used for claiming policies
- Get testnet FLR from Coston2 faucet if needed

### Error: "Transaction failed" or "Revert"

**Solution:** Check:
1. Is FdcHub registered in MultiBaas? (See Step 1 - manual registration)
2. Does wallet have FLR balance?
3. Is `abiEncodedRequest` valid? (check Step 1 output)
4. Check MultiBaas logs for details

### Warning: "Proof not ready after 90 seconds"

**Solution:** This is normal!
- Voting rounds can take 90-120 seconds
- The code automatically retries
- If still not ready, you can retry later with the round ID
- The proof will be available eventually

### Error: "Verifier API error"

**Solution:**
1. Check `FDC_VERIFIER_API_BASE` is correct
2. Verify internet connectivity
3. Try: `curl https://fdc-verifiers-testnet.flare.network/`

### Error: "Verifier returns INVALID status"

**Symptoms:**
```
❌ FDC prepare failed with status: INVALID
   Full response: { status: 'INVALID', ... }
```

**Known Issue with DORIS API:**
The DORIS API (Austrian government water level data at `opendata2.doris-info.at`) returns "Access denied" when called from Flare's verifier servers, even though it works from other locations. This is likely due to IP whitelisting or geographical restrictions on the DORIS API.

**Solution:**
1. **Use Mock Mode** (recommended for testing/demo):
   ```bash
   USE_MOCK_FDC=true npm run fdc:test
   ```
   This bypasses the DORIS API and creates mock proofs that still demonstrate the on-chain submission workflow.

2. **Use Alternative Data Source**:
   Find a publicly accessible water level API that doesn't have IP restrictions. Update the `dataSource.url` in `backend/src/fdc.ts`.

3. **Contact DORIS**:
   Request IP whitelisting for Flare's verifier servers (IPs would need to be obtained from Flare team).

4. **Verify the issue**:
   ```bash
   # This will likely fail with "Access denied"
   curl "https://opendata2.doris-info.at/doris/api/1.0/gauge/getStatus?VIADONAU_PARTNER_KEY=opendata"
   ```

## 🎯 Next Steps

1. **Register FdcHub**: Follow Step 1 above to register in MultiBaas UI (one-time setup)
2. **Install dependencies**: `cd backend && npm install`
3. **Test in mock mode**: `USE_MOCK_FDC=true npm run fdc:test`
4. **Test real mode**: `USE_MOCK_FDC=false npm run fdc:test`
5. **Check explorer**: Verify transaction appeared on-chain
6. **Integrate with monitoring**: Your monitoring loop should now submit on-chain!

## ✅ Success Criteria

- ✅ FdcHub registered in MultiBaas
- ✅ Mock mode test passes
- ✅ Real mode test passes
- ✅ Transaction visible on Coston2 explorer
- ✅ `requestAttestation` function called successfully
- ✅ Round ID returned
- ✅ Proof retrieved after 90 seconds
- ✅ No errors in backend logs

## 📚 Additional Resources

- **Flare FDC Docs**: https://dev.flare.network/fdc
- **Coston2 Explorer**: https://coston2-explorer.flare.network
- **MultiBaas Docs**: https://docs.curvegrid.com/multibaas
- **Planning Document**: See original `FDC_ON_CHAIN_PLAN.md` for detailed architecture

## 🚨 Important Notes

1. **This is ON-CHAIN** - Every FDC submission costs gas
2. **Use mock mode for testing** - Set `USE_MOCK_FDC=true`
3. **Same wallet as insurer** - Reuses existing funded wallet
4. **90 second wait** - Required for validators to reach consensus
5. **Retry if needed** - Proofs may take up to 2 minutes to appear

---

**Status:** ✅ FDC now submits ON-CHAIN to FdcHub contract!

**Gas Cost:** ~0.0025 FLR per submission

**Demo Ready:** Yes (can use mock mode if needed)
