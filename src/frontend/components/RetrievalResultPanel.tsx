import React from 'react';
import { motion } from 'framer-motion';
import { EvidencePanel } from './EvidencePanel';
import { useChatStore } from '../store';
import type { RetrievalResult } from '../store';

/**
 * RetrievalResultPanel - Clinical evidence panel for chat sidebar
 *
 * Uses EvidencePanel component with lab report card styling
 * Displays retrieval results as evidence with quality grading
 */
const RetrievalResultPanel: React.FC = () => {
  const {
    currentSources,
    isGenerating,
    messages,
  } = useChatStore();

  // Get last message sources if available
  const lastMessageSources = messages.length > 0
    ? messages[messages.length - 1].results
    : null;

  // Display either current streaming sources or last message sources
  const displaySources: RetrievalResult[] = currentSources.length > 0
    ? currentSources
    : (lastMessageSources ?? []);

  // Transform sources to evidence format
  const evidenceResults = displaySources.map((result) => ({
    smallChunkId: result.smallChunkId ?? '',
    parentChunkId: result.parentChunkId ?? undefined,
    parentChunkContent: result.parentChunkContent ?? '',
    similarityScore: result.similarityScore ?? 0,
    sourceDocumentId: result.sourceDocumentId ?? undefined,
  }));

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="clinical-evidence-panel-wrapper"
    >
      <EvidencePanel
        results={evidenceResults}
        title="证据来源"
        isLoading={isGenerating && currentSources.length === 0}
      />
    </motion.div>
  );
};

export default RetrievalResultPanel;