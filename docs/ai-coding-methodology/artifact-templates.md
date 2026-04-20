# 文档模板速查

> 各文档的标准模板，可直接复制使用

---

## proposal.md 模板

```markdown
## Why

[痛点描述：用户遇到什么问题？为什么需要这个变更？]

示例：
> 当前embedding模型延迟加载导致用户首次上传文档时等待数分钟，
> 给用户造成系统"坏了"的印象。

## What Changes

- **[变更点1]**：[描述]
- **[变更点2]**：[描述]
- **[变更点3]**：[描述]

示例：
- **模型预加载**：启动时加载而非首次请求
- **进度反馈**：WebSocket广播加载进度

## Capabilities

### New Capabilities

- `capability-name`: [能力描述]

示例：
- `startup-progress`: 模型预加载和启动状态报告

### Modified Capabilities

- `existing-capability`: [修改内容]

示例：
- `websocket-protocol`: 添加 startup:progress 等事件类型

## Impact

- **Files Modified**:
  - `path/to/file.ts` - [修改内容]
  - `path/to/file.ts` - [修改内容]

- **Files Added**:
  - `path/to/new-file.ts` - [文件作用]

- **Dependencies**: [依赖变化或"无"]

- **User Experience**: [用户体验变化]
```

---

## design.md 模板

```markdown
## Context

### 当前架构现状

[ASCII图展示当前状态]

示例：
```
Document → Split(512 tokens) → Chunks → Embed → Index

问题：
• 语义边界被切断
• 检索结果碎片化
```

### 约束条件

- [约束1：技术限制]
- [约束2：兼容性要求]
- [约束3：资源限制]

示例：
- 使用本地embedding模型（无API成本）
- 需要保持现有检索接口不变

## Goals / Non-Goals

**Goals:**
- [目标1]
- [目标2]
- [目标3]

**Non-Goals:**
- [不做的事情1]
- [不做的事情2]

示例：
**Goals:**
- 实现基于embedding相似度的语义分块
- 识别语义边界（断崖检测）

**Non-Goals:**
- 不实现GPU加速
- 不修改embedding模型配置

## Decisions

### Decision 1: [决策主题]

**选择**: [具体选择]

**理由**:
1. [理由1]
2. [理由2]

**备选方案**:
1. ❌ [方案A] → [为什么放弃]
2. ✅ [方案B] → [为什么选择]
3. ❌ [方案C] → [为什么放弃]

示例：
### Decision 1: 断崖检测阈值

**选择**: similarityThreshold = 0.7

**理由**:
- 低于0.7表示相邻内容语义不相关
- 经测试在多种文档类型表现稳定

**备选方案**:
1. ❌ 0.6 → 过敏感，产生过多分割
2. ✅ 0.7 → 平衡敏感度和稳定性
3. ❌ 0.8 → 不敏感，语义边界被忽略

### Decision 2: [决策主题]

[同上结构]

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| [风险1] | [缓解措施1] |
| [风险2] | [缓解措施2] |

示例：
| Risk | Mitigation |
|------|------------|
| 模型下载失败 | 显示错误+重试按钮 |
| 长文档处理慢 | 显示进度百分比 |

## Architecture

[ASCII图展示新架构]

示例：
```
           启动流程
           
npm run setup              npm run start:server
    │                           │
    ▼                           ▼
[download-models]          [http-server]
    │                           │
    ├─ Check cache              ├─ Start server
    ├─ Download missing         ├─ preloadModels()
    └─ Progress bar             │
    │                           ├─ Broadcast progress
    ▼                           ├─ Load models
Models cached ✓               ├─ Broadcast ready
                              │
                              ▼
                          Server ready ✓
```
```

---

## tasks.md 模板

```markdown
## 1. [阶段名称]

- [ ] 1.1 [任务描述 - 单文件单功能]
- [ ] 1.2 [任务描述]
- [ ] 1.3 [任务描述]

## 2. [阶段名称]

- [ ] 2.1 [任务描述]
- [ ] 2.2 [任务描述]

## N. Verification

- [ ] N.1 [验证任务 - 有具体命令和标准]
- [ ] N.2 [验证任务]
- [ ] N.3 [验证任务]

## Notes

[实施过程中的笔记，完成后填写]

示例：
## Notes

实施完成于 2026-04-20.
- N.1: 进度条正确显示 ✓
- N.2: WebSocket广播正常 ✓
- N.3: 首次上传响应时间 0.011s ✓
```

---

## specs/spec.md 模板

```markdown
## ADDED Requirements

### Requirement: [能力名称]

The system SHALL [做什么].

#### Scenario: [场景名]

- **WHEN** [触发条件]
- **THEN** [期望结果]

示例：
### Requirement: Semantic-based document chunking

The system SHALL chunk documents based on semantic boundaries.

#### Scenario: Semantic boundary detection

- **WHEN** a document is processed by the semantic chunker
- **THEN** the system identifies semantic boundaries where
  embedding similarity drops significantly

#### Scenario: Boundary-aligned chunking

- **WHEN** semantic boundaries are detected
- **THEN** the system creates chunks aligning with these boundaries

#### Scenario: No-cliff fallback

- **WHEN** no significant semantic cliffs are detected
- **THEN** the system applies fallback chunking at max length

### Requirement: [第二个能力]

[同上结构]

## REMOVED Requirements

(如果有能力被移除)

### Requirement: [能力名称]

This capability is no longer needed because [原因].
```

---

## 模板使用指南

### 选择使用哪个模板

| 情况 | 需要的文档 |
|------|-----------|
| 新功能 | proposal + design + tasks + specs |
| Bug修复 | proposal + design + tasks（精简版） |
| 小改动 | proposal + tasks（可省略design） |
| 重构 | proposal + design（详细） + tasks |

### proposal精简版（Bug修复）

```markdown
## Why

[Bug描述：什么问题、影响什么]

## What Changes

- **修复点**: [描述]

## Impact

- **Files Modified**: [文件列表]
```

### design精简版（Bug修复）

```markdown
## Context

[问题根因分析]

## Decisions

### Decision: [修复方案]

**选择**: [修复方式]
**理由**: [为什么这样修]
```

---

## 文档填写原则

### proposal原则

1. **Why要具体**：不要"优化性能"，要说"首次请求等待3分钟"
2. **What要量化**：不要"改进体验"，要说"响应时间<0.1s"
3. **Impact要列举**：具体列出要改的文件

### design原则

1. **画图优于文字**：ASCII图比段落更清晰
2. **决策要有备选**：不能只写"选择了X"，要写"放弃Y的原因"
3. **风险要具体**：不要写"可能出错"，要写"模型下载失败怎么办"

### tasks原则

1. **原子化**：一个任务不超过30分钟
2. **可验证**：每个任务有成功标准
3. **编号**：用1.1, 1.2便于追踪

### specs原则

1. **SHALL语气**：用"SHALL"而非"应该"
2. **WHEN/THEN**：行为规范用场景描述
3. **可测试**：场景应该能转化为测试用例