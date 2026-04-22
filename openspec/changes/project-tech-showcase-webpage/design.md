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
- 实现GSAP风格单页滚动式强动画展示页
- 实现Hero开场动画（Logo入场 + 核心标语滚动展示 + ScrollTrigger提示）
- 实现Medical Agent核心展示区（ReAct循环动画 + Planning DAG动画 + Safety Layer动画）
- 实现检索可视化展示区（实体识别动画 + 查询重写动画 + 白箱链路追踪）
- 实现交互式时间线展示变更演进历史
- 实现技术能力矩阵卡片，stagger入场动画，hover展开详情
- 实现SVG架构流程图，支持节点点击展开
- 实现技术选型对比表，展示决策原因
- 页面响应式设计，支持移动端浏览
- 模式切换动画（ReAct ↔ Planning）

**Non-Goals:**
- 不实现实时Agent执行演示（纯动画展示）
- 不实现动态数据更新（静态生成）
- 不实现搜索功能（展示页面）
- 不实现用户交互收藏/分享
- 不实现暗色模式（暂用亮色）

## Decisions

### Decision 1: 动画方案 - Framer Motion + GSAP

**选择**: 使用 Framer Motion + GSAP ScrollTrigger 组合

**理由**:
- Framer Motion：组件入场动画、Hover效果、模式切换动画
- GSAP ScrollTrigger：滚动触发动画序列、时间线动画
- 两者配合可实现GSAP展示页级别的强动画效果
- GSAP ScrollTrigger提供精确的滚动触发控制

**替代方案**:
- CSS transitions：简单但复杂动画难以实现
- 仅Framer Motion：滚动触发控制不如GSAP精确
- React Spring：物理动画但时间线控制不如Framer Motion直观

### Decision 2: Medical Agent动画 - SVG循环 + DAG网格

**选择**: 使用自定义SVG循环动画 + DAG网格动画

**理由**:
- ReAct循环：SVG环形布局 + CSS Keyframes流动动画
- Planning DAG：网格节点布局 + Framer Motion Layout Animation
- 完全控制节点样式和连接线
- 可嵌入点击事件展开详情
- 无需引入大型流程图库

**ReAct循环动画设计**:
```
节点布局：环形排列（Think → Act → Observe → Decide → Answer）
连接线：带流动粒子动画（CSS animation）
当前阶段：节点高亮放大 + 光晕效果
阶段切换：2秒间隔循环动画
```

**Planning DAG动画设计**:
```
节点类型：retrieve/evaluate/check/generate
并行组：虚线框包围 + 同时执行动画
依赖关系：带方向箭头的连接线
重规划：失败节点红色警告 + DAG重构动画
```

### Decision 3: Safety Layer动画 - 三层堆叠过滤

**选择**: 使用三层堆叠式动画展示过滤过程

**理由**:
- 展示完整Safety Layer架构
- 可交互展示Query过滤过程
- 视觉效果直观（红色拦截 vs 绿色通过）

**动画设计**:
```
三层布局：知识层(蓝色) → 规则层(橙色) → 监控层(绿色)
危险Query：红色动画穿过滤层 → 被拦截标记
安全Query：绿色动画穿过滤层 → 通过标记
点击每层：显示对应防护规则详情
```

### Decision 4: 检索可视化动画 - 流程逐步展示

**选择**: 使用Framer Motion AnimatePresence实现流程动画

**理由**:
- 实体识别：标签弹出动画效果最佳
- 检索流程：从左到右流程动画清晰
- 白箱链路追踪：滚动触发逐步展示

**动画设计**:
```
实体识别：Query关键词闪烁 → 实体标签弹出 → 扩展动画
查询重写：原始Query → 重写Query对比展示动画
检索执行：向量数据库图标 + 结果卡片依次入场
链路追踪：时间线布局 + Hover显示详细输入输出
```

### Decision 5: 流程图渲染 - 自定义SVG

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

### Decision 6: 数据获取 - 构建时静态生成

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

### Decision 7: 页面路由 - 嵌入现有前端

**选择**: 在现有前端应用中新增 `/tech-showcase` 路由

**理由**:
- 复用现有布局和导航
- 统一技术栈和样式
- 无需独立部署
- 用户可从主界面导航到展示页

### Decision 8: Medical Agent可视化 - 双模式动画切换

**选择**: 实现ReAct ↔ Planning双模式动画切换

**理由**:
- 展示完整Agent双模式执行架构
- 用户可切换查看两种执行流程
- Planning模式包含DAG构建、并行执行、重规划动画
- ReAct模式包含循环推理动画

**动画设计**:
```
模式切换：点击触发ReAct ↔ Planning动画切换
ReAct循环：环形布局 + 流动粒子动画 + 阶段高亮
Planning DAG：网格布局 + 并行组 + 重规划动画
Safety Layer：三层堆叠 + Query过滤动画
```

## Risks / Trade-offs

### Risk 1: 数据同步滞后
**风险**: openspec目录更新后展示页数据可能滞后
**缓解**: 在构建脚本中添加变更检测提示，或CI/CD自动触发构建

### Risk 2: GSAP + Framer Motion性能影响
**风险**: 双动画库组合可能影响低端设备性能
**缓解**: 使用 `will-change` CSS提示，减少同时动画数量，提供简化模式开关，GSAP ScrollTrigger仅在滚动时触发

### Risk 3: 复杂动画维护困难
**风险**: SVG循环动画和DAG动画复杂，后续修改成本高
**缓解**: 使用数据驱动的SVG渲染，节点信息存储在JSON配置中，组件化拆分动画逻辑

### Risk 4: 移动端动画兼容性
**风险**: 复杂SVG动画可能在移动端显示异常
**缓解**: 移动端提供简化版动画（去除粒子流动效果），使用CSS fallback

### Trade-off 1: 静态数据 vs 动态API
**选择**: 静态数据
**代价**: 数据变更需要重新构建
**收益**: 页面加载性能最优，无需后端API

### Trade-off 2: GSAP + Framer Motion vs 单库
**选择**: 双动画库组合
**代价**: 包体积增加（GSAP ~45KB gzip）
**收益**: ScrollTrigger精确控制 + Framer Motion组件动画无缝集成，实现GSAP风格强动画效果

### Trade-off 3: 纯动画演示 vs 实时执行演示
**选择**: 纯动画演示
**代价**: 无法展示真实Agent执行过程
**收益**: 无需后端支持，页面加载快速，动画效果可控