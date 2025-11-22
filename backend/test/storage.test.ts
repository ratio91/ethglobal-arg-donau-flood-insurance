import fs from 'fs';
import path from 'path';
import { JsonStorage } from '../src/storage';
import { FdcSubmission } from '../src/types';

describe('JsonStorage', () => {
  let storage: JsonStorage;
  let testStorageFile: string;

  beforeEach(() => {
    // Create a temporary storage file for testing
    testStorageFile = path.join(__dirname, `test-storage-${Date.now()}.json`);
    storage = new JsonStorage(testStorageFile);
  });

  afterEach(() => {
    // Clean up test file
    if (fs.existsSync(testStorageFile)) {
      fs.unlinkSync(testStorageFile);
    }
  });

  describe('initialization', () => {
    it('should create storage file if it does not exist', () => {
      expect(fs.existsSync(testStorageFile)).toBe(true);
    });

    it('should initialize with empty array', async () => {
      const submissions = await storage.getAllSubmissions();
      expect(submissions).toEqual([]);
    });
  });

  describe('saveSubmission', () => {
    it('should save a new submission', async () => {
      const submission: FdcSubmission = {
        policyId: 1,
        abiEncodedRequest: '0x123456',
        roundId: 18888888,
        timestamp: Math.floor(Date.now() / 1000),
        status: 'pending',
      };

      await storage.saveSubmission(submission);

      const submissions = await storage.getAllSubmissions();
      expect(submissions).toHaveLength(1);
      expect(submissions[0]).toEqual(submission);
    });

    it('should save multiple submissions', async () => {
      const submission1: FdcSubmission = {
        policyId: 1,
        abiEncodedRequest: '0x123456',
        roundId: 18888888,
        timestamp: Math.floor(Date.now() / 1000),
        status: 'pending',
      };

      const submission2: FdcSubmission = {
        policyId: 2,
        abiEncodedRequest: '0xabcdef',
        roundId: 18888889,
        timestamp: Math.floor(Date.now() / 1000) + 90,
        status: 'pending',
      };

      await storage.saveSubmission(submission1);
      await storage.saveSubmission(submission2);

      const submissions = await storage.getAllSubmissions();
      expect(submissions).toHaveLength(2);
      expect(submissions[0]).toEqual(submission1);
      expect(submissions[1]).toEqual(submission2);
    });
  });

  describe('getPendingSubmissions', () => {
    it('should return only pending submissions', async () => {
      const pendingSubmission: FdcSubmission = {
        policyId: 1,
        abiEncodedRequest: '0x123456',
        roundId: 18888888,
        timestamp: Math.floor(Date.now() / 1000),
        status: 'pending',
      };

      const completedSubmission: FdcSubmission = {
        policyId: 2,
        abiEncodedRequest: '0xabcdef',
        roundId: 18888889,
        timestamp: Math.floor(Date.now() / 1000),
        status: 'completed',
      };

      await storage.saveSubmission(pendingSubmission);
      await storage.saveSubmission(completedSubmission);

      const pending = await storage.getPendingSubmissions();
      expect(pending).toHaveLength(1);
      expect(pending[0]).toEqual(pendingSubmission);
    });

    it('should return empty array when no pending submissions', async () => {
      const completedSubmission: FdcSubmission = {
        policyId: 1,
        abiEncodedRequest: '0x123456',
        roundId: 18888888,
        timestamp: Math.floor(Date.now() / 1000),
        status: 'completed',
      };

      await storage.saveSubmission(completedSubmission);

      const pending = await storage.getPendingSubmissions();
      expect(pending).toEqual([]);
    });
  });

  describe('updateSubmissionStatus', () => {
    it('should update status of a pending submission', async () => {
      const submission: FdcSubmission = {
        policyId: 1,
        abiEncodedRequest: '0x123456',
        roundId: 18888888,
        timestamp: Math.floor(Date.now() / 1000),
        status: 'pending',
      };

      await storage.saveSubmission(submission);
      await storage.updateSubmissionStatus(1, 'completed');

      const submissions = await storage.getAllSubmissions();
      expect(submissions[0].status).toBe('completed');
    });

    it('should not update status of non-pending submission', async () => {
      const submission: FdcSubmission = {
        policyId: 1,
        abiEncodedRequest: '0x123456',
        roundId: 18888888,
        timestamp: Math.floor(Date.now() / 1000),
        status: 'completed',
      };

      await storage.saveSubmission(submission);
      await storage.updateSubmissionStatus(1, 'failed');

      const submissions = await storage.getAllSubmissions();
      expect(submissions[0].status).toBe('completed'); // Should remain completed
    });

    it('should do nothing when policyId not found', async () => {
      await storage.updateSubmissionStatus(999, 'completed');

      const submissions = await storage.getAllSubmissions();
      expect(submissions).toHaveLength(0);
    });

    it('should update to failed status', async () => {
      const submission: FdcSubmission = {
        policyId: 1,
        abiEncodedRequest: '0x123456',
        roundId: 18888888,
        timestamp: Math.floor(Date.now() / 1000),
        status: 'pending',
      };

      await storage.saveSubmission(submission);
      await storage.updateSubmissionStatus(1, 'failed');

      const submissions = await storage.getAllSubmissions();
      expect(submissions[0].status).toBe('failed');
    });
  });

  describe('getSubmissionByPolicyId', () => {
    it('should return submission for given policy ID', async () => {
      const submission: FdcSubmission = {
        policyId: 1,
        abiEncodedRequest: '0x123456',
        roundId: 18888888,
        timestamp: Math.floor(Date.now() / 1000),
        status: 'pending',
      };

      await storage.saveSubmission(submission);

      const result = await storage.getSubmissionByPolicyId(1);
      expect(result).toEqual(submission);
    });

    it('should return null when policy ID not found', async () => {
      const result = await storage.getSubmissionByPolicyId(999);
      expect(result).toBeNull();
    });

    it('should return first submission when multiple submissions for same policy', async () => {
      const submission1: FdcSubmission = {
        policyId: 1,
        abiEncodedRequest: '0x123456',
        roundId: 18888888,
        timestamp: Math.floor(Date.now() / 1000),
        status: 'completed',
      };

      const submission2: FdcSubmission = {
        policyId: 1,
        abiEncodedRequest: '0xabcdef',
        roundId: 18888889,
        timestamp: Math.floor(Date.now() / 1000) + 90,
        status: 'pending',
      };

      await storage.saveSubmission(submission1);
      await storage.saveSubmission(submission2);

      const result = await storage.getSubmissionByPolicyId(1);
      expect(result).toEqual(submission1); // Returns first one found
    });
  });

  describe('persistence', () => {
    it('should persist data across storage instances', async () => {
      const submission: FdcSubmission = {
        policyId: 1,
        abiEncodedRequest: '0x123456',
        roundId: 18888888,
        timestamp: Math.floor(Date.now() / 1000),
        status: 'pending',
      };

      await storage.saveSubmission(submission);

      // Create new storage instance with same file
      const storage2 = new JsonStorage(testStorageFile);
      const submissions = await storage2.getAllSubmissions();

      expect(submissions).toHaveLength(1);
      expect(submissions[0]).toEqual(submission);
    });
  });
});
