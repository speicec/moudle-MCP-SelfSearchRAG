import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Quote,
  Table2,
  List,
  ListOrdered,
  ChevronRight,
} from 'lucide-react';

/**
 * ClinicalMarkdown - Medical-grade Markdown renderer
 *
 * Design: Clinical Note aesthetic
 * - Highlights medical entities (drugs, dosages, warnings)
 * - Clean typography for professional reading
 * - Structured tables for comparison data
 * - Safety warnings with visual emphasis
 */

interface ClinicalMarkdownProps {
  content: string;
  className?: string;
  streaming?: boolean;
}

// Medical entity patterns for highlighting
const MEDICAL_PATTERNS = {
  drug: /\b([二甲双胍|利拉鲁肽|胰岛素|格列美脲|格列齐特|阿卡波糖|吡格列酮|罗格列酮|西格列汀|沙格列汀|利格列汀|达格列净|恩格列净|氯磺丙脲|瑞格列奈|那格列奈][片|胶囊|注射剂]?|[A-Z][a-z]+(?:mide|ide|ine|ol|one|stat|pril|sartan|olol|pine|zole|vir|cef|oxacin)[^\s]*)\b/g,
  dosage: /\b(\d+(\.\d+)?\s*(mg|g|ml|IU|单位|μU|mmol|mol|mg\/d|mg\/kg|μg|mcg)[\/\d]*)\b/g,
  indicator: /\b(eGFR|GFR|HbA1c|血糖|空腹血糖|餐后血糖|肌酐|尿素氮|ALT|AST|胆固醇|甘油三酯|LDL|HDL|BMI|血压|心率)[=:：]\s*(\d+(\.\d+)?|\d+\s*[-~]\s*\d+)\b/g,
  warning: /(禁忌|慎用|不良反应|副作用|注意事项|警告|相互作用|严重|导致|可能引起)/g,
  critical: /(严重不良反应|肾功能不全|肝功能损害|低血糖|乳酸酸中毒|酮症酸中毒)/g,
};

// Markdown patterns
const MD_PATTERNS = {
  heading1: /^#\s+(.+)$/gm,
  heading2: /^##\s+(.+)$/gm,
  heading3: /^###\s+(.+)$/gm,
  bold: /\*\*(.+?)\*\*/g,
  italic: /\*(.+?)\*/g,
  codeBlock: /```(\w*)\n([\s\S]*?)```/g,
  inlineCode: /`([^`]+)`/g,
  unorderedList: /^[\s]*[-*+]\s+(.+)$/gm,
  orderedList: /^[\s]*(\d+)\.\s+(.+)$/gm,
  blockquote: /^>\s+(.+)$/gm,
  table: /^\|(.+)\|\n\|[-:|]+\|\n((?:\|.+\|\n?)+)/gm,
  tableRow: /^\|(.+)\|$/gm,
  paragraph: /(.+)/g,
  link: /\[([^\]]+)\]\(([^)]+)\)/g,
};

/**
 * Parse markdown content into structured blocks
 */
function parseMarkdown(content: string): MarkdownBlock[] {
  const blocks: MarkdownBlock[] = [];
  let remaining = content;

  // Process code blocks first (they span multiple lines)
  remaining = remaining.replace(MD_PATTERNS.codeBlock, (match, lang, code) => {
    blocks.push({ type: 'code', lang, content: code.trim() });
    return '';
  });

  // Process tables
  remaining = remaining.replace(MD_PATTERNS.table, (match, headerRow, bodyRows) => {
    const headers = headerRow.split('|').map(h => h.trim()).filter(Boolean);
    const rows = bodyRows.split('\n').map(row =>
      row.split('|').map(c => c.trim()).filter(Boolean)
    ).filter(row => row.length > 0);
    blocks.push({ type: 'table', headers, rows });
    return '';
  });

  // Process line by line for other elements
  const lines = remaining.split('\n');
  let currentParagraph: string[] = [];
  let listItems: Array<{ ordered: boolean; number?: number; text: string }> = [];
  let inList = false;

  for (const line of lines) {
    const trimmed = line.trim();

    // Heading
    if (trimmed.startsWith('#')) {
      if (currentParagraph.length > 0) {
        blocks.push({ type: 'paragraph', content: currentParagraph.join('\n') });
        currentParagraph = [];
      }
      if (inList) {
        blocks.push({ type: 'list', items: listItems, ordered: listItems[0]?.ordered });
        listItems = [];
        inList = false;
      }

      if (trimmed.startsWith('###')) {
        blocks.push({ type: 'heading', level: 3, content: trimmed.slice(3).trim() });
      } else if (trimmed.startsWith('##')) {
        blocks.push({ type: 'heading', level: 2, content: trimmed.slice(2).trim() });
      } else {
        blocks.push({ type: 'heading', level: 1, content: trimmed.slice(1).trim() });
      }
      continue;
    }

    // Blockquote
    if (trimmed.startsWith('>')) {
      if (currentParagraph.length > 0) {
        blocks.push({ type: 'paragraph', content: currentParagraph.join('\n') });
        currentParagraph = [];
      }
      if (inList) {
        blocks.push({ type: 'list', items: listItems, ordered: listItems[0]?.ordered });
        listItems = [];
        inList = false;
      }
      blocks.push({ type: 'blockquote', content: trimmed.slice(1).trim() });
      continue;
    }

    // Unordered list
    if (/^[-*+]\s/.test(trimmed)) {
      if (currentParagraph.length > 0) {
        blocks.push({ type: 'paragraph', content: currentParagraph.join('\n') });
        currentParagraph = [];
      }
      inList = true;
      listItems.push({ ordered: false, text: trimmed.replace(/^[-*+]\s/, '') });
      continue;
    }

    // Ordered list
    if (/^\d+\.\s/.test(trimmed)) {
      if (currentParagraph.length > 0) {
        blocks.push({ type: 'paragraph', content: currentParagraph.join('\n') });
        currentParagraph = [];
      }
      inList = true;
      const num = parseInt(trimmed.match(/^\d+/)?.[0] || '1');
      listItems.push({ ordered: true, number: num, text: trimmed.replace(/^\d+\.\s/, '') });
      continue;
    }

    // Empty line - end paragraph or list
    if (trimmed === '') {
      if (inList && listItems.length > 0) {
        blocks.push({ type: 'list', items: listItems, ordered: listItems[0]?.ordered });
        listItems = [];
        inList = false;
      }
      if (currentParagraph.length > 0) {
        blocks.push({ type: 'paragraph', content: currentParagraph.join('\n') });
        currentParagraph = [];
      }
      continue;
    }

    // Regular text - accumulate for paragraph
    if (!inList) {
      currentParagraph.push(trimmed);
    } else {
      // Continue list item on same line (for multi-line items)
      listItems[listItems.length - 1].text += ' ' + trimmed;
    }
  }

  // Flush remaining content
  if (inList && listItems.length > 0) {
    blocks.push({ type: 'list', items: listItems, ordered: listItems[0]?.ordered });
  }
  if (currentParagraph.length > 0) {
    blocks.push({ type: 'paragraph', content: currentParagraph.join('\n') });
  }

  return blocks;
}

interface MarkdownBlock {
  type: 'heading' | 'paragraph' | 'code' | 'blockquote' | 'list' | 'table';
  level?: number;
  content?: string;
  lang?: string;
  items?: Array<{ ordered: boolean; number?: number; text: string }>;
  ordered?: boolean;
  headers?: string[];
  rows?: string[][];
}

/**
 * Highlight medical entities in text
 * Simplified version - highlights drugs and dosages inline
 */
function highlightMedicalEntities(text: string): React.ReactNode {
  // Process inline markdown first
  let result = processInlineMarkdown(text);

  // Wrap drug names
  if (typeof result === 'string') {
    result = wrapDrugs(result);
  }

  return result;
}

function wrapDrugs(text: string): React.ReactNode {
  const parts = text.split(MEDICAL_PATTERNS.drug);
  if (parts.length === 1) {
    return wrapDosages(text);
  }

  return parts.map((part, i) => {
    if (i % 2 === 1) {
      return (
        <span key={`drug-${i}`} className="clinical-md-drug">
          {part}
        </span>
      );
    }
    return wrapDosages(part);
  });
}

function wrapDosages(text: string): React.ReactNode {
  const parts = text.split(MEDICAL_PATTERNS.dosage);
  if (parts.length === 1) {
    return wrapWarnings(text);
  }

  return parts.map((part, i) => {
    if (i % 2 === 1) {
      return (
        <span key={`dosage-${i}`} className="clinical-md-dosage">
          {part}
        </span>
      );
    }
    return wrapWarnings(part);
  });
}

function wrapWarnings(text: string): React.ReactNode {
  const parts = text.split(MEDICAL_PATTERNS.warning);
  if (parts.length === 1) {
    return text;
  }

  return parts.map((part, i) => {
    if (i % 2 === 1) {
      return (
        <span key={`warning-${i}`} className="clinical-md-warning">
          {part}
        </span>
      );
    }
    return part;
  });
}

/**
 * Process inline markdown (bold, italic, inline code)
 */
function processInlineMarkdown(text: string): React.ReactNode {
  let result: React.ReactNode = text;

  // Bold
  if (MD_PATTERNS.bold.test(text)) {
    result = text.split(/\*\*(.+?)\*\*/).map((part, i) =>
      i % 2 === 1
        ? <strong key={i} className="clinical-md-bold">{part}</strong>
        : part
    );
  }

  // Italic (within result)
  if (typeof result === 'string' && MD_PATTERNS.italic.test(result)) {
    result = result.split(/\*(.+?)\*/).map((part, i) =>
      i % 2 === 1
        ? <em key={i} className="clinical-md-italic">{part}</em>
        : part
    );
  } else if (Array.isArray(result)) {
    result = result.map((part, i) => {
      if (typeof part === 'string' && MD_PATTERNS.italic.test(part)) {
        return part.split(/\*(.+?)\*/).map((subPart, j) =>
          j % 2 === 1
            ? <em key={`${i}-${j}`} className="clinical-md-italic">{subPart}</em>
            : subPart
        );
      }
      return part;
    });
  }

  // Inline code
  if (typeof result === 'string' && /`[^`]+`/.test(result)) {
    result = result.split(/`([^`]+)`/).map((part, i) =>
      i % 2 === 1
        ? <code key={i} className="clinical-md-inline-code">{part}</code>
        : part
    );
  } else if (Array.isArray(result)) {
    result = result.map((part, i) => {
      if (typeof part === 'string' && /`[^`]+`/.test(part)) {
        return part.split(/`([^`]+)`/).map((subPart, j) =>
          j % 2 === 1
            ? <code key={`${i}-${j}`} className="clinical-md-inline-code">{subPart}</code>
            : subPart
        );
      }
      return part;
    });
  }

  return result;
}

/**
 * Render a single markdown block
 */
function renderBlock(block: MarkdownBlock, index: number): React.ReactNode {
  switch (block.type) {
    case 'heading':
      const headingClass = `clinical-md-heading clinical-md-heading-${block.level}`;
      return (
        <div key={index} className={headingClass}>
          {highlightMedicalEntities(block.content || '')}
        </div>
      );

    case 'paragraph':
      return (
        <p key={index} className="clinical-md-paragraph">
          {highlightMedicalEntities(block.content || '')}
        </p>
      );

    case 'blockquote':
      return (
        <blockquote key={index} className="clinical-md-blockquote">
          <Quote className="w-4 h-4 clinical-md-blockquote-icon" />
          <div className="clinical-md-blockquote-content">
            {processInlineMarkdown(block.content || '')}
          </div>
        </blockquote>
      );

    case 'code':
      return (
        <div key={index} className="clinical-md-code-block">
          <div className="clinical-md-code-header">
            <span className="clinical-md-code-lang">{block.lang || 'text'}</span>
          </div>
          <pre className="clinical-md-code-content">
            <code>{block.content}</code>
          </pre>
        </div>
      );

    case 'list':
      const ListIcon = block.ordered ? ListOrdered : List;
      return (
        <div key={index} className="clinical-md-list">
          <ListIcon className="w-4 h-4 clinical-md-list-icon opacity-40" />
          {block.ordered ? (
            <ol className="clinical-md-list-ordered">
              {block.items?.map((item, i) => (
                <li key={i} className="clinical-md-list-item">
                  <span className="clinical-md-list-number">{item.number}</span>
                  {highlightMedicalEntities(item.text)}
                </li>
              ))}
            </ol>
          ) : (
            <ul className="clinical-md-list-unordered">
              {block.items?.map((item, i) => (
                <li key={i} className="clinical-md-list-item">
                  <ChevronRight className="w-3 h-3 clinical-md-list-bullet" />
                  {highlightMedicalEntities(item.text)}
                </li>
              ))}
            </ul>
          )}
        </div>
      );

    case 'table':
      return (
        <div key={index} className="clinical-md-table-wrapper">
          <div className="clinical-md-table-header">
            <Table2 className="w-4 h-4 opacity-60" />
            <span>数据对比</span>
          </div>
          <table className="clinical-md-table">
            <thead>
              <tr>
                {block.headers?.map((h, i) => (
                  <th key={i} className="clinical-md-table-th">
                    {highlightMedicalEntities(h)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows?.map((row, i) => (
                <tr key={i} className="clinical-md-table-row">
                  {row.map((cell, j) => (
                    <td key={j} className="clinical-md-table-td">
                      {highlightMedicalEntities(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );

    default:
      return null;
  }
}

/**
 * ClinicalMarkdown Component
 */
const ClinicalMarkdown: React.FC<ClinicalMarkdownProps> = ({
  content,
  className = '',
  streaming = false,
}) => {
  const blocks = useMemo(() => parseMarkdown(content), [content]);

  return (
    <div className={`clinical-md-container ${className}`}>
      <motion.div
        className="clinical-md-content"
        initial={streaming ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        {blocks.map((block, index) => renderBlock(block, index))}

        {/* Streaming cursor */}
        {streaming && (
          <motion.span
            className="clinical-md-streaming-cursor"
            animate={{ opacity: [0.3, 1, 0.3] }}
            transition={{ duration: 0.8, repeat: Infinity, ease: 'easeInOut' }}
          />
        )}
      </motion.div>
    </div>
  );
};

export default ClinicalMarkdown;