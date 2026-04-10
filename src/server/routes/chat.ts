import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { ChatQueryRequest, ChatQueryResponse, RetrievalResultItem, PipelineEvent } from '../types.js';
import { SmallToBigRetriever } from '../../chunking/small-to-big-retriever.js';
import type { HierarchicalStore } from '../../chunking/hierarchical-store.js';
import type { TextEmbeddingService } from '../../embedding/embedding-service.js';

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

    if (!query || query.trim().length === 0) {
      return reply.status(400).send({ error: 'Query is required' });
    }

    // Check if store has any data
    if (!hierarchicalStore) {
      return reply.status(503).send({ error: 'Document store not initialized' });
    }

    const chunkCount = hierarchicalStore.getChunkCount();
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

    // Create retriever with request parameters
    const retriever = new SmallToBigRetriever(hierarchicalStore, {
      topK,
      similarityThreshold,
      maxContextTokens,
    });

    // Set embedding generator for semantic similarity calculation
    if (embeddingService) {
      retriever.setEmbeddingGenerator((text: string) => embeddingService.embedText(text));

      // Validate embedding dimension matches stored chunks
      const sampleChunks = hierarchicalStore.getAllSmallChunks();
      if (sampleChunks.length > 0) {
        const sampleChunk = sampleChunks[0];
        if (sampleChunk && sampleChunk.embedding.length > 0) {
          const storedDim = sampleChunk.embedding.length;
          const serviceDim = embeddingService.getDimension();
          if (storedDim !== serviceDim) {
            fastify.log.error({
              storedDim,
              serviceDim,
              message: 'Embedding dimension mismatch between stored chunks and embedding service',
            });
            return reply.status(500).send({
              error: 'Embedding dimension mismatch',
              message: `Stored chunks use ${storedDim} dimensions, but embedding service produces ${serviceDim} dimensions`,
            });
          }
        }
      }
    }

    try {
      // Execute retrieval
      const { results, context } = await retriever.retrieveWithMetadata(query);

      // Map results to response format
      const mappedResults: RetrievalResultItem[] = results.map(r => ({
        smallChunkId: r.smallChunkId,
        parentChunkId: r.parentChunkId,
        parentChunkContent: r.parentChunkContent,
        similarityScore: r.similarityScore,
        sourceDocumentId: r.sourceDocumentId,
      }));

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
}