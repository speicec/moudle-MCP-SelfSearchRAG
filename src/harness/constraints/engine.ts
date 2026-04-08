/**
 * @spec harness.md#约束规则引擎
 * @layer 5
 * @description 约束规则引擎实现
 */

import type { ConstraintRule, ConstraintContext, ConstraintResult } from '../interface';

export class ConstraintEngine {
  private rules: Map<string, ConstraintRule> = new Map();
  private enabled: boolean = true;

  registerRule(rule: ConstraintRule): void {
    if (this.rules.has(rule.id)) {
      throw new Error(`Rule ${rule.id} already exists`);
    }
    this.rules.set(rule.id, rule);
  }

  unregisterRule(ruleId: string): void {
    this.rules.delete(ruleId);
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  check(context: ConstraintContext): ConstraintResult {
    if (!this.enabled) {
      return { allowed: true };
    }

    for (const rule of this.rules.values()) {
      try {
        if (rule.condition(context)) {
          if (rule.type === 'block') {
            return {
              allowed: false,
              rule,
              message: rule.message || `Blocked by rule: ${rule.name}`
            };
          }

          if (rule.type === 'warn') {
            console.warn(`[Constraint Warning] ${rule.name}: ${rule.message || ''}`);
          }

          if (rule.type === 'transform' && rule.action) {
            const transformed = rule.action(context);
            return {
              allowed: true,
              rule,
              transformedContext: transformed
            };
          }
        }
      } catch (error) {
        console.error(`Error evaluating rule ${rule.id}:`, error);
      }
    }

    return { allowed: true };
  }

  getRules(): ConstraintRule[] {
    return Array.from(this.rules.values());
  }

  getRule(ruleId: string): ConstraintRule | undefined {
    return this.rules.get(ruleId);
  }

  clearRules(): void {
    this.rules.clear();
  }
}

// 预定义规则
export const defaultRules: ConstraintRule[] = [
  {
    id: 'max-file-size',
    name: '文件大小限制',
    description: '限制索引文件的最大大小',
    type: 'warn',
    condition: (ctx: ConstraintContext): boolean => {
      const size = ctx.input.fileSize as number | undefined;
      return size !== undefined && size > 10 * 1024 * 1024;
    },
    message: '文件超过 10MB，建议分批索引以提高性能'
  },
  {
    id: 'sensitive-path',
    name: '敏感路径保护',
    description: '禁止索引敏感文件',
    type: 'block',
    condition: (ctx: ConstraintContext): boolean => {
      const path = ctx.input.path as string | undefined;
      if (!path) return false;

      const sensitivePatterns = [
        '.env', 'secret', 'credential', 'password', 'key.pem', 'id_rsa', '.git'
      ];

      return sensitivePatterns.some(pattern =>
        path.toLowerCase().includes(pattern)
      );
    },
    message: '禁止索引敏感文件，该路径可能包含敏感信息'
  },
  {
    id: 'search-rate-limit',
    name: '检索频率限制',
    description: '限制检索频率，防止滥用',
    type: 'block',
    condition: (ctx: ConstraintContext): boolean => {
      const searchCount = ctx.metadata?.searchCountInLastMinute as number | undefined;
      return searchCount !== undefined && searchCount > 100;
    },
    message: '检索频率超限（100次/分钟），请稍后再试'
  }
];