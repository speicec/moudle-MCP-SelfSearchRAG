## Why

当前前端存在多个用户体验问题，不符合现代React应用的交互标准：

1. **Emoji图标不专业**: 使用 `🧠`、`📚`、`⏳` 等emoji作为图标，在不同系统/浏览器渲染不一致，显得不专业
2. **动画效果粗糙**: 仅有基础的opacity动画，缺少现代UI应有的微交互反馈（hover、press、loading states）
3. **语言混用**: 大量英文文本（如 "Chat"、"Grid"、"Previous/Next"）与中文混用，不符合简体中文用户期望
4. **检索过程位置不合理**: 检索可视化独立Tab，用户发送问题后需要手动切换才能看到检索过程
5. **文件管理功能缺失**: DocumentManager组件存在但未作为独立Tab，缺少搜索和完整管理能力
6. **分块结构数据空置**: ChunkExplorer需要documentId但无文档选择UI，导致分块Tab始终显示"No chunks available"

## What Changes

### 1. 图标系统现代化
- **引入 Lucide React**: 替换所有emoji为专业SVG图标库
- **统一图标风格**: 保持一致的视觉语言，支持dark mode
- **图标映射表**:
  | 原Emoji | 新图标 | 用途 |
  |---------|--------|------|
  | ⏳ | Loader2 | 加载/等待状态 |
  | 🧠 | Brain | 思考过程 |
  | 📚 | BookOpen | 参考资料 |
  | ▶ | ChevronRight | 展开 |
  | ▼ | ChevronDown | 折叠 |
  | ✓ | Check | 完成/成功 |
  | 💡 | Lightbulb | 提示/建议 |

### 2. 动画效果优化
- **骨架屏(Skeleton)**: 替换简单的加载文字为骨架屏动画
- **微交互**: hover scale、press feedback、focus ring增强
- **流式光标优化**: 更平滑的打字机效果，添加渐变动画
- **列表入场动画**: staggered animation，元素依次入场
- **Tab切换优化**: 从opacity变化改为slide+fade组合动画

### 3. 全面汉化
- **Tab标题**: Chat → 智能问答，新增 文档管理 Tab
- **组件内文本**: Grid/Tree → 网格/树状，Previous/Next → 上一页/下一页
- **状态标签**: pending → 等待中，processing → 处理中，indexed → 已索引
- **提示信息**: 所有英文提示转为简体中文

### 4. 检索过程位置重构
- **布局调整**: 智能问答Tab改为左侧ChatWindow(8/12) + 右侧检索结果面板(4/12)
- **移除快速上传**: Chat Tab右侧不再显示QuickUpload
- **检索完成后显示**: 用户发送问题后，右侧面板显示检索结果（匹配片段+相似度分数）

### 5. 文件管理Tab独立化
- **新增独立Tab**: 文档管理 作为第一个Tab
- **完整功能展示**: 文档列表、上传、删除、搜索功能
- **移除侧边栏组件**: QuickUpload和DocumentList从侧边栏移除

### 6. 分块结构数据打通
- **文档选择联动**: 分块Tab左侧显示文档列表，点击文档后右侧显示对应分块
- **状态管理**: 新增 `selectedDocumentId` 状态，跨Tab共享
- **空状态优化**: 无文档时显示引导提示而非"No chunks available"

### **BREAKING** 变化
- Tab顺序变更: 新增"文档管理"作为第一Tab
- Chat Tab布局变更: 从全宽变为左侧聊天+右侧检索结果
- 移除侧边栏的QuickUpload和DocumentList组件

## Capabilities

### New Capabilities
- `lucide-icons-integration`: Lucide React图标库集成，替换所有emoji
- `skeleton-loading`: 骨架屏加载状态，替代简单文字提示
- `document-selection-sync`: 文档选择状态跨Tab同步，分块Tab可选择文档
- `retrieval-result-panel`: 检索结果在Chat Tab右侧实时显示

### Modified Capabilities
- `chat-tab-layout`: Chat布局从全宽变为Split View（聊天+检索结果）
- `document-manager-tab`: DocumentManager作为独立Tab展示
- `chunk-explorer-selection`: ChunkExplorer支持文档选择联动
- `i18n-chinese`: 全面汉化所有用户可见文本

## Impact

### 前端文件改动
- `src/frontend/components/VisualApp.tsx` - Tab重构、布局调整、状态管理
- `src/frontend/components/ChatWindow.tsx` - 图标替换、动画优化、汉化、检索结果集成
- `src/frontend/components/DocumentManager.tsx` - 图标替换、汉化、搜索功能、动画优化
- `src/frontend/components/ChunkExplorer.tsx` - 图标替换、动画优化、汉化、文档选择联动
- `src/frontend/components/RetrievalFlow.tsx` - 汉化（检索过程Tab保留）
- `src/frontend/components/StatsDashboard.tsx` - 图标替换、汉化
- `src/frontend/components/ThinkingChainDisplay.tsx` - 图标替换、动画优化
- `src/frontend/store/index.ts` - 新增selectedDocumentId状态

### 新增依赖
- `lucide-react` - SVG图标库

### 不涉及后端改动
- 本次改造仅涉及前端UI层，后端API和数据结构不变