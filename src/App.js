import React, { useState, useEffect, useCallback } from "react";
import { convertStyleStringToObject, extractBaseUrl } from "./utils/utils";

const WebsiteBuilder = () => {
  const [template, setTemplate] = useState([]);
  const [baseUrl, setBaseUrl] = useState('');

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const json = JSON.parse(e.target.result);
   
          let children;
          if (json.html && json.html.children) {
            children = json.html.children;
          } else if (json.structure && json.structure.children) {
            children = json.structure.children;
          }
          
          setTemplate(children || []);
          setBaseUrl(extractBaseUrl(json));
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
          const imageSrc = element.attributes?.src;
          const fullSrc = imageSrc?.startsWith('assets/') 
            ? `${baseUrl}${imageSrc}`
            : imageSrc;
          return <img {...commonProps} src={fullSrc} alt={element.attributes?.alt || ''} />;
        }

        case "a":
          return (
            <Tag {...commonProps} href={element.attributes?.href}>
              {children}
              {content}
            </Tag>
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
  }, [baseUrl]);

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
        {template.length > 0 ? (
          template.map((element, index) => renderElement(element, index))
        ) : (
          <div className="text-gray-500">No content to display</div>
        )}
      </div>
    </div>
  );
};

export default WebsiteBuilder;