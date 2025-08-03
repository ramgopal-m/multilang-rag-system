import { NextRequest, NextResponse } from "next/server"
import { getDatabase } from "@/lib/mongodb"
import { generateDocx, generatePdf, getContentType, getFileExtension } from "@/lib/document-generators"
import { getCachedTranslation, setCachedTranslation, getCacheStats } from "@/lib/translation-cache"

// Import Google Translate using dynamic import for compatibility
const getTranslate = async () => {
  const translate = await import('google-translate-api-x')
  return translate.default
}

// Fast translation function with caching and Google Translate as primary method
async function translateText(text: string, targetLanguage: string, sourceLanguage: string = "en"): Promise<string> {
  if (targetLanguage === sourceLanguage || !text || text.trim().length === 0) {
    return text
  }

  // Check cache first
  const cached = getCachedTranslation(text, targetLanguage, sourceLanguage)
  if (cached) {
    return cached
  }

  try {
    // Primary method: Use Google Translate API
    const translate = await getTranslate()
    const result = await translate(text, { 
      from: sourceLanguage, 
      to: targetLanguage 
    })
    
    if (result.text && result.text !== text) {
      // Cache the successful translation
      setCachedTranslation(text, result.text, targetLanguage, sourceLanguage)
      return result.text
    }
  } catch (error) {
    console.error("Google translation failed:", error)
    // Return original text if translation fails
    return text
  }
  
  return text
}

export async function POST(request: NextRequest) {
  try {
    const { documentId, targetLanguage = "en", format = "txt" } = await request.json()

    if (!documentId) {
      return NextResponse.json({ error: "Document ID is required" }, { status: 400 })
    }

    if (!targetLanguage) {
      return NextResponse.json({ error: "Target language is required" }, { status: 400 })
    }

    console.log(`🔄 Generating translated document: ${documentId} -> ${targetLanguage}`)

    // Connect to MongoDB
    const db = await getDatabase()
    const collection = db.collection("documents")
    const metadataCollection = db.collection("document_metadata")

    // Get document metadata
    const metadata = await metadataCollection.findOne({ 
      $or: [
        { title: documentId },
        { _id: documentId }
      ]
    })

    if (!metadata) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 })
    }

    // Get all chunks for this document
    const chunks = await collection.find({ 
      documentId: metadata.title 
    }).sort({ chunkIndex: 1 }).toArray()

    if (chunks.length === 0) {
      return NextResponse.json({ error: "No document chunks found" }, { status: 404 })
    }

    console.log(`📄 Found ${chunks.length} chunks for document ${metadata.title}`)

    // Check if document is too large and provide user options
    if (chunks.length > 100) {
      console.log(`⚠️ Large document detected: ${chunks.length} chunks`)
      return NextResponse.json({
        error: "Document too large for immediate translation",
        message: `This document has ${chunks.length} text chunks. Due to Google Translate rate limits, we recommend:`,
        suggestions: [
          "Try using smaller documents (under 100 chunks)",
          "Use text format instead of PDF for faster processing", 
          "Wait 10-15 minutes before retrying large documents",
          "Consider manually translating critical sections"
        ],
        fallbackOptions: {
          untranslatedDownload: true,
          message: "Download original document without translation",
          downloadUrl: `/api/documents/download?documentId=${encodeURIComponent(metadata.title)}&targetLanguage=en&format=${format}&skipTranslation=true`
        },
        documentInfo: {
          title: metadata.title,
          chunks: chunks.length,
          estimatedTime: `${Math.ceil(chunks.length * 3 / 60)} minutes`,
          language: metadata.language || "en"
        }
      }, { status: 413 })
    }

    const sourceLanguage = metadata.language || "en"
    
    // Check if translation is needed
    if (targetLanguage === sourceLanguage) {
      console.log(`📋 Same language requested (${sourceLanguage}), skipping translation`)
      const translatedChunks = chunks.map(chunk => chunk.content)
      const fullTranslatedContent = translatedChunks.join('\n\n')
      
      // Generate document directly without translation
      return await generateDocumentResponse(fullTranslatedContent, metadata, targetLanguage, sourceLanguage, format, chunks.length)
    }

    // Optimized translation strategy with caching
    const translatedChunks: string[] = []
    const cacheStats = getCacheStats()

    console.log(`🚀 Starting cached translation of ${chunks.length} chunks (cache: ${cacheStats.size} entries, ${cacheStats.hitRate.toFixed(1)}% hit rate)`)

    // Check for any rate limiting before starting
    const testTranslation = await translateText("test", targetLanguage, sourceLanguage)
    if (testTranslation === "test") {
      console.log(`⚠️ Translation service unavailable, providing fallback options`)
      return NextResponse.json({
        error: "Translation service temporarily unavailable",
        message: "Google Translate is currently rate-limited. You have several options:",
        fallbackOptions: {
          untranslatedDownload: true,
          message: "Download original document without translation",
          downloadUrl: `/api/documents/download?documentId=${encodeURIComponent(metadata.title)}&targetLanguage=en&format=${format}&skipTranslation=true`
        },
        retryOptions: {
          retryAfter: "10-15 minutes",
          message: "Translation services should be available again after the rate limit resets"
        },
        alternatives: [
          "Use a dedicated translation service like DeepL or Microsoft Translator",
          "Copy text sections manually to Google Translate", 
          "Try again later when rate limits reset",
          "Use the original document for now"
        ],
        documentInfo: {
          title: metadata.title,
          chunks: chunks.length,
          language: sourceLanguage
        }
      }, { status: 503 })
    }

    // Conservative single-chunk translation with retries
    const DELAY_BETWEEN_REQUESTS = 2000 // 2 seconds between each request
    const MAX_RETRIES = 3

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i]
      let translatedContent = chunk.content
      let retryCount = 0
      let success = false

      console.log(`⚡ Processing chunk ${i + 1}/${chunks.length}`)

      while (retryCount < MAX_RETRIES && !success) {
        try {
          translatedContent = await translateText(
            chunk.content, 
            targetLanguage, 
            sourceLanguage
          )
          success = true
          console.log(`✅ Chunk ${i + 1} translated successfully`)
        } catch (error) {
          retryCount++
          if (error instanceof Error && error.message.includes('Too Many Requests')) {
            const waitTime = retryCount * 5000 // Exponential backoff: 5s, 10s, 15s
            console.log(`🔄 Rate limit hit on chunk ${i + 1}, waiting ${waitTime/1000}s before retry ${retryCount}/${MAX_RETRIES}...`)
            await new Promise(resolve => setTimeout(resolve, waitTime))
          } else {
            console.error(`❌ Failed to translate chunk ${i + 1}:`, error)
            break
          }
        }
      }

      translatedChunks[i] = translatedContent

      // Add delay between requests to avoid rate limiting (but skip for last chunk)
      if (i < chunks.length - 1) {
        // Shorter delay if cache hit (no API call made)
        const delayTime = getCachedTranslation(chunk.content, targetLanguage, sourceLanguage) ? 100 : DELAY_BETWEEN_REQUESTS
        console.log(`⏳ Waiting ${delayTime/1000}s before next chunk...`)
        await new Promise(resolve => setTimeout(resolve, delayTime))
      }
    }

    // Combine all translated chunks
    const fullTranslatedContent = translatedChunks.join('\n\n')

    return await generateDocumentResponse(fullTranslatedContent, metadata, targetLanguage, sourceLanguage, format, chunks.length)

  } catch (error) {
    console.error("❌ Document translation error:", error)
    return NextResponse.json({ 
      error: "Failed to translate document",
      details: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 })
  }
}

// Helper function to generate document response
async function generateDocumentResponse(
  content: string, 
  metadata: any, 
  targetLanguage: string, 
  sourceLanguage: string, 
  format: string, 
  chunksCount: number
) {
  // Generate filename
  const originalName = metadata.title.replace(/\.[^/.]+$/, "") // Remove extension
  const languageNames: { [key: string]: string } = {
    "en": "English",
    "es": "Spanish", 
    "fr": "French",
    "de": "German",
    "it": "Italian",
    "pt": "Portuguese",
    "ru": "Russian",
    "zh": "Chinese",
    "ja": "Japanese",
    "ko": "Korean"
  }
  
  const languageName = languageNames[targetLanguage] || targetLanguage.toUpperCase()
  const fileExtension = getFileExtension(format)
  const translatedFileName = `${originalName}_${languageName}.${fileExtension}`

  // Prepare metadata for document generation
  const docMetadata = {
    originalDocument: metadata.title,
    originalLanguage: sourceLanguage,
    targetLanguage: targetLanguage,
    languageName: languageName,
    chunks: chunksCount,
    translatedAt: new Date().toISOString()
  }

  // Create file content based on format
  let fileContent: string | Buffer
  let contentType: string

  try {
    switch (format.toLowerCase()) {
      case 'docx':
        console.log("📄 Generating DOCX document...")
        fileContent = await generateDocx(content, docMetadata)
        contentType = getContentType('docx')
        break
        
      case 'pdf':
        console.log("📄 Generating PDF document...")
        fileContent = await generatePdf(content, docMetadata)
        contentType = getContentType('pdf')
        break
        
      case 'json':
        fileContent = JSON.stringify({
          ...docMetadata,
          content: content
        }, null, 2)
        contentType = getContentType('json')
        break
        
      case 'md':
      case 'markdown':
        fileContent = `# ${metadata.title} (${languageName})

## Document Details
- **Original Language:** ${sourceLanguage.toUpperCase()}
- **Target Language:** ${languageName} (${targetLanguage})
- **Generated At:** ${new Date().toLocaleString()}
- **Chunks:** ${chunksCount}

## Content

${content}

---
*Generated by Multilingual RAG System*`
        contentType = getContentType('md')
        break
        
      case 'txt':
      default:
        fileContent = content
        contentType = getContentType('txt')
        break
    }
  } catch (formatError) {
    console.error(`❌ Failed to generate ${format} format:`, formatError)
    // Fallback to plain text
    fileContent = content
    contentType = getContentType('txt')
  }

  console.log(`✅ Translation completed: ${chunksCount} chunks -> ${content.length} characters`)

  // Handle binary vs text content for response
  const isTextContent = typeof fileContent === 'string'
  
  return NextResponse.json({
    success: true,
    translatedFileName,
    originalDocument: metadata.title,
    originalLanguage: sourceLanguage,
    targetLanguage: targetLanguage,
    languageName: languageName,
    chunks: chunksCount,
    contentLength: content.length,
    format: format,
    contentType: contentType,
    isBinary: !isTextContent,
    // Only include content in response for text formats
    ...(isTextContent && { content: fileContent }),
    // For binary content, we'll handle download differently
    downloadUrl: isTextContent 
      ? `/api/documents/download?content=${encodeURIComponent(fileContent as string)}&filename=${encodeURIComponent(translatedFileName)}&contentType=${encodeURIComponent(contentType)}`
      : `/api/documents/download?documentId=${encodeURIComponent(metadata.title)}&targetLanguage=${targetLanguage}&format=${format}`
  })
}
