# AI协作开发方法论

> 基于 SelfSearchRAG 项目实践提炼的系统化方法论
> 15+次变更迭代 | 600+任务验证 | 可直接复用

---

## 核心原则

**分离思考与实现**：AI在写代码之前，先完成思考和文档化。

```
效率公式：AI协作效率 = 上下文质量 × 任务粒度 × 决策可追溯性

上下文质量 = design.md的决策文档化程度
任务粒度   = tasks.md的任务原子化程度
决策可追溯 = 归档文档的完整性
```

---

## 为什么需要方法论

### 传统AI编码的痛点

| 痛点 | 表现 | 后果 |
|------|------|------|
| 范围蔓延 | AI擅自添加功能 | 实现偏离需求 |
| 架构猜测 | AI猜测设计模式 | 代码不符合项目风格 |
| 半途而废 | 任务太大无法完成 | 功能不完整 |
| 决策丢失 | 不知道为什么这样实现 | 面试无法解释 |
| 上下文丢失 | 每次对话从头开始 | 知识无法积累 |

### 方法论解决什么

| 问题 | 方法论解决方案 |
|------|---------------|
| 范围蔓延 | proposal.md的Non-Goals明确边界 |
| 架构猜测 | design.md的决策文档化 |
| 半途而废 | tasks.md的原子任务分解 |
| 决策丢失 | 归档文档保存所有决策 |
| 上下文丢失 | 每次对话可引用归档文档 |

---

## 四阶段工作流

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│   EXPLORE        PROPOSE         APPLY           ARCHIVE                        │
│   ────────       ────────        ─────           ───────                        │
│                                                                                  │
│   思考阶段       规划阶段        实施阶段        归档阶段                         │
│                                                                                  │
│   • 不写代码     • 不写代码      • 写代码        • 保存文档                       │
│   • 读文件       • 创建文档      • 逐任务        • 更新specs                      │
│   • 画图         • 记录决策      • 标记[x]       • 追溯历史                       │
│   • 提问         • 原子任务      • 验证完成      • 知识积累                       │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

| 阶段 | 命令 | 目的 | AI行为 | 产出 |
|------|------|------|--------|------|
| EXPLORE | `/opsx:explore` | 理解问题 | 读文件、画图、提问 | 无代码产出 |
| PROPOSE | `/opsx:propose` | 规划方案 | 创建文档体系 | proposal, design, tasks |
| APPLY | `/opsx:apply` | 执行实现 | 写代码、逐任务执行 | 功能代码 |
| ARCHIVE | `openspec archive` | 保存历史 | 归档、更新specs | 可追溯的知识 |

---

## 编码特质（核心）

方法论固化的五大编码特质：

| 特质 | 定义 | 为什么重要 |
|------|------|-----------|
| **测试先行** | 先写测试再写功能 | 防止功能偏离，确保可验证 |
| **主动测试** | 完成后主动运行验证 | 防止"我觉得完成了" |
| **遵循规范** | 遵守项目已有规范 | 保持代码一致性 |
| **诚实查询** | 不猜测，先查证 | 防止基于错误假设实现 |
| **谨慎重构** | 小步重构，不破坏 | 防止大规模改动失控 |

详见 [coding-traits.md](./coding-traits.md)

---

## 文档体系

```
openspec/changes/<变更名>/
│
│   proposal.md ─────── 为什么做、做什么
│       │
│       │  防止范围蔓延
│       │
│       ▼
│   design.md ───────── 怎么做、为什么这么选
│       │
│       │  防止架构猜测（关键文档）
│       │
│       ▼
│   specs/<能力>/spec.md ── SHALL规范、WHEN/THEN场景
│       │
│       │  防止行为偏离
│       │
│       ▼
│   tasks.md ────────── 原子任务、验证标准
│       │
│       │  防止半途而废
│       │
│       ▼
│   .openspec.yaml ──── 变更元数据
```

详见各文档详解：
- [workflow-phases.md](./workflow-phases.md) - 四阶段完整流程
- [artifact-templates.md](./artifact-templates.md) - 各文档模板速查
- [decision-documentation.md](./decision-documentation.md) - 决策记录方法
- [task-granularity.md](./task-granularity.md) - 任务原子化原则

---

## Agent.md模板

可复用的Agent配置模板，固化AI行为规范：

详见 [agent-template.md](./agent-template.md)

**使用方式**：
1. 复制模板到项目 `.claude/AGENT.md`
2. 填写项目背景部分
3. AI对话时自动遵循规范

---

## 快速开始

### 1. 安装OpenSpec CLI

```bash
npm install -g openspec-cli
```

### 2. 初始化项目

```bash
openspec init
```

这会创建：
```
openspec/
├── config.yaml      # 项目配置
├── specs/           # 能力规范目录
└── changes/         # 变更目录
```

### 3. 配置Claude技能

复制 `.claude/` 目录：
```
.claude/
├── commands/opsx/   # 命令定义
│   ├── explore.md
│   ├── propose.md
│   ├── apply.md
│   └── archive.md
└── skills/          # 技能定义
    ├── openspec-explore/
    ├── openspec-propose/
    └── openspec-apply-change/
```

### 4. 开始工作流

```bash
# 探索想法
/opsx:explore 我想加一个用户认证功能

# 创建提案
/opsx:propose add-user-auth

# 开始实施
/opsx:apply add-user-auth

# 完成归档
openspec archive add-user-auth
```

---

## 方法论价值矩阵

| 挑战 | 传统AI编码 | 本方法论 |
|------|-----------|---------|
| 范围蔓延 | AI擅自加功能 | Non-Goals明确界限 |
| 架构猜测 | AI猜测设计模式 | design.md有图有决策 |
| 半途而废 | 任务太大卡住 | tasks.md原子化 |
| 上下文丢失 | 每次对话从头 | 归档文档可引用 |
| 面试无法解释 | 不知道为什么 | 决策文档化 |
| Bug排查困难 | 不知设计意图 | 理解原始决策 |

---

## 文档索引

| 文档 | 内容 | 用途 |
|------|------|------|
| [README.md](./README.md) | 方法论概述 | 入口文档 |
| [workflow-phases.md](./workflow-phases.md) | 四阶段详解 | 理解流程 |
| [artifact-templates.md](./artifact-templates.md) | 文档模板 | 快速创建 |
| [decision-documentation.md](./decision-documentation.md) | 决策方法 | 记录选择 |
| [task-granularity.md](./task-granularity.md) | 任务分解 | 原子化技巧 |
| [coding-traits.md](./coding-traits.md) | 编码特质 | 固化行为 |
| [agent-template.md](./agent-template.md) | Agent模板 | 配置AI |

---

## 本方法论验证数据

来源：SelfSearchRAG项目实践

- **变更次数**：15+次完整变更
- **任务完成**：600+任务 [x] 标记
- **文档行数**：1,455行tasks记录
- **面试效果**：每个决策可解释（见 `docs/QA-Interview/interview-ai-coding.md`）

---

## License

MIT - 可自由使用、修改、传播