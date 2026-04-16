# Retrieval Configuration Guide

> Enhanced Retrieval System 配置详解

## Quick Start

### 默认配置

系统提供三档预设配置：

| Preset | 上下文窗口 | 目标Token | 适用场景 |
|--------|-----------|-----------|---------|
| light | 32K | ~19K | 快速检索、移动端 |
| standard | 64K | ~38K | 默认平衡、桌面端 |
| extended | 128K | ~77K | 复杂分析、研究场景 |

### 代码配置

```typescript
import { createEnhancedRetrievalPipeline, CONTEXT_WINDOW_PRESETS } from './retrieval';

// 使用预设
const pipeline = createEnhancedRetrievalPipeline({
  preset: 'standard'  // 'light' | 'standard' | 'extended'
});

// 自定义配置
const pipeline = createEnhancedRetrievalPipeline({
  modelContextWindow: 64000,
  minConfidenceThreshold: 0.35,
  rerankerThreshold: 15
});
```

---

## Configuration Sections

### 1. Model Context

控制检索Token量，直接影响LLM可见内容。

```typescript
interface ModelContextConfig {
  modelContextWindow: 32000 | 64000 | 128000;
  systemPromptTokens: number;   // 系统提示词占用
  outputReservation: number;    // 输出预留空间
  fillRatio: number;            // 填充比例 (0.5-0.8)
  overfetchRatio: number;       // 过检索系数 (1.5-3.0)
}
```

**计算逻辑**：

```
effectiveWindow = modelContextWindow - systemPromptTokens - outputReservation
targetTokens = effectiveWindow × fillRatio
coarseTopK = ceil(targetTokens × overfetchRatio / avgParentTokens)
```

**推荐值**：

| 参数 | 推荐范围 | 说明 |
|------|---------|------|
| fillRatio | 0.5-0.7 | 过高导致检索冗余，过低信息不足 |
| overfetchRatio | 1.5-2.5 | 粗排阶段多检索，精排阶段过滤 |
| systemPromptTokens | 1500-3000 | 根据实际Prompt长度调整 |

---

### 2. Query Optimization

控制查询优化功能开关。

```typescript
interface QueryOptimizationConfig {
  enableDecomposition: boolean;  // 复杂问题分解
  enableRewrite: boolean;        // 口语→专业重写
  enableExpansion: boolean;      // 同义词扩展
  maxSubQueries: number;         // 分解上限
  maxExpandedTerms: number;      // 扩展词上限
}
```

**功能说明**：

| 功能 | 默认 | 触发条件 | 效果 |
|------|------|---------|------|
| decomposition | true | 检测到"对比"、"和"等模式 | 多子查询并发检索 |
| rewrite | true | 口语化词汇命中词典 | 提升命中率 |
| expansion | true | 同义词词典匹配 | 扩大检索范围 |

**限制参数**：

- `maxSubQueries`: 防止过度分解，默认5
- `maxExpandedTerms`: 防止扩展爆炸，默认5

---

### 3. Reranking

控制重排策略和模型。

```typescript
interface RerankingConfig {
  rerankerThreshold: number;     // 路由阈值
  rerankerModel: string;         // 本地模型名称
  minConfidenceThreshold: number; // 低置信度阈值
  confidenceWeights: ConfidenceWeights;
}
```

**路由逻辑**：

| 检索结果数 | 路由 | 原因 |
|-----------|------|------|
| ≤ threshold | LocalReranker | 本地模型效果更好 |
| > threshold | ConfidenceCalculator | 计算效率更高 |

**推荐阈值**：

- `rerankerThreshold`: 20（经验值）
- `minConfidenceThreshold`: 0.3（避免LLM幻觉）

---

### 4. Confidence Weights

四维度置信度权重配置。

```typescript
interface ConfidenceWeights {
  similarity: number;     // 向量相似度权重
  keywordMatch: number;   // 关键词覆盖权重
  position: number;       // 检索位置权重
  chunkQuality: number;   // 分块质量权重
}
```

**默认权重**：

| 维度 | 默认值 | 说明 |
|------|-------|------|
| similarity | 0.5 | 核心指标，语义相似度 |
| keywordMatch | 0.2 | 精确匹配补充 |
| position | 0.1 | 排名位置衰减 |
| chunkQuality | 0.2 | 分块完整性 |

**权重调整建议**：

- 精确检索场景：提高 `keywordMatch`
- 语义理解场景：提高 `similarity`
- 质量敏感场景：提高 `chunkQuality`

---

## Frontend Configuration Panel

Web界面配置入口：Dashboard → Settings → Retrieval Config

### 可配置项

1. **上下文窗口大小**
   - 32K (轻量) / 64K (标准) / 128K (扩展)
   - 实时生效

2. **最小置信度阈值**
   - 滑块范围：0.1 - 0.5
   - 低阈值 → 更多结果返回
   - 高阈值 → 更严格筛选

3. **重排阈值**
   - 数字输入：10 - 50
   - ≤阈值 → 本地模型
   - >阈值 → 内部计算

4. **功能开关**
   - 查询分解
   - 查询重写
   - 同义词扩展

---

## Environment Variables

环境变量配置（可选）：

```bash
# LLM配置 (查询分析使用)
DEEPSEEK_API_KEY=your_key
DEEPSEEK_MODEL=deepseek-reasoner

# 本地重排模型路径
RERANKER_MODEL_PATH=./models/bge-reranker-v2-m3
```

---

## API Configuration

### 获取配置

```bash
GET /api/chat/config
```

Response:
```json
{
  "presets": {
    "light": { "modelContextWindow": 32000 },
    "standard": { "modelContextWindow": 64000 },
    "extended": { "modelContextWindow": 128000 }
  },
  "default": {
    "modelContextWindow": 64000,
    "minConfidenceThreshold": 0.3,
    ...
  }
}
```

### 更新配置

```bash
POST /api/chat/config
Content-Type: application/json

{
  "modelContextWindow": 128000,
  "minConfidenceThreshold": 0.35
}
```

Response:
```json
{
  "merged": {
    "modelContextWindow": 128000,
    "minConfidenceThreshold": 0.35,
    ...
  }
}
```

---

## Best Practices

### 场景推荐配置

**1. 快速问答场景**

```typescript
{
  preset: 'light',
  minConfidenceThreshold: 0.35,
  enableDecomposition: false,
  enableExpansion: false
}
```

**2. 深度分析场景**

```typescript
{
  preset: 'extended',
  minConfidenceThreshold: 0.25,
  enableDecomposition: true,
  enableRewrite: true,
  maxSubQueries: 8
}
```

**3. 精确检索场景**

```typescript
{
  preset: 'standard',
  minConfidenceThreshold: 0.4,
  confidenceWeights: {
    similarity: 0.3,
    keywordMatch: 0.4,
    position: 0.1,
    chunkQuality: 0.2
  }
}
```

---

## Troubleshooting

### 常见问题

**Q: 检索结果太少？**

- 降低 `minConfidenceThreshold`
- 提高 `overfetchRatio`
- 开启 `enableExpansion`

**Q: 检索结果质量差？**

- 提高 `minConfidenceThreshold`
- 调整 `confidenceWeights` 提高相似度权重
- 检查同义词词典配置

**Q: 响应时间太长？**

- 使用 `light` preset
- 降低 `maxSubQueries`
- 提高 `rerankerThreshold` 使用内部计算

---

## Related Docs

- [Enhanced Retrieval Architecture](./enhanced-retrieval.md)
- [Small-to-Big Retriever](../src/chunking/small-to-big-retriever.ts)
- [Configuration Types](../src/retrieval/config.ts)