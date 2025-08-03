// Test script to upload a sample document
const fs = require('fs');
const path = require('path');

async function testUpload() {
  try {
    // Create a sample text file
    const sampleContent = `
This is a sample document for testing the multilingual RAG system.
This document contains multiple sentences to test the chunking functionality.
The system should detect the language as English and generate embeddings for each chunk.
Each chunk will be stored in MongoDB with its corresponding embedding vector.
This allows for semantic search across documents in multiple languages.
`;

    console.log('🚀 Testing document upload...');
    
    // Create FormData
    const formData = new FormData();
    const blob = new Blob([sampleContent], { type: 'text/plain' });
    const file = new File([blob], 'sample-document.txt', { type: 'text/plain' });
    
    formData.append('file', file);
    formData.append('language', 'en'); // Optional: specify language
    
    // Send POST request to upload endpoint
    const response = await fetch('http://localhost:3000/api/documents/upload', {
      method: 'POST',
      body: formData
    });
    
    const result = await response.json();
    
    if (response.ok) {
      console.log('✅ Upload successful!');
      console.log('📊 Result:', JSON.stringify(result, null, 2));
    } else {
      console.error('❌ Upload failed:');
      console.error('📊 Error:', JSON.stringify(result, null, 2));
    }
    
    // Check database status
    console.log('\n🔍 Checking database status...');
    const statusResponse = await fetch('http://localhost:3000/api/database/status');
    const statusResult = await statusResponse.json();
    
    if (statusResponse.ok) {
      console.log('📋 Database Status:', JSON.stringify(statusResult, null, 2));
    } else {
      console.error('❌ Status check failed:', statusResult);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test if this script is executed directly
if (require.main === module) {
  console.log('📝 Make sure your Next.js development server is running on http://localhost:3000');
  console.log('   Run: npm run dev');
  console.log('');
  
  // Check if server is running
  fetch('http://localhost:3000/api/database/status')
    .then(() => {
      console.log('✅ Server is running, starting test...\n');
      testUpload();
    })
    .catch(() => {
      console.error('❌ Server is not running. Please start it with: npm run dev');
    });
}

module.exports = { testUpload };
