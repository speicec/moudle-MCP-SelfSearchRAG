## Why

当前系统依赖外部 API（如 OpenAI）进行文本 embedding，存在以下问题：
1. **API 成本**：需要付费的 API key，增加使用成本
2. **网络依赖**：需要稳定的网络连接，离线环境无法使用
3. **隐私问题**：文档内容需要发送到第三方服务
4. **DeepSeek 不支持 embedding**：用户使用的 DeepSeek API 不提供 embedding 功能

**关键需求差距**：
- **中英文支持**：用户文档包含中文和英文，原提案的 `all-MiniLM-L6-v2` 仅支持英文
- **多模态图片识别**：PDF 文档包含图片，需要跨模态检索能力
- **企业化方案**：需要健壮的模型管理、离线部署、错误处理

使用本地 transformers.js 模型可以解决以上所有问题，实现零成本、离线可用的语义检索。

## What Changes

- 新增本地文本 embedding 服务，使用 `multilingual-e5-small`（支持100+语言包括中英文）
- 新增多模态 embedding 服务，使用 `clip-vit-base-patch32`（图文跨模态检索）
- 支持多种预训练模型选择，用户可通过环境变量配置
- 自动下载并缓存模型，首次使用后可离线运行
- 替换现有的 mock embedding 实现，提供真正的语义相似度计算
- 保持 API 兼容，用户可选择本地或远程 embedding 服务

## Capabilities

### New Capabilities

- `local-text-embedding`: 本地文本 embedding 服务，使用 transformers.js 运行多语言预训练模型，支持中英文等100+语言
- `multimodal-embedding`: 多模态 embedding 服务，使用 CLIP 模型实现图文跨模态检索

### Modified Capabilities

- `small-to-big-retrieval`: 检索系统将使用本地 embedding 服务进行查询向量化，支持中英文和多模态检索

## Impact

**核心代码变更：**
- `src/embedding/local-embedding-service.ts`: 新建本地文本 embedding 服务
- `src/embedding/multimodal-embedding-service.ts`: 新建多模态 embedding 服务
- `src/embedding/embedding-service.ts`: 修改为支持本地/远程两种模式
- `src/server/http-server.ts`: 配置默认使用本地 embedding

**依赖影响：**
- 新增依赖: `@xenova/transformers` (~2MB gzipped)
- 文本模型下载: `Xenova/multilingual-e5-small` (~118MB)
- 多模态模型下载: `Xenova/clip-vit-base-patch32` (~340MB)

**性能影响：**
- 文本 Embedding: ~20-50ms per text (CPU)
- 图片 Embedding: ~50-200ms per image (CPU)
- 内存占用: +200-400MB (取决于加载的模型)
- 优势: 无网络延迟，无 API 调用限制，支持离线运行

**语言支持：**
- 文本: 中文、英文、日文、韩文等 100+ 语言
- 多模态: 图文跨模态检索（中英文文本均可检索图片）