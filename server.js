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
    
    // Handle all routes to support navigation
    server.get('*', (req, res) => {
      const requestPath = req.path === '/' ? '/index.html' : req.path;
      console.log(`[Site Server ${siteName}] Request for: ${requestPath}`);
      
      // Try to load the page mappings file
      const mappingsPath = path.join(siteDir, 'page-mappings.json');
      let pageMappings = {};
      
      if (fs.existsSync(mappingsPath)) {
        try {
          pageMappings = JSON.parse(fs.readFileSync(mappingsPath, 'utf8'));
          console.log(`[Site Server ${siteName}] Loaded page mappings from ${mappingsPath}`);
        } catch (error) {
          console.error(`[Site Server ${siteName}] Error loading page mappings: ${error.message}`);
        }
      }
      
      // Log all available mappings for debugging
      console.log(`[Site Server ${siteName}] Available mappings:`, Object.keys(pageMappings));
      
      // Case 1: Check if the path exists in our mappings
      if (pageMappings[requestPath]) {
        const mappedFile = path.join(siteDir, pageMappings[requestPath]);
        if (fs.existsSync(mappedFile)) {
          console.log(`[Site Server ${siteName}] Serving mapped file: ${mappedFile}`);
          return res.sendFile(mappedFile);
        }
      }
      
      // Case 2: Direct file match (e.g., /about.html)
      let filePath = path.join(siteDir, requestPath);
      if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        console.log(`[Site Server ${siteName}] Serving exact file: ${filePath}`);
        return res.sendFile(filePath);
      }
      
      // Case 3: Clean URL without .html extension (e.g., /about)
      const htmlPath = `${filePath}.html`;
      if (fs.existsSync(htmlPath)) {
        console.log(`[Site Server ${siteName}] Serving with .html extension: ${htmlPath}`);
        return res.sendFile(htmlPath);
      }
      
      // Case 4: URL with trailing slash (e.g., /about/)
      if (requestPath.endsWith('/')) {
        const indexPath = path.join(filePath, 'index.html');
        if (fs.existsSync(indexPath)) {
          console.log(`[Site Server ${siteName}] Serving index.html from directory: ${indexPath}`);
          return res.sendFile(indexPath);
        }
      }
      
      // Case 5: URL with additional path segments (e.g., /about/team)
      // Try to find a matching HTML file by removing segments
      const segments = requestPath.split('/').filter(Boolean);
      for (let i = segments.length - 1; i >= 0; i--) {
        const partialPath = '/' + segments.slice(0, i).join('/');
        const partialFilePath = path.join(siteDir, partialPath + '.html');
        
        if (fs.existsSync(partialFilePath)) {
          console.log(`[Site Server ${siteName}] Serving partial match: ${partialFilePath}`);
          return res.sendFile(partialFilePath);
        }
      }
      
      // Default: Serve index.html as fallback
      console.log(`[Site Server ${siteName}] Falling back to index.html`);
      res.sendFile(path.join(siteDir, 'index.html'));
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