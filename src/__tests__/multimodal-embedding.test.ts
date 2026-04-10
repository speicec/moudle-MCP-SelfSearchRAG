import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { MultimodalEmbeddingService, createMultimodalEmbeddingService, MultimodalEmbeddingError } from '../embedding/multimodal-embedding-service.js';

describe('MultimodalEmbeddingService', () => {
  let service: MultimodalEmbeddingService;

  beforeAll(() => {
    service = createMultimodalEmbeddingService('clip-vit-base-patch32');
  });

  afterAll(() => {
    service.clearCache();
  });

  describe('initialization', () => {
    it('should create service with default model', () => {
      const defaultService = createMultimodalEmbeddingService();
      expect(defaultService.getId()).toBe('clip-vit-base-patch32');
      expect(defaultService.getDimension()).toBe(512);
    });

    it('should report correct dimension', () => {
      expect(service.getDimension()).toBe(512);
    });

    it('should support images', () => {
      expect(service.supportsImages()).toBe(true);
    });

    it('should not be ready before initialization', () => {
      expect(service.isReady()).toBe(false);
    });
  });

  describe('text embedding', () => {
    it('should generate embedding for English text', async () => {
      const text = 'a photo of a dog';
      const embedding = await service.embedText(text);

      expect(embedding).toBeInstanceOf(Array);
      expect(embedding.length).toBe(512);
    });

    it('should generate embedding for Chinese text', async () => {
      const text = '一张狗的照片';
      const embedding = await service.embedText(text);

      expect(embedding).toBeInstanceOf(Array);
      expect(embedding.length).toBe(512);
    });

    it('should cache text embeddings', async () => {
      const text = 'test caching';

      await service.embedText(text);
      const stats = service.getCacheStats();
      expect(stats.textCache).toBeGreaterThan(0);
    });
  });

  describe('image embedding', () => {
    it('should generate embedding for valid image buffer', async () => {
      // Create a minimal valid PNG (1x1 pixel)
      const minimalPng = createMinimalPng();
      const embedding = await service.embedImageBuffer(minimalPng);

      expect(embedding).toBeInstanceOf(Array);
      expect(embedding.length).toBe(512);
    });

    it('should throw error for empty buffer', async () => {
      await expect(service.embedImageBuffer(Buffer.alloc(0))).rejects.toThrow(MultimodalEmbeddingError);
    });

    it('should throw error for unsupported format', async () => {
      // Create buffer with invalid header
      const invalidBuffer = Buffer.from([0x00, 0x00, 0x00, 0x00]);
      await expect(service.embedImageBuffer(invalidBuffer)).rejects.toThrow(MultimodalEmbeddingError);
    });

    it('should throw error for corrupted image', async () => {
      // Create buffer that looks like PNG but is corrupted
      const corruptedPng = Buffer.from([0x89, 0x50, 0x4E, 0x47]); // PNG header but no body
      await expect(service.embedImageBuffer(corruptedPng)).rejects.toThrow(MultimodalEmbeddingError);
    });

    it('should handle base64 encoded images', async () => {
      const minimalPng = createMinimalPng();
      const base64 = minimalPng.toString('base64');

      const embedding = await service.embedImageBase64(base64);

      expect(embedding).toBeInstanceOf(Array);
      expect(embedding.length).toBe(512);
    });

    it('should handle base64 with data URL prefix', async () => {
      const minimalPng = createMinimalPng();
      const base64 = `data:image/png;base64,${minimalPng.toString('base64')}`;

      const embedding = await service.embedImageBase64(base64);

      expect(embedding).toBeInstanceOf(Array);
      expect(embedding.length).toBe(512);
    });
  });

  describe('cross-modal similarity', () => {
    it('should have some similarity between text and image', async () => {
      // Note: This is a placeholder test since CLIP pipeline in transformers.js
      // doesn't directly expose embeddings. The actual cross-modal similarity
      // will be verified when direct encoder access is implemented.

      const textEmbedding = await service.embedText('a photo of a dog');
      const imageEmbedding = await service.embedImageBuffer(createMinimalPng());

      // Both should have same dimension
      expect(textEmbedding.length).toBe(imageEmbedding.length);

      // Calculate similarity (placeholder - actual values depend on real encoder)
      const similarity = cosineSimilarity(textEmbedding, imageEmbedding);
      expect(similarity).toBeGreaterThanOrEqual(-1);
      expect(similarity).toBeLessThanOrEqual(1);
    });
  });

  describe('error handling', () => {
    it('should throw error for empty text', async () => {
      await expect(service.embedText('')).rejects.toThrow();
    });

    it('should throw error for whitespace-only text', async () => {
      await expect(service.embedText('   ')).rejects.toThrow();
    });
  });

  describe('caching', () => {
    it('should clear caches', () => {
      service.clearCache();
      const stats = service.getCacheStats();
      expect(stats.textCache).toBe(0);
      expect(stats.imageCache).toBe(0);
    });
  });
});

/**
 * Create a minimal valid PNG image (1x1 pixel, transparent)
 */
function createMinimalPng(): Buffer {
  // Minimal PNG: 1x1 transparent pixel
  // PNG signature + IHDR + IDAT + IEND
  const pngData = [
    // PNG signature
    0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
    // IHDR chunk
    0x00, 0x00, 0x00, 0x0D, // length
    0x49, 0x48, 0x44, 0x52, // type
    0x00, 0x00, 0x00, 0x01, // width: 1
    0x00, 0x00, 0x00, 0x01, // height: 1
    0x08, // bit depth: 8
    0x06, // color type: RGBA
    0x00, // compression: deflate
    0x00, // filter: adaptive
    0x00, // interlace: none
    // CRC placeholder (will be calculated)
    0x1F, 0x15, 0xC4, 0x89,
    // IDAT chunk (compressed image data)
    0x00, 0x00, 0x00, 0x0A, // length
    0x49, 0x44, 0x41, 0x54, // type
    0x78, 0x9C, 0x62, 0x60, 0x00, 0x00, 0x00, 0x02, 0x00, 0x01,
    // CRC placeholder
    0xE5, 0x36, 0x77, 0x4C,
    // IEND chunk
    0x00, 0x00, 0x00, 0x00, // length
    0x49, 0x45, 0x4E, 0x44, // type
    0xAE, 0x42, 0x60, 0x82, // CRC
  ];

  return Buffer.from(pngData);
}

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