/**
 * Unit tests for LocalTextEmbeddingService
 * Uses mocks for embedding generation to avoid model loading in tests
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { LocalTextEmbeddingService, LocalEmbeddingError, LOCAL_MODEL_CONFIGS } from '../embedding/local-embedding-service.js';

// Mock must be defined inside vi.mock factory due to hoisting
vi.mock('@huggingface/transformers', () => {
  const mockExtractor = async (input: string | string[], options?: any) => {
    const dim = 384;
    if (Array.isArray(input)) {
      // Batch processing
      const data = new Float32Array(input.length * dim);
      for (let i = 0; i < input.length; i++) {
        for (let j = 0; j < dim; j++) {
          data[i * dim + j] = (input[i]!.length + j) / (dim * 2);
        }
      }
      return {
        data,
        dims: [input.length, dim],
      };
    } else {
      // Single text
      const data = new Float32Array(dim);
      for (let i = 0; i < dim; i++) {
        data[i] = (input.length + i) / (dim * 2);
      }
      return {
        data,
        dims: [1, dim],
      };
    }
  };

  return {
    pipeline: vi.fn().mockResolvedValue(mockExtractor),
    env: {
      cacheDir: '',
      remoteHost: '',
      allowRemoteModels: true,
    },
  };
});

describe('LocalTextEmbeddingService', () => {
  let service: LocalTextEmbeddingService;

  beforeEach(async () => {
    vi.clearAllMocks();
    service = new LocalTextEmbeddingService('multilingual-e5-small');
    // Trigger initialization
    await service.embedText('init');
  });

  afterEach(() => {
    service.clearCache();
  });

  describe('initialization', () => {
    it('should create service with default model', () => {
      const defaultService = new LocalTextEmbeddingService();
      expect(defaultService.getId()).toBe('multilingual-e5-small');
      expect(defaultService.getDimension()).toBe(384);
    });

    it('should create service with specified model', () => {
      const customService = new LocalTextEmbeddingService('all-MiniLM-L6-v2');
      expect(customService.getId()).toBe('all-MiniLM-L6-v2');
    });

    it('should report correct dimension', () => {
      expect(service.getDimension()).toBe(384);
    });

    it('should not support images', () => {
      expect(service.supportsImages()).toBe(false);
    });

    it('should be ready after initialization', async () => {
      const newService = new LocalTextEmbeddingService('multilingual-e5-small');
      expect(newService.isReady()).toBe(false);
      await newService.embedText('test');
      expect(newService.isReady()).toBe(true);
    });
  });

  describe('Chinese text embedding', () => {
    it('should generate embedding for Chinese text', async () => {
      const text = '这是一段中文测试文本';
      const embedding = await service.embedText(text);

      expect(embedding).toBeInstanceOf(Array);
      expect(embedding.length).toBe(384);
      expect(embedding.every(v => typeof v === 'number')).toBe(true);
    });

    it('should generate consistent embeddings for same Chinese text', async () => {
      const text = '加班规定和假期安排';
      const embedding1 = await service.embedText(text);
      const embedding2 = await service.embedText(text);

      expect(embedding1).toEqual(embedding2);
    });

    it('should generate different embeddings for different Chinese texts', async () => {
      const text1 = '员工手册规定加班需要提前申请';
      const text2 = '公司财务报表显示收入增长';

      const embedding1 = await service.embedText(text1);
      const embedding2 = await service.embedText(text2);

      // Different texts should have different embeddings
      expect(embedding1).not.toEqual(embedding2);
    });
  });

  describe('English text embedding', () => {
    it('should generate embedding for English text', async () => {
      const text = 'This is an English test text';
      const embedding = await service.embedText(text);

      expect(embedding).toBeInstanceOf(Array);
      expect(embedding.length).toBe(384);
    });

    it('should generate consistent embeddings for same English text', async () => {
      const text = 'Overtime regulations and holiday arrangements';
      const embedding1 = await service.embedText(text);
      const embedding2 = await service.embedText(text);

      expect(embedding1).toEqual(embedding2);
    });
  });

  describe('batch processing', () => {
    it('should generate embeddings for multiple texts', async () => {
      const texts = [
        '中文文本一',
        '中文文本二',
        'English text one',
        'English text two',
      ];

      const embeddings = await service.embedTexts(texts);

      expect(embeddings.length).toBe(4);
      expect(embeddings.every(e => e.length === 384)).toBe(true);
    });

    it('should handle batch efficiently', async () => {
      const texts = Array.from({ length: 10 }, (_, i) => `测试文本 ${i}`);

      const embeddings = await service.embedTexts(texts);

      expect(embeddings.length).toBe(10);
    });
  });

  describe('error handling', () => {
    it('should throw error for empty text', async () => {
      await expect(service.embedText('')).rejects.toThrow(LocalEmbeddingError);
    });

    it('should throw error for whitespace-only text', async () => {
      await expect(service.embedText('   ')).rejects.toThrow(LocalEmbeddingError);
    });

    it('should throw error for empty array', async () => {
      await expect(service.embedTexts([''])).rejects.toThrow(LocalEmbeddingError);
    });
  });

  describe('caching', () => {
    it('should cache embeddings', async () => {
      const text = '测试缓存功能';

      // First call
      await service.embedText(text);
      const stats1 = service.getCacheStats();
      expect(stats1.size).toBeGreaterThan(0);

      // Second call should use cache
      await service.embedText(text);
      const stats2 = service.getCacheStats();
      expect(stats2.size).toBe(stats1.size);
    });

    it('should clear cache', async () => {
      await service.embedText('test');
      service.clearCache();
      const stats = service.getCacheStats();
      expect(stats.size).toBe(0);
    });

    it('should respect max cache size', () => {
      service.setMaxCacheSize(2);
      const stats = service.getCacheStats();
      expect(stats.maxSize).toBe(2);
    });
  });

  describe('model configs', () => {
    it('should have correct config for multilingual-e5-small', () => {
      const config = LOCAL_MODEL_CONFIGS['multilingual-e5-small'];
      expect(config).toBeDefined();
      expect(config!.dimension).toBe(384);
    });

    it('should have correct config for all-MiniLM-L6-v2', () => {
      const config = LOCAL_MODEL_CONFIGS['all-MiniLM-L6-v2'];
      expect(config).toBeDefined();
      expect(config!.dimension).toBe(384);
    });
  });
});