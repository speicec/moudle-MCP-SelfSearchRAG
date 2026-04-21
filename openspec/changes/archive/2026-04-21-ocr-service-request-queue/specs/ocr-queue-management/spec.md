## ADDED Requirements

### Requirement: Request Queue Management

The OCR service SHALL manage incoming OCR requests through an asyncio.Queue, ensuring serial processing to prevent concurrent calls to the PaddleOCR engine.

#### Scenario: Request enqueued successfully
- **WHEN** a client sends an OCR request to `/ocr/layout`
- **AND** the queue has available capacity
- **THEN** the request is enqueued for processing
- **AND** a Future is created to track the result
- **AND** the client awaits the result

#### Scenario: Queue full returns 503
- **WHEN** a client sends an OCR request
- **AND** the queue is at maximum capacity (MAX_QUEUE_SIZE)
- **THEN** the service returns HTTP 503 Service Unavailable
- **AND** the response body includes `retry_after_seconds` estimate

### Requirement: Serial Processing

The OCR service SHALL process queued requests serially using a background worker task, calling PaddleOCR predict() exactly once at a time.

#### Scenario: Worker processes requests in order
- **WHEN** multiple requests are queued
- **THEN** the worker processes each request one at a time
- **AND** the PaddleOCR engine is never called concurrently
- **AND** results are returned in the order requests were enqueued

#### Scenario: Worker handles processing errors
- **WHEN** PaddleOCR processing fails for a request
- **THEN** the worker sets the Future exception
- **AND** the worker continues processing subsequent requests
- **AND** the failed request count is incremented

### Requirement: Request Timeout

The OCR service SHALL enforce a timeout on each request, returning HTTP 408 if processing exceeds the limit.

#### Scenario: Request completes within timeout
- **WHEN** a request is processed within REQUEST_TIMEOUT_SECONDS
- **THEN** the result is returned to the client normally

#### Scenario: Request exceeds timeout
- **WHEN** a request's processing time exceeds REQUEST_TIMEOUT_SECONDS
- **THEN** the service returns HTTP 408 Request Timeout
- **AND** the response body includes `timeout_seconds` and `page_number`
- **AND** the timeout count is incremented

### Requirement: Queue Configuration

The OCR service SHALL support environment variable configuration for queue parameters.

#### Scenario: Default queue configuration
- **WHEN** no environment variables are set
- **THEN** MAX_QUEUE_SIZE defaults to 50
- **AND** REQUEST_TIMEOUT_SECONDS defaults to 300

#### Scenario: Custom queue configuration
- **WHEN** OCR_MAX_QUEUE_SIZE environment variable is set
- **THEN** the queue capacity is set to that value
- **WHEN** OCR_REQUEST_TIMEOUT environment variable is set
- **THEN** the request timeout is set to that value

### Requirement: Queue Statistics

The OCR service SHALL track and update queue statistics for each processed request.

#### Scenario: Statistics updated after successful processing
- **WHEN** a request is successfully processed
- **THEN** total_processed count is incremented
- **AND** avg_processing_time_ms is updated
- **AND** avg_queue_wait_ms is updated

#### Scenario: Statistics updated after failure
- **WHEN** a request fails processing
- **THEN** total_failed count is incremented