## Context

项目已有自进化 ESLint 类型修复系统（归档于 `2026-04-20-self-evolving-eslint-type-fix`），包含：
- 自定义规则 `eslint-rules/no-nullable-assignment.ts`
- MCP Tools `type_fix`, `record_fix`, `type_fix_list`
- 知识库 `eslint-type-fixes/`

当前配置状态：
| 文件 | ESLint 版本 | 格式 | 状态 |
|------|-------------|------|------|
| `.eslintrc.cjs` | ESLint 8 | Legacy | 可用但被忽略 |
| `eslint.config.js` | ESLint 9 (假设) | Flat config | **失败** - 包不存在 |

Node.js 版本满足 ESLint 9 要求（当前: v24.11.0, 需要: ≥18.18.0）。

## Goals / Non-Goals

**Goals:**
- 升级 ESLint 到 v9 + typescript-eslint v8
- 修复 `eslint.config.js` flat config 格式
- 确保 `no-nullable-assignment` 规则在新版本下正常工作
- 移除废弃的 `.eslintrc.cjs` 和 lint script `--ext` flag

**Non-Goals:**
- 不改变 MCP Tools 或知识库实现
- 不添加新的 ESLint 规则
- 不改变类型安全规范本身

## Decisions

### Decision 1: ESLint 配置格式 - Flat Config (ESLint 9)

**选择**: ESLint 9 flat config (`eslint.config.js`)

**理由**:
| 格式 | ESLint 版本 | 未来支持 | 项目现状 |
|------|-------------|----------|----------|
| Legacy (.eslintrc) | 8 | 已废弃 | 部分可用 |
| Flat config | 9 | ✅ 唯一支持 | 已有骨架文件 |

typescript-eslint v8 已合并为单一包：
- 旧: `@typescript-eslint/eslint-plugin` + `@typescript-eslint/parser`
- 新: `typescript-eslint` (一个包)

### Decision 2: 自定义规则兼容性 - 保留 @typescript-eslint/utils

**选择**: 继续使用 `@typescript-eslint/utils` (v8)

**理由**: 自定义规则 `no-nullable-assignment.ts` 已使用 `ESLintUtils.RuleCreator` API。typescript-eslint v8 保持向后兼容：
- `ESLintUtils.getParserServices(context)` API 不变
- `checker.isTypeAssignableTo()` API 不变

### Decision 3: lint script 更新 - 移除废弃 flag

**选择**: `npm run lint` 改为 `npx eslint src`

**理由**: ESLint 9 flat config 不支持 `--ext` flag。文件匹配在 config 中通过 `files` 属性定义。

### Decision 4: 配置文件清理策略

**选择**: 删除 `.eslintrc.cjs`

**理由**: 保留两个配置文件会造成混乱。Flat config 是未来唯一支持的格式。

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| typescript-eslint v8 API 可能有小改动 | 运行测试验证 `no-nullable-assignment` 规则 |
| ESLint 9 可能有新警告 | 检查 lint 输出，必要时调整 rules |
| 依赖变更可能影响其他包 | 检查 `npm ls` 确保无依赖冲突 |

## Migration Plan

**升级步骤**:
1. 移除旧包: `npm uninstall @typescript-eslint/eslint-plugin @typescript-eslint/parser`
2. 安装新包: `npm install eslint@^9 typescript-eslint@^8 --save-dev`
3. 删除 `.eslintrc.cjs`
4. 修复 `eslint.config.js` flat config
5. 更新 `package.json` lint script
6. 运行 `npm run lint` 验证
7. 运行 `npm test` 确保无回归

**回滚策略**:
```bash
npm uninstall eslint typescript-eslint
npm install eslint@^8 @typescript-eslint/eslint-plugin@^6 @typescript-eslint/parser@^6 --save-dev
# 恢复 .eslintrc.cjs
```