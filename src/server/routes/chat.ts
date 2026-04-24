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
import { MedicalAgent, createMedicalAgent } from '../../medical/agent/MedicalAgent.js';
import { AgentEmitter, createAgentEmitter } from '../agent-emitter.js';
import type { AgentResult } from '../../medical/agent/types.js';

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
   * Three-phase flow: Agent analysis → retrieval → generation
   * Results broadcast via WebSocket events
   */
  fastify.post('/generate', async (request: FastifyRequest<{ Body: ChatQueryRequest & { enableAgent?: boolean } }>, reply: FastifyReply) => {
    const { query, topK = 5, similarityThreshold = 0.0, maxContextTokens = 4000, enableAgent = true } = request.body;

    console.log(`[ChatRoute:Generate] Query received: "${query}" (agent: ${enableAgent})`);

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

    // Agent phase execution (if enabled)
    let agentResult: AgentResult | null = null;
    let agentEmitter: AgentEmitter | null = null;

    if (enableAgent && wsHandler && fastify.llmCaller) {
      console.log('[ChatRoute:Generate] Executing Medical Agent phase...');

      // Create AgentEmitter for visualization events
      agentEmitter = createAgentEmitter(wsHandler);

      // Create MedicalAgent with LLMCaller
      const llmCaller = fastify.llmCaller;

      // Create retrieval function for Agent
      const agentRetrieval = async (agentQuery: string, options?: { topK?: number; threshold?: number }) => {
        const { results } = await retriever.retrieveWithMetadata(agentQuery);
        return results.map(r => ({
          content: r.parentChunkContent,
          source: {
            documentId: r.sourceDocumentId,
            // Use documentTitle from chunk metadata, fallback to sourceDocumentId (filename)
            documentName: r.metadata?.documentTitle ?? r.sourceDocumentId,
            chunkId: r.smallChunkId,
            ...(r.metadata?.pageNumber ? { pageNumber: r.metadata.pageNumber } : {}),
            ...(r.metadata?.documentYear ? { year: r.metadata.documentYear } : {}),
          } as import('../../medical/agent/types.js').SourceCitation,
        }));
      };

      const medicalAgent = createMedicalAgent(llmCaller, agentRetrieval, {
        maxIterations: 3,
        confidenceThreshold: 0.7,
      });

      // Register visualization callback
      medicalAgent.setVisualizationCallback((phase: string, data: unknown) => {
        switch (phase) {
          case 'input':
            agentEmitter?.emitInput((data as { query: string }).query);
            break;
          case 'entities':
            agentEmitter?.emitEntities(data as any);
            break;
          case 'complexity':
            agentEmitter?.emitComplexity(data as any);
            break;
          case 'mode':
            const modeData = data as { mode: 'react' | 'planning'; reason: string; matchedTemplate?: string };
            agentEmitter?.emitMode(modeData.mode, modeData.reason, modeData.matchedTemplate);
            break;
          case 'query_rewrite':
            agentEmitter?.emitQueryRewriting(data as any);
            break;
          case 'template':
            const templateData = data as { attempts: any[]; matched?: string };
            agentEmitter?.emitTemplate(templateData.attempts, templateData.matched);
            break;
          case 'dag':
            agentEmitter?.emitDAG(data as any);
            break;
          case 'execution':
            agentEmitter?.emitExecution(data as any);
            break;
          case 'complete':
            agentEmitter?.emitComplete(data as AgentResult);
            break;
        }
      });

      try {
        // Execute Agent
        agentResult = await medicalAgent.run({ query, domain: 'all' });
        console.log(`[ChatRoute:Generate] Agent complete: satisfied=${agentResult.satisfied}, iterations=${agentResult.stats.iterations}`);
      } catch (agentError) {
        console.error('[ChatRoute:Generate] Agent failed:', agentError);
        // Continue without Agent result
        agentResult = null;
      }
    }

    try {
      // Phase 1: Retrieval (use Agent results if available)
      console.log(`[ChatRoute:Generate] Executing retrieval...`);

      // Determine query for retrieval
      let retrievalQuery = query;

      if (agentResult?.visualization?.queryRewriting?.primaryQuery) {
        const rewrittenQuery = agentResult.visualization
          .queryRewriting.primaryQuery.trim();

        if (rewrittenQuery.length > 0) {
          retrievalQuery = rewrittenQuery;
          console.log(`[ChatRoute:Generate] Using Agent rewritten query: "${retrievalQuery}"`);
        } else {
          console.warn(`[ChatRoute:Generate] Agent rewritten query is empty, using original: "${query}"`);
        }
      }

      // Final validation: ensure query is not empty
      if (!retrievalQuery || retrievalQuery.trim().length === 0) {
        broadcastGeneration({
          type: 'generation:error',
          error: 'Invalid query: empty query after Agent processing',
          timestamp: Date.now(),
        });
        return reply.status(400).send({
          error: 'Invalid query',
          message: 'Query became empty after Agent processing',
        });
      }

      const { results, context } = await retriever.retrieveWithMetadata(retrievalQuery);

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
      const mappedResults: RetrievalResultItem[] = results.map((r, index) => {
        const item: RetrievalResultItem = {
          smallChunkId: r.smallChunkId,
          parentChunkId: r.parentChunkId,
          parentChunkContent: r.parentChunkContent,
          similarityScore: r.similarityScore,
          sourceDocumentId: r.sourceDocumentId,
        };
        // Add optional context fields
        if (r.contextWindow !== undefined) item.contextWindow = r.contextWindow;
        if (r.windowStart !== undefined) item.windowStart = r.windowStart;
        if (r.windowEnd !== undefined) item.windowEnd = r.windowEnd;
        // Add evidenceEvaluation from agentResult if available
        if (agentResult?.evidenceEvaluation?.[index]) {
          const evalData = agentResult.evidenceEvaluation[index];
          item.evidenceEvaluation = {
            literatureType: evalData.literatureType,
            grade: evalData.grade,
            isCurrent: evalData.isCurrent,
          };
          if (evalData.year !== undefined) item.evidenceEvaluation!.year = evalData.year;
          if (evalData.sourceGuideline !== undefined) item.evidenceEvaluation!.sourceGuideline = evalData.sourceGuideline;
          if (evalData.expirationWarning !== undefined) item.evidenceEvaluation!.expirationWarning = evalData.expirationWarning;
          if (evalData.sourceAuthority !== undefined) item.evidenceEvaluation!.sourceAuthority = evalData.sourceAuthority;
          if (evalData.authorityWeight !== undefined) item.evidenceEvaluation!.authorityWeight = evalData.authorityWeight;
          if (evalData.timeWeight !== undefined) item.evidenceEvaluation!.timeWeight = evalData.timeWeight;
          if (evalData.consistencyScore !== undefined) item.evidenceEvaluation!.consistencyScore = evalData.consistencyScore;
          if (evalData.compositeScore !== undefined) item.evidenceEvaluation!.compositeScore = evalData.compositeScore;
        }
        return item;
      });

      // Emit retrieval:complete event with evidence data
      if (emitter) {
        emitter.emitRetrievalComplete(query, mappedResults, Date.now() - startTime);
      }

      // Emit evidence:evaluated event if GRADE data is available
      if (agentEmitter && agentResult?.evidenceEvaluation && agentResult.evidenceEvaluation.length > 0) {
        const evidenceEvalWithIndex = agentResult.evidenceEvaluation.map((ev, idx) => ({
          ...ev,
          chunkIndex: idx,
        }));
        agentEmitter.emitEvidenceEvaluated(evidenceEvalWithIndex, agentResult.overallEvidenceGrade);
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
          agentUsed: enableAgent && agentResult !== null,
          agentSatisfied: agentResult?.satisfied,
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
          agentUsed: enableAgent && agentResult !== null,
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