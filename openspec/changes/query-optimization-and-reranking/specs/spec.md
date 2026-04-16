# Spec: Enhanced Retrieval System

## Capability: Query Optimization

### Purpose

优化用户输入Query，提高检索召回率和精确度。

### Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| QO-001 | 系统应能分析Query复杂度（simple/complex/structured） | High |
| QO-002 | 系统应能重写口语化表达为专业术语 | High |
| QO-003 | 系统应能分解复杂问题为最多5个子查询 | Medium |
| QO-004 | 系统应能检测结构化过滤条件（年份、类别等） | Medium |
| QO-005 | 系统应能扩展同义词和相关词 | Medium |
| QO-006 | Query分析结果应缓存5分钟 | Low |

### Non-Functional Requirements

| ID | Requirement |
|----|-------------|
| QO-NF-001 | Query分析LLM调用超时 ≤ 2秒 |
| QO-NF-002 | 缓存命中率目标 ≥ 30% |
| QO-NF-003 | 分析失败时应fallback到原始Query |

### Interfaces

```typescript
interface QueryOptimizationInput {
  query: string;
  enableRewrite: boolean;
  enableDecomposition: boolean;
  enableExpansion: boolean;
}

interface QueryOptimizationOutput {
  originalQuery: string;
  rewrittenQuery?: string;
  subQueries?: string[];
  expandedTerms: string[];
  complexity: 'simple' | 'complex' | 'structured';
  detectedFilters?: Record<string, string | number>;
}
```

---

## Capability: Dynamic TopK

### Purpose

根据模型上下文窗口动态计算检索topK，最大化上下文利用率。

### Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| DT-001 | 系统应支持三档上下文窗口配置（32K/64K/128K） | High |
| DT-002 | 系统应动态计算粗排topK | High |
| DT-003 | topK计算应考虑系统提示词和输出预留空间 | High |
| DT-004 | 系统应提供fillRatio配置（默认60%） | Medium |
| DT-005 | 系统应提供overfetchRatio配置（默认1.5） | Medium |

### Non-Functional Requirements

| ID | Requirement |
|----|-------------|
| DT-NF-001 | topK计算应 ≤ 1ms |
| DT-NF-002 | 需准确获取avgParentTokenLength |

### Interfaces

```typescript
interface DynamicTopKInput {
  modelContextWindow: 32000 | 64000 | 128000;
  avgParentTokens: number;
}

interface DynamicTopKOutput {
  coarseTopK: number;
  targetTokens: number;
  effectiveWindow: number;
}
```

---

## Capability: Hybrid Reranking

### Purpose

混合策略重排序检索结果，提高精确度。

### Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| HR-001 | 系统应实现混合Reranker策略 | High |
| HR-002 | ≤20样本时使用本地bge-reranker-v2-m3 | High |
| HR-003 | >20样本时使用内部置信度计算 | High |
| HR-004 | 置信度计算应包含4个维度 | High |
| HR-005 | 系统应按置信度降序排列结果 | High |
| HR-006 | 本地Reranker应支持GPU加速（可选） | Low |

### Non-Functional Requirements

| ID | Requirement |
|----|-------------|
| HR-NF-001 | 本地Reranker处理时间 ≤ 500ms（20样本） |
| HR-NF-002 | 内部置信度计算时间 ≤ 100ms |
| HR-NF-003 | Rerank失败时应fallback到相似度排序 |

### Interfaces

```typescript
interface RerankingInput {
  query: string;
  results: RetrievalResult[];
}

interface RerankingOutput {
  results: RetrievalResult[];
  scores: number[];
  method: 'local-reranker' | 'internal-confidence';
}

interface ConfidenceWeights {
  similarity: number;     // 0.5
  keywordMatch: number;   // 0.2
  position: number;       // 0.1
  chunkQuality: number;   // 0.2
}
```

---

## Capability: Low Confidence Handling

### Purpose

处理低置信度检索结果，避免LLM编造答案。

### Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| LC-001 | 系统应计算平均置信度 | High |
| LC-002 | 平均置信度<0.3时返回"未找到相关信息" | High |
| LC-003 | 系统应提供建议（其他关键词、检查索引） | Medium |
| LC-004 | 不组装context，不调用LLM | High |

### Non-Functional Requirements

| ID | Requirement |
|----|-------------|
| LC-NF-001 | 置信度检查应 ≤ 10ms |
| LC-NF-002 | threshold应可配置 |

### Interfaces

```typescript
interface LowConfidenceInput {
  results: RetrievalResult[];
  threshold: number;
}

interface NoMatchOutput {
  status: 'no_match';
  message: string;
  suggestions: string[];
}
```

---

## Capability: Context Assembly with Confidence

### Purpose

组装检索Context，附带置信度元数据。

### Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| CA-001 | 每个chunk应附带confidenceLevel标签 | High |
| CA-002 | confidenceLevel分为high/medium/low三档 | High |
| CA-003 | 系统应动态截断到targetTokens | High |
| CA-004 | 截断应按置信度优先 | High |

### Non-Functional Requirements

| ID | Requirement |
|----|-------------|
| CA-NF-001 | 组装时间 ≤ 50ms |
| CA-NF-002 | Token估算误差 ≤ 10% |

### Interfaces

```typescript
interface ContextWithConfidence {
  content: string;
  confidence: number;
  confidenceLevel: 'high' | 'medium' | 'low';
  source: string;
  page?: number;
}

interface AssembledContext {
  chunks: ContextWithConfidence[];
  totalTokens: number;
  truncated: boolean;
}
```

---

## Capability: Enhanced LLM Generation

### Purpose

LLM生成时考虑置信度信息，提高回答质量。

### Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| EG-001 | Prompt应包含置信度标签 | High |
| EG-002 | Prompt应包含回答指南（高/中/低置信度使用规则） | High |
| EG-003 | LLM应被告知"无法回答时请说明" | High |
| EG-004 | 输出应标注来源 | Medium |

### Non-Functional Requirements

| ID | Requirement |
|----|-------------|
| EG-NF-001 | Prompt长度增加 ≤ 500 tokens |

### Interfaces

```typescript
interface EnhancedGenerationInput {
  query: string;
  context: ContextWithConfidence[];
}

interface EnhancedGenerationOutput {
  answer: string;
  thinking: string;
  sources: string[];
}
```

---

## System-Level Requirements

### Performance

| Metric | Target |
|--------|--------|
| 总检索延迟增加 | ≤ 3秒 |
| 召回率 | ≥ 90% |
| 上下文利用率 | 60% |
| 低置信度误答率 | 0% |

### Reliability

| Requirement |
|-------------|
| Query优化失败 → 使用原始Query |
| Reranker失败 → 使用相似度排序 |
| 本地模型不可用 → fallback到内部计算 |

### Configurability

| Parameter | Default | Range |
|-----------|---------|-------|
| modelContextWindow | 64000 | 32K/64K/128K |
| fillRatio | 0.6 | 0.3-0.8 |
| minConfidenceThreshold | 0.3 | 0.1-0.5 |
| rerankerThreshold | 20 | 10-50 |
| maxSubQueries | 5 | 1-10 |
| maxExpandedTerms | 5 | 1-10 |

---

## Acceptance Criteria

### AC-001: Query Optimization

**Given** 用户输入口语化Query "怎么让系统跑得更快"
**When** 系统执行Query优化
**Then** Query被重写为"系统性能优化"
**And** 同义词扩展包含["速度提升", "响应时间"]

### AC-002: Complex Query Decomposition

**Given** 用户输入复杂Query "对比Redis和Memcached的优缺点"
**When** 系统执行Query分解
**Then** 生成3个子查询
**And** 每个子查询独立检索
**And** 结果合并返回

### AC-003: Dynamic TopK

**Given** 配置modelContextWindow=64000
**And** avgParentTokens=800
**When** 系统计算topK
**Then** coarseTopK ≈ 58
**And** targetTokens ≈ 30900

### AC-004: Low Confidence Handling

**Given** 所有检索结果相似度 < 0.3
**When** 系统执行置信度检查
**Then** 返回status='no_match'
**And** 不调用LLM生成

### AC-005: Hybrid Reranking

**Given** 粗排结果数量 ≤ 20
**When** 系统执行Reranking
**Then** 使用本地bge-reranker-v2-m3
**And** 输出包含rerank scores

**Given** 粗排结果数量 > 20
**When** 系统执行Reranking
**Then** 使用内部置信度计算
**And** 处理时间 ≤ 100ms