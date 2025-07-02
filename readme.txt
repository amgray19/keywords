NOTE: This tool is 100% client-side. Uploaded files are never sent to any server and remain private in your browser.

Federal Forbidden Keyword Search Tool

This web application scans .docx files for specified keywords and generates a summary report, including visual charts of keyword frequencies.

FEATURES
- Fully client-side processing (no files ever leave your computer).
- Supports multiple Word documents at once.
- Preloaded keyword list (editable).
- Bar and pie chart visualization.
- Dark/light mode toggle.
- Offline capability with Service Worker caching.
- Strict Content Security Policy for enhanced security.

SECURITY
This tool is 100% client-side.
- Uploaded files are processed in your browser memory.
- No file content is sent to any server or stored externally.
- A strict Content Security Policy (CSP) is implemented to prevent script injection.
- Offline functionality is provided via Service Workers.

USAGE
1. Open the webpage in your browser.
2. Edit or extend the list of keywords.
3. Upload one or more .docx files.
4. Click "Generate Summary".
5. Review results and charts.
6. Use "Print or Save Summary" to export a report.

DEVELOPMENT
Local Setup
Clone the repository:
git clone https://github.com/yourusername/federal-keyword-tool.git

Serve the files locally (for example, with Python):
python3 -m http.server

Deploying to GitHub Pages
Push your main branch to GitHub.
Enable Pages in repository Settings > Pages.

Service Worker
The Service Worker (sw.js) caches:
- All scripts, styles, and images.
- keywords.txt
- CDN dependencies.

IMPORTANT:
When you update files, increment the cache version in sw.js:
const CACHE_NAME = 'ffkst-v2';
This ensures users get the latest version.

CSP REFERENCE
Example CSP meta tag in index.html:

<meta http-equiv="Content-Security-Policy"
      content="
        default-src 'self';
        script-src 'self' https://cdn.jsdelivr.net/npm https://unpkg.com;
        style-src 'self';
        img-src 'self' data:;
        connect-src 'self';
        font-src 'self';
        object-src 'none';
        base-uri 'self';
        form-action 'self';
      ">
