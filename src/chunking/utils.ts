/**
 * Calculate cosine similarity between two vectors
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Vectors must have same length');
  }

  if (a.length === 0) {
    return 0;
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    const aVal = a[i]!;
    const bVal = b[i]!;
    dotProduct += aVal * bVal;
    normA += aVal * aVal;
    normB += bVal * bVal;
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);

  if (denominator === 0) {
    return 0;
  }

  return dotProduct / denominator;
}

/**
 * Calculate cosine similarity between adjacent embeddings
 * Returns array of similarity values: [s1, s2, s3, ...] where si is similarity between embedding i and i+1
 */
export function adjacentSimilarity(embeddings: number[][]): number[] {
  if (embeddings.length < 2) {
    return [];
  }

  const similarities: number[] = [];
  for (let i = 0; i < embeddings.length - 1; i++) {
    const current = embeddings[i]!;
    const next = embeddings[i + 1]!;
    similarities.push(cosineSimilarity(current, next));
  }

  return similarities;
}

/**
 * Calculate gradient between adjacent similarity values
 */
export function similarityGradient(similarities: number[]): number[] {
  if (similarities.length < 2) {
    return [];
  }

  const gradients: number[] = [];
  for (let i = 1; i < similarities.length; i++) {
    const current = similarities[i]!;
    const prev = similarities[i - 1]!;
    gradients.push(Math.abs(current - prev));
  }

  return gradients;
}

/**
 * Aggregate window embedding from multiple sentence embeddings
 * Uses mean aggregation
 */
export function aggregateEmbeddings(embeddings: number[][]): number[] {
  if (embeddings.length === 0) {
    return [];
  }

  const first = embeddings[0]!;
  const dimension = first.length;
  const aggregated: number[] = new Array(dimension).fill(0);

  for (const embedding of embeddings) {
    for (let i = 0; i < dimension; i++) {
      aggregated[i] = (aggregated[i] ?? 0) + (embedding[i] ?? 0);
    }
  }

  for (let i = 0; i < dimension; i++) {
    aggregated[i] = (aggregated[i] ?? 0) / embeddings.length;
  }

  return aggregated;
}

/**
 * Estimate token count for text (simple approximation)
 * ~4 characters per token for English text
 */
export function estimateTokenCount(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Split text into sentences
 */
export function splitIntoSentences(text: string): string[] {
  // Handle common sentence boundaries
  const sentenceEndings = /[.!?]+[\s]+/g;

  // Preserve the ending punctuation by including it in the split
  const sentences: string[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = sentenceEndings.exec(text)) !== null) {
    const sentence = text.slice(lastIndex, match.index + match[0].length).trim();
    if (sentence.length > 0) {
      sentences.push(sentence);
    }
    lastIndex = match.index + match[0].length;
  }

  // Add remaining text if not empty
  const remaining = text.slice(lastIndex).trim();
  if (remaining.length > 0) {
    sentences.push(remaining);
  }

  return sentences.filter(s => s.length > 0);
}

/**
 * Split text into paragraphs
 */
export function splitIntoParagraphs(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map(p => p.trim())
    .filter(p => p.length > 0);
}

/**
 * Check if text ends with complete sentence
 */
export function isCompleteSentence(text: string): boolean {
  return /[.!?]$/.test(text.trim());
}

/**
 * Count unique tokens in text (simple whitespace split)
 */
export function countUniqueTokens(text: string): number {
  const tokens = text.toLowerCase().split(/\s+/).filter(t => t.length > 0);
  const uniqueTokens = new Set(tokens);
  return uniqueTokens.size;
}

/**
 * Calculate repetition ratio in text
 */
export function calculateRepetitionRatio(text: string): number {
  const tokens = text.toLowerCase().split(/\s+/).filter(t => t.length > 0);
  if (tokens.length === 0) {
    return 0;
  }

  const uniqueTokens = new Set(tokens);
  const repetitionRatio = 1 - (uniqueTokens.size / tokens.length);

  return repetitionRatio;
}

/**
 * Merge multiple text chunks into single content
 */
export function mergeChunks(chunks: string[]): string {
  return chunks.join('\n\n');
}

/**
 * Truncate text to approximate token limit
 */
export function truncateToTokens(text: string, maxTokens: number): string {
  const approxChars = maxTokens * 4;
  if (text.length <= approxChars) {
    return text;
  }

  // Try to truncate at sentence boundary
  const truncated = text.slice(0, approxChars);
  const lastSentenceEnd = truncated.lastIndexOf('.');

  if (lastSentenceEnd > approxChars * 0.8) {
    return truncated.slice(0, lastSentenceEnd + 1);
  }

  return truncated + '...';
}

/**
 * Deduplicate chunks by ID
 */
export function deduplicateById<T extends { id: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  return items.filter(item => {
    if (seen.has(item.id)) {
      return false;
    }
    seen.add(item.id);
    return true;
  });
}

/**
 * Sort by similarity score descending
 */
export function sortBySimilarity<T extends { similarityScore: number }>(items: T[]): T[] {
  return [...items].sort((a, b) => b.similarityScore - a.similarityScore);
}