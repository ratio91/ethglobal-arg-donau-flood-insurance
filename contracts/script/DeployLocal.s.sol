// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Script } from "forge-std/Script.sol";
import { console } from "forge-std/console.sol";
import "../src/floodInsurance/WaterLevelPolicyNFT.sol";
import "../test/mocks/MockFdcVerification.sol";

/**
 * @title DeployLocal
 * @notice Deploy WaterLevelPolicyNFT with mocks to local Anvil for testing
 */
contract DeployLocal is Script {
    function run() external {
        uint256 deployerPrivateKey = 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80;

        console.log("Deploying to local Anvil...");

        vm.startBroadcast(deployerPrivateKey);

        // Deploy mocks
        MockFdcVerification fdcVerification = new MockFdcVerification();

        console.log("MockFdcVerification deployed at:", address(fdcVerification));

        // Deploy main contract
        WaterLevelPolicyNFT policy = new WaterLevelPolicyNFT(
            address(fdcVerification)
        );

        vm.stopBroadcast();

        console.log("\n=== DEPLOYMENT SUCCESSFUL ===");
        console.log("WaterLevelPolicyNFT:", address(policy));
        console.log("\nNext policy ID:", policy.nextPolicyId());
        console.log("Next token ID:", policy.nextTokenId());
    }
}
