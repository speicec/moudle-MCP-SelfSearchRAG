## Why

当前代码质量检查分散在多个独立技能中（quality-check、requesting-code-review、verification-before-completion），缺乏统一入口和系统性评审流程。开发者在不同阶段需要手动调用不同命令，容易遗漏关键检查项。同时，需求文档评审完全缺失，导致需求不完整、不一致的问题流入实现阶段。

需要一个统一的 `/check` 命令系统，提供多子命令的检查入口，覆盖从需求评审到代码审查的全流程，并支持报告持久化以追踪质量历史。

## What Changes

- **新增 `/check` 主命令**：统一入口，无参数时执行快速预检
- **新增 8 个子命令**：
  - `/check:review` — 六维需求评审（完整性0.25、一致性0.20、可追溯性0.15、质量0.20、模板符合度0.10、上下文引用0.10）
  - `/check:design` — 设计一致性检查（接口契约、数据结构、组件关系）
  - `/check:security` — 安全检查（输入校验、SQL注入、敏感信息泄露、权限校验）
  - `/check:concurrency` — 并发检查（竞态条件、死锁风险、资源泄露）
  - `/check:complexity` — 复杂度检查（圈复杂度、认知复杂度、函数长度、嵌套深度）
  - `/check:error` — 错误处理检查（错误忽略、错误包装、panic使用、recover配对）
  - `/check:auxiliary` — 辅助检查（代码规范、性能、可维护性、测试覆盖）
  - `/check:code-reviewer` — 总体质量评审（综合评审、契约一致性校验）
- **新增组合执行模式**：`/check --all` 或指定维度组合，7个代码检查子命令可并行执行
- **新增报告持久化**：所有评审结果写入 `context/review/` 目录，文件命名 `<timestamp>-<command>-<target>.md`
- **定义必须执行规则**：`/check:review` 和 `/check:code-reviewer` 为必须执行的检查点

## Capabilities

### New Capabilities

- `check-precheck`: 快速预检能力，扫描 Git 状态、OpenSpec 进度、文件变更，输出下一步建议
- `check-review`: 六维需求评审能力，对 OpenSpec change 文档进行完整性、一致性、可追溯性、质量、模板符合度、上下文引用评审
- `check-design`: 设计一致性检查能力，验证代码实现是否遵循设计文档的接口契约和数据结构约定
- `check-security`: 安全检查能力，检查输入校验、SQL注入、XSS、敏感信息泄露、权限校验等安全问题
- `check-concurrency`: 并发检查能力，检查竞态条件、死锁风险、goroutine/channel 资源泄露
- `check-complexity`: 复杂度检查能力，检查圈复杂度、认知复杂度、函数长度、嵌套深度是否超标
- `check-error`: 错误处理检查能力，检查错误忽略、错误包装、panic/throw 使用、recover/catch 配对
- `check-auxiliary`: 辅助检查能力，检查代码规范、性能问题、可维护性、测试覆盖、文档完整性
- `check-code-reviewer`: 总体质量评审能力，综合评审代码质量，必要时结合设计文档进行契约一致性校验
- `check-report-persistence`: 报告持久化能力，将评审结果写入 context/review/ 目录，支持历史追踪

### Modified Capabilities

无修改的能力。所有检查能力均为新建。

## Impact

### 代码影响
- `.claude/skills/check/` 目录新增 10 个文件：
  - `skill.md` — 主技能（命令路由、预检）
  - `precheck-agent.md` — 预检 Agent 提示词
  - `review-agent.md` — 六维需求评审 Agent 提示词
  - `design-agent.md` — 设计一致性检查 Agent 提示词
  - `security-agent.md` — 安全检查 Agent 提示词
  - `concurrency-agent.md` — 并发检查 Agent 提示词
  - `complexity-agent.md` — 复杂度检查 Agent 提示词
  - `error-agent.md` — 错误处理检查 Agent 提示词
  - `auxiliary-agent.md` — 辅助检查 Agent 提示词
  - `code-reviewer-agent.md` — 总体质量评审 Agent 提示词

### 目录影响
- `context/review/` 目录：评审报告持久化存储
- 文件命名格式：`YYYY-MM-DD-HHmm-<command>-<target>.md`

### 工作流影响
- 需求阶段 → `/check:review`（必须）
- 实现阶段 → `/check --all`（可选）
- 完成阶段 → `/check:code-reviewer`（必须）

### 兼容性影响
- 非破坏性变更：不影响现有 quality-check、requesting-code-review 等技能
- 新命令为可选使用，不强制集成到现有流程