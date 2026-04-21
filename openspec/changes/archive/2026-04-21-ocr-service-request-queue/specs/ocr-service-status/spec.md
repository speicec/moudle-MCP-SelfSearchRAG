## ADDED Requirements

### Requirement: Status Endpoint

The OCR service SHALL provide a `/status` endpoint that returns current queue state and processing statistics.

#### Scenario: Status endpoint returns queue information
- **WHEN** a client requests `/status`
- **THEN** the response includes `queue.size` (current queue length)
- **AND** the response includes `queue.max_size` (maximum capacity)
- **AND** the response includes `queue.available_slots` (remaining capacity)

#### Scenario: Status endpoint returns timing estimates
- **WHEN** a client requests `/status`
- **THEN** the response includes `timing.avg_processing_time_ms`
- **AND** the response includes `timing.avg_queue_wait_ms`
- **AND** the response includes `timing.estimated_wait_seconds`

#### Scenario: Status endpoint returns statistics
- **WHEN** a client requests `/status`
- **THEN** the response includes `stats.total_processed`
- **AND** the response includes `stats.total_failed`
- **AND** the response includes `stats.total_timeout`

### Requirement: Health Check Enhancement

The OCR service SHALL enhance the existing `/health` endpoint with queue status information.

#### Scenario: Health check includes queue size
- **WHEN** a client requests `/health`
- **THEN** the response includes `queue_size` (current queue length)
- **AND** the response includes the existing `status` and `gpu_enabled` fields

### Requirement: Status Response Format

The `/status` endpoint SHALL return a consistent JSON structure.

#### Scenario: Response format is predictable
- **WHEN** `/status` returns a response
- **THEN** the JSON structure is:
```json
{
  "status": "healthy" | "initializing",
  "gpu_enabled": boolean,
  "queue": {
    "size": number,
    "max_size": number,
    "available_slots": number
  },
  "timing": {
    "avg_processing_time_ms": number,
    "avg_queue_wait_ms": number,
    "estimated_wait_seconds": number
  },
  "stats": {
    "total_processed": number,
    "total_failed": number,
    "total_timeout": number
  }
}
```

### Requirement: Estimated Wait Calculation

The `/status` endpoint SHALL calculate an estimated wait time based on current queue state.

#### Scenario: Wait estimate with average processing time
- **WHEN** there are requests in the queue
- **AND** avg_processing_time_ms is known (> 0)
- **THEN** estimated_wait_seconds = (queue_size + 1) × avg_processing_time_ms / 1000

#### Scenario: Wait estimate without statistics
- **WHEN** no requests have been processed yet
- **AND** avg_processing_time_ms is 0
- **THEN** estimated_wait_seconds is 0