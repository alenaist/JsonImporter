const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { generateStaticFiles } = require('./scripts/generate-static');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'build')));

//API endpoint
app.post('/api/generate-static', async (req, res) => {
  try {
    const jsonData = req.body;
    
    // Extract a distinctive name from the JSON data
    let siteName = 'static-site';
    if (jsonData.pages && jsonData.pages.length > 0) {
      const firstPageUrl = new URL(jsonData.pages[0].url);
      const hostname = firstPageUrl.hostname.replace(/\./g, '-');
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      siteName = `${hostname}-${timestamp}`;
    }
    
    // Create a temporary JSON file
    const tempDir = path.join(__dirname, 'temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir);
    }
    
    const jsonFilePath = path.join(tempDir, `${siteName}.json`);
    fs.writeFileSync(jsonFilePath, JSON.stringify(jsonData));
    
    // Generate the static files
    const outputDir = path.join(__dirname, 'generated', siteName);
    await generateStaticFiles(jsonFilePath, outputDir);
    
    // Clean up the temporary JSON file
    fs.unlinkSync(jsonFilePath);
    
    // Return success response with the output directory
    res.json({
      success: true,
      message: 'Static files generated successfully',
      outputDir: outputDir,
      siteName: siteName
    });
  } catch (error) {
    console.error('Error generating static files:', error);
    res.status(500).json({
      success: false,
      message: `Error generating static files: ${error.message}`
    });
  }
});

// Serve the generated static sites
app.use('/generated', express.static(path.join(__dirname, 'generated')));

// Serve the React app for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'build', 'index.html'));
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Visit http://localhost:${PORT} to access the app`);
}); 