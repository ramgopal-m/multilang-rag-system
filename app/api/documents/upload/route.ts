import { type NextRequest, NextResponse } from "next/server"
import { getDatabase } from "@/lib/mongodb"
import { HfInference } from "@huggingface/inference"

const hf = new HfInference(process.env.HUGGINGFACE_API_KEY)

// Language detection using Hugging Face
async function detectLanguage(text: string): Promise<string> {
  try {
    const result = await hf.textClassification({
      model: "facebook/fasttext-language-identification",
      inputs: text.slice(0, 512), // Use first 512 chars for detection
    })
    return result[0]?.label?.replace("__label__", "") || "en"
  } catch (error) {
    console.error("Language detection failed:", error)
    console.log("🔄 Using fallback: simple language detection")
    
    // Fallback: Simple language detection based on common words
    const englishWords = ['the', 'and', 'is', 'in', 'to', 'of', 'a', 'that', 'it', 'with', 'for', 'as', 'was', 'on', 'are', 'you']
    const spanishWords = ['el', 'la', 'de', 'que', 'y', 'en', 'un', 'es', 'se', 'no', 'te', 'lo', 'le', 'da', 'su', 'por']
    const frenchWords = ['le', 'de', 'et', 'à', 'un', 'il', 'être', 'et', 'en', 'avoir', 'que', 'pour', 'dans', 'ce', 'son', 'une']
    
    const lowerText = text.toLowerCase()
    const englishCount = englishWords.filter(word => lowerText.includes(' ' + word + ' ')).length
    const spanishCount = spanishWords.filter(word => lowerText.includes(' ' + word + ' ')).length
    const frenchCount = frenchWords.filter(word => lowerText.includes(' ' + word + ' ')).length
    
    if (spanishCount > englishCount && spanishCount > frenchCount) return "es"
    if (frenchCount > englishCount && frenchCount > spanishCount) return "fr"
    return "en" // Default to English
  }
}

// Generate embeddings using multilingual model
async function generateEmbedding(text: string): Promise<number[]> {
  try {
    const result = await hf.featureExtraction({
      model: "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2",
      inputs: text,
    })
    // Handle both single array and nested array responses
    if (Array.isArray(result) && Array.isArray(result[0])) {
      return result[0] as number[]
    }
    return result as number[]
  } catch (error) {
    console.error("Embedding generation failed:", error)
    console.error("Error details:", error)
    
    // Check if it's a permission error or any Hugging Face API error
    const errorMessage = error instanceof Error ? error.message : String(error)
    const isHfError = errorMessage.includes('permissions') || 
                     errorMessage.includes('authentication') ||
                     errorMessage.includes('sufficient permissions') ||
                     error?.constructor?.name?.includes('Inference')
    
    if (isHfError) {
      console.log("🔄 Using fallback: simple text-based embedding")
      // Fallback: Create a simple hash-based embedding
      return generateSimpleEmbedding(text)
    }
    
    throw error
  }
}

// Fallback embedding function using simple text features
function generateSimpleEmbedding(text: string): number[] {
  const words = text.toLowerCase().split(/\s+/)
  const embedding = new Array(384).fill(0)
  
  // Simple features based on text characteristics
  embedding[0] = text.length / 1000 // Text length feature
  embedding[1] = words.length / 100 // Word count feature
  embedding[2] = (text.match(/[.!?]/g) || []).length / 10 // Sentence count
  embedding[3] = (text.match(/[A-Z]/g) || []).length / text.length // Capital ratio
  embedding[4] = (text.match(/\d/g) || []).length / text.length // Number ratio
  
  // Character frequency features (simplified)
  for (let i = 0; i < Math.min(words.length, 100); i++) {
    const word = words[i]
    const hash = simpleHash(word) % 200
    embedding[hash + 50] += 1 / words.length
  }
  
  // Normalize to unit vector
  const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0))
  return magnitude > 0 ? embedding.map(val => val / magnitude) : embedding
}

// Simple hash function for words
function simpleHash(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32-bit integer
  }
  return Math.abs(hash)
}

// Chunk text into smaller pieces
function chunkText(text: string, maxChunkSize = 500): string[] {
  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0)
  const chunks: string[] = []
  let currentChunk = ""

  for (const sentence of sentences) {
    if (currentChunk.length + sentence.length > maxChunkSize && currentChunk.length > 0) {
      chunks.push(currentChunk.trim())
      currentChunk = sentence
    } else {
      currentChunk += (currentChunk ? ". " : "") + sentence
    }
  }

  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim())
  }

  return chunks
}

export async function POST(request: NextRequest) {
  try {
    console.log("📁 Starting file upload process...")
    
    const formData = await request.formData()
    const file = formData.get("file") as File
    const specifiedLanguage = formData.get("language") as string

    if (!file) {
      console.error("❌ No file provided")
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    console.log(`📄 Processing file: ${file.name} (${file.size} bytes)`)

    // Read file content
    const content = await file.text()
    console.log(`📝 File content length: ${content.length} characters`)

    // Detect language
    console.log("🔍 Detecting language...")
    const detectedLanguage = await detectLanguage(content)
    const language = specifiedLanguage || detectedLanguage
    console.log(`🌍 Language detected/specified: ${language}`)

    // Chunk the content
    console.log("✂️ Chunking content...")
    const chunks = chunkText(content)
    console.log(`📚 Created ${chunks.length} chunks`)

    // Connect to MongoDB
    console.log("🔌 Connecting to MongoDB...")
    const db = await getDatabase()
    const collection = db.collection("documents")
    const metaCollection = db.collection("document_metadata")

    // Process each chunk
    console.log("🧠 Generating embeddings for chunks...")
    const processedChunks = []
    for (let i = 0; i < chunks.length; i++) {
      console.log(`Processing chunk ${i + 1}/${chunks.length}`)
      const chunk = chunks[i]
      const embedding = await generateEmbedding(chunk)

      processedChunks.push({
        documentId: file.name,
        chunkIndex: i,
        content: chunk,
        language: language,
        embedding: embedding,
        createdAt: new Date(),
      })
    }

    // Insert into MongoDB
    console.log("💾 Saving chunks to MongoDB...")
    const chunksResult = await collection.insertMany(processedChunks)
    console.log(`✅ Inserted ${chunksResult.insertedCount} chunks with IDs:`, Object.values(chunksResult.insertedIds))

    // Store document metadata
    console.log("📊 Saving document metadata...")
    const metaResult = await metaCollection.insertOne({
      title: file.name,
      language: language,
      chunks: chunks.length,
      uploadedAt: new Date(),
      fileSize: file.size,
      status: "completed"
    })
    console.log(`✅ Metadata saved with ID: ${metaResult.insertedId}`)

    // Verify data was saved
    const savedChunksCount = await collection.countDocuments({ documentId: file.name })
    const savedMeta = await metaCollection.findOne({ _id: metaResult.insertedId })
    
    console.log(`🔍 Verification - Chunks in DB: ${savedChunksCount}, Metadata found: ${!!savedMeta}`)

    return NextResponse.json({
      success: true,
      language: language,
      chunks: chunks.length,
      chunksInserted: chunksResult.insertedCount,
      metadataId: metaResult.insertedId,
      message: "Document processed and stored successfully",
    })
  } catch (error) {
    console.error("❌ Upload error:", error)
    return NextResponse.json({ 
      error: "Failed to process document", 
      details: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 })
  }
}
