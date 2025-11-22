// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { ERC721 } from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import { Strings } from "@openzeppelin/contracts/utils/Strings.sol";

interface IWorldID {
    function verifyProof(
        uint256 root,
        uint256 groupId,
        uint256 signalHash,
        uint256 nullifierHash,
        uint256 externalNullifierHash,
        uint256[8] calldata proof
    ) external view;
}

interface IFdcVerification {
    function verifyWeb2Json(bytes memory proof) external view returns (bool);
}

// DORIS river gauge data
struct DataTransportObject {
    string objectID;
    string objectName;
    int256 value;
    int256 difference;
    string measureDate;
    bool fullHour;
}

contract WaterLevelPolicyNFT is ERC721 {
    
    IWorldID public worldId;
    IFdcVerification public fdcVerification;
    
    uint256 public constant GROUP_ID = 1;
    string public constant ACTION_ID = "create-flood-policy";
    
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

    constructor(
        address _worldId,
        address _fdcVerification
    ) ERC721("Flood Insurance", "FLOOD") {
        worldId = IWorldID(_worldId);
        fdcVerification = IFdcVerification(_fdcVerification);
    }

    /**
     * @notice Create policy (World ID verified)
     */
    function createPolicy(
        string memory objectID,
        string memory objectName,
        uint256 startTimestamp,
        uint256 expirationTimestamp,
        int256 waterLevelThreshold,
        uint256 coverage,
        uint256 root,
        uint256 nullifierHash,
        uint256[8] calldata proof
    ) external payable returns (uint256) {
        require(msg.value > 0, "No premium");
        require(startTimestamp < expirationTimestamp, "Invalid time");
        require(bytes(objectID).length > 0, "Empty ID");

        // Verify World ID
        worldId.verifyProof(
            root,
            GROUP_ID,
            abi.encodePacked(msg.sender).hashToField(),
            nullifierHash,
            abi.encodePacked(ACTION_ID).hashToField(),
            proof
        );

        // Mint NFT
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
     * @notice Settle with FDC proof
     */
    function resolvePolicy(uint256 policyId, bytes calldata fdcProof) external {
        Policy storage policy = policies[policyId];
        require(policy.status == PolicyStatus.Open, "Not open");

        // Verify FDC proof
        require(fdcVerification.verifyWeb2Json(fdcProof), "Invalid proof");

        // In production, decode actual proof structure
        // TODO: Implement actual proof decoding
        
        // PAYOUT
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

// Helper for hashing
library ByteHasher {
    function hashToField(bytes memory value) internal pure returns (uint256) {
        return uint256(keccak256(abi.encodePacked(value))) >> 8;
    }
}

using ByteHasher for bytes;
