## Context

### 当前状态

```
前后端阶段定义不一致
══════════════════════════════════════════════════════════

后端 PipelineStageName (src/server/types.ts):
  'ingest' | 'parse' | 'chunk' | 'embed' | 'index'  (5个)

前端 PipelineStore (src/frontend/store/index.ts):
  'ingest' | 'parse' | 'chunk' | 'embed' | 'index'  (5个) ✓

前端 TimelineStore (src/frontend/store/timelineStore.ts):
  'ingest' | 'parse' | 'embed' | 'index'            (4个) ✗

问题：WebSocket 事件 'stage:start' with stage='chunk' 
      在 TimelineStore 中无法匹配，被忽略
```

### 现有视觉风格

```
组件              风格特点                    评估
─────────────────────────────────────────────────────
StartupProgress   渐变背景、现代动画、玻璃态   ✓ 现代化
PipelineTimeline  硬编码颜色、静态连接线      ✗ 老旧
StatsDashboard    shadcn Card、语义化颜色     ✓ 已现代化

差距：PipelineTimeline 需要与 StatsDashboard、StartupProgress 视觉统一
```

### 数据流

```
WebSocket 事件 → TimelineStore
─────────────────────────────────────────────────────

事件类型              当前处理              改进
─────────────────────────────────────────────────────
pipeline:start        ✓ 重置阶段            
stage:start           ✓ 设置 running        
stage:progress        ✓ 更新 progress       
stage:complete        ✓ 设置 completed      
stage:metrics         ✓ 存储 metrics        
error                 ✓ 设置 error          
message 字段          ✗ 未缓存               ← 需要添加日志缓存
```

## Goals / Non-Goals

**Goals:**
- 添加 chunk 阶段到 TimelineStore 和 PipelineTimeline
- 缓存阶段日志（每阶段最近20条）和全局日志（最近100条）
- 实现可折叠的阶段日志面板
- 实现底部全局日志流面板
- 实现粒子流动画连接线
- 统一视觉风格（使用语义化设计令牌）
- 添加顶层渐变容器

**Non-Goals:**
- 不改变后端事件结构或 WebSocket 协议
- 不改变阶段处理顺序或逻辑
- 不添加阶段重试功能（仅展示，不控制）
- 不实现虚拟化日志列表（日志量小，不需要）

## Decisions

### D1: 粒子流动画实现方案

**选择**: Framer Motion + CSS 渐变

**实现**:
```tsx
<motion.div
  className="absolute h-full w-4 bg-gradient-to-r 
             from-transparent via-primary to-transparent"
  animate={{ x: ['-100%', '200%'] }}
  transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
/>
```

**理由**:
- 项目已有 Framer Motion，无需新依赖
- 渐变光斑效果视觉现代，与 StartupProgress 一致
- CSS gradient 比 SVG 粒子更轻量
- 性能优于纯 CSS animation（Framer Motion 有硬件加速优化）

**替代方案考虑**:
- 纯 CSS animation: 简单但控制精度差
- SVG 多粒子: 效果好但实现复杂、DOM 节点多
- Canvas: 性能最好但本场景不值得复杂度

### D2: 日志缓存策略

**选择**: 固定数量裁剪（每阶段20条，全局100条）

**实现**:
```ts
// 添加日志时自动裁剪
addLog: (entry) => set(state => ({
  globalLogs: [...state.globalLogs, entry].slice(-100)
}))

addStageLog: (stage, entry) => set(state => ({
  stageLogs: new Map(state.stageLogs).set(
    stage,
    [...(state.stageLogs.get(stage) || []), entry].slice(-20)
  )
}))
```

**理由**:
- 固定数量保证内存可控
- 100条全局日志足够覆盖完整处理过程
- 20条阶段日志足够展示该阶段关键信息
- slice(-N) 保留最新，符合用户关注点

**替代方案考虑**:
- 按时间裁剪（如保留最近5分钟）: 处理时间不确定，难以设置阈值
- 无限缓存: 长文档处理可能产生大量日志
- 时间窗口 + 数量双重限制: 过度复杂

### D3: 日志面板位置

**选择**: 每阶段卡片内 + 底部全局面板

**布局**:
```
┌────────────────────────────────────────────────────────┐
│  渐变容器 + 整体进度                                    │
├────────────────────────────────────────────────────────┤
│  ┌───────┐  ┌───────┐  ┌───────┐  ┌───────┐  ┌───────┐│
│  │Ingest │──│ Parse │──│ Chunk │──│ Embed │──│ Index ││
│  │[▼日志]│  │[▼日志]│  │[▼日志]│  │[▼日志]│  │[▼日志]││
│  │(折叠) │  │(展开) │  │(折叠) │  │(折叠) │  │(等待) ││
│  └───────┘  └───────┘  └───────┘  └───────┘  └───────┘│
├────────────────────────────────────────────────────────┤
│  ┌─ Global Log ─────────────────────────────── [▼] ──┐│
│  │ ⟳ [10:30:08] Embed: Processing chunk 45/120...   ││
│  │ ✓ [10:30:05] Parse: Tokenized 3000 tokens        ││
│  └────────────────────────────────────────────────────┘│
└────────────────────────────────────────────────────────┘
```

**理由**:
- 阶段内日志便于聚焦当前处理步骤
- 全局日志便于整体监控和时间线回顾
- 双面板设计满足不同信息需求
- Collapsible 保持界面简洁

### D4: 阶段卡片布局

**选择**: 自适应 Grid（grid-cols-5 lg:grid-cols-5 md:grid-cols-3）

**理由**:
- 5个阶段自然需要5列
- 中等屏幕降为3列避免拥挤
- 小屏幕（sm）可进一步降为2列
- 保持卡片大小一致，连接线需要特殊处理

**替代方案考虑**:
- Flex 布局: 连接线长度不确定，动画复杂
- 固定5列: 小屏幕溢出问题

### D5: 阶段颜色方案

**选择**: 统一状态色 + 阶段个性色

**状态色（所有阶段共用）**:
```
completed → Badge variant="indexed" (green系)
running   → Badge variant="processing" (blue系)
pending   → Badge variant="pending" (yellow系)
error     → Badge variant="destructive" (red系)
```

**阶段个性色（卡片边框/图标）**:
```
ingest   → amber系  (文件读取)
parse    → violet系 (文本解析)
chunk    → cyan系   (分块处理) ← 新阶段
embed    → blue系   (向量嵌入)
index    → green系  (索引构建)
```

**理由**:
- 状态色统一，用户一眼识别阶段状态
- 阶段个性色保留区分度
- cyan 是新颜色，不与现有冲突

## Risks / Trade-offs

### R1: 连接线动画在折叠状态下的视觉问题

**风险**: 阶段日志展开后卡片高度不一致，连接线位置错位

**缓解**: 
- 连接线使用绝对定位，相对于卡片顶部而非整体高度
- 展开/折叠动画时，连接线位置同步调整（Framer Motion 共享 layoutId）

### R2: 日志缓存同步问题

**风险**: WebSocket 事件中 message 字段可能缺失或格式不一致

**缓解**:
- 添加日志时检查 message 存在性，不存在则跳过
- message 格式统一为 string，非 string 类型尝试 JSON.stringify

### R3: chunk 阶段向后兼容

**风险**: 旧版前端可能不识别 chunk 事件

**缓解**:
- 本次改进是前端独立修改，不涉及协议变更
- TimelineStore 添加 chunk 阶段后，现有事件处理逻辑自然兼容

## Migration Plan

### Phase 1: 数据层修复
1. 添加 chunk 阶段到 TimelineStore
2. 添加日志缓存结构到 TimelineStore
3. 更新 WebSocket handler 缓存 message

### Phase 2: 组件层改进
1. 创建 AnimatedFlowLine 组件
2. 创建 StageCard 组件（可折叠）
3. 创建 StageLogList 组件
4. 创建 GlobalLogPanel 组件
5. 重构 PipelineTimeline 主组件

### Phase 3: 视觉统一
1. 替换硬编码颜色为设计令牌
2. 添加顶层渐变容器
3. 统一状态图标和徽章

### 验证步骤
- 处理文档，验证 chunk 阶段正确显示
- 验证日志缓存不超过限制
- 验证流动画在运行阶段显示