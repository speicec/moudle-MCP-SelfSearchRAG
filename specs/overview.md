# RAG MCP Server 总览规格 (Overview Spec)

> 此文档为项目总览，供任何 Agent 理解项目全貌并继续开发。

## 项目定位

**名称**: RAG MCP Server (检索增强生成 MCP 服务器)

**核心公式**: `Model + Harness = Agent`

**工程范式**: Spec 文档驱动 + Harness 工程

**目标**: 构建生产级、可插拔、可观测、可追踪的 RAG MCP Server

---

## 核心特性

| 特性 | 描述 | Spec文档 |
|------|------|----------|
| **多模态支持** | 文本、代码、图片、音频 | [multimodal.md](multimodal.md) |
| **混合检索** | 向量+全文+代码+语义 | [architecture.md](architecture.md) |
| **离线搜索** | 本地缓存+离线索引 | [offline-search.md](offline-search.md) |
| **重排精排** | 召回→粗排→精排→重排 | [reranker.md](reranker.md) |
| **可插拔架构** | 插件系统+组件热插拔 | [architecture.md](architecture.md) |
| **Harness 规范** | 可控、可预测、可追踪 | [harness.md](harness.md) |
| **评估体系** | LlamaIndex Eval + 回归测试 | [evaluation.md](evaluation.md) |

---

## 架构总览

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           MCP Server Layer                                    │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │   Tools     │  │  Resources  │  │   Prompts   │  │  Observability│        │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘         │
└─────────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Harness Layer                                      │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐          │
│  │ 工具集    │ │ 约束规则 │ │ 反馈回路 │ │ 上下文管理│ │ 流程编排 │          │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘          │
│  ┌──────────────────────────────────────────────────────────────────┐      │
│  │                        Plugin System                              │      │
│  │  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐         │      │
│  │  │Embedder│ │Chunker │ │Retriever│ │Reranker│ │Evaluator│        │      │
│  │  └────────┘ └────────┘ └────────┘ └────────┘ └────────┘         │      │
│  └──────────────────────────────────────────────────────────────────┘      │
└─────────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Retrieval Pipeline                                  │
│                                                                              │
│  ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐   │
│  │  Query  │ →  │ Recall  │ →  │  Rerank │ →  │  Filter │ →  │  Result │   │
│  │ Parse   │    │(多路召回)│    │ (精排)  │    │ (过滤)  │    │  Fusion │   │
│  └─────────┘    └─────────┘    └─────────┘    └─────────┘    └─────────┘   │
│                                                                              │
│  Recall Paths:                                                               │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐           │
│  │ Vector Search│ │ Fulltext FTS│ │ Code AST    │ │ Offline Cache│           │
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘           │
└─────────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Storage Layer                                      │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │   Milvus    │  │   SQLite    │  │  FileStore  │  │ OfflineCache │        │
│  │  (向量)     │  │  (元数据+FTS)│  │  (文档)     │  │  (离线索引)  │        │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                          │
│  │  MultiModal │  │  Metrics    │  │   Plugins   │                          │
│  │  Store      │  │  Store      │  │   Registry   │                          │
│  └─────────────┘  └─────────────┘  └─────────────┘                          │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 项目节点规划 (A/B/C/D)

### Node A: 基础架构 (Foundation)
**目标**: 建立项目骨架和核心基础设施

**关键交付**:
- [ ] A.1 项目初始化 (package.json, tsconfig.json, 目录结构)
- [ ] A.2 存储层实现 (Milvus, SQLite, FileStore)
- [ ] A.3 插件系统框架 (PluginRegistry, PluginInterface)
- [ ] A.4 Harness 基础组件 (工具集, 约束规则)
- [ ] A.5 单元测试框架 (Vitest, 测试目录)

**验收标准**:
- 项目可编译
- 插件系统可加载/卸载插件
- 基础测试通过
- Harness 约束生效

**人工确认**: ✅ Node A 完成确认

---

### Node B: 检索引擎 (Retrieval Engine)
**目标**: 实现完整的检索管道

**关键交付**:
- [ ] B.1 文档处理器 (分块器, 多模态处理器)
- [ ] B.2 Embedding 插件 (本地/API, 多模态支持)
- [ ] B.3 多路召回 (向量, 全文, 代码, 离线)
- [ ] B.4 重排精排 (Reranker 插件, 精排逻辑)
- [ ] B.5 结果融合 (RRF, 加权融合)
- [ ] B.6 离线搜索模式 (缓存, 本地索引)
- [ ] B.7 Harness 反馈回路 (质量指标, 自动调参)

**验收标准**:
- 检索管道可运行
- 多路召回正常工作
- 重排精排有效果提升
- 离线模式可用
- Harness 可追踪检索过程

**人工确认**: ✅ Node B 完成确认

---

### Node C: MCP Server (Server Layer)
**目标**: 实现 MCP 协议层

**关键交付**:
- [ ] C.1 MCP Tools 实现 (rag_index, rag_search, rag_delete, rag_status, rag_config)
- [ ] C.2 MCP Resources 实现 (docs, history, config, metrics)
- [ ] C.3 MCP Prompts 实现 (search-optimize, result-summary)
- [ ] C.4 Harness 观测审计 (日志, 链路追踪, 健康检查)
- [ ] C.5 Harness 流程编排 (智能索引流, 批量搜索流)
- [ ] C.6 配置系统 (JSON Schema, 环境变量)

**验收标准**:
- MCP Inspector 可连接
- 所有 Tools 正常工作
- Resources 可订阅
- 观测数据可采集
- 流程编排可执行

**人工确认**: ✅ Node C 完成确认

---

### Node D: 评估与生产化 (Evaluation & Production)
**目标**: 完成评估体系和生产部署

**关键交付**:
- [ ] D.1 LlamaIndex Evaluation 集成 (检索评估, 生成评估)
- [ ] D.2 回归测试套件 (性能基准, 功能回归)
- [ ] D.3 CI/CD 配置 (GitHub Actions, Dockerfile)
- [ ] D.4 文档完善 (README, API文档, 使用指南)
- [ ] D.5 性能优化 (缓存, 批处理, 并行)
- [ ] D.6 生产部署 (docker-compose, 监控配置)

**验收标准**:
- 评估指标达标 (Recall@10 > 80%, Latency < 500ms)
- CI/CD 流水线正常
- 文档完整
- 生产环境可部署
- 回归测试通过率 100%

**人工确认**: ✅ Node D 完成确认

---

## Spec 文档索引

| 文档 | 描述 | 状态 |
|------|------|------|
| [overview.md](overview.md) | 项目总览（本文档） | ✅ 完成 |
| [architecture.md](architecture.md) | 架构设计 | ✅ 完成 |
| [tools.md](tools.md) | MCP Tools 规格 | ✅ 完成 |
| [resources.md](resources.md) | MCP Resources 规格 | ✅ 完成 |
| [prompts.md](prompts.md) | MCP Prompts 规格 | ✅ 完成 |
| [harness.md](harness.md) | Harness 规格 | ✅ 完成 |
| [schedule.md](schedule.md) | 开发排期 (A/B/C/D节点) | ✅ 完成 |
| [multimodal.md](multimodal.md) | 多模态规格 | ✅ 完成 |
| [reranker.md](reranker.md) | 重排精排规格 | ✅ 完成 |
| [offline-search.md](offline-search.md) | 离线搜索规格 | ✅ 完成 |
| [evaluation.md](evaluation.md) | 评估体系规格 | ✅ 完成 |
| [plugin-system.md](plugin-system.md) | 插件系统规格 | ✅ 完成 |
| [query-layer.md](query-layer.md) | 查询层详细规格 (多查询分解/退步提示/路由/自反思) | ✅ 完成 |
| [chunking-layer.md](chunking-layer.md) | 切分层详细规格 (动态语义切分/文本增强) | ✅ 完成 |
| [directory-structure.md](directory-structure.md) | 目录结构规格 (层间解耦/模块化) | ✅ 完成 |
| [long-tail-query.md](long-tail-query.md) | 长尾查询优化规格 (速度/Token优化) | ✅ 完成 |

---

## Agent 继续开发指南

### 如何使用此文档

1. **阅读总览**: 理解项目目标和架构
2. **查看排期**: 确定当前所在节点和任务
3. **阅读相关 Spec**: 理解具体实现要求
4. **执行任务**: 按照 Spec 实现代码
5. **验收确认**: 完成后等待人工确认

### 关键原则

1. **Harness 规范**: 每一步都必须可控、可预测、可追踪
2. **Spec 驱动**: 先读 Spec，再写代码
3. **节点确认**: 每个节点完成后需人工确认才能继续
4. **可插拔**: 所有组件必须支持插件替换
5. **评估驱动**: 实现必须能通过评估验证

### 当前状态

**阶段**: Node A (基础架构)
**状态**: 未开始
**下一步**: 创建项目配置文件 (A.1)

---

## 技术栈

| 类别 | 技术 | 版本 |
|------|------|------|
| 语言 | TypeScript | 5.x |
| 运行时 | Node.js | 20.x |
| MCP SDK | @modelcontextprotocol/sdk | latest |
| 向量库 | Milvus | 2.x |
| 元数据 | SQLite (better-sqlite3) | 11.x |
| 测试 | Vitest | latest |
| 评估 | LlamaIndex Eval | latest |
| 容器 | Docker + docker-compose | latest |
| CI | GitHub Actions | - |

---

## 联系与协作

此项目采用 Spec 文档驱动 + Harness 工程范式，任何 Agent 可通过阅读此总览文档理解项目并继续开发。

**重要**: 每个节点完成后需要人工确认，确保工程质量。