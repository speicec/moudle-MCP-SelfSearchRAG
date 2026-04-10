## ADDED Requirements

### Requirement: Retrieval embedding generator must be configured
The `SmallToBigRetriever` SHALL use a real embedding service to generate query embeddings, ensuring semantic similarity calculation produces meaningful results.

#### Scenario: Query embedding generated via embedding service
- **WHEN** a query is submitted to the retrieval endpoint
- **THEN** the system SHALL call the configured embedding service to generate a query vector
- **AND** the query vector SHALL have the same dimension as stored chunk embeddings

#### Scenario: Query embedding cached for repeated queries
- **WHEN** the same query is submitted multiple times within the cache TTL
- **THEN** the system SHALL return cached embedding without calling the embedding service

### Requirement: Embedding service must be injectable
The HTTP server SHALL provide a mechanism to inject the embedding service into the retrieval components.

#### Scenario: Embedding service available via Fastify decorator
- **WHEN** the HTTP server initializes
- **THEN** an embedding service instance SHALL be registered as a Fastify decorator
- **AND** the service SHALL be accessible in route handlers

#### Scenario: Embedding generator set on retriever creation
- **WHEN** a `SmallToBigRetriever` is created in the chat route
- **THEN** the embedding generator function SHALL be set using `setEmbeddingGenerator`
- **AND** the generator SHALL delegate to the injected embedding service

### Requirement: Embedding dimension validation
The system SHALL validate that query embeddings have consistent dimensions with stored embeddings.

#### Scenario: Dimension mismatch detected
- **WHEN** a query embedding has different dimension than stored chunk embeddings
- **THEN** the system SHALL log an error
- **AND** the system SHALL return an error response to the client