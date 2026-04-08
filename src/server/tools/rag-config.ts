/**
 * @spec tools.md#rag_config
 * @layer 6
 * @description 配置管理Tool实现
 */

import type {
  RagConfigInput,
  RagConfigOutput,
  ToolDefinition,
  ToolHandler
} from './interface';

export const ragConfigDefinition: ToolDefinition = {
  name: 'rag_config',
  description: '配置管理',
  inputSchema: {
    type: 'object',
    properties: {
      action: { type: 'string', enum: ['get', 'set', 'reset'], default: 'get' },
      key: { type: 'string', description: '配置项名称' },
      value: { description: '配置值' }
    },
    required: ['action']
  }
};

// 默认配置
export const DEFAULT_CONFIG = {
  embedding: {
    service_url: 'http://localhost:8080',
    model: 'default',
    dimension: 1536
  },
  chunk: {
    max_size: 500,
    overlap: 50
  },
  search: {
    default_top_k: 10,
    hybrid_weight: 0.5
  }
};

export function createRagConfigHandler(
  currentConfig: Record<string, unknown>
): ToolHandler<RagConfigInput, RagConfigOutput> {
  // 深拷贝当前配置
  let config = JSON.parse(JSON.stringify(currentConfig));

  return async (input: RagConfigInput): Promise<RagConfigOutput> => {
    switch (input.action) {
      case 'get':
        if (input.key) {
          const value = getNestedValue(config, input.key);
          return { config: { [input.key]: value }, updated: false };
        }
        return { config, updated: false };

      case 'set':
        if (input.key && input.value !== undefined) {
          setNestedValue(config, input.key, input.value);
          return { config: { [input.key]: input.value }, updated: true };
        }
        return { config, updated: false };

      case 'reset':
        if (input.key) {
          const defaultValue = getNestedValue(DEFAULT_CONFIG, input.key);
          setNestedValue(config, input.key, defaultValue);
          return { config: { [input.key]: defaultValue }, updated: true };
        }
        config = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
        return { config, updated: true };

      default:
        return { config, updated: false };
    }
  };
}

function getNestedValue(obj: Record<string, unknown>, key: string): unknown {
  const parts = key.split('.');
  let current: unknown = obj;

  for (const part of parts) {
    if (current && typeof current === 'object' && part in current) {
      current = (current as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }

  return current;
}

function setNestedValue(obj: Record<string, unknown>, key: string, value: unknown): void {
  const parts = key.split('.');
  let current: Record<string, unknown> = obj;

  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (!(part in current) || typeof current[part] !== 'object') {
      current[part] = {};
    }
    current = current[part] as Record<string, unknown>;
  }

  current[parts[parts.length - 1]] = value;
}