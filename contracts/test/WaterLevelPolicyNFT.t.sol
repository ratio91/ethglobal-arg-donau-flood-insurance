// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import "forge-std/Test.sol";
import "forge-std/console.sol";
import "../src/WaterLevelPolicyNFT.sol";
import "./mocks/MockFdcVerification.sol";
import { IWeb2Json } from "flare-periphery/src/coston2/IWeb2Json.sol";

contract WaterLevelPolicyNFTTest is Test {
    WaterLevelPolicyNFT public policyContract;
    MockFdcVerification public mockFdc;

    address public policyholder = address(0x123);
    address public insurer = address(0x456);
    address public attacker = address(0x789);

    uint256 public constant PREMIUM = 0.1 ether;
    uint256 public constant COVERAGE = 1 ether;
    int256 public constant THRESHOLD = 549000000; // 549 cm scaled by 1e6

    string public constant GAUGE_ID = "ATKBG00001G000619415";
    string public constant GAUGE_NAME = "Korneuburg";

    uint256 public startTime;
    uint256 public endTime;

    event PolicyCreated(uint256 indexed policyId, address indexed holder, uint256 nftId);
    event PolicyClaimed(uint256 indexed policyId, address indexed insurer, uint256 nftId);
    event PolicySettled(uint256 indexed policyId, address indexed beneficiary, uint256 amount);
    event PolicyExpired(uint256 indexed policyId);

    function setUp() public {
        policyContract = new WaterLevelPolicyNFT();

        startTime = block.timestamp + 1 days;
        endTime = startTime + 30 days;

        vm.deal(policyholder, 10 ether);
        vm.deal(insurer, 10 ether);
        vm.deal(attacker, 10 ether);
    }

    // ============ Policy Creation Tests ============

    function testCreatePolicy() public {
        vm.startPrank(policyholder);

        uint256 policyId = policyContract.createPolicy{value: PREMIUM}(
            GAUGE_ID,
            GAUGE_NAME,
            startTime,
            endTime,
            THRESHOLD,
            COVERAGE
        );

        assertEq(policyId, 0, "First policy should have ID 0");

        WaterLevelPolicyNFT.Policy memory policy = policyContract.getPolicy(policyId);
        assertEq(policy.holder, policyholder, "Holder mismatch");
        assertEq(policy.objectID, GAUGE_ID, "Gauge ID mismatch");
        assertEq(policy.premium, PREMIUM, "Premium mismatch");
        assertEq(policy.coverage, COVERAGE, "Coverage mismatch");
        assertTrue(
            policy.status == WaterLevelPolicyNFT.PolicyStatus.Unclaimed,
            "Status should be Unclaimed"
        );

        vm.stopPrank();
    }

    function testCreatePolicyRevertsWithZeroPremium() public {
        vm.startPrank(policyholder);

        vm.expectRevert("No premium");
        policyContract.createPolicy{value: 0}(
            GAUGE_ID,
            GAUGE_NAME,
            startTime,
            endTime,
            THRESHOLD,
            COVERAGE
        );

        vm.stopPrank();
    }

    function testCreatePolicyRevertsWithInvalidTimestamps() public {
        vm.startPrank(policyholder);

        vm.expectRevert("Invalid time");
        policyContract.createPolicy{value: PREMIUM}(
            GAUGE_ID,
            GAUGE_NAME,
            endTime,
            startTime, // Swapped - end before start
            THRESHOLD,
            COVERAGE
        );

        vm.stopPrank();
    }

    function testCreatePolicyRevertsWithEmptyGaugeID() public {
        vm.startPrank(policyholder);

        vm.expectRevert("Empty ID");
        policyContract.createPolicy{value: PREMIUM}(
            "",
            GAUGE_NAME,
            startTime,
            endTime,
            THRESHOLD,
            COVERAGE
        );

        vm.stopPrank();
    }

    function testCreatePolicyMintsNFT() public {
        vm.startPrank(policyholder);

        policyContract.createPolicy{value: PREMIUM}(
            GAUGE_ID,
            GAUGE_NAME,
            startTime,
            endTime,
            THRESHOLD,
            COVERAGE
        );

        uint256 nftId = 0;
        assertEq(policyContract.ownerOf(nftId), policyholder, "NFT should be owned by policyholder");

        vm.stopPrank();
    }

    function testCreatePolicyEmitsEvent() public {
        vm.startPrank(policyholder);

        vm.expectEmit(true, true, false, true);
        emit PolicyCreated(0, policyholder, 0);

        policyContract.createPolicy{value: PREMIUM}(
            GAUGE_ID,
            GAUGE_NAME,
            startTime,
            endTime,
            THRESHOLD,
            COVERAGE
        );

        vm.stopPrank();
    }

    function testCreatePolicyIncrementsCounter() public {
        vm.startPrank(policyholder);

        uint256 firstId = policyContract.createPolicy{value: PREMIUM}(
            GAUGE_ID,
            GAUGE_NAME,
            startTime,
            endTime,
            THRESHOLD,
            COVERAGE
        );

        uint256 secondId = policyContract.createPolicy{value: PREMIUM}(
            GAUGE_ID,
            GAUGE_NAME,
            startTime,
            endTime,
            THRESHOLD,
            COVERAGE
        );

        assertEq(firstId, 0, "First ID should be 0");
        assertEq(secondId, 1, "Second ID should be 1");

        vm.stopPrank();
    }

    // ============ Policy Claiming Tests ============

    function testClaimPolicy() public {
        uint256 policyId = _createTestPolicy();

        vm.startPrank(insurer);

        policyContract.claimPolicy{value: COVERAGE}(policyId);

        WaterLevelPolicyNFT.Policy memory policy = policyContract.getPolicy(policyId);
        assertTrue(
            policy.status == WaterLevelPolicyNFT.PolicyStatus.Open,
            "Status should be Open"
        );
        assertEq(policyContract.insurers(policyId), insurer, "Insurer not recorded");

        vm.stopPrank();
    }

    function testClaimPolicyRevertsIfNotUnclaimed() public {
        uint256 policyId = _createTestPolicy();

        vm.prank(insurer);
        policyContract.claimPolicy{value: COVERAGE}(policyId);

        vm.prank(attacker);
        vm.expectRevert("Not unclaimed");
        policyContract.claimPolicy{value: COVERAGE}(policyId);
    }

    function testClaimPolicyRevertsInsufficientCoverage() public {
        uint256 policyId = _createTestPolicy();

        vm.startPrank(insurer);

        vm.expectRevert("Insufficient coverage");
        policyContract.claimPolicy{value: COVERAGE - 1}(policyId);

        vm.stopPrank();
    }

    function testClaimPolicyMintsNFT() public {
        uint256 policyId = _createTestPolicy();

        vm.startPrank(insurer);

        policyContract.claimPolicy{value: COVERAGE}(policyId);

        WaterLevelPolicyNFT.Policy memory policy = policyContract.getPolicy(policyId);
        assertEq(policyContract.ownerOf(policy.insurerNFT), insurer, "Insurer NFT not minted");

        vm.stopPrank();
    }

    function testClaimPolicyTransfersPremium() public {
        uint256 policyId = _createTestPolicy();

        uint256 balanceBefore = insurer.balance;

        vm.startPrank(insurer);
        policyContract.claimPolicy{value: COVERAGE}(policyId);
        vm.stopPrank();

        uint256 balanceAfter = insurer.balance;
        // Insurer pays COVERAGE, receives PREMIUM
        // Net change: balanceAfter = balanceBefore - COVERAGE + PREMIUM
        assertEq(balanceBefore - balanceAfter, COVERAGE - PREMIUM, "Net payment incorrect");
    }

    function testClaimPolicyUpdatesStatus() public {
        uint256 policyId = _createTestPolicy();

        WaterLevelPolicyNFT.Policy memory policyBefore = policyContract.getPolicy(policyId);
        assertTrue(
            policyBefore.status == WaterLevelPolicyNFT.PolicyStatus.Unclaimed,
            "Initial status should be Unclaimed"
        );

        vm.prank(insurer);
        policyContract.claimPolicy{value: COVERAGE}(policyId);

        WaterLevelPolicyNFT.Policy memory policyAfter = policyContract.getPolicy(policyId);
        assertTrue(
            policyAfter.status == WaterLevelPolicyNFT.PolicyStatus.Open,
            "Status should be Open after claim"
        );
    }

    function testClaimPolicyEmitsEvent() public {
        uint256 policyId = _createTestPolicy();

        vm.startPrank(insurer);

        vm.expectEmit(true, true, false, true);
        emit PolicyClaimed(policyId, insurer, 1);

        policyContract.claimPolicy{value: COVERAGE}(policyId);

        vm.stopPrank();
    }

    function testClaimPolicyAddsToActiveList() public {
        uint256 policyId = _createTestPolicy();

        vm.prank(insurer);
        policyContract.claimPolicy{value: COVERAGE}(policyId);

        uint256[] memory activePolicies = policyContract.getActivePolicies();
        assertEq(activePolicies.length, 1, "Should have 1 active policy");
        assertEq(activePolicies[0], policyId, "Active policy ID mismatch");
    }

    // ============ Settlement Tests ============

    function testResolvePolicy() public {
        uint256 policyId = _createAndClaimPolicy();

        vm.warp(startTime); // Warp to policy start time

        IWeb2Json.Proof memory fdcProof = _createMockProof();

        policyContract.resolvePolicy(policyId, fdcProof);

        WaterLevelPolicyNFT.Policy memory policy = policyContract.getPolicy(policyId);
        assertTrue(
            policy.status == WaterLevelPolicyNFT.PolicyStatus.Settled,
            "Status should be Settled"
        );
    }

    function testResolvePolicyRevertsIfNotOpen() public {
        uint256 policyId = _createTestPolicy();

        vm.warp(startTime);

        IWeb2Json.Proof memory fdcProof = _createMockProof();

        vm.expectRevert("Not open");
        policyContract.resolvePolicy(policyId, fdcProof);
    }

    function testResolvePolicyRevertsWithInvalidProof() public {
        uint256 policyId = _createAndClaimPolicy();

        vm.warp(startTime);

        mockFdc.setShouldVerify(false);

        IWeb2Json.Proof memory fdcProof = _createMockProof();

        vm.expectRevert("Invalid proof");
        policyContract.resolvePolicy(policyId, fdcProof);
    }

    function testResolvePolicyTransfersCoverage() public {
        uint256 policyId = _createAndClaimPolicy();

        vm.warp(startTime);

        uint256 balanceBefore = policyholder.balance;

        IWeb2Json.Proof memory fdcProof = _createMockProof();
        policyContract.resolvePolicy(policyId, fdcProof);

        uint256 balanceAfter = policyholder.balance;
        assertEq(balanceAfter - balanceBefore, COVERAGE, "Coverage not transferred");
    }

    function testResolvePolicyBurnsNFTs() public {
        uint256 policyId = _createAndClaimPolicy();

        vm.warp(startTime);

        WaterLevelPolicyNFT.Policy memory policy = policyContract.getPolicy(policyId);
        uint256 holderNFT = policy.policyholderNFT;
        uint256 insurerNFT = policy.insurerNFT;

        IWeb2Json.Proof memory fdcProof = _createMockProof();
        policyContract.resolvePolicy(policyId, fdcProof);

        vm.expectRevert();
        policyContract.ownerOf(holderNFT);

        vm.expectRevert();
        policyContract.ownerOf(insurerNFT);
    }

    function testResolvePolicyUpdatesStatus() public {
        uint256 policyId = _createAndClaimPolicy();

        vm.warp(startTime);

        IWeb2Json.Proof memory fdcProof = _createMockProof();
        policyContract.resolvePolicy(policyId, fdcProof);

        WaterLevelPolicyNFT.Policy memory policy = policyContract.getPolicy(policyId);
        assertTrue(
            policy.status == WaterLevelPolicyNFT.PolicyStatus.Settled,
            "Status should be Settled"
        );
    }

    function testResolvePolicyRemovesFromActive() public {
        uint256 policyId = _createAndClaimPolicy();

        vm.warp(startTime);

        uint256[] memory activesBefore = policyContract.getActivePolicies();
        assertEq(activesBefore.length, 1, "Should have 1 active policy");

        IWeb2Json.Proof memory fdcProof = _createMockProof();
        policyContract.resolvePolicy(policyId, fdcProof);

        uint256[] memory activesAfter = policyContract.getActivePolicies();
        assertEq(activesAfter.length, 0, "Should have 0 active policies after settlement");
    }

    function testResolvePolicyEmitsEvent() public {
        uint256 policyId = _createAndClaimPolicy();

        vm.warp(startTime);

        IWeb2Json.Proof memory fdcProof = _createMockProof();

        vm.expectEmit(true, true, false, true);
        emit PolicySettled(policyId, policyholder, COVERAGE);

        policyContract.resolvePolicy(policyId, fdcProof);
    }

    // ============ Expiration Tests ============

    function testExpirePolicy() public {
        uint256 policyId = _createAndClaimPolicy();

        vm.warp(endTime + 1);

        policyContract.expirePolicy(policyId);

        WaterLevelPolicyNFT.Policy memory policy = policyContract.getPolicy(policyId);
        assertTrue(
            policy.status == WaterLevelPolicyNFT.PolicyStatus.Settled,
            "Status should be Settled"
        );
    }

    function testExpirePolicyRevertsIfNotOpen() public {
        uint256 policyId = _createTestPolicy();

        vm.warp(endTime + 1);

        vm.expectRevert("Not open");
        policyContract.expirePolicy(policyId);
    }

    function testExpirePolicyRevertsIfNotExpired() public {
        uint256 policyId = _createAndClaimPolicy();

        vm.expectRevert("Not expired");
        policyContract.expirePolicy(policyId);
    }

    function testExpirePolicyTransfersToInsurer() public {
        uint256 policyId = _createAndClaimPolicy();

        vm.warp(endTime + 1);

        uint256 balanceBefore = insurer.balance;
        policyContract.expirePolicy(policyId);
        uint256 balanceAfter = insurer.balance;

        assertEq(balanceAfter - balanceBefore, COVERAGE, "Coverage not returned to insurer");
    }

    function testExpirePolicyBurnsNFTs() public {
        uint256 policyId = _createAndClaimPolicy();

        WaterLevelPolicyNFT.Policy memory policy = policyContract.getPolicy(policyId);
        uint256 holderNFT = policy.policyholderNFT;
        uint256 insurerNFT = policy.insurerNFT;

        vm.warp(endTime + 1);
        policyContract.expirePolicy(policyId);

        vm.expectRevert();
        policyContract.ownerOf(holderNFT);

        vm.expectRevert();
        policyContract.ownerOf(insurerNFT);
    }

    function testExpirePolicyRemovesFromActive() public {
        uint256 policyId = _createAndClaimPolicy();

        vm.warp(endTime + 1);
        policyContract.expirePolicy(policyId);

        uint256[] memory activesAfter = policyContract.getActivePolicies();
        assertEq(activesAfter.length, 0, "Should have 0 active policies");
    }

    function testExpirePolicyEmitsEvent() public {
        uint256 policyId = _createAndClaimPolicy();

        vm.warp(endTime + 1);

        vm.expectEmit(true, false, false, false);
        emit PolicyExpired(policyId);

        policyContract.expirePolicy(policyId);
    }

    // ============ Edge Cases ============

    function testMultiplePolicies() public {
        vm.startPrank(policyholder);

        uint256 policy1 = policyContract.createPolicy{value: PREMIUM}(
            GAUGE_ID,
            GAUGE_NAME,
            startTime,
            endTime,
            THRESHOLD,
            COVERAGE
        );

        uint256 policy2 = policyContract.createPolicy{value: PREMIUM}(
            GAUGE_ID,
            GAUGE_NAME,
            startTime + 100,
            endTime + 100,
            THRESHOLD,
            COVERAGE
        );

        vm.stopPrank();

        assertEq(policy1, 0, "First policy ID");
        assertEq(policy2, 1, "Second policy ID");

        vm.prank(insurer);
        policyContract.claimPolicy{value: COVERAGE}(policy1);

        vm.prank(insurer);
        policyContract.claimPolicy{value: COVERAGE}(policy2);

        uint256[] memory activePolicies = policyContract.getActivePolicies();
        assertEq(activePolicies.length, 2, "Should have 2 active policies");
    }

    function testNFTOwnershipTransfer() public {
        uint256 policyId = _createTestPolicy();

        WaterLevelPolicyNFT.Policy memory policy = policyContract.getPolicy(policyId);
        uint256 nftId = policy.policyholderNFT;

        vm.prank(policyholder);
        policyContract.transferFrom(policyholder, attacker, nftId);

        assertEq(policyContract.ownerOf(nftId), attacker, "NFT should be transferred");
    }

    function testTokenIdToPolicyMapping() public {
        uint256 policyId = _createTestPolicy();

        WaterLevelPolicyNFT.Policy memory policy = policyContract.getPolicy(policyId);

        assertEq(policyContract.tokenIdToPolicy(policy.policyholderNFT), policyId, "Token to policy mapping incorrect");
    }

    function testActiveListManagement() public {
        uint256 policy1 = _createTestPolicy();

        vm.startPrank(policyholder);
        uint256 policy2 = policyContract.createPolicy{value: PREMIUM}(
            GAUGE_ID,
            GAUGE_NAME,
            startTime + 100,
            endTime + 100,
            THRESHOLD,
            COVERAGE
        );
        vm.stopPrank();

        vm.prank(insurer);
        policyContract.claimPolicy{value: COVERAGE}(policy1);

        vm.prank(insurer);
        policyContract.claimPolicy{value: COVERAGE}(policy2);

        uint256[] memory activeBefore = policyContract.getActivePolicies();
        assertEq(activeBefore.length, 2, "Should have 2 active");

        vm.warp(startTime);

        IWeb2Json.Proof memory fdcProof = _createMockProof();
        policyContract.resolvePolicy(policy1, fdcProof);

        uint256[] memory activeAfter = policyContract.getActivePolicies();
        assertEq(activeAfter.length, 1, "Should have 1 active after settlement");
        assertEq(activeAfter[0], policy2, "Remaining policy should be policy2");
    }

    // ============ View Functions Tests ============

    function testGetPolicy() public {
        uint256 policyId = _createTestPolicy();

        WaterLevelPolicyNFT.Policy memory policy = policyContract.getPolicy(policyId);

        assertEq(policy.holder, policyholder, "Holder mismatch");
        assertEq(policy.objectID, GAUGE_ID, "Gauge ID mismatch");
        assertEq(policy.objectName, GAUGE_NAME, "Gauge name mismatch");
        assertEq(policy.premium, PREMIUM, "Premium mismatch");
        assertEq(policy.coverage, COVERAGE, "Coverage mismatch");
        assertEq(policy.waterLevelThreshold, THRESHOLD, "Threshold mismatch");
    }

    function testGetActivePolicies() public {
        uint256[] memory activeEmpty = policyContract.getActivePolicies();
        assertEq(activeEmpty.length, 0, "Should start with 0 active policies");

        uint256 policyId = _createAndClaimPolicy();

        uint256[] memory activeOne = policyContract.getActivePolicies();
        assertEq(activeOne.length, 1, "Should have 1 active policy");
        assertEq(activeOne[0], policyId, "Active policy ID mismatch");
    }

    // ============ Helper Functions ============

    function _createTestPolicy() internal returns (uint256) {
        vm.prank(policyholder);
        return policyContract.createPolicy{value: PREMIUM}(
            GAUGE_ID,
            GAUGE_NAME,
            startTime,
            endTime,
            THRESHOLD,
            COVERAGE
        );
    }

    function _createAndClaimPolicy() internal returns (uint256) {
        uint256 policyId = _createTestPolicy();

        vm.prank(insurer);
        policyContract.claimPolicy{value: COVERAGE}(policyId);

        return policyId;
    }

    function _createMockProof() internal view returns (IWeb2Json.Proof memory) {
        // Create mock DORIS data that matches the policy (water level exceeds threshold)
        // Must encode as DataTransportObject struct, not as tuple
        DataTransportObject memory dto = DataTransportObject({
            objectID: GAUGE_ID,
            value: int256(600000000),
            measureDate: int256(block.timestamp * 1000)
        });
        bytes memory abiEncodedData = abi.encode(dto);

        IWeb2Json.ResponseBody memory responseBody = IWeb2Json.ResponseBody({
            abiEncodedData: abiEncodedData
        });

        IWeb2Json.RequestBody memory requestBody = IWeb2Json.RequestBody({
            url: "https://mock.doris.at/api/gauge",
            httpMethod: "GET",
            headers: "{}",
            queryParams: "{}",
            body: "{}",
            postProcessJq: "{objectID: .objectID, value: .value, measureDate: .measureDate}",
            abiSignature: "(string,int256,int256)"
        });

        IWeb2Json.Response memory response = IWeb2Json.Response({
            attestationType: bytes32("Web2Json"),
            sourceId: bytes32("PublicWeb2"),
            votingRound: uint64(block.timestamp),
            lowestUsedTimestamp: uint64(block.timestamp - 1000),
            requestBody: requestBody,
            responseBody: responseBody
        });

        bytes32[] memory merkleProof = new bytes32[](1);
        merkleProof[0] = bytes32(0);

        return IWeb2Json.Proof({
            merkleProof: merkleProof,
            data: response
        });
    }
}
