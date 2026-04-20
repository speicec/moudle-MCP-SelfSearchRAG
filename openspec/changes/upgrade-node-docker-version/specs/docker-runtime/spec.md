## No Capability Changes

This change upgrades the Node.js runtime version in Docker containers. No new capabilities are introduced and no existing spec-level behavior is modified.

### Requirement: Node.js Runtime Compatibility

The Docker container SHALL use Node.js version 20 or higher to ensure compatibility with pdfjs-dist 5.x native module dependencies.

#### Scenario: Container starts successfully
- **WHEN** Docker container is built and started with Node.js 22
- **THEN** server starts without `DOMMatrix is not defined` error

#### Scenario: PDF processing works
- **WHEN** user uploads a PDF document
- **THEN** PDF is successfully converted to images using pdfjs-dist