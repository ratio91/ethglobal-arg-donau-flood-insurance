export enum PolicyStatus {
  Active = 0,
  Settled = 1,
  Expired = 2,
}

export interface Policy {
  policyId: number;
  holder: string;
  objectID: string;
  objectName: string;
  waterLevelThreshold: bigint;
  coverage: bigint;
  premium: bigint;
  startTime: number;
  endTime: number;
  settled: boolean;
  payoutAmount: bigint;
  fdcRequestSubmitted: boolean;
  fdcProofRetrieved: boolean;
}

export interface PolicyFormData {
  objectID: string;
  objectName: string;
  waterLevelThreshold: string;
  coverage: string;
  durationHours: number;
  premium: string;
}
