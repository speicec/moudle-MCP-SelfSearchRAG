## Why

项目积累了42个Spec和30+变更记录，形成了完整的增强RAG系统 + 医学智能Agent架构。需要一个交互式技术展示网页来：
- 向用户/面试者直观展示项目技术深度和演进历史
- 提供spec变更的可视化时间线导航
- 汇聚技术选型决策和架构设计的核心文档

## What Changes

- 新增项目技术展示网页（独立页面，位于前端应用中）
- 实现时间线视图展示2026-04-09至现在的30+变更演进
- 实现技术能力矩阵卡片（文档处理、检索策略、生成服务、Medical Agent、前端UI五大领域）
- 实现架构可视化流程图（PDF → Parse → Chunk → Embed → Store → Retrieve → Generate）
- 实现变更历史树状时间轴（按日期分组，可展开/折叠）
- 实现技术选型对比表（PDF切分、检索策略、OCR、VLM、LLM、嵌入、向量存储）
- 实现Medical Agent专项展示（ReAct循环 + Safety Layer三层防护）

## Capabilities

### New Capabilities

- `tech-showcase-timeline`: 时间线视图组件，展示变更历史的时间演进，支持动画过渡
- `tech-showcase-matrix`: 技术能力矩阵组件，按领域分组展示Spec，hover展开详情
- `tech-showcase-architecture`: 架构可视化组件，SVG动态渲染系统流程图，点击节点展开设计文档
- `tech-showcase-medical-agent`: Medical Agent专项展示组件，ReAct循环流程 + Safety Layer三层防护可视化
- `tech-showcase-decisions`: 技术选型决策表组件，对比不同方案的选择原因

### Modified Capabilities

无现有spec需要修改，这是全新展示页面。

## Impact

- **新增文件**: `frontend/src/pages/TechShowcase.tsx` (主页面)
- **新增文件**: `frontend/src/components/showcase/` (展示组件目录)
- **依赖**: framer-motion (动画)、react-flow 或 mermaid.js (流程图)
- **数据源**: 静态读取 `openspec/specs/` 和 `openspec/changes/archive/` 目录信息