# 预检代理提示词

你正在执行快速预检，扫描当前工作状态并发现潜在问题入口点。

## 你的任务

1. 扫描 Git 状态
2. 扫描 OpenSpec 状态 (如果存在)
3. 快速扫描文件变更
4. 输出下一步建议
5. 持久化报告

## 检查步骤

### 1. Git 状态扫描

```bash
git status --short
git branch --show-current
git log --oneline -5
```

报告:
- 当前分支名
- 未提交变更数量 (modified/untracked/staged)
- 与主分支差异 (commits ahead/behind)

### 2. OpenSpec 状态扫描

```bash
openspec list --json
```

如果 OpenSpec 存在:
- 报告每个 active change 名称
- 报告任务完成进度 (completedTasks/totalTasks)
- 报告最后修改时间

如果不存在:
- 报告 "No active OpenSpec changes"

### 3. 文件变更快速扫描

列出修改的文件:
- 识别测试文件变更 (*.test.ts, *_test.go)
- 识别配置文件变更 (*.config.*, package.json, tsconfig.json)
- 大变更集警告 (>20 文件)

### 4. 下一步建议

根据发现的问题建议下一步命令:
- 有 OpenSpec changes → 建议 `/check:review`
- 有代码变更 → 建议 `/check --all` 或 `/check:code-reviewer`
- 无问题 → 建议 "All clear, ready to commit"

## 输出格式

```markdown
# 预检报告 - YYYY-MM-DD HH:mm

## Git 状态

- **分支:** <branch-name>
- **变更:** <N> modified, <N> untracked, <N> staged
- **与主分支差异:** <N> commits ahead/behind

## OpenSpec 状态

- **Active Changes:**
  - <change-name>: <completedTasks>/<totalTasks> tasks
- **无活跃变更** (如果没有)

## 文件变更

- **修改文件:** <count> files
- **测试文件:** <count> test files
- **配置文件:** <count> config files
- ⚠ **警告:** Large change set detected (>20 files) (如果超过阈值)

## 下一步建议

→ `/check:review <change-name>` - 评审需求文档完整性
→ `/check --all` - 执行全部代码检查
→ `/check:code-reviewer` - 总体质量评审

## 状态: ✓ All clear (如果无问题) / ⚠ 需要检查 (如果有问题)
```

## 报告持久化

将报告写入:
- 目录: `context/review/`
- 文件名: `YYYY-MM-DD-HHmm-precheck-default.md`

示例: `2026-04-22-1530-precheck-default.md`

## 关键规则

**应该做的:**
- 快速扫描，不深入分析
- 提供明确的下一步建议
- 持久化报告

**不该做的:**
- 深入分析代码问题 (交给其他命令)
- 略过 Git 或 OpenSpec 状态
- 不持久化报告