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

async function extractAndSaveImages(jsonData, assetsDir) {
  if (jsonData.pages) {
    for (const page of jsonData.pages) {
      if (page.html) {
        await extractImagesFromElement(page.html, assetsDir);
      }
    }
  }
}

async function extractImagesFromElement(element, assetsDir) {
  if (!element) return;
  
  const tag = element.tagName || element.tag;
  if (tag && tag.toLowerCase() === 'img' && element.attributes && element.attributes.src) {
    const imgSrc = element.attributes.src;
    
    try {
      if (imgSrc.includes('logger.php') || imgSrc.trim() === '') {
        return;
      }
      
      let imgFilename;
      let imgPath = '';
      let fullUrl = imgSrc;
      
      if (imgSrc.startsWith('//')) {
        fullUrl = 'https:' + imgSrc;
      }
      
      try {
        const imgUrl = new URL(fullUrl);
        
        const pathname = imgUrl.pathname;
        
        imgFilename = path.basename(pathname.split('?')[0]);
        
        imgPath = path.dirname(pathname).replace(/^\//, '');
      } catch (e) {
        imgFilename = path.basename(imgSrc.split('?')[0]);
      }
      
      if (!imgFilename || imgFilename === '.' || imgFilename === '..') {
        imgFilename = 'image-' + Math.random().toString(36).substring(2, 10) + '.jpg';
      }
      
      const targetDir = imgPath ? path.join(assetsDir, imgPath) : assetsDir;
      if (imgPath && !fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
        console.log(`Created directory: ${targetDir}`);
      }
      
      const outputPath = path.join(targetDir, imgFilename);
      
      if (fullUrl.startsWith('http://') || fullUrl.startsWith('https://')) {
        console.log(`Downloading image from: ${fullUrl}`);
        
        try {
          const response = await axios({
            method: 'GET',
            url: fullUrl,
            responseType: 'arraybuffer',
            timeout: 30000,
            maxContentLength: 50 * 1024 * 1024,
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
              'Accept': 'image/*',
              'Accept-Encoding': 'gzip, deflate, br'
            },
            maxRedirects: 5,
            validateStatus: status => status < 400
          });
          
          const contentType = response.headers['content-type'];
          if (contentType && contentType.startsWith('image/')) {
            fs.writeFileSync(outputPath, Buffer.from(response.data));
            console.log(`Downloaded image to: ${outputPath}`);
            
            const relativePath = imgPath ? `assets/${imgPath}/${imgFilename}` : `assets/${imgFilename}`;
            element.attributes.src = relativePath;
          } else {
            throw new Error(`Response is not an image: ${contentType}`);
          }
        } catch (error) {
          console.error(`Error downloading image: ${error.message}`);
          
          createPlaceholderImage(imgFilename, outputPath, targetDir);
          
          const relativePath = imgPath ? `assets/${imgPath}/${imgFilename}` : `assets/${imgFilename}`;
          element.attributes.src = relativePath;
        }
      } else if (imgSrc.startsWith('data:image/')) {
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
            console.log(`Saved base64 image to: ${finalOutputPath}`);
            
            const relativePath = imgPath ? `assets/${imgPath}/${filename}` : `assets/${filename}`;
            element.attributes.src = relativePath;
          } else {
            throw new Error('Invalid data URL format');
          }
        } catch (error) {
          console.error(`Error processing base64 image: ${error.message}`);
          createPlaceholderImage(imgFilename, outputPath, targetDir);
          
          const relativePath = imgPath ? `assets/${imgPath}/${imgFilename}` : `assets/${imgFilename}`;
          element.attributes.src = relativePath;
        }
      } else {
        createPlaceholderImage(imgFilename, outputPath, targetDir);
        
        const relativePath = imgPath ? `assets/${imgPath}/${imgFilename}` : `assets/${imgFilename}`;
        element.attributes.src = relativePath;
      }
    } catch (error) {
      console.error(`Error processing image ${imgSrc}: ${error.message}`);
    }
  }
  
  if (element.children && Array.isArray(element.children)) {
    for (const child of element.children) {
      await extractImagesFromElement(child, assetsDir);
    }
  }
}

function createPlaceholderImage(imgFilename, outputPath, targetDir) {
  const svgContent = `<svg width="200" height="200" xmlns="http://www.w3.org/2000/svg">
    <rect width="200" height="200" fill="#f0f0f0"/>
    <text x="50%" y="50%" font-family="Arial" font-size="16" text-anchor="middle" dominant-baseline="middle" fill="#333">
      Image: ${imgFilename}
    </text>
  </svg>`;
  
  const svgFilename = imgFilename.replace(/\.[^/.]+$/, '') + '.svg';
  const svgPath = path.join(targetDir, svgFilename);
  fs.writeFileSync(svgPath, svgContent);
  
  if (!imgFilename.toLowerCase().endsWith('.svg')) {
    try {
      fs.copyFileSync(svgPath, outputPath);
    } catch (error) {
      fs.writeFileSync(outputPath, svgContent);
    }
  }
  
  console.log(`Created placeholder for image: ${imgFilename}`);
}

function generateHtml(page, allPages) {
  const htmlContent = renderElement(page.html);
  
  if (htmlContent.trim().toLowerCase().startsWith('<!doctype') || 
      htmlContent.trim().toLowerCase().startsWith('<html')) {
    return htmlContent;
  }
  
  const hasNavigation = checkForNavigation(page.html);
  
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${getPageTitle(page)}</title>
  <!-- No custom CSS link - only using CSS from JSON file -->
</head>
<body>
  <main>
    ${htmlContent}
  </main>
</body>
</html>`;
}

function cleanupHtml(html) {
  let cleaned = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  
  cleaned = cleaned.replace(/\s+data-ng-[a-zA-Z-]+="[^"]*"/g, '');
  cleaned = cleaned.replace(/\s+ng-[a-zA-Z-]+="[^"]*"/g, '');
  
  cleaned = cleaned.replace(/<div id="includes"[^>]*>.*?<\/div>/gs, '');
  
  return cleaned;
}

function checkForNavigation(element) {
  if (!element) return false;
  
  const tag = element.tagName || element.tag;
  
  if (tag && tag.toLowerCase() === 'nav') {
    return true;
  }
  
  if (element.attributes && element.attributes.class) {
    const classStr = element.attributes.class.toString().toLowerCase();
    if (classStr.includes('navigation-2-plugin') || 
        classStr.includes('nav') || 
        classStr.includes('menu') || 
        classStr.includes('header')) {
      return true;
    }
  }
  
  if (tag && ['ul', 'ol'].includes(tag.toLowerCase())) {
    if (element.children && Array.isArray(element.children)) {
      const hasLinks = element.children.some(child => {
        const childTag = child.tagName || child.tag;
        if (childTag && childTag.toLowerCase() === 'li') {
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
  
  if (tag && tag.toLowerCase() === 'div' && 
      element.attributes && element.attributes.id && 
      (element.attributes.id.includes('nav') || 
       element.attributes.id.includes('menu') || 
       element.attributes.id.includes('header'))) {
    return true;
  }
  
  if (element.children && Array.isArray(element.children)) {
    return element.children.some(child => checkForNavigation(child));
  }
  
  return false;
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