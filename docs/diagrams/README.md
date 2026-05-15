# SelfSearchRAG 架构图与流程图索引

本目录包含 SelfSearchRAG 项目的 10 张详细架构图和流程图，覆盖从系统全景到算法细节的各个层面。

## 图表列表

| # | 文件名 | 类型 | 技能 | 内容 |
|---|--------|------|------|------|
| 1 | [01-system-architecture.md](01-system-architecture.md) | 分层架构图 | `architecture` | 6层系统架构全景：用户入口→服务层→编排层→存储层→检索生成层→外部服务层 |
| 2 | [02-document-pipeline.md](02-document-pipeline.md) | BPMN 流程图 | `bpmn` | 文档处理主流水线：上传→验证→解析→OCR→VLM→分块→嵌入→索引 |
| 3 | [03-image-pdf-processing.md](03-image-pdf-processing.md) | BPMN 流程图 | `bpmn` | 图片PDF专项处理：渲染→OCR版面分析→VLM增强→ParsedContent |
| 4 | [04-enhanced-retrieval-pipeline.md](04-enhanced-retrieval-pipeline.md) | UML 时序图 | `uml` | 增强检索流水线7阶段：分析→优化→检索→置信度检查→重排序→组装→生成 |
| 5 | [05-medical-agent-flow.md](05-medical-agent-flow.md) | UML 活动图 | `uml` | 医疗Agent双模式执行：ReAct循环 + PlanAndExecute，含早终止和回退逻辑 |
| 6 | [06-mcp-server-interaction.md](06-mcp-server-interaction.md) | UML 时序图 | `uml` | MCP Server工具交互全链路：9个MCP工具调用流程 |
| 7 | [07-websocket-event-flow.md](07-websocket-event-flow.md) | UML 时序图 | `uml` | WebSocket实时事件流：16种事件类型从Pipeline到前端的推送路径 |
| 8 | [08-semantic-chunking-algorithm.md](08-semantic-chunking-algorithm.md) | UML 活动图 | `uml` | 断崖检测算法：句子嵌入→相邻相似度→候选断崖→梯度验证→噪点过滤→边界选择 |
| 9 | [09-module-dependencies.md](09-module-dependencies.md) | 依赖关系图 | `graphviz` | 12个src模块及其内部组件的依赖关系 |
| 10 | [10-data-model.md](10-data-model.md) | UML 类图 | `uml` | 核心数据结构：Document、Chunk、Agent、Trace 4大领域类图 |

## 阅读建议

- **了解系统全貌** → 从 #1 系统分层架构图开始
- **理解文档处理** → #2 主流水线 + #3 图片PDF专项
- **理解检索机制** → #4 增强检索流水线 + #8 语义分块算法
- **理解医疗Agent** → #5 医疗Agent执行流程 + #6 MCP工具交互
- **理解前后端通信** → #7 WebSocket事件流
- **理解代码组织** → #9 模块依赖关系 + #10 数据模型类图

## 渲染说明

所有图表使用 PlantUML（`@startuml`/`@enduml`）或 HTML 编写，需要以下渲染支持：

- **PlantUML 图表**（#2-#10）：使用 PlantUML 渲染器或将 `.md` 文件在支持 PlantUML 的 Markdown 编辑器中查看（如 VS Code + PlantUML 插件）
- **HTML 架构图**（#1）：直接在浏览器或支持 HTML 的 Markdown 渲染器中查看
