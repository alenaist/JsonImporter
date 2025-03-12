const { generateStaticFiles } = require('./generate-static');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const jsonFilePath = process.argv[2] || './mocks/cluster-pupetteer-jeanette-2.json';
const outputDir = process.argv[3] || 'static-site';
const port = process.argv[4] || 8080;

const siteDir = generateStaticFiles(jsonFilePath, outputDir);

const server = http.createServer((req, res) => {
  let filePath = path.join(siteDir, req.url === '/' ? 'index.html' : req.url);
  
  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, 'index.html');
  }
  
  const extname = path.extname(filePath);
  
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
  
  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        fs.readFile(path.join(siteDir, '404.html'), (err, content) => {
          res.writeHead(404, { 'Content-Type': 'text/html' });
          res.end(content || '404 Not Found', 'utf-8');
        });
      } else {
        res.writeHead(500);
        res.end(`Server Error: ${err.code}`);
      }
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content, 'utf-8');
    }
  });
});

server.listen(port, () => {
  console.log(`Server running at http://localhost:${port}/`);
  
  const url = `http://localhost:${port}`;
  const command = process.platform === 'win32' ? 'start' : 
                 process.platform === 'darwin' ? 'open' : 'xdg-open';
  
  exec(`${command} ${url}`);
  
  console.log('Press Ctrl+C to stop the server');
}); 