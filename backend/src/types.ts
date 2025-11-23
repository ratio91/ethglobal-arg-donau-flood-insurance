/**
 * Policy data structure from WaterLevelPolicyNFT contract
 */
export interface Policy {
  holder: string;
  objectID: string;
  objectName: string;
  startTimestamp: bigint;
  expirationTimestamp: bigint;
  waterLevelThreshold: bigint;
  premium: bigint;
  coverage: bigint;
  status: number; // 0=Unclaimed, 1=Open, 2=Settled
  policyholderNFT: bigint;
  insurerNFT: bigint;
}

/**
 * Policy status enum
 */
export enum PolicyStatus {
  Unclaimed = 0,
  Open = 1,
  Settled = 2,
}

/**
 * FDC submission tracking for local storage
 */
export interface FdcSubmission {
  policyId: number;
  objectID?: string; // Gauge ID for fetching water level data
  abiEncodedRequest: string;
  roundId: number;
  timestamp: number;
  status: 'pending' | 'completed' | 'failed';
  proof?: any; // Store the full FDC proof when retrieved
  waterLevel?: number; // Extracted water level from proof
  proofTimestamp?: number; // When proof was retrieved
}

/**
 * DORIS water level data structure - matches the contract's DataTransportObject
 */
export interface DataTransportObject {
  objectID: string;
  value: bigint;
  measureDate: bigint;
}

/**
 * MultiBaaS webhook event payload
 */
export interface WebhookEvent {
  id: string;
  event: 'transaction.included' | 'event.emitted';
  data: {
    eventName?: string;
    args?: any[];
    [key: string]: any;
  };
}
