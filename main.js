document.getElementById('docx-file').addEventListener('change', handleFileUpload);
document.getElementById('highlight-btn').addEventListener('click', highlightKeywords);

let keywords = [];

function handleFileUpload(event) {
    const file = event.target.files[0];
    if (file && file.name.endsWith('.docx')) {
        const reader = new FileReader();
        reader.onload = function (e) {
            const arrayBuffer = e.target.result;
            window.docxArrayBuffer = arrayBuffer;
        };
        reader.readAsArrayBuffer(file);
    }
}

function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildKeywordRegex(keyword) {
    // Treat phrases normally, words get \b...\b
    const trimmed = keyword.trim();
    if (/\s/.test(trimmed)) {
        return new RegExp(escapeRegExp(trimmed), 'gi');
    } else {
        return new RegExp(`\\b${escapeRegExp(trimmed)}\\b`, 'gi');
    }
}

async function highlightKeywords() {
    const keywordInput = document.getElementById('keywords').value;
    keywords = keywordInput.split('\n').map(k => k.trim()).filter(k => k);

    if (!window.docxArrayBuffer || keywords.length === 0) {
        alert("Please upload a .docx file and enter at least one keyword.");
        return;
    }

    const zip = new PizZip(window.docxArrayBuffer);
    const doc = new window.docxjs.HtmlDocument(zip);
    const htmlString = await doc.convert();

    const container = document.getElementById('output');
    container.innerHTML = htmlString;

    let matchCount = 0;

    keywords.forEach(keyword => {
        const regex = buildKeywordRegex(keyword);
        highlightMatches(container, regex, keyword, () => matchCount++);
    });

    document.getElementById('match-count').textContent = `Matches found: ${matchCount}`;
}

function highlightMatches(container, regex, keyword, onMatch) {
    const treeWalker = document.createTreeWalker(
        container,
        NodeFilter.SHOW_TEXT,
        {
            acceptNode: function (node) {
                return regex.test(node.nodeValue) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
            }
        }
    );

    let nodes = [];
    while (treeWalker.nextNode()) {
        nodes.push(treeWalker.currentNode);
    }

    nodes.forEach(node => {
        const span = document.createElement('span');
        const replacedHTML = node.nodeValue.replace(regex, match => {
            onMatch();
            return `<mark><strong style="color:red;">${match}</strong></mark>`;
        });
        span.innerHTML = replacedHTML;
        node.parentNode.replaceChild(span, node);
    });
}
