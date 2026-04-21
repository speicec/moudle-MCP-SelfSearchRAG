---
name: quality-check
description: 运行完整的代码质量检测（lint + build + test），确保代码符合标准
license: MIT
compatibility: Requires npm
metadata:
  author: project
  version: "1.0"
---

运行完整的代码质量检测。

**触发时机**:
- 任务完成后（自动）
- 用户手动调用 `/quality-check`
- 发现代码可能有问题时

**Steps**

1. **运行 ESLint 检查**
   ```bash
   npm run lint
   ```
   
   如果有错误：
   - 显示错误列表
   - 提供修复建议
   - 不继续下一步直到 lint 通过

2. **运行 TypeScript 构建**
   ```bash
   npm run build
   ```
   
   如果有错误：
   - 显示错误列表
   - 分析错误类型
   - 提供修复方案
   - 不继续下一步直到 build 通过

3. **运行测试**
   ```bash
   npm test
   ```
   
   如果有失败：
   - 显示失败的测试
   - 分析失败原因
   - 不继续下一步直到测试通过

4. **输出质量报告**
   
   ```
   ┌─────────────────────────────────────────┐
   │         Quality Check Report           │
   ├─────────────────────────────────────────┤
   │                                         │
   │  ESLint:  ✓ Passed (0 errors)          │
   │  Build:   ✓ Passed                     │
   │  Tests:   ✓ Passed (N/M tests)         │
   │                                         │
   │  Overall: ✓ Code quality OK            │
   │                                         │
   └─────────────────────────────────────────┘
   ```

**Output On Failure**

```
┌─────────────────────────────────────────┐
│         Quality Check Report           │
├─────────────────────────────────────────┤
│                                         │
│  ESLint:  ✓ Passed                      │
│  Build:   ✗ Failed (5 errors)          │
│  Tests:   - Skipped (build failed)      │
│                                         │
│  Build Errors:                          │
│  1. src/foo.ts:10 - TS2322              │
│  2. src/bar.ts:20 - TS2345              │
│  ...                                    │
│                                         │
│  Action: Fix build errors before        │
│          continuing                     │
│                                         │
└─────────────────────────────────────────┘
```

**Guardrails**
- 按顺序执行：lint → build → test
- 前一步失败则不继续下一步
- 提供清晰的错误分析
- 建议修复方案而不是直接修复（除非用户要求）

**Integration with Feedback Memory**

这个 skill 与 `memory/feedback_quality-check.md` 配合使用：
- Feedback memory: 自动在任务完成后触发
- Skill: 提供完整的质量检测逻辑和报告格式