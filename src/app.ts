import { createDefaultPipeline } from './integration/pipeline-builder.js';
import { DocumentStorage } from './core/storage.js';
import { createMcpServer } from './mcp/server.js';
import { createMcpRetrievalService } from './mcp/mcp-retrieval-service.js';
import { HierarchicalStore } from './chunking/hierarchical-store.js';
import { getEmbeddingFactory } from './embedding/embedding-factory.js';
import type { Harness } from './core/harness.js';
import type { McpRetrievalService } from './mcp/mcp-retrieval-service.js';
import type { McpServer } from './mcp/server.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
  private retrieval: McpRetrievalService;
  private server: McpServer;
  private hierarchicalStore: HierarchicalStore;

  private constructor(config: AppConfig) {
    this.config = config;
    this.pipeline = createDefaultPipeline();
    this.storage = new DocumentStorage(config.storage);

    // Initialize HierarchicalStore with persistence
    this.hierarchicalStore = new HierarchicalStore();
    const storeDataPath = path.resolve(__dirname, '../data/store');

    // Create embedding service using factory
    const embeddingFactory = getEmbeddingFactory();
    const embeddingService = embeddingFactory.createTextEmbeddingService();

    // Create MCP RetrievalService with HierarchicalStore
    this.retrieval = createMcpRetrievalService(
      this.hierarchicalStore,
      (text: string) => embeddingService.embedText(text)
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
    const app = new Application(fullConfig);

    // Enable persistence for HierarchicalStore (async)
    const storeDataPath = path.resolve(__dirname, '../data/store');
    await app.hierarchicalStore.enablePersistence(storeDataPath, true);

    return app;
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
  getRetrieval(): McpRetrievalService { return this.retrieval; }
  getServer(): McpServer { return this.server; }
  getHierarchicalStore(): HierarchicalStore { return this.hierarchicalStore; }
}

/**
 * Create application instance
 */
export async function createApp(config?: Partial<AppConfig>): Promise<Application> {
  return Application.create(config);
}