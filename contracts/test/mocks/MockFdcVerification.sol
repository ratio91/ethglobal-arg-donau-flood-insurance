// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { IWeb2Json } from "flare-periphery/src/coston2/IWeb2Json.sol";

/**
 * @title MockFdcVerification
 * @notice Mock FDC verifier for testing
 * @dev Allows controlling verification success/failure for testing
 */
contract MockFdcVerification {
    bool public shouldVerify;

    constructor() {
        shouldVerify = true;
    }

    /**
     * @notice Mock FDC verification (matches real IFdcVerification interface)
     * @param _proof The FDC proof (ignored in mock)
     * @return _proved Whether verification passes
     */
    function verifyJsonApi(IWeb2Json.Proof calldata _proof) external payable returns (bool _proved) {
        // In mock, we just return shouldVerify and ignore the proof content
        return shouldVerify;
    }

    /**
     * @notice Set verification result
     * @param _shouldVerify Whether to pass verification
     */
    function setShouldVerify(bool _shouldVerify) external {
        shouldVerify = _shouldVerify;
    }
}
