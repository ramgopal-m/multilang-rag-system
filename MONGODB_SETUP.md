# MongoDB Setup Guide for Multilang RAG System

## Overview
This guide helps you set up MongoDB for the multilang RAG system, which stores document embeddings and metadata for multilingual retrieval-augmented generation.

## Prerequisites
- Node.js 18+ installed
- MongoDB database (local or MongoDB Atlas)

## Setup Options

### Option 1: Local MongoDB Installation

1. **Install MongoDB Community Server**
   - Download from [MongoDB Downloads](https://www.mongodb.com/try/download/community)
   - Follow installation instructions for your operating system
   - Start MongoDB service

2. **Configure Environment Variables**
   ```bash
   # In .env.local
   MONGODB_URI=mongodb://localhost:27017
   DB_NAME=multilang_rag
   ```

### Option 2: MongoDB Atlas (Cloud)

1. **Create MongoDB Atlas Account**
   - Go to [MongoDB Atlas](https://www.mongodb.com/atlas)
   - Create a free account
   - Create a new cluster

2. **Get Connection String**
   - Click "Connect" on your cluster
   - Choose "Connect your application"
   - Copy the connection string

3. **Configure Environment Variables**
   ```bash
   # In .env.local
   MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/multilang_rag
   DB_NAME=multilang_rag
   ```

## Database Schema

The system uses the following collections:

### 1. `documents` Collection
Stores document chunks with embeddings:
```javascript
{
  _id: ObjectId,
  documentId: "filename.txt",
  chunkIndex: 0,
  content: "Document text content...",
  language: "en",
  embedding: [0.1, 0.2, ...], // 384-dimensional vector
  createdAt: Date
}
```

### 2. `document_metadata` Collection
Stores document metadata:
```javascript
{
  _id: ObjectId,
  title: "filename.txt",
  language: "en",
  chunks: 5,
  uploadedAt: Date,
  fileSize: 1024
}
```

## Testing Connection

Run the test script to verify your MongoDB connection:

```bash
npm run test-db
```

Expected output:
```
🔄 Attempting to connect to MongoDB...
✅ Connected successfully to MongoDB!
📊 Found X collections in database
📝 Test document inserted with ID: ...
📖 Retrieved document: {...}
🗑️ Test document cleaned up
🎉 MongoDB connection test completed successfully!
🔒 Connection closed
```

## Configuration Files

### Environment Variables (`.env.local`)
```bash
# MongoDB Configuration
MONGODB_URI=mongodb://localhost:27017
DB_NAME=multilang_rag
MONGODB_OPTIONS=retryWrites=true&w=majority

# Hugging Face API (for embeddings)
HUGGINGFACE_API_KEY=your_huggingface_api_key_here
```

### MongoDB Connection Utility (`lib/mongodb.ts`)
- Handles connection pooling
- Provides database helper functions
- Manages connection lifecycle

## API Endpoints

### Upload Documents: `POST /api/documents/upload`
- Processes text files
- Generates embeddings
- Stores in MongoDB with language detection

### Query Documents: `POST /api/query`
- Searches similar documents
- Returns relevant results with similarity scores

### List Documents: `GET /api/documents`
- Retrieves document metadata
- Shows uploaded files and their stats

## Vector Search Setup (Optional)

For better performance with large datasets, create a vector search index:

```javascript
// MongoDB Atlas Vector Search Index
{
  "fields": [
    {
      "type": "vector",
      "path": "embedding",
      "numDimensions": 384,
      "similarity": "cosine"
    }
  ]
}
```

## Troubleshooting

### Common Issues

1. **Connection Failed**
   - Check if MongoDB is running
   - Verify connection string
   - Check firewall settings

2. **Authentication Error**
   - Verify username/password
   - Check IP whitelist in Atlas

3. **Database Not Found**
   - Database is created automatically on first insert
   - Check DB_NAME environment variable

### Error Logging
Check the application logs for detailed error messages:
- Connection errors
- Authentication issues
- Query failures

## Performance Optimization

1. **Indexing**
   ```javascript
   // Create indexes for better query performance
   db.documents.createIndex({ "documentId": 1 })
   db.documents.createIndex({ "language": 1 })
   db.document_metadata.createIndex({ "uploadedAt": -1 })
   ```

2. **Connection Pooling**
   - The `lib/mongodb.ts` utility handles connection pooling
   - Reuses connections in production
   - Properly closes connections

3. **Memory Management**
   - Large embeddings are handled efficiently
   - Chunked document processing
   - Cleanup of temporary data

## Security Best Practices

1. **Environment Variables**
   - Never commit `.env.local` to version control
   - Use strong passwords for database users
   - Rotate API keys regularly

2. **Network Security**
   - Use TLS/SSL for connections
   - Whitelist IP addresses in Atlas
   - Implement proper authentication

3. **Data Validation**
   - Input sanitization
   - Schema validation
   - Error handling

## Scaling Considerations

1. **Horizontal Scaling**
   - MongoDB Atlas auto-scaling
   - Sharding for large datasets
   - Read replicas for better performance

2. **Vertical Scaling**
   - Increase instance size
   - More RAM for embeddings
   - Faster storage (SSD)

## Backup and Recovery

1. **MongoDB Atlas**
   - Automatic backups enabled
   - Point-in-time recovery
   - Cross-region backups

2. **Local MongoDB**
   - Regular `mongodump` exports
   - Automated backup scripts
   - Test restore procedures

## Next Steps

After setting up MongoDB:

1. Configure Hugging Face API key
2. Upload your first document
3. Test multilingual queries
4. Monitor performance metrics
5. Set up production deployment

For additional help, refer to the main README.md or create an issue in the repository.
