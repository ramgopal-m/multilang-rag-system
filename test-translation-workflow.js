/**
 * Test Document Translation Workflow
 * This script demonstrates the complete process:
 * 1. Upload a document
 * 2. Translate it to multiple languages
 * 3. Download the translated files
 */

const fs = require('fs');
const path = require('path');

// Test document content
const testContent = `This is a comprehensive test document for the multilingual RAG system.

The system supports document upload, processing, and translation into multiple languages.

Key features include:
- Automatic language detection
- Text chunking for better processing
- Vector embedding generation
- Semantic search across documents
- Real-time translation to user's preferred language

This enables users to work with documents in any language while getting responses in their preferred language.

The system uses advanced AI models for translation including Helsinki-NLP and mBART models.`;

async function testTranslationWorkflow() {
    const baseUrl = 'http://localhost:3000';
    
    console.log('🚀 Starting Document Translation Workflow Test\n');
    
    try {
        // Step 1: Create a test document
        const testFileName = 'comprehensive-test.txt';
        const testFilePath = path.join(__dirname, testFileName);
        fs.writeFileSync(testFilePath, testContent);
        console.log(`✅ Created test document: ${testFileName}`);
        
        // Step 2: Upload the document
        console.log('\n📤 Uploading document...');
        const FormData = require('form-data');
        const formData = new FormData();
        formData.append('file', fs.createReadStream(testFilePath));
        
        const uploadResponse = await fetch(`${baseUrl}/api/documents/upload`, {
            method: 'POST',
            body: formData
        });
        
        const uploadResult = await uploadResponse.json();
        if (uploadResponse.ok) {
            console.log(`✅ Upload successful:`, uploadResult);
        } else {
            throw new Error(`Upload failed: ${uploadResult.error}`);
        }
        
        // Step 3: Translate to multiple languages
        const languages = [
            { code: 'es', name: 'Spanish' },
            { code: 'fr', name: 'French' },
            { code: 'de', name: 'German' }
        ];
        
        console.log('\n🌐 Translating to multiple languages...');
        
        for (const lang of languages) {
            console.log(`\n🔄 Translating to ${lang.name}...`);
            
            const translateResponse = await fetch(`${baseUrl}/api/documents/translate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    documentId: testFileName,
                    targetLanguage: lang.code,
                    format: 'txt'
                })
            });
            
            const translateResult = await translateResponse.json();
            
            if (translateResponse.ok) {
                console.log(`✅ ${lang.name} translation completed:`);
                console.log(`   📄 File: ${translateResult.translatedFileName}`);
                console.log(`   📊 Length: ${translateResult.contentLength} characters`);
                console.log(`   🔗 Download: ${translateResult.downloadUrl}`);
                
                // Preview first 100 characters
                const preview = translateResult.content.substring(0, 100);
                console.log(`   👁️ Preview: "${preview}..."`);
            } else {
                console.error(`❌ ${lang.name} translation failed:`, translateResult.error);
            }
        }
        
        // Step 4: Test query translation
        console.log('\n🔍 Testing query with translation...');
        
        const queryResponse = await fetch(`${baseUrl}/api/query`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                query: 'What are the key features of this system?',
                targetLanguage: 'es'
            })
        });
        
        const queryResult = await queryResponse.json();
        
        if (queryResponse.ok) {
            console.log('✅ Query with Spanish translation:');
            console.log(`   🔍 Query: "${queryResult.query}"`);
            console.log(`   🌐 Target: ${queryResult.targetLanguage}`);
            console.log(`   💬 Answer: "${queryResult.answer}"`);
            console.log(`   📚 Sources: ${queryResult.sources.length} relevant chunks`);
        } else {
            console.error('❌ Query failed:', queryResult.error);
        }
        
        console.log('\n🎉 Translation workflow test completed successfully!');
        
        // Cleanup
        fs.unlinkSync(testFilePath);
        console.log('🧹 Cleaned up test file');
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

// Run the test if this script is executed directly
if (require.main === module) {
    // Note: This requires Node.js with fetch support (Node 18+)
    // For older versions, you would need to install node-fetch
    testTranslationWorkflow();
}

module.exports = { testTranslationWorkflow };
