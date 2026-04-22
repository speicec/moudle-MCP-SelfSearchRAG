## Context

项目前端使用 React + Tailwind CSS + shadcn/ui 组件库，已实现 Pipeline Timeline、Stats Dashboard、Chunk Explorer 等可视化组件。现有组件模式可直接复用。

数据来源：
- `openspec/specs/` 目录：42个spec文件
- `openspec/changes/archive/` 目录：30+变更记录
- `docs/` 目录：架构图、Medical Agent指南等

约束：
- 使用静态数据，无需新增API
- 遵循现有前端组件设计模式
- 保持页面加载性能（避免大型动画阻塞）

## Goals / Non-Goals

**Goals:**
- 实现交互式时间线展示变更演进历史
- 实现技术能力矩阵卡片，hover展示spec详情
- 实现SVG架构流程图，支持节点点击展开
- 实现Medical Agent ReAct循环 + Safety Layer可视化
- 实现技术选型对比表，展示决策原因
- 页面响应式设计，支持移动端浏览

**Non-Goals:**
- 不实现动态数据更新（静态生成）
- 不实现搜索功能（展示页面）
- 不实现用户交互收藏/分享
- 不实现暗色模式（暂用亮色）

## Decisions

### Decision 1: 动画方案 - Framer Motion

**选择**: 使用 Framer Motion

**理由**:
- 与React生态无缝集成
- 支持复杂的时间线动画和过渡效果
- 性能优化良好（GPU加速）
- 项目前端已使用React，无需额外学习成本

**替代方案**:
- CSS transitions：简单但复杂动画难以实现
- GSAP：功能强大但与React集成需要额外配置
- React Spring：物理动画但时间线控制不如Framer Motion直观

### Decision 2: 流程图渲染 - 自定义SVG

**选择**: 使用自定义SVG + 点击交互

**理由**:
- 完全控制节点样式和连接线
- 可嵌入点击事件展开详情
- 无需引入大型流程图库
- 节点数量有限（约10个），手动绘制可控

**替代方案**:
- React Flow：功能强大但对于静态展示过重
- Mermaid.js：简单但自定义样式受限
- D3.js：灵活但开发成本高

### Decision 3: 数据获取 - 构建时静态生成

**选择**: 构建时从openspec目录生成静态数据JSON

**理由**:
- 无需运行时读取文件
- 页面加载速度快
- 数据变更时重新构建即可
- 遵循前端静态化最佳实践

**实现**:
```typescript
// 构建脚本读取目录结构
const specsData = readSpecsDir('openspec/specs/')
const changesData = readChangesDir('openspec/changes/archive/')
// 输出到 frontend/src/data/showcase-data.json
```

### Decision 4: 页面路由 - 嵌入现有前端

**选择**: 在现有前端应用中新增 `/tech-showcase` 路由

**理由**:
- 复用现有布局和导航
- 统一技术栈和样式
- 无需独立部署
- 用户可从主界面导航到展示页

### Decision 5: Medical Agent可视化 - 分层流程图

**选择**: 使用两层可视化（ReAct循环 + Safety Layer防护）

**理由**:
- 展示完整Agent架构
- Safety Layer是核心安全机制需要独立展示
- 可交互点击各阶段查看详细说明

## Risks / Trade-offs

### Risk 1: 数据同步滞后
**风险**: openspec目录更新后展示页数据可能滞后
**缓解**: 在构建脚本中添加变更检测提示，或CI/CD自动触发构建

### Risk 2: 大量动画影响性能
**风险**: Framer Motion动画可能影响低端设备性能
**缓解**: 使用 `will-change` CSS提示，减少同时动画数量，提供简化模式开关

### Risk 3: 流程图节点过多导致维护困难
**风险**: 如果后续架构变更，手动SVG需要频繁修改
**缓解**: 使用数据驱动的SVG渲染，节点信息存储在JSON配置中

### Trade-off 1: 静态数据 vs 动态API
**选择**: 静态数据
**代价**: 数据变更需要重新构建
**收益**: 页面加载性能最优，无需后端API

### Trade-off 2: 自定义SVG vs React Flow
**选择**: 自定义SVG
**代价**: 无法自动布局
**收益**: 完全控制样式和交互，轻量无依赖