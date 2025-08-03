import { createHash } from 'crypto'

// Simple in-memory cache for translations
const translationCache = new Map<string, string>()

// Cache statistics
let cacheHits = 0
let cacheMisses = 0

/**
 * Generate a cache key from text and language pair
 */
function getCacheKey(text: string, targetLanguage: string, sourceLanguage: string): string {
  const normalizedText = text.trim().toLowerCase()
  const hash = createHash('md5').update(normalizedText).digest('hex')
  return `${sourceLanguage}-${targetLanguage}-${hash}`
}

/**
 * Get cached translation
 */
export function getCachedTranslation(text: string, targetLanguage: string, sourceLanguage: string = "en"): string | null {
  const key = getCacheKey(text, targetLanguage, sourceLanguage)
  const cached = translationCache.get(key)
  
  if (cached) {
    cacheHits++
    console.log(`📦 Cache hit: ${sourceLanguage} -> ${targetLanguage} (${cacheHits}/${cacheHits + cacheMisses})`)
    return cached
  }
  
  cacheMisses++
  return null
}

/**
 * Store translation in cache
 */
export function setCachedTranslation(text: string, translatedText: string, targetLanguage: string, sourceLanguage: string = "en"): void {
  if (!text || !translatedText || text === translatedText) {
    return
  }
  
  const key = getCacheKey(text, targetLanguage, sourceLanguage)
  translationCache.set(key, translatedText)
  console.log(`💾 Cached translation: ${sourceLanguage} -> ${targetLanguage} (cache size: ${translationCache.size})`)
}

/**
 * Get cache statistics
 */
export function getCacheStats() {
  return {
    size: translationCache.size,
    hits: cacheHits,
    misses: cacheMisses,
    hitRate: cacheHits + cacheMisses > 0 ? (cacheHits / (cacheHits + cacheMisses)) * 100 : 0
  }
}

/**
 * Clear cache
 */
export function clearCache(): void {
  translationCache.clear()
  cacheHits = 0
  cacheMisses = 0
  console.log('🗑️ Translation cache cleared')
}

/**
 * Get cache size limit (prevent memory issues)
 */
const MAX_CACHE_SIZE = 1000

/**
 * Clean cache if it gets too large (LRU-style)
 */
function cleanCacheIfNeeded(): void {
  if (translationCache.size > MAX_CACHE_SIZE) {
    const keysToDelete = Array.from(translationCache.keys()).slice(0, 100)
    keysToDelete.forEach(key => translationCache.delete(key))
    console.log(`🧹 Cache cleaned: removed ${keysToDelete.length} entries`)
  }
}

// Clean cache periodically
setInterval(cleanCacheIfNeeded, 60000) // Every minute
