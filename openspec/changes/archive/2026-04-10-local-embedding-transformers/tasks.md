## 1. Dependencies & Setup

- [x] 1.1 Install @xenova/transformers dependency
- [x] 1.2 Update .env.example with EMBEDDING_MODE and model configuration
- [x] 1.3 Add TypeScript type declarations for transformers.js

## 2. Local Text Embedding Service (Multilingual)

- [x] 2.1 Create LocalTextEmbeddingService class implementing TextEmbeddingModel interface
- [x] 2.2 Implement model initialization with multilingual-e5-small
- [x] 2.3 Implement embedText() method with mean pooling and normalization
- [x] 2.4 Implement embedTexts() batch processing method
- [x] 2.5 Add getDimension() returning 384 for multilingual-e5-small
- [x] 2.6 Add quantized model support for smaller download size
- [x] 2.7 Add embedding cache for repeated texts
- [x] 2.8 Test Chinese text embedding generation
- [x] 2.9 Test English text embedding generation
- [x] 2.10 Test cross-language similarity (Chinese query vs English docs)

## 3. Multimodal Embedding Service (CLIP)

- [x] 3.1 Create MultimodalEmbeddingService class
- [x] 3.2 Implement CLIP text encoder initialization
- [x] 3.3 Implement CLIP vision encoder initialization
- [x] 3.4 Implement embedText() for CLIP text encoder
- [x] 3.5 Implement embedImage() for image embedding from buffer
- [x] 3.6 Implement embedImageBase64() for base64 encoded images
- [x] 3.7 Add image preprocessing (resize, normalize to 224x224)
- [x] 3.8 Add getDimension() returning 512 for CLIP
- [x] 3.9 Implement batch image embedding
- [x] 3.10 Add supported image format validation (PNG, JPEG, WebP)

## 4. Service Factory & Integration

- [x] 4.1 Create EmbeddingServiceFactory with mode selection
- [x] 4.2 Update http-server.ts to use factory for text embedding
- [x] 4.3 Integrate MultimodalEmbeddingService into embedding pipeline
- [x] 4.4 Add EMBEDDING_MODE environment variable support (local | api)
- [x] 4.5 Add LOCAL_TEXT_MODEL environment variable
- [x] 4.6 Add LOCAL_MULTIMODAL_MODEL environment variable
- [x] 4.7 Add startup logging for loaded models and modes

## 5. Error Handling & Robustness

- [x] 5.1 Add try-catch for model download failures with retry
- [x] 5.2 Add timeout handling for model initialization
- [x] 5.3 Add graceful degradation when models unavailable
- [x] 5.4 Add error handling for empty/invalid text input
- [x] 5.5 Add error handling for invalid/corrupted images
- [x] 5.6 Add memory monitoring and cleanup for large batches

## 6. Model Pre-download & Offline Support

- [x] 6.1 Create npm script `download-models` for pre-download
- [x] 6.2 Add model download progress logging
- [x] 6.3 Verify offline operation after models cached
- [x] 6.4 Add model cache directory configuration option

## 7. Testing

- [x] 7.1 Add unit test for LocalTextEmbeddingService initialization
- [x] 7.2 Add unit test for Chinese text embedding
- [x] 7.3 Add unit test for English text embedding
- [x] 7.4 Add unit test for cross-language similarity
- [x] 7.5 Add unit test for MultimodalEmbeddingService initialization
- [x] 7.6 Add unit test for image embedding generation
- [x] 7.7 Add integration test for retrieval with local embeddings
- [x] 7.8 Add integration test for text-to-image cross-modal search
- [x] 7.9 Test offline operation after model caching
- [x] 7.10 Verify semantic similarity produces meaningful results for Chinese

## 8. Documentation

- [x] 8.1 Update README with local embedding setup instructions
- [x] 8.2 Document multilingual support (Chinese + English)
- [x] 8.3 Document multimodal capabilities
- [x] 8.4 Document environment variable configuration
- [x] 8.5 Add troubleshooting guide for model download issues
- [x] 8.6 Document supported image formats