# SelfSearchRAG 系统分层架构图

<div style="width: 1200px; box-sizing: border-box; position: relative; background: #f0f4f8; padding: 20px; border-radius: 8px; border: 1px solid #c8d6e5;">
<style scoped>
.arch-wrapper { display: flex; gap: 12px; }.arch-sidebar { width: 165px; flex-shrink: 0; }.arch-main { flex: 1; min-width: 0; }.arch-title { text-align: center; font-size: 22px; font-weight: bold; color: #1a365d; margin-bottom: 16px; font-family: Georgia, serif; }
.arch-layer { margin: 8px 0; padding: 14px; border-radius: 6px; box-shadow: 0 1px 4px rgba(30, 58, 138, 0.08); }.arch-layer-title { font-size: 13px; font-weight: bold; margin-bottom: 10px; text-align: center; }
.arch-grid { display: grid; gap: 8px; }.arch-grid-2 { grid-template-columns: repeat(2, 1fr); }.arch-grid-3 { grid-template-columns: repeat(3, 1fr); }.arch-grid-4 { grid-template-columns: repeat(4, 1fr); }.arch-grid-5 { grid-template-columns: repeat(5, 1fr); }.arch-grid-6 { grid-template-columns: repeat(6, 1fr); }
.arch-box { border-radius: 4px; padding: 8px; text-align: center; font-size: 11px; font-weight: 600; line-height: 1.35; color: #1e293b; background: #ffffff; border: 1px solid #cbd5e1; }.arch-box.highlight { background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%); border: 2px solid #2563eb; }.arch-box.tech { font-size: 10px; color: #475569; background: #f1f5f9; }
.arch-layer.external { background: linear-gradient(135deg, #edf2f7 0%, #e2e8f0 100%); border: 2px dashed #a0aec0; }.arch-layer.external .arch-layer-title { color: #718096; }.arch-layer.user { background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%); border: 2px solid #3b82f6; }.arch-layer.user .arch-layer-title { color: #1e40af; }.arch-layer.application { background: linear-gradient(135deg, #e0f2fe 0%, #bae6fd 100%); border: 2px solid #0284c7; }.arch-layer.application .arch-layer-title { color: #075985; }.arch-layer.ai { background: linear-gradient(135deg, #e0e7ff 0%, #c7d2fe 100%); border: 2px solid #6366f1; }.arch-layer.ai .arch-layer-title { color: #3730a3; }.arch-layer.data { background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%); border: 2px solid #10b981; }.arch-layer.data .arch-layer-title { color: #065f46; }.arch-layer.infra { background: linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%); border: 2px solid #7c3aed; }.arch-layer.infra .arch-layer-title { color: #5b21b6; }
.arch-subgroup { display: flex; gap: 8px; margin-top: 8px; }.arch-subgroup-box { flex: 1; border-radius: 6px; padding: 8px; background: rgba(255, 255, 255, 0.5); border: 1px solid rgba(0, 0, 0, 0.08); }.arch-subgroup-title { font-size: 10px; font-weight: bold; color: #374151; text-align: center; margin-bottom: 6px; }
.arch-sidebar-panel { border-radius: 6px; padding: 10px; background: linear-gradient(135deg, #edf1f7 0%, #dde3eb 100%); border: 2px solid #8da3bd; margin-bottom: 8px; box-shadow: 0 1px 3px rgba(30, 58, 138, 0.06); }.arch-sidebar-title { font-size: 12px; font-weight: bold; text-align: center; color: #1a365d; margin-bottom: 6px; }.arch-sidebar-item { font-size: 10px; text-align: center; color: #334155; background: #ffffff; padding: 5px; border-radius: 3px; margin: 3px 0; border: 1px solid #d1d9e4; }.arch-sidebar-item.metric { background: #dbeafe; border: 1px solid #93c5fd; color: #1e40af; font-weight: 600; }
</style>
<div class="arch-title">SelfSearchRAG — Enhanced RAG MCP Server 系统架构</div>
<div class="arch-wrapper">
<div class="arch-sidebar">
<div class="arch-sidebar-panel"><div class="arch-sidebar-title">实时监控</div><div class="arch-sidebar-item">WebSocket 事件</div><div class="arch-sidebar-item">Pipeline 追踪</div><div class="arch-sidebar-item metric">Stats 聚合</div><div class="arch-sidebar-item">健康检查</div></div>
<div class="arch-sidebar-panel"><div class="arch-sidebar-title">质量保障</div><div class="arch-sidebar-item">RAGAS 评估</div><div class="arch-sidebar-item">告警系统</div><div class="arch-sidebar-item">审查队列</div><div class="arch-sidebar-item">Trace 追踪</div></div>
<div class="arch-sidebar-panel"><div class="arch-sidebar-title">运维</div><div class="arch-sidebar-item">队列管理</div><div class="arch-sidebar-item">自动扩缩</div><div class="arch-sidebar-item">存储同步</div><div class="arch-sidebar-item">优雅关闭</div></div>
</div>
<div class="arch-main">
<div class="arch-layer user">
<div class="arch-layer-title">第1层 — 用户入口 (User Entry)</div>
<div class="arch-grid arch-grid-2"><div class="arch-box highlight">Web UI (React + TypeScript)<br><small>文档管理 | 聊天窗口 | 统计仪表盘 | Pipeline可视化 | 分块浏览器 | 评估面板</small></div><div class="arch-box">MCP Client (Claude Desktop)<br><small>通过 MCP Protocol 调用 RAG 工具</small></div></div>
</div>
<div class="arch-layer application">
<div class="arch-layer-title">第2层 — 服务层 (Server Layer)</div>
<div class="arch-subgroup"><div class="arch-subgroup-box"><div class="arch-subgroup-title">HTTP Server (Fastify)</div><div class="arch-grid arch-grid-3"><div class="arch-box tech">/api/documents<br><small>上传/列表/删除/分块</small></div><div class="arch-box tech">/api/chat<br><small>LLM 生成 (SSE流式)</small></div><div class="arch-box tech">/api/stats<br><small>统计聚合</small></div></div><div class="arch-grid arch-grid-3" style="margin-top:4px"><div class="arch-box tech">/api/alerts<br><small>告警管理</small></div><div class="arch-box tech">/api/review<br><small>审查队列</small></div><div class="arch-box tech">/api/queue + /api/scaler<br><small>队列健康 + 扩缩</small></div></div></div><div class="arch-subgroup-box"><div class="arch-subgroup-title">实时通信</div><div class="arch-box highlight" style="margin-bottom:6px">WebSocket Handler<br><small>stage:start/progress/complete | chunk:created | retrieval:* | generation:* | stats:update</small></div><div class="arch-box">MCP Server (StdioTransport)<br><small>工具注册: ingest_document | query | get_document | list_documents | medical_query | medical_agent | type_fix</small></div></div></div>
</div>
<div class="arch-layer ai">
<div class="arch-layer-title">第3层 — Harness 编排层 (Orchestration)</div>
<div class="arch-box highlight" style="margin-bottom:8px">Pipeline Orchestrator (Harness)<br><small>可插拔 Pipeline 编排 + Lifecycle Hooks (preExecution / onStageStart / onStageComplete / postExecution / onError)</small></div>
<div class="arch-grid arch-grid-5"><div class="arch-box">INGEST Stage<br><small>验证器 | 队列</small></div><div class="arch-box">PARSE Stage<br><small>PDF解析 | OCR | VLM增强</small></div><div class="arch-box">CHUNK Stage<br><small>语义分块 | 断崖检测 | 质量过滤</small></div><div class="arch-box">EMBED Stage<br><small>文本嵌入 | 图片嵌入 | 缓存</small></div><div class="arch-box">INDEX Stage<br><small>向量存储 | 层级存储</small></div></div>
</div>
<div class="arch-layer data">
<div class="arch-layer-title">第4层 — 存储层 (Storage)</div>
<div class="arch-grid arch-grid-5"><div class="arch-box">Document Store<br><small>文档元数据 (id, status, pages, format)</small></div><div class="arch-box highlight">Hierarchical Store<br><small>层级分块 (Parent + Small Chunks)</small></div><div class="arch-box">Image Store<br><small>页面图片 / 裁剪块</small></div><div class="arch-box tech">Trace Storage<br><small>SQLite — 追踪事件 & 评估记录</small></div><div class="arch-box tech">Qdrant Vector Store<br><small>可选 — 混合检索模式</small></div></div>
</div>
<div class="arch-layer infra">
<div class="arch-layer-title">第5层 — 检索与生成层 (Retrieval & Generation)</div>
<div class="arch-subgroup"><div class="arch-subgroup-box"><div class="arch-subgroup-title">Enhanced Retrieval Pipeline</div><div class="arch-grid arch-grid-4"><div class="arch-box tech">QueryAnalyzer<br><small>意图分析</small></div><div class="arch-box tech">QueryRewriter<br><small>查询改写</small></div><div class="arch-box tech">QueryDecomposer<br><small>查询分解</small></div><div class="arch-box tech">QueryExpander<br><small>术语扩展</small></div></div><div class="arch-grid arch-grid-4" style="margin-top:4px"><div class="arch-box tech">DynamicTopK<br><small>自适应K值</small></div><div class="arch-box tech">HybridReranker<br><small>混合重排序</small></div><div class="arch-box tech">LowConfidence<br><small>低置信度处理</small></div><div class="arch-box tech">ContextAssembler<br><small>上下文组装</small></div></div></div><div class="arch-subgroup-box"><div class="arch-subgroup-title">核心检索 & 生成</div><div class="arch-box highlight" style="margin-bottom:4px">Small-to-Big Retriever<br><small>小块精准匹配 → 父块展开 → 上下文窗口</small></div><div class="arch-box" style="margin-bottom:4px">Medical Agent<br><small>IntentAnalyzer → TaskPlanner → DAGValidator → TaskExecutor → MedicalReasoner</small></div><div class="arch-box">LLM Generation Service<br><small>DeepSeek: 思考链 (reasoning_content) + 答案 (content)</small></div></div></div>
</div>
<div class="arch-layer external">
<div class="arch-layer-title">第6层 — 外部服务层 (External Services)</div>
<div class="arch-grid arch-grid-6"><div class="arch-box tech">PaddleOCR<br><small>Python FastAPI :8080<br>版面分析 + OCR</small></div><div class="arch-box tech">DashScope VLM<br><small>qwen3-vl-flash<br>图片理解</small></div><div class="arch-box tech">DeepSeek API<br><small>deepseek-reasoner<br>LLM + 思考链</small></div><div class="arch-box tech">Transformers.js<br><small>multilingual-e5-small<br>本地文本嵌入 384d</small></div><div class="arch-box tech">BGE-M3 Hybrid<br><small>Dense 1024d + Sparse<br>混合嵌入</small></div><div class="arch-box tech">Redis<br><small>可选<br>评估任务队列</small></div></div>
</div>
</div>
<div class="arch-sidebar">
<div class="arch-sidebar-panel"><div class="arch-sidebar-title">文档处理流程</div><div class="arch-sidebar-item">多格式上传</div><div class="arch-sidebar-item">PDF 文本提取</div><div class="arch-sidebar-item">图片 PDF 渲染</div><div class="arch-sidebar-item">OCR 版面分析</div><div class="arch-sidebar-item">VLM 内容增强</div></div>
<div class="arch-sidebar-panel"><div class="arch-sidebar-title">检索策略</div><div class="arch-sidebar-item">Small-to-Big</div><div class="arch-sidebar-item">混合 Dense+Sparse</div><div class="arch-sidebar-item">RRF 融合</div><div class="arch-sidebar-item">上下文窗口提取</div></div>
<div class="arch-sidebar-panel"><div class="arch-sidebar-title">嵌入模式</div><div class="arch-sidebar-item metric">API 模式</div><div class="arch-sidebar-item metric">Local 模式</div><div class="arch-sidebar-item metric">Hybrid 模式</div></div>
</div>
</div>
</div>

## 架构说明

| 层级 | 名称 | 核心职责 |
|------|------|----------|
| 第1层 | 用户入口 | Web UI (React) 和 MCP Client (Claude Desktop) 两种交互方式 |
| 第2层 | 服务层 | Fastify HTTP API + WebSocket 实时推送 + MCP Server 工具注册 |
| 第3层 | 编排层 | Harness 可插拔 Pipeline，5 阶段顺序执行 (Ingest→Parse→Chunk→Embed→Index) |
| 第4层 | 存储层 | 文档元数据 + 层级分块 + 图片块 + 追踪记录 + 可选 Qdrant 向量库 |
| 第5层 | 检索与生成层 | Enhanced Retrieval Pipeline (8 阶段) + Small-to-Big 检索 + Medical Agent + LLM 生成 |
| 第6层 | 外部服务 | PaddleOCR、DashScope VLM、DeepSeek LLM、Transformers.js、BGE-M3、Redis |
