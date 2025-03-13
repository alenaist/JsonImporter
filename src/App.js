import React, { useState, useEffect, useCallback } from "react";
import { convertStyleStringToObject, extractBaseUrl } from "./utils/utils";
import style from "./style.scss";

const WebsiteBuilder = () => {
  const [pages, setPages] = useState([]);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [baseUrl, setBaseUrl] = useState('');
  const [jsonData, setJsonData] = useState(null);
  const [generationStatus, setGenerationStatus] = useState('');
  const [generatedSites, setGeneratedSites] = useState([]);
  const [isGenerating, setIsGenerating] = useState(false);

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const json = JSON.parse(e.target.result);
          setJsonData(json);
          const pagesData = json.pages || [];
          setPages(pagesData);
          setBaseUrl(extractBaseUrl(json));
          console.log(jsonData);
        } catch (error) {
          console.error("Error parsing JSON:", error);
        }
      };
      reader.readAsText(file);
    }
  };

  const handleGenerateStaticFiles = async () => {
    if (!jsonData) {
      setGenerationStatus('No JSON data loaded. Please upload a file first.');
      return;
    }

    setIsGenerating(true);
    setGenerationStatus('Generating static files...');

    try {
      const response = await fetch('http://localhost:3001/api/generate-static', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(jsonData),
      });

      const result = await response.json();

      if (result.success) {
        setGenerationStatus(`Static files generated successfully in: ${result.siteName}`);
        setGeneratedSites(prevSites => [...prevSites, {
          name: result.siteName,
          url: `http://localhost:3001/generated/${result.siteName}/index.html`
        }]);
      } else {
        setGenerationStatus(`Error: ${result.message}`);
      }
    } catch (error) {
      console.error('Error generating static files:', error);
      setGenerationStatus(`Error: ${error.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const renderElement = useCallback((element, index) => {
    if (!element) return null;
    
    const tagType = element.tagName || element.tag;
    if (!tagType) return null;

    const content = element.text || element.textContent;

    const commonProps = {
      key: index,
      id: element.attributes?.id,
      className: element.attributes?.class,
      style: convertStyleStringToObject(element.attributes?.style)
    };

    const children = element.children?.map((child, childIndex) =>
      renderElement(child, `${index}-${childIndex}`)
    );

    const Tag = tagType.toLowerCase();

    if (["div", "ul", "li", "strong", "span", "p", "a", "input", "script", "style", "img", "br", "meta", "link", "title", "form", "head", "body", "html", "noscript"].includes(Tag)) {
      switch (Tag) {
        case "script":
        case "style":
          return (
            <Tag {...commonProps} 
              dangerouslySetInnerHTML={{ __html: content || '' }}
            />
          );

        case "img": {          
          const imageSrc = element.attributes?.src;
          const fullSrc = imageSrc?.startsWith('assets/') 
            ? `${baseUrl}${imageSrc}`
            : imageSrc;
          return <img {...commonProps} src={fullSrc} alt={element.attributes?.alt || ''} />;
        }

        case "a":

          return (
            <a onClick={(e) => { e.preventDefault(); }}>
            <span
              {...commonProps}
              onClick={() => {
                if (element.attributes?.href) {

                  console.log(element.attributes.href);
                  
                  let hrefPath = element.attributes.href.replace(/\.html$/, '');
                  console.log("Processed hrefPath:", hrefPath);

                  //update this to handle better routing without hardcoding
                  const pathMapping = {
                    'about-us': '/about',
                  };

                  hrefPath = pathMapping[hrefPath] || hrefPath;

                  const pageIndex = pages.findIndex(page => {
                    const pageUrlPath = new URL(page.url).pathname.replace(/\/$/, '');
                    console.log("Comparing with pageUrlPath:", pageUrlPath);
                    return pageUrlPath.endsWith(hrefPath);
                  });

                  if (pageIndex !== -1) {
                    setCurrentPageIndex(pageIndex);
                  } else {
                    console.error("Page not found for href:", element.attributes.href);
                  }
                }
              }}
              style={{ cursor: 'pointer', ...commonProps.style }}
            >
              {children}
              {content}
            </span>
          </a>
          );

        case "meta":
        case "link":
        case "br":
        case "input":

          const { children: _, dangerouslySetInnerHTML: __, ...attrs } = element.attributes || {};
          return <Tag {...commonProps} {...attrs} />;

        default:
          return (
            <Tag {...commonProps}>
              {children}
              {content}
            </Tag>
          );
      }
    }

    console.warn(`Unsupported tag: ${Tag}`);
    return null;
  }, [baseUrl, pages]);

  return (
    <div style={{ padding: '20px' }}>
      <h3 style={{ marginTop: '0px' }}>JSON to HTML parser</h3>
      <div className="control-container">
        <label>
          Import JSON
          <input
            type="file"
            accept=".json"
            onChange={handleFileUpload}
            className="ml-2 mb-2"
            style={{ marginLeft: '10px' }}
          />
        </label>
                <div className="mt-4">
          <button
            onClick={handleGenerateStaticFiles}
            disabled={!jsonData || isGenerating}
            className={ style.generate_static_button }
            style={{ 
      
              cursor: jsonData && !isGenerating ? 'pointer' : 'not-allowed',
              marginTop: '10px'
            }}
          >
            {isGenerating ? 'Generating...' : 'Generate Static HTML Files'}
          </button>
          
          {generationStatus && (
            <div className="mt-2 text-sm" style={{ marginTop: '8px', fontSize: '14px' }}>
              {generationStatus}
            </div>
          )}
          
          {/* Display list of generated sites */}
          {generatedSites.length > 0 && (
            <div> 
              <h3>Generated Sites:</h3>
              <ul>
                {generatedSites.map((site, index) => (
                  <li key={index}>
                    <a 
                      href={site.url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-blue-500 hover:underline"
                    >
                      {site.name}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      <div className="website-content">
      {pages.length > 0 && pages[currentPageIndex].html.children.map((element, index) => 
        renderElement(element, index)
      )}
      </div>
    </div>
  );
};

export default WebsiteBuilder;