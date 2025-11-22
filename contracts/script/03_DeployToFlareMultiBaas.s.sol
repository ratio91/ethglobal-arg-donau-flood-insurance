// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import "forge-std/Script.sol";
import {MultiBaas} from "forge-multibaas/MultiBaas.sol";
import "../src/floodInsurance/WaterLevelPolicyNFT.sol";
import "../src/crossChainFdc/FdcVerification.sol";
import "../src/crossChainFdc/AddressUpdater.sol";

contract DeployToFlareMultiBaas is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        console.log("Deploying to Flare Coston2 with MultiBaas integration");
        console.log("Deployer address:", deployer);

        vm.startBroadcast(deployerPrivateKey);

        // Deploy infrastructure contracts
        AddressUpdater addressUpdater = new AddressUpdater(deployer);
        console.log("AddressUpdater deployed at:", address(addressUpdater));

        FdcVerification fdcVerification = new FdcVerification(address(addressUpdater), 1);
        console.log("FdcVerification deployed at:", address(fdcVerification));

        WaterLevelPolicyNFT policyNFT = new WaterLevelPolicyNFT(address(fdcVerification));
        console.log("WaterLevelPolicyNFT deployed at:", address(policyNFT));

        // Link to MultiBaas with event syncing from 100 blocks ago
        // This uploads the ABI and registers the contract for REST API access and webhooks
        bytes memory opts = MultiBaas.withOptions(
            "water-level-policy",  // Contract label in MultiBaas
            "water-level-policy",  // Address alias
            "",                    // Auto-increment version
            "-100"                 // Start event sync from 100 blocks ago
        );
        MultiBaas.linkContractWithOptions("WaterLevelPolicyNFT", address(policyNFT), opts);
        console.log("Contract linked to MultiBaas!");

        vm.stopBroadcast();

        console.log("\n=== Deployment Complete ===");
        console.log("AddressUpdater:", address(addressUpdater));
        console.log("FdcVerification:", address(fdcVerification));
        console.log("WaterLevelPolicyNFT:", address(policyNFT));
        console.log("\nCheck MultiBaas dashboard for 'water-level-policy' contract");
    }
}
