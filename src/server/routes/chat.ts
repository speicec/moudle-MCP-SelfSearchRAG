import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { ChatQueryRequest, ChatQueryResponse, RetrievalResultItem, PipelineEvent, RetrievalMatchData } from '../types.js';
import { SmallToBigRetriever } from '../../chunking/small-to-big-retriever.js';
import type { ImageStore } from '../../chunking/image-store.js';
import type { HybridSmallToBigRetriever } from '../../retrieval/hybrid-small-to-big-retriever.js';
import { PipelineEmitter } from '../pipeline-emitter.js';
import { llmGenerationService, type GenerationEvent, type MultimodalGenerationRequest } from '../services/LLMGenerationService.js';
import { createEnhancedRetrievalPipeline } from '../../retrieval/enhanced-retrieval-pipeline.js';
import type { EnhancedChatResponse } from '../../retrieval/types.js';
import { createEnhancedLLMGenerationService } from '../services/enhanced-llm-generation-service.js';
import type { EnhancedRetrievalConfig } from '../../retrieval/config.js';
import { DEFAULT_ENHANCED_RETRIEVAL_CONFIG } from '../../retrieval/config.js';

/**
 * Chat routes as Fastify plugin
 */
export async function chatRoutes(fastify: FastifyInstance): Promise<void> {
  // Chat history storage (per session - simplified for now)
  const chatHistory: Array<{ query: string; response: ChatQueryResponse; timestamp: number }> = [];

  // Get HierarchicalStore and EmbeddingService from fastify
  const hierarchicalStore = fastify.hierarchicalStore;
  const embeddingService = fastify.embeddingService;

  /**
   * POST /query - Submit query for retrieval
   */
  fastify.post('/query', async (request: FastifyRequest<{ Body: ChatQueryRequest }>, reply: FastifyReply) => {
    const { query, topK = 5, similarityThreshold = 0.0, maxContextTokens = 4000 } = request.body;

    console.log(`[ChatRoute] Query received: "${query}"`);

    if (!query || query.trim().length === 0) {
      return reply.status(400).send({ error: 'Query is required' });
    }

    // Check if store has any data
    if (!hierarchicalStore) {
      console.error('[ChatRoute] Document store not initialized');
      return reply.status(503).send({ error: 'Document store not initialized' });
    }

    const chunkCount = hierarchicalStore.getChunkCount();
    console.log(`[ChatRoute] Store has ${chunkCount.small} small chunks, ${chunkCount.parent} parent chunks`);

    if (chunkCount.small === 0) {
      // No documents indexed yet
      return reply.status(200).send({
        query,
        results: [],
        assembledContext: {
          content: '',
          tokenCount: 0,
          truncated: false,
        },
        message: 'No documents have been processed. Upload documents first.',
      });
    }

    // Check if Hybrid Retriever is available
    const sharedRetriever = (fastify as any).sharedRetriever as SmallToBigRetriever | undefined;

    let retriever: SmallToBigRetriever;

    if (sharedRetriever && sharedRetriever.isHybridMode()) {
      // Hybrid 模式：使用已配置的 retriever
      console.log('[ChatRoute] Using pre-configured Hybrid Retriever');
      retriever = sharedRetriever;
      retriever.setConfig({ topK, similarityThreshold, maxContextTokens });
    } else {
      // Fallback: Legacy 内存模式
      console.log('[ChatRoute] Using Legacy in-memory retriever');
      retriever = new SmallToBigRetriever(hierarchicalStore, {
        topK,
        similarityThreshold,
        maxContextTokens,
      });

      if (embeddingService) {
        console.log(`[ChatRoute] Embedding service available, dimension: ${embeddingService.getDimension()}`);
        retriever.setEmbeddingGenerator((text: string) => embeddingService.embedText(text));

        // 维度检查仅适用于 Legacy 模式（Hybrid 模式 embeddings 在 Qdrant）
        const sampleChunks = hierarchicalStore.getAllSmallChunks();
        if (sampleChunks.length > 0) {
          const sampleChunk = sampleChunks[0];
          if (sampleChunk && sampleChunk.embedding.length > 0) {
            const storedDim = sampleChunk.embedding.length;
            const serviceDim = embeddingService.getDimension();
            console.log(`[ChatRoute] Dimension check - stored: ${storedDim}, service: ${serviceDim}`);

            if (storedDim !== serviceDim) {
              return reply.status(500).send({
                error: 'Embedding dimension mismatch',
                message: `Stored chunks use ${storedDim} dimensions, but embedding service produces ${serviceDim} dimensions`,
              });
            }
          }
        }
      } else {
        console.warn('[ChatRoute] No embedding service available - using synthetic embeddings');
      }
    }

    // Create emitter for retrieval events
    const wsHandler = fastify.wsHandler;
    const emitter = wsHandler ? new PipelineEmitter('retrieval', wsHandler) : null;

    // Emit retrieval:start event
    if (emitter) {
      emitter.emitRetrievalStart(query);
    }

    const startTime = Date.now();

    try {
      // Execute retrieval
      console.log(`[ChatRoute] Executing retrieval...`);
      const { results, context } = await retriever.retrieveWithMetadata(query);

      console.log(`[ChatRoute] Retrieval complete: ${results.length} results, context length: ${context.content.length}`);

      // Emit retrieval:match events for each result
      if (emitter) {
        results.forEach((r, index) => {
          const matchData: RetrievalMatchData = {
            smallChunkId: r.smallChunkId,
            similarityScore: r.similarityScore,
            rank: index + 1,
          };
          emitter.emitRetrievalMatch(query, matchData);
        });
      }

      // Map results to response format
      const mappedResults: RetrievalResultItem[] = results.map(r => ({
        smallChunkId: r.smallChunkId,
        parentChunkId: r.parentChunkId,
        parentChunkContent: r.parentChunkContent,
        similarityScore: r.similarityScore,
        sourceDocumentId: r.sourceDocumentId,
        // Context window fields
        contextWindow: r.contextWindow,
        windowStart: r.windowStart,
        windowEnd: r.windowEnd,
      }));

      const duration = Date.now() - startTime;

      // Emit retrieval:complete event
      if (emitter) {
        emitter.emitRetrievalComplete(query, mappedResults, duration);
      }

      const response: ChatQueryResponse = {
        query,
        results: mappedResults,
        assembledContext: {
          content: context.content,
          tokenCount: context.tokenCount,
          truncated: context.truncated,
        },
      };

      // Store in history
      chatHistory.push({
        query,
        response,
        timestamp: Date.now(),
      });

      return reply.status(200).send(response);

    } catch (error) {
      fastify.log.error({ query, error }, 'Retrieval failed');
      return reply.status(500).send({
        error: 'Retrieval failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * GET /history - Get chat history
   */
  fastify.get('/history', async (_request: FastifyRequest, reply: FastifyReply) => {
    // Return last 50 messages
    const recentHistory = chatHistory.slice(-50);
    return reply.status(200).send(recentHistory);
  });

  /**
   * DELETE /history - Clear chat history
   */
  fastify.delete('/history', async (_request: FastifyRequest, reply: FastifyReply) => {
    chatHistory.length = 0;
    return reply.status(200).send({ success: true, message: 'History cleared' });
  });

  /**
   * GET /status - Get retrieval system status
   */
  fastify.get('/status', async (_request: FastifyRequest, reply: FastifyReply) => {
    if (!hierarchicalStore) {
      return reply.status(200).send({
        initialized: false,
        message: 'Document store not initialized',
      });
    }

    const chunkCount = hierarchicalStore.getChunkCount();
    const validation = hierarchicalStore.validate();

    return reply.status(200).send({
      initialized: true,
      chunks: chunkCount,
      valid: validation.valid,
      errors: validation.errors,
    });
  });

  /**
   * POST /generate - Submit query for RAG + LLM generation with streaming
   * Two-phase flow: retrieval → generation
   * Results broadcast via WebSocket events
   */
  fastify.post('/generate', async (request: FastifyRequest<{ Body: ChatQueryRequest }>, reply: FastifyReply) => {
    const { query, topK = 5, similarityThreshold = 0.0, maxContextTokens = 4000 } = request.body;

    console.log(`[ChatRoute:Generate] Query received: "${query}"`);

    if (!query || query.trim().length === 0) {
      return reply.status(400).send({ error: 'Query is required' });
    }

    // Check if store has any data
    if (!hierarchicalStore) {
      console.error('[ChatRoute:Generate] Document store not initialized');
      return reply.status(503).send({ error: 'Document store not initialized' });
    }

    const chunkCount = hierarchicalStore.getChunkCount();
    if (chunkCount.small === 0) {
      return reply.status(200).send({
        query,
        results: [],
        thinking: '',
        answer: 'No documents have been processed. Upload documents first.',
        message: 'No documents indexed',
      });
    }

    // Check if Hybrid Retriever is available
    const sharedRetriever = (fastify as any).sharedRetriever as SmallToBigRetriever | undefined;

    let retriever: SmallToBigRetriever;

    if (sharedRetriever && sharedRetriever.isHybridMode()) {
      console.log('[ChatRoute:Generate] Using pre-configured Hybrid Retriever');
      retriever = sharedRetriever;
      retriever.setConfig({ topK, similarityThreshold, maxContextTokens });
    } else {
      console.log('[ChatRoute:Generate] Using Legacy in-memory retriever');
      retriever = new SmallToBigRetriever(hierarchicalStore, {
        topK,
        similarityThreshold,
        maxContextTokens,
      });

      if (embeddingService) {
        retriever.setEmbeddingGenerator((text: string) => embeddingService.embedText(text));
      }
    }

    // WebSocket broadcast helper
    const wsHandler = fastify.wsHandler;
    const broadcastGeneration = (event: GenerationEvent) => {
      if (wsHandler) {
        // Build PipelineEvent with only defined properties
        const pipelineEvent: PipelineEvent = {
          type: event.type,
          timestamp: event.timestamp,
        };

        // Only add optional properties if they have defined values
        if (event.phase) pipelineEvent.phase = event.phase;
        if (event.query) pipelineEvent.query = event.query;
        if (event.sourcesCount !== undefined) pipelineEvent.sourcesCount = event.sourcesCount;
        if (event.thinkingContent) pipelineEvent.thinkingContent = event.thinkingContent;
        if (event.answerContent) pipelineEvent.answerContent = event.answerContent;
        if (event.thinkingTokens !== undefined) pipelineEvent.thinkingTokens = event.thinkingTokens;
        if (event.answerTokens !== undefined) pipelineEvent.answerTokens = event.answerTokens;
        if (event.totalDuration !== undefined) pipelineEvent.totalDuration = event.totalDuration;
        if (event.error) pipelineEvent.error = { message: event.error };

        wsHandler.broadcast(pipelineEvent);
      }
    };

    // Create emitter for retrieval events
    const emitter = wsHandler ? new PipelineEmitter('retrieval', wsHandler) : null;

    // Emit retrieval:start event
    if (emitter) {
      emitter.emitRetrievalStart(query);
    }

    const startTime = Date.now();

    try {
      // Phase 1: Retrieval
      console.log(`[ChatRoute:Generate] Executing retrieval...`);
      const { results, context } = await retriever.retrieveWithMetadata(query);

      // Emit retrieval:match events
      if (emitter) {
        results.forEach((r, index) => {
          const matchData: RetrievalMatchData = {
            smallChunkId: r.smallChunkId,
            similarityScore: r.similarityScore,
            rank: index + 1,
          };
          emitter.emitRetrievalMatch(query, matchData);
        });
      }

      // Map results
      const mappedResults: RetrievalResultItem[] = results.map(r => ({
        smallChunkId: r.smallChunkId,
        parentChunkId: r.parentChunkId,
        parentChunkContent: r.parentChunkContent,
        similarityScore: r.similarityScore,
        sourceDocumentId: r.sourceDocumentId,
        contextWindow: r.contextWindow,
        windowStart: r.windowStart,
        windowEnd: r.windowEnd,
      }));

      // Emit retrieval:complete event
      if (emitter) {
        emitter.emitRetrievalComplete(query, mappedResults, Date.now() - startTime);
      }

      // Phase 2: LLM Generation (if enabled)
      if (llmGenerationService.isEnabled()) {
        console.log(`[ChatRoute:Generate] Executing LLM generation with ${results.length} sources...`);

        // ✨ Extract image contexts from results
        const imageStore = fastify.imageStore as ImageStore | undefined;
        const imageContexts: MultimodalGenerationRequest['imageContexts'] = [];

        if (imageStore && results.length > 0) {
          // Get document ID and page numbers from results
          const docId = results[0]?.sourceDocumentId;

          // Also extract pages from chunks that might have nearby images
          const allPages = results.map(r => r.metadata.pageNumber ?? 0).filter(p => p > 0);

          if (docId && allPages.length > 0) {
            const images = imageStore.getVlmEligibleImages(docId, allPages);

            for (const img of images) {
              // Filter out 'image' type as VLM only handles table/figure/formula
              const vlmBlockType = img.blockType === 'image' ? 'mixed' : img.blockType;

              // Create imageContext with optional ocrText using spread
              const imageContext: {
                base64: string;
                blockType: 'table' | 'figure' | 'formula' | 'mixed';
                sourcePage: number;
                ocrText?: string;
              } = {
                base64: img.imageBuffer.toString('base64'),
                blockType: vlmBlockType as 'table' | 'figure' | 'formula' | 'mixed',
                sourcePage: img.pageNumber,
                ...(img.ocrText ? { ocrText: img.ocrText } : {}),
              };

              imageContexts.push(imageContext);
            }

            console.log(`[ChatRoute:Generate] Extracted ${imageContexts.length} image contexts`);
          }
        }

        // Prepare generation request - only include imageContexts if present
        const generationRequest: MultimodalGenerationRequest = {
          query,
          context: context.content,
          sources: mappedResults.map(r => ({
            content: r.parentChunkContent,
            similarityScore: r.similarityScore,
            sourceId: r.sourceDocumentId,
          })),
          ...(imageContexts.length > 0 ? { imageContexts } : {}),
        };

        // Execute streaming generation - use multimodal if images present
        const generationResult = imageContexts.length > 0
          ? await llmGenerationService.generateMultimodalAnswer(generationRequest, broadcastGeneration)
          : await llmGenerationService.generateWithStreaming(generationRequest, broadcastGeneration);

        return reply.status(200).send({
          query,
          results: mappedResults,
          thinking: generationResult.thinking,
          answer: generationResult.answer,
          duration: Date.now() - startTime,
          imageCount: imageContexts.length,
        });
      } else {
        // LLM disabled - return retrieval results only
        console.log('[ChatRoute:Generate] LLM generation disabled - returning retrieval results only');

        broadcastGeneration({
          type: 'generation:error',
          error: 'LLM generation not configured - returning retrieval results only',
          timestamp: Date.now(),
        });

        return reply.status(200).send({
          query,
          results: mappedResults,
          thinking: '',
          answer: 'LLM generation not configured. Configure DEEPSEEK_API_KEY to enable.',
          context: context.content,
          duration: Date.now() - startTime,
        });
      }

    } catch (error) {
      fastify.log.error({ query, error }, 'Generate failed');
      broadcastGeneration({
        type: 'generation:error',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: Date.now(),
      });
      return reply.status(500).send({
        error: 'Generation failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * POST /enhanced - Enhanced retrieval with confidence scoring
   * Uses EnhancedRetrievalPipeline for query optimization and reranking
   */
  fastify.post('/enhanced', async (request: FastifyRequest<{ Body: {
    query: string;
    config?: Partial<EnhancedRetrievalConfig>;
  } }>, reply: FastifyReply) => {
    const { query, config } = request.body;

    console.log(`[ChatRoute:Enhanced] Query received: "${query}"`);

    if (!query || query.trim().length === 0) {
      return reply.status(400).send({ error: 'Query is required' });
    }

    if (!hierarchicalStore) {
      return reply.status(503).send({ error: 'Document store not initialized' });
    }

    const chunkCount = hierarchicalStore.getChunkCount();
    if (chunkCount.small === 0) {
      return reply.status(200).send({
        query,
        success: false,
        noMatch: {
          status: 'no_match',
          message: 'No documents have been processed',
          suggestions: ['Upload documents first'],
        },
      });
    }

    const startTime = Date.now();

    try {
      // Check if Hybrid Retriever is available
      const sharedRetriever = (fastify as any).sharedRetriever as SmallToBigRetriever | undefined;

      let retriever: SmallToBigRetriever;

      if (sharedRetriever && sharedRetriever.isHybridMode()) {
        console.log('[ChatRoute:Enhanced] Using pre-configured Hybrid Retriever');
        retriever = sharedRetriever;
      } else {
        console.log('[ChatRoute:Enhanced] Using Legacy in-memory retriever');
        retriever = new SmallToBigRetriever(hierarchicalStore);

        if (embeddingService) {
          retriever.setEmbeddingGenerator((text: string) => embeddingService.embedText(text));
        }
      }

      // Create enhanced pipeline
      const pipeline = createEnhancedRetrievalPipeline(config);
      pipeline.setRetriever(retriever);
      pipeline.setStore(hierarchicalStore);

      // Create LLM caller for query optimization (reuse llmGenerationService)
      const llmCaller = async (prompt: string): Promise<string> => {
        if (!llmGenerationService.isEnabled()) {
          return ''; // Fallback to heuristic
        }
        try {
          const result = await llmGenerationService.generateOnce({
            query: prompt,
            context: '',
            sources: [],
          });
          return result.answer;
        } catch {
          return '';
        }
      };
      pipeline.setLLMCaller(llmCaller);

      await pipeline.initialize();

      // Execute enhanced retrieval
      const result = await pipeline.execute(query);

      // Shutdown pipeline
      await pipeline.shutdown();

      const duration = Date.now() - startTime;

      // Handle no-match case
      if (!result.success && result.noMatch) {
        return reply.status(200).send({
          query,
          success: false,
          noMatch: result.noMatch,
          analysis: result.analysis,
          duration,
        });
      }

      // Handle error case
      if (!result.success) {
        return reply.status(500).send({
          error: result.error || 'Enhanced retrieval failed',
          query,
          duration,
        });
      }

      // Build enhanced response
      const enhancedLLMService = createEnhancedLLMGenerationService();
      const prompt = enhancedLLMService.constructPromptWithConfidence(
        query,
        result.context?.chunks ?? []
      );

      // Execute LLM generation with enhanced prompt
      let thinking = '';
      let answer = '';

      if (llmGenerationService.isEnabled() && result.context) {
        const wsHandler = fastify.wsHandler;
        const broadcastGeneration = (event: GenerationEvent) => {
          if (wsHandler) {
            const pipelineEvent: PipelineEvent = {
              type: event.type,
              timestamp: event.timestamp,
            };
            if (event.phase) pipelineEvent.phase = event.phase;
            if (event.thinkingContent) pipelineEvent.thinkingContent = event.thinkingContent;
            if (event.answerContent) pipelineEvent.answerContent = event.answerContent;
            wsHandler.broadcast(pipelineEvent);
          }
        };

        const generationResult = await llmGenerationService.generateWithStreaming({
          query,
          context: prompt,
          sources: result.results?.map(r => ({
            content: r.parentChunkContent,
            similarityScore: r.confidenceScore,
            sourceId: r.sourceDocumentId,
          })) ?? [],
        }, broadcastGeneration);

        thinking = generationResult.thinking;
        answer = generationResult.answer;
      } else {
        answer = '未找到高置信度的相关资料。请尝试使用其他关键词查询。';
      }

      // Build final enhanced response
      const enhancedResponse: EnhancedChatResponse = {
        query,
        results: result.results ?? [],
        queryAnalysis: {
          complexity: result.analysis?.complexity ?? 'simple',
          wasRewritten: result.optimization?.rewrittenQuery !== undefined,
          wasDecomposed: (result.optimization?.subQueries?.length ?? 0) > 0,
          expandedTerms: result.optimization?.expandedTerms ?? [],
        },
        retrievalStats: {
          coarseTopK: result.topKConfig?.coarseTopK ?? 0,
          refinedCount: result.results?.length ?? 0,
          avgConfidence: result.context?.avgConfidence ?? 0,
          truncated: result.context?.truncated ?? false,
          method: result.stats?.method ?? 'internal-confidence',
        },
        context: result.context ?? { chunks: [], totalTokens: 0, truncated: false, avgConfidence: 0 },
        answer,
        thinking,
      };

      return reply.status(200).send({
        ...enhancedResponse,
        duration,
      });

    } catch (error) {
      fastify.log.error({ query, error }, 'Enhanced retrieval failed');
      return reply.status(500).send({
        error: 'Enhanced retrieval failed',
        message: error instanceof Error ? error.message : 'Unknown error',
        query,
        duration: Date.now() - startTime,
      });
    }
  });

  /**
   * GET /config - Get enhanced retrieval configuration
   */
  fastify.get('/config', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.status(200).send({
      default: DEFAULT_ENHANCED_RETRIEVAL_CONFIG,
      presets: {
        light: {
          modelContextWindow: 32000,
          description: '轻量场景，适合快速检索',
        },
        standard: {
          modelContextWindow: 64000,
          description: '标准场景，默认配置',
        },
        extended: {
          modelContextWindow: 128000,
          description: '大上下文场景，适合复杂文档',
        },
      },
      thresholds: {
        minConfidence: DEFAULT_ENHANCED_RETRIEVAL_CONFIG.minConfidenceThreshold,
        rerankerThreshold: DEFAULT_ENHANCED_RETRIEVAL_CONFIG.rerankerThreshold,
      },
      features: {
        queryOptimization: {
          decomposition: DEFAULT_ENHANCED_RETRIEVAL_CONFIG.enableDecomposition,
          rewrite: DEFAULT_ENHANCED_RETRIEVAL_CONFIG.enableRewrite,
          expansion: DEFAULT_ENHANCED_RETRIEVAL_CONFIG.enableExpansion,
        },
      },
    });
  });

  /**
   * POST /config - Update enhanced retrieval configuration
   */
  fastify.post('/config', async (request: FastifyRequest<{ Body: Partial<EnhancedRetrievalConfig> }>, reply: FastifyReply) => {
    // Note: This updates runtime config, not persisted
    // For persisted config, would need to store in database or file
    const updates = request.body;

    // Validate config updates
    try {
      const { validateEnhancedRetrievalConfig, mergeEnhancedRetrievalConfig } = await import('../../retrieval/config.js');
      const mergedConfig = mergeEnhancedRetrievalConfig(updates);
      validateEnhancedRetrievalConfig(mergedConfig);

      return reply.status(200).send({
        success: true,
        message: 'Configuration updated (runtime)',
        config: mergedConfig,
      });
    } catch (error) {
      return reply.status(400).send({
        error: 'Invalid configuration',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });
}