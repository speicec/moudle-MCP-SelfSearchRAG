## Context

Medical Agent 设计为专门的医学查询处理系统，实体识别器基于医学词典进行匹配。当用户查询包含医学术语时，Agent 能正确识别实体并构建有效的检索查询。

然而，当用户查询非医学术语（如"加班"、"劳动合同"、"工资"）时：
- 实体识别结果为空 → `entities.confidence = 0.2`
- `buildQueryStrategy()` 返回空字符串 `primaryQuery`
- Agent ReAct 循环使用空查询检索 → 连续失败
- 3次迭代后 Agent 返回空结果
- ChatRoute 最后用原始查询直接检索 → 成功找到结果

```
┌─────────────────────────────────────────────────────────────────────┐
│                    当前问题流程                                      │
└─────────────────────────────────────────────────────────────────────┘

  query: "加班"                                             
       │                                             
       ▼                                             
  extractEntities(query)  →  entities.confidence = 0.2
       │                                             
       ▼                                             
  chooseExecutionMode()  →  'react'                   
       │                                             
       ▼                                             
  executeReactMode()                                    
       │                                             
       ▼                                             
  buildQueryStrategy()  →  primaryQuery = ""  💥       
       │                                             
       ▼                                             
  ReAct 循环 (3次迭代)  →  全部失败, 143秒          
       │                                             
       ▼                                             
  ChatRoute 直接检索 "加班"  →  8条结果 ✓           
```

## Goals / Non-Goals

**Goals:**
- 低置信度查询（< 0.3）跳过 Agent 循环，直接用原始查询检索
- 保持医学查询的完整 Agent 流程不变
- 减少非医学查询的响应时间（从 ~143秒 → ~2秒）
- 提供可配置的置信度阈值

**Non-Goals:**
- 不修改实体识别器的词典匹配逻辑
- 不修改 `buildQueryStrategy()` 的返回结构
- 不改变现有的 ReAct 或 Planning 模式逻辑

## Decisions

### Decision 1: 入口判断位置

**选择**: 在 `AgentExecutor.run()` 的实体识别之后、模式选择之前增加判断

**理由**:
- 此时已有 `entities.confidence` 信息可供判断
- 避免进入任何 Agent 模式（ReAct/Planning）的初始化开销
- 保留完整的可视化事件流（仍发送 `agent:input`, `agent:entities`, `agent:mode`, `agent:complete`）

**替代方案**:
- 在 `chooseExecutionMode()` 内部判断：会增加复杂度，混合了不同层面的判断逻辑
- 在 `executeReactMode()` 内部判断：已经进入了 ReAct 流程，部分初始化开销已发生

### Decision 2: 直接检索流程

**选择**: 新增 `executeDirectRetrieval()` 方法，完整实现检索+生成答案

**理由**:
- 保持代码结构清晰，与 `executeReactMode()` 和 `executePlanningMode()` 平行
- 独立的执行路径便于测试和维护
- 可以独立调整检索参数（如 topK）

**替代方案**:
- 复用 `executeReactMode()` 但限制迭代次数为1：会保留不必要的 LLM think/decide 调用
- 直接返回空结果让 ChatRoute 处理：浪费了 Agent 的答案生成能力

### Decision 3: 阈值配置

**选择**: 新增 `lowConfidenceThreshold` 配置项，默认值 0.3

**理由**:
- `calculateConfidence()` 函数对 `entityCount === 0` 返回 0.2
- 0.3 是合理的分界点：无实体查询（0.2）触发直接检索，单实体查询（0.5）进入 Agent 流程
- 可配置允许用户根据实际需求调整

**替代方案**:
- 固定阈值不提供配置：不够灵活
- 使用 `confidenceThreshold`（现有配置）：该配置用于 ReAct 循环中的满意度判断，语义不同

### Decision 4: 可视化事件

**选择**: 发送新的 `agent:mode` 事件，`mode: 'direct_retrieval'`

**理由**:
- 前端需要知道当前执行的是什么模式
- 与现有 `agent:mode` 事件格式一致
- 前端可以根据模式显示不同的可视化内容

## Risks / Trade-offs

### Risk: 阈值过高导致医学查询被误判

**Mitigation**: 默认阈值 0.3，单实体查询置信度为 0.5，不会被误判。用户可通过配置调整。

### Risk: 非医学查询但需要多轮检索的场景

**Mitigation**: 直接检索返回结果后，ChatRoute 的 LLM 生成可以基于结果回答。如果答案不满意，用户可以追问。

### Trade-off: 复杂非医学查询可能需要更多检索

直接检索只用一次检索，不支持查询扩展。但考虑到：
- 这类查询本身就是 Agent 不擅长处理的
- 单次检索通常能找到足够相关的内容
- 如需更多检索，用户可以追问

接受这个 trade-off 以换取响应时间的大幅改善。