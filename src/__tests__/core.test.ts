import { describe, it, expect } from 'vitest';
import { Pipeline } from '../src/core/pipeline.js';
import { Context, ProcessingState } from '../src/core/context.js';
import { Document, createDocument } from '../src/core/document.js';
import { BasePlugin } from '../src/core/plugin.js';
import { BaseStage } from '../src/core/stage.js';

describe('Harness Core', () => {
  describe('Context', () => {
    it('should create context with initial document', () => {
      const doc = createDocument('test content', {
        filename: 'test.txt',
        mimeType: 'text/plain',
      });

      const ctx = new Context(doc);

      expect(ctx.getDocument()).toBeDefined();
      expect(ctx.getDocumentId()).toBe(doc.id);
    });

    it('should get and set values', () => {
      const ctx = new Context();

      ctx.set('test', 'value');
      expect(ctx.get('test')).toBe('value');
    });

    it('should track errors', () => {
      const ctx = new Context();

      ctx.addError({
        stage: 'test',
        message: 'test error',
        recoverable: false,
      });

      expect(ctx.hasErrors()).toBe(true);
      expect(ctx.getErrors()).toHaveLength(1);
    });
  });

  describe('Document', () => {
    it('should create document with metadata', () => {
      const doc = createDocument('test content', {
        filename: 'test.txt',
        mimeType: 'text/plain',
      });

      expect(doc.id).toBeDefined();
      expect(doc.metadata.filename).toBe('test.txt');
      expect(doc.metadata.format).toBe('text');
      expect(doc.status).toBe('pending');
    });

    it('should detect PDF format', () => {
      const doc = createDocument(Buffer.from('test'), {
        filename: 'test.pdf',
        mimeType: 'application/pdf',
      });

      expect(doc.metadata.format).toBe('pdf');
    });
  });

  describe('Plugin', () => {
    it('should create plugin with name', () => {
      class TestPlugin extends BasePlugin {
        constructor() {
          super('test');
        }
        async process(ctx: Context) {
          return ctx;
        }
      }

      const plugin = new TestPlugin();
      expect(plugin.name).toBe('test');
    });
  });

  describe('Stage', () => {
    it('should execute plugins in sequence', async () => {
      class TestPlugin extends BasePlugin {
        constructor(name: string, private value: string) {
          super(name);
        }
        async process(ctx: Context) {
          ctx.set(this.name, this.value);
          return ctx;
        }
      }

      class TestStage extends BaseStage {
        constructor() {
          super('test', [
            new TestPlugin('p1', 'v1'),
            new TestPlugin('p2', 'v2'),
          ]);
        }
      }

      const stage = new TestStage();
      const ctx = new Context();
      const result = await stage.execute(ctx);

      expect(result.get('p1')).toBe('v1');
      expect(result.get('p2')).toBe('v2');
    });
  });
});