---
change: medical-agent-complete
created: 2026-04-21
---

# Tasks

## Phase 1: 基础集成 - 检索 + MCP注册 (P0)

- [x] 1.1 注册 `medical_query` 工具到 McpServer
  - 在 `server.ts` 中添加工具定义
  - inputSchema: query, domain, year_range

- [x] 1.2 实现 `MedicalQueryHandler`
  - 验证输入参数
  - 调用 processMedicalQuery
  - 格式化输出为 MCP result

- [x] 1.3 集成 `McpRetrievalService.query()`
  - 修改 `processMedicalQuery()` 接受 retrieval 参数
  - 使用 strategy.primaryQuery 执行检索
  - 返回真实 retrievalResults

- [x] 1.4 测试基本检索流程
  - 单元测试：Handler → Agent → Retrieval
  - 验证 retrievalResults 不为 undefined

## Phase 2: LLM 集成 (P0)

- [x] 2.1 创建 `LLMCaller` 工厂
  - `src/config/llm-config.ts`
  - 支持 Claude API / OpenAI API / Ollama
  - 配置项：model, apiKey, baseUrl

- [x] 2.2 添加 `ANTHROPIC_API_KEY` 配置
  - 环境变量支持
  - 配置优先级：ANTHROPIC > OPENAI > Ollama

- [x] 2.3 实现 `MedicalReasoner`
  - `src/medical/agent/MedicalReasoner.ts`
  - `reasonClinical()` - 临床推理
  - `generateMedicalAnswer()` - 回答生成
  - `checkAnswerQuality()` - 质量检查

- [x] 2.4 实现 `AgentPrompts`
  - `src/medical/agent/AgentPrompts.ts`
  - THINK prompt - 分析状态
  - DECIDE prompt - 决策判断
  - ANSWER prompt - 回答生成
  - QUALITY prompt - 质量检查

## Phase 3: Agent 循环 (P1)

- [x] 3.1 定义 Agent 类型
  - `src/medical/agent/types.ts`
  - AgentState, AgentAction, Observation
  - AgentConfig, AgentResult

- [x] 3.2 实现 `AgentState`
  - `src/medical/agent/AgentState.ts`
  - 状态初始化、更新、序列化
  - 历史记录管理

- [x] 3.3 实现 `AgentExecutor`
  - `src/medical/agent/AgentExecutor.ts`
  - ReAct 循环实现
  - think() → decideAction() → executeAction() → evaluate()
  - 最大迭代限制

- [x] 3.4 实现 `MedicalAgent`
  - `src/medical/agent/MedicalAgent.ts`
  - 主入口 `run(input)`
  - 依赖注入：llmCaller, retrieval
  - 子模块组装

- [x] 3.5 注册 `medical_agent` MCP tool
  - 区分于 `medical_query`（简化版）
  - 完整 Agent 循环
  - 返回结构化医学回答

## Phase 4: MCP Handler 集成 (P1)

- [x] 4.1 创建 `MedicalAgentHandler`
  - `src/mcp/medical-agent-handler.ts`
  - 初始化 MedicalAgent
  - 处理 MCP 调用

- [x] 4.2 修改 `McpServer` 构造函数
  - 接受 llmCaller 参数
  - 创建 MedicalAgentHandler

- [x] 4.3 修改 `Application` 类
  - 创建 LLMCaller 工厂
  - 注入到 McpServer

## Phase 5: 测试与验证 (P2)

- [x] 5.1 单元测试 Agent 循环
  - 测试 AgentState 状态管理
  - 测试 AgentExecutor 循环逻辑
  - 测试 MedicalReasoner 推理

- [x] 5.2 集成测试 MCP 调用
  - 测试 medical_query handler
  - 测试 medical_agent handler
  - 测试 LLMCaller 集成

- [x] 5.3 端到端医学场景测试
  - 场景1：二甲双胍肾功能禁忌
  - 场景2：糖尿病合并高血压选药
  - 场景3：甲状腺药物用量

- [x] 5.4 使用文档
  - 配置文档：LLM API 配置
  - 使用文档：上传医学指南
  - API 文档：medical_agent tool

## Phase 6: 优化与扩展 (P3)

- [x] 6.1 添加 Agent 日志
  - 记录每轮 Think/Act/Observe/Decide
  - 用于调试和审计

- [x] 6.2 添加缓存优化
  - 缓存 LLM 推理结果
  - 缓存检索结果

- [x] 6.3 添加多语言支持
  - 英文医学查询
  - 中英混合查询

- [x] 6.4 扩展到其他医学领域
  - 心血管领域
  - 肿瘤领域
  - 神经领域