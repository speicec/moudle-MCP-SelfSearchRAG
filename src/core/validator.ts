import type { Document } from './document.js';
import { isSupportedFormat } from './document.js';

/**
 * Validation error
 */
export interface ValidationError {
  field: string;
  message: string;
  value?: unknown;
}

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

/**
 * Document validator configuration
 */
export interface ValidatorConfig {
  maxFileSizeBytes: number;
  minFileSizeBytes: number;
  allowedMimeTypes: string[];
}

/**
 * Default validator configuration
 */
export const DEFAULT_VALIDATOR_CONFIG: ValidatorConfig = {
  maxFileSizeBytes: 50 * 1024 * 1024, // 50MB
  minFileSizeBytes: 1, // Minimum 1 byte
  allowedMimeTypes: [
    'application/pdf',
    'text/plain',
    'image/png',
    'image/jpeg',
    'image/webp',
  ],
};

/**
 * Document validator
 */
export class DocumentValidator {
  private config: ValidatorConfig;

  constructor(config: Partial<ValidatorConfig> = {}) {
    this.config = {
      ...DEFAULT_VALIDATOR_CONFIG,
      ...config,
    };
  }

  /**
   * Validate a document
   */
  validate(document: Document): ValidationResult {
    const errors: ValidationError[] = [];

    // Validate MIME type
    const mimeTypeError = this.validateMimeType(document);
    if (mimeTypeError) {
      errors.push(mimeTypeError);
    }

    // Validate file size
    const sizeError = this.validateFileSize(document);
    if (sizeError) {
      errors.push(sizeError);
    }

    // Validate content exists
    const contentError = this.validateContent(document);
    if (contentError) {
      errors.push(contentError);
    }

    // Validate PDF structure if applicable
    if (document.metadata.format === 'pdf') {
      const pdfError = this.validatePdfStructure(document);
      if (pdfError) {
        errors.push(pdfError);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validate MIME type is supported
   */
  private validateMimeType(document: Document): ValidationError | null {
    const mimeType = document.metadata.mimeType;

    if (!mimeType) {
      return {
        field: 'mimeType',
        message: 'MIME type is required',
      };
    }

    if (!this.config.allowedMimeTypes.includes(mimeType)) {
      return {
        field: 'mimeType',
        message: `Unsupported MIME type: ${mimeType}. Allowed types: ${this.config.allowedMimeTypes.join(', ')}`,
        value: mimeType,
      };
    }

    return null;
  }

  /**
   * Validate file size within limits
   */
  private validateFileSize(document: Document): ValidationError | null {
    const size = document.metadata.sizeBytes;

    if (size < this.config.minFileSizeBytes) {
      return {
        field: 'sizeBytes',
        message: `File size ${size} bytes is below minimum ${this.config.minFileSizeBytes} bytes`,
        value: size,
      };
    }

    if (size > this.config.maxFileSizeBytes) {
      return {
        field: 'sizeBytes',
        message: `File size ${size} bytes exceeds maximum ${this.config.maxFileSizeBytes} bytes (${this.config.maxFileSizeBytes / (1024 * 1024)}MB)`,
        value: size,
      };
    }

    return null;
  }

  /**
   * Validate content exists and is not empty
   */
  private validateContent(document: Document): ValidationError | null {
    const content = document.content;

    if (!content) {
      return {
        field: 'content',
        message: 'Document content is required',
      };
    }

    const contentLength = typeof content === 'string'
      ? content.length
      : content.length;

    if (contentLength === 0) {
      return {
        field: 'content',
        message: 'Document content cannot be empty',
      };
    }

    return null;
  }

  /**
   * Validate PDF structure (basic check)
   */
  private validatePdfStructure(document: Document): ValidationError | null {
    const content = document.content;

    if (typeof content === 'string') {
      return {
        field: 'content',
        message: 'PDF content must be Buffer, not string',
      };
    }

    // Check for PDF header signature
    const pdfHeader = Buffer.from('%PDF-');
    const headerMatch = content.subarray(0, 5).equals(pdfHeader);

    if (!headerMatch) {
      return {
        field: 'content',
        message: 'Invalid PDF structure: missing PDF header signature',
      };
    }

    // Check for PDF EOF marker
    const eofMarker = Buffer.from('%%EOF');
    const lastBytes = content.subarray(Math.max(0, content.length - 10));
    const eofMatch = lastBytes.toString().includes('%%EOF');

    if (!eofMatch) {
      return {
        field: 'content',
        message: 'Invalid PDF structure: missing EOF marker',
      };
    }

    return null;
  }

  /**
   * Quick validation check
   */
  isValid(document: Document): boolean {
    return this.validate(document).valid;
  }

  /**
   * Assert document is valid (throws on error)
   */
  assertValid(document: Document): void {
    const result = this.validate(document);
    if (!result.valid) {
      const messages = result.errors.map(e => `${e.field}: ${e.message}`).join('\n');
      throw new Error(`Document validation failed:\n${messages}`);
    }
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<ValidatorConfig>): void {
    this.config = {
      ...this.config,
      ...config,
    };
  }
}

/**
 * Create a validator with default configuration
 */
export function createValidator(config?: Partial<ValidatorConfig>): DocumentValidator {
  return new DocumentValidator(config);
}

/**
 * Quick validation function
 */
export function validateDocument(
  document: Document,
  config?: Partial<ValidatorConfig>
): ValidationResult {
  const validator = new DocumentValidator(config);
  return validator.validate(document);
}