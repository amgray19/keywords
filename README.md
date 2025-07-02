# Federal Forbidden Keyword Search Tool

This web application scans `.docx` files for specified keywords and generates a summary report, including visual charts of keyword frequencies.

---

## ✨ Features

- Fully **client-side** processing (no files ever leave your computer)
- Supports multiple Word documents at once
- Preloaded keyword list (editable)
- Bar and pie chart visualization
- Dark/light mode toggle
- Offline capability with Service Worker caching
- Strict Content Security Policy for enhanced security

---

## 🛡️ Security

**This tool is 100% client-side.**

- Uploaded files are processed in your browser memory.
- No file content is sent to any server or stored externally.
- A strict [Content Security Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP) is implemented to prevent script injection.
- Offline functionality is provided via Service Workers.

---

## 🚀 Usage

1. Open the webpage in your browser.
2. Edit or extend the list of keywords.
3. Upload one or more `.docx` files.
4. Click **Generate Summary**.
5. Review results and charts.
6. Use **Print or Save Summary** to export a report.

---

## 🛠️ Development

### Local Setup

Clone the repository:

```bash
git clone https://github.com/yourusername/federal-keyword-tool.git
