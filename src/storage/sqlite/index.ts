/**
 * @spec architecture.md#SQLite
 * @layer 1
 * @description SQLite 元数据存储实现 (使用 sql.js)
 */

import initSqlJs from 'sql.js';
import type { Database, SqlJsStatic } from 'sql.js';
import type {
  IMetadataStore,
  IFullTextStore,
  StorageStats,
  SearchResult,
  Chunk,
  Document
} from '../interface';
import type { StorageConfig } from '../../types/config.types';

export class SQLiteMetadataStore implements IMetadataStore {
  private SQL: SqlJsStatic | null = null;
  private _db: Database | null = null;

  constructor(_config: StorageConfig['sqlite']) {}

  async connect(): Promise<void> {
    this.SQL = await initSqlJs();
    this._db = new this.SQL.Database();

    this._db.run(`
      CREATE TABLE IF NOT EXISTS documents (
        id TEXT PRIMARY KEY,
        path TEXT NOT NULL,
        content TEXT,
        filename TEXT,
        extension TEXT,
        size INTEGER,
        created_at TEXT,
        modified_at TEXT,
        indexed_at TEXT,
        metadata TEXT
      )
    `);

    this._db.run(`
      CREATE TABLE IF NOT EXISTS chunks (
        id TEXT PRIMARY KEY,
        doc_id TEXT NOT NULL,
        content TEXT NOT NULL,
        position_start INTEGER,
        position_end INTEGER,
        type TEXT,
        language TEXT,
        section TEXT,
        created_at TEXT
      )
    `);

    this._db.run(`
      CREATE TABLE IF NOT EXISTS chunks_search (
        id TEXT PRIMARY KEY,
        doc_id TEXT NOT NULL,
        content TEXT NOT NULL
      )
    `);

    this._db.run(`CREATE INDEX IF NOT EXISTS idx_chunks_doc_id ON chunks(doc_id)`);
    this._db.run(`CREATE INDEX IF NOT EXISTS idx_documents_path ON documents(path)`);
  }

  async disconnect(): Promise<void> {
    if (this._db) {
      this._db.close();
      this._db = null;
    }
  }

  async saveDocument(doc: Document): Promise<void> {
    if (!this._db) throw new Error('Not connected');
    this._db.run(`
      INSERT OR REPLACE INTO documents
      (id, path, content, filename, extension, size, created_at, modified_at, indexed_at, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      doc.id, doc.path, doc.content, doc.metadata.filename, doc.metadata.extension,
      doc.metadata.size, doc.metadata.createdAt?.toISOString() || null,
      doc.metadata.modifiedAt?.toISOString() || null,
      doc.indexedAt?.toISOString() || new Date().toISOString(), JSON.stringify(doc.metadata)
    ]);
  }

  async getDocument(docId: string): Promise<Document | null> {
    if (!this._db) throw new Error('Not connected');
    const result = this._db.exec('SELECT * FROM documents WHERE id = ?', [docId]);
    if (result.length === 0 || result[0].values.length === 0) return null;
    return this.rowToDocument(result[0], 0);
  }

  async deleteDocument(docId: string): Promise<void> {
    if (!this._db) throw new Error('Not connected');
    await this.deleteChunksByDocId(docId);
    this._db.run('DELETE FROM documents WHERE id = ?', [docId]);
  }

  async listDocuments(): Promise<Document[]> {
    if (!this._db) throw new Error('Not connected');
    const result = this._db.exec('SELECT * FROM documents ORDER BY indexed_at DESC');
    if (result.length === 0) return [];
    return result[0].values.map((_v, i) => this.rowToDocument(result[0], i));
  }

  async saveChunk(chunk: Chunk): Promise<void> {
    if (!this._db) throw new Error('Not connected');
    this._db.run(`
      INSERT OR REPLACE INTO chunks
      (id, doc_id, content, position_start, position_end, type, language, section, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      chunk.id, chunk.docId, chunk.content, chunk.position.start, chunk.position.end,
      chunk.metadata.type, chunk.metadata.language || null, chunk.metadata.section || null,
      new Date().toISOString()
    ]);
    this._db.run(`INSERT OR REPLACE INTO chunks_search (id, doc_id, content) VALUES (?, ?, ?)`,
      [chunk.id, chunk.docId, chunk.content]);
  }

  async getChunk(chunkId: string): Promise<Chunk | null> {
    if (!this._db) throw new Error('Not connected');
    const result = this._db.exec('SELECT * FROM chunks WHERE id = ?', [chunkId]);
    if (result.length === 0 || result[0].values.length === 0) return null;
    return this.rowToChunk(result[0], 0);
  }

  async getChunksByDocId(docId: string): Promise<Chunk[]> {
    if (!this._db) throw new Error('Not connected');
    const result = this._db.exec('SELECT * FROM chunks WHERE doc_id = ? ORDER BY position_start', [docId]);
    if (result.length === 0) return [];
    return result[0].values.map((_v, i) => this.rowToChunk(result[0], i));
  }

  async deleteChunksByDocId(docId: string): Promise<void> {
    if (!this._db) throw new Error('Not connected');
    this._db.run('DELETE FROM chunks_search WHERE doc_id = ?', [docId]);
    this._db.run('DELETE FROM chunks WHERE doc_id = ?', [docId]);
  }

  async getStats(): Promise<StorageStats> {
    if (!this._db) throw new Error('Not connected');
    const docResult = this._db.exec('SELECT COUNT(*) as count FROM documents');
    const chunkResult = this._db.exec('SELECT COUNT(*) as count FROM chunks');
    const sizeResult = this._db.exec('SELECT SUM(size) as size FROM documents');
    return {
      documentCount: docResult[0]?.values[0]?.[0] as number || 0,
      chunkCount: chunkResult[0]?.values[0]?.[0] as number || 0,
      totalSize: sizeResult[0]?.values[0]?.[0] as number || 0
    };
  }

  get db(): Database | null { return this._db; }

  private rowToDocument(result: { columns: string[]; values: unknown[][] }, index: number): Document {
    const { columns, values } = result;
    const get = (name: string): unknown => values[index][columns.indexOf(name)];
    return {
      id: get('id') as string, path: get('path') as string, content: get('content') as string,
      metadata: { ...JSON.parse((get('metadata') as string) || '{}'), filename: get('filename') as string,
        extension: get('extension') as string, size: get('size') as number,
        createdAt: get('created_at') ? new Date(get('created_at') as string) : undefined,
        modifiedAt: get('modified_at') ? new Date(get('modified_at') as string) : undefined },
      indexedAt: get('indexed_at') ? new Date(get('indexed_at') as string) : undefined
    };
  }

  private rowToChunk(result: { columns: string[]; values: unknown[][] }, index: number): Chunk {
    const { columns, values } = result;
    const get = (name: string): unknown => values[index][columns.indexOf(name)];
    const typeVal = get('type') as string;
    return {
      id: get('id') as string, docId: get('doc_id') as string, content: get('content') as string,
      position: { start: get('position_start') as number, end: get('position_end') as number },
      metadata: {
        type: (typeVal === 'text' || typeVal === 'code' || typeVal === 'mixed') ? typeVal : 'text',
        language: get('language') as string | undefined,
        section: get('section') as string | undefined
      }
    };
  }
}

export class SQLiteFullTextStore implements IFullTextStore {
  constructor(private store: SQLiteMetadataStore) {}
  async index(): Promise<void> {}
  async indexBatch(): Promise<void> {}
  async delete(): Promise<void> {}

  async search(query: string, topK: number): Promise<SearchResult[]> {
    const db = this.store.db;
    if (!db) throw new Error('Not connected');
    const result = db.exec(`
      SELECT c.id, c.doc_id, c.content, d.path as source, c.type, c.language
      FROM chunks_search cs JOIN chunks c ON cs.id = c.id JOIN documents d ON c.doc_id = d.id
      WHERE cs.content LIKE ? LIMIT ?
    `, [`%${query}%`, topK]);
    if (result.length === 0) return [];
    const { columns } = result[0];
    return result[0].values.map((values) => {
      const get = (name: string): unknown => values[columns.indexOf(name)];
      const typeVal = get('type') as string;
      const validType = (typeVal === 'text' || typeVal === 'code' || typeVal === 'mixed') ? typeVal : 'text';
      return {
        chunkId: get('id') as string,
        docId: get('doc_id') as string,
        content: get('content') as string,
        score: 0.5,
        source: get('source') as string,
        metadata: {
          type: validType as 'text' | 'code' | 'mixed',
          language: get('language') as string | undefined
        }
      };
    });
  }
}