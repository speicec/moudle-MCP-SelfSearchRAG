# 目录结构规格 (Directory Structure Spec)

## 设计原则

**核心原则**：每一层只依赖上一层的输出作为输入，互相解耦，支持模块化开发。

### 层级依赖规则

```
Layer N 只依赖 Layer N-1 的输出
Layer N 不知道 Layer N+1 的存在
Layer 之间的接口是稳定的契约
```

## 目录结构

```
src/
├── index.ts                    # 入口，组装各层
│
├── types/                      # 【Layer 0】类型定义层
│   ├── index.ts               # 类型导出
│   ├── document.types.ts      # 文档类型
│   ├── chunk.types.ts         # 分块类型
│   ├── query.types.ts         # 查询类型
│   ├── result.types.ts        # 结果类型
│   ├── config.types.ts        # 配置类型
│   └── plugin.types.ts        # 插件类型
│
├── storage/                    # 【Layer 1】存储层
│   ├── index.ts               # 存储层导出
│   ├── interface.ts           # 存储接口定义
│   ├── milvus/                # Milvus向量存储
│   │   ├── index.ts
│   │   ├── client.ts          # 连接管理
│   │   ├── collection.ts      # Collection操作
│   │   └── search.ts          # 向量搜索
│   ├── sqlite/                # SQLite元数据+全文索引
│   │   ├── index.ts
│   │   ├── client.ts          # 连接管理
│   │   ├── metadata.ts        # 元数据操作
│   │   └── fts.ts             # 全文索引
│   ├── filestore/             # 文件存储
│   │   ├── index.ts
│   │   └── manager.ts
│   └── cache/                 # 缓存存储
│       ├── index.ts
│       ├── memory.ts          # 内存缓存
│       └── disk.ts            # 磁盘缓存
│
├── plugins/                    # 【Layer 1】插件系统
│   ├── index.ts               # 插件系统导出
│   ├── interface.ts           # 插件接口定义
│   ├── registry.ts            # 插件注册表
│   ├── loader.ts              # 插件加载器
│   └── builtin/               # 内置插件
│       ├── embedders/         # Embedder插件
│       │   ├── index.ts
│       │   ├── api-embedder.ts
│       │   └── local-embedder.ts
│       ├── chunkers/          # Chunker插件
│       │   ├── index.ts
│       │   ├── text-chunker.ts
│       │   ├── code-chunker.ts
│       │   └── semantic-chunker.ts
│       ├── retrievers/        # Retriever插件
│       │   ├── index.ts
│       │   ├── vector-retriever.ts
│       │   ├── fulltext-retriever.ts
│       │   └── code-retriever.ts
│       ├── rerankers/         # Reranker插件
│       │   ├── index.ts
│       │   ├── cross-encoder.ts
│       │   └── rule-based.ts
│       └── evaluators/        # Evaluator插件
│           └── index.ts
│
├── chunking/                   # 【Layer 2】切分层
│   ├── index.ts               # 切分层导出
│   ├── interface.ts           # 切分接口定义
│   ├── analyzer.ts            # 文档分析器
│   ├── splitters/             # 切分器实现
│   │   ├── fixed-size.ts
│   │   ├── semantic.ts
│   │   ├── recursive.ts
│   │   ├── ast.ts
│   │   └── multi-granularity.ts
│   ├── enhancer.ts            # 文本增强器
│   ├── overlap.ts             # 重叠计算器
│   └── validator.ts           # 分块验证器
│
├── embedding/                  # 【Layer 2】Embedding层
│   ├── index.ts
│   ├── interface.ts           # Embedding接口
│   ├── pipeline.ts            # Embedding管道
│   └── batch.ts               # 批量处理
│
├── query/                      # 【Layer 3】查询层
│   ├── index.ts               # 查询层导出
│   ├── interface.ts           # 查询接口定义
│   ├── parser.ts              # 查询解析器
│   ├── router.ts              # 查询路由器
│   ├── decomposer.ts          # 查询分解器
│   ├── stepback.ts            # 退步提示器
│   ├── expander.ts            # 查询扩展器
│   ├── reflector.ts           # 自反思器
│   └── fusion.ts              # 查询融合器
│
├── retrieval/                  # 【Layer 4】检索层
│   ├── index.ts               # 检索层导出
│   ├── interface.ts           # 检索接口定义
│   ├── pipeline.ts            # 检索管道
│   ├── recall/                # 召回模块
│   │   ├── index.ts
│   │   ├── vector-recall.ts   # 向量召回
│   │   ├── fulltext-recall.ts # 全文召回
│   │   ├── code-recall.ts     # 代码召回
│   │   └── offline-recall.ts  # 离线召回
│   ├── rerank/                # 重排模块
│   │   ├── index.ts
│   │   ├── pipeline.ts        # 重排管道
│   │   └── strategies/        # 重排策略
│   ├── filter/                # 过滤模块
│   │   ├── index.ts
│   │   └── rules.ts
│   └── result/                # 结果处理
│       ├── index.ts
│       ├── merger.ts          # 结果合并
│       └── formatter.ts       # 结果格式化
│
├── evaluation/                 # 【Layer 4】评估层
│   ├── index.ts
│   ├── interface.ts
│   ├── retrieval-eval.ts      # 检索评估
│   ├── generation-eval.ts     # 生成评估
│   └── benchmark.ts           # 性能基准
│
├── harness/                    # 【Layer 5】Harness层
│   ├── index.ts               # Harness导出
│   ├── interface.ts           # Harness接口
│   ├── toolset.ts             # 工具集管理
│   ├── constraints/           # 约束规则
│   │   ├── index.ts
│   │   ├── engine.ts          # 规则引擎
│   │   └── rules/             # 预定义规则
│   ├── feedback.ts            # 反馈回路
│   ├── context.ts             # 上下文管理
│   ├── observability/         # 观测审计
│   │   ├── index.ts
│   │   ├── logger.ts          # 日志
│   │   ├── tracer.ts          # 链路追踪
│   │   └── metrics.ts         # 指标收集
│   └── orchestration/         # 流程编排
│       ├── index.ts
│       ├── engine.ts          # 编排引擎
│       └── flows/             # 预定义流程
│
├── server/                     # 【Layer 6】MCP Server层
│   ├── index.ts               # 服务器入口
│   ├── server.ts              # MCP服务器
│   ├── tools/                 # MCP Tools
│   │   ├── index.ts
│   │   ├── rag-index.ts
│   │   ├── rag-search.ts
│   │   ├── rag-delete.ts
│   │   ├── rag-status.ts
│   │   ├── rag-config.ts
│   │   └── rag-eval.ts
│   ├── resources/             # MCP Resources
│   │   ├── index.ts
│   │   ├── docs-resource.ts
│   │   ├── history-resource.ts
│   │   ├── config-resource.ts
│   │   └── metrics-resource.ts
│   └── prompts/               # MCP Prompts
│       ├── index.ts
│       ├── search-optimize.ts
│       └── result-summary.ts
│
├── config/                     # 配置管理
│   ├── index.ts
│   ├── schema.ts              # JSON Schema
│   ├── loader.ts              # 配置加载
│   └── default.ts             # 默认配置
│
└── utils/                      # 工具函数
    ├── index.ts
    ├── logger.ts
    ├── validator.ts
    └── helpers.ts
```

---

## 层级接口定义

### Layer 0: Types (类型层)

**职责**: 定义所有数据结构和接口契约

```typescript
// types/index.ts
export * from './document.types';
export * from './chunk.types';
export * from './query.types';
export * from './result.types';
export * from './config.types';
export * from './plugin.types';

// types/document.types.ts
export interface Document {
  id: string;
  path: string;
  content: string;
  metadata: DocumentMetadata;
}

export interface DocumentMetadata {
  filename: string;
  extension: string;
  size: number;
  createdAt: Date;
  modifiedAt: Date;
}

// types/chunk.types.ts
export interface Chunk {
  id: string;
  docId: string;
  content: string;
  position: ChunkPosition;
  metadata: ChunkMetadata;
}

export interface ChunkPosition {
  start: number;
  end: number;
}

// 类型层不依赖任何其他层
```

### Layer 1: Storage & Plugins (存储与插件层)

**职责**: 提供数据持久化和可插拔组件

**依赖**: Layer 0 (Types)

```typescript
// storage/interface.ts
import { Chunk, Document } from '../types';

export interface IVectorStore {
  insert(chunk: Chunk, embedding: number[]): Promise<void>;
  search(query: number[], topK: number): Promise<SearchResult[]>;
  delete(chunkId: string): Promise<void>;
}

export interface IMetadataStore {
  save(doc: Document): Promise<void>;
  get(docId: string): Promise<Document | null>;
  delete(docId: string): Promise<void>;
}

export interface IFullTextStore {
  index(chunk: Chunk): Promise<void>;
  search(query: string, topK: number): Promise<SearchResult[]>;
  delete(chunkId: string): Promise<void>;
}

// plugins/interface.ts
import { Plugin } from '../types';

export interface IPluginRegistry {
  register(definition: PluginDefinition): void;
  get(name: string): Plugin | null;
  getByType(type: PluginType): Plugin[];
}

// 存储层和插件层只依赖类型层
```

### Layer 2: Chunking & Embedding (切分与向量化层)

**职责**: 处理文档切分和向量化

**依赖**: Layer 0 (Types), Layer 1 (Plugins for Embedder)

```typescript
// chunking/interface.ts
import { Document, Chunk } from '../types';
import { IPluginRegistry } from '../plugins/interface';

export interface IChunker {
  chunk(document: Document): Promise<Chunk[]>;
}

export class ChunkingPipeline {
  constructor(
    private pluginRegistry: IPluginRegistry  // 依赖插件层获取Chunker插件
  ) {}

  async process(document: Document): Promise<Chunk[]> {
    const chunker = this.pluginRegistry.get('chunker:default') as IChunker;
    return chunker.chunk(document);
  }
}

// embedding/interface.ts
import { Chunk } from '../types';
import { IPluginRegistry } from '../plugins/interface';

export interface IEmbedder {
  embed(text: string): Promise<number[]>;
  embedBatch(texts: string[]): Promise<number[][]>;
}

export class EmbeddingPipeline {
  constructor(
    private pluginRegistry: IPluginRegistry  // 依赖插件层获取Embedder插件
  ) {}

  async process(chunks: Chunk[]): Promise<ChunkWithEmbedding[]> {
    const embedder = this.pluginRegistry.get('embedder:default') as IEmbedder;
    const embeddings = await embedder.embedBatch(chunks.map(c => c.content));
    return chunks.map((c, i) => ({ ...c, embedding: embeddings[i] }));
  }
}

// 切分层和Embedding层只依赖类型层和插件层
// 不依赖存储层（存储由上层决定）
```

### Layer 3: Query (查询层)

**职责**: 处理查询解析、分解、路由

**依赖**: Layer 0 (Types), Layer 2 (Embedding for Query Vector)

```typescript
// query/interface.ts
import { ParsedQuery, ExecutionQuery } from '../types';
import { IEmbedder } from '../embedding/interface';

export interface IQueryParser {
  parse(rawQuery: string): Promise<ParsedQuery>;
}

export interface IQueryRouter {
  route(parsed: ParsedQuery): Promise<RouteDecision>;
}

export class QueryPipeline {
  constructor(
    private parser: IQueryParser,
    private router: IQueryRouter,
    private embedder: IEmbedder  // 依赖Embedding层生成查询向量
  ) {}

  async process(rawQuery: string): Promise<ProcessedQuery> {
    const parsed = await this.parser.parse(rawQuery);
    const route = await this.router.route(parsed);
    // ...
  }
}

// 查询层只依赖类型层和Embedding层
// 不知道检索层的存在
```

### Layer 4: Retrieval & Evaluation (检索与评估层)

**职责**: 执行检索和评估

**依赖**: Layer 0-3 (Types, Storage, Chunking/Embedding, Query)

```typescript
// retrieval/interface.ts
import { ProcessedQuery, SearchResult } from '../types';
import { IVectorStore, IFullTextStore } from '../storage/interface';
import { IPluginRegistry } from '../plugins/interface';
import { ProcessedQuery } from '../query/interface';

export interface IRetriever {
  search(query: ProcessedQuery): Promise<SearchResult[]>;
}

export class RetrievalPipeline {
  constructor(
    private vectorStore: IVectorStore,      // 依赖存储层
    private fulltextStore: IFullTextStore,  // 依赖存储层
    private pluginRegistry: IPluginRegistry // 依赖插件层
  ) {}

  async search(query: ProcessedQuery): Promise<SearchResult[]> {
    // 1. 从插件获取Retriever
    const retriever = this.pluginRegistry.getByType('retriever');

    // 2. 执行多路召回
    const results = await Promise.all(
      retrievers.map(r => r.search(query))
    );

    // 3. 融合结果
    return this.fuse(results);
  }
}

// 检索层依赖存储层、插件层、查询层
// 但不知道Harness层和Server层
```

### Layer 5: Harness (Harness层)

**职责**: 提供约束、反馈、观测、编排

**依赖**: Layer 0-4 (所有下层)

```typescript
// harness/interface.ts
import { SearchResult, ProcessedQuery } from '../types';
import { RetrievalPipeline } from '../retrieval/interface';

export interface IConstraintEngine {
  check(input: any): ConstraintResult;
}

export interface IFeedbackLoop {
  collect(result: SearchResult[]): void;
}

export class HarnessPipeline {
  constructor(
    private retrieval: RetrievalPipeline,  // 依赖检索层
    private constraints: IConstraintEngine,
    private feedback: IFeedbackLoop
  ) {}

  async execute(query: ProcessedQuery): Promise<SearchResult[]> {
    // 1. 约束检查
    const constraintResult = this.constraints.check(query);
    if (!constraintResult.allowed) {
      throw new Error(constraintResult.message);
    }

    // 2. 执行检索
    const results = await this.retrieval.search(query);

    // 3. 收集反馈
    this.feedback.collect(results);

    return results;
  }
}

// Harness层依赖检索层
// 但不知道Server层
```

### Layer 6: Server (MCP Server层)

**职责**: 暴露MCP协议接口

**依赖**: Layer 0-5 (所有下层)

```typescript
// server/server.ts
import { HarnessPipeline } from '../harness/interface';
import { QueryPipeline } from '../query/interface';

export class MCPServer {
  constructor(
    private harness: HarnessPipeline,  // 依赖Harness层
    private query: QueryPipeline
  ) {}

  // MCP Tools 实现
  async ragSearch(input: SearchInput): Promise<SearchOutput> {
    // 1. 查询处理
    const processed = await this.query.process(input.query);

    // 2. 通过Harness执行
    const results = await this.harness.execute(processed);

    return { results };
  }
}

// Server层只依赖Harness层
// 不直接依赖检索层、存储层等
```

---

## 依赖关系图

```
┌─────────────────────────────────────────────────────────────────┐
│                     Layer 6: Server                              │
│                    (MCP Server Layer)                            │
└─────────────────────────────────────────────────────────────────┘
                              ↓ depends on
┌─────────────────────────────────────────────────────────────────┐
│                     Layer 5: Harness                             │
│              (约束, 反馈, 观测, 编排)                              │
└─────────────────────────────────────────────────────────────────┘
                              ↓ depends on
┌─────────────────────────────────────────────────────────────────┐
│               Layer 4: Retrieval & Evaluation                    │
│                  (检索, 评估)                                     │
└─────────────────────────────────────────────────────────────────┘
                              ↓ depends on
┌─────────────────────────────────────────────────────────────────┐
│              Layer 3: Query Layer                                │
│           (解析, 分解, 路由, 反思)                                 │
└─────────────────────────────────────────────────────────────────┘
                              ↓ depends on
┌─────────────────────────────────────────────────────────────────┐
│          Layer 2: Chunking & Embedding                           │
│              (切分, 向量化)                                       │
└─────────────────────────────────────────────────────────────────┘
                              ↓ depends on
┌─────────────────────────────────────────────────────────────────┐
│            Layer 1: Storage & Plugins                            │
│             (存储, 插件系统)                                       │
└─────────────────────────────────────────────────────────────────┘
                              ↓ depends on
┌─────────────────────────────────────────────────────────────────┐
│               Layer 0: Types                                     │
│               (类型定义)                                          │
└─────────────────────────────────────────────────────────────────┘
```

---

## 模块化开发规范

### 1. 接口隔离

每个模块只暴露必要的接口，内部实现细节隐藏：

```typescript
// ✅ 正确：只导出接口
export { IChunker } from './interface';
export { ChunkingPipeline } from './pipeline';

// ❌ 错误：导出内部实现
export { SemanticSplitter } from './splitters/semantic';
```

### 2. 依赖注入

通过构造函数注入依赖，而非硬编码：

```typescript
// ✅ 正确：依赖注入
class RetrievalPipeline {
  constructor(
    private vectorStore: IVectorStore,
    private fulltextStore: IFullTextStore
  ) {}
}

// ❌ 错误：硬编码依赖
class RetrievalPipeline {
  private vectorStore = new MilvusStore();  // 耦合具体实现
}
```

### 3. 单向依赖

只允许依赖下层，不允许反向依赖：

```typescript
// ✅ 正确：Retrieval层依赖Query层输出
const results = await retrieval.search(processedQuery);

// ❌ 错误：Query层不应该知道Retrieval层
const retrieval = new Retrieval();  // Query层不应该实例化Retrieval
```

### 4. 事件驱动

跨层通信使用事件，而非直接调用：

```typescript
// ✅ 正确：使用事件
eventBus.emit('chunk:created', chunk);
eventBus.on('chunk:created', (chunk) => embedding.embed(chunk));

// ❌ 错误：直接跨层调用
chunker.onChunkCreated((chunk) => embedder.embed(chunk));  // Chunker不应该知道Embedder
```

---

## 测试策略

### 单元测试

每层独立测试，使用 Mock 替代下层依赖：

```typescript
// chunking/__tests__/analyzer.test.ts
describe('DocumentAnalyzer', () => {
  it('should detect document type', async () => {
    const analyzer = new DocumentAnalyzer();
    const result = await analyzer.analyze(mockDocument);
    expect(result.docType).toBe('code');
  });
});
```

### 集成测试

测试层与层之间的交互：

```typescript
// tests/integration/retrieval.test.ts
describe('Retrieval Integration', () => {
  it('should search with query pipeline', async () => {
    const query = new QueryPipeline(mockEmbedder);
    const retrieval = new RetrievalPipeline(mockVectorStore, mockFulltextStore);

    const processed = await query.process('test query');
    const results = await retrieval.search(processed);

    expect(results.length).toBeGreaterThan(0);
  });
});
```

### E2E测试

测试完整流程：

```typescript
// tests/e2e/search.test.ts
describe('Search E2E', () => {
  it('should complete search flow', async () => {
    const server = new MCPServer(harness, query);
    const results = await server.ragSearch({ query: 'test' });
    expect(results.results).toBeDefined();
  });
});
```

---

## 验收标准

- [ ] 目录结构符合层级规范
- [ ] 每层只依赖直接下层
- [ ] 接口定义清晰，实现隐藏
- [ ] 依赖注入正确使用
- [ ] 无循环依赖
- [ ] 每层可独立测试
- [ ] 层与层之间通过接口通信
- [ ] 配置管理解耦
- [ ] 插件系统正确集成
- [ ] 入口组装正确