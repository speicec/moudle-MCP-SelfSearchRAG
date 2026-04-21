/**
 * LLM Configuration - LLM API 配置
 *
 * 支持 Claude API、OpenAI API、Ollama 等多种 LLM 后端
 */

/**
 * LLM Provider 类型
 */
export type LLMProvider = 'anthropic' | 'openai' | 'ollama';

/**
 * LLM 配置
 */
export interface LLMConfig {
  provider: LLMProvider;
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
}

/**
 * 默认 Anthropic 配置
 */
export const DEFAULT_ANTHROPIC_CONFIG: LLMConfig = {
  provider: 'anthropic',
  model: 'claude-sonnet-4-6',
  maxTokens: 4096,
  temperature: 0.3,
};

/**
 * 默认 OpenAI 配置
 */
export const DEFAULT_OPENAI_CONFIG: LLMConfig = {
  provider: 'openai',
  model: 'gpt-4-turbo',
  maxTokens: 4096,
  temperature: 0.3,
};

/**
 * 默认 Ollama 配置
 */
export const DEFAULT_OLLAMA_CONFIG: LLMConfig = {
  provider: 'ollama',
  baseUrl: 'http://localhost:11434',
  model: 'llama3',
  maxTokens: 4096,
  temperature: 0.3,
};

/**
 * LLMCaller - LLM 调用接口
 *
 * 简化的 LLM 调用函数类型，用于 Agent 推理
 */
export type LLMCaller = (prompt: string) => Promise<string>;

/**
 * 创建 Anthropic LLMCaller
 */
export function createAnthropicCaller(config: LLMConfig): LLMCaller {
  const apiKey = config.apiKey ?? process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is required for Anthropic provider');
  }

  return async (prompt: string): Promise<string> => {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: config.model ?? DEFAULT_ANTHROPIC_CONFIG.model,
        max_tokens: config.maxTokens ?? DEFAULT_ANTHROPIC_CONFIG.maxTokens,
        temperature: config.temperature ?? DEFAULT_ANTHROPIC_CONFIG.temperature,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Anthropic API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json() as {
      content: Array<{ type: string; text: string }>;
    };

    const textContent = data.content.find(c => c.type === 'text');
    return textContent?.text ?? '';
  };
}

/**
 * 创建 OpenAI LLMCaller
 */
export function createOpenAICaller(config: LLMConfig): LLMCaller {
  const apiKey = config.apiKey ?? process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is required for OpenAI provider');
  }

  return async (prompt: string): Promise<string> => {
    const baseUrl = config.baseUrl ?? 'https://api.openai.com/v1';

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: config.model ?? DEFAULT_OPENAI_CONFIG.model,
        max_tokens: config.maxTokens ?? DEFAULT_OPENAI_CONFIG.maxTokens,
        temperature: config.temperature ?? DEFAULT_OPENAI_CONFIG.temperature,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json() as {
      choices: Array<{
        message: {
          content: string;
        };
      }>;
    };

    return data.choices[0]?.message?.content ?? '';
  };
}

/**
 * 创建 Ollama LLMCaller
 */
export function createOllamaCaller(config: LLMConfig): LLMCaller {
  const baseUrl = config.baseUrl ?? DEFAULT_OLLAMA_CONFIG.baseUrl;

  return async (prompt: string): Promise<string> => {
    const response = await fetch(`${baseUrl}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: config.model ?? DEFAULT_OLLAMA_CONFIG.model,
        prompt,
        stream: false,
        options: {
          num_predict: config.maxTokens ?? DEFAULT_OLLAMA_CONFIG.maxTokens,
          temperature: config.temperature ?? DEFAULT_OLLAMA_CONFIG.temperature,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Ollama API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json() as {
      response: string;
    };

    return data.response ?? '';
  };
}

/**
 * 创建 LLMCaller 工厂
 *
 * 根据配置和环境变量自动选择 LLM 后端
 * 优先级：ANTHROPIC > OPENAI > Ollama
 */
export function createLLMCaller(config?: Partial<LLMConfig>): LLMCaller {
  // 确定使用的 provider
  let provider: LLMProvider;

  if (config?.provider) {
    provider = config.provider;
  } else if (process.env.ANTHROPIC_API_KEY) {
    provider = 'anthropic';
  } else if (process.env.OPENAI_API_KEY) {
    provider = 'openai';
  } else {
    provider = 'ollama';
  }

  // 根据 provider 创建对应的 caller
  const mergedConfig: LLMConfig = {
    ...config,
    provider,
  };

  switch (provider) {
    case 'anthropic':
      return createAnthropicCaller(mergedConfig);
    case 'openai':
      return createOpenAICaller(mergedConfig);
    case 'ollama':
      return createOllamaCaller(mergedConfig);
    default:
      throw new Error(`Unknown LLM provider: ${provider}`);
  }
}

/**
 * 获取当前有效的 LLM provider
 */
export function getActiveProvider(): LLMProvider {
  if (process.env.ANTHROPIC_API_KEY) {
    return 'anthropic';
  }
  if (process.env.OPENAI_API_KEY) {
    return 'openai';
  }
  return 'ollama';
}

/**
 * 检查 LLM 是否可用
 */
export function isLLMAvailable(): boolean {
  return Boolean(
    process.env.ANTHROPIC_API_KEY ||
    process.env.OPENAI_API_KEY ||
    // Ollama 总是可用（本地）
    true
  );
}