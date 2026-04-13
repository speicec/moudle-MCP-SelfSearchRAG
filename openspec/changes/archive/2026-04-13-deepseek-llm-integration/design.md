## Context

### 当前架构现状
系统目前是纯 RAG 检索架构，流程为：

```
用户查询 → 向量检索 → 返回匹配的文档片段 (无 LLM 生成)
```

前端布局：
- 左侧面板 (col-span-3): ChatWindow 嵌入式组件 + 快速上传 + 文档列表
- 右侧 Tab 区域 (col-span-9): Pipeline 可视化 (timeline、chunks、retrieval、stats)

WebSocket 事件：
- 已有: `retrieval:start`、`retrieval:match`、`retrieval:complete`
- 缺失: LLM 生成相关事件

### 约束条件
- DeepSeek API 使用 OpenAI 兼容的 SSE 格式
- `deepseek-reasoner` 模型提供原生思考链 (`reasoning_content` 字段)
- 需要保持现有检索功能不变
- WebSocket 已有完整基础设施，可复用

### 相关方
- 用户: 期望 DeepSeek 风格的聊天体验
- 开发者: 需要清晰的 LLM 集成架构
- 系统: 需要保持检索可视化能力

## Goals / Non-Goals

**Goals:**
- 实现完整的 RAG + LLM 两阶段生成流程
- Chat Tab 独立化，提供更大的交互空间
- 思考链可视化，展示"分析→检索→思考→回答"全过程
- 流式响应，逐字显示思考过程和答案
- 保持检索可视化能力 (可选 Split View)

**Non-Goals:**
- 不实现多轮对话的复杂上下文管理（本轮为单轮问答）
- 不实现本地 LLM 模型（仅集成 DeepSeek API）
- 不修改 embedding 服务配置
- 不实现用户认证或对话持久化存储

## Decisions

### Decision 1: 流式响应方案 - SSE → WebSocket 转换

**选择**: 后端接收 DeepSeek SSE → 通过 WebSocket 推送给前端

**理由**:
- 已有 WebSocket infrastructure，无需新建 SSE 端点
- WebSocket 支持双向通信，可以同时推送检索+生成事件
- SSE 仅单向，且需要单独 HTTP 端点处理
- DeepSeek API 原生返回 SSE，需要转换层

**备选方案**:
1. ❌ 纯 SSE 方案: 需要新建 SSE 端点，前端需要额外 SSE 处理逻辑
2. ❌ 纯 WebSocket 直连 DeepSeek: DeepSeek API 不支持 WebSocket
3. ✅ SSE → WebSocket 转换: 复用现有基础设施，前端统一用 WebSocket

### Decision 2: UI 布局方案 - Split View

**选择**: Chat Tab 左侧 (col-span-8) + 检索分析右侧 (col-span-4)

**理由**:
- 保持检索可视化能力，用户可以看到检索过程
- Chat 占主区域，交互空间足够
- 两个面板可以并行展示：左边聊天，右边实时分析

**备选方案**:
1. ❌ 全屏 Chat Tab: Chat 占满 (col-span-12)，检索可视化需要切换 Tab
2. ✅ Split View: Chat 左侧 (col-span-8) + 分析右侧 (col-span-4)
3. ❌ 保持当前布局: Chat 嵌入侧边栏，空间不足

### Decision 3: LLM 模型选择 - DeepSeek Reasoner

**选择**: 使用 `deepseek-reasoner` 模型

**理由**:
- 原生支持思考链 (`reasoning_content` 字段)
- 中文支持优秀
- 成本合理（相比 OpenAI GPT-4）
- 思考 tokens 与 answer tokens 分离，便于可视化

**备选方案**:
1. ❌ OpenAI GPT-4: 无原生思考链，需要手动模拟
2. ❌ 本地模型 (Ollama/Qwen): 离线推理慢，思考链支持不完善
3. ✅ DeepSeek Reasoner: 原生思考链，中文优秀，成本合理

### Decision 4: 两阶段生成流程

**选择**: Phase 1 检索 → Phase 2 LLM 生成

**理由**:
- 标准 RAG 架构，检索提供上下文
- 两阶段清晰分离，便于可视化
- 可以在 WebSocket 中明确推送阶段切换事件

**Prompt 结构**:
```
用户问题: {query}

参考资料:
---
{chunk 1 content}
---
{chunk 2 content}
---
{chunk 3 content}
---

请基于参考资料回答用户问题。如果参考资料中没有相关信息，请说明无法回答。
```

## Risks / Trade-offs

### Risk 1: DeepSeek API 可用性
- **影响**: API 调用失败时无法生成回答
- **缓解**: 添加错误处理，显示"生成失败"提示；可选降级到仅显示检索结果

### Risk 2: API Key 安全
- **影响**: 密钥泄露可能导致滥用和费用损失
- **缓解**: 密钥仅存储在环境变量；后端代理调用，前端不暴露密钥

### Risk 3: 流式响应中断
- **影响**: WebSocket 断连导致流式内容丢失
- **缓解**: 已有 WebSocket 重连机制；生成完成后保存完整消息

### Risk 4: 思考链长度不可控
- **影响**: DeepSeek 思考链可能很长，UI 展示需要处理
- **缓解**: 默认折叠思考链；提供展开/收起控制；截断过长内容

### Trade-off 1: 单轮问答 vs 多轮对话
- **选择**: 本轮仅支持单轮问答
- **代价**: 用户无法进行连续对话
- **未来**: 可扩展为多轮对话，存储对话历史

### Trade-off 2: Split View 布局
- **选择**: Chat 左侧 + 分析右侧
- **代价**: Chat 区域略小于全屏
- **收益**: 保持检索可视化能力

## Migration Plan

### Phase 1: 后端服务层
1. 创建 `LLMGenerationService` 服务
2. 新增 SSE 端点 `/api/chat/generate`
3. 扩展 WebSocket 事件类型
4. 扩展 `PipelineEmitter` 生成事件方法

### Phase 2: 前端 UI 重构
1. 创建 `ThinkingChainDisplay` 组件
2. 重构 `ChatWindow` 为完整聊天界面
3. 修改 `VisualApp.tsx` 布局：Chat Tab 独立化
4. 扩展 `useChatStore` 支持流式状态

### Phase 3: 整合测试
1. 测试两阶段流程：检索 → 生成
2. 测试流式响应显示
3. 测试思考链动画
4. 测试错误处理

### Rollback Strategy
- 前端改动：保留原有 ChatWindow 组件，可通过配置切换布局
- 后端改动：新增端点，不影响现有 `/api/chat/query` 端点
- LLM 服务：可通过环境变量 `ENABLE_LLM_GENERATION=false` 禁用

## Open Questions

- 思考链默认折叠还是展开？（建议：默认折叠，提供展开按钮）
- 检索结果是否需要在 prompt 中提供更多上下文？（建议：提供 parentChunkContent）
- 是否需要支持用户选择不同 LLM 模型？（建议：暂不支持，固定 deepseek-reasoner）
- 思考链 UI 是否需要支持中文/英文切换？（建议：根据前端语言设置决定）