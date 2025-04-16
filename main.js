// v1.1.1-safe — now with keyword suggestions from JSON

let keywordMap = {};
let lastParsedData = [];

document.getElementById("reset").addEventListener("click", () => {
  document.getElementById("upload").value = "";
  document.getElementById("output").innerHTML = "";
  lastParsedData = [];
});

document.getElementById("generate").addEventListener("click", async () => {
  const output = document.getElementById("output");
  output.innerHTML = "";
  lastParsedData = [];

  const response = await fetch('data/keywords_with_suggestions.json');
  const keywordData = await response.json();
  keywordMap = {};
  keywordData.forEach(item => keywordMap[item.term.toLowerCase()] = item.suggestions);

  const keywords = Object.keys(keywordMap);
  const files = document.getElementById("upload").files;

  if (!files.length) {
    alert("Please upload at least one .docx file.");
    return;
  }

  Array.from(files).forEach(file => {
    const reader = new FileReader();
    reader.onload = function(event) {
      const arrayBuffer = event.target.result;

      mammoth.extractRawText({ arrayBuffer: arrayBuffer })
        .then(result => {
          const text = result.value;
          const sentences = text.split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(Boolean);

          const summary = {};
          const results = [];

          sentences.forEach((sentence, idx) => {
            keywords.forEach(keyword => {
              const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
              const regex = keyword.includes(" ")
                ? new RegExp("(" + escaped + ")", "gi")
                : new RegExp("\\b(" + escaped + ")\\b", "gi");

              if (regex.test(sentence)) {
                summary[keyword] = summary[keyword] || [];
                summary[keyword].push(idx + 1);
                const highlighted = sentence.replace(regex, "<span class='highlight'>$1</span>");
                results.push({
                  page: idx + 1,
                  raw: sentence,
                  html: highlighted,
                  keyword: keyword,
                  suggestions: keywordMap[keyword]
                });
              }
            });
          });

          lastParsedData.push({ filename: file.name, summary, results });

          const section = document.createElement("div");
          section.classList.add("file-section");
          section.innerHTML = `<h2>Results for: ${file.name}</h2>`;

          let summaryHTML = "<div class='summary'><h3>Summary</h3><ul>";
          Object.entries(summary).forEach(([keyword, pages]) => {
            const pageStr = [...new Set(pages)].join(", ");
            summaryHTML += `<li>${keyword} — ${pages.length} match(es) (Sentences ${pageStr})</li>`;
          });
          summaryHTML += "</ul></div>";

          let resultsHTML = "<div class='results'><h3>Matched Sentences</h3>";
          results.forEach(entry => {
            resultsHTML += `<div class="result-sentence">Sentence ${entry.page}: “${entry.html}”<br>
              <strong>Suggested alternatives:</strong> ${entry.suggestions.join(", ")}</div>`;
          });
          resultsHTML += "</div>";

          section.innerHTML += summaryHTML + resultsHTML;
          output.appendChild(section);
        });
    };
    reader.readAsArrayBuffer(file);
  });
});

document.getElementById("download-word").addEventListener("click", () => {
  if (!lastParsedData.length) {
    alert("Generate summary first.");
    return;
  }

  const doc = new docx.Document();

  lastParsedData.forEach(file => {
    doc.addSection({
      children: [
        new docx.Paragraph({ text: `=== File: ${file.filename} ===`, heading: docx.HeadingLevel.HEADING_2 }),
        new docx.Paragraph({ text: "Summary:", heading: docx.HeadingLevel.HEADING_3 }),
        ...Object.entries(file.summary).map(([k, p]) =>
          new docx.Paragraph(`- ${k} — ${p.length} match(es) (Sentences ${[...new Set(p)].join(", ")})`)
        ),
        new docx.Paragraph({ text: "Matched Sentences:", heading: docx.HeadingLevel.HEADING_3 }),
        ...file.results.map(entry => {
          const p = new docx.Paragraph({ children: [] });
          p.addRun(new docx.TextRun(`Page ${entry.page}: “`));
          const split = entry.raw.split(new RegExp(`(${entry.keyword})`, "i"));
          split.forEach(part => {
            if (part.toLowerCase() === entry.keyword.toLowerCase()) {
              p.addRun(new docx.TextRun(part).bold().color("FF0000").highlight("yellow"));
            } else {
              p.addRun(new docx.TextRun(part));
            }
          });
          p.addRun(new docx.TextRun("”"));
          p.addRun(new docx.TextRun(` Suggested alternatives: ${entry.suggestions.join(", ")}`).break());
          return p;
        })
      ]
    });
  });

  docx.Packer.toBlob(doc).then(blob => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "Keyword_Summary.docx";
    a.click();
  });
});

document.getElementById("download-pdf").addEventListener("click", () => {
  const element = document.getElementById("output");
  if (!element.innerHTML.trim()) {
    alert("Generate summary first.");
    return;
  }

  html2pdf().set({
    margin: [0.5, 0.5, 0.5, 0.5],
    filename: "Keyword_Summary.pdf",
    html2canvas: { scale: 2 },
    jsPDF: { unit: "in", format: "letter", orientation: "portrait" }
  }).from(element).save();
});
