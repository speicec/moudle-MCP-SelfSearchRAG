# Document Metadata Extraction

## Overview

This document describes the document metadata extraction system that extracts and propagates metadata from PDF documents to chunk-level retrieval results.

## Problem Statement

Previously, PDF parsing discarded metadata returned by `pdf-parse` (Title, Author, CreationDate, etc.), resulting in:

1. **Incomplete evidence citations**: SourceCitation displayed filename (e.g., "ADA_2024.pdf") instead of human-readable title (e.g., "ADA Standards of Care 2024")
2. **Missing year information**: Evidence evaluation lacked publication year for timeliness calculation
3. **No guideline source identification**: Manual keyword matching required during retrieval

## Solution Architecture

### Data Flow

```
PDF → pdf-parse → text-extractor (extract data.info)
    → parse-stage (fill ParsedMetadata + infer year + identify guideline)
    → document-processor (propagate to ChunkMetadata)
    → retrieval (HierarchicalRetrievalResult carries metadata)
    → chat.ts (build SourceCitation with human-readable title)
```

### Key Components

| Component | File | Responsibility |
|-----------|------|----------------|
| PdfMetadataInfo | `src/parsers/text-extractor.ts` | PDF metadata structure |
| ParsedMetadata | `src/core/types.ts` | Document-level metadata |
| ChunkMetadata | `src/core/types.ts` | Chunk-level metadata (propagated) |
| extractPdfMetadata() | `src/parsers/text-extractor.ts` | Extract from pdf-parse data.info |
| inferYear() | `src/parsers/parse-stage.ts` | Year inference from title/filename/date |
| identifyGuidelineSource() | `src/parsers/parse-stage.ts` | Medical guideline source identification |
| buildParsedMetadata() | `src/parsers/parse-stage.ts` | Aggregate all metadata |

## API Reference

### PdfMetadataInfo

```typescript
interface PdfMetadataInfo {
  title?: string;        // Document title from PDF info
  author?: string;       // Document author
  subject?: string;      // Document subject/topic
  creator?: string;      // Application that created PDF
  producer?: string;     // PDF conversion tool
  creationDate?: Date;   // Creation date parsed from PDF format
  modificationDate?: Date; // Last modification date
}
```

### ParsedMetadata

```typescript
interface ParsedMetadata {
  title?: string;            // Human-readable title (fallback to filename)
  author?: string;           // Document author
  subject?: string;          // Document subject
  creator?: string;          // PDF creator application
  producer?: string;         // PDF producer
  creationDate?: Date;       // Creation date
  modificationDate?: Date;   // Modification date
  pageCount: number;         // Total pages
  year?: number;             // Inferred publication year
  guidelineSource?: string;  // Identified medical guideline source
}
```

### ChunkMetadata (Enhanced)

```typescript
interface ChunkMetadata {
  contentType: ChunkContentType;  // Required
  pageNumber?: number;            // Page location
  section?: string;               // Section heading
  boundaryConfidence?: number;    // Boundary confidence
  // Document-level metadata (propagated from ParsedMetadata)
  documentTitle?: string;   // Human-readable document title
  documentAuthor?: string;  // Document author
  documentYear?: number;    // Publication year
  guidelineSource?: string; // Medical guideline source (ADA, KDIGO, etc.)
}
```

### SourceCitation (Used in Agent)

```typescript
interface SourceCitation {
  documentId: string;     // Internal document ID
  documentName: string;   // Human-readable title (from documentTitle)
  chunkId: string;        // Chunk ID
  pageNumber?: number;    // Page location
  year?: number;          // Publication year
}
```

## Year Inference Logic

### Priority Order

The `inferYear()` function extracts publication year from multiple sources:

1. **Title** (highest priority): Extract from title string using regex `\b(20\d{2}|19\d{2})\b`
2. **Filename**: Extract from filename pattern `_YYYY` or `YYYY`
3. **CreationDate**: Use year from PDF creation date

### Examples

| Input | Year Extracted | Source |
|-------|----------------|--------|
| "Standards of Care 2024" | 2024 | Title |
| "ADA_2024.pdf" | 2024 | Filename |
| "guidelines.pdf" + CreationDate=2023-01-01 | 2023 | CreationDate |
| "General Document" | undefined | No year found |

### Code Location

```typescript
// src/parsers/parse-stage.ts:512-544
export function inferYear(
  title?: string,
  filename?: string,
  creationDate?: Date
): number | undefined {
  // 1. Extract from title (most reliable for medical guidelines)
  if (title) {
    const titleYearMatch = title.match(/\b(20\d{2}|19\d{2})\b/);
    if (titleYearMatch && titleYearMatch[1]) {
      return parseInt(titleYearMatch[1], 10);
    }
  }

  // 2. Extract from filename (e.g., "ADA_2024.pdf")
  if (filename) {
    const nameWithoutExt = filename.replace(/\.[^.]+$/, '');
    const fileYearMatch = nameWithoutExt.match(/_(20\d{2}|19\d{2})|(20\d{2}|19\d{2})/);
    if (fileYearMatch) {
      const yearStr = fileYearMatch[1] ?? fileYearMatch[2];
      if (yearStr) return parseInt(yearStr, 10);
    }
  }

  // 3. Use CreationDate year as fallback
  if (creationDate) {
    return creationDate.getFullYear();
  }

  return undefined;
}
```

## Guideline Source Identification

### Supported Sources

| Source | Keywords | Authority Level |
|--------|----------|-----------------|
| ADA | ADA, American Diabetes Association, Standards of Care | international (1.0) |
| KDIGO | KDIGO, Kidney Disease: Improving Global Outcomes | international (1.0) |
| ESC | ESC, European Society of Cardiology | international (1.0) |
| ATA | ATA, American Thyroid Association | international (1.0) |
| EASD | EASD, European Association for the Study of Diabetes | international (1.0) |
| CDS | CDS, 中国糖尿病学会, 中华医学会糖尿病 | national (0.8) |

### Pattern Definition

```typescript
// src/parsers/parse-stage.ts:17-24
const GUIDELINE_PATTERNS: Record<string, RegExp> = {
  'ADA': /ADA|American Diabetes Association|Standards of Care/i,
  'KDIGO': /KDIGO|Kidney Disease: Improving Global Outcomes/i,
  'ESC': /ESC|European Society of Cardiology/i,
  'CDS': /CDS|中国糖尿病学会|中华医学会糖尿病/i,
  'ATA': /ATA|American Thyroid Association/i,
  'EASD': /EASD|European Association for the Study of Diabetes/i,
};
```

### Authority Mapping

The authority level affects evidence quality scoring:

```typescript
// src/medical/evidence-evaluator.ts:289-305
export const GUIDELINE_AUTHORITY_MAPPING: Record<SourceAuthorityLevel, {
  keywords: string[];
  weight: number;
}> = {
  international: {
    keywords: ['ADA', 'KDIGO', 'ESC', 'ATA', 'EASD', ...],
    weight: 1.0,
  },
  national: {
    keywords: ['CDS', 'CSH', 'CETA', '中国', '中华', ...],
    weight: 0.8,
  },
  local: {
    keywords: [],
    weight: 0.6,
  },
};
```

## Evidence Evaluation Enhancement

### Enhanced Composite Score

```typescript
compositeScore =
  GRADE_WEIGHT * gradeScore +          // 40%
  AUTHORITY_WEIGHT * authorityWeight + // 20%
  TIME_WEIGHT * timeWeight +           // 20%
  CONSISTENCY_WEIGHT * consistencyScore + // 10%
  APPLICABILITY_WEIGHT * applicabilityScore; // 10%
```

### Time Weight Calculation

```typescript
// Linear decay: 1.0 → 0.95 → 0.90 → ... (min 0.5)
export function calculateTimeWeight(year: number | undefined): number {
  if (year === undefined) return 0.7;  // Unknown year
  const currentYear = new Date().getFullYear();
  const yearsSincePublication = currentYear - year;
  const weight = 1.0 - yearsSincePublication * 0.05;
  return Math.max(weight, 0.5);
}
```

## Backward Compatibility

### Legacy Chunk Support

Chunks without document-level metadata continue to work:

```typescript
// In chat.ts agentRetrieval
const sourceCitation = {
  documentId: r.sourceDocumentId,
  // Fallback: use sourceDocumentId if documentTitle not available
  documentName: r.metadata?.documentTitle ?? r.sourceDocumentId,
  chunkId: r.smallChunkId,
  ...(r.metadata?.pageNumber ? { pageNumber: r.metadata.pageNumber } : {}),
  ...(r.metadata?.documentYear ? { year: r.metadata.documentYear } : {}),
};
```

### Migration Path

- No database migration required
- All new fields are optional (`?:`)
- Existing chunks work without changes
- Future documents automatically get metadata

## Testing

### Unit Tests

See `src/__tests__/metadata-extraction.test.ts` for:

- PDF date parsing (`parsePdfDate`)
- Metadata extraction (`extractPdfMetadata`)
- Year inference (`inferYear`)
- Guideline identification (`identifyGuidelineSource`)
- Metadata building (`buildParsedMetadata`)

### Integration Tests

See `src/__tests__/metadata-flow-integration.test.ts` for:

- Metadata propagation from ParsedContent to Chunk
- Backward compatibility with legacy chunks
- SourceCitation display formatting
- PDF metadata scenarios (fixtures)

## Configuration

### PDF Metadata Extraction (text-extractor.ts)

```typescript
// Threshold for empty page detection
DEFAULT_EMPTY_PAGE_THRESHOLD = 100;  // Characters per page
```

### Year Inference (parse-stage.ts)

```typescript
// Regex patterns
const TITLE_YEAR_PATTERN = /\b(20\d{2}|19\d{2})\b/;
const FILENAME_YEAR_PATTERN = /_(20\d{2}|19\d{2})|(20\d{2}|19\d{2})/;
```

### Evidence Evaluation (evidence-evaluator.ts)

```typescript
const ENHANCED_EVALUATION_WEIGHTS = {
  GRADE: 0.4,
  AUTHORITY: 0.2,
  TIME: 0.2,
  CONSISTENCY: 0.1,
  APPLICABILITY: 0.1,
};
```

## Troubleshooting

### PDF Metadata Not Extracted

**Symptom**: `documentTitle` shows filename instead of human-readable title

**Causes**:
1. PDF has no metadata (`info` object empty)
2. PDF title is generic ("Microsoft Word Document")
3. PDF parsing failed

**Solution**: Check PDF metadata using `pdfinfo` tool:
```bash
pdfinfo ADA_Standards_2024.pdf
```

### Year Not Inferred

**Symptom**: `documentYear` is undefined

**Causes**:
1. Title contains no year pattern
2. Filename contains no year pattern
3. CreationDate is missing or invalid

**Solution**: Ensure filename includes year pattern:
```
ADA_2024.pdf → extracts 2024
guidelines_2023_final.pdf → extracts 2023
```

### Guideline Source Not Identified

**Symptom**: `guidelineSource` is undefined for known guideline

**Causes**:
1. Title/author doesn't match known patterns
2. New guideline source not in `GUIDELINE_PATTERNS`

**Solution**: Add pattern to `GUIDELINE_PATTERNS`:
```typescript
// Add new guideline source
GUIDELINE_PATTERNS['NEW_SOURCE'] = /NEW_SOURCE|New Source Name/i;
```

---

**Version**: 2026-04-24
**Change**: enhance-document-metadata-extraction