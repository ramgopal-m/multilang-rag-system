const translate = require('google-translate-api-x');

async function testTranslation() {
  try {
    console.log('Testing Google Translate...');
    const result = await translate('Hello world', { from: 'en', to: 'es' });
    console.log('Original:', 'Hello world');
    console.log('Translated:', result.text);
    console.log('Language detected:', result.from.language.iso);
    console.log('✅ Google Translate is working!');
  } catch (error) {
    console.error('❌ Google Translate failed:', error.message);
  }
}

testTranslation();
