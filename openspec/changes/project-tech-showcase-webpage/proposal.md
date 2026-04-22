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

- `tech-showcase-hero`: 开场动画区，Logo入场 + 核心标语滚动展示 + 技术栈徽章入场，ScrollTrigger提示动画
- `tech-showcase-timeline`: 时间线视图组件，展示变更历史的时间演进，横向滚动 + 节点入场动画，支持动画过渡
- `tech-showcase-matrix`: 技术能力矩阵组件，五大领域卡片网格，Hover动画展开详情，stagger入场效果
- `tech-showcase-architecture`: 架构可视化组件，SVG动态渲染系统流程图，点击节点展开设计文档
- `tech-showcase-medical-agent`: Medical Agent核心展示区，ReAct循环动画（环形流动）+ Planning模式DAG动画（并行执行）+ Safety Layer三层过滤动画
- `tech-showcase-retrieval-visualization`: 检索可视化展示区，实体识别动画 + 查询重写动画 + 检索执行动画 + 白箱链路追踪展示
- `tech-showcase-decisions`: 技术选型决策表组件，对比不同方案的选择原因
- `tech-showcase-footer`: 页脚技术栈总结表格，项目链接，版权声明

### Modified Capabilities

无现有spec需要修改，这是全新展示页面。

## Impact

- **新增文件**: `frontend/src/pages/TechShowcase.tsx` (主页面)
- **新增文件**: `frontend/src/components/showcase/` (展示组件目录)
- **新增文件**: `frontend/src/components/showcase/HeroSection.tsx` (开场动画区)
- **新增文件**: `frontend/src/components/showcase/MedicalAgentSection.tsx` (Medical Agent展示区)
- **新增文件**: `frontend/src/components/showcase/ReActCycleDiagram.tsx` (ReAct循环动画)
- **新增文件**: `frontend/src/components/showcase/PlanningDAGDiagram.tsx` (Planning DAG动画)
- **新增文件**: `frontend/src/components/showcase/SafetyLayerDiagram.tsx` (Safety Layer动画)
- **新增文件**: `frontend/src/components/showcase/RetrievalVisualization.tsx` (检索可视化区)
- **新增文件**: `frontend/src/components/showcase/TimelineSection.tsx` (时间轴)
- **新增文件**: `frontend/src/components/showcase/TechMatrix.tsx` (技术矩阵)
- **新增文件**: `frontend/src/components/showcase/FooterSection.tsx` (页脚)
- **依赖**: framer-motion (动画)、gsap (ScrollTrigger滚动触发动画)
- **数据源**: 静态读取 `openspec/specs/` 和 `openspec/changes/archive/` 目录信息

## Design Highlights

### Medical Agent Section（核心展示区）

- **ReAct循环动画**: 5个节点环形排列，连接线带流动粒子动画，当前阶段节点高亮放大
- **Planning模式动画**: DAG节点网格布局，并行组虚线框包围，失败节点触发重规划动画
- **Safety Layer动画**: 三层堆叠展示，危险Query被拦截（红色），安全Query通过（绿色）
- **模式切换**: 点击触发ReAct ↔ Planning动画切换

### Retrieval Visualization Section

- **实体识别动画**: Query关键词闪烁，实体标签弹出（疾病/药物/指标）
- **查询重写动画**: 原始Query → 重写Query对比展示，策略选择动画
- **检索执行动画**: 向量数据库图标 + 结果卡片依次入场
- **白箱链路追踪**: 完整决策链展示，每步带耗时和决策原因