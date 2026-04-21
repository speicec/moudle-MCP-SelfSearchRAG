## Why

当前 PipelineTimeline 组件存在三个核心问题：
1. **阶段不匹配**：后端定义了5个阶段，前端 timelineStore 只显示4个，chunk 阶段被遗漏导致 WebSocket 事件无法正确处理
2. **视觉老旧**：硬编码颜色、静态连接线，与现代化的 StartupProgress 视觉风格不统一
3. **信息缺失**：阶段内的 message/log 信息未被缓存展示，用户无法了解处理细节

改进处理进度组件可提升用户体验，让文档处理过程更加透明、信息更加丰富。

## What Changes

### 阶段修复
- 添加缺失的 `chunk` 阶段到 timelineStore 和 PipelineTimeline 组件
- 统一后端 PipelineStageName 和前端 TimelineStage.name 的定义
- 更新阶段卡片布局（从4列改为5列或自适应布局）

### 视觉改进
- 添加顶层渐变容器（借鉴 StartupProgress 视觉风格）
- 实现粒子流动画连接线（替代静态宽度变化）
- 替换硬编码颜色为语义化设计令牌（使用 status- 系列颜色）
- 统一阶段状态图标（completed/running/pending/error）

### 日志功能
- 添加阶段日志缓存（每阶段保留最近20条）
- 添加全局日志缓存（保留最近100条）
- 实现可折叠的阶段日志面板（Collapsible 组件）
- 实现底部全局日志流面板

## Capabilities

### New Capabilities
- `timeline-logs`: 日志缓存与展示能力，包含阶段日志和全局日志的数据结构、缓存策略、展示组件
- `flow-animation`: 粒子流动画组件，用于阶段卡片之间的连接线视觉效果

### Modified Capabilities
- `pipeline-timeline` (现有): 扩展阶段定义从4个到5个，添加 chunk 阶段，改进视觉风格

## Impact

### 受影响文件
- `src/frontend/store/timelineStore.ts` - 添加 chunk 阶段、日志缓存结构、handler
- `src/frontend/components/PipelineTimeline.tsx` - 添加 chunk 阶段、改进视觉、添加日志面板
- `src/frontend/hooks/useWebSocket.ts` - 缓存 message 到日志 store
- `src/frontend/components/ui/` - 可能需要新增 Collapsible 相关组件

### 新增文件
- `src/frontend/components/timeline/AnimatedFlowLine.tsx` - 粒子流动画连接线
- `src/frontend/components/timeline/StageCard.tsx` - 可折叠的阶段卡片
- `src/frontend/components/timeline/StageLogList.tsx` - 阶段日志列表
- `src/frontend/components/timeline/GlobalLogPanel.tsx` - 全局日志面板
- `openspec/changes/pipeline-timeline-enhancement/specs/timeline-logs/spec.md` - 日志功能规格
- `openspec/changes/pipeline-timeline-enhancement/specs/flow-animation/spec.md` - 流动画规格

### 依赖关系
- 无新增 npm 依赖（Framer Motion 已存在，Collapsible 已在 shadcn/ui 中配置）