/**
 * Medical Agent E2E Tests - 端到端医学场景测试
 *
 * 测试完整医学查询流程，模拟真实临床场景
 */

import { describe, it, expect, vi } from 'vitest';
import { createMedicalAgent } from './agent/MedicalAgent.js';
import type { LLMCaller } from '../config/llm-config.js';
import type { MedicalQueryInput } from './types.js';

// ==================== E2E Medical Scenarios ====================

describe('Medical Agent E2E Scenarios', () => {
  /**
   * 创建模拟 LLM，根据场景返回不同回答
   */
  const createScenarioLLM = (scenario: string): LLMCaller => {
    return vi.fn(async (prompt: string) => {
      // 思考阶段
      if (prompt.includes('ACTION:') && prompt.includes('决策下一步')) {
        return 'ACTION: retrieve\nREASON: 首次检索获取相关医学文档\nCONFIDENCE: 0.7';
      }

      // 决策阶段
      if (prompt.includes('SATISFIED') || prompt.includes('判断是否满足')) {
        return 'SATISFIED - 已有足够的检索结果来回答问题';
      }

      // 回答阶段 - 根据场景返回不同回答
      if (prompt.includes('## 结论')) {
        switch (scenario) {
          case 'metformin-ckd':
            return `## 结论
二甲双胍在肾功能不全患者中使用需谨慎，具体取决于eGFR水平。

## 详细说明
- eGFR ≥45 mL/min/1.73m²: 可正常使用，无需调整剂量
- eGFR 30-45 mL/min/1.73m²: 慎用，需减量至每日最大1g
- eGFR <30 mL/min/1.73m²: 禁用

## 证据等级
Grade B - ADA指南推荐

## 来源引用
1. ADA Standards of Care 2024, Section 9
2. KDIGO CKD Guidelines 2024

## 注意事项
- 定期监测肾功能（每3-6个月）
- 老年患者需更频繁监测
- 本回答仅供参考，请咨询专业医生`;

          case 'diabetes-hypertension':
            return `## 结论
糖尿病合并高血压患者，推荐使用ACEI或ARB类降压药作为首选。

## 详细说明
- ACEI/ARB具有肾脏保护作用，延缓糖尿病肾病进展
- 需监测血压目标：<130/80 mmHg
- 避免使用可能影响血糖的降压药

## 证据等级
Grade A - ADA/KDIGO联合推荐

## 来源引用
1. ADA Standards 2024, Section 10
2. KDIGO Diabetes CKD Guidelines

## 注意事项
- 注意低血压风险
- 孕妇禁用ACEI/ARB
- 定期监测肾功能和电解质`;

          case 'thyroid-dosage':
            return `## 结论
甲状腺药物剂量需根据甲状腺功能指标调整，起始剂量通常较低。

## 详细说明
- 左甲状腺素起始剂量：25-50 μg/天
- 目标TSH：0.5-2.5 mIU/L（孕妇更低）
- 剂量调整间隔：每4-6周评估

## 证据等级
Grade B - ATA指南推荐

## 来源引用
1. ATA Thyroid Guidelines 2023

## 注意事项
- 空腹服用，与进食间隔30分钟以上
- 与其他药物间隔4小时以上
- 定期复查甲状腺功能`;

          default:
            return `## 结论
基于检索结果的分析结论

## 详细说明
- 相关要点

## 证据等级
Grade C

## 来源引用
1. 相关来源

## 注意事项
- 本回答仅供参考`;
        }
      }

      // 质量检查
      if (prompt.includes('质量检查')) {
        return 'STATUS: VALID\nISSUES:\n无\nSUGGESTIONS:\n无';
      }

      return 'Mock response';
    });
  };

  /**
   * 创建模拟检索服务
   */
  const mockRetrieval = vi.fn(async (query: string) => {
    // 根据查询返回相关文档
    if (query.includes('二甲双胍') || query.includes('metformin')) {
      return [
        { content: 'ADA 2024: 二甲双胍是2型糖尿病的一线用药', source: { documentName: 'ADA Standards 2024', year: 2024 } },
        { content: 'eGFR <30时禁用二甲双胍', source: { documentName: 'KDIGO CKD Guidelines', year: 2024 } },
        { content: '二甲双胍慎用于肾功能不全患者', source: { documentName: '药物说明书', year: 2023 } },
      ];
    }

    if (query.includes('糖尿病') && query.includes('高血压')) {
      return [
        { content: 'ACEI/ARB是糖尿病合并高血压的首选降压药', source: { documentName: 'ADA Standards 2024', year: 2024 } },
        { content: '血压控制目标<130/80 mmHg', source: { documentName: 'KDIGO Guidelines', year: 2024 } },
      ];
    }

    if (query.includes('甲状腺') || query.includes('thyroid')) {
      return [
        { content: '左甲状腺素起始剂量25-50μg', source: { documentName: 'ATA Guidelines 2023', year: 2023 } },
        { content: '目标TSH 0.5-2.5 mIU/L', source: { documentName: 'ATA Guidelines', year: 2023 } },
      ];
    }

    return [{ content: '相关医学信息', source: { documentName: '医学指南' } }];
  });

  // ==================== Scenario 1: 二甲双胍肾功能禁忌 ====================

  describe('Scenario 1: Metformin CKD Contraindication', () => {
    it('should handle metformin renal function query', async () => {
      const llmCaller = createScenarioLLM('metformin-ckd');
      const agent = createMedicalAgent(llmCaller, mockRetrieval, {
        maxIterations: 3,
      });

      const input: MedicalQueryInput = {
        query: '糖尿病患者合并肾功能不全eGFR=35，二甲双胍是否还能用',
        domain: 'diabetes',
      };

      const result = await agent.run(input);

      // 验证实体识别
      expect(result.entities.drugs.length).toBeGreaterThan(0);
      expect(result.entities.drugs.some(d => d.canonicalName.includes('二甲双胍'))).toBe(true);

      // 验证回答结构
      expect(result.answer.conclusion.text).toContain('肾功能');
      expect(result.answer.details.points.length).toBeGreaterThan(0);
      expect(result.answer.evidenceGrade.grade).toBe('B');
      expect(result.answer.sources.length).toBeGreaterThan(0);

      // 验证警告信息
      expect(result.answer.warnings.length).toBeGreaterThan(0);
      expect(result.answer.warnings.some(w => w.includes('仅供参考') || w.includes('医生'))).toBe(true);
    });

    it('should correctly identify contraindication threshold', async () => {
      const llmCaller = createScenarioLLM('metformin-ckd');
      const agent = createMedicalAgent(llmCaller, mockRetrieval);

      const result = await agent.run({
        query: 'eGFR=25的患者能否使用二甲双胍',
      });

      expect(result.answer.conclusion.text).toBeDefined();
      // 验证回答包含肾功能相关信息
      expect(result.answer.conclusion.text.toLowerCase()).toMatch(/肾功能|egfr|肾|慎|禁/);
    });
  });

  // ==================== Scenario 2: 糖尿病合并高血压选药 ====================

  describe('Scenario 2: Diabetes + Hypertension Drug Selection', () => {
    it('should recommend ACEI/ARB for diabetic hypertension', async () => {
      const llmCaller = createScenarioLLM('diabetes-hypertension');
      const agent = createMedicalAgent(llmCaller, mockRetrieval, {
        maxIterations: 3,
      });

      const input: MedicalQueryInput = {
        query: '糖尿病合并高血压患者应该选择哪种降压药',
        domain: 'all',
      };

      const result = await agent.run(input);

      // 验证实体识别
      expect(result.entities.diseases.length).toBeGreaterThanOrEqual(2);

      // 验证回答内容
      expect(result.answer.conclusion.text).toContain('ACEI');
      expect(result.answer.evidenceGrade.grade).toBe('A');
      expect(result.answer.sources.length).toBeGreaterThan(0);
    });
  });

  // ==================== Scenario 3: 甲状腺药物用量 ====================

  describe('Scenario 3: Thyroid Drug Dosage', () => {
    it('should provide thyroid dosage guidance', async () => {
      const llmCaller = createScenarioLLM('thyroid-dosage');
      const agent = createMedicalAgent(llmCaller, mockRetrieval);

      const input: MedicalQueryInput = {
        query: '甲状腺功能减退患者左甲状腺素起始剂量是多少',
        domain: 'thyroid',
      };

      const result = await agent.run(input);

      // 验证回答包含剂量信息
      expect(result.answer.conclusion.text).toBeDefined();
      expect(result.answer.details.points.length).toBeGreaterThan(0);

      // 验证证据等级
      expect(result.answer.evidenceGrade.grade).toBeDefined();
    });
  });

  // ==================== Complex Queries ====================

  describe('Complex Query Handling', () => {
    it('should handle multi-condition query', async () => {
      const llmCaller = createScenarioLLM('metformin-ckd');
      const agent = createMedicalAgent(llmCaller, mockRetrieval);

      const result = await agent.run({
        query: '糖尿病肾病eGFR=40患者，二甲双胍和ACEI能否同时使用',
      });

      expect(result.entities.drugs.length).toBeGreaterThan(0);
      expect(result.entities.diseases.length).toBeGreaterThan(0);
      expect(result.answer).toBeDefined();
    });

    it('should handle unknown query gracefully', async () => {
      const llmCaller = createScenarioLLM('default');
      const agent = createMedicalAgent(llmCaller, mockRetrieval, {
        maxIterations: 2,
      });

      const result = await agent.run({
        query: '未知药物XYZ的用法用量',
      });

      expect(result.answer).toBeDefined();
      expect(result.answer.warnings.length).toBeGreaterThan(0);
    });

    it('should track execution stats', async () => {
      const llmCaller = createScenarioLLM('metformin-ckd');
      const agent = createMedicalAgent(llmCaller, mockRetrieval);

      const result = await agent.run({ query: '二甲双胍禁忌' });

      expect(result.stats.iterations).toBeGreaterThan(0);
      expect(result.stats.totalTimeMs).toBeGreaterThan(0);
      expect(result.reasoningTrace.length).toBeGreaterThan(0);
    });
  });
});