// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Strings } from "@openzeppelin/contracts/utils/Strings.sol";
import { IWeb2Json } from "flare-periphery/src/coston2/IWeb2Json.sol";
import { ContractRegistry } from "flare-periphery/src/coston2/ContractRegistry.sol";

// All numeric values come multiplied by 10^6 for precision
struct DataTransportObject {
    string objectID;        // Gauge ID: e.g. "ATKBG00001G000619415"
    string objectName;      // Gauge name: e.g. "Korneuburg"
    uint256 value;           // Current water level in cm (scaled by 1e6)
    string measureDate;     // ISO timestamp of measurement
}

contract WaterLevelAgency {
    enum PolicyStatus {
        Unclaimed,
        Open,
        Settled
    }

    struct Policy {
        address holder;
        string objectID;                    
        string objectName;                  
        uint256 startTimestamp;
        uint256 expirationTimestamp;
        uint256 waterLevelThreshold;         
        uint256 premium;
        uint256 coverage;
        PolicyStatus status;
        uint256 id;
    }

    Policy[] public registeredPolicies;
    mapping(uint256 => address) public insurers;

    event PolicyCreated(uint256 id);
    event PolicyClaimed(uint256 id);
    event PolicySettled(uint256 id);
    event PolicyExpired(uint256 id);
    event PolicyRetired(uint256 id);

    function getPolicy(uint256 id) external view returns (Policy memory) {
        return registeredPolicies[id];
    }

    function createPolicy(
        string memory objectID,             
        string memory objectName,           
        uint256 startTimestamp,
        uint256 expirationTimestamp,
        uint256 waterLevelThreshold,         
        uint256 coverage
    ) public payable {
        require(msg.value > 0, "No premium paid");
        require(startTimestamp < expirationTimestamp, "Value of startTimestamp larger than expirationTimestamp");
        require(bytes(objectID).length > 0, "ObjectID cannot be empty");

        Policy memory newPolicy = Policy({
            holder: msg.sender,
            objectID: objectID,             // CHANGED
            objectName: objectName,         // CHANGED
            startTimestamp: startTimestamp,
            expirationTimestamp: expirationTimestamp,
            waterLevelThreshold: waterLevelThreshold,  // CHANGED
            premium: msg.value,
            coverage: coverage,
            status: PolicyStatus.Unclaimed,
            id: registeredPolicies.length
        });

        registeredPolicies.push(newPolicy);

        emit PolicyCreated(newPolicy.id);
    }

    function claimPolicy(uint256 id) public payable {
        Policy memory policy = registeredPolicies[id];
        require(policy.status == PolicyStatus.Unclaimed, "Policy already claimed");
        if (block.timestamp > policy.startTimestamp) {
            retireUnclaimedPolicy(id);
        }
        require(msg.value >= policy.coverage, "Insufficient coverage paid");

        policy.status = PolicyStatus.Open;
        registeredPolicies[id] = policy;
        insurers[id] = msg.sender;

        payable(msg.sender).transfer(policy.premium);

        emit PolicyClaimed(id);
    }

    function resolvePolicy(uint256 id, IWeb2Json.Proof calldata proof) public {
        Policy memory policy = registeredPolicies[id];
        require(policy.status == PolicyStatus.Open, "Policy not open");
        require(isJsonApiProofValid(proof), "Invalid proof");
        
        DataTransportObject memory dto = abi.decode(proof.data.responseBody.abiEncodedData, (DataTransportObject));
        
        require(
            block.timestamp >= policy.startTimestamp,
            string.concat(
                "Policy not yet in effect: ",
                Strings.toString(block.timestamp),
                " vs. ",
                Strings.toString(policy.startTimestamp)
            )
        );
        
        if (block.timestamp > policy.expirationTimestamp) {
            expirePolicy(id);
            return;
        }

        // CHANGED: Verify gauge ID matches
        require(
            keccak256(bytes(dto.objectID)) == keccak256(bytes(policy.objectID)),
            string.concat(
                "Invalid gauge ID: ",
                dto.objectID,
                " vs. ",
                policy.objectID
            )
        );

        // CHANGED: Check if water level EXCEEDS threshold (flood insurance payout condition)
        require(
            dto.value >= policy.waterLevelThreshold,
            string.concat(
                "Water level threshold not exceeded: ",
                Strings.toString(dto.value),
                " vs. ",
                Strings.toString(policy.waterLevelThreshold)
            )
        );

        policy.status = PolicyStatus.Settled;
        registeredPolicies[id] = policy;
        payable(policy.holder).transfer(policy.coverage);
        emit PolicySettled(id);
    }

    function expirePolicy(uint256 id) public {
        Policy memory policy = registeredPolicies[id];
        require(policy.status == PolicyStatus.Open, "Policy not open");
        require(block.timestamp > policy.expirationTimestamp, "Policy not yet expired");
        
        policy.status = PolicyStatus.Settled;
        registeredPolicies[id] = policy;
        payable(insurers[id]).transfer(policy.coverage);
        
        emit PolicyExpired(id);
    }

    function retireUnclaimedPolicy(uint256 id) public {
        Policy memory policy = registeredPolicies[id];
        require(policy.status == PolicyStatus.Unclaimed, "Policy not unclaimed");
        require(block.timestamp > policy.startTimestamp, "Policy not yet expired");
        
        policy.status = PolicyStatus.Settled;
        registeredPolicies[id] = policy;
        payable(policy.holder).transfer(policy.premium);

        emit PolicyRetired(id);
    }

    function getInsurer(uint256 id) public view returns (address) {
        return insurers[id];
    }

    function getAllPolicies() public view returns (Policy[] memory) {
        return registeredPolicies;
    }

    // Helper function to extract ABI signature for DataTransportObject
    function abiSignatureHack(DataTransportObject memory dto) public pure {}

    function isJsonApiProofValid(IWeb2Json.Proof calldata _proof) private view returns (bool) {
        return ContractRegistry.getFdcVerification().verifyWeb2Json(_proof);
    }
}
