# SelfSearchRAG 系统图表导航

## 打开方式

| 格式 | 后缀 | 怎么打开 |
|------|------|----------|
| **draw.io 原生** | `.drawio` | 双击 → draw.io桌面版自动打开编辑 |
| PlantUML | `.puml` | VS Code PlantUML 插件 `Alt+D` / `npx plantuml *.puml` |

> 安装 draw.io 桌面版: https://github.com/jgraph/drawio-desktop/releases
> 或在线: https://app.diagrams.net → 拖入文件

## 分辨率

全部适配 **1920×1080 (16:9)**，字号加大确保投影清晰。

## 完整图表列表 (10张)

| # | draw.io | PlantUML | 类型 | 一句话 |
|---|---------|----------|------|--------|
| 1 | `01-system-architecture.drawio` | ✅ | 架构图 | 7层全景：用户→服务→编排→存储→检索→生成→外部 |
| 2 | `02-document-pipeline.drawio` | ✅ | 流程图 | PDF→Ingest→Parse(文本/图片分支)→Chunk(断崖)→Embed |
| 3 | `03-image-pdf-processing.drawio` | ✅ | 流程图 | 扫描件：渲染→PaddleOCR版面→VLM表格/图表/公式理解 |
| 4 | `04-semantic-chunking.drawio` | ✅ | 流程图 | 断崖检测：句子Embedding→相似度→梯度验证→去噪→父子Chunk |
| 5 | `05-enhanced-retrieval.drawio` | ✅ | 时序图 | 8阶段：Analyze→Rewrite→Expand→Decompose→Retrieve→Rerank→Assemble→Generate |
| 6 | `06-hybrid-recall-rerank.drawio` | ✅ | 流程图 | 三引擎并行→RRF融合→双模式路由→四因子置信度评分 |
| 7 | `07-medical-agent-flow.drawio` | ✅ | 时序图 | 用户提问→实体识别→安全层→ReAct循环→三层回答→流式输出 |
| 8 | `08-agent-state-machine.drawio` | ✅ | 状态机 | ReAct(Think-Act-Observe) + Planning(模板匹配→DAG→并行→重规划) |
| 9 | `09-mcp-server-interaction.drawio` | ✅ | 时序图 | Claude Desktop ↔ 5个MCP工具完整交互 |
| 10 | `10-websocket-event-flow.drawio` | ✅ | 时序图 | Pipeline/Agent/Generation/Stats/Error 5类实时事件 |

## 推荐阅读顺序

```
快速 (10分钟):  1 → 2 → 5 → 7
深入 (30分钟):  1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10
面试重点:       1, 5, 7, 8
```
