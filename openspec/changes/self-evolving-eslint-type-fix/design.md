## Context

项目已有严格 TypeScript 配置和 MCP Server 架构。当前 ESLint 使用 `@typescript-eslint/eslint-plugin` 的推荐规则，但只报错不提供修复建议。

Agent 编码时遇到类型错误需要：
1. 知道有哪些规则存在
2. 获取具体修复建议
3. 一键应用修复
4. 记录学习以便下次优先推荐

关键约束：CLAUDE.md 不能太长，否则会导致上下文漂移（Agent 在长对话中"忘记"早期规则）。

## Goals / Non-Goals

**Goals:**
- 触发器模式 CLAUDE.md（仅 10 tokens），避免上下文漂移
- 自定义 ESLint 规则检测 nullable 赋值错误，错误消息内嵌 MCP Tool 提示
- MCP Tool 提供修复建议和统计记录
- 统计驱动的修复建议优先级排序
- 三重触发保障确保 Agent 不遗漏调用

**Non-Goals:**
- 不覆盖所有 TypeScript 错误类型（先实现 TS2322 null-assignment）
- 不使用向量数据库存储规则（用文件存储，足够简单）
- 不自动应用修复（Agent 选择后手动确认）

## Decisions

### Decision 1: ESLint 规则方案 - 独立自定义规则

**选择**: 方案 A（独立自定义 ESLint 规则）

**理由**:
| 方案 | 控制权 | 知识库集成 | Agent 预读取 |
|------|--------|-----------|-------------|
| A 独立规则 | ✅ 完全控制 | ✅ 直接调用 | ✅ 规则文件即知识 |
| B 包装 tsc | ❌ 依赖 tsc | 需桥接 | 需额外存储 |

**核心 API**:
```typescript
const parserServices = ESLintUtils.getParserServices(context);
const checker = parserServices.program.getTypeChecker();
const type = checker.getTypeAtLocation(tsNode);
checker.isTypeAssignableTo(sourceType, targetType);
```

### Decision 2: CLAUDE.md 设计 - 触发器模式

**选择**: 触发器模式（10 tokens）

**理由**:
| 方案 | 项目上下文 tokens | 效率 |
|------|------------------|------|
| 段落描述 | 500 | ❌ 高消耗 |
| 表格索引 | 75 | ⚠ 中等 |
| 触发器模式 | 10 | ✅ 最优 |

**触发器内容**:
```markdown
TS error → `type_fix(error_code)`
```

**三重触发保障**:
1. CLAUDE.md 触发器（Agent 进入项目时看到）
2. MCP Tool 描述（Agent 列出 tools 时看到）
3. ESLint 错误消息内嵌 `💡 Fix: type_fix(2322)`

### Decision 3: 知识库存储 - 分层文件存储

**选择**: 文件存储（JSON + Markdown）

**结构**:
```
eslint-type-fixes/
├── index.json          # 规则索引
├── rules/
│   ├── 2322.md         # null-assignment 详细规则
│   └── ...             # 其他规则
└── stats/
    └── usage-log.json  # 使用统计
```

**理由**: 不使用向量数据库（Qdrant），因为规则数量有限，文件存储足够简单高效。

### Decision 4: MCP Tool 设计

**Tools**:
| Tool | 功能 | 输入 |
|------|------|------|
| `type_fix` | 获取修复建议 | error_code |
| `record_fix` | 记录使用统计 | rule_id, fix_type, success |
| `type_fix_list` | 获取规则列表 | 无 |

**优先级排序算法**:
```typescript
priority = successRate * 0.7 + (usageCount / totalHits) * 0.3
```

成功率高的方案优先推荐。

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| Agent 可能遗漏触发 CLAUDE.md | 三重触发保障：CLAUDE.md + MCP Tool 描述 + ESLint 错误消息 |
| 自定义 ESLint 规则可能有漏洞 | 先实现核心错误类型（TS2322），逐步扩展 |
| 知识库规则可能过时 | 规则文件是 Markdown，易于手动更新 |
| 统计数据可能不准确 | 要求 Agent 每次修复后调用 `record_fix` |