import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { VlmEnhancementService, vlmEnhancementService, type VlmEnhanceRequest, type VlmStreamEvent } from './VlmEnhancementService.js';

// Mock fetch for VLM API calls
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('VlmEnhancementService', () => {
  let service: VlmEnhancementService;

  beforeAll(() => {
    // Set environment for testing
    process.env.DASHSCOPE_API_KEY = 'test-api-key';
    process.env.DASHSCOPE_BASE_URL = 'https://test-api.example.com';
    process.env.DASHSCOPE_MODEL = 'test-model';
    process.env.VLM_ENABLE_THINKING = 'false';
    process.env.VLM_THINKING_BUDGET = '4096';

    service = new VlmEnhancementService();
  });

  afterAll(() => {
    vi.restoreAllMocks();
    delete process.env.DASHSCOPE_API_KEY;
    delete process.env.DASHSCOPE_BASE_URL;
    delete process.env.DASHSCOPE_MODEL;
    delete process.env.VLM_ENABLE_THINKING;
    delete process.env.VLM_THINKING_BUDGET;
  });

  describe('constructor and configuration', () => {
    it('should load config from environment', () => {
      const config = service.getConfig();
      expect(config?.apiKey).toBe('test-api-key');
      expect(config?.baseUrl).toBe('https://test-api.example.com');
      expect(config?.model).toBe('test-model');
      expect(config?.enableThinking).toBe(false);
      expect(config?.thinkingBudget).toBe(4096);
    });

    it('should be enabled when API key is configured', () => {
      expect(service.isEnabled()).toBe(true);
    });

    it('should be disabled when API key is missing', () => {
      delete process.env.DASHSCOPE_API_KEY;
      const disabledService = new VlmEnhancementService();
      expect(disabledService.isEnabled()).toBe(false);
    });

    it('should use default values when env vars are missing', () => {
      process.env.DASHSCOPE_API_KEY = 'key';
      delete process.env.DASHSCOPE_BASE_URL;
      delete process.env.DASHSCOPE_MODEL;

      const defaultService = new VlmEnhancementService();
      const config = defaultService.getConfig();

      expect(config?.baseUrl).toBe('https://dashscope.aliyuncs.com/compatible-mode/v1');
      expect(config?.model).toBe('qwen3-vl-flash');
    });
  });

  describe('buildPrompt', () => {
    it('should build table prompt', () => {
      // Access private method through reflection for testing
      const serviceWithPrivate = service as any;
      const prompt = serviceWithPrivate.buildPrompt('table', 'Context info', 'User question');

      expect(prompt).toContain('表格');
      expect(prompt).toContain('Markdown');
      expect(prompt).toContain('Context info');
      expect(prompt).toContain('User question');
    });

    it('should build figure prompt', () => {
      const serviceWithPrivate = service as any;
      const prompt = serviceWithPrivate.buildPrompt('figure');

      expect(prompt).toContain('图表');
      expect(prompt).toContain('图表类型识别');
      expect(prompt).toContain('详细内容描述');
    });

    it('should build formula prompt', () => {
      const serviceWithPrivate = service as any;
      const prompt = serviceWithPrivate.buildPrompt('formula', 'Mathematical context');

      expect(prompt).toContain('数学公式');
      expect(prompt).toContain('LaTeX');
      expect(prompt).toContain('Mathematical context');
    });

    it('should build mixed prompt', () => {
      const serviceWithPrivate = service as any;
      const prompt = serviceWithPrivate.buildPrompt('mixed');

      expect(prompt).toContain('综合分析');
      expect(prompt).toContain('内容识别');
      expect(prompt).toContain('关联分析');
    });

    it('should omit context and query when not provided', () => {
      const serviceWithPrivate = service as any;
      const prompt = serviceWithPrivate.buildPrompt('table');

      expect(prompt).not.toContain('上下文参考');
      expect(prompt).not.toContain('用户问题');
    });
  });

  describe('enhance (non-streaming)', () => {
    it('should call VLM API and return result', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: 'Table analysis result',
                reasoning_content: 'Thinking process...',
              },
            },
          ],
          usage: { total_tokens: 500 },
        }),
      });

      const request: VlmEnhanceRequest = {
        imageBase64: 'base64ImageData',
        blockType: 'table',
        contextText: 'Context',
        userQuery: 'Question',
      };

      const result = await service.enhance(request);

      expect(result.answer).toBe('Table analysis result');
      expect(result.reasoning).toBe('Thinking process...');
      expect(result.duration).toBeDefined();
      expect(result.tokensUsed).toBe(500);
    });

    it('should handle API error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => 'Internal Server Error',
      });

      const request: VlmEnhanceRequest = {
        imageBase64: 'base64ImageData',
        blockType: 'figure',
      };

      const result = await service.enhance(request);

      expect(result.answer).toContain('VLM API error');
      // Duration might be 0 if error happens immediately, so just check it's defined
      expect(result.duration).toBeDefined();
    });

    it('should return message when disabled', async () => {
      delete process.env.DASHSCOPE_API_KEY;
      const disabledService = new VlmEnhancementService();

      const request: VlmEnhanceRequest = {
        imageBase64: 'data',
        blockType: 'table',
      };

      const result = await disabledService.enhance(request);

      expect(result.answer).toBe('VLM enhancement not configured');
    });
  });

  describe('enhanceWithStreaming', () => {
    it('should stream VLM response and broadcast events', async () => {
      // Mock streaming response
      const mockReader = {
        read: vi.fn()
          .mockResolvedValueOnce({
            done: false,
            value: new TextEncoder().encode('data: {"choices":[{"delta":{"reasoning_content":"think"}}]}\n\n'),
          })
          .mockResolvedValueOnce({
            done: false,
            value: new TextEncoder().encode('data: {"choices":[{"delta":{"content":"answer"}}]}\n\n'),
          })
          .mockResolvedValueOnce({
            done: true,
            value: undefined,
          }),
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: { getReader: () => mockReader },
      });

      const events: VlmStreamEvent[] = [];
      const broadcast = (event: VlmStreamEvent) => events.push(event);

      const request: VlmEnhanceRequest = {
        imageBase64: 'streamData',
        blockType: 'figure',
      };

      const result = await service.enhanceWithStreaming(request, broadcast);

      // Should have collected events
      expect(events.length).toBeGreaterThan(0);
      expect(events.some(e => e.type === 'vlm:thinking')).toBe(true);
      expect(events.some(e => e.type === 'vlm:answer')).toBe(true);
      expect(events.some(e => e.type === 'vlm:complete')).toBe(true);

      expect(result.reasoning).toContain('think');
      expect(result.answer).toContain('answer');
    });

    it('should broadcast error on API failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => 'Error',
      });

      const events: VlmStreamEvent[] = [];
      const broadcast = (event: VlmStreamEvent) => events.push(event);

      const request: VlmEnhanceRequest = {
        imageBase64: 'data',
        blockType: 'table',
      };

      const result = await service.enhanceWithStreaming(request, broadcast);

      expect(events.some(e => e.type === 'vlm:error')).toBe(true);
      expect(result.answer).toBe('');
    });

    it('should handle missing response body', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: null,
      });

      const events: VlmStreamEvent[] = [];
      const broadcast = (event: VlmStreamEvent) => events.push(event);

      const request: VlmEnhanceRequest = {
        imageBase64: 'data',
        blockType: 'formula',
      };

      const result = await service.enhanceWithStreaming(request, broadcast);

      expect(events.some(e => e.type === 'vlm:error')).toBe(true);
    });
  });

  describe('enhanceBatch', () => {
    it('should process multiple requests sequentially', async () => {
      // Setup mock to return results for each call
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            choices: [{ message: { content: 'Result 1' } }],
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            choices: [{ message: { content: 'Result 2' } }],
          }),
        });

      const requests: VlmEnhanceRequest[] = [
        { imageBase64: 'img1', blockType: 'table' },
        { imageBase64: 'img2', blockType: 'figure' },
      ];

      const results = await service.enhanceBatch(requests);

      expect(results.length).toBe(2);
      expect(results[0].answer).toBe('Result 1');
      expect(results[1].answer).toBe('Result 2');
    });
  });
});

describe('singleton instance', () => {
  it('should export a singleton instance', () => {
    expect(vlmEnhancementService).toBeInstanceOf(VlmEnhancementService);
  });
});