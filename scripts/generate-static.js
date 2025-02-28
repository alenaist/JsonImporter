const fs = require('fs');
const path = require('path');
const axios = require('axios');

async function generateStaticFiles(jsonFilePath, outputDir = 'static-site') {
  console.log(`Generating static site from ${jsonFilePath} to ${outputDir}...`);
  
  let jsonData;
  try {
    jsonData = JSON.parse(fs.readFileSync(jsonFilePath, 'utf8'));
  } catch (error) {
    console.error(`Error reading JSON file: ${error.message}`);
    throw error;
  }
  
  if (fs.existsSync(outputDir)) {
    fs.rmSync(outputDir, { recursive: true, force: true });
  }
  fs.mkdirSync(outputDir, { recursive: true });
  
  const assetsDir = path.join(outputDir, 'assets');
  fs.mkdirSync(assetsDir);
  
  await extractAndSaveImages(jsonData, assetsDir);
  
  jsonData.pages.forEach(page => {
    // Extract page path from URL
    const url = new URL(page.url);
    let pagePath = url.pathname;
    
    // Determine output file path
    let outputPath;
    if (pagePath === '/' || pagePath === '') {
      outputPath = path.join(outputDir, 'index.html');
    } else {
      // Remove leading slash
      pagePath = pagePath.startsWith('/') ? pagePath.substring(1) : pagePath;
      
      // Create directory structure if needed
      const dirPath = path.join(outputDir, path.dirname(pagePath));
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
      }
      
      // Add .html extension if not present
      outputPath = path.join(outputDir, pagePath);
      if (!outputPath.endsWith('.html')) {
        outputPath += '.html';
      }
    }
    
    // Generate HTML content
    const htmlContent = generateHtml(page, jsonData.pages);
    
    // Write to file
    fs.writeFileSync(outputPath, htmlContent);
    console.log(`Generated: ${outputPath}`);
  });
  
  // Create a comprehensive CSS file
  const cssContent = `
    body { 
      font-family: Arial, sans-serif; 
      margin: 0; 
      padding: 0; 
      line-height: 1.6;
    }
    header { 
      background: #f4f4f4; 
      padding: 1rem; 
      border-bottom: 1px solid #ddd;
    }
    nav ul { 
      display: flex; 
      list-style: none; 
      padding: 0; 
      margin: 0;
    }
    nav li { 
      margin-right: 1rem; 
    }
    nav a {
      text-decoration: none;
      color: #333;
      font-weight: bold;
    }
    nav li.active a {
      color: #0066cc;
    }
    main { 
      padding: 1rem; 
      max-width: 1200px;
      margin: 0 auto;
    }
    footer { 
      background: #f4f4f4; 
      padding: 1rem; 
      text-align: center;
      border-top: 1px solid #ddd;
      margin-top: 2rem;
    }
    img {
      max-width: 100%;
      height: auto;
    }
    table {
      border-collapse: collapse;
      width: 100%;
    }
    table, th, td {
      border: 1px solid #ddd;
    }
    th, td {
      padding: 8px;
      text-align: left;
    }
    th {
      background-color: #f4f4f4;
    }
  `;
  fs.writeFileSync(path.join(assetsDir, 'styles.css'), cssContent);
  console.log(`Generated: ${path.join(assetsDir, 'styles.css')}`);
  
  // Create a simple index file for the generated directory
  const indexContent = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Generated Site</title>
    </head>
    <body>
      <h1>Generated Static Site</h1>
      <div class="site-info">
        <p>Generated from: ${path.basename(jsonFilePath)}</p>
        <p>Generated on: ${new Date().toLocaleString()}</p>
      </div>
      <div class="pages">
        <h2>Pages:</h2>
        ${jsonData.pages.map(page => {
          const url = new URL(page.url);
          let pagePath = url.pathname;
          let href = pagePath === '/' || pagePath === '' ? 'index.html' : `${pagePath.replace(/^\//, '')}.html`;
          let title = getPageTitle(page);
          return `<a href="${href}">${title}</a>`;
        }).join('\n        ')}
      </div>
    </body>
    </html>
  `;
  fs.writeFileSync(path.join(outputDir, 'site-info.html'), indexContent);
  console.log(`Generated: ${path.join(outputDir, 'site-info.html')}`);
  
  console.log(`Static site generation complete! Files are in the '${outputDir}' directory.`);
  return outputDir;
}

// Function to extract and save images from JSON data
async function extractAndSaveImages(jsonData, assetsDir) {
  // Process all pages to find image sources
  if (jsonData.pages) {
    for (const page of jsonData.pages) {
      if (page.html) {
        await extractImagesFromElement(page.html, assetsDir);
      }
    }
  }
}

// Recursively extract images from HTML elements
async function extractImagesFromElement(element, assetsDir) {
  if (!element) return;
  
  // Check if this is an image element
  const tag = element.tagName || element.tag;
  if (tag && tag.toLowerCase() === 'img' && element.attributes && element.attributes.src) {
    const imgSrc = element.attributes.src;
    
    try {
      // Skip tracking pixels and empty sources
      if (imgSrc.includes('logger.php') || imgSrc.trim() === '') {
        return;
      }
      
      // Parse the URL to get the pathname
      let imgFilename;
      let imgPath = '';
      let fullUrl = imgSrc;
      
      // Handle protocol-relative URLs (starting with //)
      if (imgSrc.startsWith('//')) {
        fullUrl = 'https:' + imgSrc;
      }
      
      try {
        // Try to parse as a URL
        const imgUrl = new URL(fullUrl);
        
        // Get the full pathname to preserve directory structure
        const pathname = imgUrl.pathname;
        
        // Extract the filename and path
        imgFilename = path.basename(pathname.split('?')[0]); // Remove query parameters from filename
        
        // Get the directory structure (without the filename)
        imgPath = path.dirname(pathname).replace(/^\//, ''); // Remove leading slash
      } catch (e) {
        // Not a valid URL, just use the basename
        imgFilename = path.basename(imgSrc.split('?')[0]); // Remove query parameters
      }
      
      // Ensure filename is not empty and has no invalid characters
      if (!imgFilename || imgFilename === '.' || imgFilename === '..') {
        imgFilename = 'image-' + Math.random().toString(36).substring(2, 10) + '.jpg';
      }
      
      // Create directory structure if needed
      const targetDir = imgPath ? path.join(assetsDir, imgPath) : assetsDir;
      if (imgPath && !fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
        console.log(`Created directory: ${targetDir}`);
      }
      
      const outputPath = path.join(targetDir, imgFilename);
      
      // Handle different image sources
      if (fullUrl.startsWith('http://') || fullUrl.startsWith('https://')) {
        // Download the image from URL
        console.log(`Downloading image from: ${fullUrl}`);
        
        try {
          // Using axios with arraybuffer for binary data
          const response = await axios({
            method: 'GET',
            url: fullUrl,
            responseType: 'arraybuffer',
            timeout: 30000, // 30 second timeout
            maxContentLength: 50 * 1024 * 1024, // 50MB max
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
              'Accept': 'image/*', // Accept image content types
              'Accept-Encoding': 'gzip, deflate, br'
            },
            // Handle redirects automatically
            maxRedirects: 5,
            // Consider only < 400 as success
            validateStatus: status => status < 400
          });
          
          // Check if we got an image
          const contentType = response.headers['content-type'];
          if (contentType && contentType.startsWith('image/')) {
            // Write the binary data directly to file
            fs.writeFileSync(outputPath, Buffer.from(response.data));
            console.log(`Downloaded image to: ${outputPath}`);
            
            // Update the image src to point to the local copy
            const relativePath = imgPath ? `assets/${imgPath}/${imgFilename}` : `assets/${imgFilename}`;
            element.attributes.src = relativePath;
          } else {
            throw new Error(`Response is not an image: ${contentType}`);
          }
        } catch (error) {
          console.error(`Error downloading image: ${error.message}`);
          
          // Create a placeholder for failed downloads
          createPlaceholderImage(imgFilename, outputPath, targetDir);
          
          // Update the src to point to the placeholder
          const relativePath = imgPath ? `assets/${imgPath}/${imgFilename}` : `assets/${imgFilename}`;
          element.attributes.src = relativePath;
        }
      } else if (imgSrc.startsWith('data:image/')) {
        // Handle base64 encoded images
        try {
          const matches = imgSrc.match(/^data:image\/([a-zA-Z]+);base64,(.+)$/);
          if (matches && matches.length === 3) {
            const extension = matches[1];
            const data = matches[2];
            const buffer = Buffer.from(data, 'base64');
            
            // Ensure filename has the correct extension
            const filename = imgFilename.includes('.') ? 
              imgFilename : 
              `${imgFilename}.${extension}`;
            
            const finalOutputPath = path.join(targetDir, filename);
            fs.writeFileSync(finalOutputPath, buffer);
            console.log(`Saved base64 image to: ${finalOutputPath}`);
            
            // Update the image src
            const relativePath = imgPath ? `assets/${imgPath}/${filename}` : `assets/${filename}`;
            element.attributes.src = relativePath;
          } else {
            throw new Error('Invalid data URL format');
          }
        } catch (error) {
          console.error(`Error processing base64 image: ${error.message}`);
          createPlaceholderImage(imgFilename, outputPath, targetDir);
          
          // Update the src to point to the placeholder
          const relativePath = imgPath ? `assets/${imgPath}/${imgFilename}` : `assets/${imgFilename}`;
          element.attributes.src = relativePath;
        }
      } else {
        // Local file path that doesn't exist yet - create a placeholder
        createPlaceholderImage(imgFilename, outputPath, targetDir);
        
        // Update the src to point to the placeholder
        const relativePath = imgPath ? `assets/${imgPath}/${imgFilename}` : `assets/${imgFilename}`;
        element.attributes.src = relativePath;
      }
    } catch (error) {
      console.error(`Error processing image ${imgSrc}: ${error.message}`);
    }
  }
  
  // Process children recursively
  if (element.children && Array.isArray(element.children)) {
    for (const child of element.children) {
      await extractImagesFromElement(child, assetsDir);
    }
  }
}

// Helper function to create placeholder images
function createPlaceholderImage(imgFilename, outputPath, targetDir) {
  // Create a simple SVG placeholder image
  const svgContent = `<svg width="200" height="200" xmlns="http://www.w3.org/2000/svg">
    <rect width="200" height="200" fill="#f0f0f0"/>
    <text x="50%" y="50%" font-family="Arial" font-size="16" text-anchor="middle" dominant-baseline="middle" fill="#333">
      Image: ${imgFilename}
    </text>
  </svg>`;
  
  // Create the SVG file
  const svgFilename = imgFilename.replace(/\.[^/.]+$/, '') + '.svg';
  const svgPath = path.join(targetDir, svgFilename);
  fs.writeFileSync(svgPath, svgContent);
  
  // For non-SVG files, create a copy of the SVG with the original extension
  if (!imgFilename.toLowerCase().endsWith('.svg')) {
    try {
      // Copy the SVG file to the original filename
      fs.copyFileSync(svgPath, outputPath);
    } catch (error) {
      // If copy fails, just write the SVG content to the original file
      fs.writeFileSync(outputPath, svgContent);
    }
  }
  
  console.log(`Created placeholder for image: ${imgFilename}`);
}

// Function to generate HTML for a page
function generateHtml(page, allPages) {
  // Generate HTML content
  const htmlContent = renderElement(page.html);
  
  // If the content already has a complete HTML structure, use it directly
  // without adding any navigation or additional structure
  if (htmlContent.trim().toLowerCase().startsWith('<!doctype') || 
      htmlContent.trim().toLowerCase().startsWith('<html')) {
    return htmlContent;
  }
  
  // Check if the page already has navigation elements
  const hasNavigation = checkForNavigation(page.html);
  
  // Otherwise, create a complete HTML document with our structure
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${getPageTitle(page)}</title>
  <link rel="stylesheet" href="assets/styles.css">
  <style>
    /* Additional styles to match the original site */
    body {
      font-family: Arial, sans-serif;
      margin: 0;
      padding: 0;
    }
    .navigation-links {
      display: flex;
      justify-content: center;
      margin: 20px 0;
    }
    .navigation-links a {
      margin: 0 10px;
      text-decoration: none;
      color: #333;
      font-weight: bold;
    }
    .navigation-links a:hover {
      color: #0066cc;
    }
  </style>
</head>
<body>
  <main>
    ${htmlContent}
  </main>
</body>
</html>`;
}

// Function to clean up HTML by removing scripts and Angular directives
function cleanupHtml(html) {
  // Remove script tags
  let cleaned = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  
  // Remove Angular directives
  cleaned = cleaned.replace(/\s+data-ng-[a-zA-Z-]+="[^"]*"/g, '');
  cleaned = cleaned.replace(/\s+ng-[a-zA-Z-]+="[^"]*"/g, '');
  
  // Remove the includes div that contains scripts
  cleaned = cleaned.replace(/<div id="includes"[^>]*>.*?<\/div>/gs, '');
  
  return cleaned;
}

// Helper function to check if the page already has navigation elements
function checkForNavigation(element) {
  if (!element) return false;
  
  const tag = element.tagName || element.tag;
  
  // Check for explicit nav tag
  if (tag && tag.toLowerCase() === 'nav') {
    return true;
  }
  
  // Check for navigation-2-plugin class
  if (element.attributes && element.attributes.class) {
    const classStr = element.attributes.class.toString().toLowerCase();
    if (classStr.includes('navigation-2-plugin') || 
        classStr.includes('nav') || 
        classStr.includes('menu') || 
        classStr.includes('header')) {
      return true;
    }
  }
  
  // Check for elements that might be navigation
  if (tag && ['ul', 'ol'].includes(tag.toLowerCase())) {
    // Check if this list contains links, which would suggest it's navigation
    if (element.children && Array.isArray(element.children)) {
      const hasLinks = element.children.some(child => {
        const childTag = child.tagName || child.tag;
        if (childTag && childTag.toLowerCase() === 'li') {
          // Check if the list item contains an anchor
          return child.children && Array.isArray(child.children) && 
                 child.children.some(grandchild => {
                   const grandchildTag = grandchild.tagName || grandchild.tag;
                   return grandchildTag && grandchildTag.toLowerCase() === 'a';
                 });
        }
        return false;
      });
      
      if (hasLinks) {
        return true;
      }
    }
  }
  
  // Check for div with navigation-related ID
  if (tag && tag.toLowerCase() === 'div' && 
      element.attributes && element.attributes.id && 
      (element.attributes.id.includes('nav') || 
       element.attributes.id.includes('menu') || 
       element.attributes.id.includes('header'))) {
    return true;
  }
  
  // Recursively check children
  if (element.children && Array.isArray(element.children)) {
    return element.children.some(child => checkForNavigation(child));
  }
  
  return false;
}

// Function to get page title
function getPageTitle(page) {
  // Extract from URL
  const url = new URL(page.url);
  const pathParts = url.pathname.split('/').filter(Boolean);
  if (pathParts.length > 0) {
    return pathParts[pathParts.length - 1]
      .replace(/-/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase());
  }
  
  return 'Home';
}

// Function to render an element to HTML
function renderElement(element) {
  if (!element) return '';
  
  const tag = element.tagName || element.tag;
  if (!tag) return element.text || element.textContent || '';
  
  // Handle void elements
  const voidElements = ['img', 'br', 'hr', 'input', 'meta', 'link'];
  const tagLower = tag.toLowerCase();
  
  // Special handling for image elements
  if (tagLower === 'img' && element.attributes && element.attributes.src) {
    // Process image src to ensure it points to the correct location
    processImageSrc(element);
  }
  
  // For void elements, just render the opening tag with attributes
  if (voidElements.includes(tagLower)) {
    const attrs = renderAttributes(element.attributes);
    return `<${tag}${attrs}>`;
  }
  
  // Handle special elements with different processing needs
  if (tagLower === 'script' || tagLower === 'style') {
    const attrs = renderAttributes(element.attributes);
    const content = element.text || element.textContent || '';
    return `<${tag}${attrs}>${content}</${tag}>`;
  }
  
  // Clean up Angular-specific attributes
  if (element.attributes) {
    cleanupAngularAttributes(element.attributes);
  }
  
  // Special handling for navigation-2-plugin elements
  if (element.attributes && element.attributes.class && 
      element.attributes.class.includes('navigation-2-plugin')) {
    return renderNavigationPlugin(element);
  }
  
  // Handle anchor elements with special attention to href attributes
  if (tagLower === 'a' && element.attributes && element.attributes.href) {
    processAnchorHref(element);
  }
  
  // Handle regular elements
  const attrs = renderAttributes(element.attributes);
  const content = element.children?.map(child => renderElement(child)).join('') || '';
  const text = element.text || element.textContent || '';
  
  return `<${tag}${attrs}>${content}${text}</${tag}>`;
}

// Helper function to process image src attributes
function processImageSrc(element) {
  if (!element.attributes.src.startsWith('assets/') && 
      !element.attributes.src.startsWith('http://') && 
      !element.attributes.src.startsWith('https://') && 
      !element.attributes.src.startsWith('data:')) {
    
    try {
      // Try to parse as a URL to preserve path structure
      const imgUrl = new URL(element.attributes.src);
      const pathname = imgUrl.pathname;
      const imgFilename = path.basename(pathname);
      const imgPath = path.dirname(pathname).replace(/^\//, '');
      
      // Update the src to use the preserved path structure
      if (imgPath && imgPath !== '.') {
        element.attributes.src = `assets/${imgPath}/${imgFilename}`;
      } else {
        element.attributes.src = `assets/${imgFilename}`;
      }
    } catch (e) {
      // Not a valid URL, just use the basename
      const imgFilename = path.basename(element.attributes.src);
      element.attributes.src = `assets/${imgFilename}`;
    }
  }
}

// Helper function to process anchor href attributes
function processAnchorHref(element) {
  const href = element.attributes.href;
  // Ensure href is properly formatted for static site
  if (!href.startsWith('http://') && !href.startsWith('https://') && !href.startsWith('#')) {
    // Remove .html extension if present
    let hrefPath = href.replace(/\.html$/, '');
    
    // Add .html extension for static site links if not present
    if (!hrefPath.endsWith('.html') && !hrefPath.includes('#') && !hrefPath.includes('?')) {
      element.attributes.href = hrefPath + '.html';
    }
  }
}

// Helper function to clean up Angular-specific attributes
function cleanupAngularAttributes(attributes) {
  Object.keys(attributes).forEach(key => {
    if (key.startsWith('data-ng-') || key.startsWith('ng-') || 
        key.startsWith('data-k-') || key.startsWith('data-kendo-')) {
      delete attributes[key];
    }
  });
}

// Helper function to render navigation plugin elements
function renderNavigationPlugin(element) {
  const attrs = renderAttributes(element.attributes);
  
  // Process the style element if it exists
  let styleContent = '';
  if (element.children) {
    const styleElements = element.children.filter(child => 
      (child.tagName || child.tag)?.toLowerCase() === 'style');
    if (styleElements.length > 0) {
      styleContent = styleElements.map(style => renderElement(style)).join('');
    }
  }
  
  // Find and process the navigation content (ul element)
  let navContent = '';
  if (element.children) {
    // First look for div with class neo-asset-inner
    const innerDiv = element.children.find(child => 
      (child.tagName || child.tag)?.toLowerCase() === 'div' && 
      child.attributes && 
      child.attributes.class && 
      child.attributes.class.includes('neo-asset-inner'));
    
    if (innerDiv && innerDiv.children) {
      // Then find the ul element inside the inner div
      const ulElement = innerDiv.children.find(child => 
        (child.tagName || child.tag)?.toLowerCase() === 'ul');
      
      if (ulElement) {
        // Clean up Angular attributes from ul and its children
        if (ulElement.attributes) {
          cleanupAngularAttributes(ulElement.attributes);
        }
        
        // Process all li elements and their children
        if (ulElement.children) {
          ulElement.children.forEach(li => {
            if (li.attributes) {
              cleanupAngularAttributes(li.attributes);
            }
          });
        }
        
        navContent = renderElement(ulElement);
      } else {
        // If no ul found, process all children of the inner div
        navContent = innerDiv.children.map(child => renderElement(child)).join('');
      }
    } else {
      // If no inner div found, process all non-style children
      navContent = element.children
        .filter(child => (child.tagName || child.tag)?.toLowerCase() !== 'style')
        .map(child => renderElement(child))
        .join('');
    }
  }
  
  return `<div${attrs}>${styleContent}<div class="neo-asset-inner" style="background-color: rgba(255, 255, 255, 0); opacity: 1; border-style: none; border-color: rgb(51, 51, 51); background-image: none; box-shadow: rgba(0, 0, 0, 0.5) 0px 0px 0px 0px;">${navContent}</div></div>`;
}

// Helper to render HTML attributes
function renderAttributes(attributes) {
  if (!attributes) return '';
  
  return Object.entries(attributes).map(([key, value]) => {
    // Skip certain attributes that shouldn't be rendered
    if (key === 'children' || key === 'text' || key === 'textContent') {
      return '';
    }
    
    // Handle boolean attributes
    if (value === true) return ` ${key}`;
    if (value === false || value === null || value === undefined) return '';
    
    // Handle data attributes with JSON values
    if (key.startsWith('data-') && typeof value === 'object') {
      try {
        // Use single quotes for JSON data to avoid excessive escaping
        return ` ${key}='${JSON.stringify(value).replace(/'/g, '&apos;')}'`;
      } catch (e) {
        // If JSON stringification fails, convert to string
        return ` ${key}='${value.toString().replace(/'/g, '&apos;')}'`;
      }
    }
    
    // Handle style objects
    if (key === 'style' && typeof value === 'object') {
      try {
        const styleString = Object.entries(value)
          .map(([prop, val]) => `${prop}:${val}`)
          .join(';');
        return ` ${key}='${styleString.replace(/'/g, '&apos;')}'`;
      } catch (e) {
        // If style object processing fails, use as is
        return ` ${key}='${value.toString().replace(/'/g, '&apos;')}'`;
      }
    }
    
    // Convert value to string
    const stringValue = value.toString();
    
    // Check if the attribute value contains double quotes
    if (stringValue.includes('"')) {
      // If it has double quotes, use single quotes for the attribute
      return ` ${key}='${stringValue.replace(/'/g, '&apos;')}'`;
    } else {
      // Otherwise use double quotes (no need to escape)
      return ` ${key}="${stringValue}"`;
    }
  }).join('');
}

// If this script is run directly (not imported)
if (require.main === module) {
  const args = process.argv.slice(2);
  const jsonFilePath = args[0] || './mocks/cluster-pupetteer-jeanette-2.json';
  const outputDir = args[1] || 'static-site';
  
  generateStaticFiles(jsonFilePath, outputDir)
    .then(() => console.log('Static site generation completed successfully!'))
    .catch(error => console.error('Error generating static site:', error));
}

module.exports = { generateStaticFiles }; 