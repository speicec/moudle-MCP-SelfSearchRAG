## Why

项目自进化 ESLint 类型修复系统已归档，但 ESLint 运行失败。原因是 `eslint.config.js` 使用 ESLint 9 flat config 格式导入 `typescript-eslint` 包，而项目实际安装的是 ESLint 8 和旧版 `@typescript-eslint/eslint-plugin`。

当前配置冲突导致自定义规则 `no-nullable-assignment` 无法执行，Agent 无法收到 ESLint 错误消息中的 MCP Tool 提示。

## What Changes

- **BREAKING**: 升级 ESLint 8 → ESLint 9 (Node.js 已满足 18.18+ 要求)
- **BREAKING**: 移除 `@typescript-eslint/eslint-plugin@6` 和 `@typescript-eslint/parser@6`
- **新增**: 安装 `typescript-eslint@^8` (单一包，合并了旧插件和 parser)
- **修改**: 修复 `eslint.config.js` flat config 格式
- **修改**: 更新 `package.json` lint script (移除废弃的 `--ext` flag)
- **验证**: 确保自定义规则 `no-nullable-assignment` 在 ESLint 9 下正常工作

## Capabilities

### New Capabilities

无新增 capability。此 change 是基础设施升级，不改变功能需求。

### Modified Capabilities

- `type-safety-guidelines`: ESLint 版本升级后，工具链配置需要更新以保持类型安全检查能力
- `nullable-assignment-rule`: 自定义规则需要验证在 typescript-eslint v8 API 下兼容性

## Impact

- **依赖变更**:
  - 移除: `eslint@8.57.1`, `@typescript-eslint/eslint-plugin@6`, `@typescript-eslint/parser@6`
  - 新增: `eslint@^9.x`, `typescript-eslint@^8.x`

- **配置文件**:
  - `eslint.config.js`: 修复为正确的 flat config 格式
  - `.eslintrc.cjs`: 可删除（已被 flat config 替代）
  - `package.json`: lint script 移除 `--ext` flag

- **自定义规则**:
  - `eslint-rules/no-nullable-assignment.ts`: 验证 `@typescript-eslint/utils` v8 API 兼容性

- **影响范围**: 所有 `src/**/*.ts` 文件的 lint 检查