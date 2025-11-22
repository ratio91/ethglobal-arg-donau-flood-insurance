/**
 * MultiBaaS Integration Tests
 *
 * Note: These are integration tests that require the actual MultiBaaS SDK to be configured.
 * They test that our wrapper functions handle SDK responses correctly.
 * For full integration testing with a live MultiBaaS instance, run these tests
 * in a separate integration test suite.
 */

describe('MultiBaaS Integration', () => {
  describe('Module exports', () => {
    it('should export contractsApi', () => {
      const multibaas = require('../src/multibaas');
      expect(multibaas.contractsApi).toBeDefined();
    });

    it('should export chainsApi', () => {
      const multibaas = require('../src/multibaas');
      expect(multibaas.chainsApi).toBeDefined();
    });

    it('should export getActivePolicies function', () => {
      const multibaas = require('../src/multibaas');
      expect(typeof multibaas.getActivePolicies).toBe('function');
    });

    it('should export getPolicy function', () => {
      const multibaas = require('../src/multibaas');
      expect(typeof multibaas.getPolicy).toBe('function');
    });

    it('should export resolvePolicy function', () => {
      const multibaas = require('../src/multibaas');
      expect(typeof multibaas.resolvePolicy).toBe('function');
    });

    it('should export getChainStatus function', () => {
      const multibaas = require('../src/multibaas');
      expect(typeof multibaas.getChainStatus).toBe('function');
    });
  });

  describe('Error handling', () => {
    it('getActivePolicies should handle errors gracefully', async () => {
      const multibaas = require('../src/multibaas');

      // Mock a failed API call
      const original = multibaas.contractsApi.callContractFunction;
      multibaas.contractsApi.callContractFunction = jest.fn().mockRejectedValue(new Error('API Error'));

      const result = await multibaas.getActivePolicies();

      expect(result).toEqual([]);

      // Restore
      multibaas.contractsApi.callContractFunction = original;
    });

    it('getPolicy should return null on error', async () => {
      const multibaas = require('../src/multibaas');

      // Mock a failed API call
      const original = multibaas.contractsApi.callContractFunction;
      multibaas.contractsApi.callContractFunction = jest.fn().mockRejectedValue(new Error('Policy not found'));

      const result = await multibaas.getPolicy(999);

      expect(result).toBeNull();

      // Restore
      multibaas.contractsApi.callContractFunction = original;
    });

    it('resolvePolicy should return null on error', async () => {
      const multibaas = require('../src/multibaas');

      // Mock a failed API call
      const original = multibaas.contractsApi.callContractFunction;
      multibaas.contractsApi.callContractFunction = jest.fn().mockRejectedValue(new Error('Resolution failed'));

      const result = await multibaas.resolvePolicy(1, { data: {} });

      expect(result).toBeNull();

      // Restore
      multibaas.contractsApi.callContractFunction = original;
    });
  });
});
