## 1. Core Module Type Fixes

- [x] 1.1 Fix `src/core/document.ts`: Add `| undefined` to optional metadata properties
- [x] 1.2 Fix `src/core/format-utils.ts`: Handle undefined array elements in detectMimeTypeFromContent
- [x] 1.3 Fix `src/core/pipeline.ts`: Replace abstract class instantiation with concrete class
- [x] 1.4 Fix `src/core/pipeline.ts`: Fix `import type { Context }` used as value
- [x] 1.5 Fix `src/core/validator.ts`: Resolve duplicate validator export naming

## 2. Embedding Module Type Fixes

- [x] 2.1 Fix `src/embedding/embedding-service.ts`: Import EmbeddingVector from correct location
- [x] 2.2 Fix `src/embedding/image-embedding-service.ts`: Import EmbeddingVector from correct location

## 3. Index Export Fixes

- [x] 3.1 Fix `src/index.ts`: Resolve duplicate DocumentStructure export between core/types and parsers/page-segmenter
- [x] 3.2 Fix `src/integration/pipeline-builder.ts`: Fix embedding-stage.js import path

## 4. MCP Module Type Fixes

- [x] 4.1 Fix `src/mcp/handlers.ts`: Add `| undefined` to optional QueryOptions properties
- [x] 4.2 Fix `src/mcp/handlers.ts`: Add `| undefined` to optional ListOptions properties
- [x] 4.3 Fix `src/mcp/handlers.ts`: Fix DocumentMetadata partial type assignment
- [x] 4.4 Fix `src/mcp/server.ts`: Fix MCP tool response type to match SDK requirements
- [x] 4.5 Fix `src/mcp/server.ts`: Add proper type casting for tool arguments
- [x] 4.6 Fix `src/app.ts`: Make constructor async-safe (remove top-level await in constructor)
- [x] 4.7 Fix `src/app.ts`: Fix Pipeline type mismatch with Harness

## 5. Parser Module Type Fixes

- [x] 5.1 Fix `src/parsers/chart-detector.ts`: Handle possibly undefined width/height
- [x] 5.2 Fix `src/parsers/formula-extractor.ts`: Handle undefined formula elements
- [x] 5.3 Fix `src/parsers/formula-extractor.ts`: Add `| undefined` to optional metadata
- [x] 5.4 Fix `src/parsers/formula-extractor.ts`: Fix regex escape for closing parenthesis
- [x] 5.5 Fix `src/parsers/image-extractor.ts`: Add `| undefined` to optional ImageBlockMetadata
- [x] 5.6 Fix `src/parsers/layout-analyzer.ts`: Handle undefined lines array elements
- [x] 5.7 Fix `src/parsers/layout-analyzer.ts`: Fix missing `this.` for avgIndentGroups
- [x] 5.8 Fix `src/parsers/page-segmenter.ts`: Handle undefined lines array element
- [x] 5.9 Fix `src/parsers/parse-stage.ts`: Add `| undefined` to ParsedMetadata optional fields
- [x] 5.10 Fix `src/parsers/table-extractor.ts`: Add `| undefined` to optional TableBlockMetadata
- [x] 5.11 Fix `src/parsers/table-extractor.ts`: Handle undefined array elements
- [x] 5.12 Fix `src/parsers/table-validator.ts`: Fix CellValidationResult reference
- [x] 5.13 Fix `src/parsers/text-extractor.ts`: Handle undefined paragraphs array elements

## 6. Verification

- [x] 6.1 Run `npx tsc --noEmit` and verify zero errors
- [x] 6.2 Run `npm run build` and verify successful compilation
- [ ] 6.3 Run `npm test` and verify tests pass