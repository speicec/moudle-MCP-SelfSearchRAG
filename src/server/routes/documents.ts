import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { DocumentMetadata, PipelineEvent } from '../types.js';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs/promises';
import path from 'path';

const SUPPORTED_FILE_TYPES = ['.pdf', '.txt', '.md'];
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

declare module 'fastify' {
  interface FastifyInstance {
    documentStoragePath?: string;
    wsHandler?: import('../websocket-handler.js').WebSocketHandler;
  }
}

/**
 * Document routes as Fastify plugin
 */
export async function documentRoutes(fastify: FastifyInstance): Promise<void> {
  const storagePath = fastify.documentStoragePath ?? './data/documents';
  const wsHandler = fastify.wsHandler;

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

    // Create metadata
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

    // Emit pipeline:start event
    if (wsHandler) {
      const startEvent: PipelineEvent = {
        type: 'pipeline:start',
        documentId,
        message: `Document ${data.filename} uploaded, starting pipeline`,
        timestamp: Date.now(),
      };
      wsHandler.broadcast(startEvent);
    }

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
}