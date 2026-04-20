## Context

### 当前状态分析

```
前端组件架构现状
══════════════════════════════════════════════════════════

src/frontend/components/
├── ChatWindow.tsx        (420行)  ← 4个内联组件 + 主组件
├── StatsDashboard.tsx    (387行)  ← 4个内联组件 + 主组件
├── ChunkExplorer.tsx     (443行)  ← 2个内联组件 + 主组件
├── DocumentManager.tsx   (205行)  ← 0个内联组件
├── VisualApp.tsx         (277行)  ← 2个内联组件 + 主组件
└── ui/
    └── Skeleton.tsx      (已有)
```

### 痛点总结

| 组件 | 内联组件数 | 主要问题 |
|------|-----------|----------|
| ChatWindow | 4 | ConfidenceBadge手动颜色、170行消息渲染、6层嵌套 |
| StatsDashboard | 4 | PerformanceBadge手动映射、4个图表内联 |
| ChunkExplorer | 2 | TreeNode复杂递归、视图切换状态管理 |
| VisualApp | 2 | ConnectionIndicator内联、Tab切换逻辑混杂 |
| DocumentManager | 0 | 状态badge手动颜色、上传进度条样式分散 |

### 技术约束

- 使用 React 18 + TypeScript
- 已集成 Framer Motion 动画
- 已集成 Tailwind CSS
- 已集成 Lucide Icons
- 状态管理使用 Zustand
- 需保持现有功能不变（纯重构）

## Goals / Non-Goals

**Goals:**
- 提取所有内联组件为独立文件
- 集成 shadcn/ui 组件库
- 创建统一的设计令牌系统
- 按功能域重新组织组件目录
- 创建 frontend-design skill 提供设计规范
- 保持现有功能和行为不变

**Non-Goals:**
- 不改变现有业务逻辑
- 不修改后端 API
- 不引入新的状态管理方案
- 不改变组件的外部 API（props 接口）
- 不进行性能优化（虚拟化等）- 后续迭代

## Decisions

### D1: 使用 shadcn/ui 而非其他组件库

**选择**: shadcn/ui

**理由**:
- Copy-paste 模式，无 npm 依赖锁定
- Tailwind 原生，无需额外样式配置
- Radix UI primitives，可访问性好
- 易于定制，符合现有 Tailwind 架构

**替代方案考虑**:
- Ant Design: 太重，样式系统冲突
- Chakra UI: 不原生支持 Tailwind
- MUI: 样式系统完全不同
- Headless UI: 功能不如 Radix 全面

### D2: 组件目录结构

**选择**: 按功能域划分

```
src/frontend/components/
├── ui/                   ← shadcn 基础组件
│   ├── card.tsx
│   ├── badge.tsx
│   ├── collapsible.tsx
│   ├── scroll-area.tsx
│   ├── input.tsx
│   ├── button.tsx
│   └── skeleton.tsx      ← 已有
│
├── common/               ← 跨域通用组件
│   ├── ConnectionIndicator.tsx
│   ├── DocumentSelector.tsx
│   └── StatusBadge.tsx
│
├── chat/                 ← 聊天功能域
│   ├── ChatWindow.tsx    ← 主组件
│   ├── ConfidenceBadge.tsx
│   ├── RetrievalStatsPanel.tsx
│   ├── SourceCard.tsx
│   ├── StreamingIndicator.tsx
│   ├── MessageList.tsx
│   └── MessageInput.tsx
│
├── stats/                ← 统计功能域
│   ├── StatsDashboard.tsx ← 主组件
│   ├── PerformanceBadge.tsx
│   ├── StatCard.tsx
│   ├── QualityDistributionChart.tsx
│   └── StageTimeChart.tsx
│
├── chunks/               ← 分块功能域
│   ├── ChunkExplorer.tsx  ← 主组件
│   ├── ChunkCard.tsx
│   ├── TreeNode.tsx
│   └── ChunkToolbar.tsx
│
└── documents/            ← 文档功能域
│   └── DocumentManager.tsx ← 主组件
│   ├── UploadArea.tsx
│   └── DocumentList.tsx
```

**理由**: 
- 功能域清晰，便于定位
- 组件职责明确
- 便于后续扩展
- 与现有代码心智模型一致

### D3: 设计令牌系统

**选择**: Tailwind CSS 扩展 + CSS 变量

```javascript
// tailwind.config.js 扩展
module.exports = {
  theme: {
    extend: {
      colors: {
        // 语义化颜色
        confidence: {
          high: 'hsl(142, 76%, 36%)',    // 绿色系
          medium: 'hsl(38, 92%, 50%)',   // 黄色系  
          low: 'hsl(0, 84%, 60%)',       // 红色系
        },
        status: {
          pending: 'hsl(48, 96%, 53%)',
          processing: 'hsl(214, 95%, 52%)',
          indexed: 'hsl(142, 76%, 36%)',
          error: 'hsl(0, 84%, 60%)',
        },
        // shadcn 风格
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        card: 'hsl(var(--card))',
        ...
      }
    }
  }
}
```

**理由**: 
- 语义化命名便于理解
- CSS 变量支持动态主题切换
- 与 shadcn/ui 风格一致

### D4: frontend-design skill 结构

**选择**: 三层结构

```
.claude/skills/frontend-design/
├── templates/            ← 组件模板
│   ├── card.tsx
│   ├── badge.tsx
│   ├── collapsible.tsx
│   └── ...
│
├── tokens/               ← 设计令牌定义
│   ├── colors.ts
│   ├── spacing.ts
│   └── variants.ts
│
├── examples/             ← 使用示例
│   ├── chat-window.tsx
│   ├── stats-dashboard.tsx
│   └── ...
│
└── skill.md              ← skill 定义
```

## Risks / Trade-offs

### R1: 组件提取可能引入命名冲突
**风险**: 提取后的组件可能与现有其他组件同名
**缓解**: 使用功能域前缀（chat/、stats/、chunks/）隔离命名空间

### R2: shadcn/ui 组件定制成本
**风险**: shadcn 组件需要手动复制和定制
**缓解**: frontend-design skill 提供已定制好的模板

### R3: 大规模重构可能影响稳定性
**风险**: 420+387+443+277=1527行代码重构，可能引入错误
**缓解**: 
- 分阶段实施（P0提取 → P1替换 → P2优化）
- 每阶段运行测试验证
- 保持组件 props 接口不变

### R4: 设计令牌迁移成本
**风险**: 现有硬编码颜色需要逐一替换
**缓解**: 
- 使用 replace_all 批量替换
- 创建迁移脚本辅助

## Migration Plan

### Phase 1: 组件提取 (P0)
1. 创建功能域目录结构
2. 提取 ChatWindow 内联组件
3. 提取 StatsDashboard 内联组件  
4. 提取 ChunkExplorer 内联组件
5. 提取 VisualApp 内联组件
6. 更新导入路径
7. 运行测试验证

### Phase 2: shadcn/ui 集成 (P1)
1. 安装 shadcn/ui CLI
2. 初始化 shadcn 配置
3. 添加 Card、Badge、Collapsible、ScrollArea、Input、Button
4. 替换现有组件中的手动样式
5. 运行测试验证

### Phase 3: 设计令牌系统 (P2)
1. 扩展 tailwind.config.js
2. 替换硬编码颜色为语义化令牌
3. 创建 frontend-design skill
4. 运行测试验证

### Phase 4: 交互优化 (P3)
1. 实现可折叠面板
2. 优化消息列表渲染
3. 改进分块探索器交互
4. 运行测试验证

### 回滚策略
- 每个 Phase 创建独立 Git 分支
- 每个 Phase 完成后合并到主分支
- 如发现问题，可回滚到上一个 Phase 的稳定状态