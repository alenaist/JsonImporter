const axios = require('axios');
const fs = require('fs');
const path = require('path');

async function testImageDownload() {
  // Test with a reliable image URL
  const imageUrl = 'https://picsum.photos/200/300';
  const outputPath = path.join(__dirname, '..', 'test-image.jpg');
  
  console.log(`Attempting to download image from: ${imageUrl}`);
  
  try {
    const response = await axios({
      method: 'GET',
      url: imageUrl,
      responseType: 'arraybuffer',
      timeout: 30000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'image/*'
      }
    });
    
    console.log('Response received');
    console.log(`Content-Type: ${response.headers['content-type']}`);
    console.log(`Content-Length: ${response.headers['content-length']}`);
    
    fs.writeFileSync(outputPath, Buffer.from(response.data));
    console.log(`Image saved to: ${outputPath}`);
  } catch (error) {
    console.error('Error downloading image:');
    console.error(error.message);
    
    if (error.response) {
      console.error(`Status: ${error.response.status}`);
      console.error(`Headers: ${JSON.stringify(error.response.headers)}`);
    }
  }
}

testImageDownload(); 