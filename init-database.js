// Initialize MongoDB collections and indexes for the multilang RAG system
const { MongoClient } = require('mongodb');

async function initializeDatabase() {
  const uri = process.env.MONGODB_URI || "mongodb://localhost:27017";
  const client = new MongoClient(uri);
  
  try {
    console.log('🔄 Connecting to MongoDB...');
    await client.connect();
    
    const db = client.db(process.env.DB_NAME || "multilang_rag");
    console.log(`✅ Connected to database: ${db.databaseName}`);
    
    // Create collections if they don't exist
    console.log('📋 Setting up collections...');
    
    // Documents collection for storing chunks with embeddings
    const documentsCollection = db.collection("documents");
    
    // Document metadata collection
    const metadataCollection = db.collection("document_metadata");
    
    // Create indexes for better performance
    console.log('🔍 Creating indexes...');
    
    // Index on documentId for faster queries
    await documentsCollection.createIndex({ "documentId": 1 });
    console.log('✅ Created index on documents.documentId');
    
    // Index on language for language-specific queries
    await documentsCollection.createIndex({ "language": 1 });
    console.log('✅ Created index on documents.language');
    
    // Compound index for document and chunk
    await documentsCollection.createIndex({ "documentId": 1, "chunkIndex": 1 });
    console.log('✅ Created compound index on documents.documentId + chunkIndex');
    
    // Index on creation date
    await documentsCollection.createIndex({ "createdAt": -1 });
    console.log('✅ Created index on documents.createdAt');
    
    // Metadata collection indexes
    await metadataCollection.createIndex({ "uploadedAt": -1 });
    console.log('✅ Created index on document_metadata.uploadedAt');
    
    await metadataCollection.createIndex({ "title": 1 });
    console.log('✅ Created index on document_metadata.title');
    
    await metadataCollection.createIndex({ "language": 1 });
    console.log('✅ Created index on document_metadata.language');
    
    // Check existing collections
    const collections = await db.listCollections().toArray();
    console.log('📚 Available collections:', collections.map(c => c.name));
    
    // Get collection stats
    const docCount = await documentsCollection.countDocuments();
    const metaCount = await metadataCollection.countDocuments();
    
    console.log(`📊 Current data:`);
    console.log(`   - Documents chunks: ${docCount}`);
    console.log(`   - Document metadata: ${metaCount}`);
    
    // Create sample document if database is empty
    if (docCount === 0 && metaCount === 0) {
      console.log('📝 Database is empty, creating sample data...');
      
      const sampleDoc = {
        documentId: "sample.txt",
        chunkIndex: 0,
        content: "This is a sample document chunk for testing the multilingual RAG system.",
        language: "en",
        embedding: Array(384).fill(0).map(() => Math.random()), // Random 384-dim vector
        createdAt: new Date()
      };
      
      const sampleMeta = {
        title: "sample.txt",
        language: "en",
        chunks: 1,
        uploadedAt: new Date(),
        fileSize: 69,
        status: "completed"
      };
      
      await documentsCollection.insertOne(sampleDoc);
      await metadataCollection.insertOne(sampleMeta);
      
      console.log('✅ Sample data created');
    }
    
    console.log('🎉 Database initialization completed successfully!');
    
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    process.exit(1);
  } finally {
    await client.close();
    console.log('🔒 Connection closed');
  }
}

// Run initialization if this script is executed directly
if (require.main === module) {
  initializeDatabase();
}

module.exports = { initializeDatabase };
