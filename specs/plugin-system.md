# 插件系统规格 (Plugin System Spec)

## 概述

全链路可插拔架构，所有核心组件支持插件替换和扩展。

## 插件类型

| 类型 | 描述 | 替换点 |
|------|------|--------|
| **Embedder** | 向量化组件 | 文本/代码/多模态 Embedding |
| **Chunker** | 分块组件 | 文档分块策略 |
| **Retriever** | 检索组件 | 检索算法和策略 |
| **Reranker** | 精排组件 | 精排算法 |
| **IndexStore** | 索引存储 | 向量存储后端 |
| **CacheStore** | 缓存存储 | 结果缓存后端 |
| **Evaluator** | 评估组件 | 评估算法 |

## 插件接口定义

```typescript
// 基础插件接口
interface Plugin {
  // 插件元信息
  meta: PluginMeta;

  // 生命周期
  init(config: PluginConfig): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;
  destroy(): Promise<void>;

  // 状态
  status: PluginStatus;
}

interface PluginMeta {
  name: string;              // 插件名称
  version: string;           // 版本号
  type: PluginType;          // 插件类型
  author?: string;
  description?: string;

  // 依赖
  dependencies?: string[];

  // 兼容性
  compatibleVersions: string[];  // 兼容的 core 版本
}

type PluginType =
  | 'embedder'
  | 'chunker'
  | 'retriever'
  | 'reranker'
  | 'index-store'
  | 'cache-store'
  | 'evaluator'
  | 'processor';

type PluginStatus = 'uninitialized' | 'initialized' | 'running' | 'stopped' | 'error';

interface PluginConfig {
  [key: string]: any;
}

// 插件定义（用于注册）
interface PluginDefinition {
  meta: PluginMeta;
  factory: PluginFactory;
  defaultConfig?: PluginConfig;
}

type PluginFactory = (config: PluginConfig) => Plugin;
```

## 各类型插件接口

### Embedder 插件

```typescript
interface EmbedderPlugin extends Plugin {
  type: 'embedder';

  // 能力声明
  capabilities: {
    modalities: ModalityType[];
    dimensions: Map<ModalityType, number>;
    batchSupport: boolean;
    streamingSupport: boolean;
  };

  // Embedding 方法
  embed(content: EmbedContent): Promise<number[]>;
  embedBatch(contents: EmbedContent[]): Promise<number[][]>;

  // 可选：流式 Embedding
  embedStream?(contents: AsyncIterable<EmbedContent>): AsyncIterable<number[]>;
}

interface EmbedContent {
  content: string;
  modality: ModalityType;
  metadata?: object;
}
```

### Chunker 插件

```typescript
interface ChunkerPlugin extends Plugin {
  type: 'chunker';

  // 能力声明
  capabilities: {
    supportedTypes: ('text' | 'code' | 'markdown')[];
    overlapSupport: boolean;
    adaptiveChunking: boolean;
  };

  // 分块方法
  chunk(document: Document): Promise<Chunk[]>;

  // 配置
  config: {
    maxChunkSize: number;
    minChunkSize: number;
    overlap: number;
    boundaries?: string[];  // 分块边界规则
  };
}
```

### Retriever 插件

```typescript
interface RetrieverPlugin extends Plugin {
  type: 'retriever';

  // 能力声明
  capabilities: {
    searchTypes: ('vector' | 'fulltext' | 'hybrid')[];
    filterSupport: boolean;
    offlineSupport: boolean;
  };

  // 检索方法
  search(query: SearchQuery): Promise<SearchResult[]>;

  // 索引操作（可选）
  index?(chunks: Chunk[]): Promise<void>;
  delete?(chunkIds: string[]): Promise<void>;
}

interface SearchQuery {
  vector?: number[];
  text?: string;
  filters?: SearchFilter[];
  topK: number;
}
```

### Reranker 插件

```typescript
interface RerankerPlugin extends Plugin {
  type: 'reranker';

  // 能力声明
  capabilities: {
    strategy: RerankStrategy;
    llmRequired: boolean;
    maxCandidates: number;
  };

  // 精排方法
  rerank(query: string, candidates: SearchResult[]): Promise<RerankedResult[]>;
}
```

### Index Store 插件

```typescript
interface IndexStorePlugin extends Plugin {
  type: 'index-store';

  // 能力声明
  capabilities: {
    vectorSupport: boolean;
    fulltextSupport: boolean;
    offlineSupport: boolean;
    persistence: boolean;
  };

  // 向量操作
  insertVector?(id: string, vector: number[], metadata: object): Promise<void>;
  searchVector?(vector: number[], topK: number): Promise<VectorResult[]>;
  deleteVector?(id: string): Promise<void>;

  // 全文操作
  insertText?(id: string, text: string, metadata: object): Promise<void>;
  searchText?(query: string, topK: number): Promise<TextResult[]>;
  deleteText?(id: string): Promise<void>;

  // 批量操作
  batchInsert?(items: IndexItem[]): Promise<void>;
  batchDelete?(ids: string[]): Promise<void>;

  // 状态
  stats(): Promise<StoreStats>;
}
```

## 插件注册表

```typescript
// 插件注册表
interface PluginRegistry {
  // 注册插件
  register(definition: PluginDefinition): void;

  // 注销插件
  unregister(name: string): void;

  // 获取插件
  get(name: string): Plugin | null;
  getDefinition(name: string): PluginDefinition | null;

  // 按类型获取
  getByType(type: PluginType): Plugin[];

  // 列表
  list(): PluginDefinition[];
  listByType(type: PluginType): PluginDefinition[];

  // 加载插件
  load(path: string): Promise<void>;
  loadAll(paths: string[]): Promise<void>;

  // 状态
  status: RegistryStatus;
}

interface RegistryStatus {
  registered: number;
  loaded: number;
  active: number;
  errors: PluginError[];
}

// 全局注册表实例
const pluginRegistry: PluginRegistry = new PluginRegistry();
```

## 插件加载机制

```typescript
// 插件加载器
interface PluginLoader {
  // 从文件加载
  loadFromFile(path: string): Promise<PluginDefinition>;

  // 从目录加载
  loadFromDirectory(dir: string): Promise<PluginDefinition[]>;

  // 从 npm 包加载
  loadFromNpm(packageName: string): Promise<PluginDefinition>;

  // 验证插件
  validate(definition: PluginDefinition): ValidationResult;
}

// 插件文件结构
// plugins/my-embedder/
//   ├── manifest.json    # 插件元信息
//   ├── index.js         # 插件实现
//   ├── config.schema.json # 配置 Schema
//   └── README.md        # 插件文档

interface PluginManifest {
  meta: PluginMeta;
  main: string;            # 入口文件
  configSchema?: string;   # 配置 Schema 文件
  defaultConfig?: object;
}
```

## 插件配置

```typescript
// 插件配置管理
interface PluginConfigManager {
  // 配置 Schema
  getSchema(pluginName: string): JSONSchema;

  // 验证配置
  validateConfig(pluginName: string, config: object): ValidationResult;

  // 获取/设置配置
  getConfig(pluginName: string): object;
  setConfig(pluginName: string, config: object): void;

  // 配置热更新
  hotReload(pluginName: string, config: object): Promise<void>;
}

// JSON Schema 配置验证
const embedderConfigSchema: JSONSchema = {
  type: 'object',
  properties: {
    model: { type: 'string', default: 'all-MiniLM-L6-v2' },
    dimensions: { type: 'number', default: 384 },
    batchSize: { type: 'number', default: 32 }
  },
  required: ['model']
};
```

## 插件生命周期

```
┌─────────────┐
│ Register    │  注册到 Registry
└─────────────┘
      ↓
┌─────────────┐
│ Initialize  │  初始化（加载配置）
└─────────────┘
      ↓
┌─────────────┐
│ Start       │  启动（开始工作）
└─────────────┘
      ↓
┌─────────────┐    ┌─────────────┐
│ Running     │ ←→ │ Hot Reload  │  配置热更新
└─────────────┘    └─────────────┘
      ↓
┌─────────────┐
│ Stop        │  停止
└─────────────┘
      ↓
┌─────────────┐
│ Destroy     │  销毁
└─────────────┘
```

## 插件依赖管理

```typescript
// 插件依赖
interface PluginDependency {
  name: string;
  version?: string;        // 版本要求
  required: boolean;       // 是否必需
  config?: object;         // 依赖配置
}

// 依赖解析
interface DependencyResolver {
  resolve(plugin: PluginDefinition): Promise<ResolvedDependencies>;
  checkCircular(plugin: PluginDefinition): boolean;
  getLoadOrder(plugins: PluginDefinition[]): PluginDefinition[];
}

interface ResolvedDependencies {
  satisfied: Plugin[];
  missing: string[];
  conflicts: DependencyConflict[];
}
```

## 默认插件

```typescript
// 默认插件配置
const defaultPlugins: PluginDefinition[] = [
  // 默认文本 Embedder
  {
    meta: {
      name: 'embedder:default',
      version: '1.0.0',
      type: 'embedder',
      compatibleVersions: ['1.x']
    },
    factory: () => new DefaultTextEmbedder(),
    defaultConfig: { dimensions: 1536 }
  },

  // 默认分块器
  {
    meta: {
      name: 'chunker:default',
      version: '1.0.0',
      type: 'chunker'
    },
    factory: () => new DefaultChunker(),
    defaultConfig: { maxChunkSize: 512, overlap: 50 }
  },

  // 默认检索器
  {
    meta: {
      name: 'retriever:default',
      version: '1.0.0',
      type: 'retriever'
    },
    factory: () => new HybridRetriever(),
    defaultConfig: { vectorTopK: 20, fulltextTopK: 20 }
  },

  // 默认存储
  {
    meta: {
      name: 'store:milvus',
      version: '1.0.0',
      type: 'index-store'
    },
    factory: () => new MilvusStore(),
    defaultConfig: { host: 'localhost', port: 19530 }
  }
];
```

## MCP Tool 接口

```typescript
// rag_plugin Tools
interface PluginTools {
  // rag_plugin_list: 列出插件
  rag_plugin_list(input: { type?: PluginType }): Promise<PluginDefinition[]>;

  // rag_plugin_info: 插件详情
  rag_plugin_info(input: { name: string }): Promise<PluginInfo>;

  // rag_plugin_config: 配置插件
  rag_plugin_config(input: {
    name: string;
    action: 'get' | 'set' | 'reload';
    config?: object;
  }): Promise<PluginConfigResult>;

  // rag_plugin_load: 加载插件
  rag_plugin_load(input: { path: string }): Promise<LoadResult>;

  // rag_plugin_switch: 切换插件
  rag_plugin_switch(input: {
    type: PluginType;
    from?: string;
    to: string;
  }): Promise<SwitchResult>;

  // rag_plugin_unload: 卸载插件
  rag_plugin_unload(input: { name: string }): Promise<void>;
}

interface PluginInfo {
  definition: PluginDefinition;
  status: PluginStatus;
  config: object;
  stats?: object;
  errors?: PluginError[];
}
```

## Harness 可控插件

```typescript
// 插件约束规则
interface PluginConstraint {
  // 插件加载约束
  allowlist?: string[];      // 允许的插件列表
  blocklist?: string[];      // 禁止的插件列表

  // 资源约束
  maxMemoryPerPlugin: number;
  maxPluginsPerType: number;

  // 安全约束
  requireSignature: boolean; // 要求插件签名验证
  sandboxMode: boolean;      // 插件沙箱运行
}

// 插件监控
interface PluginObservability {
  // 指标收集
  collectMetrics(plugin: Plugin): PluginMetrics;

  // 健康检查
  healthCheck(plugin: Plugin): HealthStatus;

  // 错误追踪
  trackError(plugin: Plugin, error: Error): void;
}

interface PluginMetrics {
  name: string;
  type: PluginType;
  calls: number;
  errors: number;
  avgLatency: number;
  memoryUsage: number;
  lastCall: Date;
}
```

## 验收标准

- [ ] 插件接口定义完整（至少6种类型）
- [ ] 插件注册表可注册/注销/获取
- [ ] 插件可从文件和目录加载
- [ ] 插件配置可验证和热更新
- [ ] 插件生命周期正确管理
- [ ] 插件依赖可解析和加载
- [ ] MCP Tools 可管理插件
- [ ] Harness 约束可限制插件
- [ ] 默认插件可正常工作
- [ ] 插件可实时切换替换