import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { DocumentMetadata } from '../types.js';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs/promises';
import path from 'path';
import { processDocumentAsync } from '../document-processor.js';

const SUPPORTED_FILE_TYPES = ['.pdf', '.txt', '.md'];
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

/**
 * Document routes as Fastify plugin
 */
export async function documentRoutes(fastify: FastifyInstance): Promise<void> {
  const storagePath = fastify.documentStoragePath ?? './data/documents';

  // Ensure storage directory exists
  await fs.mkdir(storagePath, { recursive: true });

  /**
   * POST /upload - Upload document
   */
  fastify.post('/upload', async (request: FastifyRequest, reply: FastifyReply) => {
    const data = await request.file();
    if (!data) {
      return reply.status(400).send({ error: 'No file uploaded' });
    }

    // Check file extension
    const ext = path.extname(data.filename ?? '').toLowerCase();
    if (!SUPPORTED_FILE_TYPES.includes(ext)) {
      return reply.status(400).send({
        error: `Unsupported file type: ${ext}. Supported: ${SUPPORTED_FILE_TYPES.join(', ')}`,
      });
    }

    // Check file size
    const fileBuffer = await data.toBuffer();
    if (fileBuffer.length > MAX_FILE_SIZE) {
      return reply.status(413).send({
        error: `File too large. Maximum size: ${MAX_FILE_SIZE / 1024 / 1024}MB`,
      });
    }

    // Generate document ID
    const documentId = uuidv4();
    const filePath = path.join(storagePath, `${documentId}${ext}`);

    // Save file
    await fs.writeFile(filePath, fileBuffer);

    // Create metadata with processing status
    const metadata: DocumentMetadata = {
      id: documentId,
      filename: data.filename ?? 'unknown',
      size: fileBuffer.length,
      uploadedAt: Date.now(),
      status: 'pending',
    };

    // Save metadata
    await fs.writeFile(
      path.join(storagePath, `${documentId}.json`),
      JSON.stringify(metadata, null, 2)
    );

    // Trigger async pipeline processing (fire-and-forget)
    processDocumentAsync({
      documentId,
      filePath,
      fastify,
      storagePath,
    }).catch(err => {
      fastify.log.error({ documentId, error: err }, 'Pipeline processing failed');
    });

    return reply.status(200).send(metadata);
  });

  /**
   * GET / - List all documents
   */
  fastify.get('/', async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const files = await fs.readdir(storagePath);
      const metadataFiles = files.filter(f => f.endsWith('.json'));

      const documents: DocumentMetadata[] = [];
      for (const metaFile of metadataFiles) {
        try {
          const content = await fs.readFile(path.join(storagePath, metaFile), 'utf-8');
          const meta = JSON.parse(content) as DocumentMetadata;
          documents.push(meta);
        } catch {
          // Skip corrupted metadata files
        }
      }

      // Sort by upload date descending
      documents.sort((a, b) => b.uploadedAt - a.uploadedAt);

      return reply.status(200).send(documents);
    } catch {
      return reply.status(200).send([]);
    }
  });

  /**
   * GET /:id - Get single document metadata
   */
  fastify.get('/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const { id } = request.params;
    const metaPath = path.join(storagePath, `${id}.json`);

    try {
      const content = await fs.readFile(metaPath, 'utf-8');
      const metadata = JSON.parse(content) as DocumentMetadata;
      return reply.status(200).send(metadata);
    } catch {
      return reply.status(404).send({ error: 'Document not found' });
    }
  });

  /**
   * DELETE /:id - Delete document
   */
  fastify.delete('/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const { id } = request.params;
    const metaPath = path.join(storagePath, `${id}.json`);

    try {
      // Read metadata to find actual file
      const content = await fs.readFile(metaPath, 'utf-8');
      const metadata = JSON.parse(content) as DocumentMetadata;
      const ext = path.extname(metadata.filename).toLowerCase();
      const filePath = path.join(storagePath, `${id}${ext}`);

      // Delete file and metadata
      await fs.unlink(filePath);
      await fs.unlink(metaPath);

      return reply.status(200).send({ success: true, message: 'Document deleted' });
    } catch {
      return reply.status(404).send({ error: 'Document not found' });
    }
  });

  /**
   * GET /:id/chunks - Get chunks for a document with pagination/filter/sort
   */
  fastify.get('/:id/chunks', async (
    request: FastifyRequest<{
      Params: { id: string };
      Querystring: {
        level?: 'small' | 'parent';
        page?: number;
        pageSize?: number;
        sortBy?: 'position' | 'qualityScore' | 'tokenCount';
        sortOrder?: 'asc' | 'desc';
        minQuality?: number;
        maxQuality?: number;
      };
    }>,
    reply: FastifyReply
  ) => {
    const { id } = request.params;
    const hierarchicalStore = fastify.hierarchicalStore;

    if (!hierarchicalStore) {
      return reply.status(503).send({ error: 'Document store not initialized' });
    }

    // Check document exists
    const metaPath = path.join(storagePath, `${id}.json`);
    try {
      await fs.access(metaPath);
    } catch {
      return reply.status(404).send({ error: 'Document not found' });
    }

    // Get paginated chunks
    const paginationOptions: {
      documentId: string;
      level?: 'small' | 'parent';
      page: number;
      pageSize: number;
      sortBy: 'position' | 'qualityScore' | 'tokenCount';
      sortOrder: 'asc' | 'desc';
      minQuality?: number;
      maxQuality?: number;
    } = {
      documentId: id,
      page: request.query.page ?? 1,
      pageSize: request.query.pageSize ?? 20,
      sortBy: request.query.sortBy ?? 'position',
      sortOrder: request.query.sortOrder ?? 'asc',
    };

    // Only add optional fields if defined
    if (request.query.level) {
      paginationOptions.level = request.query.level;
    }
    if (request.query.minQuality !== undefined) {
      paginationOptions.minQuality = request.query.minQuality;
    }
    if (request.query.maxQuality !== undefined) {
      paginationOptions.maxQuality = request.query.maxQuality;
    }

    const result = hierarchicalStore.getChunksPaginated(paginationOptions);

    // Transform chunks for response (add token count, preview)
    const transformedChunks = result.chunks.map(chunk => ({
      id: chunk.id,
      level: chunk.level,
      contentPreview: chunk.content.slice(0, 200),
      tokenCount: Math.ceil(chunk.content.length / 4),
      qualityScore: chunk.qualityScore.composite,
      position: chunk.position,
      parentId: chunk.parentId,
      childIds: chunk.childIds,
      sourceDocumentId: chunk.sourceDocumentId,
      metadata: chunk.metadata,
    }));

    return reply.status(200).send({
      documentId: id,
      chunks: transformedChunks,
      pagination: {
        total: result.total,
        page: result.page,
        pageSize: result.pageSize,
        totalPages: result.totalPages,
      },
    });
  });
}