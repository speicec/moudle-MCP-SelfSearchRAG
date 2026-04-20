## Why

当前向量存储架构存在三个核心问题：

### 问题 1: 暴力搜索性能瓶颈
`InMemoryVectorStore` 使用线性搜索（遍历所有向量计算 cosine similarity），当向量数量超过 5 万时，查询延迟急剧增加：
- 100,000 向量 → 38,400,000 次乘法运算 → 响应时间 100-500ms
- 无法支持大规模文档集（几千份多模态文档）

### 问题 2: 向量维度过低 + 单一检索模式
当前使用 `multilingual-e5-small`（384 维），仅 Dense 向量检索：
- 语义表达能力弱于更高维度模型
- **中文关键词召回差**：Dense 向量对精确关键词匹配不敏感
- 复杂查询、跨语言检索质量不够
- 无法利用 Hybrid Retrieval (Dense + Sparse) 的召回优势

### 问题 3: 元数据过滤缺失
当前 `HierarchicalStore` 的质量分数过滤、文档 ID 过滤都在内存中线性遍历实现，效率低下。专业向量数据库（如 Qdrant）支持 Filterable HNSW，可高效执行：
- `qualityScore >= 0.7`
- `documentId == "doc-123"`
- `pageNumber IN [1, 5, 10]`

### 问题 4: transformers.js 版本落后
当前使用 `@xenova/transformers` V2.17：
- 不支持 bge-m3 Hybrid 输出 (Dense + Sparse)
- API 与 V3/V4 不兼容
- 无法利用新版 Sparse 向量特性

## What Changes

### 1. 向量存储升级
- 废弃 `InMemoryVectorStore`
- 新增 `VectorStoreAdapter` 抽象接口
- 实现 `QdrantVectorStore`（HNSW + Sparse 双索引）
- 保留 `InMemoryVectorStoreAdapter` 用于本地测试

### 2. Hybrid Retrieval 架构
- **Dense + Sparse 双轨检索**
- bge-m3 模型同时输出 Dense (1024维) + Sparse (词权重)
- RRF (Reciprocal Rank Fusion) 融合算法
- 中文关键词召回提升: 0.65 → 0.85+

### 3. transformers.js 升级
- 从 `@xenova/transformers` V2.17 → `@huggingface/transformers` V3/V4
- 支持 bge-m3 Sparse 向量输出
- API 全面升级

### 4. 数据架构重构
- 抛弃旧数据（hierarchical-store.json）
- 双轨存储：Qdrant 存 Dense + Sparse 向量 + HierarchicalStore 存元数据
- 通过 chunk ID 关联

### 5. 检索流程优化
- `searchHybrid()` 替代 `searchSmallChunks()`
- Dense + Sparse 并行搜索 (Promise.all)
- RRF 融合排序
- `SmallToBigRetriever` 通过 ID 从 HierarchicalStore 获取完整内容

## Capabilities

### New Capabilities
- `qdrant-vector-store`: Qdrant 向量数据库集成，支持 HNSW + Sparse 双索引
- `hybrid-retrieval`: Dense + Sparse Hybrid Retrieval，RRF 融合
- `high-dimension-embedding`: bge-m3 Dense 1024 维 + Sparse 词权重

### Modified Capabilities
- `hierarchical-chunking`: 与 Qdrant 集成，元数据分离存储
- `small-to-big-retrieval`: 使用 HybridRetriever 替代线性搜索
- `multimodal-embedding`: 文本 Hybrid (Dense+Sparse) + 图像 Dense (512维)

## Impact

**新增文件：**
- `src/retrieval/vector-store-adapter.ts`: 抽象接口
- `src/retrieval/qdrant-client.ts`: Qdrant 实现 (Dense + Sparse)
- `src/retrieval/in-memory-adapter.ts`: 内存实现包装
- `src/retrieval/vector-store-factory.ts`: 工厂模式
- `src/retrieval/rrf-fusion.ts`: RRF 融合算法
- `src/retrieval/hybrid-retriever.ts`: Hybrid 检索器
- `src/embedding/hybrid-embedding-service.ts`: bge-m3 双输出
- `src/config/vector-db-config.ts`: 配置模块

**修改文件：**
- `src/retrieval/vector-store.ts`: 重构为适配器模式
- `src/embedding/local-embedding-service.ts`: 保留兼容，添加 Hybrid 路径
- `src/embedding/embedding-factory.ts`: 支持 HybridEmbeddingService
- `src/chunking/hierarchical-store.ts`: 移除向量存储，专注元数据
- `src/chunking/small-to-big-retriever.ts`: 使用 HybridRetriever
- `src/server/document-processor.ts`: 写入 Dense + Sparse 向量到 Qdrant
- `src/server/http-server.ts`: 初始化 HybridEmbedding + HybridRetriever + Qdrant
- `src/app.ts`: 配置向量存储类型 + Hybrid 模式

**环境变量：**
```bash
# 向量存储
VECTOR_STORE_TYPE=qdrant
QDRANT_URL=http://localhost:6333

# Hybrid 模式
HYBRID_RETRIEVAL_ENABLED=true
DENSE_MODEL=bge-m3
SPARSE_MIN_WEIGHT=0.01

# RRF 参数
RRF_K=60
RRF_DENSE_TOPK=50
RRF_SPARSE_TOPK=50
```

**数据迁移：**
- 删除旧数据文件：`data/store/hierarchical-store.json`
- 需重新上传所有文档进行重新处理

**依赖变更：**
- 新增: `@qdrant/js-client-rest`
- 升级: `@huggingface/transformers` (替代 `@xenova/transformers`)

**质量提升预估：**
| Metric | Baseline | Target |
|--------|----------|--------|
| 中文关键词召回 | 0.65 | 0.85+ |
| 语义召回 | 0.75 | 0.88+ |
| 混合召回 F1 | 0.70 | 0.90+ |
| 检索延迟 | 100-500ms | <30ms |