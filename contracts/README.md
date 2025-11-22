# Donau Flood Insurance - Smart Contracts

Cross-chain flood insurance using Flare Data Connector (FDC) for trustless water level verification from DORIS river gauges.

## 🏗️ Architecture

**📖 Read: [ARCHITECTURE_SIMPLIFIED.md](./ARCHITECTURE_SIMPLIFIED.md)** for complete system design.

**TL;DR:**
- **1 Contract**: WaterLevelPolicyNFT on World Chain (handles everything)
- **Backend**: Node.js cron job that orchestrates FDC requests
- **No Flare contract needed**: Backend calls FdcHub directly

## 🚀 Quick Start

### 1. Install Dependencies

```bash
forge soldeer install
```

### 2. Configure Remappings

Update `remappings.txt`:

```bash
@openzeppelin/contracts/=lib/@openzeppelin-contracts-5.2.0-rc.1/
@openzeppelin-contracts/=lib/@openzeppelin-contracts-5.2.0-rc.1/
flare-periphery/=lib/flare-periphery-0.1.37/
forge-std/=lib/forge-std-1.9.5/src/
surl/=lib/surl-0.0.0/src/
dependencies/forge-std-1.9.5/src/=lib/forge-std-1.9.5/src/
dependencies/surl-0.0.0/src/=lib/surl-0.0.0/src/
```

### 3. Set Up Environment

```bash
cp .env.example .env
# Edit .env with your keys
```

Required variables:
```bash
PRIVATE_KEY=0x...
WORLD_CHAIN_RPC_URL=https://worldchain-sepolia.g.alchemy.com/...
COSTON2_RPC_URL=https://coston2-api.flare.network/ext/C/rpc
```

### 4. Build & Test

```bash
forge build
forge test
```

## 📦 Deployment

### Deploy on World Chain Sepolia

```bash
forge script script/01_DeployWorldChainInfra.s.sol \
  --rpc-url $WORLD_CHAIN_RPC_URL \
  --broadcast \
  --verify

# Saves addresses to deployed-world.txt
```

This deploys:
- `AddressUpdater` - Contract registry
- `FdcVerification` - Cross-chain proof verification
- `WaterLevelPolicyNFT` - Policy management & NFTs

### Fund Backend Wallet

```bash
# Fund with C2FLR for FDC fees on Flare Coston2
cast send $BACKEND_WALLET --value 5ether --rpc-url $COSTON2_RPC_URL

# Fund with ETH for gas on World Chain
cast send $BACKEND_WALLET --value 1ether --rpc-url $WORLD_CHAIN_RPC_URL
```

## 🔄 Backend Setup

The backend orchestrates the FDC request/response cycle:

1. **Every 60 minutes:**
   - Read active policies from WaterLevelPolicyNFT
   - For each policy: prepare FDC request via verifier API
   - Submit requests directly to FdcHub on Flare

2. **After 90 seconds:**
   - Retrieve proofs from Flare DA Layer
   - Deliver proofs to World Chain for settlement

See [ARCHITECTURE_SIMPLIFIED.md](./ARCHITECTURE_SIMPLIFIED.md#backend-implementation) for full code example.

## 📋 Contract Reference

### WaterLevelPolicyNFT

Main contract on World Chain.

**Core Functions:**
```solidity
// User creates policy
function createPolicy(
    string memory objectID,          // DORIS gauge ID
    string memory objectName,
    uint256 startTimestamp,
    uint256 expirationTimestamp,
    int256 waterLevelThreshold,      // cm
    uint256 coverage
) external payable returns (uint256 policyId)

// Insurer claims policy
function claimPolicy(uint256 policyId) external payable

// Settle with FDC proof
function resolvePolicy(
    uint256 policyId,
    IWeb2Json.Proof calldata fdcProof
) external payable

// Expire policy (no flood)
function expirePolicy(uint256 policyId) external
```

**View Functions:**
```solidity
function getPolicy(uint256 policyId) external view returns (Policy memory)
function getActivePolicies() external view returns (uint256[] memory)
```

## 🧪 Testing

```bash
# Run all tests
forge test

# Run specific test
forge test --match-contract WaterLevelPolicyNFTTest

# Verbose output
forge test -vvv
```

## 📊 DORIS Data Structure

Water level data from Austrian DORIS API:

```solidity
struct DataTransportObject {
    string objectID;        // Gauge ID (e.g., "ATFRB00001G000122231")
    int256 value;           // Water level in cm (e.g., 266)
    int256 measureDate;     // Unix timestamp in milliseconds
}
```

Example gauges:
- `ATKBG00001G000619415` - Korneuburg (Danube)
- `ATFRB00001G000122231` - Achleiten (Danube)

## 🔍 Verification

All water level data is cryptographically verified via Flare Data Connector:
- 100 independent FDC providers vote on data accuracy
- 90-second voting rounds
- Merkle proof verification on-chain
- ~$30 per FDC request (mainnet) or ~0.1 C2FLR (testnet)

## 📚 Documentation

- **[ARCHITECTURE_SIMPLIFIED.md](./ARCHITECTURE_SIMPLIFIED.md)** - System architecture (READ THIS FIRST)
- **[DORIS_DATA_SIMPLIFICATION.md](./DORIS_DATA_SIMPLIFICATION.md)** - DORIS API integration
- **[CHAINLINK_REMOVAL_SUMMARY.md](./CHAINLINK_REMOVAL_SUMMARY.md)** - Why we don't use Chainlink

## 🗑️ What Was Removed

To keep the architecture simple, we removed:
- ❌ **FdcPolicyTracker** - Redundant state tracking on Flare
- ❌ **FdcRequestAutomation** - Broken Chainlink integration
- ❌ **World ID** - Unnecessary identity verification

See [ARCHITECTURE_SIMPLIFIED.md](./ARCHITECTURE_SIMPLIFIED.md#what-was-removed) for details.

## 🛠️ Development

### Project Structure

```
src/
  floodInsurance/
    WaterLevelPolicyNFT.sol       # Main contract
  crossChainFdc/
    AddressUpdater.sol             # Contract registry
    FdcVerification.sol            # Proof verification

test/
  WaterLevelPolicyNFT.t.sol        # Main test suite
  mocks/
    MockFdcVerification.sol        # FDC mock for testing

script/
  01_DeployWorldChainInfra.s.sol   # World Chain deployment
  02_DeployPolicyContract.s.sol    # Policy contract only
  03_SubmitFdcRequestFlare.s.sol   # FDC request submission
  04_DeliverProofWorldChain.s.sol  # Proof delivery
```

### Local Testing with Anvil

```bash
# Terminal 1: Start Anvil
anvil

# Terminal 2: Deploy to local chain
forge script script/DeployLocal.s.sol \
  --rpc-url http://localhost:8545 \
  --broadcast
```

## 💰 Cost Estimation

### Per Policy Per Month

- **FDC Requests**: 720 checks/month × $30 = **~$21,600**
- **Gas (World Chain)**: Minimal (~$5)
- **Total**: **~$21,605/month per policy**

**Note**: This is expensive! Consider:
- Longer intervals (e.g., 6 hours = $3,600/month)
- Only during flood season
- Pooled policies (multiple users per gauge)

## 🔗 Useful Links

- **Flare Docs**: https://docs.flare.network/dev/getting-started/setup/remix/
- **FDC Verification**: https://fdc-verification.flare.network/
- **DORIS API**: https://hydro.oesterreich.gv.at/
- **World Chain**: https://world.org/

## 📝 License

MIT
