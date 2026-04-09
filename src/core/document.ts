import { v4 as uuidv4 } from 'uuid';

/**
 * Document status
 */
export type DocumentStatus =
  | 'pending'
  | 'queued'
  | 'processing'
  | 'indexed'
  | 'failed';

/**
 * Supported document formats
 */
export type DocumentFormat =
  | 'pdf'
  | 'image'
  | 'text';

/**
 * Image formats
 */
export type ImageFormat =
  | 'png'
  | 'jpg'
  | 'jpeg'
  | 'webp';

/**
 * MIME types for supported formats
 */
export const MIME_TYPES: Record<string, string> = {
  pdf: 'application/pdf',
  txt: 'text/plain',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
};

/**
 * Document metadata
 */
export interface DocumentMetadata {
  filename: string;
  sizeBytes: number;
  mimeType: string;
  format: DocumentFormat;
  uploadTimestamp: Date;
  sourcePath?: string | undefined;
  customMetadata?: Record<string, unknown> | undefined;
}

/**
 * Document interface
 */
export interface Document {
  id: string;
  content: Buffer | string;
  metadata: DocumentMetadata;
  status: DocumentStatus;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Create a new document from raw content
 */
export function createDocument(
  content: Buffer | string,
  metadata: Partial<DocumentMetadata> & { filename: string; mimeType: string }
): Document {
  const now = new Date();
  const format = detectFormat(metadata.mimeType);

  return {
    id: uuidv4(),
    content,
    metadata: {
      filename: metadata.filename,
      sizeBytes: typeof content === 'string'
        ? Buffer.byteLength(content, 'utf-8')
        : content.length,
      mimeType: metadata.mimeType,
      format,
      uploadTimestamp: now,
      sourcePath: metadata.sourcePath,
      customMetadata: metadata.customMetadata,
    },
    status: 'pending',
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Detect document format from MIME type
 */
export function detectFormat(mimeType: string): DocumentFormat {
  if (mimeType === 'application/pdf') {
    return 'pdf';
  }
  if (mimeType.startsWith('image/')) {
    return 'image';
  }
  if (mimeType === 'text/plain') {
    return 'text';
  }
  throw new Error(`Unsupported MIME type: ${mimeType}`);
}

/**
 * Detect MIME type from file extension
 */
export function detectMimeType(filename: string): string {
  const ext = filename.toLowerCase().split('.').pop() ?? '';

  if (ext in MIME_TYPES) {
    return MIME_TYPES[ext]!;
  }

  throw new Error(`Unknown file extension: ${ext}`);
}

/**
 * Check if format is supported
 */
export function isSupportedFormat(mimeType: string): boolean {
  const supportedTypes = [
    'application/pdf',
    'text/plain',
    'image/png',
    'image/jpeg',
    'image/webp',
  ];
  return supportedTypes.includes(mimeType);
}

/**
 * Check if format is an image
 */
export function isImageFormat(mimeType: string): boolean {
  return mimeType.startsWith('image/');
}

/**
 * Check if format is PDF
 */
export function isPdfFormat(mimeType: string): boolean {
  return mimeType === 'application/pdf';
}

/**
 * Check if format is text
 */
export function isTextFormat(mimeType: string): boolean {
  return mimeType === 'text/plain';
}

/**
 * Update document status
 */
export function updateDocumentStatus(
  document: Document,
  status: DocumentStatus
): Document {
  return {
    ...document,
    status,
    updatedAt: new Date(),
  };
}

/**
 * Create document from file path (for server-side use)
 */
export function createDocumentFromFile(
  filePath: string,
  content: Buffer,
  mimeType: string
): Document {
  const filename = filePath.split(/[/\\]/).pop() ?? filePath;

  return createDocument(content, {
    filename,
    mimeType,
    sourcePath: filePath,
  });
}