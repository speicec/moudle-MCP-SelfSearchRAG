## Phase 1: 基础架构（VectorStoreAdapter）

### 1. 接口定义
- [ ] 1.1 创建 `src/retrieval/vector-store-adapter.ts`
  - VectorStoreAdapter 接口
  - VectorPoint、SearchQuery、MetadataFilter 类型
  - CollectionConfig 类型
- [ ] 1.2 创建 `src/retrieval/in-memory-adapter.ts`
  - 包装现有 InMemoryVectorStore
  - 实现 VectorStoreAdapter 接口
- [ ] 1.3 创建 `src/retrieval/vector-store-factory.ts`
  - 工厂模式创建适配器
  - 支持 type: 'qdrant' | 'in-memory'

### 2. 配置模块
- [ ] 2.1 创建 `src/config/vector-db-config.ts`
  - VectorStoreConfig 类型
  - Qdrant 配置默认值
  - Embedding 维度常量
- [ ] 2.2 添加环境变量支持
  - VECTOR_STORE_TYPE
  - QDRANT_URL
  - QDRANT_API_KEY

---

## Phase 2: Qdrant 实现

### 3. Qdrant 客户端
- [ ] 3.1 安装依赖 `npm install @qdrant/js-client-rest`
- [ ] 3.2 创建 `src/retrieval/qdrant-client.ts`
  - QdrantVectorStore 类
  - initialize() - 创建 collections
  - shutdown() - 关闭连接
  - isReady() - 健康检查
- [ ] 3.3 实现 Collection 管理
  - createCollection() - 创建 text_chunks (Dense 1024维 + Sparse)
  - createCollection() - 创建 image_chunks (Dense 512维)
  - 配置 HNSW + Sparse Index 参数
- [ ] 3.4 实现向量操作
  - upsert() - 批量写入 Dense + Sparse 向量
  - delete() - 删除向量
  - deleteByFilter() - 按元数据批量删除
- [ ] 3.5 实现搜索功能
  - searchDense() - HNSW Dense 搜索
  - searchSparse() - Sparse Index 搜索
  - 元数据过滤构建 (FilterBuilder)
  - threshold 阈值过滤
- [ ] 3.6 实现统计功能
  - getStats() - collection 统计信息

---

## Phase 3: Hybrid Embedding 升级

### 4. transformers.js 升级
- [ ] 4.1 升级依赖 `npm install @huggingface/transformers`
  - 从 @xenova/transformers V2.17 升级到 V3/V4
  - 更新 package.json
- [ ] 4.2 创建 `src/embedding/hybrid-embedding-service.ts`
  - HybridEmbeddingResult 接口 (Dense + Sparse)
  - bge-m3 模型加载
  - return_sparse 参数支持
- [ ] 4.3 实现 Dense + Sparse 双输出
  - embedHybrid() - 单文本双输出
  - embedHybridBatch() - 批量双输出
  - Sparse 向量处理 (过滤低权重词)
- [ ] 4.4 更新模型配置
  - LOCAL_MODEL_CONFIGS 添加 bge-m3 (1024维 + Sparse)
  - 默认模型改为 bge-m3
  - 环境变量 HYBRID_RETRIEVAL_ENABLED
- [ ] 4.5 修改 `src/embedding/embedding-factory.ts`
  - 支持 HybridEmbeddingService 创建
  - 日志输出 Dense + Sparse 维度信息
- [ ] 4.6 兼容性处理
  - 保留 embedDense() 方法 (兼容旧 API)
  - 添加 fallback 路径 (仅 Dense)

---

## Phase 4: Hybrid Retrieval 实现

### 5. RRF Fusion 实现
- [ ] 5.1 创建 `src/retrieval/rrf-fusion.ts`
  - rrfFusion() 函数
  - FusionResult 类型
  - countOverlap() 重叠统计
- [ ] 5.2 创建 `src/retrieval/hybrid-retriever.ts`
  - HybridRetriever 类
  - searchHybrid() - 双路搜索 + 融合
  - searchDense() - 单 Dense 搜索 (兼容)
  - searchSparse() - 单 Sparse 搜索
- [ ] 5.3 实现并行搜索
  - Promise.all 并行执行 Dense + Sparse
  - Fallback 策略 (单路失败时)
  - 超时控制
- [ ] 5.4 HybridSearchResult 输出
  - fusionInfo 统计 (denseHits, sparseHits, overlapHits)
  - 来源标记 (sources: ['dense', 'sparse'])

---

## Phase 5: 集成修改

### 6. HierarchicalStore 修改
- [ ] 6.1 修改 `src/chunking/hierarchical-store.ts`
  - 移除 embedding 字段存储（向量存 Qdrant）
  - 保留 content, qualityScore, parentId 等元数据
  - 添加 chunkId 索引（用于关联）
- [ ] 6.2 修改 buildHierarchy()
  - 不存储向量到 Map
  - 只存储元数据
- [ ] 6.3 修改 JSON 持久化格式
  - 移除 embedding 数组（减小文件体积）

### 7. SmallToBigRetriever 修改
- [ ] 7.1 修改 `src/chunking/small-to-big-retriever.ts`
  - 添加 HybridRetriever 参数
  - searchSmallChunks() 改用 hybridRetriever.searchHybrid()
- [ ] 7.2 修改 retrieve() 流程
  - 先 Hybrid 搜索获取 chunkIds
  - 再从 HierarchicalStore 获取 content
- [ ] 7.3 修改 fallbackSearch()
  - 使用 hybridRetriever 而非内存遍历

### 8. DocumentProcessor 修改
- [ ] 8.1 修改 `src/server/document-processor.ts`
  - 添加 HybridEmbeddingService 参数
  - storeInHierarchical() 改为双轨写入
- [ ] 8.2 文本向量写入
  - QdrantAdapter.upsertHybrid('text_chunks', dense + sparse)
  - payload 包含 chunkId, documentId, qualityScore
- [ ] 8.3 图像向量写入
  - QdrantAdapter.upsert('image_chunks', dense only)
  - payload 包含 imageId, blockType, vlmText

### 9. HTTP Server 修改
- [ ] 9.1 修改 `src/server/http-server.ts`
  - 初始化 HybridEmbeddingService
  - 初始化 HybridRetriever
  - createCollection() 创建两个 collection
  - 检查连接健康
- [ ] 9.2 添加启动日志
  - 输出向量存储类型
  - 输出 Dense + Sparse 维度配置
  - 输出 Hybrid 模式状态
  - 输出 Qdrant 连接状态
- [ ] 9.3 添加 graceful shutdown
  - 关闭 Qdrant 连接

### 10. MCP Retrieval Service 修改
- [ ] 10.1 修改 `src/mcp/mcp-retrieval-service.ts`
  - 添加 HybridRetriever 参数
  - query() 使用 hybridRetriever 搜索

---

## Phase 6: 测试与验证

### 11. 测试
- [ ] 11.1 创建 `src/embedding/hybrid-embedding-service.test.ts`
  - Dense 向量维度验证 (1024)
  - Sparse 向量词权重验证
  - 低权重词过滤测试
  - 批量嵌入测试
- [ ] 11.2 创建 `src/retrieval/hybrid-retriever.test.ts`
  - RRF 融合正确性测试
  - 并行搜索测试
  - Fallback 测试 (单路失败)
  - 重叠统计测试
- [ ] 11.3 创建 `src/retrieval/qdrant-client.test.ts`
  - 连接测试
  - upsert/delete 测试 (Dense + Sparse)
  - searchDense/searchSparse 测试
  - filter 测试
- [ ] 11.4 创建 `src/retrieval/vector-store-factory.test.ts`
  - 工厂创建测试
  - fallback 测试
- [ ] 11.5 修改现有测试兼容新架构
  - hierarchical-store.test.ts（移除向量相关）
  - small-to-big-retriever.test.ts（使用 hybridRetriever mock）
- [ ] 11.6 构建: `npm run build`
- [ ] 11.7 测试: `npm run test`
- [ ] 11.8 端到端测试
  - 上传文档验证 Dense + Sparse 写入
  - Hybrid 搜索验证召回质量
  - 中文关键词匹配测试 (对比纯 Dense)
  - 元数据过滤验证

---

## Phase 7: 清理与文档

### 12. 清理旧代码
- [ ] 12.1 删除旧数据文件
  - 删除 `data/store/hierarchical-store.json`
  - 删除旧向量数据
- [ ] 12.2 移除废弃代码
  - 移除 InMemoryVectorStore 搜索逻辑
  - 移除向量线性遍历代码
  - 移除 @xenova/transformers V2.17 依赖
- [ ] 12.3 更新导入导出
  - src/retrieval/index.ts 导出新模块
  - src/embedding/index.ts 导出 Hybrid 模块

### 13. 文档
- [ ] 13.1 更新 README.md
  - 添加 Qdrant 部署说明
  - 添加 Hybrid Retrieval 说明
  - 添加环境变量说明
  - 添加 transformers.js V3/V4 升级说明
- [ ] 13.2 创建 docs/hybrid-retrieval.md
  - Dense + Sparse 架构说明
  - RRF Fusion 算法说明
  - 配置指南
  - 迁移指南
- [ ] 13.3 更新 API 文档
  - HybridSearchResult 格式
  - 环境变量列表