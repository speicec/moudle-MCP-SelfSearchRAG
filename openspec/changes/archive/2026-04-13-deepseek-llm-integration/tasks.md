## 1. Backend LLM Service

- [x] 1.1 Create LLMGenerationService class
  - Create `src/server/services/LLMGenerationService.ts`
  - Implement DeepSeek API client with streaming support
  - Add configuration for API key, base URL, model

- [x] 1.2 Implement SSE stream parsing
  - Parse DeepSeek SSE response format
  - Extract reasoning_content and content fields separately
  - Handle stream errors and termination

- [x] 1.3 Implement prompt construction
  - Combine user query with retrieved context
  - Format reference material section with chunk contents
  - Add instructions for answer generation

- [x] 1.4 Add environment configuration
  - Add DEEPSEEK_API_KEY, DEEPSEEK_BASE_URL, DEEPSEEK_MODEL env vars
  - Add validation for required configuration
  - Document configuration in design.md

## 2. Backend API Routes

- [x] 2.1 Create SSE endpoint /api/chat/generate
  - Add new route in chat.ts for streaming generation
  - Implement SSE response headers and format
  - Handle two-phase flow: retrieval then generation

- [x] 2.2 Implement WebSocket to SSE conversion
  - Receive WebSocket query request
  - Execute retrieval phase first
  - Call DeepSeek SSE API
  - Convert SSE chunks to WebSocket events

- [x] 2.3 Test SSE endpoint
  - Test streaming response format
  - Test error handling
  - Test fallback when no API key configured

## 3. WebSocket Events Extension

- [x] 3.1 Add generation event types to types.ts
  - Add generation:start, generation:thinking, generation:answer, generation:complete types
  - Define event payload structures

- [x] 3.2 Extend PipelineEmitter with generation methods
  - Add emitGenerationStart method
  - Add emitGenerationThinking method
  - Add emitGenerationAnswer method
  - Add emitGenerationComplete method

- [x] 3.3 Update WebSocket handler for generation events
  - Ensure generation events are properly broadcast
  - Add logging for generation events

## 4. Frontend Thinking Chain Component

- [x] 4.1 Create ThinkingChainDisplay component
  - Create `src/frontend/components/ThinkingChainDisplay.tsx`
  - Implement three-phase display (analysis, retrieval, synthesis)
  - Add expand/collapse functionality

- [x] 4.2 Implement phase status visualization
  - Add pending (○), running (animated), completed (✓) indicators
  - Add phase labels in Chinese

- [x] 4.3 Implement thinking content streaming display
  - Handle generation:thinking WebSocket events
  - Append thinking content with cursor animation
  - Format thinking content in monospace

- [x] 4.4 Implement retrieved sources display
  - Show sources count in retrieval phase
  - Add mini source cards with similarity scores
  - Make sources expandable

## 5. Frontend Chat UI Refactor

- [x] 5.1 Modify VisualApp.tsx layout
  - Add Chat as main tab in header
  - Implement Split View: Chat left (col-span-8), Analysis right (col-span-4)
  - Make Chat default active tab

- [x] 5.2 Refactor ChatWindow for full chat experience
  - Expand to use full Chat Tab area
  - Add message history display area
  - Add input area at bottom

- [x] 5.3 Implement streaming answer display
  - Handle generation:answer WebSocket events
  - Append answer text character-by-character
  - Add streaming cursor animation

- [x] 5.4 Implement sources display with answer
  - Add sources summary section after answer
  - Add expand button for sources
  - Display source cards with full content

## 6. Frontend State Management

- [x] 6.1 Extend ChatState in useChatStore
  - Add isGenerating, phase, currentThinking, currentAnswer states
  - Add streaming state management

- [x] 6.2 Add generation event handlers
  - Add handleGenerationStart method
  - Add handleGenerationThinking method
  - Add handleGenerationAnswer method
  - Add handleGenerationComplete method

- [x] 6.3 Extend WebSocket hook for generation events
  - Handle generation:start event
  - Handle generation:thinking event
  - Handle generation:answer event
  - Handle generation:complete event

## 7. Integration Testing

- [x] 7.1 Test two-phase flow
  - Test retrieval → generation transition
  - Test WebSocket events sequence
  - Test frontend state updates

- [x] 7.2 Test streaming display
  - Test thinking chain animation
  - Test answer streaming animation
  - Test sources display

- [x] 7.3 Test error handling
  - Test DeepSeek API failure
  - Test WebSocket disconnection during generation
  - Test empty retrieval results

- [x] 7.4 Test configuration
  - Test with valid API key
  - Test with missing API key
  - Test with custom model setting

## 8. Documentation and Cleanup

- [x] 8.1 Update environment configuration docs
  - Document required DEEPSEEK_API_KEY
  - Document optional DEEPSEEK_BASE_URL, DEEPSEEK_MODEL

- [x] 8.2 Clean up unused code
  - Remove old ChatWindow if replaced
  - Clean up unused imports

- [x] 8.3 Update README if exists
  - Document new Chat Tab interface
  - Document thinking chain feature
  - Document LLM integration