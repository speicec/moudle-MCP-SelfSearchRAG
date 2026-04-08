/**
 * @spec architecture.md#Embedding
 * @layer 2
 * @description Embedding管道实现
 */

import type { Chunk } from '../types/index';
import type {
  IEmbedder,
  ChunkWithEmbedding,
  EmbeddingPipelineConfig,
  EmbeddingTrace,
  BatchEmbeddingResult
} from './interface';

export class EmbeddingPipeline {
  private embedder: IEmbedder;
  private batchSize: number;

  constructor(config: EmbeddingPipelineConfig) {
    this.embedder = config.embedder!;
    this.batchSize = config.batchSize || 50;
  }

  // 处理chunks，生成embeddings
  async process(
    chunks: Chunk[],
    trace?: boolean
  ): Promise<{ chunks: ChunkWithEmbedding[]; trace?: EmbeddingTrace }> {
    const traceId = `embed-${Date.now()}`;
    const startTime = Date.now();
    const errors: string[] = [];

    // 批量处理
    const texts = chunks.map(c => c.content);
    const batches = this.createBatches(texts);
    const allResults: BatchEmbeddingResult[] = [];

    for (const batch of batches) {
      try {
        const result = await this.embedder.embedBatch(batch);
        allResults.push(result);
      } catch (error) {
        errors.push(error instanceof Error ? error.message : 'Unknown error');
        // 单独处理失败的部分
        for (const text of batch) {
          try {
            const singleResult = await this.embedder.embed(text);
            allResults.push({
              results: [singleResult],
              duration: 0
            });
          } catch (singleError) {
            errors.push(`Failed to embed: ${text.slice(0, 50)}`);
          }
        }
      }
    }

    // 合并结果
    const embeddings: number[][] = [];
    let totalTokens = 0;

    for (const batchResult of allResults) {
      for (const result of batchResult.results) {
        embeddings.push(result.embedding);
        totalTokens += batchResult.totalTokens || 0;
      }
    }

    // 创建带embedding的chunks
    const chunksWithEmbedding: ChunkWithEmbedding[] = chunks.map((chunk, i) => ({
      ...chunk,
      embedding: embeddings[i] || []
    }));

    const modelInfo = this.embedder.getModelInfo();

    const resultTrace: EmbeddingTrace | undefined = trace ? {
      traceId,
      timestamp: new Date(startTime),
      inputCount: chunks.length,
      outputCount: chunksWithEmbedding.length,
      totalTokens,
      duration: Date.now() - startTime,
      model: modelInfo.name,
      dimensions: modelInfo.dimensions,
      errors
    } : undefined;

    return { chunks: chunksWithEmbedding, trace: resultTrace };
  }

  // 单文本embedding
  async embedSingle(text: string): Promise<number[]> {
    const result = await this.embedder.embed(text);
    return result.embedding;
  }

  // 批量文本embedding
  async embedBatch(texts: string[]): Promise<number[][]> {
    const result = await this.embedder.embedBatch(texts);
    return result.results.map(r => r.embedding);
  }

  private createBatches(texts: string[]): string[][] {
    const batches: string[][] = [];
    for (let i = 0; i < texts.length; i += this.batchSize) {
      batches.push(texts.slice(i, i + this.batchSize));
    }
    return batches;
  }
}