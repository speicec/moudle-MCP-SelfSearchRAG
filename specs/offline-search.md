# 离线搜索规格 (Offline Search Spec)

## 概述

支持无网络或低延迟场景下的离线搜索模式，使用本地缓存和离线索引。

## 使用场景

| 场景 | 描述 | 方案 |
|------|------|------|
| **无网络** | 完全离线环境 | 本地向量索引 + 本地全文索引 |
| **低延迟** | 需要极速响应 | 内存缓存 + SSD索引 |
| **隐私场景** | 数据不离开本地 | 本地 Embedding + 本地存储 |
| **移动端** | 资源受限设备 | 轻量索引 + 按需同步 |

## 离线模式架构

```
┌─────────────────────────────────────────────────────────────┐
│                    Online Mode (联网)                        │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐      │
│  │ Milvus      │    │ API Embedder│    │ Cloud Sync  │      │
│  │ (远程向量库) │    │ (远程API)   │    │ (云端同步)   │      │
│  └─────────────┘    └─────────────┘    └─────────────┘      │
└─────────────────────────────────────────────────────────────┘
                            ↕ 同步
┌─────────────────────────────────────────────────────────────┐
│                    Offline Mode (离线)                       │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐      │
│  │ Local Index │    │ Local Embed │    │ Cache Store │      │
│  │ (本地向量库) │    │ (本地模型)   │    │ (结果缓存)   │      │
│  └─────────────┘    └─────────────┘    └─────────────┘      │
│  ┌─────────────┐    ┌─────────────┐                         │
│  │ SQLite FTS  │    │ Memory Cache│                         │
│  │ (全文索引)   │    │ (热数据缓存) │                         │
│  └─────────────┘    └─────────────┘                         │
└─────────────────────────────────────────────────────────────┘
```

## 数据结构

```typescript
// 离线模式状态
interface OfflineState {
  mode: 'online' | 'offline' | 'hybrid';
  lastSync: Date;
  cacheSize: number;
  indexSize: number;
  pendingChanges: ChangeLog[];
}

// 同步日志
interface SyncLog {
  id: string;
  timestamp: Date;
  type: 'full' | 'incremental' | 'delta';
  status: 'success' | 'partial' | 'failed';
  stats: {
    docsSynced: number;
    chunksSynced: number;
    bytesTransferred: number;
  };
}

// 变更日志
interface ChangeLog {
  id: string;
  type: 'index' | 'delete' | 'update';
  docId: string;
  timestamp: Date;
  synced: boolean;
}
```

## 本地向量索引

```typescript
// 本地向量索引接口
interface LocalVectorIndex {
  // 索引操作
  build(documents: Document[]): Promise<void>;
  add(chunk: Chunk): Promise<void>;
  remove(chunkId: string): Promise<void>;

  // 搜索
  search(queryVector: number[], topK: number): Promise<SearchResult[]>;

  // 存储
  save(path: string): Promise<void>;
  load(path: string): Promise<void>;

  // 状态
  size: number;
  dimensions: number;
}

// HNSW 本地索引（推荐）
interface HNSWLocalIndex extends LocalVectorIndex {
  config: {
    M: number;              // 连接数
    efConstruction: number; // 构建参数
    efSearch: number;       // 搜索参数
  };
}

// sqlite-vec 本地索引（轻量）
interface SQLiteVecIndex extends LocalVectorIndex {
  dbPath: string;
}
```

## 本地 Embedding

```typescript
// 本地 Embedding 模型接口
interface LocalEmbedder extends Plugin {
  // 模型信息
  modelPath: string;
  dimensions: number;

  // Embedding
  embed(text: string): Promise<number[]>;
  embedBatch(texts: string[]): Promise<number[][]>;

  // 模型加载
  load(): Promise<void>;
  unload(): Promise<void>;

  // 状态
  loaded: boolean;
  memoryUsage: number;
}

// ONNX Runtime 本地模型
interface ONNXEmbedder extends LocalEmbedder {
  runtime: 'onnx';
  modelFile: string;
}

// sentence-transformers 本地模型
interface SentenceTransformerEmbedder extends LocalEmbedder {
  model: string;  // 如 'all-MiniLM-L6-v2'
  device: 'cpu' | 'cuda';
}
```

## 缓存系统

```typescript
// 结果缓存
interface ResultCache {
  // 缓存操作
  get(query: string): CachedResult | null;
  set(query: string, result: SearchResult[]): Promise<void>;
  invalidate(docId: string): Promise<void>;

  // 缓存配置
  config: {
    maxSize: number;         // 最大缓存条数
    ttl: number;             // 过期时间（秒）
    strategy: 'lru' | 'lfu'; // 缓存策略
  };

  // 状态
  size: number;
  hitRate: number;
}

interface CachedResult {
  query: string;
  results: SearchResult[];
  timestamp: Date;
  hits: number;
}
```

## 同步机制

```typescript
// 同步管理器
interface SyncManager {
  // 同步操作
  fullSync(): Promise<SyncResult>;
  incrementalSync(): Promise<SyncResult>;
  deltaSync(): Promise<SyncResult>;

  // 配置
  config: {
    autoSync: boolean;
    syncInterval: number;    // 自动同步间隔（秒）
    syncOnConnect: boolean;  // 网络恢复时自动同步
    conflictResolution: 'server-wins' | 'local-wins' | 'merge';
  };

  // 状态
  pendingChanges: ChangeLog[];
  lastSync: Date;
}

// 同步流程
async function syncOfflineToOnline(): Promise<void> {
  // 1. 检查网络状态
  if (!isOnline()) {
    log('offline, sync deferred');
    return;
  }

  // 2. 上传本地变更
  const pending = await getPendingChanges();
  for (const change of pending) {
    await syncChange(change);
  }

  // 3. 下载远程更新
  const remoteUpdates = await fetchRemoteUpdates(lastSync);
  await applyRemoteUpdates(remoteUpdates);

  // 4. 更新状态
  await clearPendingChanges();
  await updateLastSync();

  log('sync completed');
}
```

## MCP Tool 接口

```typescript
// rag_search 支持 offline 模式
interface SearchInput {
  query: string;
  topK?: number;

  // 模式选择
  mode?: 'online' | 'offline' | 'auto';

  // 离线配置
  offline?: {
    useCache: boolean;
    useLocalIndex: boolean;
    useLocalEmbedder: boolean;
    fallbackToOnline: boolean;  // 离线失败时回退
  };
}

// rag_config 离线设置
interface OfflineConfig {
  mode: 'online' | 'offline' | 'hybrid';

  localIndex: {
    type: 'hnsw' | 'sqlite-vec';
    path: string;
  };

  localEmbedder: {
    enabled: boolean;
    plugin: string;
    modelPath: string;
  };

  cache: {
    enabled: boolean;
    maxSize: number;
    ttl: number;
  };

  sync: {
    autoSync: boolean;
    interval: number;
  };
}

// rag_status 包含离线状态
interface StatusOutput {
  // ... 原有字段

  offline: {
    mode: string;
    localIndexSize: number;
    cacheSize: number;
    pendingChanges: number;
    lastSync: Date;
  };
}
```

## 离线检索路径

```typescript
// 离线召回路径
interface OfflineRecallPath extends RecallPath {
  name: 'offline';

  // 执行离线检索
  execute(query: ParsedQuery): Promise<RecallResult[]>;

  // 来源
  sources: ('local-vector' | 'local-fulltext' | 'cache')[];
}

// 离线检索流程
async function offlineSearch(query: string): Promise<SearchResult[]> {
  // 1. 检查缓存
  const cached = resultCache.get(query);
  if (cached) {
    return cached.results;
  }

  // 2. 本地 Embedding
  const queryVector = await localEmbedder.embed(query);

  // 3. 本地向量搜索
  const vectorResults = await localVectorIndex.search(queryVector, 20);

  // 4. 本地全文搜索
  const fulltextResults = await sqliteFTS.search(query, 20);

  // 5. 融合结果
  const merged = await fuseResults([vectorResults, fulltextResults]);

  // 6. 缓存结果
  resultCache.set(query, merged);

  return merged;
}
```

## 插件注册

```typescript
// 注册本地索引插件
pluginRegistry.register('index:hnsw-local', {
  type: 'vector-index',
  mode: 'offline',
  factory: () => new HNSWLocalIndex({
    M: 16,
    efConstruction: 200,
    efSearch: 50
  })
});

pluginRegistry.register('index:sqlite-vec', {
  type: 'vector-index',
  mode: 'offline',
  factory: () => new SQLiteVecIndex({
    dbPath: './data/local_vectors.db'
  })
});

// 注册本地 Embedder 插件
pluginRegistry.register('embedder:local-minilm', {
  type: 'embedder',
  mode: 'offline',
  dimensions: 384,
  factory: () => new ONNXEmbedder({
    modelPath: './models/all-MiniLM-L6-v2.onnx'
  })
});
```

## Harness 可预测

```typescript
// 离线模式状态预测
interface OfflinePredictability {
  // 可用性预测
  availability: {
    localIndexReady: boolean;
    localEmbedderReady: boolean;
    cacheAvailable: boolean;
  };

  // 性能预测
  performance: {
    estimatedLatency: number;   // 预估延迟
    memoryRequirement: number;  // 内存需求
    diskRequirement: number;    // 磁盘需求
  };

  // 数据一致性
  consistency: {
    staleDocs: number;          // 过期文档数
    lastSyncAge: number;        // 同步间隔
    syncRecommended: boolean;   // 建议同步
  };
}
```

## 验收标准

- [ ] 离线向量索引可构建和搜索
- [ ] 本地 Embedder 可加载和使用
- [ ] 结果缓存可命中和更新
- [ ] 网络恢复后自动同步
- [ ] 离线模式下检索正常工作
- [ ] 模式切换平滑（online/offline）
- [ ] 同步冲突正确处理
- [ ] 状态可预测和可追踪