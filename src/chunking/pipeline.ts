/**
 * @spec chunking-layer.md#切分管道
 * @layer 2
 * @description 切分管道完整流程
 */

import type { Document, Chunk } from '../types/index';
import type { ChunkingConfig, DocumentAnalysis } from './interface';
import { DocumentAnalyzer, documentAnalyzer } from './analyzer';
import { createChunker } from './splitters/index';
import { TextEnhancer, textEnhancer } from './enhancer';
import { OverlapCalculator, overlapCalculator } from './overlap';
import { ChunkValidator, chunkValidator } from './validator';

export interface ChunkingTrace {
  traceId: string;
  documentId: string;
  timestamp: Date;
  stages: {
    analyze: { duration: number; docType: string; strategy: string };
    split: { duration: number; strategy: string; baseChunks: number };
    enhance: { duration: number; types: string[]; avgEnhancementRatio: number };
    overlap: { duration: number; chunksBefore: number; chunksAfter: number };
    validate: { duration: number; valid: number; invalid: number; invalidReasons: string[] };
  };
  output: {
    totalChunks: number;
    avgChunkSize: number;
    sizeDistribution: { min: number; max: number; median: number };
  };
}

export class ChunkingPipelineImpl {
  private analyzer: DocumentAnalyzer;
  private enhancer: TextEnhancer;
  private overlapCalc: OverlapCalculator;
  private validator: ChunkValidator;

  constructor(
    analyzer?: DocumentAnalyzer,
    enhancer?: TextEnhancer,
    overlapCalc?: OverlapCalculator,
    validator?: ChunkValidator
  ) {
    this.analyzer = analyzer || documentAnalyzer;
    this.enhancer = enhancer || textEnhancer;
    this.overlapCalc = overlapCalc || overlapCalculator;
    this.validator = validator || chunkValidator;
  }

  async process(
    document: Document,
    config?: ChunkingConfig,
    trace?: boolean
  ): Promise<{ chunks: Chunk[]; trace?: ChunkingTrace }> {
    const traceId = `chunk-${document.id}-${Date.now()}`;
    const startTime = Date.now();

    // Phase 1: 文档分析
    const analyzeStart = Date.now();
    const analysis = await this.analyzer.analyze(document);
    const analyzeDuration = Date.now() - analyzeStart;

    // Phase 2: 切分执行
    const splitStart = Date.now();
    const strategy = config?.strategy || analysis.recommendedStrategy;
    const chunker = createChunker(strategy);
    const baseChunks = await chunker.chunk(document, config);
    const splitDuration = Date.now() - splitStart;

    // Phase 3: 文本增强
    const enhanceStart = Date.now();
    const enhancedChunks = await this.enhancer.enhanceBatch(baseChunks, {
      document: {
        title: document.metadata.filename,
        keywords: []
      }
    });
    const enhanceDuration = Date.now() - enhanceStart;

    // Phase 4: 重叠计算
    const overlapStart = Date.now();
    const chunksWithOverlap = this.overlapCalc.calculateForChunks(enhancedChunks);
    const overlapDuration = Date.now() - overlapStart;

    // Phase 5: 验证过滤
    const validateStart = Date.now();
    const validation = this.validator.validate(chunksWithOverlap, {
      minChunkSize: config?.minChunkSize,
      maxChunkSize: config?.maxChunkSize
    });
    const validateDuration = Date.now() - validateStart;

    // Phase 6: 处理无效分块（简单合并小分块）
    const finalChunks = this.handleInvalidChunks(validation);

    const resultTrace: ChunkingTrace | undefined = trace ? {
      traceId,
      documentId: document.id,
      timestamp: new Date(startTime),
      stages: {
        analyze: { duration: analyzeDuration, docType: analysis.docType, strategy },
        split: { duration: splitDuration, strategy, baseChunks: baseChunks.length },
        enhance: {
          duration: enhanceDuration,
          types: ['title-prefix', 'context-window'],
          avgEnhancementRatio: enhancedChunks.length > 0
            ? enhancedChunks.reduce((sum, c) => sum + c.enhancedContent.length / c.originalContent.length, 0) / enhancedChunks.length
            : 1
        },
        overlap: { duration: overlapDuration, chunksBefore: enhancedChunks.length, chunksAfter: chunksWithOverlap.length },
        validate: {
          duration: validateDuration,
          valid: validation.validChunks.length,
          invalid: validation.invalidChunks.length,
          invalidReasons: validation.invalidChunks.map(i => i.reason)
        }
      },
      output: {
        totalChunks: finalChunks.length,
        avgChunkSize: validation.stats.avgChunkSize,
        sizeDistribution: validation.stats.sizeDistribution
      }
    } : undefined;

    return { chunks: finalChunks, trace: resultTrace };
  }

  private handleInvalidChunks(validation: ReturnType<ChunkValidator['validate']>): Chunk[] {
    const chunks = [...validation.validChunks];

    for (const invalid of validation.invalidChunks) {
      switch (invalid.reason) {
        case 'too-small':
          // 合并到最后一个分块
          if (chunks.length > 0) {
            const lastChunk = chunks[chunks.length - 1];
            chunks[chunks.length - 1] = {
              ...lastChunk,
              content: lastChunk.content + '\n' + invalid.chunk.content,
              position: {
                start: lastChunk.position.start,
                end: invalid.chunk.position.end
              }
            };
          } else {
            chunks.push(invalid.chunk);
          }
          break;

        case 'duplicate':
          // 跳过重复
          break;

        case 'low-quality':
          // 跳过低质量
          break;

        // 其他情况保留原分块
        default:
          chunks.push(invalid.chunk);
          break;
      }
    }

    return chunks;
  }
}

export const chunkingPipeline = new ChunkingPipelineImpl();