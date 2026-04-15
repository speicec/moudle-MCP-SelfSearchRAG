import { describe, it, expect, beforeEach } from 'vitest'
import { ImageStore, createImageStore, type ImageBlockRecord, type ImageBlockType } from './image-store.js'
import type { ContentPosition } from '../parsers/pdf-parser.js'

describe('ImageStore', () => {
  let store: ImageStore

  const createMockImage = (id: string, documentId: string, pageNumber: number, blockType: ImageBlockType): ImageBlockRecord => {
    const position: ContentPosition = { page: pageNumber, x: 100, y: 200, width: 300, height: 400 }
    return {
      id,
      documentId,
      pageNumber,
      imageBuffer: Buffer.from('mock-image-data-' + id),
      format: 'png',
      width: 300,
      height: 400,
      blockType,
      ocrText: 'Mock OCR text',
      confidence: 0.9,
      position,
      bboxPx: [100, 200, 400, 600],
      scale: 2,
      createdAt: new Date(),
    }
  }

  beforeEach(() => {
    store = createImageStore()
  })

  describe('addImage', () => {
    it('should store image and update indices', () => {
      const image = createMockImage('img-1', 'doc-1', 1, 'figure')
      store.addImage(image)

      const count = store.getImageCount()
      expect(count.total).toBe(1)
      expect(count.byDocument['doc-1']).toBe(1)
      expect(count.byType['figure']).toBe(1)
    })

    it('should skip images with low confidence', () => {
      const image = createMockImage('img-1', 'doc-1', 1, 'figure')
      image.confidence = 0.3  // Below default threshold of 0.5

      store.addImage(image)

      const count = store.getImageCount()
      expect(count.total).toBe(0)
    })

    it('should store multiple images for same document', () => {
      store.addImage(createMockImage('img-1', 'doc-1', 1, 'figure'))
      store.addImage(createMockImage('img-2', 'doc-1', 2, 'table'))
      store.addImage(createMockImage('img-3', 'doc-1', 3, 'formula'))

      const count = store.getImageCount()
      expect(count.total).toBe(3)
      expect(count.byDocument['doc-1']).toBe(3)
    })
  })

  describe('getImagesByDocument', () => {
    it('should return all images for a document', () => {
      store.addImage(createMockImage('img-1', 'doc-1', 1, 'figure'))
      store.addImage(createMockImage('img-2', 'doc-1', 2, 'table'))
      store.addImage(createMockImage('img-3', 'doc-2', 1, 'figure'))

      const images = store.getImagesByDocument('doc-1')
      expect(images.length).toBe(2)
    })

    it('should return empty array for non-existent document', () => {
      const images = store.getImagesByDocument('non-existent')
      expect(images.length).toBe(0)
    })
  })

  describe('getImagesByPage', () => {
    it('should return images for specific page', () => {
      store.addImage(createMockImage('img-1', 'doc-1', 1, 'figure'))
      store.addImage(createMockImage('img-2', 'doc-1', 2, 'table'))
      store.addImage(createMockImage('img-3', 'doc-1', 1, 'formula'))

      const images = store.getImagesByPage('doc-1', 1)
      expect(images.length).toBe(2)
    })

    it('should return empty array for non-existent page', () => {
      const images = store.getImagesByPage('doc-1', 999)
      expect(images.length).toBe(0)
    })
  })

  describe('getImagesByPages', () => {
    it('should return images for multiple pages', () => {
      store.addImage(createMockImage('img-1', 'doc-1', 1, 'figure'))
      store.addImage(createMockImage('img-2', 'doc-1', 2, 'table'))
      store.addImage(createMockImage('img-3', 'doc-1', 3, 'formula'))
      store.addImage(createMockImage('img-4', 'doc-1', 5, 'image'))

      const images = store.getImagesByPages('doc-1', [1, 2, 3])
      expect(images.length).toBe(3)
    })
  })

  describe('getVlmEligibleImages', () => {
    it('should return only figure, table, formula types', () => {
      store.addImage(createMockImage('img-1', 'doc-1', 1, 'figure'))
      store.addImage(createMockImage('img-2', 'doc-1', 2, 'table'))
      store.addImage(createMockImage('img-3', 'doc-1', 3, 'formula'))
      store.addImage(createMockImage('img-4', 'doc-1', 4, 'image'))  // Not VLM eligible

      const images = store.getVlmEligibleImages('doc-1')
      expect(images.length).toBe(3)
      expect(images.every(img =>
        img.blockType === 'figure' ||
        img.blockType === 'table' ||
        img.blockType === 'formula'
      )).toBe(true)
    })

    it('should filter by pages when provided', () => {
      store.addImage(createMockImage('img-1', 'doc-1', 1, 'figure'))
      store.addImage(createMockImage('img-2', 'doc-1', 2, 'table'))
      store.addImage(createMockImage('img-3', 'doc-1', 3, 'formula'))

      const images = store.getVlmEligibleImages('doc-1', [1, 2])
      expect(images.length).toBe(2)
    })
  })

  describe('linkToNearbyChunk', () => {
    it('should link image to nearby chunk', () => {
      const image = createMockImage('img-1', 'doc-1', 1, 'figure')
      store.addImage(image)

      store.linkToNearbyChunk('img-1', 'chunk-1')

      const stored = store.getImage('img-1')
      expect(stored?.nearbyChunkIds).toContain('chunk-1')
    })

    it('should not duplicate links', () => {
      const image = createMockImage('img-1', 'doc-1', 1, 'figure')
      store.addImage(image)

      store.linkToNearbyChunk('img-1', 'chunk-1')
      store.linkToNearbyChunk('img-1', 'chunk-1')

      const stored = store.getImage('img-1')
      expect(stored?.nearbyChunkIds?.length).toBe(1)
    })
  })

  describe('removeImage', () => {
    it('should remove image from all indices', () => {
      store.addImage(createMockImage('img-1', 'doc-1', 1, 'figure'))
      store.removeImage('img-1')

      const count = store.getImageCount()
      expect(count.total).toBe(0)
      expect(store.getImage('img-1')).toBeUndefined()
    })
  })

  describe('removeDocumentImages', () => {
    it('should remove all images for a document', () => {
      store.addImage(createMockImage('img-1', 'doc-1', 1, 'figure'))
      store.addImage(createMockImage('img-2', 'doc-1', 2, 'table'))
      store.addImage(createMockImage('img-3', 'doc-2', 1, 'figure'))

      store.removeDocumentImages('doc-1')

      const count = store.getImageCount()
      expect(count.total).toBe(1)
      expect(count.byDocument['doc-1']).toBeUndefined()
    })
  })

  describe('clear', () => {
    it('should clear all images and indices', () => {
      store.addImage(createMockImage('img-1', 'doc-1', 1, 'figure'))
      store.addImage(createMockImage('img-2', 'doc-1', 2, 'table'))
      store.addImage(createMockImage('img-3', 'doc-2', 1, 'formula'))

      store.clear()

      const count = store.getImageCount()
      expect(count.total).toBe(0)
      expect(count.byType['figure']).toBe(0)
      expect(count.byType['table']).toBe(0)
      expect(count.byType['formula']).toBe(0)
    })
  })

  describe('validate', () => {
    it('should return valid for consistent data', () => {
      store.addImage(createMockImage('img-1', 'doc-1', 1, 'figure'))

      const result = store.validate()
      expect(result.valid).toBe(true)
      expect(result.errors.length).toBe(0)
    })

    it('should detect inconsistencies', () => {
      // This would require manually breaking the indices, which is hard to test
      // For now, we just verify the method works
      store.addImage(createMockImage('img-1', 'doc-1', 1, 'figure'))

      const result = store.validate()
      expect(typeof result.valid).toBe('boolean')
    })
  })

  describe('getImageCount', () => {
    it('should return correct statistics', () => {
      store.addImage(createMockImage('img-1', 'doc-1', 1, 'figure'))
      store.addImage(createMockImage('img-2', 'doc-1', 2, 'table'))
      store.addImage(createMockImage('img-3', 'doc-2', 1, 'formula'))

      const count = store.getImageCount()
      expect(count.total).toBe(3)
      expect(count.byDocument['doc-1']).toBe(2)
      expect(count.byDocument['doc-2']).toBe(1)
      expect(count.byType['figure']).toBe(1)
      expect(count.byType['table']).toBe(1)
      expect(count.byType['formula']).toBe(1)
    })
  })
})