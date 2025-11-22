// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Script } from "forge-std/Script.sol";
import { console } from "forge-std/console.sol";
import "../src/floodInsurance/WaterLevelPolicyNFT.sol";

contract DeployPolicyContract is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        
        // Read from deployed-world.txt or .env
        address fdcVerification = vm.envAddress("FDC_VERIFICATION_WORLD");

        console.log("Deploying WaterLevelPolicyNFT...");
        console.log("FdcVerification:", fdcVerification);

        vm.startBroadcast(deployerPrivateKey);

        WaterLevelPolicyNFT policy = new WaterLevelPolicyNFT(
            fdcVerification
        );

        vm.stopBroadcast();

        console.log("\n=== POLICY CONTRACT DEPLOYED ===");
        console.log("Address:", address(policy));
        
        // Save to file
        vm.writeFile(
            "deployed-policy.txt",
            string.concat("POLICY_CONTRACT=", vm.toString(address(policy)))
        );
        
        console.log("\nSaved to deployed-policy.txt");
        console.log("\n=== NEXT STEPS ===");
        console.log("1. Copy address to .env");
        console.log("2. Update frontend config");
        console.log("3. Create test policy");
    }
}
