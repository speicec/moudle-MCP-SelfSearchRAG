# MY-RAG-MCP-SERVER

> 增强型多模态RAG系统 | 语义分块 + Small-to-Big检索 | 扫描文档深度理解

---

### 亮点三：智能查询优化 + 置信度重排

**解决问题**：用户口语化查询难以命中专业术语；检索结果缺乏质量评估，无法判断可信度。

**技术方案**：
- **查询优化**：LLM分析查询意图 → 术语重写 → 同义词扩展 → 复杂问题分解
- **动态TopK**：根据模型上下文窗口(32K/64K/128K)动态计算检索量
- **置信度重排**：相似度(50%) + 关键词匹配(20%) + 位置权重(10%) + 分块质量(20%)
- **低置信度处理**：平均置信度<0.3时返回"无匹配"，避免LLM幻觉

```
查询优化流程：
用户输入 → QueryAnalyzer(复杂度判断)
        → QueryRewriter(口语→专业)
        → QueryExpander(同义词扩展)
        → QueryDecomposer(多问题拆分)

重排决策：
检索结果数 ≤ 20 → LocalReranker (bge-reranker-v2-m3)
检索结果数 > 20 → ConfidenceCalculator (内部计算)
```

**效果提升**：
- 口语化查询命中率提升约40%
- 检索结果置信度可视化，用户可判断可信程度
- 复杂对比问题自动拆解，全面覆盖检索域

---

## 🎯 核心亮点

### 亮点一：语义分块 + Small-to-Big检索

**解决问题**：传统RAG固定长度切分（512/1024 tokens）无视语义边界，导致检索结果碎片化。

**技术方案**：
- **语义分块**：基于Embedding相似度的断崖检测，在语义边界处切分而非固定位置
- **Small-to-Big检索**：小块精准定位 → 父块完整展开，用户获得完整语义单元

```
        ┌─────────────────────────────────────────┐
        │          Parent Chunk (完整上下文)       │
        │      1000-2000 tokens                   │
        │                                         │
        │  ┌─────────┐ ┌─────────┐ ┌─────────┐   │
        │  │ Child 1 │ │ Child 2 │ │ Child 3 │   │
        │  │ (精准)  │ │ (精准)  │ │ (精准)  │   │
        │  │ 200-400 │ │ 200-400 │ │ 200-400 │   │
        │  │ tokens  │ │ tokens  │ │ tokens  │   │
        │  └─────────┘ └─────────┘ └─────────┘   │
        └─────────────────────────────────────────┘

检索流程：命中Child → 展开Parent → 返回完整上下文
```

**实测效果**：检索命中率提升约30%，消除"切到一半"问题。

---

### 亮点二：多模态PDF处理 + VLM深度理解

**解决问题**：扫描文档、表格、图表无法被传统RAG检索——因为它们只是"一张图片"。

**技术方案**：
- **OCR版面分析**：PaddleOCR识别bbox + blockType (text/table/figure/formula)
- **VLM深度理解**：qwen3-vl-flash将表格→Markdown、图表→趋势描述、公式→LaTeX
- **双轨索引**：文本Embedding + CLIP图像Embedding，融合检索

```
PDF → 图片渲染 → OCR版面分析 → VLM增强 → 存入索引
                        │
                        ├─ text/title → 直接存储
                        └─ table/figure/formula → VLM理解 → Markdown存储
```

**检索效果**：用户检索"增长率"可命中图表内容，检索"销售数据"可找到表格。

---

## 📊 系统架构

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           MY-RAG-MCP-SERVER                                  │
└─────────────────────────────────────────────────────────────────────────────┘

  用户入口 (Web UI / MCP调用)
          │ HTTP/WebSocket / MCP Protocol
          ▼
  ┌───────────────────────────────────────────────────────────────────────────┐
  │  服务层: HTTP Server + WebSocket Handler + Pipeline Emitter              │
  └───────────────────────────────────────────────────────────────────────────┘
          │
          ▼
  ┌───────────────────────────────────────────────────────────────────────────┐
  │  Harness编排层: INGEST → PARSE → CHUNK → EMBED → INDEX                   │
  │                  (可插拔Plugin + Lifecycle Hooks)                         │
  └───────────────────────────────────────────────────────────────────────────┘
          │
          ▼
  ┌───────────────────────────────────────────────────────────────────────────┐
  │  数据层: DocumentStore + HierarchicalStore + ImageStore + Qdrant         │
  │          (元数据存储)            (向量索引: Dense+Sparse)                 │
  └───────────────────────────────────────────────────────────────────────────┘
          │
          ▼
  ┌───────────────────────────────────────────────────────────────────────────┐
  │  检索与生成: Hybrid Retriever + Enhanced Pipeline + DeepSeek LLM         │
  │              Dense+Sparse → RRF融合 → Parent扩展 → 置信度重排             │
  └───────────────────────────────────────────────────────────────────────────┘
          │
          ▼
  ┌───────────────────────────────────────────────────────────────────────────┐
  │  外部服务: PaddleOCR + DashScope VLM + Transformers (bge-m3)             │
  └───────────────────────────────────────────────────────────────────────────┘
```

---

## 🚀 快速开始

```bash
# 1. 安装依赖
npm install

# 2. 配置环境变量（可选）
export DEEPSEEK_API_KEY=your_key        # LLM智能问答
export DASHSCOPE_API_KEY=your_key       # VLM图片理解

# 3. 启动OCR服务（处理扫描PDF需要）
cd scripts && uv run ocr_service.py

# 4. 启动Qdrant向量数据库（可选，用于Hybrid检索）
docker run -p 6333:6333 qdrant/qdrant
export VECTOR_STORE_TYPE=qdrant
export EMBEDDING_MODE=hybrid

# 5. 启动主服务
npm run dev
```

访问 http://localhost:3001 打开Web Dashboard。

---

## 🔧 配置说明

### Hybrid检索 (Qdrant + bge-m3)

**推荐配置**：启用Hybrid检索获得最佳性能。

```bash
# Qdrant向量数据库
VECTOR_STORE_TYPE=qdrant          # 使用Qdrant (默认: in-memory)
QDRANT_URL=http://localhost:6333  # Qdrant服务地址
QDRANT_API_KEY=your_key           # 可选，用于认证

# Hybrid嵌入模式
EMBEDDING_MODE=hybrid             # Dense+Sparse混合 (推荐)
HYBRID_RETRIEVAL_ENABLED=true     # 启用Hybrid检索
```

**架构优势**：
- **Dense向量** (1024维)：语义相似度搜索，理解查询意图
- **Sparse向量** (词权重)：关键词精确匹配，中文检索更准
- **RRF融合**：无需归一化，自动平衡两种搜索结果
- **性能提升**：HNSW索引 O(logN) vs 内存线性 O(N)

详见 [docs/hybrid-retrieval.md](docs/hybrid-retrieval.md)

### LLM智能问答 (DeepSeek)

```bash
DEEPSEEK_API_KEY=your_key       # 必需
DEEPSEEK_MODEL=deepseek-reasoner  # 支持思考链
```

配置后，Chat Tab将：
1. 检索相关文档片段
2. DeepSeek生成智能回答（含思考过程）
3. 实时流式显示生成过程

### VLM图片理解 (阿里云DashScope)

```bash
DASHSCOPE_API_KEY=your_key      # 必需
```

配置后，表格/图表可被深度理解：
- 表格 → Markdown格式存储，可关键词检索
- 图表 → 类型+趋势描述，可语义检索
- 公式 → LaTeX格式，可符号检索

### 本地嵌入模型

默认使用本地Transformers，零API成本：

```bash
# 已内置
multilingual-e5-small  # 文本嵌入 (384维, 支持100+语言)
clip-vit-base-patch32  # 图像嵌入 (跨模态检索)
```

---

## 📁 目录结构

```
src/
├── core/           # Harness框架、Pipeline编排
├── parsers/        # PDF解析、OCR服务、VLM增强
├── chunking/       # 语义分块、断崖检测、层级存储
├── embedding/      # 嵌入生成（本地/云端）
├── retrieval/      # Small-to-Big检索 + 查询优化 + 置信度重排
├── server/         # HTTP/WebSocket服务、LLM生成
├── frontend/       # React可视化界面
└── mcp/            # MCP Server协议实现
```

---

## 🔬 核心算法

### 断崖检测 (语义边界识别)

```
输入: Embedding序列 [e1, e2, ..., en]

算法:
1. 计算相邻相似度: sim_i = cosine(e_i, e_{i+1})
2. 找候选点: sim < 0.7 (有断崖)
3. 验证梯度: |sim_i - sim_{i-1}| > 0.15 (下降幅度够大)
4. 滤噪: 要求连续2+个候选点
5. 置信度: gradient(60%) + width(40%)

输出: 语义边界位置列表 → 在此切分
```

### Small-to-Big检索

```
Phase 1: 小块精准定位
  - queryEmbedding = embed(userQuery)
  - vectorSearch(queryEmbedding, smallChunks)
  - filter(similarity > 0.75)

Phase 2: 父块完整展开
  - getParentChunk(matchedChild)
  - extractContextWindow(parent, child)
  - return 完整语义单元
```

---

## 🌐 API端点

| 方法 | 端点 | 功能 |
|------|------|------|
| POST | `/api/documents/upload` | 上传文档 |
| GET | `/api/documents` | 文档列表 |
| DELETE | `/api/documents/:id` | 删除文档 |
| POST | `/api/chat/generate` | SSE流式生成答案 |
| POST | `/api/chat/enhanced` | 增强检索+置信度答案 |
| GET | `/api/chat/config` | 获取检索配置预设 |
| POST | `/api/chat/config` | 更新检索配置 |
| GET | `/api/stats` | 系统统计 |
| GET | `/api/ws-status` | WebSocket连接状态 |
| GET | `/api/health` | 服务健康检查 |

### HybridSearchResult 格式

启用Hybrid模式后，检索结果包含融合信息：

```json
{
  "parentChunkId": "uuid",
  "parentContent": "完整父块内容",
  "parentScore": 0.85,
  "method": "hybrid_small", // 或 "fallback_parent_sparse"
  "matchedSmallChunks": [
    {
      "smallChunkId": "uuid",
      "score": 0.92,
      "sources": ["dense", "sparse"],
      "denseRank": 3,
      "sparseRank": 1
    }
  ],
  "fusionInfo": {
    "denseHits": 15,
    "sparseHits": 12,
    "overlapHits": 5,
    "fusedCount": 22
  }
}
```

### WebSocket事件

| 事件 | 说明 |
|------|------|
| `stage:start/complete` | Pipeline执行进度 |
| `retrieval:start/match/complete` | 检索过程可视化 |
| `generation:start/thinking/answer/complete` | LLM生成过程 |

---

## 🤖 MCP协议

可被Claude等AI助手直接调用：

```json
// Claude Desktop配置
{
  "mcpServers": {
    "rag": {
      "command": "node",
      "args": ["/path/to/dist/mcp/server.js"]
    }
  }
}
```

**工具列表**：
- `rag_query` - 查询文档库
- `rag_index` - 上传并索引文档

---

## 📈 变更历史

详见 `openspec/changes/archive/` 目录，15+次迭代：

| 时间 | 变更 | 核心内容 |
|------|------|----------|
| 04-09 | 基础架构 | 多模态PDF、语义分块、前端应用 |
| 04-10 | 能力增强 | 检索一致性、本地嵌入 |
| 04-13 | LLM集成 | DeepSeek思考链、可视化、UI现代化 |
| 04-14 | 图片PDF | OCR+VLM完整流程 |
| 04-15 | 持续迭代 | 流式优化、质量评估 |

---

## 📚 技术选型

| 需求 | 选择 | 原因 |
|------|------|------|
| PDF切分 | 断崖检测 | 上下文完整性 |
| 检索策略 | Small-to-Big | 精准+完整平衡 |
| OCR引擎 | PaddleOCR | 中文+版面分析 |
| VLM服务 | qwen3-vl-flash | 国内稳定+速度快 |
| LLM服务 | DeepSeek | 思考链支持 |
| 嵌入模型 | 本地Transformers | 无成本+离线 |

---

## 📖 详细文档

- [`docs/interview-qa.md`](docs/interview-qa.md) - 面试技术问答话术
- [`docs/architecture-diagrams.md`](docs/architecture-diagrams.md) - 详细架构图
- [`docs/image-pdf-config.md`](docs/image-pdf-config.md) - 图片PDF配置
- [`docs/enhanced-retrieval.md`](docs/enhanced-retrieval.md) - 增强检索详细文档
- [`docs/retrieval-config.md`](docs/retrieval-config.md) - 检索配置说明

---

## License

MIT