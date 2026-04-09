import { createDefaultPipeline } from './integration/pipeline-builder.js';
import { DocumentStorage } from './core/storage.js';
import { createRetrievalService } from './retrieval/index-stage.js';
import { TextEmbeddingService } from './embedding/embedding-service.js';
import { createMcpServer } from './mcp/server.js';
import { InMemoryVectorStore } from './retrieval/vector-store.js';
import type { Harness } from './core/harness.js';
import type { RetrievalService } from './retrieval/index-stage.js';
import type { McpServer } from './mcp/server.js';

/**
 * Application configuration
 */
export interface AppConfig {
  storage: {
    maxDocuments: number;
    basePath: string;
  };
  embedding: {
    textModel: string;
    imageModel: string;
    cacheEnabled: boolean;
  };
  retrieval: {
    defaultTopK: number;
    hybridWeights: {
      semantic: number;
      keyword: number;
    };
  };
  server: {
    name: string;
    version: string;
  };
}

/**
 * Default configuration
 */
export const DEFAULT_CONFIG: AppConfig = {
  storage: {
    maxDocuments: 10000,
    basePath: './data',
  },
  embedding: {
    textModel: 'text-embedding-3-small',
    imageModel: 'clip-vit-base-patch32',
    cacheEnabled: true,
  },
  retrieval: {
    defaultTopK: 5,
    hybridWeights: {
      semantic: 0.7,
      keyword: 0.3,
    },
  },
  server: {
    name: 'enhanced-rag-mcp-server',
    version: '0.1.0',
  },
};

/**
 * Main application class
 */
export class Application {
  private config: AppConfig;
  private pipeline: Harness;
  private storage: DocumentStorage;
  private retrieval: RetrievalService;
  private server: McpServer;
  private textEmbedder: TextEmbeddingService;

  private constructor(config: AppConfig) {
    this.config = config;
    this.pipeline = createDefaultPipeline();
    this.storage = new DocumentStorage(config.storage);
    this.textEmbedder = new TextEmbeddingService();
    const vectorStore = new InMemoryVectorStore();
    this.retrieval = createRetrievalService(
      vectorStore,
      (text) => this.textEmbedder.embedText(text)
    );
    this.server = createMcpServer(
      this.pipeline,
      this.storage,
      this.retrieval,
      config.server
    );
  }

  /**
   * Create application instance (async factory)
   */
  static async create(config: Partial<AppConfig> = {}): Promise<Application> {
    const fullConfig = { ...DEFAULT_CONFIG, ...config };
    return new Application(fullConfig);
  }

  /**
   * Start the application
   */
  async start(): Promise<void> {
    await this.server.start();
  }

  /**
   * Get components
   */
  getPipeline(): Harness { return this.pipeline; }
  getStorage(): DocumentStorage { return this.storage; }
  getRetrieval(): RetrievalService { return this.retrieval; }
  getServer(): McpServer { return this.server; }
}

/**
 * Create application instance
 */
export async function createApp(config?: Partial<AppConfig>): Promise<Application> {
  return Application.create(config);
}