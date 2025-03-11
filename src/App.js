// Test change to verify hot reloading - added on troubleshooting
import React, { useState, useEffect, useCallback } from "react";
import { convertStyleStringToObject, extractBaseUrl } from "./utils/utils";
import { Link } from "react-router-dom";
import style from './style.module.scss';

const WebsiteBuilder = () => {
  const [pages, setPages] = useState([]);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [baseUrl, setBaseUrl] = useState('');
  const [jsonData, setJsonData] = useState(null);
  const [generationStatus, setGenerationStatus] = useState('');
  const [generatedSites, setGeneratedSites] = useState([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [runningSites, setRunningSites] = useState({});
  const [isStartingSite, setIsStartingSite] = useState(false);

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const json = JSON.parse(e.target.result);
          setJsonData(json); // Store the full JSON data
          const pagesData = json.pages || [];
          setPages(pagesData);
          setBaseUrl(extractBaseUrl(json));
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

  const handleRunSite = async (siteName) => {
    try {
      console.log(`Starting site: ${siteName}`);
      
      setIsStartingSite(true); // Set to true before making the API call
      
      const response = await fetch('http://localhost:3001/api/serve-site', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ siteName }),
      });
      
      if (!response.ok) {
        throw new Error(`Server responded with status: ${response.status}`);
      }
      
      const result = await response.json();
      
      if (result.success) {
        console.log(`Site started successfully: ${result.url}`);
        
        // Update the running sites state
        setRunningSites(prev => ({
          ...prev,
          [siteName]: {
            url: result.url,
            port: result.port
          }
        }));
        
        // Open the site in a new tab
        window.open(result.url, '_blank');
      } else {
        console.error(`Failed to start site: ${result.message}`);
        alert(`Failed to start site: ${result.message}`);
      }
    } catch (error) {
      console.error('Error starting site:', error);
      alert(`Error starting site: ${error.message}`);
    } finally {
      setIsStartingSite(false); // Set back to false after the API call completes
    }
  };

  const handleStopSite = async (siteName) => {
    try {
      const response = await fetch('http://localhost:3001/api/stop-site', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ siteName }),
      });
      
      const result = await response.json();
      
      if (result.success) {
        // Remove from running sites
        setRunningSites(prev => {
          const newState = { ...prev };
          delete newState[siteName];
          return newState;
        });
      } else {
        alert(`Failed to stop site: ${result.message}`);
      }
    } catch (error) {
      console.error('Error stopping site:', error);
      alert(`Error stopping site: ${error.message}`);
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
            <a 
              {...commonProps}
              href={element.attributes?.href || '#'} 
              onClick={(e) => { 
                e.preventDefault();
                if (element.attributes?.href) {
                  console.log(`Link clicked: ${element.attributes.href}`);
                  
                  // Clean up the href path
                  let hrefPath = element.attributes.href.replace(/\.html$/, '');
                  if (hrefPath.startsWith('/')) {
                    hrefPath = hrefPath.substring(1);
                  }
                  console.log("Processed hrefPath:", hrefPath);

                  // Map common path patterns
                  const pathMapping = {
                    'about-us': 'about',
                    'about_us': 'about',
                    'aboutus': 'about',
                    'products-services': 'products',
                    'products_services': 'products',
                    'productsservices': 'products',
                    'contact-us': 'contact',
                    'contact_us': 'contact',
                    'contactus': 'contact',
                  };

                  // Apply mapping if available
                  const mappedPath = pathMapping[hrefPath] || hrefPath;
                  
                  // Find the matching page
                  const pageIndex = pages.findIndex(page => {
                    // Extract the path from the URL
                    const pageUrlPath = new URL(page.url).pathname;
                    
                    // Clean up the page URL path
                    const cleanPagePath = pageUrlPath.replace(/\/$/, '').replace(/^\//, '');
                    
                    console.log(`Comparing '${mappedPath}' with page path '${cleanPagePath}'`);
                    
                    // Check for exact match
                    if (cleanPagePath === mappedPath) return true;
                    
                    // Check for partial match (end of path)
                    if (cleanPagePath.endsWith(`/${mappedPath}`)) return true;
                    
                    // Check if the page filename matches
                    if (mappedPath === 'about' && cleanPagePath.includes('about')) return true;
                    if (mappedPath === 'products' && cleanPagePath.includes('product')) return true;
                    if (mappedPath === 'contact' && cleanPagePath.includes('contact')) return true;
                    
                    return false;
                  });

                  if (pageIndex !== -1) {
                    console.log(`Found matching page at index ${pageIndex}`);
                    setCurrentPageIndex(pageIndex);
                  } else {
                    console.error(`Page not found for href: ${element.attributes.href}`);
                  }
                }
              }}
              style={{ cursor: 'pointer', ...commonProps.style }}
            >
              {children}
              {content}
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
    <div>
      <div className="control-container">
        <label className={ style.control_label }>
          Import JSONS
          <input
            type="file"
            accept=".json"
            onChange={handleFileUpload}
            style={{ marginLeft: '20px'}}
          />
        </label>
        
        {/* Add the button for generating static files */}
        <div className="mt-4">
          <button
            onClick={handleGenerateStaticFiles}
            disabled={!jsonData || isGenerating}
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
            <div className={style.section}> 
              <h3>Generated Sites:</h3>
              <ul>
                {generatedSites.map((site, index) => (
                  <li key={index} className={style.site_item}>
                    <div className={style.site_info}>
                      <a 
                        href={site.url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                      >
                        {site.name}
                      </a>
                      
                      {runningSites[site.name] && (
                        <span className={style.running_badge}>
                          Running on port {runningSites[site.name].port}
                        </span>
                      )}
                    </div>
                    
                    <div className={style.site_actions}>
                      {!runningSites[site.name] ? (
                        <button
                          onClick={() => handleRunSite(site.name)}
                          disabled={isStartingSite}
                          className={style.run_button}
                        >
                          {isStartingSite ? 'Starting...' : 'Run on New Port'}
                        </button>
                      ) : (
                        <div>
                          <a 
                            href={runningSites[site.name].url}
                            target="_blank" 
                            rel="noopener noreferrer"
                            className={style.view_button}
                          >
                            View Site
                          </a>
                          <button
                            onClick={() => handleStopSite(site.name)}
                            className={style.stop_button}
                          >
                            Stop Server
                          </button>
                        </div>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      <div className="website-content">
        {pages.length > 0 ? (
          pages[currentPageIndex].html.children.map((element, index) => renderElement(element, index))
        ) : (
          <div className="text-gray-500">No content to display - Hot Reload Test (Updated)</div>
        )}
      </div>
    </div>
  );
};

export default WebsiteBuilder;