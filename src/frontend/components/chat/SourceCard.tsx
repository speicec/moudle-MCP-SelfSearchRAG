import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { EvidenceCard } from '../EvidencePanel';
import ConfidenceBadge from './ConfidenceBadge';
import type { RetrievalResult } from '../../store';
import type { ConfidenceLevel } from '../../store/retrievalStore';

/**
 * SourceCard - Wrapper for EvidenceCard with confidence badge support
 * Legacy component now uses EvidenceCard internally
 */
const SourceCard: React.FC<{
  result: RetrievalResult;
  index: number;
  confidenceScore?: number;
  confidenceLevel?: ConfidenceLevel;
}> = ({ result, index, confidenceScore, confidenceLevel }) => {
  // Transform to EvidenceCard format
  const evidenceResult = {
    smallChunkId: result.smallChunkId ?? '',
    parentChunkId: result.parentChunkId ?? undefined,
    parentChunkContent: result.parentChunkContent ?? '',
    similarityScore: result.similarityScore ?? 0,
    sourceDocumentId: result.sourceDocumentId ?? undefined,
    confidenceLevel: confidenceLevel ?? (
      result.similarityScore >= 0.7 ? 'high' :
      result.similarityScore >= 0.5 ? 'medium' : 'low'
    ),
  };

  return (
    <EvidenceCard
      result={evidenceResult}
      index={index}
      showQualityBadge={true}
    />
  );
};

export default SourceCard;