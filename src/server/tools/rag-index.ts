/**
 * @spec tools.md#rag_index
 * @layer 6
 * @description 索引文档Tool实现
 */

import * as fs from 'fs';
import * as path from 'path';
import type {
  RagIndexInput,
  RagIndexOutput,
  ToolDefinition,
  ToolHandler
} from './interface';
import type { Document } from '../../types/index';
import { chunkingPipeline } from '../../chunking/pipeline';
import type { IEmbedder } from '../../embedding/interface';
import type { IVectorStore, IMetadataStore } from '../../storage/interface';

export const ragIndexDefinition: ToolDefinition = {
  name: 'rag_index',
  description: '索引文档到向量库',
  inputSchema: {
    type: 'object',
    properties: {
      path: { type: 'string', description: '要索引的文件或目录路径' },
      recursive: { type: 'boolean', default: true, description: '是否递归索引子目录' },
      filters: { type: 'array', items: { type: 'string' }, description: '文件过滤规则' }
    },
    required: ['path']
  }
};

export function createRagIndexHandler(
  vectorStore: IVectorStore,
  metadataStore: IMetadataStore,
  embedder: IEmbedder
): ToolHandler<RagIndexInput, RagIndexOutput> {
  return async (input: RagIndexInput): Promise<RagIndexOutput> => {
    const startTime = Date.now();
    const errors: string[] = [];
    let indexed = 0;
    let skipped = 0;

    try {
      const targetPath = path.resolve(input.path);

      if (!fs.existsSync(targetPath)) {
        return {
          indexed: 0,
          skipped: 0,
          errors: [`Path not found: ${targetPath}`],
          duration_ms: Date.now() - startTime
        };
      }

      const files = fs.statSync(targetPath).isDirectory()
        ? collectFiles(targetPath, input.recursive ?? true, input.filters)
        : [targetPath];

      for (const file of files) {
        try {
          const content = fs.readFileSync(file, 'utf-8');
          const stats = fs.statSync(file);

          const doc: Document = {
            id: `doc-${Buffer.from(file).toString('base64').slice(0, 16)}`,
            path: file,
            content,
            metadata: {
              filename: path.basename(file),
              extension: path.extname(file).slice(1),
              size: stats.size,
              createdAt: stats.birthtime,
              modifiedAt: stats.mtime
            }
          };

          // 1. 分块
          const { chunks } = await chunkingPipeline.process(doc);

          // 2. Embedding
          const embeddingsResult = await embedder.embedBatch(chunks.map(c => c.content));
          const embeddings = embeddingsResult.results.map(r => r.embedding);

          // 3. 存储向量
          for (let i = 0; i < chunks.length; i++) {
            await vectorStore.insert({
              ...chunks[i],
              embedding: embeddings[i]
            });
          }

          // 4. 存储元数据
          await metadataStore.saveDocument({
            ...doc,
            indexedAt: new Date()
          });

          for (const chunk of chunks) {
            await metadataStore.saveChunk(chunk);
          }

          indexed++;
        } catch (err) {
          errors.push(`Failed to index ${file}: ${err instanceof Error ? err.message : 'Unknown error'}`);
          skipped++;
        }
      }
    } catch (err) {
      errors.push(err instanceof Error ? err.message : 'Unknown error');
    }

    return {
      indexed,
      skipped,
      errors,
      duration_ms: Date.now() - startTime
    };
  };
}

function collectFiles(dir: string, recursive: boolean, filters?: string[]): string[] {
  const files: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory() && recursive) {
      files.push(...collectFiles(fullPath, recursive, filters));
    } else if (entry.isFile()) {
      if (matchesFilters(entry.name, filters)) {
        files.push(fullPath);
      }
    }
  }

  return files;
}

function matchesFilters(filename: string, filters?: string[]): boolean {
  if (!filters || filters.length === 0) {
    // 默认过滤常见代码和文档文件
    const defaultExtensions = ['.md', '.txt', '.ts', '.js', '.py', '.go', '.java', '.json', '.yaml', '.yml'];
    return defaultExtensions.some(ext => filename.endsWith(ext));
  }

  return filters.some(filter => {
    if (filter.startsWith('*.')) {
      return filename.endsWith(filter.slice(1));
    }
    return filename.includes(filter);
  });
}