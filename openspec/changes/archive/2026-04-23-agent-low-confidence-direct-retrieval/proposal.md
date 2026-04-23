## Why

当用户查询非医学术语（如"加班"）时，Agent 的实体识别置信度极低（0.2），`buildQueryStrategy()` 返回空字符串 `primaryQuery`，导致 Agent 在 ReAct 循环中反复尝试空查询检索，3次迭代全部失败，耗时143秒。而 Agent 结束后 ChatRoute 直接用原始查询检索能成功找到8条结果。

这是一个严重的性能问题：非医学查询浪费了大量 LLM 调用和时间，却无法获得任何检索结果。

## What Changes

- 在 `AgentExecutor.run()` 入口增加智能判断逻辑
- 当实体识别置信度低于阈值（默认0.3）时，跳过 Agent ReAct 循环
- 直接使用 `rawQuery` 进行检索并生成答案
- 新增 `lowConfidenceThreshold` 配置项
- 新增 `executeDirectRetrieval()` 方法处理直接检索流程

## Capabilities

### New Capabilities

- `low-confidence-direct-retrieval`: 低置信度查询的智能直接检索模式，跳过 Agent 循环直接检索

### Modified Capabilities

- `medical-entity-recognition`: 新增 `lowConfidenceThreshold` 配置需求，定义置信度阈值触发直接检索
- `retrieval-flow`: 新增 `agent:direct_retrieval` WebSocket 事件，用于可视化直接检索模式

## Impact

**核心改动文件**:
- `src/medical/agent/AgentExecutor.ts` - 入口判断逻辑和新方法
- `src/medical/agent/types.ts` - 配置类型扩展

**配置影响**:
- `ExtendedAgentConfig.lowConfidenceThreshold` - 新配置项（默认0.3）

**性能影响**:
- 非医学查询：从 ~143秒 → ~2秒
- 医学查询：无变化，保持原有 Agent 流程

**向下兼容**:
- 完全向下兼容，现有医学查询流程不受影响
- 新配置项可选，默认值自动生效