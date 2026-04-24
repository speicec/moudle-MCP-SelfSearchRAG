## Why

后端 `evidence-evaluator.ts` 已实现完整的 GRADE 循证医学评估体系（文献类型识别、权威性分级、时效性评估、综合评分计算），但前端 `EvidencePanel.tsx` 只使用 `similarityScore` 的简单阈值映射显示 A-D 等级。数据在 `AgentExecutor.buildResult()` → WebSocket 事件 → 前端 `RetrievalResultItem` 这条路径中断层，导致用户看到的是"检索匹配度"而非真实的"循证医学证据等级"。

**问题本质**：后端有高质量的 GRADE 数据，但没有传到前端；前端自己做了简单的分数映射，两个体系互不关联。

**Why now**：用户在医学场景中需要看到真实的证据等级（如"这是 RCT 研究级别证据"而非"匹配度 85%"），这是医学 AI 应用可信度的关键要素。

## What Changes

- **扩展 AgentResult 数据结构**：在 `AgentExecutor.buildResult()` 中包含 `evidenceEvaluation` 数组
- **扩展 WebSocket 事件**：`generation:complete` 和 `retrieval:complete` 事件包含每个结果的 GRADE 评估
- **扩展 API 响应类型**：`RetrievalResultItem` 接口新增 `evidenceEvaluation` 字段
- **修改前端 EvidenceCard**：优先使用后端 GRADE 数据，fallback 到 similarityScore 阈值
- **新增 EvidenceCard 展示字段**：显示文献类型、权威性级别、时效性警告等

## Capabilities

### New Capabilities
- `grade-evidence-display`: 前端展示 GRADE 循证医学证据等级的能力，包括文献类型、权威性、时效性等元数据

### Modified Capabilities
- `websocket-protocol`: WebSocket 事件需要扩展，`retrieval:complete` 和 `generation:complete` 事件携带 GRADE 评估数据
- `frontend-ui`: `EvidenceCard` 组件需要支持 GRADE 数据渲染，显示更丰富的证据信息

## Impact

**Backend**:
- `src/medical/agent/AgentExecutor.ts` - `buildResult()` 方法
- `src/medical/agent/types.ts` - `AgentResult` 接口
- `src/server/types.ts` - `RetrievalResultItem` 接口
- `src/server/routes/chat.ts` - WebSocket 事件发射
- `src/server/agent-emitter.ts` - AgentEmitter 事件结构

**Frontend**:
- `src/frontend/components/EvidencePanel.tsx` - EvidenceCard 组件
- `src/frontend/store/index.ts` - RetrievalResult 类型
- `src/frontend/types/visualization.ts` - 可能需要扩展

**API Compatibility**:
- 新字段均为可选，向后兼容
- 前端无 GRADE 数据时自动 fallback 到 similarityScore 阈值