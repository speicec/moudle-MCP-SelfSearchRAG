/**
 * Query Expander
 *
 * Expands queries with synonyms and related terms.
 */

import fs from 'fs/promises';
import path from 'path';
import type { ExpansionConfig, SynonymDictionary } from './types.js';
import type { EnhancedRetrievalConfig } from './config.js';
import { DEFAULT_ENHANCED_RETRIEVAL_CONFIG } from './config.js';

/**
 * Default synonym dictionary path
 */
const DEFAULT_SYNONYM_PATH = 'config/synonyms.json';

/**
 * Query Expander class
 */
export class QueryExpander {
  private config: EnhancedRetrievalConfig;
  private expansionConfig: ExpansionConfig;
  private synonyms: SynonymDictionary = {};
  private loaded: boolean = false;
  private loadPromise: Promise<void> | undefined;

  constructor(config?: Partial<EnhancedRetrievalConfig>) {
    this.config = { ...DEFAULT_ENHANCED_RETRIEVAL_CONFIG, ...config };
    this.expansionConfig = {
      maxExpandedTerms: this.config.maxExpandedTerms,
      synonymDictionaryPath: DEFAULT_SYNONYM_PATH,
    };

    // Start loading synonyms asynchronously
    this.loadPromise = this.loadSynonyms(this.expansionConfig.synonymDictionaryPath);
  }

  /**
   * Load synonym dictionary from JSON file
   */
  private async loadSynonyms(filePath: string): Promise<void> {
    try {
      const absolutePath = path.isAbsolute(filePath)
        ? filePath
        : path.join(process.cwd(), filePath);

      const content = await fs.readFile(absolutePath, 'utf-8');
      this.synonyms = JSON.parse(content);

      this.loaded = true;
      console.log('[QueryExpander] Loaded', Object.keys(this.synonyms).length, 'synonym entries');

    } catch (error) {
      // If file doesn't exist, use empty dictionary
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        console.warn('[QueryExpander] Synonym dictionary not found at:', filePath);
        this.synonyms = {};
        this.loaded = true;
      } else {
        console.error('[QueryExpander] Failed to load synonyms:', error);
        this.synonyms = {};
        this.loaded = true;
      }
    }
  }

  /**
   * Ensure synonyms are loaded before expanding
   */
  private async ensureLoaded(): Promise<void> {
    if (this.loadPromise) {
      await this.loadPromise;
    }
  }

  /**
   * Set synonym dictionary directly (for testing)
   */
  setSynonyms(synonyms: SynonymDictionary): void {
    this.synonyms = synonyms;
    this.loaded = true;
  }

  /**
   * Expand query with synonyms and related terms
   */
  async expand(query: string): Promise<string[]> {
    await this.ensureLoaded();

    const expandedTerms: string[] = [];

    // Find matching synonyms
    for (const [term, synonymList] of Object.entries(this.synonyms)) {
      if (query.includes(term)) {
        // Add matching synonyms
        for (const synonym of synonymList) {
          if (!query.includes(synonym) && !expandedTerms.includes(synonym)) {
            expandedTerms.push(synonym);
          }
        }
      }

      // Also check if query contains any synonym
      for (const synonym of synonymList) {
        if (query.includes(synonym) && !query.includes(term)) {
          // Add the main term
          if (!expandedTerms.includes(term)) {
            expandedTerms.push(term);
          }
        }
      }
    }

    // Apply expansion limit
    const limited = expandedTerms.slice(0, this.expansionConfig.maxExpandedTerms);

    console.log('[QueryExpander] Expanded', query.slice(0, 50), '→', limited.length, 'terms');

    return limited;
  }

  /**
   * Expand query and return all variants (original + expanded)
   */
  async expandWithOriginal(query: string): Promise<string[]> {
    const expanded = await this.expand(query);
    return [query, ...expanded];
  }

  /**
   * Get all synonyms for a specific term
   */
  async getSynonymsForTerm(term: string): Promise<string[]> {
    await this.ensureLoaded();

    // Direct match
    if (this.synonyms[term]) {
      return this.synonyms[term];
    }

    // Reverse lookup (term is a synonym)
    for (const [mainTerm, synonymList] of Object.entries(this.synonyms)) {
      if (synonymList.includes(term)) {
        return [mainTerm, ...synonymList.filter(s => s !== term)];
      }
    }

    return [];
  }

  /**
   * Check if a term has synonyms
   */
  async hasSynonyms(term: string): Promise<boolean> {
    await this.ensureLoaded();

    return this.synonyms[term] !== undefined ||
      Object.values(this.synonyms).some(list => list.includes(term));
  }

  /**
   * Add custom synonym entry
   */
  addSynonym(term: string, synonyms: string[]): void {
    // Merge with existing if present
    if (this.synonyms[term]) {
      const combined = [...this.synonyms[term], ...synonyms];
      this.synonyms[term] = [...new Set(combined)]; // Remove duplicates
    } else {
      this.synonyms[term] = synonyms;
    }
  }

  /**
   * Remove synonym entry
   */
  removeSynonym(term: string): void {
    delete this.synonyms[term];
  }

  /**
   * Get all loaded terms
   */
  async getAllTerms(): Promise<string[]> {
    await this.ensureLoaded();
    return Object.keys(this.synonyms);
  }

  /**
   * Get synonym statistics
   */
  async getStats(): Promise<{
    loaded: boolean;
    termCount: number;
    totalSynonyms: number;
    maxExpandedTerms: number;
  }> {
    await this.ensureLoaded();

    const totalSynonyms = Object.values(this.synonyms)
      .reduce((sum, list) => sum + list.length, 0);

    return {
      loaded: this.loaded,
      termCount: Object.keys(this.synonyms).length,
      totalSynonyms,
      maxExpandedTerms: this.expansionConfig.maxExpandedTerms,
    };
  }

  /**
   * Save synonyms to file
   */
  async saveToFile(filePath?: string): Promise<void> {
    const targetPath = filePath || this.expansionConfig.synonymDictionaryPath;
    const absolutePath = path.isAbsolute(targetPath)
      ? targetPath
      : path.join(process.cwd(), targetPath);

    await fs.mkdir(path.dirname(absolutePath), { recursive: true });
    await fs.writeFile(absolutePath, JSON.stringify(this.synonyms, null, 2));

    console.log('[QueryExpander] Saved synonyms to:', absolutePath);
  }

  /**
   * Clear loaded synonyms (reload required)
   */
  clearCache(): void {
    this.synonyms = {};
    this.loaded = false;
    this.loadPromise = undefined;
    console.log('[QueryExpander] Cache cleared');
  }

  /**
   * Get configuration
   */
  getConfig(): { enhanced: EnhancedRetrievalConfig; expansion: ExpansionConfig } {
    return {
      enhanced: { ...this.config },
      expansion: { ...this.expansionConfig },
    };
  }
}

/**
 * Create query expander instance
 */
export function createQueryExpander(
  config?: Partial<EnhancedRetrievalConfig>
): QueryExpander {
  return new QueryExpander(config);
}