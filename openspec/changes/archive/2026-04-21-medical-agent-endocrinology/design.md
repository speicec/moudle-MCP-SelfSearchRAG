---
name: medical-agent-endocrinology
description: 内分泌领域医学知识检索Agent
type: project
---

# 设计文档

## 问题背景

内分泌领域（糖尿病、高血压、甲状腺）是慢性病管理的核心领域，具有：
- 大量临床指南和循证医学文献
- 明确的诊断标准和用药规范
- 复杂的药物-疾病-指标关系

用户上传相关文献后，需要一个专业的医学知识检索 Agent。

## 核心架构

```
┌──────────────────────────────────────────────────────────────────────────────┐
│              Medical Agent 架构                                               │
└──────────────────────────────────────────────────────────────────────────────┘

用户查询: "糖尿病患者合并肾功能不全，二甲双胍是否还能用？"
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Entity Recognizer                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  输入文本 ────┬────▶ 疾病词典匹配 ────▶ ["糖尿病"]                          │
│              │                                                              │
│              ├────▶ 药物词典匹配 ────▶ ["二甲双胍"]                         │
│              │                                                              │
│              ├────▶ 指标词典匹配 ────▶ ["肾功能不全"] →关联eGFR             │
│              │                                                              │
│              └────▶ 关系词典匹配 ────▶ ["禁忌", "慎用"]                     │
│                                                                             │
│  别名展开:                                                                   │
│  "二甲双胍" ────▶ ["二甲双胍", "Metformin", "格华止", "美迪康"]              │
│                                                                             │
│  输出: MedicalEntities {                                                    │
│    diseases: [{ id: "disease_diabetes", name: "糖尿病" }],                 │
│    drugs: [{ id: "drug_metformin", name: "二甲双胍", aliases: [...] }],   │
│    indicators: [{ id: "indicator_egfr", name: "eGFR" }],                  │
│    relations: ["contraindication", "precaution"],                          │
│  }                                                                         │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Query Planner                                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  基于实体构建检索策略:                                                       │
│                                                                             │
│  queryStrategy: {                                                          │
│    primaryQuery: "二甲双胍 肾功能不全 禁忌症 eGFR阈值",                    │
│    expandedTerms: [                                                         │
│      "Metformin", "格华止", "美迪康",    // 药物别名                       │
│      "糖尿病肾病", "CKD",                // 疾病别名                       │
│      "eGFR", "肾小球滤过率",             // 指标别名                       │
│    ],                                                                      │
│    filters: {                                                               │
│      yearRange: [2020, 2024],                                             │
│      guidelineSources: ["ada", " cds", "kdigo"],                          │
│    },                                                                      │
│    prioritySources: ["ADA 2024", "CDS 2024"],                             │
│  }                                                                         │
│                                                                             │
│  特殊处理:                                                                   │
│  • 发现禁忌关系 → 优先检索指南中的禁忌条款                                   │
│  • 发现指标阈值 → 添加阈值关键词                                            │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                     Existing Retrieval Pipeline                              │
│                    (EnhancedRetrievalPipeline)                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  复用现有检索能力:                                                           │
│  • QueryDecomposer → 子查询分解                                             │
│  • HybridRetriever → 向量+关键词检索                                        │
│  • ConfidenceCalculator → 置信度计算                                        │
│  • ContextAssembler → 上下文组装                                            │
│                                                                             │
│  增强点:                                                                     │
│  • QueryExpander: 使用词典别名扩展                                          │
│  • 检索结果: 添加医学元数据                                                  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Evidence Evaluator                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  评估检索结果的证据等级:                                                     │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  文献类型识别                                                         │   │
│  │                                                                       │   │
│  │  检索片段 ────▶ 来源文档元数据 ────▶ 类型推断                        │   │
│  │                                                                       │   │
│  │  类型映射:                                                             │   │
│  │  • RCT / Meta分析 ────▶ Grade A (高质量)                             │   │
│  │  • 指南推荐 ────▶ Grade B (中高质量)                                  │   │
│  │  • 观察研究 ────▶ Grade C (中等质量)                                  │   │
│  │  • 专家意见 ────▶ Grade D (低质量)                                    │   │
│  │                                                                       │   │
│  │  时效性判断:                                                           │   │
│  │  • 2024指南 ────▶ "当前有效"                                          │   │
│  │  • 2019指南 ────▶ "可能过期，建议查阅最新版"                          │   │
│  │                                                                       │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Answer Generator                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  结构化医学回答生成:                                                         │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  输出模板                                                             │   │
│  │                                                                       │   │
│  │  ## 结论                                                              │   │
│  │  [简明结论，标注置信度: 高/中/低]                                      │   │
│  │                                                                       │   │
│  │  ## 详细说明                                                          │   │
│  │  [展开说明，每个要点标注来源]                                          │   │
│  │                                                                       │   │
│  │  ## 证据等级                                                          │   │
│  │  Grade [A/B/C/D] - [来源类型]                                         │   │
│  │                                                                       │   │
│  │  ## 来源引用                                                          │   │
│  │  1. [文献名, 年份, 章节/页码]                                          │   │
│  │  2. ...                                                               │   │
│  │                                                                       │   │
│  │  ## 注意事项                                                          │   │
│  │  • 不确定性提示                                                       │   │
│  │  • "仅供参考，请遵医嘱"                                                │   │
│  │                                                                       │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  强制规则:                                                                   │
│  • 所有结论必须标注来源                                                      │
│  • 不确定性必须明确标注                                                      │
│  • 结尾必须添加医嘱提醒                                                      │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 词典数据结构

### 疾病词典

```typescript
interface DiseaseEntity {
  id: string;                    // "disease_diabetes_type2"
  canonicalName: string;         // "2型糖尿病"
  aliases: string[];             // ["糖尿病", "T2DM", "NIDDM"]
  icdCode?: string;              // "E11.9"
  category: string;              // "内分泌代谢"
  keywords: string[];            // 检索关键词
}

// 示例
const DIABETES_TYPE2: DiseaseEntity = {
  id: "disease_diabetes_type2",
  canonicalName: "2型糖尿病",
  aliases: ["糖尿病", "T2DM", "2型DM", "NIDDM", "非胰岛素依赖型糖尿病"],
  icdCode: "E11.9",
  category: "内分泌代谢",
  keywords: ["血糖", "胰岛素", "HbA1c", "并发症"],
};
```

### 药物词典

```typescript
interface DrugEntity {
  id: string;                    // "drug_metformin"
  canonicalName: string;         // "二甲双胍"
  aliases: string[];             // ["Metformin", "格华止", "美迪康"]
  englishName?: string;          // "Metformin"
  atcCode?: string;              // "A10BA02"
  classification: {
    category: string;            // "降糖药"
    subcategory: string;         // "胰岛素增敏剂"
  };
  brands: string[];              // ["格华止", "美迪康"]
  keywords: string[];            // 检索关键词
  relatedIndicators?: string[];  // 相关指标ID
  relatedDiseases?: string[];    // 相关疾病ID
}

// 示例 - 二甲双胍
const METFORMIN: DrugEntity = {
  id: "drug_metformin",
  canonicalName: "二甲双胍",
  aliases: ["Metformin", "甲福明", "降糖片", "格华止", "美迪康", "Dimethylbiguanide"],
  englishName: "Metformin",
  atcCode: "A10BA02",
  classification: {
    category: "降糖药",
    subcategory: "胰岛素增敏剂",
  },
  brands: ["格华止", "美迪康", "二甲双胍片"],
  keywords: ["糖尿病一线", "eGFR禁忌", "肾功能", "乳酸酸中毒"],
  relatedIndicators: ["indicator_egfr", "indicator_hba1c"],
  relatedDiseases: ["disease_diabetes_type2"],
};

// 示例 - GLP-1激动剂
const GLP1_AGONISTS: DrugEntity[] = [
  {
    id: "drug_liraglutide",
    canonicalName: "利拉鲁肽",
    aliases: ["Liraglutide", "Victoza", "诺和力"],
    classification: { category: "降糖药", subcategory: "GLP-1激动剂" },
    keywords: ["减重", "心血管获益", "一周一次"],
  },
  {
    id: "drug_semaglutide",
    canonicalName: "司美格鲁肽",
    aliases: ["Semaglutide", "Ozempic", "诺和泰"],
    classification: { category: "降糖药", subcategory: "GLP-1激动剂" },
    keywords: ["强效降糖", "减重", "心血管"],
  },
];
```

### 指标词典

```typescript
interface IndicatorEntity {
  id: string;                    // "indicator_egfr"
  canonicalName: string;         // "肾小球滤过率"
  aliases: string[];             // ["eGFR", "GFR", "肾滤过率"]
  unit: string;                  // "mL/min/1.73m²"
  normalRange: {
    min?: number;
    max?: number;
    description: string;
  };
  clinicalThresholds: {          // 临床决策阈值
    normal: number[];            // [90]
    caution: number[];           // [45, 60]
    critical: number[];          // [30]
  };
  relatedDrugs?: string[];       // 相关药物ID
  relatedDiseases?: string[];    // 相关疾病ID
}

// 示例 - eGFR
const EGFR: IndicatorEntity = {
  id: "indicator_egfr",
  canonicalName: "肾小球滤过率",
  aliases: ["eGFR", "EGFR", "GFR", "肾滤过率", "估算肾小球滤过率"],
  unit: "mL/min/1.73m²",
  normalRange: {
    min: 60,
    description: "正常≥90，轻度下降60-89，中度30-59，重度<30",
  },
  clinicalThresholds: {
    normal: [90],
    caution: [45, 60],
    critical: [30],
  },
  relatedDrugs: ["drug_metformin", "drug_sglt2_inhibitors"],
  relatedDiseases: ["disease_diabetes_nephropathy", "disease_ckd"],
};

// 示例 - HbA1c
const HBA1C: IndicatorEntity = {
  id: "indicator_hba1c",
  canonicalName: "糖化血红蛋白",
  aliases: ["HbA1c", "A1C", "糖化", "GHb", "hemoglobin A1c"],
  unit: "%",
  normalRange: {
    max: 5.7,
    description: "正常<5.7%，糖尿病前期5.7-6.4%，糖尿病≥6.5%",
  },
  clinicalThresholds: {
    normal: [5.7],
    caution: [6.5],
    critical: [7.0, 8.0],
  },
};
```

### 关系词典

```typescript
interface ContraindicationRelation {
  id: string;                    // "contra_metformin_egfr_30"
  drug: string;                  // "drug_metformin"
  condition: string;             // 指标或疾病ID
  threshold?: {
    indicator: string;           // "indicator_egfr"
    operator: '<' | '>' | '=';   // '<'
    value: number;               // 30
  };
  severity: 'absolute' | 'relative';
  source: string;                // "ada"
  year: number;                  // 2024
  description: string;
}

// 示例 - 二甲双胍禁忌
const METFORMIN_EGFR_CONTRA: ContraindicationRelation[] = [
  {
    id: "contra_metformin_egfr_30",
    drug: "drug_metformin",
    condition: "肾功能重度下降",
    threshold: {
      indicator: "indicator_egfr",
      operator: '<',
      value: 30,
    },
    severity: "absolute",
    source: "ada",
    year: 2024,
    description: "eGFR<30mL/min/1.73m²时禁用二甲双胍",
  },
  {
    id: "precaution_metformin_egfr_45",
    drug: "drug_metformin",
    condition: "肾功能中度下降",
    threshold: {
      indicator: "indicator_egfr",
      operator: '<',
      value: 45,
    },
    severity: "relative",
    source: "ada",
    year: 2024,
    description: "eGFR 30-45时慎用，需减量并密切监测",
  },
];
```

## 文件结构

```
src/medical/
├── index.ts                    // 模块导出
├── types.ts                    // 类型定义
│   ├── EntityTypes             // 实体类型
│   ├── RelationTypes           // 关系类型
│   └── AnswerTypes             // 回答类型
│
├── config.ts                   // 配置
│
├── dictionaries/               // 词典数据
│   ├── index.ts                // 导出
│   ├── diseases.ts             // 疾病词典
│   ├── drugs.ts                // 药物词典
│   │   ├── antidiabetic.ts     // 降糖药 (~30条)
│   │   ├── antihypertensive.ts // 降压药 (~20条)
│   │   └── thyroid.ts          // 甲状腺药 (~10条)
│   ├── indicators.ts           // 指标词典 (~15条)
│   ├── guidelines.ts           // 指南来源 (~10条)
│   └── relations.ts            // 关系词典 (~50条)
│   │   ├── contraindications.ts
│   │   ├── precautions.ts
│   │   └── interactions.ts
│   └── aliases.ts              // 别名映射表
│
├── entity-recognizer.ts        // 实体识别
│   ├── matchDictionaries()     // 词典匹配
│   ├── expandAliases()         // 别名展开
│   └── normalizeEntities()     // 标准化
│
├── query-planner.ts            // 查询规划
│   ├── buildStrategy()         // 构建检索策略
│   ├── expandTerms()           // 术语扩展
│   ├── addFilters()            // 添加过滤
│
├── evidence-evaluator.ts       // 证据评估
│   ├── classifyLiterature()    // 文献分类
│   ├── mapGrade()              // GRADE映射
│   ├── checkTimeliness()       // 时效检查
│
├── answer-generator.ts         // 回答生成
│   ├── generateMedicalAnswer() // 结构化输出
│   ├── formatSources()         // 来源格式化
│   ├── addWarnings()           // 添加警告
│
└── mcp-tool.ts                 // MCP工具
    └── medical_query           // 医学查询工具
```

## MCP Tool 定义

```typescript
export const MEDICAL_QUERY_TOOL = {
  name: 'medical_query',
  description: '内分泌领域医学知识检索，支持药物、疾病、指标的智能查询',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: '医学查询问题',
      },
      domain: {
        type: 'string',
        description: '领域范围',
        enum: ['diabetes', 'hypertension', 'thyroid', 'all'],
        default: 'all',
      },
      include_guidelines: {
        type: 'boolean',
        description: '是否优先检索指南',
        default: true,
      },
      year_range: {
        type: 'array',
        description: '年份范围 [start, end]',
        items: { type: 'number' },
      },
    },
    required: ['query'],
  },
};
```

## 边界情况处理

| 场景 | 处理策略 |
|------|----------|
| 未识别到实体 | 降级为普通检索，标注"未识别医学实体" |
| 多个同名药物 | 列出所有匹配，让用户确认 |
| 证据等级低 | 明确标注"证据等级低，请谨慎参考" |
| 指南已过期 | 标注"该指南可能已过期，建议查阅最新版" |
| 查询超出范围 | 标注"超出内分泌领域，建议咨询专科医生" |

## 测试用例

1. **实体识别**
   - 输入: "二甲双胍禁忌症"
   - 期望: 识别药物=二甲双胍，关系=禁忌

2. **别名扩展**
   - 输入: "Metformin能不能用"
   - 期望: 扩展为二甲双胍的完整别名列表

3. **阈值查询**
   - 输入: "eGFR多少不能用二甲双胍"
   - 期望: 返回eGFR<30禁用，30-45慎用

4. **多实体查询**
   - 输入: "糖尿病合并高血压怎么选药"
   - 期望: 识别疾病=糖尿病+高血压，查询联合用药

5. **指南对比**
   - 输入: "ADA和中国指南对二甲双胍的建议有区别吗"
   - 期望: 对比不同指南的差异