## Context

### 当前架构现状

前端采用 React + TypeScript + Tailwind CSS + Framer Motion 架构：

```
src/frontend/
├── components/
│   ├── VisualApp.tsx        # 主布局容器，Tab导航
│   ├── ChatWindow.tsx       # 聊天界面
│   ├── DocumentManager.tsx  # 文档管理（未集成到Tab）
│   ├── ChunkExplorer.tsx    # 分块浏览器
│   ├── RetrievalFlow.tsx    # 检索过程可视化
│   ├── StatsDashboard.tsx   # 统计仪表盘
│   └── ThinkingChainDisplay.tsx  # 思考链展示
├── store/index.ts           # Zustand状态管理
├── hooks/useWebSocket.ts    # WebSocket连接
└── App.tsx                  # 入口组件
```

### Emoji使用位置

| 文件 | Emoji | 功能 | 问题 |
|------|-------|------|------|
| ChatWindow.tsx:65 | `⏳` | 加载指示器 | 系统字体渲染不一致 |
| ChatWindow.tsx:162 | `🧠` | 思考过程标题 | 无hover交互 |
| ChatWindow.tsx:194 | `📚` | 参考资料标题 | 视觉不统一 |
| ChatWindow.tsx:29,163,195 | `▶/▼` | 展开/折叠 | 无动画过渡 |
| ThinkingChainDisplay.tsx:40 | `✓` | 完成状态 | 与其他图标不协调 |
| ThinkingChainDisplay.tsx:211 | `⏳` | 等待动画 | 旋转效果粗糙 |
| StatsDashboard.tsx:186 | `✓/💡` | 状态提示 | 无语义化 |

### 动画现状

当前使用 `framer-motion`，但动画简单：
- Tab切换: 仅 `opacity: 0→1, y: 10→0`（200ms）
- 列表项: 无stagger效果，同时入场
- 加载状态: 文字提示 "Loading..."，无骨架屏
- 流式光标: `opacity: [0,1,0]` 循环（500ms），单调

### 未汉化文本

```typescript
// ChatWindow.tsx
"Chat"                         // Tab标题
"Click to upload"              // 上传提示
"Grid", "Tree"                 // 视图切换

// ChunkExplorer.tsx  
"Previous", "Next"             // 分页
"All Levels", "Small Only"     // 筛选

// StatsDashboard.tsx
"System Statistics"            // 标题
"Documents Processed"          // 统计项
"Quality Distribution"         // 图表标题

// RetrievalFlow.tsx
"Retrieval Flow"               // 标题
"Query Embedding"              // 步骤名
"Submit a query to see..."     // 空状态提示
```

### 约束条件

- **不改动后端**: 仅前端UI层改造
- **保持WebSocket协议**: 不修改事件类型和数据结构
- **兼容Dark Mode**: 所有图标和动画需支持暗色模式
- **性能考量**: 骨架屏和动画不应显著增加渲染负担

### 相关方

- **用户**: 期望现代、流畅、全中文的界面体验
- **开发者**: 需要清晰的组织结构，便于后续扩展

## Goals / Non-Goals

**Goals:**
1. 专业图标系统：Lucide React替换所有emoji
2. 流畅动画效果：骨架屏、微交互、stagger动画
3. 全面汉化：用户可见文本全部为简体中文
4. 布局优化：Chat Tab Split View + 检索结果右侧面板
5. 文件管理独立Tab：完整文档管理功能
6. 分块数据联动：点击文档→显示分块

**Non-Goals:**
- 不实现国际化(i18n)框架（本轮仅硬编码中文）
- 不添加新的功能特性（仅改造现有UI）
- 不修改WebSocket事件协议
- 不优化响应式布局（保持当前桌面布局）

## Decisions

### Decision 1: 图标库选择 - Lucide React

**选择**: Lucide React

**理由**:
- 开源免费（MIT许可）
- TypeScript友好，支持Tree-shaking
- 与现有Framer Motion风格一致（圆润、现代）
- 图标丰富（Brain, BookOpen, Loader2, ChevronRight等均有）
- 支持dark mode（通过className控制颜色）

**备选方案**:
1. ❌ Heroicons: 图标较少，缺少Brain等特殊图标
2. ❌ React Icons: 包太大，引入不必要的图标集
3. ❌ 自定义SVG: 维护成本高，一致性难保证
4. ✅ Lucide React: 平衡了丰富度、大小、TypeScript支持

**使用方式**:
```typescript
import { Brain, BookOpen, Loader2, ChevronRight, ChevronDown } from 'lucide-react';

// 使用示例
<Brain className="w-4 h-4 text-gray-500" />
```

### Decision 2: 骨架屏方案 - Tailwind CSS + Animation

**选择**: 使用Tailwind的animate-pulse配合自定义骨架组件

**理由**:
- 无需额外库
- 与现有Tailwind架构一致
- 性能轻量，纯CSS动画

**实现方案**:
```typescript
const Skeleton: React.FC<{ className?: string }> = ({ className }) => (
  <div className={`bg-gray-200 dark:bg-gray-700 animate-pulse rounded ${className}`} />
);

// 使用
<Skeleton className="h-4 w-32" />  // 文字骨架
<Skeleton className="h-24 w-full" /> // 卡片骨架
```

### Decision 3: Chat Tab布局 - Split View

**选择**: 左侧ChatWindow (8/12) + 右侧RetrievalResultPanel (4/12)

**理由**:
- 检索结果在用户视野内，无需切换Tab
- 符合用户期望：发送问题→看到检索→看到答案
- 右侧面板可折叠，不占用聊天空间

**布局结构**:
```
┌─────────────────────────────────────────────────────────┐
│ 智能问答 Tab                                              │
│ ┌───────────────────────┐  ┌─────────────────────────┐ │
│ │ ChatWindow            │  │ RetrievalResultPanel    │ │
│ │ - 消息历史            │  │ - 检索完成后显示        │ │
│ │ - 流式答案            │  │ - 匹配片段列表          │ │
│ │ - 输入框              │  │ - 相似度分数            │ │
│ │                       │  │ - 可折叠                │ │
│ │ (col-span-8)          │  │ (col-span-4)            │ │
│ └───────────────────────┘  └─────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

**备选方案**:
1. ❌ 全屏Chat: 检索结果需要切换Tab查看
2. ❌ 检索独立Tab: 用户发送问题后需手动切换
3. ✅ Split View: 检索结果在视野内，符合直觉

### Decision 4: 文档选择联动 - Zustand共享状态

**选择**: 在store中新增 `selectedDocumentId`，ChunkExplorer读取并自动fetch

**理由**:
- Zustand已在用，无需引入新状态管理
- 跨Tab共享，DocumentManager点击后可跳转到分块Tab
- 简单直接，一个状态解决问题

**状态结构**:
```typescript
interface AppState {
  selectedDocumentId: string | null;
  setSelectedDocumentId: (id: string | null) => void;
}
```

**交互流程**:
```
DocumentManager: 点击文档 → setSelectedDocumentId(id) → 切换到分块Tab
ChunkExplorer: 监听selectedDocumentId → fetchChunks(id) → 显示分块
```

### Decision 5: 动画优化策略

**选择**: 保持Framer Motion，增强动画配置

**优化点**:
| 组件 | 当前动画 | 优化后动画 |
|------|---------|-----------|
| Tab切换 | opacity + y (200ms) | slideX + opacity (300ms, ease-out) |
| 列表项 | 同时入场 | stagger (delay: index * 50ms) |
| 卡片hover | whileHover: scale(1.02) | scale(1.02) + shadow + borderColor变化 |
| 流式光标 | opacity循环 (500ms) | 渐变 + 轻微摇摆 (800ms, ease-in-out) |
| 加载状态 | "Loading..." | Skeleton骨架屏 |

**动画配置示例**:
```typescript
// Tab切换动画
const tabVariants = {
  initial: { opacity: 0, x: 20 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -20 },
};

// Stagger列表入场
const listVariants = {
  animate: {
    transition: { staggerChildren: 0.05 }
  }
};
const itemVariants = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 }
};
```

## Risks / Trade-offs

### Risk 1: Lucide图标包体积
- **影响**: 新增约10KB（仅使用10个图标，Tree-shaking生效）
- **缓解**: Lucide支持Tree-shaking，仅打包使用的图标

### Risk 2: 动画性能开销
- **影响**: 增强动画可能增加GPU负担
- **缓解**: Framer Motion已优化，使用will-change提示浏览器；stagger动画间隔短（50ms）不累积

### Risk 3: 汉化遗漏
- **影响**: 部分文本未汉化，用户看到中英混用
- **缓解**: 编写汉化checklist，逐一排查；可添加简单lint规则检测英文

### Risk 4: 分块数据空状态
- **影响**: 用户未选择文档时，分块Tab仍可能显示空
- **缓解**: 空状态显示引导文案："请先在文档管理Tab上传并选择文档"

### Trade-off 1: 硬编码汉化 vs i18n框架
- **选择**: 本轮硬编码中文
- **代价**: 后续国际化需要重构
- **收益**: 快速实现，无额外依赖

### Trade-off 2: Split View vs 全屏Chat
- **选择**: Split View（聊天+检索结果）
- **代价**: Chat区域略小于全屏
- **收益**: 检索结果在视野内，符合用户直觉

## Migration Plan

### Phase 1: 图标替换 + 汉化 (P0)

1. 安装 `lucide-react` 依赖
2. 创建图标映射表，统一替换策略
3. 逐一替换各组件emoji
4. 汉化所有英文文本

### Phase 2: 动画优化 (P1)

1. 创建Skeleton组件
2. 替换Loading文字为骨架屏
3. 增强Tab切换动画
4. 添加列表stagger效果
5. 优化流式光标动画

### Phase 3: 布局重构 (P0)

1. 新增"文档管理"Tab
2. Chat Tab Split View布局
3. 创建RetrievalResultPanel组件
4. 移除侧边栏QuickUpload/DocumentList

### Phase 4: 状态联动 (P1)

1. 新增selectedDocumentId状态
2. DocumentManager点击跳转逻辑
3. ChunkExplorer监听并fetch
4. 空状态引导文案

### Rollback Strategy

- Git分支管理：所有改动在feature分支，合并前可回滚
- 组件保留：不删除原组件，创建新版本后替换
- 状态扩展：selectedDocumentId新增而非修改现有状态

## Open Questions

- 骨架屏颜色选择：使用gray-200（light）/ gray-700（dark），是否需要更柔和的渐变？
- 流式光标动画：是否需要模仿真实打字机的"停顿"效果？
- 检索结果面板默认状态：默认折叠还是展开？（建议：默认折叠，检索完成后自动展开）
- 文档选择后的Tab切换：是否自动切换到分块Tab？（建议：提供"查看分块"按钮，用户手动点击）