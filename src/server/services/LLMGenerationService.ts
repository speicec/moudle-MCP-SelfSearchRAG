import WebSocket from 'ws';

/**
 * LLM Generation Service configuration
 */
export interface LLMGenerationConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
}

/**
 * Generation request payload
 */
export interface GenerationRequest {
  query: string;
  context: string;
  sources: Array<{
    content: string;
    similarityScore: number;
    sourceId: string;
  }>;
}

/**
 * SSE chunk parsed from DeepSeek API
 */
export interface SSEChunk {
  id?: string;
  object?: string;
  choices?: Array<{
    index: number;
    delta: {
      role?: string;
      content?: string;
      reasoning_content?: string;
    };
    finish_reason?: string | null;
  }>;
}

/**
 * Generation event for WebSocket broadcasting
 */
export interface GenerationEvent {
  type: 'generation:start' | 'generation:thinking' | 'generation:answer' | 'generation:complete' | 'generation:error';
  phase?: 'analysis' | 'retrieval' | 'reasoning' | 'answer';
  query?: string;
  sourcesCount?: number;
  thinkingContent?: string;
  answerContent?: string;
  thinkingTokens?: number;
  answerTokens?: number;
  totalDuration?: number;
  error?: string;
  timestamp: number;
}

/**
 * Default configuration values
 */
const DEFAULT_BASE_URL = 'https://api.deepseek.com';
const DEFAULT_MODEL = 'deepseek-reasoner';

/**
 * LLM Generation Service
 * Integrates with DeepSeek API for streaming answer generation with thinking chain
 */
export class LLMGenerationService {
  private config: LLMGenerationConfig | null = null;
  private enabled: boolean = false;

  constructor() {
    this.loadConfig();
  }

  /**
   * Load configuration from environment variables
   */
  private loadConfig(): void {
    const apiKey = process.env.DEEPSEEK_API_KEY;
    const baseUrl = process.env.DEEPSEEK_BASE_URL || DEFAULT_BASE_URL;
    const model = process.env.DEEPSEEK_MODEL || DEFAULT_MODEL;

    if (!apiKey) {
      console.warn('[LLMGenerationService] DEEPSEEK_API_KEY not configured - LLM generation disabled');
      this.enabled = false;
      return;
    }

    this.config = {
      apiKey,
      baseUrl,
      model,
    };
    this.enabled = true;
    console.log(`[LLMGenerationService] Configured with model: ${model}, baseUrl: ${baseUrl}`);
  }

  /**
   * Check if LLM generation is enabled
   */
  isEnabled(): boolean {
    return this.enabled && this.config !== null;
  }

  /**
   * Get current configuration (for debugging)
   */
  getConfig(): LLMGenerationConfig | null {
    return this.config;
  }

  /**
   * Construct RAG prompt from query and retrieved context
   */
  constructPrompt(request: GenerationRequest): string {
    const { query, context, sources } = request;

    // Build reference material section
    const referenceSection = sources.length > 0
      ? sources.map((s, i) => `---\n${s.content}\n---`).join('\n')
      : '无相关参考资料';

    const prompt = `用户问题: ${query}

参考资料:
${referenceSection}

请基于参考资料回答用户问题。如果参考资料中没有相关信息，请说明无法回答。回答应当准确、简洁、有条理。`;

    return prompt;
  }

  /**
   * Execute streaming generation and emit events via WebSocket
   * @param request Generation request with query and context
   * @param wsHandler WebSocket handler for broadcasting events
   * @returns Promise resolving to complete generation result
   */
  async generateWithStreaming(
    request: GenerationRequest,
    broadcast: (event: GenerationEvent) => void
  ): Promise<{ thinking: string; answer: string; duration: number }> {
    if (!this.enabled || !this.config) {
      broadcast({
        type: 'generation:error',
        error: 'LLM generation not configured - missing DEEPSEEK_API_KEY',
        timestamp: Date.now(),
      });
      return { thinking: '', answer: '', duration: 0 };
    }

    const startTime = Date.now();
    const prompt = this.constructPrompt(request);

    // Emit generation:start event
    broadcast({
      type: 'generation:start',
      query: request.query,
      sourcesCount: request.sources.length,
      timestamp: startTime,
    });

    try {
      // Call DeepSeek API with streaming
      const response = await fetch(`${this.config.baseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify({
          model: this.config.model,
          messages: [
            {
              role: 'user',
              content: prompt,
            },
          ],
          stream: true,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        broadcast({
          type: 'generation:error',
          error: `DeepSeek API error: ${response.status} - ${errorText}`,
          timestamp: Date.now(),
        });
        return { thinking: '', answer: '', duration: Date.now() - startTime };
      }

      // Parse SSE stream
      const reader = response.body?.getReader();
      if (!reader) {
        broadcast({
          type: 'generation:error',
          error: 'No response body from DeepSeek API',
          timestamp: Date.now(),
        });
        return { thinking: '', answer: '', duration: Date.now() - startTime };
      }

      const decoder = new TextDecoder();
      let thinkingContent = '';
      let answerContent = '';
      let buffer = '';
      let chunkCount = 0; // Debug counter

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          // Process any remaining buffer content
          if (buffer.trim()) {
            console.log(`[SSE Debug] Final buffer content: "${buffer.slice(0, 100)}..."`);
          }
          break;
        }

        buffer += decoder.decode(value, { stream: true });

        // Process complete SSE messages in buffer
        // SSE messages are separated by \n\n, so we split by \n
        const lines = buffer.split('\n');

        // Keep the last line in buffer (it may be incomplete)
        // If the last line is empty, it means we had a complete message
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim();
            if (data === '[DONE]') {
              console.log('[SSE Debug] Stream complete signal received');
              continue;
            }

            // Skip empty data
            if (!data) continue;

            try {
              const chunk: SSEChunk = JSON.parse(data);
              const delta = chunk.choices?.[0]?.delta;
              chunkCount++;

              if (delta?.reasoning_content) {
                // Debug: Log thinking chunk
                if (chunkCount <= 5 || chunkCount % 50 === 0) {
                  console.log(`[SSE Debug] Thinking chunk #${chunkCount}: "${delta.reasoning_content.slice(0, 50)}..."`);
                }
                thinkingContent += delta.reasoning_content;
                broadcast({
                  type: 'generation:thinking',
                  phase: 'reasoning',
                  thinkingContent: delta.reasoning_content,
                  timestamp: Date.now(),
                });
              }

              if (delta?.content) {
                // Debug: Log answer chunk
                if (chunkCount <= 5 || chunkCount % 50 === 0) {
                  console.log(`[SSE Debug] Answer chunk #${chunkCount}: "${delta.content.slice(0, 50)}..."`);
                }
                answerContent += delta.content;
                broadcast({
                  type: 'generation:answer',
                  phase: 'answer',
                  answerContent: delta.content,
                  timestamp: Date.now(),
                });
              }
            } catch (e) {
              // Skip malformed JSON - this can happen with incomplete lines
              console.warn(`[SSE Debug] Failed to parse chunk: "${data.slice(0, 100)}..."`);
            }
          }
        }
      }

      // Debug: Log final stats
      console.log(`[SSE Debug] Stream complete: ${chunkCount} chunks, thinking: ${thinkingContent.length} chars, answer: ${answerContent.length} chars`);
      console.log(`[SSE Debug] Thinking preview: "${thinkingContent.slice(0, 200)}..."`);
      console.log(`[SSE Debug] Answer preview: "${answerContent.slice(0, 200)}..."`);

      const duration = Date.now() - startTime;

      // Emit generation:complete event
      console.log(`[SSE Debug] Broadcasting generation:complete event`);
      broadcast({
        type: 'generation:complete',
        thinkingTokens: thinkingContent.length,
        answerTokens: answerContent.length,
        totalDuration: duration,
        timestamp: Date.now(),
      });
      console.log(`[SSE Debug] generation:complete broadcast done`);

      return {
        thinking: thinkingContent,
        answer: answerContent,
        duration,
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      broadcast({
        type: 'generation:error',
        error: errorMessage,
        timestamp: Date.now(),
      });
      return { thinking: '', answer: '', duration: Date.now() - startTime };
    }
  }

  /**
   * Execute generation without streaming (for testing/fallback)
   */
  async generateOnce(request: GenerationRequest): Promise<{ thinking: string; answer: string }> {
    if (!this.enabled || !this.config) {
      return { thinking: '', answer: 'LLM generation not configured' };
    }

    const prompt = this.constructPrompt(request);

    try {
      const response = await fetch(`${this.config.baseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify({
          model: this.config.model,
          messages: [
            {
              role: 'user',
              content: prompt,
            },
          ],
          stream: false,
        }),
      });

      if (!response.ok) {
        return { thinking: '', answer: `Error: ${response.status}` };
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || '';
      const reasoning = data.choices?.[0]?.message?.reasoning_content || '';

      return {
        thinking: reasoning,
        answer: content,
      };

    } catch (error) {
      return {
        thinking: '',
        answer: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}

/**
 * Singleton instance
 */
export const llmGenerationService = new LLMGenerationService();