// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Script } from "forge-std/Script.sol";
import { console } from "forge-std/console.sol";

// Minimal implementation for hackathon
contract AddressUpdater {
    address public governance;
    mapping(string => address) public addresses;
    
    constructor(address _governance) {
        governance = _governance;
    }
    
    function addOrUpdateContractNamesAndAddresses(
        string[] memory names,
        address[] memory _addresses
    ) external {
        for (uint i = 0; i < names.length; i++) {
            addresses[names[i]] = _addresses[i];
        }
    }
    
    function getContractAddress(string memory name) external view returns (address) {
        return addresses[name];
    }
}

// Minimal FdcVerification for hackathon
contract FdcVerification {
    AddressUpdater public addressUpdater;
    uint8 public fdcProtocolId;
    
    constructor(address _addressUpdater, uint8 _protocolId) {
        addressUpdater = AddressUpdater(_addressUpdater);
        fdcProtocolId = _protocolId;
    }
    
    // Simplified verification - accepts any proof for hackathon demo
    // In production, this would verify Merkle proofs
    function verifyWeb2Json(bytes memory /* proof */) external pure returns (bool) {
        // TODO: Implement actual Merkle proof verification
        // For hackathon, we'll trust the proof
        return true;
    }
}

contract DeployWorldChainInfra is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        console.log("Deploying to World Chain...");
        console.log("Deployer:", deployer);

        vm.startBroadcast(deployerPrivateKey);

        // Deploy AddressUpdater
        AddressUpdater addressUpdater = new AddressUpdater(deployer);
        console.log("AddressUpdater deployed:", address(addressUpdater));

        // Deploy FdcVerification (protocol ID 200 = Coston2)
        FdcVerification fdcVerification = new FdcVerification(
            address(addressUpdater),
            200
        );
        console.log("FdcVerification deployed:", address(fdcVerification));

        // Register addresses
        string[] memory names = new string[](1);
        address[] memory addresses = new address[](1);
        names[0] = "AddressUpdater";
        addresses[0] = address(addressUpdater);
        
        addressUpdater.addOrUpdateContractNamesAndAddresses(names, addresses);

        vm.stopBroadcast();

        // Save addresses to file
        string memory output = string.concat(
            "FDC_VERIFICATION_WORLD=", vm.toString(address(fdcVerification)), "\n",
            "ADDRESS_UPDATER_WORLD=", vm.toString(address(addressUpdater))
        );
        
        vm.writeFile("deployed-world.txt", output);
        
        console.log("\n=== DEPLOYMENT COMPLETE ===");
        console.log("Addresses saved to deployed-world.txt");
        console.log("\nNext: Copy these to your .env file");
    }
}
