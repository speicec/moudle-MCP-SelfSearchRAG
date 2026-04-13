/**
 * Structure Boundary Detector
 *
 * Detects structural boundaries in document content such as:
 * - Chapter/section headings (第一章, Chapter 1, etc.)
 * - List item starts (1., 一、, A., etc.)
 * - Heading patterns
 *
 * These boundaries are used during parent chunk grouping to prevent
 * merging content across semantic structure boundaries.
 */

import type { StructureBoundary, StructureBoundaryType } from './types.js';
import type { StructureBoundaryConfig } from './config.js';
import { DEFAULT_STRUCTURE_BOUNDARY_CONFIG } from './config.js';

/**
 * Boundary pattern definition
 */
interface BoundaryPattern {
  pattern: RegExp;
  type: StructureBoundaryType;
  confidence: number;
  description: string;
}

/**
 * Default boundary patterns for Chinese and English documents
 */
const DEFAULT_BOUNDARY_PATTERNS: BoundaryPattern[] = [
  // Chinese chapter headings (第一章, 第二章, etc.)
  {
    pattern: /^第[一二三四五六七八九十百]+[章节篇部]/mu,
    type: 'chapter',
    confidence: 0.95,
    description: 'Chinese chapter heading (e.g., 第一章)',
  },
  // Chinese section headings (第1节, 第2节, etc.)
  {
    pattern: /^第\d+[节条款]/mu,
    type: 'section',
    confidence: 0.9,
    description: 'Chinese section heading (e.g., 第1节)',
  },
  // Chinese numbered lists (一、二、三、etc.)
  {
    pattern: /^[一二三四五六七八九十]+[、.．]\s*\S/mu,
    type: 'list-start',
    confidence: 0.8,
    description: 'Chinese numbered list (e.g., 一、)',
  },
  // Arabic numbered lists at line start (1. 2. 3. etc.)
  {
    pattern: /^\d+[.．。]\s*\S/mu,
    type: 'list-start',
    confidence: 0.75,
    description: 'Arabic numbered list (e.g., 1.)',
  },
  // Lettered lists (A. B. C. etc.)
  {
    pattern: /^[A-Za-z][.．]\s*\S/mu,
    type: 'list-start',
    confidence: 0.7,
    description: 'Lettered list (e.g., A.)',
  },
  // Parenthesis numbered ((1), (2), etc.)
  {
    pattern: /^[（\(]\d+[）\)]\s*\S/mu,
    type: 'list-start',
    confidence: 0.7,
    description: 'Parenthesis numbered list (e.g., (1))',
  },
  // Markdown headings (# ## ###)
  {
    pattern: /^#{1,3}\s+\S/mu,
    type: 'heading',
    confidence: 0.85,
    description: 'Markdown heading (e.g., # Title)',
  },
  // English chapter/section patterns
  {
    pattern: /^(Chapter|Section|Part)\s+\d+/imu,
    type: 'chapter',
    confidence: 0.9,
    description: 'English chapter/section heading',
  },
];

/**
 * StructureBoundaryDetector - detects structural boundaries in text
 */
export class StructureBoundaryDetector {
  private config: StructureBoundaryConfig;
  private patterns: BoundaryPattern[];

  constructor(config?: Partial<StructureBoundaryConfig>) {
    this.config = { ...DEFAULT_STRUCTURE_BOUNDARY_CONFIG, ...config };
    this.patterns = [...DEFAULT_BOUNDARY_PATTERNS];

    // Add custom patterns if provided
    if (this.config.customPatterns) {
      this.config.customPatterns.forEach((pattern, index) => {
        this.patterns.push({
          pattern,
          type: 'heading',
          confidence: 0.7,
          description: `Custom pattern ${index + 1}`,
        });
      });
    }
  }

  /**
   * Detect all structure boundaries in content
   */
  detect(content: string): StructureBoundary[] {
    if (!this.config.enabled) {
      return [];
    }

    const boundaries: StructureBoundary[] = [];
    const lines = content.split('\n');
    let charPosition = 0;

    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
      const line = lines[lineIndex];
      if (!line) {
        charPosition += 1; // newline character
        continue;
      }

      const trimmedLine = line.trim();

      // Skip empty or very short lines
      if (trimmedLine.length < 2) {
        charPosition += line.length + 1;
        continue;
      }

      // Check each pattern against the line
      for (const patternDef of this.patterns) {
        // Reset lastIndex for global patterns
        patternDef.pattern.lastIndex = 0;

        if (patternDef.pattern.test(trimmedLine)) {
          // Find the actual position in the original content
          const lineStartInContent = charPosition;

          const boundary: StructureBoundary = {
            position: lineStartInContent,
            type: patternDef.type,
            confidence: patternDef.confidence,
            matchedText: trimmedLine.substring(0, 50),
          };

          // Only add if confidence meets threshold
          if (boundary.confidence >= this.config.minConfidence) {
            boundaries.push(boundary);
          }

          break; // Only match first pattern per line
        }
      }

      charPosition += line.length + 1; // +1 for newline
    }

    // Remove duplicate boundaries (same position)
    return this.deduplicateBoundaries(boundaries);
  }

  /**
   * Check if a position is at or near a structure boundary
   */
  isAtBoundary(position: number, boundaries: StructureBoundary[], tolerance: number = 0): boolean {
    return boundaries.some(
      b => Math.abs(b.position - position) <= tolerance
    );
  }

  /**
   * Find the next boundary after a given position
   */
  findNextBoundary(position: number, boundaries: StructureBoundary[]): StructureBoundary | null {
    const sortedBoundaries = [...boundaries].sort((a, b) => a.position - b.position);
    return sortedBoundaries.find(b => b.position > position) ?? null;
  }

  /**
   * Find the previous boundary before a given position
   */
  findPreviousBoundary(position: number, boundaries: StructureBoundary[]): StructureBoundary | null {
    const sortedBoundaries = [...boundaries].sort((a, b) => b.position - a.position);
    return sortedBoundaries.find(b => b.position < position) ?? null;
  }

  /**
   * Check if a boundary is high confidence
   */
  isHighConfidenceBoundary(boundary: StructureBoundary): boolean {
    return boundary.confidence >= 0.8;
  }

  /**
   * Get boundaries by type
   */
  getBoundariesByType(boundaries: StructureBoundary[], type: StructureBoundaryType): StructureBoundary[] {
    return boundaries.filter(b => b.type === type);
  }

  /**
   * Get only high confidence boundaries
   */
  getHighConfidenceBoundaries(boundaries: StructureBoundary[]): StructureBoundary[] {
    return boundaries.filter(b => this.isHighConfidenceBoundary(b));
  }

  /**
   * Remove duplicate boundaries at same position
   */
  private deduplicateBoundaries(boundaries: StructureBoundary[]): StructureBoundary[] {
    const seen = new Map<number, StructureBoundary>();

    for (const boundary of boundaries) {
      const existing = seen.get(boundary.position);
      if (!existing || boundary.confidence > existing.confidence) {
        seen.set(boundary.position, boundary);
      }
    }

    return Array.from(seen.values()).sort((a, b) => a.position - b.position);
  }

  /**
   * Get configuration
   */
  getConfig(): StructureBoundaryConfig {
    return { ...this.config };
  }

  /**
   * Set configuration
   */
  setConfig(config: Partial<StructureBoundaryConfig>): void {
    this.config = { ...this.config, ...config };
  }
}

/**
 * Create structure boundary detector
 */
export function createStructureBoundaryDetector(
  config?: Partial<StructureBoundaryConfig>
): StructureBoundaryDetector {
  return new StructureBoundaryDetector(config);
}