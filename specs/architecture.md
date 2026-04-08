# RAG MCP Server 架构规格文档

## 背景

构建一个基于 Harness 工程范式的 RAG（检索增强生成）MCP Server。核心理念：`Model + Harness = Agent`，为 LLM Agent 构建完整运行环境。

## 目标

- 提供 MCP 协议兼容的服务器，支持 Claude Code 等 AI 工具集成
- 实现混合检索（向量+全文+代码），提升检索准确性
- 采用 Harness 范式设计：工具集、约束规则、反馈回路、上下文管理、观测审计、流程编排

## 输入

| 来源 | 数据 | 格式 |
|------|------|------|
| MCP Client | 索引请求 | `{ path: string, recursive?: boolean }` |
| MCP Client | 检索请求 | `{ query: string, top_k?: number, mode?: string }` |
| MCP Client | 删除请求 | `{ doc_id: string }` |
| 用户 | 配置 | `config.json` |

## 输出

| 目标 | 数据 | 格式 |
|------|------|------|
| MCP Client | 检索结果 | `{ results: SearchResult[] }` |
| MCP Client | 状态信息 | `{ indexed: number, storage: string }` |
| MCP Client | 错误信息 | `{ error: string, code: number }` |

## 约束

- 必须兼容 MCP 协议规范
- 向量数据库使用 Milvus
- 支持自定义/本地 Embedding 模型
- TypeScript + Node.js 实现
- 单进程运行，无外部 Web 服务依赖（除 Milvus）

## 数据结构

### 核心模型

```typescript
// 文档
interface Document {
  id: string;           // UUID
  path: string;         // 文件路径
  content: string;      // 原始内容
  chunks: Chunk[];      // 分块
  metadata: DocMeta;    // 元数据
  indexedAt: Date;      // 索引时间
}

// 分块
interface Chunk {
  id: string;
  docId: string;
  content: string;
  embedding?: number[]; // 向量
  position: { start: number; end: number };
  type: 'text' | 'code';
}

// 检索结果
interface SearchResult {
  chunkId: string;
  docId: string;
  content: string;
  score: number;
  source: string;
  metadata: DocMeta;
}

// 文档元数据
interface DocMeta {
  filename: string;
  extension: string;
  language?: string;    // 代码语言
  size: number;
  createdAt: Date;
  modifiedAt: Date;
}
```

### 向量存储结构（Milvus Collection）

```typescript
interface VectorRecord {
  id: string;           // chunkId
  doc_id: string;       // docId
  embedding: number[];  // 1536维（可配置）
  content: string;      // 分块内容
  source: string;       // 文件路径
  type: string;         // 'text' | 'code'
  language: string;     // 代码语言
}
```

## 接口定义

### MCP Tools

| Tool | 描述 | 输入 | 输出 |
|------|------|------|------|
| `rag_index` | 索引文档 | `{ path, recursive }` | `{ indexed: number, errors: string[] }` |
| `rag_search` | 混合检索 | `{ query, top_k, mode }` | `{ results: SearchResult[] }` |
| `rag_delete` | 删除文档 | `{ doc_id }` | `{ deleted: boolean }` |
| `rag_status` | 查询状态 | `{}` | `{ indexed, storage, health }` |
| `rag_config` | 配置管理 | `{ key, value }` | `{ config: object }` |

### MCP Resources

| Resource | 描述 | URI |
|----------|------|-----|
| `indexed-docs` | 已索引文档列表 | `rag://docs` |
| `search-history` | 检索历史 | `rag://history` |
| `config` | 当前配置 | `rag://config` |

### MCP Prompts

| Prompt | 描述 | 参数 |
|--------|------|------|
| `rag-search-prompt` | 生成检索优化提示 | `{ query }` |
| `rag-summary-prompt` | 生成结果摘要提示 | `{ results }` |

## 流程

### 索引流程

```
输入文档路径
  → 读取文件内容
  → 文档分块（按段落/代码块）
  → 调用 Embedding 服务
  → 存入 Milvus
  → 存入元数据数据库（SQLite）
  → 返回索引结果
```

### 检索流程

```
输入查询
  → 调用 Embedding 服务（查询向量）
  → 并行执行：
    │ → 向量检索（Milvus）
    │ → 全文检索（SQLite FTS）
    │ → 代码语义检索（可选）
  → 结果融合（RRF或加权）
  → 返回融合结果
```

## 验收标准

- [ ] MCP Server 可被 Claude Code 连接
- [ ] 支持 `rag_index` 工具索引指定目录
- [ ] 支持 `rag_search` 工具混合检索
- [ ] 支持 `rag_delete` 工具删除文档
- [ ] 支持 `rag_status` 工具查询状态
- [ ] 向量存储正确连接 Milvus
- [ ] 检索结果准确，融合算法有效
- [ ] 配置文件支持自定义 Embedding 服务