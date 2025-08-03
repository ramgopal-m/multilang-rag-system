// Test script to verify PDF download functionality
const fs = require('fs');
const path = require('path');

async function testPdfDownload() {
  try {
    console.log('🧪 Testing PDF download functionality...');
    
    // Test the download endpoint for PDF
    const response = await fetch('http://localhost:3000/api/documents/download?documentId=test.txt&targetLanguage=es&format=pdf');
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    // Get the content as a buffer (binary data)
    const pdfBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(pdfBuffer);
    
    console.log(`📄 PDF downloaded: ${buffer.length} bytes`);
    
    // Check if it's actually a PDF (should start with %PDF)
    const pdfHeader = buffer.toString('ascii', 0, 4);
    console.log(`🔍 PDF Header: "${pdfHeader}"`);
    
    if (pdfHeader === '%PDF') {
      console.log('✅ PDF is valid binary format');
      
      // Save to file for verification
      const outputPath = path.join(__dirname, 'test-download.pdf');
      fs.writeFileSync(outputPath, buffer);
      console.log(`💾 Saved test PDF to: ${outputPath}`);
      
    } else {
      console.log('❌ Downloaded file is not a valid PDF');
      console.log('First 100 bytes as text:', buffer.toString('utf8', 0, 100));
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Wait for server to be ready, then run test
setTimeout(testPdfDownload, 5000);
