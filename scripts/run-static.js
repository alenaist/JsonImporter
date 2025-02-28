const { generateStaticFiles } = require('./generate-static');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

// Default values
const jsonFilePath = process.argv[2] || './mocks/cluster-pupetteer-jeanette-2.json';
const outputDir = process.argv[3] || 'static-site';
const port = process.argv[4] || 8080;

// Generate the static site
const siteDir = generateStaticFiles(jsonFilePath, outputDir);

// Simple static file server
const server = http.createServer((req, res) => {
  // Get the file path
  let filePath = path.join(siteDir, req.url === '/' ? 'index.html' : req.url);
  
  // Check if the file exists
  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, 'index.html');
  }
  
  // Get the file extension
  const extname = path.extname(filePath);
  
  // Set the content type based on the file extension
  const contentType = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'text/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
  }[extname] || 'text/plain';
  
  // Read the file
  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        // File not found
        fs.readFile(path.join(siteDir, '404.html'), (err, content) => {
          res.writeHead(404, { 'Content-Type': 'text/html' });
          res.end(content || '404 Not Found', 'utf-8');
        });
      } else {
        // Server error
        res.writeHead(500);
        res.end(`Server Error: ${err.code}`);
      }
    } else {
      // Success
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content, 'utf-8');
    }
  });
});

// Start the server
server.listen(port, () => {
  console.log(`Server running at http://localhost:${port}/`);
  
  // Open the browser
  const url = `http://localhost:${port}`;
  const command = process.platform === 'win32' ? 'start' : 
                 process.platform === 'darwin' ? 'open' : 'xdg-open';
  
  exec(`${command} ${url}`);
  
  console.log('Press Ctrl+C to stop the server');
}); 