# Tasks: Query Optimization and Reranking

## Phase 1: Query Optimization Layer

### 1.1 Core Infrastructure

- [x] 创建 `src/retrieval/config.ts` - EnhancedRetrievalConfig定义
- [x] 创建 `src/retrieval/types.ts` - 新增类型定义
- [x] 创建 `config/synonyms.json` - 同义词词典初始配置

### 1.2 QueryAnalyzer

- [x] 创建 `src/retrieval/query-analyzer.ts`
- [x] 实现LLM调用逻辑（DeepSeek API）
- [x] 实现Query分析结果缓存
- [x] 实现detectedFilters检测逻辑
- [x] 添加单元测试 `src/retrieval/query-analyzer.test.ts`

### 1.3 QueryRewriter

- [x] 创建 `src/retrieval/query-rewriter.ts`
- [x] 实现rewrite LLM Prompt模板
- [x] 添加单元测试

### 1.4 QueryDecomposer

- [x] 创建 `src/retrieval/query-decomposer.ts`
- [x] 实现子查询分解逻辑
- [x] 实现maxSubQueries限制
- [x] 添加单元测试

### 1.5 QueryDSLBuilder

- [x] 创建 `src/retrieval/query-dsl-builder.ts`
- [x] 实现DSL构建逻辑
- [x] 添加单元测试

### 1.6 QueryExpander

- [x] 创建 `src/retrieval/query-expander.ts`
- [x] 实现同义词词典加载
- [x] 实现expand逻辑
- [x] 添加单元测试

---

## Phase 2: Dynamic TopK

### 2.1 HierarchicalStore改造

- [x] 在 `src/chunking/hierarchical-store.ts` 添加 `getAvgParentTokenLength()` 方法
- [x] 添加token统计计算逻辑
- [x] 添加单元测试

### 2.2 DynamicTopKCalculator

- [x] 创建 `src/retrieval/dynamic-topk-calculator.ts`
- [x] 实现计算公式逻辑
- [x] 支持三档配置 (32K/64K/128K)
- [x] 添加单元测试

---

## Phase 3: Reranking Layer

### 3.1 ConfidenceCalculator

- [x] 创建 `src/retrieval/confidence-calculator.ts`
- [x] 实现similarityScore计算
- [x] 实现keywordMatchScore计算 (BM25或关键词覆盖)
- [x] 实现positionScore计算
- [x] 实现chunkQualityScore计算 (复用QualityFilter)
- [x] 实现加权合并逻辑
- [x] 添加单元测试

### 3.2 LocalReranker

- [x] 创建 `src/retrieval/local-reranker.ts`
- [x] 集成bge-reranker-v2-m3模型
- [x] 实现initialize/shutdown方法
- [x] 实现rerank方法
- [x] 添加模型下载脚本
- [x] 添加单元测试（mock模式）

### 3.3 HybridReranker

- [x] 创建 `src/retrieval/hybrid-reranker.ts`
- [x] 实现threshold判断逻辑
- [x] 实现小样本→LocalReranker路由
- [x] 实现大样本→ConfidenceCalculator路由
- [x] 添加单元测试

### 3.4 LowConfidenceHandler

- [x] 创建 `src/retrieval/low-confidence-handler.ts`
- [x] 实现avgSimilarity计算
- [x] 实现threshold判断 (0.3)
- [x] 实现NoMatchResult返回格式
- [x] 添加单元测试

---

## Phase 4: Integration

### 4.1 Enhanced SmallToBigRetriever

- [x] 改造 `src/chunking/small-to-big-retriever.ts`
- [x] 支持Multi-Query输入
- [x] 实现结果合并去重逻辑
- [x] 集成DynamicTopKCalculator
- [x] 添加单元测试

### 4.2 EnhancedContextAssembler

- [x] 创建 `src/retrieval/enhanced-context-assembler.ts`
- [x] 实现confidenceLevel判断逻辑
- [x] 实现动态截断逻辑
- [x] 添加单元测试

### 4.3 EnhancedLLMGenerationService

- [x] 创建 `src/server/services/enhanced-llm-generation-service.ts`
- [x] 实现constructPromptWithConfidence方法
- [x] 实现置信度Prompt模板
- [x] 添加单元测试

### 4.4 Pipeline Integration

- [x] 创建 `src/retrieval/enhanced-retrieval-pipeline.ts`
- [x] 串联所有Stage (Analyzer → Rewriter → Expander → Retriever → Reranker → Assembler)
- [x] 实现Pipeline执行流程
- [x] 添加集成测试

---

## Phase 5: API and Frontend

### 5.1 API Routes

- [x] 改造 `src/server/routes/chat.ts`
- [x] 调用EnhancedRetrievalPipeline
- [x] 返回EnhancedChatResponse格式
- [x] 添加 `/api/chat/config` 端点
- [x] 添加API测试

### 5.2 Frontend Updates

- [x] 更新 `src/frontend/store/chatStore.ts` - 处理新响应格式
- [x] 更新 `src/frontend/components/ChatWindow.tsx` - 显示置信度信息
- [x] 更新 `src/frontend/components/ResultsPanel.tsx` - 显示检索统计
- [x] 添加配置面板组件

---

## Phase 6: Testing and Documentation

### 6.1 Testing

- [x] 创建 `src/__tests__/enhanced-retrieval.test.ts` - E2E测试
- [x] 创建性能基准测试
- [x] 创建召回率评估测试

### 6.2 Documentation

- [x] 更新 `README.md` - 添加新功能说明
- [x] 创建 `docs/enhanced-retrieval.md` - 详细文档
- [x] 更新 `docs/QA-Interview/` - 添加相关QA
- [x] 创建配置说明文档

---

## Task Dependencies

```
Phase 1 ─────────────────────────────────────────────
  │
  ├── 1.1 (基础设施) → 1.2-1.6 (依赖类型定义)
  │
  └─────────────────────────────────────────────────
        │
Phase 2 ─────────────────────────────────────────────
  │
  ├── 2.1 (Store改造) → 2.2 (依赖avgParentTokenLength)
  │
  └─────────────────────────────────────────────────
        │
Phase 3 ─────────────────────────────────────────────
  │
  ├── 3.1 (置信度) → 3.3 (HybridReranker依赖)
  │   3.2 (本地模型) → 3.3 (HybridReranker依赖)
  │   3.4 (低置信度) → Phase 4 Integration
  │
  └─────────────────────────────────────────────────
        │
Phase 4 ─────────────────────────────────────────────
  │
  ├── 4.1 (Retriever改造) → 4.4 (Pipeline依赖)
  │   4.2 (Assembler) → 4.4 (Pipeline依赖)
  │   4.3 (LLM) → 4.4 (Pipeline依赖)
  │
  └─────────────────────────────────────────────────
        │
Phase 5 ─────────────────────────────────────────────
  │
  ├── 5.1 (API) → 5.2 (Frontend依赖响应格式)
  │
  └─────────────────────────────────────────────────
        │
Phase 6 ─────────────────────────────────────────────
```

---

## Priority Notes

**高优先级（核心功能）**:
- Phase 1.2 QueryAnalyzer
- Phase 2.2 DynamicTopKCalculator
- Phase 3.3 HybridReranker
- Phase 3.4 LowConfidenceHandler
- Phase 4.4 Pipeline Integration

**中优先级（增强功能）**:
- Phase 1.3-1.6 Query优化组件
- Phase 3.1 ConfidenceCalculator
- Phase 4.1-4.3 集成改造

**低优先级（可选/优化）**:
- Phase 3.2 LocalReranker（可先fallback到内部计算）
- Phase 5.2 Frontend（不影响核心功能）
- Phase 6 Documentation