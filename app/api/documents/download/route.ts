import { NextRequest, NextResponse } from "next/server";
import { getDatabase } from "@/lib/mongodb";
import { generateDocx, generatePdf, getContentType } from "@/lib/document-generators";
import { getCachedTranslation, setCachedTranslation } from "@/lib/translation-cache";

// Import Google Translate using dynamic import for compatibility
const getTranslate = async () => {
  const translate = await import('google-translate-api-x')
  return translate.default
}

// Fast translation function with caching and Google Translate as primary method
async function translateText(text: string, targetLanguage: string, sourceLanguage: string = "en"): Promise<string> {
  if (targetLanguage === sourceLanguage || !text || text.trim().length === 0) {
    return text;
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
      console.log(`🌍 Google Translate: ${sourceLanguage} -> ${targetLanguage}`)
      // Cache the successful translation
      setCachedTranslation(text, result.text, targetLanguage, sourceLanguage)
      return result.text
    }
  } catch (error) {
    console.error("Google translation failed:", error)
  }

  // Fallback: Return original text if translation fails
  console.log(`⚠️ Translation fallback: keeping original text for ${sourceLanguage} -> ${targetLanguage}`)
  return text;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    // Check for binary download parameters
    const documentId = searchParams.get("documentId");
    const targetLanguage = searchParams.get("targetLanguage");
    const format = searchParams.get("format");
    const skipTranslation = searchParams.get("skipTranslation") === "true";
    
    // If binary download parameters are present, handle binary download
    if (documentId && targetLanguage && format && (format === 'pdf' || format === 'docx')) {
      console.log(`🔄 Generating binary document: ${documentId} -> ${targetLanguage}.${format}${skipTranslation ? ' (no translation)' : ''}`);

      // Connect to MongoDB and get document
      const db = await getDatabase();
      const collection = db.collection("documents");
      const metadataCollection = db.collection("document_metadata");

      // Find the most recent document with the given title that has chunks
      const metadata = await metadataCollection.findOne(
        { title: documentId, chunks: { $gt: 0 } }, 
        { sort: { uploadedAt: -1 } }
      );
      console.log(`📋 Metadata lookup for ${documentId}:`, metadata ? `Found with ID ${metadata._id} (${metadata.chunks} chunks)` : "Not found");
      
      if (!metadata) {
        return NextResponse.json({ error: "Document not found or has no chunks" }, { status: 404 });
      }

      const chunks = await collection.find({ 
        documentId: documentId 
      }).sort({ chunkIndex: 1 }).toArray();

      console.log(`📦 Found ${chunks.length} chunks for document ${documentId}`);

      if (chunks.length === 0) {
        return NextResponse.json({ error: "No document chunks found" }, { status: 404 });
      }

      console.log(`📄 Found ${chunks.length} chunks for document ${metadata.title}`);

      // Check if document is too large for download route
      if (chunks.length > 50 && !skipTranslation) {
        console.log(`⚠️ Large document detected: ${chunks.length} chunks - redirecting to translation route`)
        return NextResponse.json({ 
          error: "Document too large for direct download",
          message: `This document has ${chunks.length} chunks. Please use the /api/documents/translate endpoint for large documents.`,
          recommendation: "Use the translation interface to process this document in smaller batches.",
          chunks: chunks.length
        }, { status: 413 })
      }

      const sourceLanguage = metadata.language || "en";
      let translatedChunks: string[] = [];

      if (skipTranslation || targetLanguage === sourceLanguage) {
        console.log(`📋 Skipping translation: using original content`)
        translatedChunks = chunks.map((chunk: any) => chunk.content);
      } else {
        console.log(`🚀 Starting cached translation of ${chunks.length} chunks...`);

        // Process chunks one by one with delays to avoid rate limiting
        for (let i = 0; i < chunks.length; i++) {
          const chunk = chunks[i];
          let retryCount = 0;
          const maxRetries = 3;
          let translatedContent = chunk.content;

          console.log(`⚡ Processing chunk ${i + 1}/${chunks.length}`);

          while (retryCount < maxRetries) {
            try {
              translatedContent = await translateText(
                chunk.content, 
                targetLanguage, 
                sourceLanguage
              );
              break;
            } catch (error) {
              retryCount++;
              if (error instanceof Error && error.message.includes('Too Many Requests')) {
                const waitTime = retryCount * 3000; // 3s, 6s, 9s
                console.log(`🔄 Rate limit hit, waiting ${waitTime/1000}s before retry ${retryCount}/${maxRetries}...`);
                await new Promise(resolve => setTimeout(resolve, waitTime));
              } else {
                console.error(`❌ Failed to translate chunk ${i + 1}:`, error);
                break;
              }
            }
          }

          translatedChunks[i] = translatedContent;

          // Add delay between chunks to avoid rate limiting
          if (i < chunks.length - 1) {
            console.log(`⏳ Waiting 2s before next chunk...`);
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
        }
      }

      const fullTranslatedContent = translatedChunks.join('\n\n');

      // Generate binary content
      let fileBuffer: Buffer;
      let contentType: string;

      const languageNames: { [key: string]: string } = {
        "en": "English", "es": "Spanish", "fr": "French", "de": "German", "it": "Italian", "pt": "Portuguese"
      };

      const translationMetadata = {
        originalDocument: metadata.title,
        targetLanguage: targetLanguage,
        languageName: languageNames[targetLanguage] || targetLanguage,
        originalLanguage: sourceLanguage
      };

      if (format === 'docx') {
        console.log('📄 Generating DOCX document...');
        fileBuffer = await generateDocx(fullTranslatedContent, translationMetadata);
        contentType = getContentType('docx');
      } else {
        console.log('📄 Generating PDF document...');
        fileBuffer = await generatePdf(fullTranslatedContent, translationMetadata);
        contentType = getContentType('pdf');
      }

      const originalName = metadata.title.replace(/\.[^/.]+$/, "");
      const translatedFileName = `${originalName}_${languageNames[targetLanguage] || targetLanguage}.${format}`;

      console.log(`✅ Binary document generated: ${translatedFileName} (${fileBuffer.length} bytes)`);

      return new NextResponse(fileBuffer, {
        status: 200,
        headers: {
          'Content-Type': contentType,
          'Content-Disposition': `attachment; filename="${translatedFileName}"`,
          'Content-Length': fileBuffer.length.toString(),
        }
      });
    }

    // Original text download logic
    const content = searchParams.get("content");
    const filename = searchParams.get("filename");
    const contentType = searchParams.get("contentType");

    if (!content || !filename) {
      return NextResponse.json(
        { error: "Missing content or filename" },
        { status: 400 }
      );
    }

    // Decode the content
    const decodedContent = decodeURIComponent(content);

    // Use provided content type or determine from file extension
    let finalContentType = contentType;
    
    if (!finalContentType) {
      const extension = filename.split(".").pop()?.toLowerCase();
      
      switch (extension) {
        case "json":
          finalContentType = "application/json";
          break;
        case "txt":
          finalContentType = "text/plain";
          break;
        case "md":
          finalContentType = "text/markdown";
          break;
        default:
          finalContentType = "text/plain";
      }
    }

    // Create response with file download headers
    const response = new NextResponse(decodedContent, {
      status: 200,
      headers: {
        "Content-Type": finalContentType || "text/plain",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": Buffer.byteLength(decodedContent, "utf8").toString(),
      },
    });

    return response;
  } catch (error) {
    console.error("❌ File download error:", error);
    return NextResponse.json(
      {
        error: "Failed to download file",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
