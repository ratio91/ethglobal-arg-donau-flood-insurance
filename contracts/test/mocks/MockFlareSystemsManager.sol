// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

/**
 * @title MockFlareSystemsManager
 * @notice Mock Flare Systems Manager for testing round calculations
 */
contract MockFlareSystemsManager {
    uint64 public firstVotingRoundStartTs;
    uint64 public votingEpochDurationSeconds;

    constructor(uint64 _firstVotingRoundStartTs, uint64 _votingEpochDurationSeconds) {
        firstVotingRoundStartTs = _firstVotingRoundStartTs;
        votingEpochDurationSeconds = _votingEpochDurationSeconds;
    }

    /**
     * @notice Update round parameters (for testing)
     */
    function setRoundParameters(uint64 _firstVotingRoundStartTs, uint64 _votingEpochDurationSeconds) external {
        firstVotingRoundStartTs = _firstVotingRoundStartTs;
        votingEpochDurationSeconds = _votingEpochDurationSeconds;
    }
}
