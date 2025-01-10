import React, { useState } from "react";
import { Upload } from "lucide-react";


let currentBuilder = 'nexus';
let nexusPlugins = [
  {
    type: 'text',
    plugin: 'plugin-Text'
  },
  {
    type: 'image',
    plugin: 'plugin-Image'
  },
  {    
    type: 'anchor',
    plugin: 'plugin-Anchor'
  }
]

// Sample JSON structure for demonstration
const sampleJson = {
  layout: {
    header: {
      type: "header",
      content: "Enter your json",
      style: { backgroundColor: "#f0f0f0", padding: "20px" },
    },
    sections: [
      /*       {
        type: 'image',
        src: '/api/placeholder/400/300',
        alt: 'Sample image',
        style: { width: '100%', maxWidth: '400px' }
      } */
    ],
  },
};

const WebsiteBuilder = () => {
  const [template, setTemplate] = useState(sampleJson);
  const [isNexus, setIsNexus] = useState(false);
  const [isSiteplus, setIsSiteplus] = useState(false);

  const wrapWithNexusStructure = (element, type) => {
    switch (type) {
      case 'text':
        return (
          <div className="container text-container">
            <div className="inner-container text-inner">
              <div className="wrapper text-wrapper" data-plugin="plugin-Text">
                {element}
              </div>
            </div>
          </div>
        );
      
      case 'navigation':
        return (
          <div className="container nav-container">
            <div className="inner-container nav-inner">
              <div className="wrapper nav-wrapper" data-plugin="plugin-Navigation">
                {element}
              </div>
            </div>
          </div>
        );
      
      case 'image':
        return (
          <div className="container image-container">
            <div className="inner-container image-inner">
              <div className="wrapper image-wrapper" data-plugin="plugin-Image">
                {element}
              </div>
            </div>
          </div>
        );
      
      case 'header':
        return (
          <div className="container header-container">
            <div className="inner-container header-inner">
              <div className="wrapper header-wrapper" data-plugin="plugin-Header">
                {element}
              </div>
            </div>
          </div>
        );
      
      default:
        // Default wrapper if type is not specified
        return (
          <div className="container">
            <div className="inner-container">
              <div className="wrapper">
                {element}
              </div>
            </div>
          </div>
        );
    }
  };

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const json = JSON.parse(e.target.result);
          setTemplate(json);
        } catch (error) {
          console.error("Error parsing JSON:", error);
        }
      };
      reader.readAsText(file);
    }
  };

  const renderElement = (element, index) => {
    const commonStyles = {
      position: "relative",
      padding: "4px",
      marginBottom: "10px",
    };

    let renderedElement;

    switch (element.type) {
      case "header":
        renderedElement = (
          <div key={index} style={{ ...commonStyles, ...element.style }}>
            <h1>{element.content}</h1>
          </div>
        );
        break;

      case "navigation":
        renderedElement = (
          <div
            key={index}
            style={{ ...element.style }}
          >
            <ul
              style={{
                display: "flex",
                gap: "1rem",
                listStyle: "none",
                padding: 0,
              }}
            >
              {element.items.map((item, i) => (
                <li key={i}>
                  <a
                    href={item.href}
                    style={{ ...element.itemStyle }}
                  >
                    {item.name}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        );
        break;

      case "text":
        renderedElement = (
          <div
            key={index}
            style={{ ...commonStyles, ...element.style }}
            className="cursor-pointer"
          >
            <p>{element.content}</p>
          </div>
        );
        break;
        
      case "image":
        renderedElement = (
          <div
            key={index}
            style={{ ...commonStyles, ...element.style }}
          >
            <img src={element.src} alt={element.alt} />
          </div>
        );
        break;

      default:
        return null;
    }

    // Wrap with Nexus structure if Nexus is selected
    return isNexus ? wrapWithNexusStructure(renderedElement, element.type) : renderedElement;
  };

  return (
    <div>
      <div style={{padding: '10px'}}>
        <label>
          Import JSON
          <input
            type="file"
            accept=".json"
            onChange={handleFileUpload}
            className="hidden"
            style={{marginLeft: '10px', marginBottom: '10px'}}
          />
        </label>

        <p>convert to:</p>
        <div>
          <label>Nexus</label>
          <input type="checkbox"       
            checked={isNexus}
            onChange={(e) => setIsNexus(e.target.checked)}></input>
        </div>
        <div>
          <label>Siteplus</label>
          <input type="checkbox"   
            checked={isSiteplus}
            onChange={(e) => setIsSiteplus(e.target.checked)}
          ></input>
        </div>
        
    
      </div>

      <div>
        {template.layout.navigation &&
          renderElement(template.layout.navigation)}
        {template.layout.header && renderElement(template.layout.header)}
        {template.layout.sections?.map((section, index) =>
          renderElement(section, index)
        )}
      </div>
    </div>
  );
};

export default WebsiteBuilder;
