const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { generateStaticFiles } = require('./scripts/generate-static');
const { spawn } = require('child_process');
const portfinder = require('portfinder');

const app = express();
const PORT = process.env.PORT || 3001;

// Set the base port to start looking from
portfinder.basePort = 3002;

app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'build')));

app.post('/api/generate-static', async (req, res) => {
  try {
    const jsonData = req.body;
    
    let siteName = 'static-site';
    if (jsonData.pages && jsonData.pages.length > 0) {
      const firstPageUrl = new URL(jsonData.pages[0].url);
      const hostname = firstPageUrl.hostname.replace(/\./g, '-');
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      siteName = `${hostname}-${timestamp}`;
    }
    
    const tempDir = path.join(__dirname, 'temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir);
    }
    
    const jsonFilePath = path.join(tempDir, `${siteName}.json`);
    fs.writeFileSync(jsonFilePath, JSON.stringify(jsonData));
    
    const outputDir = path.join(__dirname, 'generated', siteName);
    await generateStaticFiles(jsonFilePath, outputDir);
    
    fs.unlinkSync(jsonFilePath);
    
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

app.use('/generated', express.static(path.join(__dirname, 'generated')));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'build', 'index.html'));
});

// New endpoint to serve a generated site on its own port
app.post('/api/serve-site', async (req, res) => {
  try {
    const { siteName } = req.body;
    
    if (!siteName) {
      return res.status(400).json({
        success: false,
        message: 'Site name is required'
      });
    }
    
    console.log(`Attempting to serve site: ${siteName}`);
    
    const siteDir = path.join(__dirname, 'generated', siteName);
    
    // Check if the site directory exists
    if (!fs.existsSync(siteDir)) {
      return res.status(404).json({
        success: false,
        message: `Site '${siteName}' not found`
      });
    }
    
    // Find an available port (starting from 3002)
    let port = 3002;
    while (isPortInUse(port)) {
      port++;
    }
    
    // Create a simple server for the site
    const server = express();
    server.use(express.static(siteDir));
    
    // Simple fallback for direct file access
    server.get('*', (req, res) => {
      const requestPath = req.path;
      console.log(`[Site Server ${siteName}] Request for: ${requestPath}`);
      
      // Direct file match
      let filePath = path.join(siteDir, requestPath);
      if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        console.log(`[Site Server ${siteName}] Serving file: ${filePath}`);
        return res.sendFile(filePath);
      }
      
      // Try with .html extension
      const htmlPath = `${filePath}.html`;
      if (fs.existsSync(htmlPath)) {
        console.log(`[Site Server ${siteName}] Serving with .html extension: ${htmlPath}`);
        return res.sendFile(htmlPath);
      }
      
      // Default to index.html for root or directories
      if (requestPath === '/' || requestPath.endsWith('/')) {
        const indexPath = path.join(filePath, 'index.html');
        if (fs.existsSync(indexPath)) {
          console.log(`[Site Server ${siteName}] Serving index.html: ${indexPath}`);
          return res.sendFile(indexPath);
        }
      }
      
      // If nothing found, return 404
      console.log(`[Site Server ${siteName}] File not found: ${requestPath}`);
      res.status(404).send('File not found');
    });
    
    // Start the server
    const siteServer = server.listen(port, () => {
      console.log(`Site server for ${siteName} running on port ${port}`);
    });
    
    // Store the server instance
    if (!global.siteServers) {
      global.siteServers = {};
    }
    
    global.siteServers[siteName] = {
      server: siteServer,
      port: port
    };
    
    res.json({
      success: true,
      message: `Site '${siteName}' is now running on port ${port}`,
      url: `http://localhost:${port}`,
      port: port
    });
    
  } catch (error) {
    console.error('Error serving site:', error);
    res.status(500).json({
      success: false,
      message: `Error serving site: ${error.message}`
    });
  }
});

// Helper function to check if a port is in use
function isPortInUse(port) {
  try {
    // Try to create a server on the port
    const server = require('net').createServer();
    server.listen(port);
    server.close();
    return false;
  } catch (e) {
    return true;
  }
}

// Add an endpoint to stop a running site
app.post('/api/stop-site', (req, res) => {
  try {
    const { siteName } = req.body;
    
    if (!siteName || !global.siteServers || !global.siteServers[siteName]) {
      return res.status(404).json({
        success: false,
        message: `Site '${siteName}' is not running`
      });
    }
    
    // Close the server
    global.siteServers[siteName].server.close();
    
    // Remove from the list
    delete global.siteServers[siteName];
    
    res.json({
      success: true,
      message: `Site '${siteName}' has been stopped`
    });
    
  } catch (error) {
    console.error('Error stopping site:', error);
    res.status(500).json({
      success: false,
      message: `Error stopping site: ${error.message}`
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Visit http://localhost:${PORT} to access the app`);
}); 