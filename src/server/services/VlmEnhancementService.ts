/**
 * VLM增强配置
 */
export interface VlmConfig {
  apiKey: string;            // DashScope API Key
  baseUrl: string;           // DashScope API地址
  model: string;             // 模型名称
  enableThinking: boolean;   // 是否启用思考过程
  thinkingBudget: number;    // 思考过程Token限制
}

/**
 * VLM增强请求
 */
export interface VlmEnhanceRequest {
  imageBase64: string;       // 图片Base64（不含前缀）
  blockType: 'table' | 'figure' | 'formula' | 'mixed';
  contextText?: string;      // 相关上下文文本
  userQuery?: string;        // 用户问题（可选）
}

/**
 * VLM增强结果
 */
export interface VlmEnhanceResult {
  reasoning: string;         // 思考过程（如果启用）
  answer: string;            // 图片理解结果
  duration: number;          // 处理时间
  tokensUsed?: number;       // Token使用量（可选）
}

/**
 * 流式VLM事件
 */
export interface VlmStreamEvent {
  type: 'vlm:thinking' | 'vlm:answer' | 'vlm:complete' | 'vlm:error';
  content?: string;
  duration?: number;
  error?: string;
  timestamp: number;
}

const DEFAULT_VLM_CONFIG: Partial<VlmConfig> = {
  baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
  model: 'qwen3-vl-flash',
  enableThinking: false,     // 默认关闭思考过程（更快）
  thinkingBudget: 8192,
};

/**
 * VLM增强服务
 * 使用阿里云DashScope qwen3-vl-flash进行图片理解
 */
export class VlmEnhancementService {
  private config: VlmConfig | null = null;
  private enabled: boolean = false;

  constructor() {
    this.loadConfig();
  }

  /**
   * 加载配置
   */
  private loadConfig(): void {
    const apiKey = process.env.DASHSCOPE_API_KEY;

    if (!apiKey) {
      console.warn('[VlmEnhancementService] DASHSCOPE_API_KEY not configured - VLM enhancement disabled');
      this.enabled = false;
      return;
    }

    this.config = {
      apiKey,
      baseUrl: process.env.DASHSCOPE_BASE_URL ?? DEFAULT_VLM_CONFIG.baseUrl!,
      model: process.env.DASHSCOPE_MODEL ?? DEFAULT_VLM_CONFIG.model!,
      enableThinking: process.env.VLM_ENABLE_THINKING === 'true',
      thinkingBudget: parseInt(process.env.VLM_THINKING_BUDGET ?? '8192', 10),
    };

    this.enabled = true;
    console.log(`[VlmEnhancementService] Configured: model=${this.config.model}, thinking=${this.config.enableThinking}`);
  }

  /**
   * 检查是否启用
   */
  isEnabled(): boolean {
    return this.enabled && this.config !== null;
  }

  /**
   * 获取配置
   */
  getConfig(): VlmConfig | null {
    return this.config;
  }

  /**
   * 构建Prompt - 根据块类型定制
   */
  private buildPrompt(blockType: 'table' | 'figure' | 'formula' | 'mixed', contextText?: string, userQuery?: string): string {
    const prompts = {
      table: `请仔细分析这张表格图片，完成以下任务：

1. **表格结构分析**：识别表格的行列结构，注意是否有合并单元格。
2. **内容提取**：将表格内容转换为Markdown表格格式输出。
3. **关键信息**：总结表格中最重要的数据或结论。

输出格式要求：
- 使用标准Markdown表格格式
- 合并单元格用特殊标记（如 [合并]）
- 确保数据准确，不要遗漏任何单元格

${contextText ? `\n**上下文参考**：\n${contextText}\n` : ''}
${userQuery ? `\n**用户问题**：${userQuery}` : ''}`,

      figure: `请仔细分析这张图表/流程图/示意图，完成以下任务：

1. **图表类型识别**：说明这是什么类型的图表（柱状图、折线图、流程图、架构图等）。
2. **详细内容描述**：
   - 对于数据图表：描述数据趋势、峰值、关键数据点
   - 对于流程图：描述步骤顺序、决策点、分支条件
   - 对于架构图：描述模块划分、连接关系、层次结构
3. **核心结论**：总结图表传达的核心信息或结论。

${contextText ? `\n**上下文参考**：\n${contextText}\n` : ''}
${userQuery ? `\n**用户问题**：${userQuery}` : ''}`,

      formula: `请识别并分析这张数学公式图片：

1. **LaTeX格式输出**：将公式转换为标准LaTeX格式。
2. **公式解释**：解释公式中各符号的含义（如果有上下文）。
3. **计算结果**：如果公式有数值，尝试计算结果。

输出要求：
- LaTeX格式要准确，使用标准语法
- 复杂公式可以分段解析

${contextText ? `\n**上下文参考**：\n${contextText}\n` : ''}`,

      mixed: `请综合分析这张图片的内容：

1. **内容识别**：识别图片中的文字、图表、表格等元素。
2. **详细描述**：详细描述各元素的内容和含义。
3. **关联分析**：分析各元素之间的关系。

${contextText ? `\n**上下文参考**：\n${contextText}\n` : ''}
${userQuery ? `\n**用户问题**：${userQuery}` : ''}`,
    };

    return prompts[blockType];
  }

  /**
   * 增强图片理解 - 非流式
   */
  async enhance(request: VlmEnhanceRequest): Promise<VlmEnhanceResult> {
    if (!this.enabled || !this.config) {
      return {
        reasoning: '',
        answer: 'VLM enhancement not configured',
        duration: 0,
      };
    }

    const startTime = Date.now();
    const prompt = this.buildPrompt(request.blockType, request.contextText, request.userQuery);

    try {
      const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
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
              content: [
                {
                  type: 'image_url',
                  image_url: {
                    url: `data:image/png;base64,${request.imageBase64}`,
                  },
                },
                {
                  type: 'text',
                  text: prompt,
                },
              ],
            },
          ],
          stream: false,
        }),
        signal: AbortSignal.timeout(60000),  // 60秒超时
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`VLM API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json() as {
        choices: Array<{
          message: {
            reasoning_content?: string;
            content: string;
          };
        }>;
        usage?: { total_tokens: number };
      };
      const message = data.choices?.[0]?.message;
      const tokensUsed = data.usage?.total_tokens;

      return {
        reasoning: message?.reasoning_content ?? '',
        answer: message?.content ?? '',
        duration: Date.now() - startTime,
        ...(tokensUsed !== undefined ? { tokensUsed } : {}),
      };

    } catch (error) {
      console.error(`[VlmEnhancementService] Error: ${error instanceof Error ? error.message : error}`);
      return {
        reasoning: '',
        answer: `VLM enhancement failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * 增强图片理解 - 流式版本（用于实时显示）
   */
  async enhanceWithStreaming(
    request: VlmEnhanceRequest,
    broadcast: (event: VlmStreamEvent) => void
  ): Promise<VlmEnhanceResult> {
    if (!this.enabled || !this.config) {
      broadcast({
        type: 'vlm:error',
        error: 'VLM enhancement not configured',
        timestamp: Date.now(),
      });
      return { reasoning: '', answer: '', duration: 0 };
    }

    const startTime = Date.now();
    const prompt = this.buildPrompt(request.blockType, request.contextText, request.userQuery);

    try {
      const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
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
              content: [
                {
                  type: 'image_url',
                  image_url: {
                    url: `data:image/png;base64,${request.imageBase64}`,
                  },
                },
                {
                  type: 'text',
                  text: prompt,
                },
              ],
            },
          ],
          stream: true,
        }),
        signal: AbortSignal.timeout(60000),
      });

      if (!response.ok) {
        broadcast({
          type: 'vlm:error',
          error: `VLM API error: ${response.status}`,
          timestamp: Date.now(),
        });
        return { reasoning: '', answer: '', duration: Date.now() - startTime };
      }

      const reader = response.body?.getReader();
      if (!reader) {
        broadcast({
          type: 'vlm:error',
          error: 'No response body',
          timestamp: Date.now(),
        });
        return { reasoning: '', answer: '', duration: Date.now() - startTime };
      }

      const decoder = new TextDecoder();
      let reasoningContent = '';
      let answerContent = '';
      let buffer = '';
      let isAnswering = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim();
            if (data === '[DONE]') continue;

            try {
              const chunk = JSON.parse(data) as {
                choices: Array<{
                  delta: {
                    reasoning_content?: string;
                    content?: string;
                  };
                }>;
              };
              const delta = chunk.choices?.[0]?.delta;

              // 处理思考过程
              if (delta?.reasoning_content) {
                reasoningContent += delta.reasoning_content;
                broadcast({
                  type: 'vlm:thinking',
                  content: delta.reasoning_content,
                  timestamp: Date.now(),
                });
              }

              // 处理答案内容
              if (delta?.content) {
                if (!isAnswering && reasoningContent.length > 0) {
                  isAnswering = true;
                }
                answerContent += delta.content;
                broadcast({
                  type: 'vlm:answer',
                  content: delta.content,
                  timestamp: Date.now(),
                });
              }

            } catch {
              // 忽略解析错误
            }
          }
        }
      }

      const duration = Date.now() - startTime;
      broadcast({
        type: 'vlm:complete',
        duration,
        timestamp: Date.now(),
      });

      return {
        reasoning: reasoningContent,
        answer: answerContent,
        duration,
      };

    } catch (error) {
      broadcast({
        type: 'vlm:error',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: Date.now(),
      });
      return { reasoning: '', answer: '', duration: Date.now() - startTime };
    }
  }

  /**
   * 批量增强多个图片块
   */
  async enhanceBatch(
    requests: VlmEnhanceRequest[]
  ): Promise<VlmEnhanceResult[]> {
    // 串行处理，避免API限流
    const results: VlmEnhanceResult[] = [];

    for (const request of requests) {
      const result = await this.enhance(request);
      results.push(result);

      // 添加延迟避免限流
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    return results;
  }
}

/**
 * 单例实例
 */
export const vlmEnhancementService = new VlmEnhancementService();