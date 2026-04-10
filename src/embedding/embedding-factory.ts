import type { TextEmbeddingModel, ImageEmbeddingModel } from './embedding-model.js';
import { TextEmbeddingService } from './embedding-service.js';
import { LocalTextEmbeddingService } from './local-embedding-service.js';
import { MultimodalEmbeddingService } from './multimodal-embedding-service.js';

/**
 * Embedding mode selection
 */
export type EmbeddingMode = 'local' | 'api';

/**
 * Factory configuration
 */
export interface EmbeddingFactoryConfig {
  mode: EmbeddingMode;
  textModel?: string;
  multimodalModel?: string;
}

/**
 * Get embedding mode from environment
 */
export function getEmbeddingMode(): EmbeddingMode {
  const mode = process.env.EMBEDDING_MODE?.toLowerCase();
  if (mode === 'api') {
    return 'api';
  }
  // Default to local mode
  return 'local';
}

/**
 * Embedding service factory
 * Creates appropriate embedding services based on configuration
 */
export class EmbeddingServiceFactory {
  private textService: TextEmbeddingModel | null = null;
  private multimodalService: ImageEmbeddingModel | null = null;
  private mode: EmbeddingMode;

  constructor(config?: Partial<EmbeddingFactoryConfig>) {
    this.mode = config?.mode ?? getEmbeddingMode();
  }

  /**
   * Create text embedding service based on mode
   */
  createTextEmbeddingService(): TextEmbeddingModel {
    if (this.textService) {
      return this.textService;
    }

    if (this.mode === 'local') {
      console.log('[EmbeddingFactory] Creating local text embedding service');
      this.textService = new LocalTextEmbeddingService(process.env.LOCAL_TEXT_MODEL);
    } else {
      console.log('[EmbeddingFactory] Creating API text embedding service');
      this.textService = new TextEmbeddingService();
    }

    return this.textService;
  }

  /**
   * Create multimodal embedding service (always local CLIP)
   */
  createMultimodalEmbeddingService(): ImageEmbeddingModel {
    if (this.multimodalService) {
      return this.multimodalService;
    }

    console.log('[EmbeddingFactory] Creating multimodal embedding service (CLIP)');
    this.multimodalService = new MultimodalEmbeddingService(process.env.LOCAL_MULTIMODAL_MODEL);

    return this.multimodalService;
  }

  /**
   * Get current embedding mode
   */
  getMode(): EmbeddingMode {
    return this.mode;
  }

  /**
   * Log startup information about loaded models and modes
   */
  logStartupInfo(): void {
    console.log('='.repeat(60));
    console.log('[EmbeddingFactory] Embedding Configuration:');
    console.log(`  Mode: ${this.mode}`);

    if (this.mode === 'local') {
      const textModel = process.env.LOCAL_TEXT_MODEL ?? 'multilingual-e5-small';
      const multimodalModel = process.env.LOCAL_MULTIMODAL_MODEL ?? 'clip-vit-base-patch32';
      console.log(`  Text Model: ${textModel} (supports 100+ languages including Chinese)`);
      console.log(`  Multimodal Model: ${multimodalModel} (text-to-image cross-modal search)`);
      console.log('  Features:');
      console.log('    - Offline operation after initial model download');
      console.log('    - Zero API cost');
      console.log('    - Semantic similarity for Chinese and English text');
    } else {
      const apiKey = process.env.EMBEDDING_API_KEY ?? process.env.OPENAI_API_KEY;
      const baseUrl = process.env.EMBEDDING_API_BASE_URL ?? 'https://api.openai.com/v1';
      const model = process.env.EMBEDDING_MODEL ?? 'text-embedding-3-small';
      console.log(`  API URL: ${baseUrl}`);
      console.log(`  API Key: ${apiKey ? 'configured' : 'NOT configured'}`);
      console.log(`  Model: ${model}`);
    }

    console.log('='.repeat(60));
  }

  /**
   * Preload models for faster first query
   */
  async preloadModels(): Promise<void> {
    if (this.mode === 'local') {
      console.log('[EmbeddingFactory] Preloading models...');

      const textService = this.createTextEmbeddingService() as LocalTextEmbeddingService;
      const multimodalService = this.createMultimodalEmbeddingService();

      // Initialize text model
      await textService.embedText('test');

      // Initialize multimodal model (if needed)
      // Note: multimodal model is heavier, may want to lazy load

      console.log('[EmbeddingFactory] Models preloaded successfully');
    }
  }
}

/**
 * Global factory instance
 */
let globalFactory: EmbeddingServiceFactory | null = null;

/**
 * Get global embedding factory
 */
export function getEmbeddingFactory(): EmbeddingServiceFactory {
  if (!globalFactory) {
    globalFactory = new EmbeddingServiceFactory();
    globalFactory.logStartupInfo();
  }
  return globalFactory;
}

/**
 * Create new embedding factory with custom config
 */
export function createEmbeddingFactory(config?: Partial<EmbeddingFactoryConfig>): EmbeddingServiceFactory {
  return new EmbeddingServiceFactory(config);
}