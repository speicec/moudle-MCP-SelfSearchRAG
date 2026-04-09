## Context

本项目从零构建一个增强RAG系统，采用harness范式设计可插拔的处理流程。核心挑战在于：
1. 复杂PDF文档（表格、图表、公式、多栏）的准确解析
2. 多模态内容（文本+图像）的统一向量表示
3. 灵活的处理流程编排能力

技术栈约束：TypeScript/Node.js生态，兼容MCP协议。

## Goals / Non-Goals

**Goals:**
- 构建模块化的文档处理管道，每个处理单元可独立配置和替换
- 实现高精度的PDF复杂布局解析（表格识别率>95%，公式识别可用）
- 支持文本与图像的统一嵌入和检索
- 提供MCP Server标准接口，可被AI助手调用
- 实现混合检索策略（语义+关键词）

**Non-Goals:**
- 不支持视频/音频模态（仅文本+图像）
- 不构建自定义LLM模型（使用现有嵌入模型）
- 不提供Web前端界面（仅MCP Server API）
- 不处理加密或受保护的PDF文档

## Decisions

### 1. PDF解析引擎选择

**决定：采用pdf-parse + unstructured + 自定义布局分析组合方案**

方案对比：
- **pdf-parse + 自定义处理**：轻量、可控性高，但需自行实现复杂布局识别
- **unstructured**：开源方案，表格/图表识别较好，Python生态
- **Adobe PDF Services API**：精度最高，但有成本和依赖外部服务
- **合建方案**：基础解析用pdf-parse，复杂布局用unstructured补充

理由：平衡精度与自主可控，避免强依赖外部付费服务。

### 2. 多模态嵌入策略

**决定：文本与图像分别嵌入，检索时融合排序**

方案对比：
- **CLIP统一嵌入**：文本图像同一空间，但专业文档理解有限
- **双塔模型分离嵌入**：文本用text-embedding-3，图像用CLIP/ViT，检索时加权融合
- **多模态LLM提取后嵌入**：用视觉LLM描述图像，再文本嵌入

理由：专业文档中图像语义需深度理解，双塔模型更灵活，可针对不同文档类型调整权重。

### 3. Harness框架设计

**决定：采用Pipeline + Plugin架构**

核心概念：
- **Harness**：处理流程的容器，管理生命周期和配置
- **Stage**：处理阶段（Ingest → Parse → Embed → Index）
- **Plugin**：每个阶段的具体实现，可插拔替换
- **Context**：阶段间数据传递的上下文对象

```typescript
interface Harness {
  stages: Stage[];
  run(input: Document): Promise<Result>;
}

interface Stage {
  name: string;
  plugins: Plugin[];
  execute(ctx: Context): Promise<Context>;
}

interface Plugin {
  name: string;
  process(ctx: Context): Promise<Context>;
}
```

理由：Pipeline模式直观，Plugin机制实现可插拔，Context传递保持无状态。

### 4. 向量数据库选择

**决定：初期支持内存存储 + ChromaDB（可选）**

理由：降低启动门槛，内存存储适合开发和小规模场景，ChromaDB作为可选扩展。

### 5. MCP Server接口设计

**决定：实现核心工具集**

工具列表：
- `ingest_document`：摄入文档
- `query`：检索查询
- `get_document`：获取文档详情
- `list_documents`：列出已索引文档

理由：覆盖核心RAG流程，保持接口简洁。

## Risks / Trade-offs

| 风险 | 缓解措施 |
|------|----------|
| PDF复杂布局解析精度不达预期 | 提供多种解析器选择，支持人工干预修正 |
| 图像嵌入质量影响检索准确性 | 提供可配置的融合权重，允许纯文本检索降级 |
| 大文档处理内存占用高 | 分块处理、流式解析、内存池管理 |
| MCP协议版本兼容性 | 遵循MCP规范，版本锁定 |
| 多模态模型调用延迟 | 异步处理、缓存嵌入结果 |