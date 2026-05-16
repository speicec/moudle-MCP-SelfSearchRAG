# SelfSearchRAG 系统图表导航

## 分辨率

所有图表已适配 **1920×1080 (16:9)** 分辨率，确保投影和截图清晰可读。

- HTML 架构图：容器宽度 1920px，字号 12-30px
- PlantUML 图：`scale 1.6`，`defaultFontSize 14`

## 使用方式

- `.html` 文件 → 浏览器直接打开查看（1920×1080 最佳）
- `.puml` 文件 → VS Code 安装 PlantUML 插件 `Alt+D` 预览
- 批量导出 PNG：`npx plantuml -tpng docs/diagrams/*.puml`

## 图表列表

| # | 文件名 | 类型 | 内容 | 一句话说明 |
|---|--------|------|------|-----------|
| 1 | `01-system-architecture.html` | 架构图 | 系统全景 | 7层架构：用户→服务→编排→存储→检索→生成→外部服务 |
| 2 | `02-document-pipeline.puml` | 活动图 | 文档摄取 | PDF上传→Ingest→Parse(文本/图片)→Chunk(断崖)→Embed |
| 3 | `03-image-pdf-processing.puml` | 活动图 | 图片PDF专项 | 扫描件渲染→PaddleOCR版面→VLM表格/图表/公式理解 |
| 4 | `04-semantic-chunking.puml` | 活动图 | 语义分块 | 句子Embedding→断崖检测→梯度验证→去噪→父子Chunk |
| 5 | `05-enhanced-retrieval.puml` | 时序图 | 增强检索 | 8阶段：分析→重写→扩展→分解→检索→重排→组装→生成 |
| 6 | `06-hybrid-recall-rerank.puml` | 活动图 | 多路召回 | 语义+关键词+混合三引擎→RRF融合→双模式路由→四因子评分 |
| 7 | `07-medical-agent-flow.puml` | 时序图 | 用户使用流程 | 实体识别→安全层→ReAct循环→三层回答→流式输出 |
| 8 | `08-agent-state-machine.puml` | 状态机 | Agent框架 | 双模式：ReAct(Think-Act-Observe) + Planning(DAG并行) |
| 9 | `09-mcp-server-interaction.puml` | 时序图 | MCP工具交互 | 5个MCP工具：ingest/search/query/agent/agent_plan |
| 10 | `10-websocket-event-flow.puml` | 时序图 | WebSocket事件 | 5类事件：Pipeline/Agent/Generation/Stats/Error |

## 推荐阅读顺序

```
新手路径:  1 → 2 → 5 → 7
深入路径:  1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10
快速概览:  1, 5, 7
技术面试:  全部
```
