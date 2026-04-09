import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { ChatQueryRequest, ChatQueryResponse, RetrievalResultItem } from '../types.js';

/**
 * Chat routes as Fastify plugin
 */
export async function chatRoutes(fastify: FastifyInstance): Promise<void> {
  // Chat history storage (per session - simplified for now)
  const chatHistory: Array<{ query: string; response: ChatQueryResponse; timestamp: number }> = [];

  /**
   * POST /query - Submit query for retrieval
   */
  fastify.post('/query', async (request: FastifyRequest<{ Body: ChatQueryRequest }>, reply: FastifyReply) => {
    const { query, topK = 5, similarityThreshold = 0.3 } = request.body;

    if (!query || query.trim().length === 0) {
      return reply.status(400).send({ error: 'Query is required' });
    }

    // TODO: Integrate with actual SmallToBigRetriever
    // For now, return mock results
    const mockResults: RetrievalResultItem[] = [
      {
        smallChunkId: 'chunk-1',
        parentChunkId: 'parent-1',
        parentChunkContent: 'This is mock content for testing purposes.',
        similarityScore: 0.85,
        sourceDocumentId: 'doc-123',
      },
    ];

    const assembledContext = {
      content: mockResults.map(r => r.parentChunkContent).join('\n\n---\n\n'),
      tokenCount: mockResults.reduce((sum, r) => sum + Math.ceil(r.parentChunkContent.length / 4), 0),
      truncated: false,
    };

    const response: ChatQueryResponse = {
      query,
      results: mockResults.slice(0, topK).filter(r => r.similarityScore >= similarityThreshold),
      assembledContext,
    };

    // Store in history
    chatHistory.push({
      query,
      response,
      timestamp: Date.now(),
    });

    return reply.status(200).send(response);
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
}