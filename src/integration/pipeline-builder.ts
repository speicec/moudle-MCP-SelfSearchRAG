import { createPipeline } from '../core/pipeline.js';
import { createIngestStage } from '../core/ingest-stage.js';
import { createParseStage } from '../parsers/parse-stage.js';
import { createEmbeddingStage } from '../embedding/embedding-stage.js';
import { createIndexStage } from '../retrieval/index-stage.js';
import { PluginRegistry } from '../core/plugin.js';
import type { Harness, HarnessConfig } from '../core/harness.js';

/**
 * Default pipeline configuration
 */
export function createDefaultPipeline(): Harness {
  const registry = new PluginRegistry();

  const config: HarnessConfig = {
    stages: [
      { name: 'ingest', plugins: [{ name: 'ingest' }] },
      { name: 'parse', plugins: [{ name: 'parse' }] },
      { name: 'embed', plugins: [{ name: 'embed' }] },
      { name: 'index', plugins: [{ name: 'index' }] },
    ],
  };

  // Register plugins
  registry.registerFactory('ingest', () => createIngestStage()['plugins'][0]!);
  registry.registerFactory('parse', () => createParseStage()['plugins'][0]!);
  registry.registerFactory('embed', () => createEmbeddingStage()['plugins'][0]!);
  registry.registerFactory('index', () => createIndexStage()['plugins'][0]!);

  return createPipeline(config, registry);
}

/**
 * Pipeline builder for custom configurations
 */
export class PipelineBuilder {
  private stages: HarnessConfig['stages'] = [];
  private registry: PluginRegistry;

  constructor() {
    this.registry = new PluginRegistry();
  }

  /**
   * Add ingest stage
   */
  withIngest(): this {
    this.registry.registerFactory('ingest', () => createIngestStage()['plugins'][0]!);
    this.stages.push({ name: 'ingest', plugins: [{ name: 'ingest' }] });
    return this;
  }

  /**
   * Add parse stage
   */
  withParse(): this {
    this.registry.registerFactory('parse', () => createParseStage()['plugins'][0]!);
    this.stages.push({ name: 'parse', plugins: [{ name: 'parse' }] });
    return this;
  }

  /**
   * Add embedding stage
   */
  withEmbedding(): this {
    this.registry.registerFactory('embed', () => createEmbeddingStage()['plugins'][0]!);
    this.stages.push({ name: 'embed', plugins: [{ name: 'embed' }] });
    return this;
  }

  /**
   * Add index stage
   */
  withIndex(): this {
    this.registry.registerFactory('index', () => createIndexStage()['plugins'][0]!);
    this.stages.push({ name: 'index', plugins: [{ name: 'index' }] });
    return this;
  }

  /**
   * Build the pipeline
   */
  build(): Harness {
    return createPipeline({ stages: this.stages }, this.registry);
  }
}

/**
 * Create pipeline builder
 */
export function pipeline(): PipelineBuilder {
  return new PipelineBuilder();
}