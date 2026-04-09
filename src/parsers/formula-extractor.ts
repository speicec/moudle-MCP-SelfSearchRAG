import type { ContentPosition } from './pdf-parser.js';
import type { FormulaBlock } from '../core/types.js';

/**
 * Formula extraction configuration
 */
export interface FormulaExtractionConfig {
  detectInlineFormulas: boolean;
  detectBlockFormulas: boolean;
  convertToLaTeX: boolean;
  minFormulaLength: number;
}

/**
 * Default formula extraction configuration
 */
export const DEFAULT_FORMULA_CONFIG: FormulaExtractionConfig = {
  detectInlineFormulas: true,
  detectBlockFormulas: true,
  convertToLaTeX: true,
  minFormulaLength: 3,
};

/**
 * Formula position type
 */
export type FormulaPositionType = 'inline' | 'block' | 'equation_number';

/**
 * Detected formula
 */
export interface DetectedFormula {
  id: string;
  pageNumber: number;
  position: ContentPosition;
  originalText: string;
  latexRepresentation?: string | undefined;
  positionType: FormulaPositionType;
  equationNumber?: string | undefined;
  confidence: number;
}

/**
 * PDF formula extractor
 * Note: Simplified implementation using text pattern detection
 * Full implementation would use OCR with math recognition or MathML parsing
 */
export class PDFFormulaExtractor {
  private config: FormulaExtractionConfig;

  constructor(config: Partial<FormulaExtractionConfig> = {}) {
    this.config = {
      ...DEFAULT_FORMULA_CONFIG,
      ...config,
    };
  }

  /**
   * Extract formulas from page text
   */
  async extract(pageText: string, pageNumber: number): Promise<FormulaBlock[]> {
    const formulas: FormulaBlock[] = [];
    const detected = this.detectFormulas(pageText);

    for (let i = 0; i < detected.length; i++) {
      const formula = detected[i];
      if (!formula) continue;
      formulas.push({
        type: 'formula',
        content: formula.originalText,
        position: {
          page: pageNumber,
          x: 0,
          y: 0,
          width: 0,
          height: 0,
        },
        latex: formula.latexRepresentation ?? undefined,
        blockIndex: i,
        metadata: {
          positionType: formula.positionType,
          equationNumber: formula.equationNumber ?? undefined,
          confidence: formula.confidence,
        },
      });
    }

    return formulas;
  }

  /**
   * Detect formulas in text using pattern matching
   */
  private detectFormulas(text: string): DetectedFormula[] {
    const formulas: DetectedFormula[] = [];

    // Split into lines for analysis
    const lines = text.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]?.trim();
      if (!line) continue;

      // Skip empty lines
      if (line.length < this.config.minFormulaLength) continue;

      // Check for block formulas (centered, often numbered)
      if (this.config.detectBlockFormulas) {
        const blockFormula = this.detectBlockFormula(line, i);
        if (blockFormula) {
          formulas.push(blockFormula);
          continue;
        }
      }

      // Check for inline formulas
      if (this.config.detectInlineFormulas) {
        const inlineFormulas = this.detectInlineFormulas(line, i);
        formulas.push(...inlineFormulas);
      }
    }

    return formulas;
  }

  /**
   * Detect block formula (standalone equation)
   */
  private detectBlockFormula(line: string, lineIndex: number): DetectedFormula | null {
    // Block formulas often:
    // 1. Are centered or start with whitespace
    // 2. Have mathematical operators
    // 3. May have equation numbers like (1), [Eq. 1]

    // Check for equation number pattern
    const eqNumberMatch = line.match(/\((\d+)\)|\[Eq\.?\s*(\d+)\]/);
    if (eqNumberMatch) {
      const equationNumber = eqNumberMatch[1] ?? eqNumberMatch[2];
      const formulaText = line.replace(/\(.*?\)|\[.*?\]/, '').trim();

      if (this.containsMathOperators(formulaText)) {
        return {
          id: `formula_block_${lineIndex}`,
          pageNumber: 0, // Will be set by caller
          position: { page: 0, x: 0, y: 0, width: 0, height: 0 },
          originalText: formulaText,
          latexRepresentation: this.convertToLatex(formulaText),
          positionType: 'block',
          equationNumber: equationNumber ?? undefined,
          confidence: 0.7,
        };
      }
    }

    // Check for mathematical content starting with whitespace (often centered)
    if (line.startsWith('  ') || line.startsWith('\t')) {
      if (this.containsMathOperators(line)) {
        return {
          id: `formula_block_${lineIndex}`,
          pageNumber: 0,
          position: { page: 0, x: 0, y: 0, width: 0, height: 0 },
          originalText: line.trim(),
          latexRepresentation: this.convertToLatex(line.trim()),
          positionType: 'block',
          confidence: 0.6,
        };
      }
    }

    return null;
  }

  /**
   * Detect inline formulas within text
   */
  private detectInlineFormulas(line: string, lineIndex: number): DetectedFormula[] {
    const formulas: DetectedFormula[] = [];

    // Pattern for inline formulas: often surrounded by special chars or have math symbols
    const mathPatterns = [
      // Patterns like $...$ or \(...\) (LaTeX inline)
      /\$([^$]+)\$/g,
      /\\\(([^)]+)\\\)/g,
      // Mathematical expressions with operators
      /[a-zA-Z]+\s*[=+\-*/]\s*[a-zA-Z0-9.]+/g,
      // Fractions
      /\d+\/\d+/g,
      // Powers/superscripts (simplified detection)
      /[a-zA-Z]\^[0-2]|x\^2|n\^2/g,
    ];

    for (const pattern of mathPatterns) {
      const matches = line.matchAll(pattern);
      for (const match of matches) {
        const formulaText = match[1] ?? match[0];
        if (formulaText.length >= this.config.minFormulaLength) {
          formulas.push({
            id: `formula_inline_${lineIndex}_${formulas.length}`,
            pageNumber: 0,
            position: { page: 0, x: 0, y: 0, width: 0, height: 0 },
            originalText: formulaText,
            latexRepresentation: this.convertToLatex(formulaText),
            positionType: 'inline',
            confidence: 0.5,
          });
        }
      }
    }

    return formulas;
  }

  /**
   * Check if text contains mathematical operators
   */
  private containsMathOperators(text: string): boolean {
    const mathSymbols = [
      '=', '+', '-', '*', '/', '×', '÷',
      '∫', '∑', '∏', '√', '∞', 'π',
      'α', 'β', 'γ', 'δ', 'θ', 'λ', 'μ', 'σ',
      '≤', '≥', '≠', '≈', '∈', '∉',
      '→', '←', '⇒', '⇔',
    ];

    return mathSymbols.some(symbol => text.includes(symbol)) ||
           /[a-zA-Z]\s*[=+\-*/]\s*[a-zA-Z0-9]/.test(text);
  }

  /**
   * Convert detected formula text to LaTeX (simplified)
   */
  private convertToLatex(text: string): string {
    let latex = text;

    // Common conversions
    const conversions: [RegExp, string][] = [
      // Fractions
      [/(\d+)\/(\d+)/g, '\\frac{$1}{$2}'],
      // Powers
      [/([a-zA-Z])\^([0-9])/g, '$1^{$2}'],
      // Square root
      [/√(\d+)/g, '\\sqrt{$1}'],
      [/√([a-zA-Z])/g, '\\sqrt{$1}'],
      // Greek letters
      [/α/g, '\\alpha'],
      [/β/g, '\\beta'],
      [/γ/g, '\\gamma'],
      [/δ/g, '\\delta'],
      [/θ/g, '\\theta'],
      [/λ/g, '\\lambda'],
      [/μ/g, '\\mu'],
      [/σ/g, '\\sigma'],
      [/π/g, '\\pi'],
      // Mathematical operators
      [/×/g, '\\times'],
      [/÷/g, '\\div'],
      [/≤/g, '\\leq'],
      [/≥/g, '\\geq'],
      [/≠/g, '\\neq'],
      [/≈/g, '\\approx'],
      [/∞/g, '\\infty'],
      [/→/g, '\\rightarrow'],
      [/⇒/g, '\\Rightarrow'],
    ];

    for (const [pattern, replacement] of conversions) {
      latex = latex.replace(pattern, replacement);
    }

    return latex;
  }

  /**
   * Get formula statistics
   */
  getFormulaStats(formulas: FormulaBlock[]): FormulaStats {
    const inlineCount = formulas.filter(
      f => f.metadata.positionType === 'inline'
    ).length;
    const blockCount = formulas.filter(
      f => f.metadata.positionType === 'block'
    ).length;

    const avgConfidence = formulas.length > 0
      ? formulas.reduce((sum, f) => sum + (f.metadata.confidence ?? 0), 0) / formulas.length
      : 0;

    return {
      totalFormulas: formulas.length,
      inlineFormulas: inlineCount,
      blockFormulas: blockCount,
      averageConfidence: avgConfidence,
      formulasWithLaTeX: formulas.filter(f => f.latex).length,
    };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<FormulaExtractionConfig>): void {
    this.config = {
      ...this.config,
      ...config,
    };
  }
}

/**
 * Formula statistics
 */
export interface FormulaStats {
  totalFormulas: number;
  inlineFormulas: number;
  blockFormulas: number;
  averageConfidence: number;
  formulasWithLaTeX: number;
}

/**
 * Create formula extractor
 */
export function createFormulaExtractor(
  config?: Partial<FormulaExtractionConfig>
): PDFFormulaExtractor {
  return new PDFFormulaExtractor(config);
}