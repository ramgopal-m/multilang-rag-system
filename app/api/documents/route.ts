import { NextResponse } from "next/server"
import { getDatabase } from "@/lib/mongodb"

export async function GET() {
  try {
    console.log("📋 Fetching documents list...")
    const db = await getDatabase()
    const collection = db.collection("document_metadata")

    const documents = await collection.find({}).sort({ uploadedAt: -1 }).toArray()
    console.log(`📊 Found ${documents.length} documents in metadata collection`)

    // Log first few documents for debugging
    if (documents.length > 0) {
      console.log("📝 Sample documents:", documents.slice(0, 3).map(doc => ({
        title: doc.title,
        language: doc.language,
        chunks: doc.chunks,
        uploadedAt: doc.uploadedAt
      })))
    }

    return NextResponse.json(documents)
  } catch (error) {
    console.error("❌ Failed to fetch documents:", error)
    return NextResponse.json({ 
      error: "Failed to fetch documents",
      details: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 })
  }
}
