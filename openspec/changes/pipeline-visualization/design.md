## Context

现有 RAG 系统已有 WebSocket 实时事件流（`pipeline:start`、`stage:*`、`pipeline:complete`），前端有基础进度条展示。但用户无法深入理解处理细节：分块如何切分、质量如何评估、检索如何匹配。需要扩展可视化深度。

**技术栈约束**：
- 前端：React + Zustand + Tailwind CSS + Framer Motion（动画）
- 后端：Fastify + WebSocket + TypeScript
- 状态：现有 WebSocket 事件机制需扩展，不引入新架构

## Goals / Non-Goals

**Goals:**
- 用户可实时观察文档处理各阶段的耗时和指标
- 用户可浏览分块层级结构，查看质量评分
- 用户可理解检索匹配过程（Small-to-Big）
- 系统管理员可监控全局性能趋势

**Non-Goals:**
- 本期不做动画性能极限优化（目标流畅度 60fps，后期优化）
- 不做移动端适配（桌面优先）
- 不做深色/浅色主题切换
- 不做数据导出/历史分析功能

## Decisions

### 1. Tab 切换布局 vs 单页滚动
**Decision**: 采用 Tab 切换布局（处理进度 | 分块结构 | 检索过程 | 系统统计）

**Rationale**: 各模块信息密度高，单页滚动会导致页面过长、导航混乱。Tab 切换让用户按需聚焦，同时左侧面板固定展示快速操作区。

**Alternatives considered**:
- 单页滚动 + 折叠面板：信息密度过高，滚动体验差
- 分屏布局（四个固定区域）：屏幕空间不足，各区域拥挤

### 2. WebSocket 事件扩展 vs 新增 REST API
**Decision**: 实时数据用 WebSocket 扩展，历史/分页数据用 REST API

**Rationale**:
- 实时更新（stage:metrics、chunk:created、retrieval:*）必须用 WebSocket，否则轮询开销大
- 分页查询（chunks 列表、stats 统计）用 REST 更简单，无实时性需求

**Alternatives considered**:
- 全部用 WebSocket：复杂度高，历史数据无法精确查询
- 全部用 REST + 轮询：实时性差，浪费带宽

### 3. Zustand 多 Store vs 单 Store
**Decision**: 每个可视化模块独立 Store（timelineStore、chunkStore、statsStore）

**Rationale**: 各模块状态独立，无强耦合。独立 Store 更易维护、测试，避免巨型 Store 问题。

**Alternatives considered**:
- 单一可视化 Store：状态合并复杂，更新逻辑耦合
- Context API：性能差，不适合频繁实时更新

### 4. 动画库选择
**Decision**: 使用 Framer Motion 处理所有动画

**Rationale**: React-first，API 简洁，支持复杂动画序列（步骤展开、粒子效果）。Tailwind CSS 只处理静态样式。

**Alternatives considered**:
- CSS transitions/keyframes：复杂动画（向量生成、相似度搜索）难以实现
- GSAP：非 React-first，集成复杂

## Risks / Trade-offs

**Risk**: WebSocket 事件过多导致前端渲染压力
→ **Mitigation**: 分块创建事件批量发送（每 10 个 chunk 发一次），前端使用虚拟滚动

**Risk**: 检索动画卡顿（向量空间可视化复杂）
→ **Mitigation**: 相似度搜索动画简化为点+连线，不做完整向量空间渲染

**Risk**: 统计数据实时更新频率过高
→ **Mitigation**: stats:update 每 5 秒发送一次，前端按需刷新

**Trade-off**: 不做完整向量空间可视化（技术复杂度高），仅展示匹配点聚合效果