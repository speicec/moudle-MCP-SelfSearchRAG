#!/usr/bin/env node
/**
 * Pre-download embedding models for offline operation
 * Run: npm run download-models
 */

import { pipeline, env } from '@xenova/transformers';

// Configure cache directory
if (process.env.TRANSFORMERS_CACHE) {
  env.cacheDir = process.env.TRANSFORMERS_CACHE;
}

const MODELS = [
  {
    name: 'multilingual-e5-small',
    modelId: 'Xenova/multilingual-e5-small',
    task: 'feature-extraction',
    description: 'Multilingual text embedding (supports 100+ languages including Chinese)',
    size: '~118MB',
  },
  {
    name: 'clip-vit-base-patch32',
    modelId: 'Xenova/clip-vit-base-patch32',
    task: 'zero-shot-image-classification',
    description: 'Multimodal embedding (text-to-image cross-modal search)',
    size: '~340MB',
  },
];

async function downloadModel(model: typeof MODELS[0]) {
  console.log('\n' + '='.repeat(60));
  console.log(`Downloading: ${model.name}`);
  console.log(`Model ID: ${model.modelId}`);
  console.log(`Description: ${model.description}`);
  console.log(`Approximate size: ${model.size}`);
  console.log('='.repeat(60) + '\n');

  const startTime = Date.now();

  try {
    await pipeline(model.task, model.modelId, {
      quantized: true,
      progress_callback: (progress: { status: string; progress?: number; file?: string; loaded?: number; total?: number }) => {
        if (progress.status === 'downloading') {
          if (progress.progress) {
            const percent = Math.round(progress.progress);
            const loaded = progress.loaded ? `${Math.round(progress.loaded / 1024 / 1024)}MB` : '';
            const total = progress.total ? `${Math.round(progress.total / 1024 / 1024)}MB` : '';
            const file = progress.file ?? 'model';
            console.log(`  [${file}] ${percent}% (${loaded}/${total})`);
          } else {
            console.log(`  Starting download: ${progress.file ?? 'model'}`);
          }
        } else if (progress.status === 'loading') {
          console.log(`  Loading model into memory...`);
        } else if (progress.status === 'done') {
          console.log(`  ✓ Download complete: ${progress.file ?? 'model'}`);
        }
      },
    });

    const duration = Date.now() - startTime;
    console.log(`\n✓ Model ${model.name} downloaded successfully (${Math.round(duration / 1000)}s)`);
    return true;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`\n✗ Failed to download ${model.name}: ${errorMessage}`);
    return false;
  }
}

async function main() {
  console.log('\n' + '█'.repeat(60));
  console.log('  Embedding Model Pre-Download Script');
  console.log('  Run this before using the system offline');
  console.log('█'.repeat(60) + '\n');

  console.log(`Cache directory: ${env.cacheDir}`);
  console.log('\nModels to download:');
  for (const model of MODELS) {
    console.log(`  - ${model.name} (${model.size})`);
  }

  console.log('\nStarting downloads...\n');

  let successCount = 0;
  for (const model of MODELS) {
    const success = await downloadModel(model);
    if (success) successCount++;
  }

  console.log('\n' + '='.repeat(60));
  console.log(`Download Summary: ${successCount}/${MODELS.length} models downloaded`);
  console.log('='.repeat(60));

  if (successCount === MODELS.length) {
    console.log('\n✓ All models downloaded! You can now run the system offline.');
    console.log('\nTo verify offline operation, set: LOCAL_FILES_ONLY=true');
  } else {
    console.log('\n⚠ Some models failed to download. Check your network connection and try again.');
    process.exit(1);
  }
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});