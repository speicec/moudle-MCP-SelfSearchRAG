## ADDED Requirements

### Requirement: MCP query tool uses HierarchicalStore
The MCP query tool SHALL use HierarchicalStore as its data source for retrieval.

#### Scenario: Query retrieves from stored chunks
- **WHEN** MCP query tool receives a query_text parameter
- **THEN** system searches in HierarchicalStore's small chunks and returns matching results

#### Scenario: Store has no data
- **WHEN** HierarchicalStore has zero chunks
- **THEN** MCP query tool returns empty results array with message indicating no documents indexed

### Requirement: MCP query returns Small-to-Big format
The MCP query tool SHALL return results in Small-to-Big retrieval format.

#### Scenario: Results include parent chunk content
- **WHEN** query returns results
- **THEN** each result includes `parentChunkContent` containing the full parent chunk text

#### Scenario: Results include context window
- **WHEN** query returns results
- **THEN** each result includes `contextWindow` with extracted context around matched small chunk

#### Scenario: Results include similarity score
- **WHEN** query returns results
- **THEN** each result includes `similarityScore` (0.0 to 1.0) calculated from embedding cosine similarity

#### Scenario: Results include source document ID
- **WHEN** query returns results
- **THEN** each result includes `sourceDocumentId` identifying the source document

### Requirement: MCP query tool supports query options
The MCP query tool SHALL support standard query options.

#### Scenario: TopK limits results
- **WHEN** user provides top_k parameter (default: 5)
- **THEN** system returns at most top_k results

#### Scenario: Threshold filters low-similarity results
- **WHEN** user provides threshold parameter
- **THEN** system only returns results with similarityScore >= threshold

### Requirement: MCP query uses local embedding
The MCP query tool SHALL use the same embedding service as HTTP Server.

#### Scenario: Query embedding dimension matches stored chunks
- **WHEN** query embedding is generated
- **THEN** embedding dimension matches stored chunk embeddings (384 for multilingual-e5-small)

#### Scenario: Embedding service fails
- **WHEN** embedding service fails to generate query embedding
- **THEN** MCP query tool returns error with message describing the failure

## REMOVED Requirements

### Requirement: MCP query uses InMemoryVectorStore
**Reason**: InMemoryVectorStore was created empty and never populated with data. All actual data resides in HierarchicalStore.
**Migration**: Use HierarchicalStore with SmallToBigRetriever instead, which provides Small-to-Big retrieval with context windows.