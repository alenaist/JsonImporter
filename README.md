# JSON to HTML Website Builder

A React-based tool that converts JSON website data into interactive HTML websites. This project allows you to import JSON files containing website structure and dynamically renders them as fully functional web pages, with the option to generate static HTML sites.

## Features

- 📄 JSON to HTML conversion with preserved styling
- 🔄 Dynamic page navigation and component rendering
- 🖼️ Asset handling with proper base URL resolution
- 🎨 Style preservation and conversion
- 📱 Responsive design support
- 🔗 Internal link handling
- 📦 Static site generation for deployment

## Demo

The application offers two main functionalities:

1. **Interactive Viewer**: Upload JSON website data and interact with the rendered website in real-time
2. **Static Site Generator**: Convert JSON data into static HTML files that can be hosted anywhere

## Getting Started

### Prerequisites

- Node.js (v14.0.0 or higher)
- npm (v6.0.0 or higher)

### Installation

1. Clone the repository:

```bash
git clone https://github.com/yourusername/json-to-html-builder.git
cd json-to-html-builder
```

2. Install dependencies:

```bash
npm install
```

### Usage

#### Development Mode

Run the application in development mode with both the React frontend and Express backend:

```bash
npm run dev
```

This will start:
- React frontend on http://localhost:3000
- Express backend on http://localhost:3001

#### Static Site Generation

To generate a static website from a JSON file:

```bash
npm run generate-static [jsonFilePath] [outputDir]
```

Parameters:
- `jsonFilePath` - Path to your JSON file (default: ./mocks/cluster-pupetteer-jeanette-2.json)
- `outputDir` - Directory to save generated files (default: static-site)

#### Preview Static Site

To preview a generated static site:

```bash
npm run run-static [jsonFilePath] [outputDir] [port]
```

Parameters:
- `jsonFilePath` - Path to your JSON file (default: ./mocks/cluster-pupetteer-jeanette-2.json)
- `outputDir` - Directory of generated files (default: static-site)
- `port` - Port to run preview server on (default: 8080)

#### Production Build

Build the application for production:

```bash
npm run build
```

## JSON Structure

The JSON file should follow this structure:

```json
{
  "url": "https://example.com/",
  "pages": [
    {
      "url": "https://example.com/",
      "link": "index.html",
      "html": {
        "tag": "body",
        "attributes": {
          "class": "some-class"
        },
        "children": [
          // HTML elements
        ],
        "text": null
      }
    },
    // Additional pages
  ]
}
```

Key points about the JSON structure:
- Each page needs a `url` field for base URL resolution
- Each page needs a `link` field for navigation routing
- HTML structure is represented as nested objects with `tag`, `attributes`, `children`, and `text` properties

## Architecture

The project consists of:

1. **React Frontend**:
   - Main application for viewing and interacting with rendered JSON data
   - Components for rendering different HTML elements
   - Utilities for processing styles and URLs

2. **Express Backend**:
   - API endpoints for processing JSON data
   - Static file generation logic
   - File serving capabilities

3. **Static Generation Scripts**:
   - Conversion of JSON to static HTML files
   - Asset processing and optimization
   - Link handling and routing

## Available Scripts

- `npm start` - Run the React frontend only
- `npm run server` - Run the Express backend only
- `npm run dev` - Run both frontend and backend concurrently
- `npm run generate-static` - Generate static HTML files from JSON
- `npm run run-static` - Preview generated static site
- `npm run build` - Build the application for production
- `npm test` - Run tests

## Requirements

The application supports modern browsers and requires JavaScript to be enabled.

## License

[MIT License](LICENSE)

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the project
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request