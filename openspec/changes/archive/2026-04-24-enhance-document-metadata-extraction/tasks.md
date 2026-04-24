## 1. Type Definitions Extension

- [x] 1.1 Extend `ParsedMetadata` in `src/core/types.ts` to add `year?: number` field
- [x] 1.2 Extend `ChunkMetadata` in `src/chunking/types.ts` to add `documentTitle?: string`, `documentAuthor?: string`, `documentYear?: number`, `guidelineSource?: string` fields
- [x] 1.3 Add `PdfMetadataInfo` interface in `src/parsers/types.ts` for extracted PDF info structure

## 2. PDF Metadata Extraction

- [x] 2.1 Modify `src/parsers/text-extractor.ts` to return `pdfMetadata` from pdf-parse's `data.info`
- [x] 2.2 Implement `extractPdfMetadata()` function to parse Title, Author, Subject, CreationDate from info object
- [x] 2.3 Implement `parsePdfDate()` utility function to convert PDF date format (e.g., "D:20240101") to Date object
- [x] 2.4 Update `extract()` method signature to return `{ pageResults, pdfMetadata }`

## 3. Year Inference Logic

- [x] 3.1 Implement `inferYear(title, filename, creationDate)` function with priority: Title → Filename → CreationDate
- [x] 3.2 Create year extraction regex patterns for title (e.g., `\b(20\d{2}|19\d{2})\b`)
- [x] 3.3 Create year extraction regex patterns for filename (e.g., `_(20\d{2}|19\d{2})`)
- [x] 3.4 Add unit tests for year inference edge cases (no year, multiple years, invalid dates)

## 4. Medical Source Identification

- [x] 4.1 Create `GUIDELINE_PATTERNS` constant with regex patterns for ADA, KDIGO, ESC, CDS, ATA, EASD
- [x] 4.2 Implement `identifyGuidelineSource(title)` function
- [x] 4.3 Add `authorityLevel` mapping for international (1.0), national (0.8), local (0.6)
- [x] 4.4 Add unit tests for guideline source identification

## 5. Parse Stage Enhancement

- [x] 5.1 Modify `src/parsers/parse-stage.ts` to call enhanced text-extractor and receive metadata
- [x] 5.2 Fill `ParsedContent.metadata` with extracted title, author, subject, year, pageCount
- [x] 5.3 Apply year inference logic to `metadata.year`
- [x] 5.4 Apply guideline source identification and store in `metadata.guidelineSource`
- [x] 5.5 Implement fallback: if title missing, use filename (without extension)

## 6. Document Processor Enhancement

- [x] 6.1 Modify `src/server/document-processor.ts` `storeInHierarchical()` to propagate metadata to chunks
- [x] 6.2 Copy `parsedContent.metadata.title` to `chunk.metadata.documentTitle`
- [x] 6.3 Copy `parsedContent.metadata.author` to `chunk.metadata.documentAuthor`
- [x] 6.4 Copy `parsedContent.metadata.year` to `chunk.metadata.documentYear`
- [x] 6.5 Copy `parsedContent.metadata.guidelineSource` to `chunk.metadata.guidelineSource`

## 7. Retrieval Result Enhancement

- [x] 7.1 Modify `SmallToBigRetriever` to include metadata in retrieval results
- [x] 7.2 Ensure `HierarchicalRetrievalResult` carries chunk metadata through pipeline
- [x] 7.3 Update `ConfidenceRetrievalResult` type to include document metadata fields

## 8. Chat Route Enhancement

- [x] 8.1 Modify `agentRetrieval` in `src/server/routes/chat.ts` to construct enhanced `SourceCitation`
- [x] 8.2 Use `r.metadata.documentTitle ?? r.sourceDocumentId` for `SourceCitation.documentName`
- [x] 8.3 Use `r.metadata.documentYear` for `SourceCitation.year`
- [x] 8.4 Use `r.metadata.pageNumber` for `SourceCitation.pageNumber`
- [x] 8.5 Add section field extraction if available in metadata

## 9. Evidence Evaluation Enhancement

- [x] 9.1 Modify `evaluateMultipleSourcesEnhanced()` to use `guidelineSource` for authority mapping
- [x] 9.2 Use `documentYear` for enhanced timeliness calculation
- [x] 9.3 Integrate guideline source identification into evidence quality scoring

## 10. Testing and Validation

- [x] 10.1 Create test fixtures with PDFs containing various metadata scenarios (full metadata, partial, empty)
- [x] 10.2 Write integration tests for end-to-end metadata flow: PDF → parse → chunk → retrieval → citation
- [x] 10.3 Verify backward compatibility: legacy chunks without metadata still work
- [x] 10.4 Verify frontend displays correct source citations with human-readable titles

## 11. Documentation

- [x] 11.1 Update API documentation for document metadata fields
- [x] 11.2 Add code comments for year inference logic
- [x] 11.3 Document guideline source patterns and authority mapping