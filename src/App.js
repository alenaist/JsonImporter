import React, { useState, useEffect, useCallback } from "react";
import { convertStyleStringToObject, extractBaseUrl } from "./utils/utils";
import { Link } from "react-router-dom";

const WebsiteBuilder = () => {
  const [pages, setPages] = useState([]);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [baseUrl, setBaseUrl] = useState('');

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const json = JSON.parse(e.target.result);
          const pagesData = json.pages || [];
          console.log(json, 'la json');
          setPages(pagesData);
          setBaseUrl(extractBaseUrl(json));
          console.log(baseUrl, 'la base');
        } catch (error) {
          console.error("Error parsing JSON:", error);
        }
      };
      reader.readAsText(file);
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

          console.log(baseUrl)
          
          const imageSrc = element.attributes?.src;
          const fullSrc = imageSrc?.startsWith('assets/') 
            ? `${baseUrl}${imageSrc}`
            : imageSrc;
          return <img {...commonProps} src={fullSrc} alt={element.attributes?.alt || ''} />;
        }

        case "a":
          console.log("About us href:", element.attributes?.href);

          return (
            <a onClick={(e) => {
              e.preventDefault();
            }}>
              <span
                {...commonProps}
                onClick={() => {
                  if (element.attributes?.href) {                    
                    let hrefPath = element.attributes.href.replace(/\.html$/, '');
                    console.log("Processed hrefPath:", hrefPath);

                    const pathMapping = {
                      'about-us': '/about',
                    };

                    hrefPath = pathMapping[hrefPath] || hrefPath;

                    const pageIndex = pages.findIndex(page => {
                      const pageUrlPath = new URL(page.url).pathname.replace(/\/$/, '');
                      console.log("Comparing with pageUrlPath:", pageUrlPath);
                      return pageUrlPath.endsWith(hrefPath);
                    });

                    console.log("Page index for About us:", pageIndex);

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
    <div>
      <div className="p-4">
        <label className="flex items-center gap-2">
          Import JSON
          <input
            type="file"
            accept=".json"
            onChange={handleFileUpload}
            className="ml-2 mb-2"
          />
        </label>
      </div>

      <div className="website-content">
        {pages.length > 0 ? (
          pages[currentPageIndex].html.children.map((element, index) => renderElement(element, index))
        ) : (
          <div className="text-gray-500">No content to display</div>
        )}
      </div>
    </div>
  );
};

export default WebsiteBuilder;