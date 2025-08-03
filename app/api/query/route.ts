import { NextRequest, NextResponse } from "next/server"
import { getDatabase } from "@/lib/mongodb"

// Import Google Translate using dynamic import for compatibility
const getTranslate = async () => {
  const translate = await import('google-translate-api-x')
  return translate.default
}

// Fast translation function with Google Translate as primary method
async function translateText(text: string, targetLanguage: string, sourceLanguage: string = "en"): Promise<string> {
  if (targetLanguage === sourceLanguage || !text || text.trim().length === 0) {
    return text
  }

  try {
    // Primary method: Use Google Translate API
    const translate = await getTranslate()
    const result = await translate(text, { 
      from: sourceLanguage, 
      to: targetLanguage 
    })
    
    if (result.text && result.text !== text) {
      console.log(`🌍 Google Translate success: ${sourceLanguage} -> ${targetLanguage}`)
      return result.text
    }
  } catch (error) {
    console.error("Google translation failed:", error)
  }

  // Fallback: Return original text if translation fails
  console.log(`⚠️ Translation fallback: keeping original text for ${sourceLanguage} -> ${targetLanguage}`)
  return text
}

// Simple similarity search function
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0
  
  let dotProduct = 0
  let normA = 0
  let normB = 0
  
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }
  
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB))
}

// Simple text-based similarity for fallback
function textSimilarity(query: string, text: string): number {
  const queryWords = query.toLowerCase().split(/\s+/)
  const textWords = text.toLowerCase().split(/\s+/)
  
  let matches = 0
  for (const word of queryWords) {
    if (textWords.some(textWord => textWord.includes(word) || word.includes(textWord))) {
      matches++
    }
  }
  
  return matches / queryWords.length
}

export async function POST(request: NextRequest) {
  try {
    const { query, targetLanguage = "en", maxResults = 5 } = await request.json()

    if (!query) {
      return NextResponse.json({ error: "Query is required" }, { status: 400 })
    }

    console.log(`🔍 Processing query: "${query}" -> ${targetLanguage}`)

    // Connect to MongoDB
    const db = await getDatabase()
    const collection = db.collection("documents")

    // Get all documents for simple search
    const allChunks = await collection.find({}).toArray()
    
    if (allChunks.length === 0) {
      return NextResponse.json({
        message: "No documents found in database",
        results: [],
        translatedQuery: query,
        translatedResults: []
      })
    }

    console.log(`📊 Searching through ${allChunks.length} chunks`)

    // Search using text similarity
    const searchResults = allChunks
      .map((chunk: any) => ({
        ...chunk,
        similarity: textSimilarity(query.toLowerCase(), chunk.content.toLowerCase())
      }))
      .filter((chunk: any) => chunk.similarity > 0.1) // Filter out very low similarity
      .sort((a: any, b: any) => b.similarity - a.similarity)
      .slice(0, maxResults)

    console.log(`🎯 Found ${searchResults.length} relevant chunks`)

    // Translate query if needed
    let translatedQuery = query
    if (targetLanguage !== "en") {
      translatedQuery = await translateText(query, targetLanguage, "en")
      console.log(`🌍 Query translated to ${targetLanguage}: "${translatedQuery}"`)
    }

    // Translate results if needed
    const translatedResults = []
    
    if (searchResults.length > 0) {
      console.log(`🚀 Starting translation of ${searchResults.length} results...`)
      
      for (let i = 0; i < searchResults.length; i++) {
        const chunk: any = searchResults[i]
        
        try {
          let translatedContent = chunk.content
          
          if (targetLanguage !== "en" && targetLanguage !== chunk.language) {
            translatedContent = await translateText(
              chunk.content,
              targetLanguage,
              chunk.language || "en"
            )
          }

          translatedResults.push({
            documentId: chunk.documentId,
            content: translatedContent,
            originalContent: chunk.content,
            chunkIndex: chunk.chunkIndex,
            similarity: chunk.similarity,
            language: targetLanguage
          })

          console.log(`✅ Translated result ${i + 1}/${searchResults.length}`)
        } catch (error) {
          console.error(`❌ Failed to translate result ${i + 1}:`, error)
          // Include original content if translation fails
          translatedResults.push({
            documentId: chunk.documentId,
            content: chunk.content,
            originalContent: chunk.content,
            chunkIndex: chunk.chunkIndex,
            similarity: chunk.similarity,
            language: chunk.language || "en"
          })
        }
      }
    }

    console.log(`✅ Query processing completed: ${translatedResults.length} results`)

    return NextResponse.json({
      query: query,
      translatedQuery: translatedQuery,
      targetLanguage: targetLanguage,
      results: searchResults.map((r: any) => ({
        documentId: r.documentId,
        content: r.content,
        chunkIndex: r.chunkIndex,
        similarity: r.similarity
      })),
      translatedResults: translatedResults,
      totalChunksSearched: allChunks.length,
      resultsFound: searchResults.length
    })

  } catch (error) {
    console.error("❌ Query processing error:", error)
    return NextResponse.json({ 
      error: "Failed to process query",
      details: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 })
  }
}
