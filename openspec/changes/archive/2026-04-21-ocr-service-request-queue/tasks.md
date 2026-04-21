## 1. Server Queue Infrastructure

- [x] 1.1 Add imports: `asyncio`, `dataclass`, `asyncio.Future`, `asyncio.Queue`
- [x] 1.2 Create `QueueItem` dataclass with fields: `image_array`, `page_number`, `image_width`, `image_height`, `future`, `arrived_at`
- [x] 1.3 Add global state: `request_queue`, `queue_stats`, `worker_task`
- [x] 1.4 Add environment variable defaults: `MAX_QUEUE_SIZE=50`, `REQUEST_TIMEOUT_SECONDS=300`

## 2. Background Worker Implementation

- [x] 2.1 Create `queue_worker()` async function that loops forever, fetching from queue
- [x] 2.2 Implement worker processing: call `ocr_engine.predict()`, handle results/errors
- [x] 2.3 Implement Future result setting: `future.set_result()` on success, `future.set_exception()` on error
- [x] 2.4 Implement statistics updates: increment counters, update averages
- [x] 2.5 Add robust error handling: catch exceptions, continue loop, log errors
- [x] 2.6 Implement startup event: initialize queue, create worker task
- [x] 2.7 Implement shutdown event: cancel worker task gracefully

## 3. OCR Endpoint Enhancement

- [x] 3.1 Modify `/ocr/layout` endpoint: check queue capacity, return 503 if full
- [x] 3.2 Add Future creation and QueueItem construction
- [x] 3.3 Implement queue enqueue: `request_queue.put_nowait()`
- [x] 3.4 Implement timeout handling: `asyncio.wait_for()` with `REQUEST_TIMEOUT_SECONDS`
- [x] 3.5 Handle TimeoutError: return 408, increment timeout counter
- [x] 3.6 Modify `/ocr/batch` endpoint similarly: check capacity per file, handle timeouts

## 4. Status Endpoint Implementation

- [x] 4.1 Create `/status` endpoint returning: queue info, timing, stats
- [x] 4.2 Implement `estimated_wait_seconds` calculation
- [x] 4.3 Enhance `/health` endpoint: add `queue_size` field
- [x] 4.4 Ensure consistent JSON response format per spec

## 5. Client-side Coordination

- [x] 5.1 Update `DEFAULT_OCR_CONFIG`: reduce `batchSize` from 5 to 1-2
- [x] 5.2 Add retry logic in `layout-ocr-service.ts`: handle 503/408 responses
- [x] 5.3 Implement `retry_after_seconds` wait before retry
- [x] 5.4 Add optional pre-check: call `/status` before sending requests
- [x] 5.5 Update error messages and logging for new response codes

## 6. Configuration Documentation

- [x] 6.1 Add to `.env.example`: `OCR_MAX_QUEUE_SIZE`, `OCR_REQUEST_TIMEOUT` descriptions
- [x] 6.2 Update `docs/ocr-service.md`: document new queue behavior and endpoints
- [x] 6.3 Update `docs/image-pdf-config.md`: add client-side coordination guidance
- [x] 6.4 Add command-line arguments to `ocr_service.py`: `--max-queue-size`, `--request-timeout`

## 7. Testing and Validation

- [ ] 7.1 Manual test: send 10 concurrent requests, verify serial processing
- [ ] 7.2 Manual test: fill queue, verify 503 response
- [ ] 7.3 Manual test: trigger timeout, verify 408 response
- [ ] 7.4 Manual test: call `/status` during processing, verify queue info
- [ ] 7.5 Process a large document (100+ pages), verify no "fetch failed" errors
- [ ] 7.6 Update existing tests if needed: `layout-ocr-service.test.ts`