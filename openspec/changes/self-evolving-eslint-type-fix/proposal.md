## Why

当前项目启用严格 TypeScript 配置（`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`），但 ESLint 只报错不提供修复建议。Agent 在编码时遇到类型错误（如 `string | null` 不能赋给 `string`）无法一键修复，也缺乏学习机制避免下次犯同样错误。

现有类型安全规范（`openspec/changes/archive/2026-04-09-fix-typescript-strict-errors`）是静态描述，没有可执行代码和 Agent 可读的修复知识库。

## What Changes

- **新增自定义 ESLint 规则**: 使用 `@typescript-eslint/utils` 实现 nullable 类型赋值检测，错误消息内嵌 MCP Tool 调用提示
- **新增触发器模式 CLAUDE.md**: 仅 10 tokens 一行触发器，避免上下文漂移
- **新增 MCP Tools**: `type_fix(code)` 获取修复建议、`record_fix()` 记录使用统计、`type_fix_list()` 获取规则列表
- **新增分层知识库**: `eslint-type-fixes/rules/*.md` 存详细规则，`usage-log.json` 存使用统计
- **新增三重触发保障**: CLAUDE.md 触发器 + MCP Tool 描述 + ESLint 错误消息内嵌提示

## Capabilities

### New Capabilities

- `type-fix-knowledge-base`: 分层知识库存储 TypeScript 类型错误修复规则和使用统计
- `type-fix-mcp-tools`: MCP Tool 接口提供修复建议查询和使用记录功能
- `nullable-assignment-rule`: 自定义 ESLint 规则检测 nullable 类型赋值错误
- `trigger-mode-config`: 触发器模式 CLAUDE.md 配置（极精简设计）

### Modified Capabilities

无 - 这是新增功能，不改变现有 spec 级别的需求

## Impact

- **新增文件**:
  - `CLAUDE.md` (项目根目录)
  - `eslint-type-fixes/rules/*.md` (知识库)
  - `eslint-type-fixes/stats/usage-log.json` (统计)
  - `eslint-type-fixes/index.json` (索引)
  - `src/mcp/type-fix-tools.ts` (MCP Tool 定义)
  - `src/mcp/type-fix-handlers.ts` (MCP Tool 实现)
  - `eslint-rules/no-nullable-assignment.ts` (ESLint 规则)

- **修改文件**:
  - `src/mcp/server.ts` (注册新 MCP Tools)
  - `eslint.config.js` 或 `.eslintrc.cjs` (添加自定义规则)

- **依赖**:
  - `@typescript-eslint/utils` (已有)
  - `typescript` (已有)