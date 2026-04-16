import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  VectorStoreFactory,
  createVectorStoreFactory,
  getVectorStoreFactory,
  resetVectorStoreFactory,
  getVectorStoreType,
  getQdrantUrl,
  getQdrantApiKey,
  DEFAULT_FACTORY_CONFIG,
  VectorStoreType,
} from '../retrieval/vector-store-factory.js';

describe('VectorStoreFactory', () => {
  beforeEach(() => {
    // Reset global factory before each test
    resetVectorStoreFactory();
  });

  afterEach(() => {
    // Clean up after each test
    resetVectorStoreFactory();
  });

  describe('environment functions', () => {
    it('should return in-memory type by default', () => {
      // Clear environment variable
      const originalValue = process.env.VECTOR_STORE_TYPE;
      delete process.env.VECTOR_STORE_TYPE;

      const type = getVectorStoreType();
      expect(type).toBe('in-memory');

      // Restore original value
      if (originalValue) {
        process.env.VECTOR_STORE_TYPE = originalValue;
      }
    });

    it('should return qdrant type when environment variable is set', () => {
      const originalValue = process.env.VECTOR_STORE_TYPE;
      process.env.VECTOR_STORE_TYPE = 'qdrant';

      const type = getVectorStoreType();
      expect(type).toBe('qdrant');

      // Restore original value
      if (originalValue !== undefined) {
        process.env.VECTOR_STORE_TYPE = originalValue;
      } else {
        delete process.env.VECTOR_STORE_TYPE;
      }
    });

    it('should handle case-insensitive type', () => {
      const originalValue = process.env.VECTOR_STORE_TYPE;
      process.env.VECTOR_STORE_TYPE = 'QDRANT';

      const type = getVectorStoreType();
      expect(type).toBe('qdrant');

      // Restore original value
      if (originalValue !== undefined) {
        process.env.VECTOR_STORE_TYPE = originalValue;
      } else {
        delete process.env.VECTOR_STORE_TYPE;
      }
    });

    it('should return default Qdrant URL', () => {
      const originalValue = process.env.QDRANT_URL;
      delete process.env.QDRANT_URL;

      const url = getQdrantUrl();
      expect(url).toBe('http://localhost:6333');

      // Restore original value
      if (originalValue) {
        process.env.QDRANT_URL = originalValue;
      }
    });

    it('should return custom Qdrant URL from environment', () => {
      const originalValue = process.env.QDRANT_URL;
      process.env.QDRANT_URL = 'http://custom-qdrant:6333';

      const url = getQdrantUrl();
      expect(url).toBe('http://custom-qdrant:6333');

      // Restore original value
      if (originalValue !== undefined) {
        process.env.QDRANT_URL = originalValue;
      } else {
        delete process.env.QDRANT_URL;
      }
    });

    it('should return undefined API key when not set', () => {
      const originalValue = process.env.QDRANT_API_KEY;
      delete process.env.QDRANT_API_KEY;

      const apiKey = getQdrantApiKey();
      expect(apiKey).toBeUndefined();

      // Restore original value
      if (originalValue) {
        process.env.QDRANT_API_KEY = originalValue;
      }
    });

    it('should return API key from environment', () => {
      const originalValue = process.env.QDRANT_API_KEY;
      process.env.QDRANT_API_KEY = 'test-api-key';

      const apiKey = getQdrantApiKey();
      expect(apiKey).toBe('test-api-key');

      // Restore original value
      if (originalValue !== undefined) {
        process.env.QDRANT_API_KEY = originalValue;
      } else {
        delete process.env.QDRANT_API_KEY;
      }
    });
  });

  describe('DEFAULT_FACTORY_CONFIG', () => {
    it('should have valid default configuration', () => {
      expect(DEFAULT_FACTORY_CONFIG.type).toBeDefined();
      expect(DEFAULT_FACTORY_CONFIG.qdrant).toBeDefined();
      expect(DEFAULT_FACTORY_CONFIG.qdrant!.url).toBeDefined();
      expect(DEFAULT_FACTORY_CONFIG.qdrant!.timeoutMs).toBe(10000);
    });
  });

  describe('VectorStoreFactory class', () => {
    it('should create factory with default config', () => {
      const factory = createVectorStoreFactory();
      expect(factory).toBeDefined();
      expect(factory.getType()).toBeDefined();
    });

    it('should create factory with custom config', () => {
      const factory = createVectorStoreFactory({
        type: 'in-memory',
      });

      expect(factory.getType()).toBe('in-memory');
    });

    it('should create factory with qdrant config', () => {
      const factory = createVectorStoreFactory({
        type: 'qdrant',
        qdrant: {
          url: 'http://custom:6333',
          apiKey: 'test-key',
          timeoutMs: 5000,
        },
      });

      expect(factory.getType()).toBe('qdrant');
      const config = factory.getConfig();
      expect(config.qdrant!.url).toBe('http://custom:6333');
      expect(config.qdrant!.apiKey).toBe('test-key');
      expect(config.qdrant!.timeoutMs).toBe(5000);
    });

    it('should return configuration', () => {
      const factory = createVectorStoreFactory({ type: 'in-memory' });
      const config = factory.getConfig();

      expect(config.type).toBe('in-memory');
      expect(config).toHaveProperty('qdrant');
    });

    it('should not be ready before initialization', () => {
      const factory = createVectorStoreFactory({ type: 'in-memory' });
      expect(factory.isReady()).toBe(false);
    });

    it('should throw error when getting adapter before initialization', () => {
      const factory = createVectorStoreFactory({ type: 'in-memory' });

      expect(() => factory.getAdapter()).toThrow('Vector store adapter not initialized');
    });

    it('should initialize in-memory adapter', async () => {
      const factory = createVectorStoreFactory({ type: 'in-memory' });
      const adapter = await factory.createAdapter();

      expect(adapter).toBeDefined();
      expect(adapter.isReady()).toBe(true);
      expect(factory.isReady()).toBe(true);
    });

    it('should return same adapter on subsequent calls', async () => {
      const factory = createVectorStoreFactory({ type: 'in-memory' });
      const adapter1 = await factory.createAdapter();
      const adapter2 = await factory.createAdapter();

      expect(adapter1).toBe(adapter2);
    });

    it('should handle concurrent initialization', async () => {
      const factory = createVectorStoreFactory({ type: 'in-memory' });

      // Call createAdapter multiple times concurrently
      const promises = [
        factory.createAdapter(),
        factory.createAdapter(),
        factory.createAdapter(),
      ];

      const adapters = await Promise.all(promises);

      // All should return the same adapter
      expect(adapters[0]).toBe(adapters[1]);
      expect(adapters[1]).toBe(adapters[2]);
    });

    it('should shutdown adapter', async () => {
      const factory = createVectorStoreFactory({ type: 'in-memory' });
      await factory.createAdapter();
      expect(factory.isReady()).toBe(true);

      await factory.shutdown();
      expect(factory.isReady()).toBe(false);
    });
  });

  describe('global factory', () => {
    it('should create global factory', () => {
      const factory = getVectorStoreFactory();
      expect(factory).toBeDefined();
    });

    it('should return same global factory on multiple calls', () => {
      const factory1 = getVectorStoreFactory();
      const factory2 = getVectorStoreFactory();

      expect(factory1).toBe(factory2);
    });

    it('should reset global factory', () => {
      const factory1 = getVectorStoreFactory();
      resetVectorStoreFactory();
      const factory2 = getVectorStoreFactory();

      expect(factory1).not.toBe(factory2);
    });
  });

  describe('qdrant fallback', () => {
    it('should fallback to in-memory when qdrant fails', async () => {
      // Use invalid URL to force failure
      const factory = createVectorStoreFactory({
        type: 'qdrant',
        qdrant: {
          url: 'http://invalid-host:99999', // Invalid URL
          timeoutMs: 1000,
        },
      });

      // Should fallback to in-memory after timeout/failure
      const adapter = await factory.createAdapter();

      expect(factory.getType()).toBe('in-memory'); // Type should change
      expect(adapter.isReady()).toBe(true);
    });
  });

  describe('Type definitions', () => {
    it('should accept valid VectorStoreType values', () => {
      const type1: VectorStoreType = 'qdrant';
      const type2: VectorStoreType = 'in-memory';

      expect(type1).toBe('qdrant');
      expect(type2).toBe('in-memory');
    });
  });
});