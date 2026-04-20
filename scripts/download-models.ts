#!/usr/bin/env node
/**
 * Pre-download embedding models for offline operation
 *
 * Usage:
 *   npm run download-models
 *   npx tsx scripts/download-models.ts --mode hybrid
 *
 * Features:
 *   - Auto-detect EMBEDDING_MODE from .env
 *   - Skip already downloaded models (incremental)
 *   - Rich progress display with file-level details
 *   - Model validation after download
 */

import { pipeline, env } from '@huggingface/transformers';
import fs from 'fs';
import path from 'path';

// Configure cache directory
const DEFAULT_CACHE_DIR = path.join(
  process.env.LOCALAPPDATA || process.env.HOME || '.',
  '.cache',
  'huggingface',
  'hub'
);

if (process.env.TRANSFORMERS_CACHE) {
  env.cacheDir = process.env.TRANSFORMERS_CACHE;
} else {
  // Use node_modules cache for consistency with runtime
  const nodeModulesCache = path.join(
    process.cwd(),
    'node_modules',
    '@huggingface',
    'transformers',
    '.cache'
  );
  if (fs.existsSync(nodeModulesCache)) {
    env.cacheDir = nodeModulesCache;
  }
}

// ============================================================================
// Model Definitions
// ============================================================================

interface ModelInfo {
  name: string;
  modelId: string;
  task: 'feature-extraction' | 'zero-shot-image-classification';
  description: string;
  size: string;
  estimatedBytes: number;
  requiredFor: string[]; // embedding modes that need this model
}

const ALL_MODELS: ModelInfo[] = [
  // Hybrid mode (bge-m3)
  {
    name: 'bge-m3',
    modelId: 'Xenova/bge-m3',
    task: 'feature-extraction',
    description: 'Hybrid embedding: Dense (1024d) + Sparse for RRF fusion',
    size: '~2.3GB',
    estimatedBytes: 2_400_000_000,
    requiredFor: ['hybrid'],
  },
  // Local mode (multilingual-e5)
  {
    name: 'multilingual-e5-small',
    modelId: 'Xenova/multilingual-e5-small',
    task: 'feature-extraction',
    description: 'Lightweight multilingual text embedding (384d)',
    size: '~118MB',
    estimatedBytes: 120_000_000,
    requiredFor: ['local'],
  },
  {
    name: 'multilingual-e5-base',
    modelId: 'Xenova/multilingual-e5-base',
    task: 'feature-extraction',
    description: 'Multilingual text embedding (768d)',
    size: '~280MB',
    estimatedBytes: 300_000_000,
    requiredFor: ['local'],
  },
  {
    name: 'multilingual-e5-large',
    modelId: 'Xenova/multilingual-e5-large',
    task: 'feature-extraction',
    description: 'Large multilingual text embedding (1024d)',
    size: '~560MB',
    estimatedBytes: 600_000_000,
    requiredFor: ['local'],
  },
  // Multimodal (CLIP) - used by all local modes
  {
    name: 'clip-vit-base-patch32',
    modelId: 'Xenova/clip-vit-base-patch32',
    task: 'zero-shot-image-classification',
    description: 'CLIP multimodal embedding (512d) for text-to-image search',
    size: '~340MB',
    estimatedBytes: 350_000_000,
    requiredFor: ['hybrid', 'local'],
  },
];

// ============================================================================
// Progress Display
// ============================================================================

class ProgressDisplay {
  private currentModel: string = '';
  private currentFile: string = '';
  private modelProgress: number = 0;
  private fileProgress: number = 0;
  private loadedBytes: number = 0;
  private totalBytes: number = 0;
  private startTime: number = 0;

  startModel(model: string, totalBytes: number) {
    this.currentModel = model;
    this.modelProgress = 0;
    this.totalBytes = totalBytes;
    this.loadedBytes = 0;
    this.startTime = Date.now();
    this.render();
  }

  updateProgress(status: string, progress?: number, file?: string, loaded?: number, total?: number) {
    this.currentFile = file ?? '';
    if (progress !== undefined) {
      this.fileProgress = progress;
      this.modelProgress = progress; // Simplified: file progress = model progress
    }
    if (loaded !== undefined) this.loadedBytes = loaded;
    if (total !== undefined) this.totalBytes = total;
    this.render();
  }

  completeModel(duration: number) {
    const elapsed = Math.round(duration / 1000);
    console.log(`\n✅ ${this.currentModel} downloaded successfully (${elapsed}s)`);
  }

  private render() {
    const barWidth = 40;
    const filled = Math.round(barWidth * (this.modelProgress / 100));
    const empty = barWidth - filled;
    const bar = '█'.repeat(filled) + '░'.repeat(empty);

    const loadedMB = Math.round(this.loadedBytes / 1024 / 1024);
    const totalMB = Math.round(this.totalBytes / 1024 / 1024);

    // Clear previous line and render new
    process.stdout.write('\r\x1b[K');
    process.stdout.write(
      `📦 ${this.currentModel} [${bar}] ${this.modelProgress}% ` +
      `(${loadedMB}/${totalMB}MB) ${this.currentFile ? `📄 ${this.currentFile}` : ''}`
    );
  }
}

const progress = new ProgressDisplay();

// ============================================================================
// Model Download Functions
// ============================================================================

/**
 * Check if model is already cached
 */
function isModelCached(modelId: string): boolean {
  const modelPath = path.join(env.cacheDir, modelId.replace('/', '--'));

  // Check for key files that indicate successful download
  const keyFiles = ['config.json', 'tokenizer.json'];
  for (const file of keyFiles) {
    if (!fs.existsSync(path.join(modelPath, file))) {
      return false;
    }
  }

  // Check for ONNX model file
  const onnxPath = path.join(modelPath, 'onnx');
  if (!fs.existsSync(onnxPath)) {
    return false;
  }

  // Check for model.onnx or model.onnx_data
  const modelOnnx = path.join(onnxPath, 'model.onnx');
  const modelOnnxData = path.join(onnxPath, 'model.onnx_data');

  // For large models, model.onnx_data is required
  if (fs.existsSync(modelOnnxData)) {
    const stat = fs.statSync(modelOnnxData);
    // If file is very small, it's incomplete
    if (stat.size < 100_000_000) {
      console.log(`⚠️  ${modelId}: model.onnx_data exists but seems incomplete (${Math.round(stat.size / 1024 / 1024)}MB)`);
      return false;
    }
    return true;
  }

  // For small models, model.onnx alone is sufficient
  if (fs.existsSync(modelOnnx)) {
    const stat = fs.statSync(modelOnnx);
    if (stat.size > 100_000) {
      return true;
    }
  }

  return false;
}

/**
 * Get cache size for a model
 */
function getCacheSize(modelId: string): number {
  const modelPath = path.join(env.cacheDir, modelId.replace('/', '--'));
  if (!fs.existsSync(modelPath)) return 0;

  let totalSize = 0;
  const files = fs.readdirSync(modelPath, { recursive: true }) as string[];
  for (const file of files) {
    const filePath = path.join(modelPath, file);
    try {
      const stat = fs.statSync(filePath);
      if (stat.isFile()) totalSize += stat.size;
    } catch {}
  }
  return totalSize;
}

/**
 * Download a single model with progress tracking
 */
async function downloadModel(model: ModelInfo): Promise<{ success: boolean; duration: number }> {
  console.log('\n' + '─'.repeat(60));
  console.log(`  Model: ${model.name} (${model.modelId})`);
  console.log(`  Description: ${model.description}`);
  console.log(`  Size: ${model.size}`);
  console.log('─'.repeat(60));

  // Check if already cached
  if (isModelCached(model.modelId)) {
    const cachedSize = getCacheSize(model.modelId);
    const cachedMB = Math.round(cachedSize / 1024 / 1024);
    console.log(`✅ Already cached (${cachedMB}MB), skipping download`);
    return { success: true, duration: 0 };
  }

  const startTime = Date.now();
  progress.startModel(model.name, model.estimatedBytes);

  try {
    await pipeline(model.task, model.modelId, {
      quantized: true,
      progress_callback: (p: { status: string; progress?: number; file?: string; loaded?: number; total?: number }) => {
        if (p.status === 'downloading' || p.status === 'progress') {
          progress.updateProgress(p.status, p.progress, p.file, p.loaded, p.total);
        } else if (p.status === 'loading') {
          process.stdout.write('\r\x1b[K');
          console.log(`  🔧 Loading model into memory...`);
        } else if (p.status === 'done') {
          process.stdout.write('\r\x1b[K');
          console.log(`  ✅ ${p.file || 'file'} complete`);
        }
      },
    });

    const duration = Date.now() - startTime;
    progress.completeModel(duration);

    // Validate download
    if (!isModelCached(model.modelId)) {
      console.log(`⚠️  Warning: Model downloaded but cache validation failed`);
      return { success: false, duration };
    }

    return { success: true, duration };
  } catch (error) {
    const duration = Date.now() - startTime;
    process.stdout.write('\r\x1b[K');
    console.log(`\n❌ Failed to download ${model.name}: ${error instanceof Error ? error.message : String(error)}`);
    return { success: false, duration };
  }
}

/**
 * Get embedding mode from environment
 */
function getEmbeddingMode(): string {
  // Check CLI argument first
  const args = process.argv.slice(2);
  const modeArg = args.find(a => a.startsWith('--mode'));
  if (modeArg) {
    return modeArg.split('=')[1] || args[args.indexOf(modeArg) + 1] || 'hybrid';
  }

  // Check .env file
  const envPath = path.join(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    const modeMatch = envContent.match(/EMBEDDING_MODE\s*=\s*(\w+)/);
    if (modeMatch) return modeMatch[1];
  }

  // Check environment variable
  if (process.env.EMBEDDING_MODE) {
    return process.env.EMBEDDING_MODE.toLowerCase();
  }

  // Check if hybrid retrieval is enabled
  if (process.env.HYBRID_RETRIEVAL_ENABLED === 'true') {
    return 'hybrid';
  }

  // Default to hybrid (recommended)
  return 'hybrid';
}

/**
 * Get models to download based on mode
 */
function getModelsToDownload(mode: string): ModelInfo[] {
  return ALL_MODELS.filter(m => m.requiredFor.includes(mode));
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  console.log('\n' + '█'.repeat(60));
  console.log('  📦 RAG Embedding Model Pre-Download');
  console.log('  Run before first startup to cache models');
  console.log('█'.repeat(60) + '\n');

  // Detect mode
  const mode = getEmbeddingMode();
  console.log(`🎯 Embedding mode: ${mode.toUpperCase()}`);
  console.log(`📁 Cache directory: ${env.cacheDir}\n`);

  // Get models for this mode
  const models = getModelsToDownload(mode);

  if (models.length === 0) {
    console.log('ℹ️  API mode detected - no local models required');
    console.log('   Set EMBEDDING_MODE=hybrid or EMBEDDING_MODE=local to download models');
    return;
  }

  console.log('📋 Models to download:');
  for (const model of models) {
    const cached = isModelCached(model.modelId);
    const status = cached ? '✅ cached' : '⬇️  needs download';
    console.log(`   ${model.name} (${model.size}) - ${status}`);
  }
  console.log('');

  // Download each model
  const results: Array<{ model: ModelInfo; success: boolean; duration: number }> = [];

  for (const model of models) {
    const result = await downloadModel(model);
    results.push({ model, ...result });
  }

  // Summary
  console.log('\n' + '─'.repeat(60));
  console.log('  📊 Download Summary');
  console.log('─'.repeat(60) + '\n');

  let successCount = 0;
  let skipCount = 0;
  let totalDuration = 0;

  for (const { model, success, duration } of results) {
    if (success) {
      if (duration === 0) {
        skipCount++;
        console.log(`  ✅ ${model.name}: cached (skipped)`);
      } else {
        successCount++;
        totalDuration += duration;
        console.log(`  ✅ ${model.name}: downloaded (${Math.round(duration / 1000)}s)`);
      }
    } else {
      console.log(`  ❌ ${model.name}: failed`);
    }
  }

  console.log('\n' + '─'.repeat(60));
  console.log(`  Total: ${successCount + skipCount}/${models.length} models ready`);
  if (successCount > 0) {
    console.log(`  Download time: ${Math.round(totalDuration / 1000)}s`);
  }
  console.log('─'.repeat(60) + '\n');

  if (successCount + skipCount === models.length) {
    console.log('✅ All models ready! Start the server with: npm run start:server');
    console.log('   Or run offline with: LOCAL_FILES_ONLY=true npm run start:server\n');
  } else {
    console.log('❌ Some models failed. Check network and retry.\n');
    process.exit(1);
  }
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});