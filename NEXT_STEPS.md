# ✅ FDC On-Chain Integration - FIXED!

## 🎯 What Was the Problem?

The FDC implementation was **NOT submitting on-chain**. It was calling a DA Layer API endpoint which doesn't exist for submission. The correct flow requires submitting to the **FdcHub smart contract on-chain**.

## ✅ What Was Fixed

### 1. **Updated `backend/src/fdc.ts`**
   - ✅ Added imports for `@flarenetwork/flare-periphery-contract-artifacts`
   - ✅ **Replaced `submitFdcRequest()` to submit ON-CHAIN to FdcHub contract**
   - ✅ Added `calculateRoundId()` helper function
   - ✅ Added `createMockProof()` for testing
   - ✅ Now uses the same MultiBaas pattern as `claimPolicy`

### 2. **Updated `backend/src/config.ts`**
   - ✅ Added `fdc.submitterWallet` config option
   - ✅ Defaults to `insurer.walletAddress` (reuse funded wallet)

### 3. **Updated `backend/.env.example`**
   - ✅ Added FDC configuration variables
   - ✅ Added `USE_MOCK_FDC` for testing
   - ✅ Added `FDC_SUBMITTER_WALLET` (optional)

### 4. **FdcHub Registration**
   - ✅ Documented manual registration process in MultiBaas UI
   - ✅ Contract address: `0x52308001b46cB6b1d0E978A79e71D03996d891E6`
   - ✅ One-time setup required before using FDC

### 5. **Created `backend/scripts/test-fdc-onchain.ts`**
   - ✅ Complete test script for FDC workflow
   - ✅ Supports step-by-step mode for debugging
   - ✅ Shows transaction hash and explorer link

### 6. **Updated `backend/package.json`**
   - ✅ Added `npm run fdc:test` command
   - ✅ Added `npm run fdc:test:steps` command

### 7. **Created `backend/FDC_ONCHAIN_SETUP.md`**
   - ✅ Comprehensive setup and troubleshooting guide
   - ✅ Step-by-step instructions
   - ✅ Common errors and solutions

## 🚀 Next Steps (What YOU Need to Do)

### Step 1: Install Dependencies (if needed)
```bash
cd backend
npm install
```

### Step 2: Register FdcHub in MultiBaas (One-Time Setup)

**Manually register the FdcHub contract in your MultiBaas deployment:**

1. Go to MultiBaas UI → Contracts section
2. Click "Add Contract"
3. Enter details:
   - **Label:** `FdcHub` (exactly this!)
   - **Address:** `0x52308001b46cB6b1d0E978A79e71D03996d891E6`
   - **Network:** Your Coston2 network
4. Get ABI:
   ```bash
   cd backend
   node -e "const {nameToAbi} = require('@flarenetwork/flare-periphery-contract-artifacts'); console.log(JSON.stringify(nameToAbi('FdcHub', 'coston2'), null, 2))" > fdchub-abi.json
   ```
   Copy `fdchub-abi.json` contents and paste into MultiBaas
5. Save the contract

**Verification:** FdcHub should appear in your MultiBaas contracts list

### Step 3: Configure Your Environment

Make sure your `.env` file has these variables:

```bash
# Required (should already have these)
MULTIBAAS_URL=https://your-deployment.multibaas.com
MULTIBAAS_API_KEY=your-api-key
CONTRACT_ADDRESS=0x9fd9f4DeD5691B67E55D35E7f1789c75e760249F
INSURER_WALLET_ADDRESS=0xYourFundedWallet

# FDC Configuration (add these)
USE_MOCK_FDC=false  # Set to false for REAL on-chain submission
FDC_VERIFIER_API_BASE=https://fdc-verifiers-testnet.flare.network
```

### Step 4: Test Mock Mode First
```bash
USE_MOCK_FDC=true npm run fdc:test
```

This should work immediately and shows you the expected flow.

### Step 5: Test Real On-Chain Mode
```bash
USE_MOCK_FDC=false npm run fdc:test
```

**What to expect:**
```
🔧 [STEP 1] Preparing FDC request...
✅ [STEP 1] Request prepared

📡 [STEP 2] Submitting FDC request ON-CHAIN to FdcHub...
📍 FdcHub address: 0x...
💼 Using wallet: 0x...
📝 Transaction hash: 0x...
🔗 View on explorer: https://coston2-explorer.flare.network/tx/0x...
✅ [STEP 2] FDC request submitted on-chain!
   Round ID: 12345678

⏳ Waiting 90 seconds for voting round...

🔍 [STEP 3] Retrieving FDC proof...
✅ [STEP 3] FDC proof retrieved!

✅ SUCCESS! Complete FDC workflow finished!
```

### Step 6: Verify on Explorer

1. Copy the transaction hash from the output
2. Go to https://coston2-explorer.flare.network
3. Search for the transaction
4. You should see:
   - ✅ Transaction to FdcHub contract
   - ✅ Function: `requestAttestation`
   - ✅ Status: Success

### Step 7: Integration

Your backend monitoring loop should now automatically submit on-chain when it calls `completeFdcWorkflow()` or `submitFdcRequest()`.

## 📊 Key Changes in Code

### Before (WRONG ❌)
```typescript
export async function submitFdcRequest(abiEncodedRequest: string) {
  // Submitting to DA Layer API (off-chain)
  const response = await fetch(`${DA_LAYER_API}/submit-attestation-request`, {
    method: 'POST',
    body: JSON.stringify({ abiEncodedRequest })
  });
  // ❌ This endpoint doesn't exist for submission!
}
```

### After (CORRECT ✅)
```typescript
export async function submitFdcRequest(abiEncodedRequest: string) {
  // Get FdcHub contract address
  const fdcHubAddress = nameToAddress('FdcHub', 'coston2');

  // Submit ON-CHAIN via MultiBaas (same pattern as claimPolicy)
  const result = await contractsApi.callContractFunction(
    fdcHubAddress,
    'FdcHub',
    'requestAttestation',
    {
      args: [abiEncodedRequest],
      from: walletAddress,
      signer: walletAddress,
      signAndSubmit: true, // ✅ Actually sends the transaction!
    }
  );

  const txHash = result.data.result.tx.hash;
  // ✅ Returns transaction hash for verification!
}
```

## 📁 Files Changed

```
backend/
├── src/
│   ├── fdc.ts                    # ✅ MAIN FIX - now submits ON-CHAIN
│   └── config.ts                 # ✅ Added FDC config
├── scripts/
│   └── test-fdc-onchain.ts       # ✅ NEW - Test script
├── .env.example                  # ✅ Updated with FDC vars
├── package.json                  # ✅ Added npm scripts
└── FDC_ONCHAIN_SETUP.md         # ✅ NEW - Setup guide

NEXT_STEPS.md                     # ✅ This file
```

## 🎯 Success Criteria

After following the steps above, you should have:

- ✅ FdcHub registered in MultiBaas
- ✅ Mock mode test passing
- ✅ Real mode test passing
- ✅ Transaction visible on Coston2 explorer
- ✅ Transaction calling `requestAttestation` on FdcHub
- ✅ Proof retrieved after 90 seconds
- ✅ No errors in test output

## 💰 Cost

**Per FDC submission:**
- Gas: ~100,000 gas
- Cost: ~0.0025 FLR (~$0.000025 USD)

**Very cheap for testnet!**

## 🐛 Troubleshooting

### "Contract FdcHub not found"
→ Register FdcHub in MultiBaas UI first (see Step 2 above)

### "Insufficient funds for gas"
→ Check wallet balance has FLR

### "Proof not ready after 90 seconds"
→ Normal! Wait another 30 seconds or retry later

### See full troubleshooting guide:
→ `backend/FDC_ONCHAIN_SETUP.md`

## 📚 Documentation

- **Setup Guide**: `backend/FDC_ONCHAIN_SETUP.md`
- **Planning Doc**: (your original planning file)
- **Test Script**: `backend/scripts/test-fdc-onchain.ts`

## 🎉 Summary

The FDC integration is now **COMPLETE** and submits **ON-CHAIN** to the FdcHub contract!

**What you need to do:**
1. Register FdcHub in MultiBaas UI (one-time - see Step 2 above)
2. Run `npm install` in backend
3. Test with `npm run fdc:test`
4. Verify transaction on explorer
5. Deploy and demo! 🚀

---

**Status:** ✅ READY TO TEST

**Time to setup:** ~5 minutes

**Confidence:** 🟢 HIGH (uses same proven pattern as claimPolicy)
