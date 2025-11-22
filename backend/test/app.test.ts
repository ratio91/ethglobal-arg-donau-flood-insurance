import request from 'supertest';
import { app } from '../src/app';

// Mock dependencies
jest.mock('../src/multibaas', () => ({
  contractsApi: {},
  chainsApi: {},
  getActivePolicies: jest.fn().mockResolvedValue([]),
  getPolicy: jest.fn().mockResolvedValue(null),
  resolvePolicy: jest.fn().mockResolvedValue(null),
}));

jest.mock('../src/fdc', () => ({
  prepareFdcRequest: jest.fn().mockResolvedValue('0x123'),
  retrieveFdcProof: jest.fn().mockResolvedValue(null),
  calculateRoundId: jest.fn().mockReturnValue(18888888),
}));

jest.mock('../src/storage', () => ({
  storage: {
    getAllSubmissions: jest.fn().mockResolvedValue([]),
    getPendingSubmissions: jest.fn().mockResolvedValue([]),
    getSubmissionByPolicyId: jest.fn().mockResolvedValue(null),
    saveSubmission: jest.fn().mockResolvedValue(undefined),
    updateSubmissionStatus: jest.fn().mockResolvedValue(undefined),
  },
}));

describe('Express App', () => {
  describe('GET /health', () => {
    it('should return health status', async () => {
      const response = await request(app).get('/health');
      expect(response.status).toBe(200);
      expect(response.body.status).toBe('ok');
    });
  });

  describe('POST /webhook', () => {
    it('should accept webhook event', async () => {
      const event = {
        id: '123',
        event: 'event.emitted',
        data: { eventName: 'PolicyCreated', args: [1] },
      };
      const response = await request(app).post('/webhook').send(event);
      expect(response.status).toBe(200);
      expect(response.body.received).toBe(true);
    });
  });

  describe('GET /submissions', () => {
    it('should return submissions', async () => {
      const response = await request(app).get('/submissions');
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('total');
      expect(response.body).toHaveProperty('submissions');
    });
  });
});
