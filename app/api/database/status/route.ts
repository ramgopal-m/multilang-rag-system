import { NextResponse } from "next/server"
import { getDatabase } from "@/lib/mongodb"

export async function GET() {
  try {
    console.log("🔍 Checking database status...")
    const db = await getDatabase()
    
    // List all collections
    const collections = await db.listCollections().toArray()
    console.log("📋 Collections found:", collections.map(c => c.name))
    
    // Check documents collection
    const documentsCollection = db.collection("documents")
    const documentsCount = await documentsCollection.countDocuments()
    
    // Check document_metadata collection
    const metadataCollection = db.collection("document_metadata")
    const metadataCount = await metadataCollection.countDocuments()
    
    // Get sample documents if any exist
    const sampleDocuments = await documentsCollection.find({}).limit(3).toArray()
    const sampleMetadata = await metadataCollection.find({}).limit(3).toArray()
    
    // Get collection stats
    const dbStats = await db.stats()
    
    return NextResponse.json({
      status: "connected",
      database: db.databaseName,
      collections: collections.map(c => ({
        name: c.name,
        type: c.type
      })),
      counts: {
        documents: documentsCount,
        metadata: metadataCount
      },
      samples: {
        documents: sampleDocuments.map(doc => ({
          _id: doc._id,
          documentId: doc.documentId,
          chunkIndex: doc.chunkIndex,
          language: doc.language,
          contentPreview: doc.content?.slice(0, 100) + "...",
          createdAt: doc.createdAt
        })),
        metadata: sampleMetadata.map(meta => ({
          _id: meta._id,
          title: meta.title,
          language: meta.language,
          chunks: meta.chunks,
          uploadedAt: meta.uploadedAt,
          fileSize: meta.fileSize
        }))
      },
      databaseStats: {
        dataSize: dbStats.dataSize,
        storageSize: dbStats.storageSize,
        collections: dbStats.collections,
        objects: dbStats.objects
      }
    })
  } catch (error) {
    console.error("❌ Database status check failed:", error)
    return NextResponse.json({ 
      error: "Failed to check database status",
      details: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 })
  }
}
