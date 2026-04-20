# Agent.md 模板

> 可直接复制使用的AI协作Agent配置模板
> 固化编码特质和工作流程

---

## 使用说明

### 快速使用

1. 复制下方模板内容
2. 创建 `.claude/AGENT.md` 文件
3. 填写 `[项目名]` 和 `[项目背景]` 部分
4. 根据项目调整其他内容

### 模板位置

推荐放在：
```
.claude/AGENT.md    # Claude Code会自动读取
```

---

## 完整模板

```yaml
---
name: [项目名]-agent
description: [项目名]的AI协作Agent，遵循测试先行、主动测试、遵循规范、诚实查询、谨慎重构特质
---

# [项目名] AI协作Agent

## 项目背景

[填写项目描述]

示例：
> SelfSearchRAG 是一个增强型多模态RAG系统，核心解决：
> 1. 传统RAG固定切分导致检索碎片化
> 2. 扫描文档/图表无法被理解检索
>
> 技术栈：TypeScript + Qdrant + bge-m3 + DeepSeek + MCP协议

### 技术栈

[填写技术栈]

示例：
- 语言：TypeScript
- 前端：React + Vite
- 后端：Fastify
- 向量数据库：Qdrant
- 嵌入模型：本地 Transformers.js

### 目录结构

[填写主要目录]

示例：
```
src/
├── core/           # Harness框架、Pipeline编排
├── parsers/        # PDF解析、OCR服务
├── chunking/       # 语义分块、层级存储
├── embedding/      # 嵌入生成
├── retrieval/      # 检索引擎
├── server/         # HTTP/WebSocket服务
└── frontend/       # React界面
```

---

## 编码特质

### 1. 测试先行（Test First）

**定义**：先写测试，再写功能。

IMPLEMENT前必须：
- 检查是否有测试文件
- 如果没有，先创建测试
- 测试定义预期行为
- 再实现功能

流程：
```
✓ 读需求 → 写测试 → 实现功能 → 测试通过
❌ 读需求 → 实现功能 → 写测试（如果时间允许）
```

### 2. 主动测试（Active Test）

**定义**：完成后主动运行验证。

标记 [x] 前必须：
- 运行相关测试
- 观察测试结果
- 确认测试通过
- 才能标记 [x]
- 记录 Notes

流程：
```
✓ 实现代码 → 运行测试 → 测试通过 → 标记[x] → 记录Notes
❌ 实现代码 → 标记[x] → (没有运行测试)
```

如果测试失败：
```
✓ 修复问题 → 重新测试 → 通过 → 标记[x]
❌ 标记[x] → 说"可能有小问题"
```

### 3. 遵循规范（Follow Specs）

**定义**：遵守项目已有规范和模式。

IMPLEMENT前必须：
- 读 CLAUDE.md（如果有）
- 读 openspec/specs/（如果有相关能力规范）
- 读类似功能的现有代码
- 理解项目模式和风格

遵循内容：
- 命名规范：变量/函数/文件的命名方式
- 代码风格：缩进、注释、import方式
- 架构模式：service/handler/store分层
- 错误处理：项目如何处理异常
- 测试风格：测试文件结构和命名

### 4. 诚实认真查询（Honest Query）

**定义**：不确定就先查证，不猜测。

遇到不确定时：
- 停止实现
- 使用工具查证：
  - Read：读相关代码
  - Grep：搜索关键词
  - Glob：搜索文件
  - Bash：运行命令查看
- 获得确定信息
- 再继续实现

常见不确定场景：
| 不确定 | 查证方法 |
|--------|---------|
| 函数存在吗？ | `Grep pattern: "functionName"` |
| 函数签名？ | `Read file.ts` |
| 参数默认值？ | `Grep pattern: "paramName"` |
| 依赖版本？ | `Read package.json` |

### 5. 谨慎重构（Safe Refactor）

**定义**：小步重构，不破坏。

重构原则：
- 保持接口不变
- 单文件修改
- 每步验证
- 不删除代码（先标记 @deprecated）

重构流程：
```
Step 1: 分析现有代码
Step 2: 设计新结构（保持接口）
Step 3: 单文件迁移
Step 4: 验证不破坏
Step 5: 继续下一个
```

禁止：
- ❌ 同时修改多个文件
- ❌ 修改接口签名
- ❌ 删除现有代码（未deprecated）
- ❌ 未验证就继续

---

## 工作流程

### 四阶段流程

```
EXPLORE → PROPOSE → APPLY → ARCHIVE
```

| 阶段 | 目的 | AI行为 |
|------|------|--------|
| EXPLORE | 理解问题 | 读文件、画图、提问、不写代码 |
| PROPOSE | 规划方案 | 创建proposal/design/tasks |
| APPLY | 执行实现 | 逐任务执行、标记[x]、验证 |
| ARCHIVE | 保存历史 | 归档文档、更新specs |

### EXPLORE阶段

行为：
- 使用 Read 读相关代码
- 使用 ASCII图 解释架构
- 使用 AskUserQuestion 澄清需求
- **不写代码**

结束条件：
- 问题理解清晰（用户确认）
- 有明确的方案倾向

### PROPOSE阶段

产出：
- proposal.md：Why/What
- design.md：How/Why-Not（最重要）
- specs/spec.md：What-Shall
- tasks.md：When/Verified

design.md关键：
- 每个决策：Choice + Rationale + Alternatives
- ASCII架构图
- Goals/Non-Goals边界

### APPLY阶段

行为：
- 读 design.md 获取决策
- 读 tasks.md 获取任务列表
- 逐任务执行
- 每完成一个标记 [x]
- 验证后才能标记

原子任务原则：
- 单文件单功能
- <30分钟
- 可验证

### ARCHIVE阶段

```bash
openspec archive <变更名>
```

价值：
- 保留决策历史
- 供未来AI引用
- 用户面试可解释

---

## 文档规范

### proposal.md

```markdown
## Why
[痛点描述]

## What Changes
- [变更点1]
- [变更点2]

## Capabilities
### New Capabilities
- `capability-name`: [描述]

## Impact
- **Files Modified**: [文件列表]
- **Files Added**: [新文件列表]
```

### design.md

```markdown
## Context
[ASCII图展示当前状态]

## Goals / Non-Goals
**Goals:**
- [目标]
**Non-Goals:**
- [不做的事]

## Decisions
### Decision N: [主题]
**选择**: [具体选择]
**理由**: [为什么]
**备选方案**:
1. ❌ [方案A] → [原因]
2. ✅ [方案B] → [原因]

## Risks / Trade-offs
| Risk | Mitigation |
|------|------------|
```

### tasks.md

```markdown
## 1. [阶段]
- [ ] 1.1 [原子任务]
- [ ] 1.2 [原子任务]

## N. Verification
- [ ] N.1 [验证命令] + [期望结果]

## Notes
实施完成于 YYYY-MM-DD.
- N.1: [实际结果] ✓
```

---

## 禁止行为

### 绝对禁止

```
❌ EXPLORE阶段写代码
❌ 未查证就猜测实现
❌ 未测试就标记 [x]
❌ 同时修改多个文件（重构）
❌ 修改接口签名（重构）
❌ 删除未deprecated代码
❌ 擅自添加功能（超出proposal范围）
```

### 相对禁止

```
⚠️ 大任务（>30分钟）应分解
⚠️ 模糊描述应有验证标准
⚠️ 不确定应暂停查证
⚠️ 遇到问题应报告而非跳过
```

---

## 特殊处理

### 遇到问题

```
1. 暂停当前任务
2. 描述问题
3. 提出可能的解决方案
4. 等待用户确认
5. 继续实施
```

示例：
```
AI: 任务2.3遇到问题

问题：API调用返回格式与预期不符

可能原因：
1. API版本差异
2. 参数传递错误
3. 文档过时

建议：
1. 读API源码确认
2. 打印实际返回值

等待用户确认...
```

### 需要澄清

```
1. 使用 AskUserQuestion
2. 列出选项
3. 等待选择
4. 继续实施
```

示例：
```
AI: 任务3.1需要澄清

问题：新组件放在哪个目录？

选项：
1. src/frontend/components/（现有组件目录）
2. src/components/（新建顶层目录）

等待选择...
```

---

## 验证标准

### 功能验证

- [ ] 运行测试：`npm test`
- [ ] 类型检查：`npm run typecheck`
- [ ] 启动服务：`npm run dev`
- [ ] 手动测试：[具体操作]

### 性能验证（如需要）

- [ ] 响应时间：[阈值]
- [ ] 内存占用：[阈值]
- [ ] 并发测试：[条件]

### Notes格式

```markdown
## Notes

实施完成于 YYYY-MM-DD.
- N.1: [实际结果] ✓
- N.2: [实际结果] ✓（或有说明）
```

---

## 项目特定配置

[根据项目填写]

示例：
```markdown
### 测试命令
npm test              # 运行所有测试
npm run typecheck     # TypeScript检查
npm run lint          # ESLint检查

### 启动命令
npm run dev           # 开发模式
npm run start:server  # 仅后端
npm run start:frontend # 仅前端

### 特殊目录
openspec/changes/     # 变更提案
openspec/specs/       # 能力规范
```
```

---

## 精简模板（最小版本）

如果项目较小，可以使用精简版：

```yaml
---
name: my-project-agent
---

# 项目背景

[一句话描述项目]

## 编码特质

1. **测试先行**：先写测试再写功能
2. **主动测试**：完成后主动验证才能标记[x]
3. **遵循规范**：读现有代码，遵守项目模式
4. **诚实查询**：不确定先Read/Grep查证
5. **谨慎重构**：单文件修改，保持接口

## 工作流程

EXPLORE(不写代码) → PROPOSE(写文档) → APPLY(逐任务) → ARCHIVE

## 禁止

- ❌ EXPLORE写代码
- ❌ 未测试标记[x]
- ❌ 猜测而非查证
- ❌ 同时改多个文件
```

---

## 定制指南

### 需要定制的部分

| 部分 | 定制内容 |
|------|---------|
| 项目背景 | 填写项目描述、技术栈、目录 |
| 项目特定配置 | 测试命令、启动命令 |
| 可选：删除不适用的特质 | 如项目无测试，可删除测试先行 |

### 必须保留的部分

| 部分 | 原因 |
|------|------|
| 编码特质定义 | 核心价值 |
| 工作流程四阶段 | 方法论基础 |
| 禁止行为清单 | 防止问题 |

---

## 验证模板完整性

创建后检查：

```
□ 有项目背景描述
□ 有技术栈说明
□ 五个编码特质完整
□ 四阶段流程完整
□ 禁止行为清单完整
□ 文档规范有示例
□ 项目特定配置已填写
```

---

## 与Claude技能配合

Agent.md + Claude技能 = 完整工作流：

| Agent.md | Claude技能 | 作用 |
|----------|-----------|------|
| 定义特质 | openspec-explore | 固化EXPLORE行为 |
| 定义流程 | openspec-propose | 固化PROPOSE行为 |
| 定义验证 | openspec-apply | 固化APPLY行为 |

建议同时配置：
- `.claude/AGENT.md`（本文模板）
- `.claude/skills/openspec-*/`（技能定义）
- `.claude/commands/opsx/*.md`（命令定义）