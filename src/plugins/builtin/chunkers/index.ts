/**
 * @spec plugin-system.md#内置插件
 * @layer 1
 * @description 内置Chunker插件
 */

import { BasePlugin } from '../../interface';
import type { PluginDefinition } from '../../../types/index';
import type { IChunker, ChunkingConfig } from '../../../chunking/interface';
import type { Document, Chunk } from '../../../types/index';
import { RecursiveChunker, FixedSizeChunker, MarkdownSectionChunker } from '../../../chunking/splitters/index';

// Recursive Chunker Plugin
class RecursiveChunkerPlugin extends BasePlugin implements IChunker {
  meta = {
    name: 'chunker:recursive',
    version: '1.0.0',
    type: 'chunker' as const,
    compatibleVersions: ['1.x']
  };

  private chunker = new RecursiveChunker();

  async chunk(document: Document, config?: ChunkingConfig): Promise<Chunk[]> {
    return this.chunker.chunk(document, config);
  }
}

// Fixed Size Chunker Plugin
class FixedSizeChunkerPlugin extends BasePlugin implements IChunker {
  meta = {
    name: 'chunker:fixed-size',
    version: '1.0.0',
    type: 'chunker' as const,
    compatibleVersions: ['1.x']
  };

  private chunker = new FixedSizeChunker();

  async chunk(document: Document, config?: ChunkingConfig): Promise<Chunk[]> {
    return this.chunker.chunk(document, config);
  }
}

// Markdown Chunker Plugin
class MarkdownChunkerPlugin extends BasePlugin implements IChunker {
  meta = {
    name: 'chunker:markdown',
    version: '1.0.0',
    type: 'chunker' as const,
    compatibleVersions: ['1.x']
  };

  private chunker = new MarkdownSectionChunker();

  async chunk(document: Document, config?: ChunkingConfig): Promise<Chunk[]> {
    return this.chunker.chunk(document, config);
  }
}

// 插件定义
export const recursiveChunkerDefinition: PluginDefinition = {
  meta: {
    name: 'chunker:recursive',
    version: '1.0.0',
    type: 'chunker',
    compatibleVersions: ['1.x']
  },
  factory: () => new RecursiveChunkerPlugin()
};

export const fixedSizeChunkerDefinition: PluginDefinition = {
  meta: {
    name: 'chunker:fixed-size',
    version: '1.0.0',
    type: 'chunker',
    compatibleVersions: ['1.x']
  },
  factory: () => new FixedSizeChunkerPlugin()
};

export const markdownChunkerDefinition: PluginDefinition = {
  meta: {
    name: 'chunker:markdown',
    version: '1.0.0',
    type: 'chunker',
    compatibleVersions: ['1.x']
  },
  factory: () => new MarkdownChunkerPlugin()
};