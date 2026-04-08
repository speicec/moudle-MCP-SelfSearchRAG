/**
 * @spec prompts.md
 * @layer 6
 * @description MCP Prompts接口定义
 */

// Prompt定义
export interface PromptDefinition {
  name: string;
  description: string;
  arguments?: Array<{
    name: string;
    description: string;
    required: boolean;
  }>;
}

// Prompt结果
export interface PromptResult {
  description: string;
  messages: Array<{
    role: 'user' | 'assistant';
    content: {
      type: 'text';
      text: string;
    };
  }>;
}