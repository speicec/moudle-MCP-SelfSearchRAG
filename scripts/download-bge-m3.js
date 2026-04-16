// Download bge-m3 model for hybrid embedding
import { pipeline, env } from '@huggingface/transformers';

// Configure cache directory
env.cacheDir = process.env.TRANSFORMERS_CACHE || './node_modules/@huggingface/transformers/.cache';

// Allow local models
env.allowLocalModels = false;

// Configure mirror if needed (for users in China)
if (process.env.HF_ENDPOINT) {
  env.remoteHost = process.env.HF_ENDPOINT;
  console.log('Using HF mirror:', env.remoteHost);
}

console.log('Downloading bge-m3 model...');
console.log('Cache directory:', env.cacheDir);
console.log('Note: This model is ~2GB, please wait for download to complete...\n');

async function downloadModel() {
  try {
    // Default dtype (fp32) - full model
    const extractor = await pipeline('feature-extraction', 'BAAI/bge-m3', {
      progress_callback: (progress) => {
        if (progress.status === 'downloading') {
          const percent = progress.progress ? Math.round(progress.progress) + '%' : 'starting';
          const file = progress.file || 'model';
          console.log('Downloading ' + file + ': ' + percent);
        } else if (progress.status === 'loading') {
          console.log('Loading model into memory...');
        }
      },
    });

    console.log('\nModel downloaded and loaded successfully!');

    // Test embedding
    const testText = '这是一个测试文本';
    console.log('\nTesting embedding with:', testText);

    const output = await extractor(testText, {
      pooling: 'mean',
      normalize: true,
    });

    console.log('Test embedding generated successfully!');
    console.log('Dimension:', output.data.length);
    console.log('\nModel ready for use!');

  } catch (error) {
    console.error('\nFailed:', error.message);
    process.exit(1);
  }
}

downloadModel();