// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { ERC721 } from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import { IWeb2Json } from "flare-periphery/src/coston2/IWeb2Json.sol";
import { ContractRegistry } from "flare-periphery/src/coston2/ContractRegistry.sol";

interface IFdcVerification {
    function verifyJsonApi(IWeb2Json.Proof calldata _proof) external payable returns (bool _proved);
}

// DORIS river gauge data structure - matches the abiSignature from FDC request
struct DataTransportObject {
    string objectID;        // Gauge identifier (e.g., "ATFRB00001G000122231")
    int256 value;           // Water level in cm (e.g., 266)
    int256 measureDate;     // Unix timestamp in milliseconds (e.g., 1763773200000)
}

contract WaterLevelPolicyNFT is ERC721 {

    IFdcVerification public fdcVerification;

    uint256 public nextPolicyId;
    uint256 public nextTokenId;

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
        int256 waterLevelThreshold;
        uint256 premium;
        uint256 coverage;
        PolicyStatus status;
        uint256 policyholderNFT;
        uint256 insurerNFT;
    }

    mapping(uint256 => Policy) public policies;
    mapping(uint256 => address) public insurers;
    mapping(uint256 => uint256) public tokenIdToPolicy;
    
    uint256[] public activePolicies;
    mapping(uint256 => uint256) private activePolicyIndex;

    event PolicyCreated(uint256 indexed policyId, address indexed holder, uint256 nftId);
    event PolicyClaimed(uint256 indexed policyId, address indexed insurer, uint256 nftId);
    event PolicySettled(uint256 indexed policyId, address indexed beneficiary, uint256 amount);
    event PolicyExpired(uint256 indexed policyId);

    constructor() ERC721("Donau Flood Insurance", "DONAU") {}
    
    /**
     * @notice Create a new flood insurance policy
     * @param objectID DORIS gauge ID (e.g., "ATFRB00001G000122231")
     * @param objectName Human-readable gauge name (e.g., "Achleiten")
     * @param startTimestamp Policy start time
     * @param expirationTimestamp Policy expiration time
     * @param waterLevelThreshold Water level in cm that triggers payout
     * @param coverage Amount insurer will stake and pay if threshold breached
     * @return policyId The created policy ID
     */
    function createPolicy(
        string memory objectID,
        string memory objectName,
        uint256 startTimestamp,
        uint256 expirationTimestamp,
        int256 waterLevelThreshold,
        uint256 coverage
    ) external payable returns (uint256) {
        require(msg.value > 0, "No premium");
        require(startTimestamp < expirationTimestamp, "Invalid time");
        require(bytes(objectID).length > 0, "Empty ID");

        // Mint NFT to policyholder
        uint256 nftId = nextTokenId++;
        _mint(msg.sender, nftId);

        uint256 policyId = nextPolicyId++;
        
        policies[policyId] = Policy({
            holder: msg.sender,
            objectID: objectID,
            objectName: objectName,
            startTimestamp: startTimestamp,
            expirationTimestamp: expirationTimestamp,
            waterLevelThreshold: waterLevelThreshold,
            premium: msg.value,
            coverage: coverage,
            status: PolicyStatus.Unclaimed,
            policyholderNFT: nftId,
            insurerNFT: 0
        });

        tokenIdToPolicy[nftId] = policyId;

        emit PolicyCreated(policyId, msg.sender, nftId);
        return policyId;
    }

    /**
     * @notice Insurer claims policy
     */
    function claimPolicy(uint256 policyId) external payable {
        Policy storage policy = policies[policyId];
        require(policy.status == PolicyStatus.Unclaimed, "Not unclaimed");
        require(msg.value >= policy.coverage, "Insufficient coverage");

        // Mint insurer NFT
        uint256 nftId = nextTokenId++;
        _mint(msg.sender, nftId);

        policy.status = PolicyStatus.Open;
        policy.insurerNFT = nftId;
        insurers[policyId] = msg.sender;
        tokenIdToPolicy[nftId] = policyId;

        // Add to active list
        activePolicyIndex[policyId] = activePolicies.length;
        activePolicies.push(policyId);

        // Pay premium to insurer
        payable(msg.sender).transfer(policy.premium);

        emit PolicyClaimed(policyId, msg.sender, nftId);
    }

    /**
     * @notice Settle policy with FDC proof from Flare
     * @param policyId The policy to settle
     * @param fdcProof The FDC proof containing verified DORIS water level data
     */
    function resolvePolicy(uint256 policyId, IWeb2Json.Proof calldata fdcProof) external payable {
        Policy storage policy = policies[policyId];
        require(policy.status == PolicyStatus.Open, "Not open");
        require(block.timestamp >= policy.startTimestamp, "Policy not started");
        require(block.timestamp <= policy.expirationTimestamp, "Policy expired");

        // Verify FDC proof via FdcVerification contract
        require(ContractRegistry.getFdcVerification().verifyWeb2Json(fdcProof), "Invalid proof");

        // Decode DORIS data from the proof
        DataTransportObject memory dorisData = abi.decode(
            fdcProof.data.responseBody.abiEncodedData,
            (DataTransportObject)
        );

        // Verify the gauge matches the policy
        require(
            keccak256(bytes(dorisData.objectID)) == keccak256(bytes(policy.objectID)),
            "Gauge ID mismatch"
        );

        // Check if water level exceeded threshold
        require(dorisData.value >= policy.waterLevelThreshold, "Threshold not breached");

        // PAYOUT to policyholder
        policy.status = PolicyStatus.Settled;
        address beneficiary = ownerOf(policy.policyholderNFT);

        _removeFromActiveList(policyId);

        _burn(policy.policyholderNFT);
        _burn(policy.insurerNFT);

        payable(beneficiary).transfer(policy.coverage);

        emit PolicySettled(policyId, beneficiary, policy.coverage);
    }

    /**
     * @notice Expire policy (no flood occurred)
     */
    function expirePolicy(uint256 policyId) external {
        Policy storage policy = policies[policyId];
        require(policy.status == PolicyStatus.Open, "Not open");
        require(block.timestamp > policy.expirationTimestamp, "Not expired");
        
        policy.status = PolicyStatus.Settled;
        address insurer = insurers[policyId];

        _removeFromActiveList(policyId);
        
        _burn(policy.policyholderNFT);
        _burn(policy.insurerNFT);

        payable(insurer).transfer(policy.coverage);

        emit PolicyExpired(policyId);
    }

    function _removeFromActiveList(uint256 policyId) internal {
        uint256 index = activePolicyIndex[policyId];
        uint256 lastIndex = activePolicies.length - 1;

        if (index != lastIndex) {
            uint256 lastPolicyId = activePolicies[lastIndex];
            activePolicies[index] = lastPolicyId;
            activePolicyIndex[lastPolicyId] = index;
        }

        activePolicies.pop();
        delete activePolicyIndex[policyId];
    }

    // View functions
    function getPolicy(uint256 policyId) external view returns (Policy memory) {
        return policies[policyId];
    }

    function getActivePolicies() external view returns (uint256[] memory) {
        return activePolicies;
    }
}
