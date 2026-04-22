---
capability: medical-entity-recognition
version: 1.0
created: 2026-04-21
updated: 2026-04-22
---

# Spec: Medical Entity Recognition

## 概述

医学实体识别是 Medical Agent 的核心能力，负责从用户查询中提取疾病、药物、指标等医学实体，包括数值解析和阈值推断。

## 功能需求

### FR-1: 疾病实体识别

系统应能识别内分泌领域常见疾病及其别名：

| 标准名称 | 别名示例 |
|----------|----------|
| 2型糖尿病 | 糖尿病, T2DM, NIDDM, 非胰岛素依赖型 |
| 1型糖尿病 | T1DM, IDDM,胰岛素依赖型 |
| 高血压 | Hypertension, HP, 血压高 |
| 肾功能不全 | CKD, 肾衰, eGFR下降 |

### FR-2: 药物实体识别

系统应能识别降糖药、降压药及其别名：

| 标准名称 | 别名示例 |
|----------|----------|
| 二甲双胍 | Metformin, 格华止, 美迪康, 甲福明 |
| 利拉鲁肽 | Liraglutide, Victoza, 诺和力 |
| 司美格鲁肽 | Semaglutide, Ozempic, 诺和泰 |
| 氨氯地平 | Amlodipine, 络活喜 |

### FR-3: 指标实体识别

系统应能识别临床指标及其阈值：

| 标准名称 | 别名示例 | 临床阈值 |
|----------|----------|----------|
| eGFR | GFR, 肾滤过率 | <30禁用, <45慎用 |
| HbA1c | A1C, 糖化 | ≥6.5诊断, <7目标 |
| LDL-C | 低密度, 坏胆固醇 | <2.6目标 |

### FR-4: 关系实体识别

系统应能识别医学关系词汇：

| 关系类型 | 词汇示例 |
|----------|----------|
| 禁忌 | 禁用, 不能用, 绝对禁忌 |
| 慎用 | 谨慎, 小心, 相对禁忌 |
| 相互作用 | 配伍, 合用, 同时使用 |
|适应症 | 可以用, 适合, 推荐 |

### FR-5: 指标值解析 (NEW)

系统应能从用户查询中解析指标数值：

| 场景 | 输入示例 | 解析结果 |
|------|----------|----------|
| 单值 | "eGFR=35" | value=35, unit=ml/min |
| 区间 | "eGFR 30-45" | minValue=30, maxValue=45 |
| 带单位 | "HbA1c 7.5%" | value=7.5, unit=% |

## 非功能需求

### NFR-1: 识别准确率

- 词典匹配准确率 ≥ 90%
- 别名覆盖率 ≥ 80%（常见别名）

### NFR-2: 识别速度

- 单次识别耗时 < 100ms
- 不影响检索整体性能

### NFR-3: 可扩展性

- 支持新增词典（心血管、肿瘤等）
- 词典更新不影响代码结构

## 输入输出规范

### 输入

```typescript
interface RecognitionInput {
  query: string;              // 用户查询文本
  domain?: string;            // 领域限制
}
```

### 输出

```typescript
interface MedicalEntities {
  diseases: DiseaseMatch[];
  drugs: DrugMatch[];
  indicators: IndicatorMatch[];
  relations: RelationMatch[];
  rawQuery: string;
  confidence: number;         // 整体置信度
}

interface DiseaseMatch {
  id: string;
  canonicalName: string;
  matchedTerm: string;        // 匹配到的原文
  aliases: string[];          // 可扩展别名
}

interface DrugMatch {
  id: string;
  canonicalName: string;
  matchedTerm: string;
  aliases: string[];
  classification: {
    category: string;
    subcategory: string;
  };
}

interface IndicatorMatch {
  id: string;
  canonicalName: string;
  matchedTerm: string;
  unit?: string | undefined;
  value?: number | undefined;             // 如果查询包含数值
  minValue?: number | undefined;          // 区间最小值 (NEW)
  maxValue?: number | undefined;          // 区间最大值 (NEW)
  thresholdZone?: 'normal' | 'caution' | 'critical' | undefined; // 阈值区域 (NEW)
  contraindicationRelevance?: boolean | undefined; // 禁忌相关性 (NEW)
}

interface RelationMatch {
  type: 'contraindication' | 'precaution' | 'interaction' | 'indication';
  matchedTerm: string;
}
```

## 测试场景

| 场景 | 输入 | 期望输出 |
|------|------|----------|
| 单药物 | "二甲双胍禁忌" | drug:二甲双胍, relation:禁忌 |
| 单疾病 | "糖尿病诊断标准" | disease:糖尿病 |
| 药物+指标 | "eGFR 30 二甲双胍" | drug:二甲双胍, indicator:eGFR=30 |
| 复合查询 | "糖尿病高血压怎么选药" | disease:糖尿病+高血压, relation:适应症 |
| 别名查询 | "Metformin能不能用" | drug:二甲双胍 (识别英文别名) |
| 阈值查询 | "糖化多少算糖尿病" | indicator:HbA1c, relation:诊断 |
| 带值指标 | "eGFR=35二甲双胍" | indicator:eGFR, value:35, zone:caution |
| 区间指标 | "eGFR 30-45能用药吗" | indicator:eGFR, minValue:30, maxValue:45 |
| 临界值 | "eGFR=25二甲双胍" | indicator:eGFR, value:25, zone:critical, contraindicationRelevance:true |

## Additional Requirements (ADDED)

### Requirement: Indicator value parsing
The system SHALL parse indicator values from user queries.

#### Scenario: Indicator with value
- **WHEN** query contains indicator with numeric value (e.g., "eGFR=35", "HbA1c 7.5")
- **THEN** IndicatorMatch includes value field with parsed number
- **AND** unit field populated if unit detected

#### Scenario: Indicator without value
- **WHEN** query contains indicator name only
- **THEN** IndicatorMatch.value remains undefined
- **AND** indicator recognized for retrieval purposes

#### Scenario: Value range detection
- **WHEN** query contains range (e.g., "eGFR 30-45")
- **THEN** IndicatorMatch includes minValue and maxValue fields
- **AND** range used for threshold comparison

### Requirement: Indicator threshold inference
The system SHALL infer clinical significance from indicator values.

#### Scenario: Threshold crossing detection
- **WHEN** indicator value parsed and clinicalThresholds defined
- **THEN** system determines threshold zone (normal/caution/critical)
- **AND** zone stored in IndicatorMatch.thresholdZone

#### Scenario: Contraindication relevance flag
- **WHEN** indicator value in critical zone (< 30 for eGFR)
- **THEN** system flags contraindication relevance
- **AND** retrieval prioritizes contraindication evidence

#### Scenario: Threshold lookup from dictionary
- **WHEN** indicator recognized
- **THEN** clinicalThresholds retrieved from IndicatorEntity
- **AND** thresholds used for zone calculation