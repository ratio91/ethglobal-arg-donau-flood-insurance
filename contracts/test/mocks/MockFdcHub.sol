// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

/**
 * @title MockFdcHub
 * @notice Mock FDC Hub for testing attestation requests
 */
contract MockFdcHub {
    struct AttestationRequest {
        bytes data;
        uint256 fee;
        uint256 timestamp;
        address requester;
    }

    mapping(bytes32 => AttestationRequest) public requests;
    bytes32[] public requestHashes;
    uint256 public totalRequests;
    bool public shouldRevert;

    event AttestationRequested(bytes32 indexed requestHash, address indexed requester, uint256 fee);

    /**
     * @notice Submit an attestation request
     */
    function requestAttestation(bytes calldata data) external payable {
        if (shouldRevert) {
            revert("MockFdcHub: Request failed");
        }

        bytes32 requestHash = keccak256(data);

        requests[requestHash] = AttestationRequest({
            data: data,
            fee: msg.value,
            timestamp: block.timestamp,
            requester: msg.sender
        });

        requestHashes.push(requestHash);
        totalRequests++;

        emit AttestationRequested(requestHash, msg.sender, msg.value);
    }

    /**
     * @notice Get request by hash
     */
    function getRequest(bytes32 requestHash) external view returns (AttestationRequest memory) {
        return requests[requestHash];
    }

    /**
     * @notice Set whether to revert on requests
     */
    function setShouldRevert(bool _shouldRevert) external {
        shouldRevert = _shouldRevert;
    }

    /**
     * @notice Get total value received
     */
    function getTotalValue() external view returns (uint256) {
        return address(this).balance;
    }
}
