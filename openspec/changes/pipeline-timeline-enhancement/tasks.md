## 1. Data Layer - TimelineStore Updates

- [ ] 1.1 Add 'chunk' to TimelineStage name type definition
- [ ] 1.2 Add 'chunk' to initialStages array
- [ ] 1.3 Add LogEntry interface to timelineStore (timestamp, message, type)
- [ ] 1.4 Add stageLogs: Map<stageName, LogEntry[]> to TimelineState
- [ ] 1.5 Add globalLogs: LogEntry[] to TimelineState
- [ ] 1.6 Add maxStageLogs: 20 and maxGlobalLogs: 100 constants
- [ ] 1.7 Add addStageLog(stage, entry) handler with auto-truncate
- [ ] 1.8 Add addGlobalLog(entry) handler with auto-truncate
- [ ] 1.9 Add clearLogs() handler
- [ ] 1.10 Update handleStageStart to call addStageLog/addGlobalLog
- [ ] 1.11 Update handleStageProgress to call addStageLog/addGlobalLog (if message exists)
- [ ] 1.12 Update handleStageComplete to call addStageLog/addGlobalLog
- [ ] 1.13 Update handleError to call addStageLog with type='error'

## 2. WebSocket Handler Updates

- [ ] 2.1 Update useWebSocket to extract message field from events
- [ ] 2.2 Add timelineStore.addGlobalLog calls for all pipeline events
- [ ] 2.3 Add timelineStore.addStageLog calls for stage-specific events

## 3. Flow Animation Component

- [ ] 3.1 Create AnimatedFlowLine.tsx in components/timeline/
- [ ] 3.2 Implement gradient particle with Framer Motion
- [ ] 3.3 Add isActive prop to control animation state
- [ ] 3.4 Add isCompleted prop for static completed line
- [ ] 3.5 Use semantic color tokens (primary, confidence-high)

## 4. Stage Card Components

- [ ] 4.1 Create StageCard.tsx in components/timeline/
- [ ] 4.2 Use Card from shadcn/ui as container
- [ ] 4.3 Add StatusIndicator component (completed/running/pending/error icons)
- [ ] 4.4 Add Collapsible for log panel
- [ ] 4.5 Create StageLogList.tsx for displaying stage logs
- [ ] 4.6 Add auto-expand behavior for running stages
- [ ] 4.7 Use semantic color tokens for stage status

## 5. Global Log Panel

- [ ] 5.1 Create GlobalLogPanel.tsx in components/timeline/
- [ ] 5.2 Use Collapsible component for expand/collapse
- [ ] 5.3 Display recent logs with timestamp and type styling
- [ ] 5.4 Add auto-scroll to newest log entry
- [ ] 5.5 Add scrollable container for log list

## 6. PipelineTimeline Main Component Refactor

- [ ] 6.1 Add stageLabels for chunk stage
- [ ] 6.2 Add stageColors for chunk stage (cyan theme)
- [ ] 6.3 Replace hardcoded colors with semantic tokens
- [ ] 6.4 Update grid layout to grid-cols-5 responsive
- [ ] 6.5 Add gradient container wrapper
- [ ] 6.6 Replace static connection lines with AnimatedFlowLine
- [ ] 6.7 Replace inline StageCard with imported component
- [ ] 6.8 Add GlobalLogPanel at bottom
- [ ] 6.9 Add chunk stage metrics display

## 7. CSS/Theme Updates

- [ ] 7.1 Add stage-chunk color tokens to tailwind.config.js (optional)
- [ ] 7.2 Verify semantic status colors work in PipelineTimeline

## 8. Verification

- [ ] 8.1 Process document and verify chunk stage appears correctly
- [ ] 8.2 Verify stage logs are cached and displayed
- [ ] 8.3 Verify global logs panel works
- [ ] 8.4 Verify flow animation displays on running stage
- [ ] 8.5 Verify colors match semantic tokens in both themes
- [ ] 8.6 Test responsive layout at different viewport sizes