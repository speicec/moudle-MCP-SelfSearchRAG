import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { LocalTextEmbeddingService, createLocalTextEmbeddingService, LocalEmbeddingError } from '../embedding/local-embedding-service.js';

describe('LocalTextEmbeddingService', () => {
  let service: LocalTextEmbeddingService;

  beforeAll(() => {
    service = createLocalTextEmbeddingService('multilingual-e5-small');
  });

  afterAll(() => {
    service.clearCache();
  });

  describe('initialization', () => {
    it('should create service with default model', () => {
      const defaultService = createLocalTextEmbeddingService();
      expect(defaultService.getId()).toBe('multilingual-e5-small');
      expect(defaultService.getDimension()).toBe(384);
    });

    it('should create service with specified model', () => {
      const customService = createLocalTextEmbeddingService('all-MiniLM-L6-v2');
      expect(customService.getId()).toBe('all-MiniLM-L6-v2');
    });

    it('should report correct dimension', () => {
      expect(service.getDimension()).toBe(384);
    });

    it('should not support images', () => {
      expect(service.supportsImages()).toBe(false);
    });

    it('should not be ready before initialization', () => {
      expect(service.isReady()).toBe(false);
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

      // Calculate cosine similarity
      const similarity = cosineSimilarity(embedding1, embedding2);

      // Different topics should have lower similarity
      expect(similarity).toBeLessThan(0.9);
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

  describe('Cross-language similarity', () => {
    it('should have high similarity for Chinese-English translations', async () => {
      // Same meaning in different languages
      const chineseText = '加班规定和假期安排';
      const englishText = 'Overtime regulations and holiday arrangements';

      const chineseEmbedding = await service.embedText(chineseText);
      const englishEmbedding = await service.embedText(englishText);

      const similarity = cosineSimilarity(chineseEmbedding, englishEmbedding);

      // Multilingual E5 should produce similar embeddings for translations
      // Note: E5 requires query prefix for optimal cross-language performance
      // Without prefix, similarity may be moderate
      expect(similarity).toBeGreaterThan(0.5);
    });

    it('should have lower similarity for unrelated texts across languages', async () => {
      const chineseText = '员工手册规定加班需要提前申请';
      const englishText = 'Financial reports show revenue growth';

      const chineseEmbedding = await service.embedText(chineseText);
      const englishEmbedding = await service.embedText(englishText);

      const similarity = cosineSimilarity(chineseEmbedding, englishEmbedding);

      expect(similarity).toBeLessThan(0.8);
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

    it('should handle large batch efficiently', async () => {
      const texts = Array.from({ length: 50 }, (_, i) => `测试文本 ${i}`);

      const startTime = Date.now();
      const embeddings = await service.embedTexts(texts);
      const duration = Date.now() - startTime;

      expect(embeddings.length).toBe(50);
      // Should complete in reasonable time
      expect(duration).toBeLessThan(30000); // 30 seconds
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

    it('should clear cache', () => {
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
});

/**
 * Calculate cosine similarity between two vectors
 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Vectors must have same length');
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  normA = Math.sqrt(normA);
  normB = Math.sqrt(normB);

  if (normA === 0 || normB === 0) {
    return 0;
  }

  return dotProduct / (normA * normB);
}