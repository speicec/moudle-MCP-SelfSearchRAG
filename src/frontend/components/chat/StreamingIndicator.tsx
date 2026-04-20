import React from 'react';
import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';

/**
 * Streaming indicator - shows current generation phase
 */
const StreamingIndicator: React.FC<{
  phase: 'idle' | 'analysis' | 'retrieval' | 'reasoning' | 'answer' | 'complete' | 'error';
}> = ({ phase }) => {
  const phaseLabels = {
    idle: '',
    analysis: '分析问题...',
    retrieval: '检索资料...',
    reasoning: '正在思考...',
    answer: '生成回答...',
    complete: '完成',
    error: '出错',
  };

  if (phase === 'idle' || phase === 'complete') return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex items-center gap-2 text-sm text-primary mb-4"
    >
      <Loader2 className="w-4 h-4 animate-spin" />
      <span>{phaseLabels[phase]}</span>
    </motion.div>
  );
};

export default StreamingIndicator;