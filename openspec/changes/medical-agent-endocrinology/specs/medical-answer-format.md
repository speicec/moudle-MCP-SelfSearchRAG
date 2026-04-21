---
capability: medical-answer-format
version: 1.0
created: 2026-04-21
---

# Spec: Medical Answer Format

## 概述

医学回答必须遵循专业格式，确保来源可追溯、置信度透明、不确定性标注。

## 功能需求

### FR-1: 结构化输出

医学回答必须包含以下章节：

```
## 结论
[简明结论，1-2句话，标注置信度]

## 详细说明
[展开说明，每个要点标注来源]

## 证据等级
Grade [A/B/C/D] - [证据来源类型]

## 来源引用
1. [文献名, 年份, 章节/页码]
2. ...

## 注意事项
• [不确定性提示]
• "仅供参考，请遵医嘱"
```

### FR-2: 置信度标注

结论部分必须标注置信度：

| 置信度 | 条件 | 示例 |
|--------|------|------|
| 高 | 多来源一致，证据等级A级 | "[置信度: 高]" |
| 中 | 单一指南，证据等级B级 | "[置信度: 中]" |
| 低 | 观察研究或证据不足 | "[置信度: 低]" |

### FR-3: 来源引用格式

每个来源引用必须包含：

```typescript
interface SourceCitation {
  documentName: string;       // "ADA Standards of Care 2024"
  year: number;               // 2024
  section?: string;           // "Section 9"
  pageNumber?: number;        // 123
}
```

格式示例：
- "ADA Standards of Care 2024, Section 9, p.123"
- "中国2型糖尿病防治指南2024版, 第5章"

### FR-4: 证据等级映射

| 文献类型 | GRADE等级 | 说明 |
|----------|-----------|------|
| RCT / Meta分析 | Grade A | 高质量证据 |
| 临床指南推荐 | Grade B | 中高质量 |
| 观察研究 / 病例报告 | Grade C | 中等质量 |
| 专家意见 | Grade D | 低质量 |

### FR-5: 时效性标注

如果引用文献超过5年，必须标注时效性警告：

```
## 注意事项
• 该指南发布于2019年，可能已过期，建议查阅最新版
```

### FR-6: 强制医嘱提醒

所有医学回答结尾必须包含：

```
## 注意事项
• 本回答仅供参考，不能替代专业医疗建议
• 请结合患者具体情况，遵医嘱用药
```

## 非功能需求

### NFR-1: 格式一致性

- 100%的回答遵循规定格式
- 空章节需标注"暂无相关信息"

### NFR-2: 来源完整性

- 每个结论点至少1个来源引用
- 来源引用可追溯到原文位置

### NFR-3: 安全性

- 绝对不使用"必须"、"一定"等绝对化词汇
- 不确定性必须明确标注

## 输入输出规范

### 输入

```typescript
interface AnswerInput {
  query: string;
  retrievalResults: RetrievalResult[];
  entities: MedicalEntities;
  evidenceLevels: EvidenceLevel[];
}
```

### 输出

```typescript
interface MedicalAnswer {
  conclusion: {
    text: string;
    confidence: 'high' | 'medium' | 'low';
  };
  details: {
    points: DetailPoint[];
  };
  evidenceGrade: {
    grade: 'A' | 'B' | 'C' | 'D';
    sourceType: string;
  };
  sources: SourceCitation[];
  warnings: string[];
}
```

## 禁止行为

| 禁止 | 原因 |
|------|------|
| "必须使用XX药物" | 过于绝对 |
| "一定有效" | 无证据支持 |
| 无来源的结论 | 无法追溯 |
| 无置信度标注 | 信息不透明 |
| 无医嘱提醒 | 安全风险 |

## 测试场景

| 场景 | 输入 | 验证点 |
|------|------|----------|
| 高置信回答 | 多指南一致 | 置信度=高，来源≥2 |
| 低置信回答 | 单一观察研究 | 置信度=低，明确标注 |
| 过期指南 | 2019年文献 | 时效性警告 |
| 无匹配结果 | 检索失败 | "暂无相关信息"标注 |