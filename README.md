# SelfSearchRAG

> 增强型多模态 RAG 系统 | 语义分块 + Small-to-Big 检索 | Medical Agent + RAG 评估体系

一个专为医学知识检索优化的增强型 RAG 系统，支持 MCP 协议、Dense+Sparse 双轨检索、8 维度 RAG 评估，以及规则化决策的 Medical Agent。

[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-22+-green)](https://nodejs.org/)
[![License](https://img.shields.io/badge/License-MIT-yellow)](LICENSE)

---

## 核心亮点

### 🔬 Medical Agent - 智能医学问答

**双模式执行**：ReAct 循环 + Planning 模式，支持复杂查询的 DAG 任务分解

**规则化决策**：替代 LLM decide()，减少 80%+ LLM 调用次数

**早终止机制**：绝对禁忌场景立即返回，响应时间 < 1 秒

**增强证据评估**：5 维度综合评分（GRADE + 权威度 + 时效性 + 一致性 + 适用性）

### 📊 8 维度 RAG 评估体系

三层评估架构，异步队列处理，WebSocket 实时推送：

| 层级 | 维度 | 权重 | 说明 |
|------|------|------|------|
| Layer 1 | Faithfulness | 20% | 答案忠实度，检测幻觉 |
| Layer 1 | Context Relevance | 10% | 检索内容相关性 |
| Layer 1 | Answer Relevance | 10% | 答案是否回答问题 |
| Layer 2 | Medical Accuracy | 20% | 术语正确性、指南符合度 |
| Layer 2 | Safety Assessment | 20% | 禁忌检测、相互作用风险 |
| Layer 3 | Evidence Traceability | 10% | 来源标注、引用准确性 |
| Layer 3 | Completeness | 5% | 实体覆盖、问题覆盖 |
| Layer 3 | Terminology Accuracy | 5% | 医疗术语使用准确性 |

### 🔍 Hybrid 检索 - Dense + Sparse 双轨融合

**bge-m3 模型**：同时生成 Dense (1024维) + Sparse (词权重) 向量

**RRF 融合**：语义搜索 + 关键词匹配，中文检索召回率提升 40%

**Qdrant 索引**：HNSW 索引，100K 向量检索延迟 < 10ms

### 📄 多模态 PDF 处理

**PaddleOCR 版面分析**：识别 text/table/figure/formula 块

**VLM 深度理解**：表格 → Markdown，图表 → 趋势描述，公式 → LaTeX

**语义分块**：断崖检测 + Small-to-Big 检索，命中率提升 30%

---

## 系统架构

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           SelfSearchRAG 系统架构                              │
└─────────────────────────────────────────────────────────────────────────────┘

  用户入口
          │ HTTP/WebSocket / MCP Protocol
          ▼
  ┌───────────────────────────────────────────────────────────────────────────┐
  │  编排与执行层                                                              │
  │  ├─ Harness Core: Pipeline 编排 (INGEST → PARSE → CHUNK → EMBED → INDEX) │
  │  ├─ Medical Agent: ReAct/Planning 双模式 + 规则化决策                      │
  │  └─ Evaluation Pipeline: 三层 8 维度评估 + 异步队列                        │
  └───────────────────────────────────────────────────────────────────────────┘
          │
          ▼
  ┌───────────────────────────────────────────────────────────────────────────┐
  │  检索与生成层                                                              │
  │  ├─ Hybrid Retriever: Dense(1024维) + Sparse + RRF 融合                   │
  │  ├─ Small-to-Big: 小块精准定位 → 父块完整展开                              │
  │  ├─ Query Optimizer: LLM 分析 → 术语重写 → 同义词扩展                      │
  │  └─ LLM Generation: DeepSeek Reasoner 思考链                              │
  └───────────────────────────────────────────────────────────────────────────┘
          │
          ▼
  ┌───────────────────────────────────────────────────────────────────────────┐
  │  存储与索引层                                                              │
  │  ├─ Qdrant: Dense + Sparse 双索引，HNSW 算法                              │
  │  ├─ HierarchicalStore: Small(200-400 tokens) + Parent(500-1500 tokens)    │
  │  ├─ TraceStorage: SQLite 持久化追踪数据                                    │
  │  └─ Redis + Bull: 异步评估任务队列                                         │
  └───────────────────────────────────────────────────────────────────────────┘
          │
          ▼
  ┌───────────────────────────────────────────────────────────────────────────┐
  │  文档处理层                                                                │
  │  ├─ PDF Parser: pdf-parse + pdfjs-dist                                    │
  │  ├─ Semantic Chunker: 断崖检测 + 结构边界识别                              │
  │  ├─ Embedding: bge-m3 (Dense+Sparse) / multilingual-e5-small              │
  │  └─ OCR + VLM: PaddleOCR + qwen3-vl-flash                                 │
  └───────────────────────────────────────────────────────────────────────────┘
```

---

## 技术栈

| 类别 | 技术 | 说明 |
|------|------|------|
| **后端框架** | Fastify + TypeScript | 高性能 HTTP Server，WebSocket 支持 |
| **向量数据库** | Qdrant | HNSW 索引，Dense + Sparse 双轨支持 |
| **消息队列** | Redis + Bull | 异步评估任务调度 |
| **嵌入模型** | bge-m3 | Dense(1024维) + Sparse(词权重) |
| **LLM 服务** | DeepSeek Reasoner | 思考链支持，流式生成 |
| **OCR 服务** | PaddleOCR PP-StructureV3 | 版面分析 + 文字识别 |
| **VLM 服务** | qwen3-vl-flash | 表格/图表/公式理解 |
| **前端框架** | React + Vite + TailwindCSS | 可视化 Dashboard |
| **MCP 协议** | @modelcontextprotocol/sdk | Claude/AI 助手集成 |
| **状态管理** | Zustand | 前端状态 + WebSocket 同步 |
| **测试框架** | Vitest | 单元测试 + E2E 测试 |

---

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

```bash
# LLM 服务 (必选其一)
export DEEPSEEK_API_KEY=your_key       # DeepSeek API
export ANTHROPIC_API_KEY=your_key      # Claude API
export OPENAI_API_KEY=your_key         # OpenAI API
# Ollama 本地无需配置

# VLM 服务 (可选，处理扫描 PDF)
export DASHSCOPE_API_KEY=your_key      # 阿里云 DashScope

# 向量数据库 (推荐)
export VECTOR_STORE_TYPE=qdrant
export QDRANT_URL=http://localhost:6333
export EMBEDDING_MODE=hybrid            # Dense+Sparse 模式
```

### 3. 启动服务

```bash
# 启动 Qdrant (Docker)
docker run -p 6333:6333 qdrant/qdrant

# 启动 Redis (Docker，评估队列需要)
docker run -p 6379:6379 redis:7-alpine

# 启动 OCR 服务 (处理扫描 PDF)
cd scripts && uv run ocr_service.py

# 启动主服务
npm run start:server

# 启动评估 Worker (可选)
npm run worker:evaluation
```

### 4. 访问界面

打开浏览器访问 http://localhost:3001

---

## 模块设计

### 目录结构

```
src/
├── core/                 # Harness 框架、Pipeline 编排
│   ├── harness.ts        # Pipeline 生命周期管理
│   └── pipeline-hooks.ts # 可插拔 Hooks
│
├── parsers/              # 文档解析
│   ├── pdf-parser.ts     # PDF 解析
│   └── ocr-service.ts    # OCR + VLM 集成
│
├── chunking/             # 语义分块
│   ├── semantic-chunker.ts      # 断崖检测
│   ├── similarity-cliff.ts      # 相似度断崖算法
│   └── hierarchical-store.ts    # Small + Parent 层级存储
│
├── embedding/            # 向量嵌入
│   ├── hybrid-embedding-service.ts  # bge-m3 Dense+Sparse
│   └── local-embedding-service.ts   # 本地 Transformers
│
├── retrieval/            # 检索引擎
│   ├── hybrid-retriever.ts    # Dense+Sparse+RRF 融合
│   ├── small-to-big.ts        # 小块定位 → 父块展开
│   ├── query-optimizer.ts     # 查询重写 + 扩展
│   └── confidence-reranker.ts # 置信度重排
│
├── medical/              # Medical Agent
│   ├── agent/
│   │   ├── AgentExecutor.ts    # ReAct/Planning 双模式
│   │   ├── MedicalReasoner.ts  # 医学推理
│   │   ├── TaskPlanner.ts      # DAG 任务规划
│   │   └── TraceVisualizer.ts  # 执行追踪可视化
│   ├── entity-recognizer.ts    # 医学实体识别
│   ├── safety-layer.ts         # 禁忌检查 + 安全评估
│   └── evidence-evaluator.ts   # 增强证据评估
│
├── evaluation/           # RAG 评估体系
│   ├── MedicalEvaluationPipeline.ts  # 三层评估流水线
│   └── types.ts                       # 评估结果类型
│
├── tracing/              # 追踪系统
│   ├── TraceStorage.ts        # SQLite 持久化
│   ├── TraceContext.ts        # 请求级追踪上下文
│   ├── TraceExporter.ts       # RAGAS 格式导出
│   └── MetricsAggregator.ts   # 指标聚合 + WebSocket 推送
│
├── queue/                # 异步队列
│   ├── EvaluationQueue.ts     # Bull 队列管理
│   └── EvaluationWorker.ts    # Worker 进程
│
├── server/               # HTTP 服务
│   ├── main-server.ts    # Fastify 主服务
│   ├── routes/chat.ts    # Chat API + Agent 集成
│   └── bull-board.ts     # 队列监控面板
│
├── frontend/             # React 可视化
│   ├── components/
│   │   ├── ChatWindow.tsx         # 聊天界面
│   │   ├── StatsDashboard.tsx     # 统计面板
│   │   ├── TraceExplorer.tsx      # 追踪浏览器
│   │   └── stats/EvaluationCard.tsx # 评估指标卡片
│   └── store/
│       ├── statsStore.ts   # 统计状态
│       └── traceStore.ts   # 追踪状态
│
└── mcp/                  # MCP Server
    └── server.ts         # MCP 协议实现
    └── tools/
        ├── rag-query.ts      # 文档检索工具
        └── medical-agent.ts  # Medical Agent 工具
```

### 核心模块详解

#### Medical Agent

```typescript
// 双模式执行
const executor = createAgentExecutor({
  maxIterations: 5,
  confidenceThreshold: 0.8,
  enablePlanning: true,      // Planning 模式
  useRuleBasedDecide: true,  // 规则化决策 (默认)
  maxReplanRounds: 2,
}, context);

// Planning 模式内置 6 个模板
// ├─ 指南年份过滤
// ├─ 药物禁忌检查
// ├─ 药物对比 (并行检索)
// ├─ 指标药物查询
// ├─ 指标决策支持
// └─ 疾病用药建议
```

#### Hybrid Retriever

```typescript
// 双轨检索流程
Query → bge-m3 → Dense(1024维) + Sparse(词权重)
        │
        ├─→ Qdrant.searchDense('text_chunks', topK=50)
        │     → Dense Results
        │
        ├─→ Qdrant.searchSparse('text_chunks', topK=50)
        │     → Sparse Results
        │
        └─→ RRF Fusion (k=60)
              → 融合排序 → Small-to-Big 展开
```

#### Evaluation Pipeline

```typescript
// 三层评估架构
TraceContextData
    │
    ▼
Layer 1: RAGAS 基础 (LLM 驱动)
├─ Faithfulness: 答案声称 → 检索内容支持验证
├─ Context Relevance: Chunk 相关性判断
└─ Answer Relevance: 答案 → 问题反推验证
    │
    ▼
Layer 2: 医疗核心 (LLM 驱动)
├─ Medical Accuracy: 术语正确性 + 指南符合度
└─ Safety Assessment: 禁忌 + 相互作用检测
    │
    ▼
Layer 3: 医疗增强 (规则驱动)
├─ Evidence Traceability: 引用匹配
├─ Completeness: 实体覆盖率
└─ Terminology Accuracy: 术语关键词
    │
    ▼
ExtendedEvaluationResult
├─ overallScore: 加权综合分数
├─ riskLevel: 'safe' | 'caution' | 'warning' | 'danger'
└─ layerScores: { layer1, layer2, layer3 }
```

---

## API 端点

| 方法 | 端点 | 功能 |
|------|------|------|
| `POST` | `/api/documents/upload` | 上传文档 |
| `GET` | `/api/documents` | 文档列表 |
| `DELETE` | `/api/documents/:id` | 删除文档 |
| `POST` | `/api/chat/generate` | SSE 流式生成答案 (支持 Agent) |
| `POST` | `/api/chat/enhanced` | 增强检索 + 置信度答案 |
| `GET` | `/api/stats` | 系统统计 |
| `GET` | `/api/stats/health/storage` | 存储健康检查 |
| `GET` | `/api/health` | 服务健康检查 |
| `GET` | `/admin/queues` | Bull Board 队列监控 |

### Agent 模式请求

```json
POST /api/chat/generate
{
  "query": "二甲双胍禁忌症",
  "enableAgent": true,
  "topK": 5,
  "similarityThreshold": 0.0,
  "maxContextTokens": 4000
}
```

**响应字段**:
- `agentUsed`: 是否使用 Agent
- `agentSatisfied`: Agent 满意度
- `iterations`: 迭代次数
- `thinking`: 推理过程
- `answer`: 最终回答

---

## MCP 工具

可被 Claude 等 AI 助手直接调用：

### Claude Desktop 配置

```json
{
  "mcpServers": {
    "rag": {
      "command": "node",
      "args": ["dist/mcp/server.js"]
    }
  }
}
```

### 工具列表

| 工具名称 | 功能 |
|----------|------|
| `rag_query` | 文档检索查询 |
| `rag_index` | 上传并索引文档 |
| `medical_query` | 简化医学查询 |
| `medical_agent` | ReAct 模式医学 Agent |
| `medical_agent_plan` | Planning 模式医学 Agent |

---

## 性能基准

### Agent 执行性能 (2026-04-23)

| 指标 | 规则化决策前 | 规则化决策后 | 改进 |
|------|--------------|--------------|------|
| LLM 调用次数 | 5-15 次 | 1-3 次 | ↓80% |
| 执行时间 | 10-40 秒 | 2-10 秒 | ↓75% |
| 绝对禁忌场景 | 3 次 LLM | 0 次 LLM | 立即返回 |

### 检索性能

| 操作 | 时间 | 说明 |
|------|------|------|
| Hybrid 检索 (dense+sparse) | ~50ms | 1024维 + Sparse |
| Small-to-Big 展开 | <5ms | 小块 → 父块 |
| Qdrant HNSW 搜索 | <10ms | 100K 向量 |
| 查询优化 (LLM) | ~200ms | 重写 + 扩展 |

### 评估吞吐量

| 配置 | 吞吐量 | 说明 |
|------|--------|------|
| 单 Worker (replicas=1) | ~20 eval/min | concurrency=2 |
| 3 Workers (replicas=3) | ~60 eval/min | 水平扩展 |
| 评估延迟 | 30-60s | ~10-20 次 LLM 调用 |

---

## 配置说明

### Hybrid 检索

```bash
# 推荐配置
VECTOR_STORE_TYPE=qdrant
QDRANT_URL=http://localhost:6333
EMBEDDING_MODE=hybrid
HYBRID_RETRIEVAL_ENABLED=true

# RRF 参数
RRF_K=60                   # 融合常数
RRF_DENSE_TOPK=50          # Dense 搜索数量
RRF_SPARSE_TOPK=50         # Sparse 搜索数量

# 内容恢复 (可选)
STORE_CONTENT_IN_PAYLOAD=true  # 存储内容到 Qdrant payload
```

### LLM 配置优先级

1. `ANTHROPIC_API_KEY` → Claude API
2. `OPENAI_API_KEY` → OpenAI API
3. `DEEPSEEK_API_KEY` → DeepSeek API
4. 默认 → Ollama 本地

### Agent 配置

```typescript
interface AgentConfig {
  maxIterations: number;           // 最大迭代次数 (默认 5)
  confidenceThreshold: number;     // 置信度阈值 (默认 0.8)
  enablePlanning: boolean;         // Planning 模式 (默认 true)
  useRuleBasedDecide: boolean;     // 规则化决策 (默认 true)
  maxReplanRounds: number;         // 最大重规划轮数 (默认 2)
  ruleThresholds: {
    minRetrievalCount: number;     // 检索数量阈值 (默认 3)
    minSimilarityScore: number;    // 相似度阈值 (默认 0.7)
    minEntityCoverage: number;     // 实体覆盖率 (默认 0.8)
  };
}
```

---

## Docker 部署

```bash
# 启动所有服务
docker-compose up -d

# 服务列表
# ├─ rag-server: 主服务 (port 3001)
# ├─ qdrant: 向量数据库 (port 6333)
# ├─ redis: 消息队列 (port 6379)
# ├─ ocr-service: OCR + VLM (port 8080)
# └─ evaluation-worker: 评估 Worker

# 扩展 Worker 数量
docker-compose up -d --scale evaluation-worker=3

# 查看日志
docker-compose logs -f evaluation-worker
```

---

## 变更历史

项目通过 OpenSpec 系统化管理变更，完整变更记录见 `openspec/changes/archive/`。

| 时间 | 阶段 | 核心变更 |
|------|------|----------|
| 04-09 | 基础架构 | 多模态 PDF、语义分块、前端应用、类型安全 |
| 04-10 | 检索增强 | 检索-嵌入一致性、本地嵌入模型 |
| 04-13 | LLM 集成 | DeepSeek 思考链、Pipeline 可视化、UI 现代化 |
| 04-14~15 | 持续优化 | OCR+VLM 流程、流式滚动修复、上下文窗口 |
| 04-20 | 检索升级 | Qdrant 向量库、Hybrid 检索、层级存储同步 |
| 04-21~22 | Agent 集成 | Medical Agent、Safety Layer、DAG 编排 |
| 04-23 | 性能优化 | 规则化决策、早终止、8 维度评估系统 |
| 04-24 | 存储可靠性 | HierarchicalStore-Qdrant 同步修复、Fallback 恢复机制、存储健康检查 API |
| 04-24 | 元数据提取 | PDF 元数据提取、年份推断、医疗指南来源识别、SourceCitation 人类可读标题显示 |

---

## 详细文档

| 文档 | 说明 |
|------|------|
| [medical-agent-guide.md](docs/medical-agent-guide.md) | Medical Agent 使用指南 |
| [rag-evaluation-guide.md](docs/rag-evaluation-guide.md) | RAG 评估体系使用指南 |
| [rag-evaluation-system-evolution.md](docs/rag-evaluation-system-evolution.md) | 评估系统架构演进 |
| [hybrid-retrieval.md](docs/hybrid-retrieval.md) | Hybrid 检索详细说明 |
| [document-metadata.md](docs/document-metadata.md) | 文档元数据提取系统 |
| [architecture-diagrams.md](docs/architecture-diagrams.md) | 系统架构图 |
| [interview-qa.md](docs/interview-qa.md) | 技术面试问答 |

---

## 安全提示

⚠️ **Medical Agent 生成的回答仅供参考**：

- 不构成医疗诊断或治疗建议
- 实际用药请咨询专业医生
- 系统可能存在知识更新滞后问题
- Safety Layer 检测到危险内容会自动标记

---

## 开源协议

MIT License

---

> **最后更新**: 2026-04-24
>
> **维护者**: SelfSearchRAG Team