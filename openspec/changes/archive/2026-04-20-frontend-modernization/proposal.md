## Why

当前前端组件存在三个核心问题：
1. **内联组件污染**：每个文件包含2-4个内联定义的子组件，导致代码膨胀、难以复用
2. **设计不一致**：手动硬编码颜色映射、样式分散、缺乏统一的设计令牌系统
3. **交互体验欠缺**：缺乏现代组件库支持（可折叠面板、卡片、徽章等），用户体验不够流畅

前端现代化改造将提升代码可维护性、统一视觉风格、改善用户交互体验。

## What Changes

### 组件提取与重构
- 提取 ChatWindow 内联组件（ConfidenceBadge、RetrievalStatsPanel、SourceCard、StreamingIndicator）
- 提取 StatsDashboard 内联组件（PerformanceBadge、StatCard、QualityDistributionChart、StageTimeChart）
- 提取 ChunkExplorer 内联组件（ChunkCard、TreeNode）
- 提取 VisualApp 内联组件（ConnectionIndicator、DocumentSelector）
- 重组文件结构：按功能域划分组件目录（chat/、stats/、chunks/、common/）

### 设计系统引入
- 集成 shadcn/ui 组件库（Card、Badge、Collapsible、ScrollArea、Input、Button）
- 创建设计令牌系统（颜色、间距、变体）
- 替换手动颜色映射为语义化设计令牌
- 创建 frontend-design skill 提供设计模板和规范

### 交互优化
- 实现可折叠检索统计面板
- 改进消息列表渲染性能（虚拟化）
- 优化分块探索器的网格/树状切换
- 改进文档上传的拖拽交互

## Capabilities

### New Capabilities
- `ui-components`: shadcn/ui 组件集成与定制，包含 Card、Badge、Collapsible、ScrollArea、Input、Button 等
- `design-tokens`: 设计令牌系统，定义颜色、间距、变体等语义化设计变量
- `frontend-structure`: 前端组件目录结构规范，按功能域划分（chat/、stats/、chunks/、common/）

### Modified Capabilities
- 无现有 specs 需要修改（这是纯前端重构，不影响后端 API 或业务逻辑）

## Impact

### 受影响文件
- `src/frontend/components/ChatWindow.tsx` (420行 → 拆分为10个文件)
- `src/frontend/components/StatsDashboard.tsx` (387行 → 拆分为5个文件)
- `src/frontend/components/ChunkExplorer.tsx` (443行 → 拆分为4个文件)
- `src/frontend/components/VisualApp.tsx` (277行 → 拆分为4个文件)
- `src/frontend/components/DocumentManager.tsx` (205行 → 优化样式)
- `tailwind.config.js` (添加 shadcn/ui 配置)

### 新增文件
- `src/frontend/components/ui/` 目录下的 shadcn 组件
- `src/frontend/components/chat/` 目录下的聊天相关组件
- `src/frontend/components/stats/` 目录下的统计相关组件
- `src/frontend/components/chunks/` 目录下的分块相关组件
- `src/frontend/components/common/` 目录下的通用组件
- `.claude/skills/frontend-design/` 目录下的设计 skill

### 依赖变更
- 新增 `@radix-ui/react-collapsible`、`@radix-ui/react-scroll-area` 等 Radix primitives
- 新增 `class-variance-authority` 用于变体管理
- 新增 `clsx`、`tailwind-merge` 用于样式合并