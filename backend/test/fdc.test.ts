import { calculateRoundId, prepareFdcRequest, retrieveFdcProof, testDorisApi } from '../src/fdc';

// Mock fetch globally
global.fetch = jest.fn();

describe('FDC Functions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('calculateRoundId', () => {
    it('should calculate correct round ID for a given timestamp', () => {
      const timestamp = 1700000000; // Example timestamp
      const FIRST_VOTING_ROUND_START_TS = 1658429955; // Coston2 testnet
      const expectedRoundId = Math.floor((timestamp - FIRST_VOTING_ROUND_START_TS) / 90);

      const roundId = calculateRoundId(timestamp);

      expect(roundId).toBe(expectedRoundId);
    });

    it('should handle timestamp at first voting round start', () => {
      const FIRST_VOTING_ROUND_START_TS = 1658429955; // Coston2 testnet
      const roundId = calculateRoundId(FIRST_VOTING_ROUND_START_TS);
      expect(roundId).toBe(0);
    });

    it('should return different round IDs for timestamps 90 seconds apart', () => {
      const timestamp1 = 1700000000;
      const timestamp2 = timestamp1 + 90;

      const roundId1 = calculateRoundId(timestamp1);
      const roundId2 = calculateRoundId(timestamp2);

      expect(roundId2).toBe(roundId1 + 1);
    });

    it('should return same round ID for timestamps within same 90s window', () => {
      // Use a timestamp that's not on a 90-second boundary
      const timestamp1 = 1700000045; // 45 seconds into a round
      const timestamp2 = timestamp1 + 44; // Still within same round (89s total)

      const roundId1 = calculateRoundId(timestamp1);
      const roundId2 = calculateRoundId(timestamp2);

      // Both timestamps should be in the same 90-second window
      expect(roundId1).toBe(roundId2);
    });
  });

  describe('prepareFdcRequest', () => {
    it('should successfully prepare FDC request', async () => {
      const mockResponse = {
        abiEncodedRequest: '0x123456789abcdef',
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const objectID = '200032';
      const result = await prepareFdcRequest(objectID);

      expect(result).toBe(mockResponse.abiEncodedRequest);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/Web2Json/prepareRequest'),
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: expect.stringContaining(objectID),
        })
      );
    });

    it('should return null on API error', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        text: async () => 'API Error',
      });

      const result = await prepareFdcRequest('200032');

      expect(result).toBeNull();
    });

    it('should handle network errors', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      const result = await prepareFdcRequest('200032');

      expect(result).toBeNull();
    });

    it('should include correct DORIS API URL in request body', async () => {
      const mockResponse = { abiEncodedRequest: '0xabc' };
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const objectID = '200032';
      await prepareFdcRequest(objectID);

      const callArgs = (global.fetch as jest.Mock).mock.calls[0];
      const body = JSON.parse(callArgs[1].body);

      expect(body.url).toBe(`https://hydro.oesterreich.gv.at/api/station/${objectID}/messdaten/waterlevel/now`);
    });
  });

  describe('retrieveFdcProof', () => {
    it('should successfully retrieve proof', async () => {
      const mockProof = {
        merkleProof: ['0xabc', '0xdef'],
        data: { objectID: '200032', value: 12345, measureDate: 1700000000 },
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ proof: mockProof }),
      });

      const roundId = 18888888;
      const abiEncodedRequest = '0x123456';
      const result = await retrieveFdcProof(roundId, abiEncodedRequest);

      expect(result).toEqual(mockProof);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining(`/Web2Json/proof/${roundId}`),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ abiEncodedRequest }),
        })
      );
    });

    it('should return null when proof is not ready', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ proof: null }),
      });

      const result = await retrieveFdcProof(18888888, '0x123456');

      expect(result).toBeNull();
    });

    it('should return null when proof is missing from response', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

      const result = await retrieveFdcProof(18888888, '0x123456');

      expect(result).toBeNull();
    });

    it('should handle API errors', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        text: async () => 'Proof not found',
      });

      const result = await retrieveFdcProof(18888888, '0x123456');

      expect(result).toBeNull();
    });

    it('should handle network errors', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      const result = await retrieveFdcProof(18888888, '0x123456');

      expect(result).toBeNull();
    });
  });

  describe('testDorisApi', () => {
    it('should successfully fetch DORIS data', async () => {
      const mockDorisResponse = {
        objectID: '200032',
        value: 12345,
        measureDate: 1700000000,
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockDorisResponse,
      });

      const result = await testDorisApi('200032');

      expect(result).toEqual(mockDorisResponse);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://hydro.oesterreich.gv.at/api/station/200032/messdaten/waterlevel/now'
      );
    });

    it('should return null on API error', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        statusText: 'Not Found',
      });

      const result = await testDorisApi('999999');

      expect(result).toBeNull();
    });

    it('should handle network errors', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      const result = await testDorisApi('200032');

      expect(result).toBeNull();
    });
  });
});
