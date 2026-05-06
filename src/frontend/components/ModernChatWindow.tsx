/**
 * ModernChatWindow - 重构后的聊天窗口组件
 *
 * 设计目标:
 * - 清晰的 Flexbox 布局层级，确保滚动只在消息区域内部
 * - 使用 shadcn/ui Card 组件构建现代化界面
 * - 证据来源区域有独立的 maxHeight 滚动
 * - 简洁的专业医学风格
 */
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useChatStore, type RetrievalResult } from '../store';
import { Card, CardHeader, CardContent, CardFooter } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { ScrollArea } from './ui/scroll-area';
import ClinicalMarkdown from './ClinicalMarkdown';
import {
  Send,
  RotateCcw,
  Brain,
  BookOpen,
  ChevronDown,
  ChevronRight,
  Clock,
  AlertCircle,
  Sparkles,
  Activity,
  ShieldCheck,
  Search,
  Hash,
  FileText,
  Copy,
  Check,
} from 'lucide-react';

// ==================== 证据卡片组件 ====================

type GradeLevel = 'A' | 'B' | 'C' | 'D';

const GRADE_CONFIG: Record<GradeLevel, { color: string; bg: string; label: string }> = {
  A: { color: 'text-green-600', bg: 'bg-green-100', label: '高质量' },
  B: { color: 'text-teal-600', bg: 'bg-teal-100', label: '中等质量' },
  C: { color: 'text-orange-600', bg: 'bg-orange-100', label: '低质量' },
  D: { color: 'text-gray-500', bg: 'bg-gray-100', label: '极低质量' },
};

const EvidenceCard: React.FC<{
  result: RetrievalResult;
  index: number;
}> = ({ result, index }) => {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  // 计算质量等级
  const grade: GradeLevel = result.evidenceEvaluation?.grade ??
    (result.semanticScore ?? result.similarityScore) >= 0.85 ? 'A' :
    (result.semanticScore ?? result.similarityScore) >= 0.70 ? 'B' :
    (result.semanticScore ?? result.similarityScore) >= 0.50 ? 'C' : 'D';

  const gradeConfig = GRADE_CONFIG[grade];
  const score = result.semanticScore ?? result.similarityScore;
  const hasSemantic = result.semanticScore !== undefined;

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(result.parentChunkContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [result.parentChunkContent]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03 }}
      className="group"
    >
      <Card className="hover:border-teal-300 transition-colors overflow-hidden">
        {/* 头部：ID + 来源 + 质量徽章 */}
        <div className="flex items-center justify-between px-3 py-2 bg-muted/50 border-b">
          <div className="flex items-center gap-2 min-w-0">
            <Badge variant="outline" className="font-mono text-xs shrink-0">
              <Hash className="w-3 h-3 mr-1" />
              EV-{String(index + 1).padStart(3, '0')}
            </Badge>
            {result.sourceDocumentId && (
              <span className="text-xs text-muted-foreground truncate flex items-center gap-1">
                <FileText className="w-3 h-3 shrink-0" />
                {result.sourceDocumentId.slice(0, 16)}...
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* 相似度分数 */}
            <div className="flex items-center gap-1">
              <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${score * 100}%` }}
                  transition={{ duration: 0.5 }}
                  className={grade === 'A' ? 'bg-green-500' : grade === 'B' ? 'bg-teal-500' : grade === 'C' ? 'bg-orange-500' : 'bg-gray-400'}
                />
              </div>
              <span className="text-xs font-mono text-muted-foreground">
                {Math.round(score * 100)}%
              </span>
            </div>

            {/* 质量徽章 */}
            <Badge className={`${gradeConfig.bg} ${gradeConfig.color} font-mono`}>
              {grade}
            </Badge>
          </div>
        </div>

        {/* 可折叠内容 */}
        <AnimatePresence initial={false}>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              {/* 元数据 */}
              <div className="px-3 py-2 bg-muted/30 border-b text-xs grid grid-cols-2 gap-x-4 gap-y-1">
                <div className="flex items-center gap-1">
                  <span className="text-muted-foreground">匹配类型:</span>
                  <Badge variant="outline" className="text-xs">
                    {hasSemantic ? '语义' : '关键词'}
                  </Badge>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-muted-foreground">质量评级:</span>
                  <span className={gradeConfig.color}>{gradeConfig.label}</span>
                </div>
                {result.evidenceEvaluation?.literatureType && (
                  <div className="flex items-center gap-1">
                    <span className="text-muted-foreground">文献类型:</span>
                    <span>{result.evidenceEvaluation.literatureType}</span>
                  </div>
                )}
                {result.evidenceEvaluation?.compositeScore && (
                  <div className="flex items-center gap-1">
                    <span className="text-muted-foreground">综合评分:</span>
                    <span className="font-mono">{Math.round(result.evidenceEvaluation.compositeScore * 100)}%</span>
                  </div>
                )}
              </div>

              {/* 内容文本 */}
              <div className="px-3 py-2 text-sm text-foreground leading-relaxed max-h-32 overflow-y-auto">
                {result.parentChunkContent}
              </div>

              {/* 操作按钮 */}
              <div className="px-3 py-2 border-t flex justify-end">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCopy}
                  className="h-7 text-xs"
                >
                  {copied ? <Check className="w-3 h-3 mr-1" /> : <Copy className="w-3 h-3 mr-1" />}
                  {copied ? '已复制' : '复制'}
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 底部：展开按钮 + 预览 */}
        <div className="px-3 py-2">
          <button
            onClick={() => setExpanded(!expanded)}
            className="w-full flex items-center justify-between text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <span className="truncate pr-2">
              {!expanded && result.parentChunkContent.slice(0, 80)}
              {!expanded && result.parentChunkContent.length > 80 && '...'}
            </span>
            <motion.div animate={{ rotate: expanded ? 180 : 0 }} className="shrink-0">
              <ChevronDown className="w-4 h-4" />
            </motion.div>
          </button>
        </div>
      </Card>
    </motion.div>
  );
};

// ==================== 消息卡片组件 ====================

const MessageCard: React.FC<{
  role: 'user' | 'assistant';
  content: string;
  thinking?: string;
  sources?: RetrievalResult[];
  timestamp?: number;
}> = ({ role, content, thinking, sources, timestamp }) => {
  const [showThinking, setShowThinking] = useState(false);
  const [showSources, setShowSources] = useState(false);

  if (role === 'user') {
    return (
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        className="flex justify-end"
      >
        <Card className="max-w-[75%] bg-teal-600 text-white border-teal-600">
          <CardContent className="p-3">
            <p className="text-sm leading-relaxed">{content}</p>
          </CardContent>
          {timestamp && (
            <CardFooter className="p-2 pt-0 justify-end">
              <span className="text-xs text-teal-200">
                {new Date(timestamp).toLocaleTimeString()}
              </span>
            </CardFooter>
          )}
        </Card>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full"
    >
      <Card className="border-t-2 border-t-teal-500">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Brain className="w-4 h-4 text-teal-600" />
              <span className="font-medium text-sm">诊断结论</span>
            </div>
            {timestamp && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {new Date(timestamp).toLocaleTimeString()}
              </span>
            )}
          </div>
        </CardHeader>

        <CardContent className="pb-2">
          {/* 思考过程（可折叠） */}
          {thinking && (
            <div className="mb-3">
              <button
                onClick={() => setShowThinking(!showThinking)}
                className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 transition-colors"
              >
                {showThinking ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                <Activity className="w-3 h-3" />
                推理过程
              </button>
              <AnimatePresence>
                {showThinking && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="mt-2 overflow-hidden"
                  >
                    <ScrollArea className="h-32 rounded-md bg-blue-50 p-3 text-xs font-mono text-blue-900 whitespace-pre-wrap">
                      {thinking}
                    </ScrollArea>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* 主要回答内容 */}
          <div className="min-h-[60px]">
            <ClinicalMarkdown content={content} />
          </div>
        </CardContent>

        {/* 证据来源（可折叠） */}
        {sources && sources.length > 0 && (
          <CardFooter className="flex-col items-stretch pt-0 border-t mt-2">
            <button
              onClick={() => setShowSources(!showSources)}
              className="w-full flex items-center justify-between py-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <div className="flex items-center gap-1">
                <BookOpen className="w-3 h-3" />
                <span>证据来源</span>
                <Badge variant="secondary" className="ml-1">{sources.length}</Badge>
              </div>
              <motion.div animate={{ rotate: showSources ? 180 : 0 }}>
                <ChevronDown className="w-4 h-4" />
              </motion.div>
            </button>

            <AnimatePresence>
              {showSources && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  {/* 关键：证据列表有 maxHeight 和独立滚动 */}
                  <ScrollArea className="h-[280px] mt-2">
                    <div className="flex flex-col gap-2 pr-2">
                      {sources.map((source, idx) => (
                        <EvidenceCard key={source.smallChunkId} result={source} index={idx} />
                      ))}
                    </div>
                  </ScrollArea>
                </motion.div>
              )}
            </AnimatePresence>
          </CardFooter>
        )}
      </Card>
    </motion.div>
  );
};

// ==================== 流式生成卡片 ====================

const StreamingCard: React.FC<{
  phase: 'analysis' | 'retrieval' | 'reasoning' | 'answer' | 'complete';
  thinking?: string;
  answer?: string;
  sourcesCount?: number;
}> = ({ phase, thinking, answer, sourcesCount }) => {
  const phaseLabels = {
    analysis: '分析查询',
    retrieval: '检索证据',
    reasoning: '推理思考',
    answer: '生成回答',
    complete: '完成',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <Card className="border-t-2 border-t-blue-500 bg-gradient-to-b from-blue-50/50 to-transparent">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <motion.div
                animate={{ rotate: phase === 'complete' ? 0 : 360 }}
                transition={{ duration: 1, repeat: phase === 'complete' ? 0 : Infinity, ease: 'linear' }}
              >
                <Sparkles className="w-4 h-4 text-blue-600" />
              </motion.div>
              <span className="font-medium text-sm">{phaseLabels[phase]}</span>
            </div>
            <Badge variant="outline" className="animate-pulse">
              实时生成
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="pb-2">
          {/* 思考过程 */}
          {thinking && (
            <ScrollArea className="h-24 mb-3 rounded-md bg-blue-100/50 p-3 text-xs font-mono text-blue-900 whitespace-pre-wrap">
              {thinking}
            </ScrollArea>
          )}

          {/* 回答内容 */}
          {answer && (
            <div className="min-h-[40px]">
              <ClinicalMarkdown content={answer} streaming />
            </div>
          )}

          {/* 源预览 */}
          {sourcesCount && sourcesCount > 0 && (
            <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
              <Search className="w-3 h-3" />
              已检索 {sourcesCount} 条证据
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
};

// ==================== 主聊天窗口组件 ====================

const ModernChatWindow: React.FC = () => {
  const {
    messages,
    isLoading,
    error,
    isGenerating,
    generationPhase,
    currentThinking,
    currentAnswer,
    currentSources,
    submitQuery,
    clearHistory,
  } = useChatStore();

  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 消息完成时滚动到底部
  useEffect(() => {
    if (!isGenerating && messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [isGenerating, messages.length]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    const query = input.trim();
    setInput('');
    await submitQuery(query);
  }, [input, isLoading, submitQuery]);

  return (
    // 关键：容器使用 flex column + h-full + overflow-hidden
    <div className="flex flex-col h-full overflow-hidden">
      {/* 消息区域 - 关键：flex-1 + min-h-0 + overflow-hidden */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="p-4 flex flex-col gap-4">
          {/* 空状态 */}
          {messages.length === 0 && !isGenerating && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center py-12 text-center"
            >
              <motion.div
                animate={{ scale: [1, 1.05, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="mb-4"
              >
                <ShieldCheck className="w-12 h-12 text-teal-600" />
              </motion.div>
              <h3 className="text-lg font-semibold mb-2">智能诊断对话</h3>
              <p className="text-sm text-muted-foreground mb-6 max-w-xs">
                输入医学问题，AI 将基于检索证据生成专业回答
              </p>
              <div className="flex flex-col gap-2 text-xs text-muted-foreground">
                <span>• 支持药物对比查询</span>
                <span>• 自动识别医学实体</span>
                <span>• 提供证据来源追溯</span>
              </div>
            </motion.div>
          )}

          {/* 历史消息 */}
          {messages.map((msg) => (
            <MessageCard
              key={msg.id}
              role={msg.role}
              content={msg.content}
              thinking={msg.thinking}
              sources={msg.results}
              timestamp={msg.timestamp}
            />
          ))}

          {/* 流式生成状态 */}
          {isGenerating && (
            <StreamingCard
              phase={generationPhase}
              thinking={currentThinking}
              answer={currentAnswer}
              sourcesCount={currentSources.length}
            />
          )}

          {/* 滚动锚点 */}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* 错误提示 */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="px-4 py-2"
          >
            <Card className="bg-red-50 border-red-200">
              <CardContent className="p-2 flex items-center gap-2 text-sm text-red-700">
                <AlertCircle className="w-4 h-4" />
                {error}
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 输入区域 - 关键：flex-shrink-0 */}
      <div className="flex-shrink-0 border-t bg-muted/30 p-3">
        <form onSubmit={handleSubmit} className="flex flex-col gap-2">
          <div className="flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="输入医学问题，如：二甲双胍和利拉鲁肽哪个更适合肾功能不全患者？"
              disabled={isLoading}
              className="flex-1"
            />
            <Button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="shrink-0"
            >
              <Send className="w-4 h-4 mr-1" />
              发送
            </Button>
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>按 Enter 发送</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={clearHistory}
              disabled={isLoading}
              className="h-6"
            >
              <RotateCcw className="w-3 h-3 mr-1" />
              清空历史
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ModernChatWindow;