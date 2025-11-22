// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

/**
 * @title MockFdcRequestFeeConfigurations
 * @notice Mock fee configurations for FDC requests
 */
contract MockFdcRequestFeeConfigurations {
    uint256 public defaultFee;

    constructor(uint256 _defaultFee) {
        defaultFee = _defaultFee;
    }

    /**
     * @notice Get the fee for a specific request
     * @param abiEncodedRequest The encoded request data
     * @return The fee in wei
     */
    function getRequestFee(bytes memory abiEncodedRequest) external view returns (uint256) {
        // In real implementation, fee varies by request type/size
        // For testing, return default fee
        return defaultFee;
    }

    /**
     * @notice Set the default fee (for testing)
     */
    function setDefaultFee(uint256 _newFee) external {
        defaultFee = _newFee;
    }
}
