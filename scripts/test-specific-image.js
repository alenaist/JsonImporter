const axios = require('axios');
const fs = require('fs');
const path = require('path');

async function testSpecificImageDownload() {
  // Replace this with the actual URL of the image you're trying to download
  const imageUrl = 'https://www.jennetteelectric.com/assets/J34984.E._Logo.JPG';
  const outputPath = path.join(__dirname, '..', 'test-specific-image.jpg');
  
  console.log(`Attempting to download image from: ${imageUrl}`);
  
  try {
    const response = await axios({
      method: 'GET',
      url: imageUrl,
      responseType: 'arraybuffer',
      timeout: 30000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'image/*',
        'Accept-Encoding': 'gzip, deflate, br'
      },
      maxRedirects: 5,
      validateStatus: status => status < 400
    });
    
    console.log('Response received');
    console.log(`Content-Type: ${response.headers['content-type']}`);
    console.log(`Content-Length: ${response.headers['content-length'] || 'unknown'}`);
    
    fs.writeFileSync(outputPath, Buffer.from(response.data));
    console.log(`Image saved to: ${outputPath}`);
  } catch (error) {
    console.error('Error downloading image:');
    console.error(error.message);
    
    if (error.response) {
      console.error(`Status: ${error.response.status}`);
      console.error(`Headers: ${JSON.stringify(error.response.headers)}`);
    } else if (error.request) {
      console.error('No response received');
    }
    
    console.error('Full error:', error);
  }
}

testSpecificImageDownload(); 