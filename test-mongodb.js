// Test MongoDB connection
const { MongoClient } = require('mongodb');

async function testConnection() {
  const uri = process.env.MONGODB_URI || "mongodb://localhost:27017";
  const client = new MongoClient(uri);

  try {
    console.log('🔄 Attempting to connect to MongoDB...');
    await client.connect();
    console.log('✅ Connected successfully to MongoDB!');

    // Test database access
    const db = client.db("multilang_rag");
    const collections = await db.listCollections().toArray();
    console.log(`📊 Found ${collections.length} collections in database`);

    // Test creating a collection and inserting a document
    const testCollection = db.collection("connection_test");
    const testDoc = {
      message: "MongoDB connection test successful!",
      timestamp: new Date(),
      version: "1.0.0"
    };

    const result = await testCollection.insertOne(testDoc);
    console.log(`📝 Test document inserted with ID: ${result.insertedId}`);

    // Test reading the document back
    const retrievedDoc = await testCollection.findOne({ _id: result.insertedId });
    console.log('📖 Retrieved document:', retrievedDoc);

    // Clean up - delete test document
    await testCollection.deleteOne({ _id: result.insertedId });
    console.log('🗑️ Test document cleaned up');

    console.log('🎉 MongoDB connection test completed successfully!');

  } catch (error) {
    console.error('❌ MongoDB connection failed:', error);
    process.exit(1);
  } finally {
    await client.close();
    console.log('🔒 Connection closed');
  }
}

// Run the test
if (require.main === module) {
  testConnection();
}

module.exports = { testConnection };