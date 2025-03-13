const fs = require('fs');
const path = require('path');
const axios = require('axios');

async function generateStaticFiles(jsonFilePath, outputDir = 'static-site') {
  console.log(`Generating site from ${jsonFilePath} to ${outputDir}...`);
  
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
  
  // Extract and save images with the base URL from jsonData
  const baseURL = jsonData.url || (jsonData.pages && jsonData.pages.length > 0 ? jsonData.pages[0].url : null);
  console.log(`Using base URL: ${baseURL}`);
  
  await extractAndSaveImages(jsonData, assetsDir, baseURL);
  
  jsonData.pages.forEach(page => {
    const url = new URL(page.url);
    let pagePath = url.pathname;
    
    let outputPath;
    if (pagePath === '/' || pagePath === '') {
      outputPath = path.join(outputDir, 'index.html');
    } else {
      pagePath = pagePath.startsWith('/') ? pagePath.substring(1) : pagePath;
      
      const dirPath = path.join(outputDir, path.dirname(pagePath));
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
      }
      
      outputPath = path.join(outputDir, pagePath);
      if (!outputPath.endsWith('.html')) {
        outputPath += '.html';
      }
    }
    
    const htmlContent = generateHtml(page, jsonData.pages);
    
    fs.writeFileSync(outputPath, htmlContent);
    console.log(`Generated: ${outputPath}`);
  });
  
  console.log(`Static site generation complete! Files are in the '${outputDir}' directory.`);
  return outputDir;
}

async function extractAndSaveImages(jsonData, assetsDir, baseURL) {
  console.log(`Starting image extraction to: ${assetsDir}`);
  
  // Count of successful/failed downloads
  let totalImages = 0;
  let successfulImages = 0;
  let failedImages = 0;
  
  if (jsonData.pages) {
    for (const page of jsonData.pages) {
      if (page.html) {
        // Use page URL as base URL for this page's images if available
        const pageBaseURL = page.url || baseURL;
        console.log(`Processing images for page: ${pageBaseURL}`);
        
        const result = await extractImagesFromElement(page.html, assetsDir, pageBaseURL, jsonData);
        
        totalImages += result.total;
        successfulImages += result.success;
        failedImages += result.failed;
      }
    }
  }
  
  console.log(`\nImage Extraction Summary:`);
  console.log(`Total images processed: ${totalImages}`);
  console.log(`Successfully downloaded: ${successfulImages}`);
  console.log(`Failed to download: ${failedImages}`);
}

async function extractImagesFromElement(element, assetsDir, baseURL, jsonData, stats = { total: 0, success: 0, failed: 0 }) {
  if (!element) return stats;
  
  const tag = element.tagName || element.tag;
  if (tag && tag.toLowerCase() === 'img' && element.attributes && element.attributes.src) {
    const imgSrc = element.attributes.src;
    stats.total++;
    
    console.log(`\n[IMAGE] Processing: ${imgSrc}`);
    
    try {
      if (imgSrc.trim() === '') {
        console.log(`[IMAGE] Empty src attribute, skipping.`);
        stats.failed++;
        return stats;
      }
      
      // Variables to keep track of the image information
      let imgFilename;
      let imgPath = '';
      let fullUrl = imgSrc;
      let isAssetPath = false;
      
      // Case 1: Handle assets/ prefix which needs special handling
      if (imgSrc.startsWith('assets/')) {
        isAssetPath = true;
        const assetPathParts = imgSrc.substring(7).split('/'); // Remove 'assets/'
        imgFilename = assetPathParts.pop(); // Last part is the filename
        imgPath = assetPathParts.length > 0 ? assetPathParts.join('/') : '';
        
        console.log(`[IMAGE] Asset path detected. Filename: ${imgFilename}, Path: ${imgPath}`);
        
        // We need to resolve against the base URL
        if (baseURL) {
          try {
            // This handles both absolute and relative asset paths
            const base = new URL(baseURL);
            fullUrl = new URL(imgSrc, base).toString();
            console.log(`[IMAGE] Resolved asset URL: ${fullUrl}`);
          } catch (e) {
            console.error(`[IMAGE] Error resolving URL: ${e.message}`);
            fullUrl = imgSrc; // Use as-is if resolution fails
          }
        }
      }
      // Case 2: Handle protocol-relative URLs (//example.com/image.jpg)
      else if (imgSrc.startsWith('//')) {
        fullUrl = 'https:' + imgSrc;
        console.log(`[IMAGE] Protocol-relative URL. Using: ${fullUrl}`);
        
        try {
          const imgUrl = new URL(fullUrl);
          const pathname = imgUrl.pathname;
          imgFilename = path.basename(pathname.split('?')[0]);
          imgPath = path.dirname(pathname).replace(/^\//, '');
          console.log(`[IMAGE] Parsed URL - Filename: ${imgFilename}, Path: ${imgPath}`);
        } catch (e) {
          console.error(`[IMAGE] URL parsing error: ${e.message}`);
          imgFilename = path.basename(imgSrc.split('?')[0]);
        }
      }
      // Case 3: Standard URLs and paths
      else if (!isAssetPath) {
        try {
          // Try to parse as a complete URL first
          if (fullUrl.startsWith('http://') || fullUrl.startsWith('https://')) {
            const imgUrl = new URL(fullUrl);
            const pathname = imgUrl.pathname;
            imgFilename = path.basename(pathname.split('?')[0]);
            imgPath = path.dirname(pathname).replace(/^\//, '');
          }
          // Then try to resolve against base URL if it's a relative path
          else if (baseURL) {
            try {
              const fullUrlObj = new URL(imgSrc, baseURL);
              fullUrl = fullUrlObj.toString();
              const pathname = fullUrlObj.pathname;
              imgFilename = path.basename(pathname.split('?')[0]);
              imgPath = path.dirname(pathname).replace(/^\//, '');
            } catch (e) {
              console.error(`[IMAGE] Error resolving relative URL: ${e.message}`);
              // Fall back to simple path extraction
              imgFilename = path.basename(imgSrc.split('?')[0]);
            }
          } else {
            // Simple path extraction without base URL
            imgFilename = path.basename(imgSrc.split('?')[0]);
          }
          console.log(`[IMAGE] Parsed path - Filename: ${imgFilename}, Path: ${imgPath}`);
        } catch (e) {
          console.error(`[IMAGE] Path parsing error: ${e.message}`);
          // Fall back to simple path extraction
          imgFilename = path.basename(imgSrc.split('?')[0]);
        }
      }
      
      // Ensure we have a valid filename
      if (!imgFilename || imgFilename === '.' || imgFilename === '..') {
        const randomId = Math.random().toString(36).substring(2, 10);
        imgFilename = `image-${randomId}.jpg`;
        console.log(`[IMAGE] Generated random filename: ${imgFilename}`);
      }
      
      // Create target directory if needed
      const targetDir = imgPath ? path.join(assetsDir, imgPath) : assetsDir;
      if (imgPath && !fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
        console.log(`[IMAGE] Created directory: ${targetDir}`);
      }
      
      const outputPath = path.join(targetDir, imgFilename);
      console.log(`[IMAGE] Target path: ${outputPath}`);
      
      // Case A: URLs (http://, https://, resolved from relative paths)
      if (fullUrl.startsWith('http://') || fullUrl.startsWith('https://')) {
        console.log(`[IMAGE] Downloading from: ${fullUrl}`);
        
        try {
          const response = await axios({
            method: 'GET',
            url: fullUrl,
            responseType: 'arraybuffer',
            timeout: 30000, // 30 second timeout
            maxContentLength: 50 * 1024 * 1024, // 50MB max
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
              'Accept': 'image/*',
              'Accept-Encoding': 'gzip, deflate, br'
            },
            maxRedirects: 5,
            validateStatus: status => status < 400
          });
          
          // Check content type to make sure it's an image
          const contentType = response.headers['content-type'];
          if (contentType && contentType.startsWith('image/')) {
            fs.writeFileSync(outputPath, Buffer.from(response.data));
            console.log(`[IMAGE] ✅ SUCCESS: Downloaded and saved image (${contentType}, ${response.data.length} bytes)`);
            
            // Always update the src to the new relative path
            const relativePath = imgPath ? `assets/${imgPath}/${imgFilename}` : `assets/${imgFilename}`;
            element.attributes.src = relativePath;
            console.log(`[IMAGE] Updated src attribute to: ${relativePath}`);
            stats.success++;
          } else {
            console.error(`[IMAGE] ❌ ERROR: Response is not an image: ${contentType}`);
            
            // Still update the src attribute for consistency
            const relativePath = imgPath ? `assets/${imgPath}/${imgFilename}` : `assets/${imgFilename}`;
            element.attributes.src = relativePath;
            stats.failed++;
          }
        } catch (error) {
          console.error(`[IMAGE] ❌ ERROR downloading: ${error.message}`);
          
          // For network errors, still update the src attribute
          const relativePath = imgPath ? `assets/${imgPath}/${imgFilename}` : `assets/${imgFilename}`;
          element.attributes.src = relativePath;
          stats.failed++;
        }
      } 
      // Case B: Base64 data URLs
      else if (imgSrc.startsWith('data:image/')) {
        console.log(`[IMAGE] Processing base64 image`);
        
        try {
          const matches = imgSrc.match(/^data:image\/([a-zA-Z]+);base64,(.+)$/);
          if (matches && matches.length === 3) {
            const extension = matches[1];
            const data = matches[2];
            const buffer = Buffer.from(data, 'base64');
            
            const filename = imgFilename.includes('.') ? 
              imgFilename : 
              `${imgFilename}.${extension}`;
            
            const finalOutputPath = path.join(targetDir, filename);
            fs.writeFileSync(finalOutputPath, buffer);
            console.log(`[IMAGE] ✅ SUCCESS: Saved base64 image (${buffer.length} bytes)`);
            
            const relativePath = imgPath ? `assets/${imgPath}/${filename}` : `assets/${filename}`;
            element.attributes.src = relativePath;
            console.log(`[IMAGE] Updated src attribute to: ${relativePath}`);
            stats.success++;
          } else {
            console.error(`[IMAGE] ❌ ERROR: Invalid data URL format`);
            
            const relativePath = imgPath ? `assets/${imgPath}/${imgFilename}` : `assets/${imgFilename}`;
            element.attributes.src = relativePath;
            stats.failed++;
          }
        } catch (error) {
          console.error(`[IMAGE] ❌ ERROR processing base64 image: ${error.message}`);
          
          const relativePath = imgPath ? `assets/${imgPath}/${imgFilename}` : `assets/${imgFilename}`;
          element.attributes.src = relativePath;
          stats.failed++;
        }
      } 
      // Case C: All other types (local paths, etc.)
      else {
        console.log(`[IMAGE] Using local path: ${imgSrc}`);
        
        // Simply update the src attribute to maintain consistency
        const relativePath = imgPath ? `assets/${imgPath}/${imgFilename}` : `assets/${imgFilename}`;
        element.attributes.src = relativePath;
        console.log(`[IMAGE] Updated src attribute to: ${relativePath}`);
        stats.success++;
      }
    } catch (error) {
      console.error(`[IMAGE] ❌ CRITICAL ERROR processing image ${imgSrc}: ${error.message}`);
      stats.failed++;
    }
  }
  
  // Recursively process children
  if (element.children && Array.isArray(element.children)) {
    for (const child of element.children) {
      await extractImagesFromElement(child, assetsDir, baseURL, jsonData, stats);
    }
  }
  
  return stats;
}

function generateHtml(page, allPages) {
  const htmlContent = renderElement(page.html);
  
  if (htmlContent.trim().toLowerCase().startsWith('<!doctype') || 
      htmlContent.trim().toLowerCase().startsWith('<html')) {
    return htmlContent;
  }
    
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${getPageTitle(page)}</title>
</head>
<body>
  <main>
    ${htmlContent}
  </main>
</body>
</html>`;
}

function getPageTitle(page) {
  const url = new URL(page.url);
  const pathParts = url.pathname.split('/').filter(Boolean);
  if (pathParts.length > 0) {
    return pathParts[pathParts.length - 1]
      .replace(/-/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase());
  }
  
  return 'Home';
}

function renderElement(element) {
  if (!element) return '';
  
  const tag = element.tagName || element.tag;
  if (!tag) return element.text || element.textContent || '';
  
  const voidElements = ['img', 'br', 'hr', 'input', 'meta', 'link'];
  const tagLower = tag.toLowerCase();
  
  if (tagLower === 'img' && element.attributes && element.attributes.src) {
    processImageSrc(element);
  }
  
  if (voidElements.includes(tagLower)) {
    const attrs = renderAttributes(element.attributes);
    return `<${tag}${attrs}>`;
  }
  
  if (tagLower === 'script' || tagLower === 'style') {
    const attrs = renderAttributes(element.attributes);
    const content = element.text || element.textContent || '';
    return `<${tag}${attrs}>${content}</${tag}>`;
  }
  
  if (element.attributes) {
    cleanupAngularAttributes(element.attributes);
  }
  
  if (element.attributes && element.attributes.class && 
      element.attributes.class.includes('navigation-2-plugin')) {
    return renderNavigationPlugin(element);
  }
  
  if (tagLower === 'a' && element.attributes && element.attributes.href) {
    processAnchorHref(element);
  }
  
  const attrs = renderAttributes(element.attributes);
  const content = element.children?.map(child => renderElement(child)).join('') || '';
  const text = element.text || element.textContent || '';
  
  return `<${tag}${attrs}>${content}${text}</${tag}>`;
}

function processImageSrc(element) {
  if (!element.attributes.src.startsWith('assets/') && 
      !element.attributes.src.startsWith('http://') && 
      !element.attributes.src.startsWith('https://') && 
      !element.attributes.src.startsWith('data:')) {
    
    try {
      const imgUrl = new URL(element.attributes.src);
      const pathname = imgUrl.pathname;
      const imgFilename = path.basename(pathname);
      const imgPath = path.dirname(pathname).replace(/^\//, '');
      
      if (imgPath && imgPath !== '.') {
        element.attributes.src = `assets/${imgPath}/${imgFilename}`;
      } else {
        element.attributes.src = `assets/${imgFilename}`;
      }
    } catch (e) {
      const imgFilename = path.basename(element.attributes.src);
      element.attributes.src = `assets/${imgFilename}`;
    }
  }
}

function processAnchorHref(element) {
  const href = element.attributes.href;
  if (!href.startsWith('http://') && !href.startsWith('https://') && !href.startsWith('#')) {
    let hrefPath = href.replace(/\.html$/, '');
    
    if (!hrefPath.endsWith('.html') && !hrefPath.includes('#') && !hrefPath.includes('?')) {
      element.attributes.href = hrefPath + '.html';
    }
  }
}

function cleanupAngularAttributes(attributes) {
  Object.keys(attributes).forEach(key => {
    if (key.startsWith('data-ng-') || key.startsWith('ng-') || 
        key.startsWith('data-k-') || key.startsWith('data-kendo-')) {
      delete attributes[key];
    }
  });
}

function renderNavigationPlugin(element) {
  const attrs = renderAttributes(element.attributes);
  
  let styleContent = '';
  if (element.children) {
    const styleElements = element.children.filter(child => 
      (child.tagName || child.tag)?.toLowerCase() === 'style');
    if (styleElements.length > 0) {
      styleContent = styleElements.map(style => renderElement(style)).join('');
    }
  }
  
  let navContent = '';
  if (element.children) {
    const innerDiv = element.children.find(child => 
      (child.tagName || child.tag)?.toLowerCase() === 'div' && 
      child.attributes && 
      child.attributes.class && 
      child.attributes.class.includes('neo-asset-inner'));
    
    if (innerDiv && innerDiv.children) {
      const ulElement = innerDiv.children.find(child => 
        (child.tagName || child.tag)?.toLowerCase() === 'ul');
      
      if (ulElement) {
        if (ulElement.attributes) {
          cleanupAngularAttributes(ulElement.attributes);
        }
        
        if (ulElement.children) {
          ulElement.children.forEach(li => {
            if (li.attributes) {
              cleanupAngularAttributes(li.attributes);
            }
          });
        }
        
        navContent = renderElement(ulElement);
      } else {
        navContent = innerDiv.children.map(child => renderElement(child)).join('');
      }
    } else {
      navContent = element.children
        .filter(child => (child.tagName || child.tag)?.toLowerCase() !== 'style')
        .map(child => renderElement(child))
        .join('');
    }
  }
  
  return `<div${attrs}>${styleContent}<div class="neo-asset-inner" style="background-color: rgba(255, 255, 255, 0); opacity: 1; border-style: none; border-color: rgb(51, 51, 51); background-image: none; box-shadow: rgba(0, 0, 0, 0.5) 0px 0px 0px 0px;">${navContent}</div></div>`;
}

function renderAttributes(attributes) {
  if (!attributes) return '';
  
  return Object.entries(attributes).map(([key, value]) => {
    if (key === 'children' || key === 'text' || key === 'textContent') {
      return '';
    }
    
    if (value === true) return ` ${key}`;
    if (value === false || value === null || value === undefined) return '';
    
    if (key.startsWith('data-') && typeof value === 'object') {
      try {
        return ` ${key}='${JSON.stringify(value).replace(/'/g, '&apos;')}'`;
      } catch (e) {
        return ` ${key}='${value.toString().replace(/'/g, '&apos;')}'`;
      }
    }
    
    if (key === 'style' && typeof value === 'object') {
      try {
        const styleString = Object.entries(value)
          .map(([prop, val]) => `${prop}:${val}`)
          .join(';');
        return ` ${key}='${styleString.replace(/'/g, '&apos;')}'`;
      } catch (e) {
        return ` ${key}='${value.toString().replace(/'/g, '&apos;')}'`;
      }
    }
    
    const stringValue = value.toString();
    
    if (stringValue.includes('"')) {
      return ` ${key}='${stringValue.replace(/'/g, '&apos;')}'`;
    } else {
      return ` ${key}="${stringValue}"`;
    }
  }).join('');
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const jsonFilePath = args[0] || './mocks/cluster-pupetteer-jeanette-2.json';
  const outputDir = args[1] || 'static-site';
  
  generateStaticFiles(jsonFilePath, outputDir)
    .then(() => console.log('Static site generation completed successfully!'))
    .catch(error => console.error('Error generating static site:', error));
}

module.exports = { generateStaticFiles };