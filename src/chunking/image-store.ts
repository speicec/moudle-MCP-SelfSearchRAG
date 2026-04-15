import type { ContentPosition } from '../parsers/pdf-parser.js'
import fs from 'fs/promises'
import path from 'path'

/**
 * 图片块类型
 */
export type ImageBlockType = 'figure' | 'table' | 'formula' | 'image'

/**
 * 图片块记录
 */
export interface ImageBlockRecord {
  id: string
  documentId: string
  pageNumber: number

  // 图片数据
  imageBuffer: Buffer
  format: 'png' | 'jpeg'
  width: number
  height: number

  // OCR识别信息
  blockType: ImageBlockType
  ocrText?: string
  confidence: number

  // PDF位置信息
  position: ContentPosition

  // 像素坐标（原始OCR输出）
  bboxPx: [number, number, number, number]  // [x1, y1, x2, y2]
  scale: number

  // 关联的文本chunk
  nearbyChunkIds?: string[]

  createdAt: Date
}

/**
 * 图片存储配置
 */
export interface ImageStoreConfig {
  maxImagesPerDocument?: number
  minConfidence?: number
}

/**
 * 默认配置
 */
export const DEFAULT_IMAGE_STORE_CONFIG: ImageStoreConfig = {
  maxImagesPerDocument: 100,
  minConfidence: 0.5,
}

/**
 * 持久化文件名
 */
export const IMAGE_STORE_FILE = 'image-store.json'

/**
 * 图片数量统计
 */
export interface ImageCountResult {
  total: number
  byDocument: Record<string, number>
  byType: Record<ImageBlockType, number>
}

/**
 * ImageStore - 管理图片块存储和检索
 *
 * 支持按文档、页码、类型查询图片块
 */
export class ImageStore {
  private images: Map<string, ImageBlockRecord> = new Map()
  private documentIndex: Map<string, Set<string>> = new Map()
  private pageIndex: Map<string, Set<string>> = new Map()
  private typeIndex: Map<ImageBlockType, Set<string>> = new Map()
  private config: ImageStoreConfig

  // 持久化相关
  private storagePath?: string
  private autoSave: boolean = false
  private saveTimeout: ReturnType<typeof setTimeout> | null = null

  constructor(config?: Partial<ImageStoreConfig>) {
    this.config = { ...DEFAULT_IMAGE_STORE_CONFIG, ...config }

    // 初始化类型索引
    const types: ImageBlockType[] = ['figure', 'table', 'formula', 'image']
    for (const type of types) {
      this.typeIndex.set(type, new Set())
    }
  }

  /**
   * 添加图片块
   */
  addImage(record: ImageBlockRecord): void {
    // 检查置信度阈值
    if (record.confidence < this.config.minConfidence!) {
      console.warn(`[ImageStore] Skipping image with low confidence: ${record.confidence}`)
      return
    }

    // 存储图片
    this.images.set(record.id, record)

    // 更新文档索引
    this.addToIndex(this.documentIndex, record.documentId, record.id)

    // 更新页码索引
    const pageKey = `${record.documentId}:${record.pageNumber}`
    this.addToIndex(this.pageIndex, pageKey, record.id)

    // 更新类型索引
    this.addToIndex(this.typeIndex, record.blockType, record.id)

    console.log(`[ImageStore] Added image: ${record.id}, type=${record.blockType}, page=${record.pageNumber}`)
    this.scheduleSave()
  }

  /**
   * 辅助方法：添加到索引
   */
  private addToIndex(
    index: Map<string, Set<string>>,
    key: string,
    value: string
  ): void {
    if (!index.has(key)) {
      index.set(key, new Set())
    }
    index.get(key)!.add(value)
  }

  /**
   * 获取图片
   */
  getImage(id: string): ImageBlockRecord | undefined {
    return this.images.get(id)
  }

  /**
   * 按文档查询图片
   */
  getImagesByDocument(documentId: string): ImageBlockRecord[] {
    const ids = this.documentIndex.get(documentId)
    if (!ids) return []

    return Array.from(ids)
      .map(id => this.images.get(id))
      .filter((r): r is ImageBlockRecord => r !== undefined)
  }

  /**
   * 按页码查询图片
   */
  getImagesByPage(documentId: string, pageNumber: number): ImageBlockRecord[] {
    const pageKey = `${documentId}:${pageNumber}`
    const ids = this.pageIndex.get(pageKey)
    if (!ids) return []

    return Array.from(ids)
      .map(id => this.images.get(id))
      .filter((r): r is ImageBlockRecord => r !== undefined)
  }

  /**
   * 按多个页码查询图片
   */
  getImagesByPages(documentId: string, pages: number[]): ImageBlockRecord[] {
    const results: ImageBlockRecord[] = []

    for (const page of pages) {
      const pageImages = this.getImagesByPage(documentId, page)
      results.push(...pageImages)
    }

    return results
  }

  /**
   * 按类型查询图片
   */
  getImagesByType(blockType: ImageBlockType): ImageBlockRecord[] {
    const ids = this.typeIndex.get(blockType)
    if (!ids) return []

    return Array.from(ids)
      .map(id => this.images.get(id))
      .filter((r): r is ImageBlockRecord => r !== undefined)
  }

  /**
   * 获取适合VLM处理的图片
   * 只返回 figure, table, formula 类型
   */
  getVlmEligibleImages(documentId: string, pages?: number[]): ImageBlockRecord[] {
    let images = this.getImagesByDocument(documentId)

    if (pages && pages.length > 0) {
      images = this.getImagesByPages(documentId, pages)
    }

    // 过滤出适合VLM处理的类型
    return images.filter(img =>
      img.blockType === 'figure' ||
      img.blockType === 'table' ||
      img.blockType === 'formula'
    )
  }

  /**
   * 链接图片到附近的文本chunk
   */
  linkToNearbyChunk(imageId: string, chunkId: string): void {
    const record = this.images.get(imageId)
    if (!record) return

    if (!record.nearbyChunkIds) {
      record.nearbyChunkIds = []
    }

    if (!record.nearbyChunkIds.includes(chunkId)) {
      record.nearbyChunkIds.push(chunkId)
    }
  }

  /**
   * 获取图片数量
   */
  getImageCount(): ImageCountResult {
    const byDocument: Record<string, number> = {}
    const byType: Record<ImageBlockType, number> = {
      figure: 0,
      table: 0,
      formula: 0,
      image: 0,
    }

    for (const [docId, ids] of this.documentIndex) {
      byDocument[docId] = ids.size
    }

    for (const [type, ids] of this.typeIndex) {
      byType[type] = ids.size
    }

    return {
      total: this.images.size,
      byDocument,
      byType,
    }
  }

  /**
   * 删除图片
   */
  removeImage(id: string): void {
    const record = this.images.get(id)
    if (!record) return

    // 从所有索引中移除
    this.images.delete(id)
    this.documentIndex.get(record.documentId)?.delete(id)

    const pageKey = `${record.documentId}:${record.pageNumber}`
    this.pageIndex.get(pageKey)?.delete(id)

    this.typeIndex.get(record.blockType)?.delete(id)

    console.log(`[ImageStore] Removed image: ${id}`)
    this.scheduleSave()
  }

  /**
   * 删除文档的所有图片
   */
  removeDocumentImages(documentId: string): void {
    const ids = this.documentIndex.get(documentId)
    if (!ids) return

    for (const id of Array.from(ids)) {
      this.removeImage(id)
    }

    this.documentIndex.delete(documentId)
    console.log(`[ImageStore] Removed all images for document: ${documentId}`)
  }

  /**
   * 清空存储
   */
  clear(): void {
    this.images.clear()
    this.documentIndex.clear()
    this.pageIndex.clear()

    // 重置类型索引
    const types: ImageBlockType[] = ['figure', 'table', 'formula', 'image']
    for (const type of types) {
      this.typeIndex.set(type, new Set())
    }

    console.log('[ImageStore] Cleared all images')
    this.scheduleSave()
  }

  /**
   * 验证数据一致性
   */
  validate(): { valid: boolean; errors: string[] } {
    const errors: string[] = []

    // 检查所有图片有有效的文档引用
    for (const [id, record] of this.images) {
      if (!this.documentIndex.has(record.documentId)) {
        errors.push(`Image ${id} references missing document ${record.documentId}`)
      }
    }

    // 检查索引与存储一致
    for (const [docId, ids] of this.documentIndex) {
      for (const id of ids) {
        if (!this.images.has(id)) {
          errors.push(`Document index ${docId} references missing image ${id}`)
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    }
  }

  /**
   * 获取配置
   */
  getConfig(): ImageStoreConfig {
    return { ...this.config }
  }

  /**
   * 启用持久化
   */
  async enablePersistence(storagePath: string, autoSave: boolean = true): Promise<void> {
    this.storagePath = storagePath
    this.autoSave = autoSave

    await fs.mkdir(storagePath, { recursive: true })
    await this.load()
    console.log(`[ImageStore] Persistence enabled at ${storagePath}`)
  }

  /**
   * 保存到磁盘
   */
  async save(): Promise<void> {
    if (!this.storagePath) return

    const data = {
      version: 1,
      images: Array.from(this.images.entries()).map(([id, record]) => ({
        ...record,
        // Buffer转为base64存储
        imageBuffer: record.imageBuffer.toString('base64'),
        createdAt: record.createdAt.toISOString(),
      })),
      savedAt: new Date().toISOString(),
    }

    const filePath = path.join(this.storagePath, IMAGE_STORE_FILE)
    await fs.writeFile(filePath, JSON.stringify(data, null, 2))
    console.log(`[ImageStore] Saved ${this.images.size} images to ${filePath}`)
  }

  /**
   * 从磁盘加载
   */
  async load(): Promise<void> {
    if (!this.storagePath) return

    const filePath = path.join(this.storagePath, IMAGE_STORE_FILE)

    try {
      const content = await fs.readFile(filePath, 'utf-8')
      const data = JSON.parse(content)

      if (data.version === 1) {
        // 清空现有数据
        this.clear()

        // 加载图片
        for (const recordData of data.images) {
          const record: ImageBlockRecord = {
            ...recordData,
            // base64转回Buffer
            imageBuffer: Buffer.from(recordData.imageBuffer, 'base64'),
            createdAt: new Date(recordData.createdAt),
          }

          this.images.set(record.id, record)

          // 重建索引
          this.addToIndex(this.documentIndex, record.documentId, record.id)
          const pageKey = `${record.documentId}:${record.pageNumber}`
          this.addToIndex(this.pageIndex, pageKey, record.id)
          this.addToIndex(this.typeIndex, record.blockType, record.id)
        }

        console.log(`[ImageStore] Loaded ${this.images.size} images from ${data.savedAt}`)
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        console.warn('[ImageStore] Failed to load:', (error as Error).message)
      }
    }
  }

  /**
   * 延迟保存（自动保存触发）
   */
  private scheduleSave(): void {
    if (!this.autoSave || !this.storagePath) return

    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout)
    }

    this.saveTimeout = setTimeout(() => {
      this.save().catch(err => {
        console.error('[ImageStore] Auto-save failed:', err)
      })
    }, 1000)  // 1秒延迟
  }
}

/**
 * 创建图片存储
 */
export function createImageStore(config?: Partial<ImageStoreConfig>): ImageStore {
  return new ImageStore(config)
}