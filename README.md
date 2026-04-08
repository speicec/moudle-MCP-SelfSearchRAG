# RAG MCP Server

基于 Harness 工程范式的检索增强生成（RAG）MCP Server。

## 核心理念

`Model + Harness = Agent`

为 LLM Agent 构建完整运行环境：工具集、约束规则、反馈回路、上下文管理、观测审计、流程编排。

## 特性

- **多模态支持**: 文本、代码、图片、音频
- **混合检索**: 向量检索 + 全文检索 + 代码检索
- **智能分块**: 动态语义切分 + 文本增强
- **重排精排**: RRF融合 + 规则重排
- **可插拔架构**: 插件系统支持组件热插拔
- **Harness规范**: 可控、可预测、可追踪

## 快速开始

### 安装

```bash
npm install
```

### 开发

```bash
# 类型检查
npm run typecheck

# 构建
npm run build

# 测试
npm test

# 回归测试
npm run test:regression
```

### Docker 部署

```bash
# 启动所有服务
docker-compose up -d

# 查看日志
docker-compose logs -f rag-server
```

## MCP Tools

| Tool | 描述 |
|------|------|
| `rag_index` | 索引文档到向量库 |
| `rag_search` | 混合检索文档 |
| `rag_delete` | 删除已索引文档 |
| `rag_status` | 查询系统状态 |
| `rag_config` | 配置管理 |

## MCP Resources

| Resource | 描述 |
|----------|------|
| `rag://docs` | 已索引文档列表 |
| `rag://history` | 检索历史记录 |
| `rag://config` | 当前系统配置 |
| `rag://metrics` | 系统运行指标 |

## MCP Prompts

| Prompt | 描述 |
|--------|------|
| `search-optimize` | 优化检索查询 |
| `result-summary` | 汇总检索结果 |

## 架构

```
┌─────────────────────────────────────────────────────────────┐
│                    MCP Server Layer                          │
│  Tools  │  Resources  │  Prompts  │  Observability          │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                    Harness Layer                             │
│  工具集  │  约束规则  │  反馈回路  │  流程编排              │
│  上下文管理  │  观测审计  │  插件系统                        │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                    RAG Engine Layer                          │
│  Query Parse  │  Multi-path Recall  │  Rerank  │  Fusion   │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                    Storage Layer                             │
│  Milvus (向量)  │  SQLite (元数据+FTS)  │  Cache            │
└─────────────────────────────────────────────────────────────┘
```

## 配置

### 环境变量

```bash
# Milvus
MILVUS_HOST=localhost
MILVUS_PORT=19530
MILVUS_COLLECTION=rag_collection

# Embedding
EMBEDDING_PROVIDER=mock
EMBEDDING_MODEL=default
EMBEDDING_DIMENSION=384

# Chunking
CHUNK_SIZE=500
CHUNK_OVERLAP=50

# Search
SEARCH_TOP_K=10
```

## 项目结构

```
src/
├── types/          # Layer 0 - 类型定义
├── storage/        # Layer 1 - 存储层
├── plugins/        # Layer 1 - 插件系统
├── chunking/       # Layer 2 - 切分层
├── embedding/      # Layer 2 - Embedding
├── query/          # Layer 3 - 查询层
├── retrieval/      # Layer 4 - 检索层
├── evaluation/     # Layer 4 - 评估层
├── harness/        # Layer 5 - Harness
├── server/         # Layer 6 - MCP Server
└── config/         # 配置管理
```

## 开发节点

| Node | 描述 | 状态 |
|------|------|------|
| A | 基础架构 | ✅ 完成 |
| B | 检索引擎 | ✅ 完成 |
| C | MCP Server | ✅ 完成 |
| D | 评估与生产化 | ✅ 完成 |

## License

MIT