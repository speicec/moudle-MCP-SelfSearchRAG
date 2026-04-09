/**
 * MIME type mappings
 */
export const MIME_TYPE_MAP: Record<string, string> = {
  // PDF
  pdf: 'application/pdf',

  // Text
  txt: 'text/plain',
  text: 'text/plain',
  md: 'text/markdown',
  json: 'application/json',
  xml: 'application/xml',

  // Images
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  bmp: 'image/bmp',
  svg: 'image/svg+xml',
  tiff: 'image/tiff',
  tif: 'image/tiff',

  // Office documents (not supported but recognized)
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
};

/**
 * Extension from MIME type reverse mapping
 */
export const MIME_TO_EXTENSION: Record<string, string> = Object.fromEntries(
  Object.entries(MIME_TYPE_MAP).map(([ext, mime]) => [mime, ext])
);

/**
 * Supported MIME types for RAG processing
 */
export const SUPPORTED_MIME_TYPES: string[] = [
  'application/pdf',
  'text/plain',
  'image/png',
  'image/jpeg',
  'image/webp',
];

/**
 * Detect MIME type from file extension
 */
export function getMimeTypeFromExtension(filename: string): string | null {
  const ext = extractExtension(filename);
  if (!ext) return null;

  return MIME_TYPE_MAP[ext.toLowerCase()] ?? null;
}

/**
 * Extract file extension from filename
 */
export function extractExtension(filename: string): string | null {
  const parts = filename.split('.');
  if (parts.length < 2) return null;

  const lastPart = parts[parts.length - 1];
  return lastPart ? lastPart.toLowerCase() : null;
}

/**
 * Get extension from MIME type
 */
export function getExtensionFromMimeType(mimeType: string): string | null {
  return MIME_TO_EXTENSION[mimeType] ?? null;
}

/**
 * Check if MIME type is supported for RAG
 */
export function isMimeTypeSupported(mimeType: string): boolean {
  return SUPPORTED_MIME_TYPES.includes(mimeType);
}

/**
 * Check if MIME type is PDF
 */
export function isMimeTypePdf(mimeType: string): boolean {
  return mimeType === 'application/pdf';
}

/**
 * Check if MIME type is image
 */
export function isMimeTypeImage(mimeType: string): boolean {
  return mimeType.startsWith('image/');
}

/**
 * Check if MIME type is text
 */
export function isMimeTypeText(mimeType: string): boolean {
  return mimeType === 'text/plain';
}

/**
 * Detect format category from MIME type
 */
export function getFormatCategory(mimeType: string): 'pdf' | 'image' | 'text' | 'unsupported' {
  if (isMimeTypePdf(mimeType)) return 'pdf';
  if (isMimeTypeImage(mimeType)) return 'image';
  if (isMimeTypeText(mimeType)) return 'text';
  return 'unsupported';
}

/**
 * Detect MIME type from content buffer (magic number detection)
 */
export function detectMimeTypeFromContent(content: Buffer): string | null {
  // PDF: starts with %PDF-
  if (content.subarray(0, 5).equals(Buffer.from('%PDF-'))) {
    return 'application/pdf';
  }

  // PNG: starts with 89 50 4E 47 0D 0A 1A 0A
  if (content.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]))) {
    return 'image/png';
  }

  // JPEG: starts with FF D8 FF
  if (content.subarray(0, 3).equals(Buffer.from([0xFF, 0xD8, 0xFF]))) {
    return 'image/jpeg';
  }

  // WEBP: starts with RIFF....WEBP
  if (content.length >= 12 &&
      content.subarray(0, 4).equals(Buffer.from('RIFF')) &&
      content.subarray(8, 12).equals(Buffer.from('WEBP'))) {
    return 'image/webp';
  }

  // GIF: starts with GIF87a or GIF89a
  if (content.subarray(0, 6).equals(Buffer.from('GIF87a')) ||
      content.subarray(0, 6).equals(Buffer.from('GIF89a'))) {
    return 'image/gif';
  }

  // Try to detect as text if it's printable ASCII/UTF-8
  if (isPrintableText(content)) {
    return 'text/plain';
  }

  return null;
}

/**
 * Check if buffer content is printable text
 */
function isPrintableText(content: Buffer): boolean {
  // Sample first 512 bytes
  const sampleSize = Math.min(content.length, 512);
  const sample = content.subarray(0, sampleSize);

  // Check if most bytes are printable ASCII or common UTF-8
  let printableCount = 0;
  for (let i = 0; i < sample.length; i++) {
    const byte = sample[i];
    // Printable ASCII range (32-126) plus newline, tab, carriage return
    if (byte !== undefined && (byte >= 32 && byte <= 126 || byte === 10 || byte === 13 || byte === 9)) {
      printableCount++;
    }
  }

  // If more than 85% are printable, consider it text
  return printableCount / sampleSize > 0.85;
}

/**
 * Get human-readable format name
 */
export function getFormatName(mimeType: string): string {
  const names: Record<string, string> = {
    'application/pdf': 'PDF Document',
    'text/plain': 'Plain Text',
    'text/markdown': 'Markdown',
    'image/png': 'PNG Image',
    'image/jpeg': 'JPEG Image',
    'image/webp': 'WebP Image',
    'image/gif': 'GIF Image',
  };

  return names[mimeType] ?? mimeType;
}

/**
 * Validate filename for safe storage
 */
export function sanitizeFilename(filename: string): string {
  // Remove path separators
  let sanitized = filename.replace(/[/\\]/g, '_');

  // Remove potentially dangerous characters
  sanitized = sanitized.replace(/[<>:"|?*\x00-\x1f]/g, '_');

  // Trim whitespace
  sanitized = sanitized.trim();

  // Limit length
  if (sanitized.length > 255) {
    const ext = extractExtension(sanitized);
    const baseName = sanitized.slice(0, 250);
    sanitized = ext ? `${baseName}.${ext}` : baseName;
  }

  return sanitized;
}