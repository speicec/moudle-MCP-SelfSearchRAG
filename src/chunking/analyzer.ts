/**
 * @spec chunking-layer.md#文档分析器
 * @layer 2
 * @description 文档分析器实现
 */

import type { Document } from '../types/index';
import type {
  IDocumentAnalyzer,
  DocumentAnalysis,
  DocType,
  ChunkStrategy
} from './interface';

export class DocumentAnalyzer implements IDocumentAnalyzer {
  async analyze(document: Document): Promise<DocumentAnalysis> {
    const content = document.content;
    const extension = document.metadata.extension;

    // 1. 类型检测
    const docType = this.detectDocType(extension, content);

    // 2. 语言检测
    const language = this.detectLanguage(content);

    // 3. 结构分析
    const structure = this.analyzeStructure(content, docType);

    // 4. 语义密度计算
    const semanticDensity = this.calculateSemanticDensity(content);

    // 5. 策略推荐
    const recommendedStrategy = this.recommendStrategy(docType, structure, semanticDensity);

    return {
      docType,
      language,
      structure,
      semanticDensity,
      recommendedStrategy
    };
  }

  private detectDocType(extension: string, content: string): DocType {
    const extToType: Record<string, DocType> = {
      'md': 'markdown',
      'markdown': 'markdown',
      'ts': 'code',
      'tsx': 'code',
      'js': 'code',
      'jsx': 'code',
      'py': 'code',
      'go': 'code',
      'java': 'code',
      'json': 'json',
      'html': 'html',
      'htm': 'html',
      'pdf': 'pdf'
    };

    const mapped = extToType[extension.toLowerCase()];
    if (mapped) return mapped;

    // 基于内容检测
    if (content.includes('```') || /^function\s|class\s|import\s/.test(content)) {
      return 'code';
    }
    if (/^#{1,6}\s/.test(content)) {
      return 'markdown';
    }
    if (content.trim().startsWith('{') || content.trim().startsWith('[')) {
      return 'json';
    }
    if (/<html|<!DOCTYPE/i.test(content)) {
      return 'html';
    }

    return 'text';
  }

  private detectLanguage(content: string): string {
    // 简单语言检测
    const langPatterns: [RegExp, string][] = [
      [/function\s+\w+\s*\(/, 'javascript'],
      [/const\s+\w+\s*=/, 'javascript'],
      [/def\s+\w+\s*\(/, 'python'],
      [/package\s+\w+/, 'go'],
      [/class\s+\w+\s*:/, 'typescript'],
      [/interface\s+\w+/, 'typescript'],
    ];

    for (const [pattern, lang] of langPatterns) {
      if (pattern.test(content)) return lang;
    }

    return 'unknown';
  }

  private analyzeStructure(content: string, docType: DocType): DocumentAnalysis['structure'] {
    switch (docType) {
      case 'markdown':
        return {
          hasTitle: /^#\s/.test(content),
          hasSections: /^#{2,3}\s/.test(content),
          sectionCount: (content.match(/^#{2,3}\s/g) || []).length,
          hasList: /^\s*[-*]\s/.test(content),
          hasTable: /\|.*\|/.test(content),
          hasCodeBlock: /```/.test(content),
          paragraphCount: content.split(/\n\n+/).length
        };

      case 'code':
        return {
          hasTitle: false,
          hasSections: /function\s|class\s/.test(content),
          sectionCount: (content.match(/function\s+\w+|class\s+\w+/g) || []).length,
          hasList: false,
          hasTable: false,
          hasCodeBlock: true,
          paragraphCount: 0
        };

      default:
        const paragraphs = content.split(/\n\n+/).filter(p => p.trim().length > 0);
        return {
          hasTitle: false,
          hasSections: false,
          sectionCount: 0,
          hasList: /^\s*[-*]\s/.test(content),
          hasTable: false,
          hasCodeBlock: false,
          paragraphCount: paragraphs.length
        };
    }
  }

  private calculateSemanticDensity(content: string): DocumentAnalysis['semanticDensity'] {
    const sentences = this.splitSentences(content);
    const avgSentenceLength = sentences.length > 0
      ? sentences.reduce((sum, s) => sum + s.length, 0) / sentences.length
      : 0;

    const paragraphs = content.split(/\n\n+/).filter(p => p.trim().length > 0);
    const avgParagraphLength = paragraphs.length > 0
      ? paragraphs.reduce((sum, p) => sum + p.length, 0) / paragraphs.length
      : 0;

    // 技术术语粗略估计（英文单词>5字符）
    const words = content.split(/\s+/).filter(w => w.length > 0);
    const technicalTerms = words.filter(w => /^[A-Z][a-z]+$/.test(w) || w.length > 8).length;
    const technicalTermRatio = words.length > 0 ? technicalTerms / words.length : 0;

    const level = avgSentenceLength > 100 && technicalTermRatio > 0.2
      ? 'high'
      : avgSentenceLength < 50
        ? 'low'
        : 'medium';

    return {
      level,
      avgSentenceLength,
      avgParagraphLength,
      technicalTermRatio
    };
  }

  private recommendStrategy(
    docType: DocType,
    structure: DocumentAnalysis['structure'],
    density: DocumentAnalysis['semanticDensity']
  ): ChunkStrategy {
    // 规则优先级
    if (docType === 'code') return 'ast-based';
    if (docType === 'markdown' && structure.hasSections) return 'markdown-section';
    if (density.level === 'high') return 'semantic-boundary';
    if (structure.paragraphCount > 10) return 'recursive';
    return 'sliding-window';
  }

  private splitSentences(content: string): string[] {
    return content
      .replace(/([.!?])\s+/g, '$1\n')
      .split('\n')
      .filter(s => s.trim().length > 0);
  }
}

export const documentAnalyzer = new DocumentAnalyzer();