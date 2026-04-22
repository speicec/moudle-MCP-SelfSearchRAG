---
name: check
description: Use when performing code quality checks or requirement reviews. Supports subcommands for precheck, six-dimensional review, and seven code check dimensions. Reports persisted to context/review/.
---

# /check 命令系统

## 概述

统一的代码质量检查入口，支持多子命令的检查维度，覆盖从需求评审到代码审查的全流程。

**核心原则：** 检查必须基于证据，报告必须持久化追踪。

## 命令矩阵

| 命令 | 类型 | 执行方式 | 必须 |
|------|------|----------|------|
| `/check` | 预检 | 单 Agent | - |
| `/check:review` | 需求六维评审 | 单 Agent | ✓ |
| `/check:design` | 设计一致性 | 组合 Agent | - |
| `/check:security` | 安全检查 | 组合 Agent | - |
| `/check:concurrency` | 并发检查 | 组合 Agent | - |
| `/check:complexity` | 复杂度检查 | 组合 Agent | - |
| `/check:error` | 错误处理检查 | 组合 Agent | - |
| `/check:auxiliary` | 辅助检查 | 组合 Agent | - |
| `/check:code-reviewer` | 总体质量评审 | 单 Agent | ✓ |
| `/check --all` | 7维组合检查 | 组合 Agent | - |
| `/check:dim1,dim2,...` | 自定义组合 | 组合 Agent | - |

## 执行流程

### 1. 解析命令参数

```
/check               → 执行预检 (precheck-agent.md)
/check:review        → 执行六维需求评审 (review-agent.md)
/check:code-reviewer → 执行总体质量评审 (code-reviewer-agent.md)
/check --all         → 执行7维组合检查 (组合调用7个agent)
/check:design,security → 执行指定维度组合
/check:xxx           → 执行对应维度检查
```

### 2. 加载必要上下文

- Git 状态 (所有命令)
- OpenSpec 状态 (review 命令)
- 设计文档 (design/code-reviewer 命令)
- 待审查文件列表 (代码检查命令)

### 3. 构造 Agent 提示词

根据命令类型加载对应的 agent 模板，填充上下文变量。

### 4. 调用 Agent

使用 Agent 工具，subagent_type: "general-purpose"，设置合理超时。

### 5. 输出报告

格式化 Agent 返回结果，持久化到 `context/review/<timestamp>-<command>-<target>.md`。

## 报告持久化

**目录:** `context/review/`
**命名格式:** `YYYY-MM-DD-HHmm-<command>-<target>.md`

**示例:**
- `2026-04-22-1530-precheck-default.md`
- `2026-04-22-1530-review-agent-planning.md`
- `2026-04-22-1530-all-code-review.md`

## 推荐执行顺序

```
需求阶段 → /check:review (必须)
实现阶段 → /check --all (可选)
完成阶段 → /check:code-reviewer (必须)
```

## 子命令详解

### /check (预检)

快速扫描当前工作状态，发现潜在问题入口点。

**检查内容:**
- Git 状态 (分支、变更、与主分支差异)
- OpenSpec 状态 (如果存在)
- 文件变更快速扫描
- 下一步建议

**Agent:** precheck-agent.md

### /check:review (六维需求评审)

对 OpenSpec change 文档进行全方位评审，生成加权综合评分。

**六维度:**
| 维度 | 权重 | 检查内容 |
|------|------|----------|
| 完整性 | 0.25 | 功能需求、背景、非功能需求、验收标准 |
| 一致性 | 0.20 | 内部矛盾、规范冲突、历史需求冲突 |
| 可追溯性 | 0.15 | 需求来源、命名ID、变更历史 |
| 质量 | 0.20 | 模糊词语、指标量化、可测试性 |
| 模板符合度 | 0.10 | 标准结构、必填章节、格式规范 |
| 上下文引用 | 0.10 | SOP引用、经验引用、规范引用 |

**综合得分阈值:**
- ≥85: 通过
- 70-84: 有条件通过
- 50-69: 需修订
- <50: 不通过

**Agent:** review-agent.md

### /check:design

验证代码实现是否遵循设计文档约定。

**检查内容:**
- 接口契约一致性
- 数据结构一致性
- 组件关系一致性
- 状态/流程一致性

**Agent:** design-agent.md

### /check:security

检查安全问题。

**检查内容:**
- 输入校验
- SQL 注入
- XSS/注入攻击
- 敏感信息泄露
- 权限校验
- 加密/哈希

**Agent:** security-agent.md

### /check:concurrency

检查并发问题。

**检查内容:**
- 竞态条件
- 死锁风险
- 资源泄露
- Channel 使用
- 并发安全模式

**Agent:** concurrency-agent.md

### /check:complexity

检查代码复杂度。

**检查内容:**
- 圈复杂度 (阈值: 10)
- 认知复杂度 (阈值: 15)
- 函数长度 (阈值: 50)
- 嵌套深度 (阈值: 4)
- 分支数量 (阈值: 10)
- 参数数量 (阈值: 4)

**Agent:** complexity-agent.md

### /check:error

检查错误处理。

**检查内容:**
- 错误忽略
- 错误包装
- Panic/throw 使用
- Recover/catch 配对
- 错误传播
- 错误处理模式

**Agent:** error-agent.md

### /check:auxiliary

检查辅助项。

**检查内容:**
- 代码规范
- 性能问题
- 可维护性
- 测试覆盖
- 文档完整性

**Agent:** auxiliary-agent.md

### /check:code-reviewer

总体质量评审，综合评审代码质量，必要时结合设计文档进行契约一致性校验。

**检查内容:**
- 总体架构评审
- 代码质量综合
- 契约一致性校验
- 优先级分类 (Critical/Important/Minor)
- 行动建议

**Agent:** code-reviewer-agent.md

## 组合执行

### /check --all

执行 7 维代码检查组合 (design + security + concurrency + complexity + error + auxiliary + code-reviewer)。

使用单 Agent 内部并行处理，输出综合报告。

### /check:dim1,dim2,...

执行指定维度组合，如 `/check:security,concurrency`。

## 常见错误

**错误做法:** 跳过 `/check:review` 直接进入实现
**正确做法:** 需求评审通过后再实现

**错误做法:** 只执行 `/check:review` 不执行 `/check:code-reviewer`
**正确做法:** 完成阶段必须执行总体评审

**错误做法:** 报告未持久化
**正确做法:** 所有报告写入 `context/review/`