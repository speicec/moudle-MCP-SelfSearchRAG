import { BasePlugin } from './plugin.js';
import type { Context, ProcessingState } from './context.js';
import type { Document } from './document.js';
import { BaseStage } from './stage.js';
import { DocumentValidator, createValidator } from './validator.js';
import { DocumentStorage, globalStorage } from './storage.js';
import { ProcessingState as State } from './context.js';

/**
 * Ingest plugin - validates and stores document
 */
export class IngestPlugin extends BasePlugin {
  private validator: DocumentValidator;
  private storage: DocumentStorage;

  constructor(
    validator?: DocumentValidator,
    storage?: DocumentStorage
  ) {
    super('ingest');
    this.validator = validator ?? createValidator();
    this.storage = storage ?? globalStorage;
  }

  /**
   * Process the document through ingestion
   */
  async process(ctx: Context): Promise<Context> {
    const document = ctx.getDocument();

    if (!document) {
      ctx.addError({
        stage: 'ingest',
        plugin: this.name,
        message: 'No document in context',
        recoverable: false,
      });
      return ctx;
    }

    // Validate document
    const validationResult = this.validator.validate(document);
    if (!validationResult.valid) {
      for (const error of validationResult.errors) {
        ctx.addError({
          stage: 'ingest',
          plugin: this.name,
          message: `Validation error: ${error.field} - ${error.message}`,
          recoverable: false,
        });
      }
      return ctx;
    }

    // Store document
    try {
      const storedDocument = await this.storage.store(document);
      ctx.set('document', storedDocument);
      ctx.set('documentId', storedDocument.id);
      ctx.set('metadata', storedDocument.metadata);
      ctx.setState(State.INGESTING);
    } catch (error) {
      ctx.addError({
        stage: 'ingest',
        plugin: this.name,
        message: error instanceof Error ? error.message : 'Storage error',
        recoverable: false,
      });
    }

    return ctx;
  }
}

/**
 * Ingest stage - orchestrates document ingestion
 */
export class IngestStage extends BaseStage {
  constructor(validator?: DocumentValidator, storage?: DocumentStorage) {
    super('ingest', [new IngestPlugin(validator, storage)]);
  }
}

/**
 * Create ingest plugin
 */
export function createIngestPlugin(
  validator?: DocumentValidator,
  storage?: DocumentStorage
): IngestPlugin {
  return new IngestPlugin(validator, storage);
}

/**
 * Create ingest stage
 */
export function createIngestStage(
  validator?: DocumentValidator,
  storage?: DocumentStorage
): IngestStage {
  return new IngestStage(validator, storage);
}