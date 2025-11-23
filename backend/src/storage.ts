import fs from 'fs';
import path from 'path';
import { FdcSubmission } from './types';

/**
 * Storage interface - implement this for different backends (JSON, Redis, etc.)
 */
export interface IStorage {
  saveSubmission(submission: FdcSubmission): Promise<void>;
  getAllSubmissions(): Promise<FdcSubmission[]>;
  getPendingSubmissions(): Promise<FdcSubmission[]>;
  updateSubmissionStatus(policyId: number, status: 'completed' | 'failed'): Promise<void>;
  updateSubmissionWithProof(policyId: number, proof: any, waterLevel: number): Promise<void>;
  getSubmissionByPolicyId(policyId: number): Promise<FdcSubmission | null>;
}

/**
 * JSON file-based storage implementation
 * Simple and sufficient for hackathon/demo
 */
export class JsonStorage implements IStorage {
  private storageFile: string;

  constructor(storageFile?: string) {
    this.storageFile = storageFile || path.join(__dirname, '../data/submissions.json');
    this.initialize();
  }

  private initialize(): void {
    // Ensure data directory exists
    const dir = path.dirname(this.storageFile);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log('📁 Created data directory:', dir);
    }

    // Initialize empty file if doesn't exist
    if (!fs.existsSync(this.storageFile)) {
      fs.writeFileSync(this.storageFile, JSON.stringify([]));
      console.log('📄 Initialized storage file:', this.storageFile);
    }
  }

  async saveSubmission(submission: FdcSubmission): Promise<void> {
    const submissions = await this.getAllSubmissions();
    submissions.push(submission);
    fs.writeFileSync(this.storageFile, JSON.stringify(submissions, null, 2));
    console.log('💾 Saved submission for policy', submission.policyId);
  }

  async getAllSubmissions(): Promise<FdcSubmission[]> {
    const data = fs.readFileSync(this.storageFile, 'utf-8');
    return JSON.parse(data);
  }

  async getPendingSubmissions(): Promise<FdcSubmission[]> {
    const all = await this.getAllSubmissions();
    return all.filter(s => s.status === 'pending');
  }

  async updateSubmissionStatus(policyId: number, status: 'completed' | 'failed'): Promise<void> {
    const submissions = await this.getAllSubmissions();
    const index = submissions.findIndex(s => s.policyId === policyId && s.status === 'pending');

    if (index !== -1) {
      submissions[index].status = status;
      fs.writeFileSync(this.storageFile, JSON.stringify(submissions, null, 2));
      console.log(`✅ Updated policy ${policyId} status to ${status}`);
    }
  }

  async updateSubmissionWithProof(policyId: number, proof: any, waterLevel: number): Promise<void> {
    const submissions = await this.getAllSubmissions();
    const index = submissions.findIndex(s => s.policyId === policyId);

    if (index !== -1) {
      submissions[index].proof = proof;
      submissions[index].waterLevel = waterLevel;
      submissions[index].proofTimestamp = Math.floor(Date.now() / 1000);
      fs.writeFileSync(this.storageFile, JSON.stringify(submissions, null, 2));
      console.log(`✅ Saved proof for policy ${policyId}`);
    }
  }

  async getSubmissionByPolicyId(policyId: number): Promise<FdcSubmission | null> {
    const all = await this.getAllSubmissions();
    return all.find(s => s.policyId === policyId) || null;
  }
}

/**
 * Redis storage implementation (stub for future use)
 * Uncomment and implement when Redis is available
 */
/*
import Redis from 'ioredis';

export class RedisStorage implements IStorage {
  private redis: Redis;
  private keyPrefix = 'fdc:submission:';

  constructor(redisUrl?: string) {
    this.redis = new Redis(redisUrl || process.env.REDIS_URL || 'redis://localhost:6379');
    console.log('✅ Redis storage initialized');
  }

  async saveSubmission(submission: FdcSubmission): Promise<void> {
    const key = `${this.keyPrefix}${submission.policyId}`;
    await this.redis.set(key, JSON.stringify(submission));
    console.log('💾 Saved submission to Redis for policy', submission.policyId);
  }

  async getAllSubmissions(): Promise<FdcSubmission[]> {
    const keys = await this.redis.keys(`${this.keyPrefix}*`);
    const submissions: FdcSubmission[] = [];

    for (const key of keys) {
      const data = await this.redis.get(key);
      if (data) submissions.push(JSON.parse(data));
    }

    return submissions;
  }

  async getPendingSubmissions(): Promise<FdcSubmission[]> {
    const all = await this.getAllSubmissions();
    return all.filter(s => s.status === 'pending');
  }

  async updateSubmissionStatus(policyId: number, status: 'completed' | 'failed'): Promise<void> {
    const key = `${this.keyPrefix}${policyId}`;
    const data = await this.redis.get(key);

    if (data) {
      const submission = JSON.parse(data);
      submission.status = status;
      await this.redis.set(key, JSON.stringify(submission));
      console.log(`✅ Updated policy ${policyId} status to ${status}`);
    }
  }

  async getSubmissionByPolicyId(policyId: number): Promise<FdcSubmission | null> {
    const key = `${this.keyPrefix}${policyId}`;
    const data = await this.redis.get(key);
    return data ? JSON.parse(data) : null;
  }
}
*/

/**
 * Storage factory - creates the appropriate storage implementation
 * Set STORAGE_TYPE env var to switch implementations: 'json' | 'redis'
 */
export function createStorage(): IStorage {
  const storageType = process.env.STORAGE_TYPE || 'json';

  switch (storageType) {
    case 'json':
      console.log('📦 Using JSON file storage');
      return new JsonStorage();

    // case 'redis':
    //   console.log('📦 Using Redis storage');
    //   return new RedisStorage();

    default:
      console.log('📦 Using default JSON file storage');
      return new JsonStorage();
  }
}

// Export singleton instance
export const storage: IStorage = createStorage();
