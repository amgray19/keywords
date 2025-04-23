let chartInstance = null;
let lastParsedData = [];

document.getElementById("reset").addEventListener("click", () => {
  document.getElementById("upload").value = "";
  document.getElementById("output").innerHTML = "";
  const ctx = document.getElementById("chart").getContext("2d");
  ctx.clearRect(0, 0, 600, 400);
  if (chartInstance) chartInstance.destroy();
  chartInstance = null;
  lastParsedData = [];
});

document.getElementById("generate").addEventListener("click", () => {
  const output = document.getElementById("output");
  output.innerHTML = "";
  lastParsedData = [];

  const keywordList = document.getElementById("keywords").value.split(/\r?\n/).map(k => k.trim()).filter(k => k);
  const files = document.getElementById("upload").files;

  if (!files.length) {
    alert("Please upload at least one .docx file.");
    return;
  }

  Array.from(files).forEach(file => {
    const reader = new FileReader();
    reader.onload = async function(event) {
      const arrayBuffer = event.target.result;

      mammoth.extractRawText({ arrayBuffer: arrayBuffer })
        .then(result => {
          const text = result.value;
          const sentences = text.split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(Boolean);

          const summary = {};
          const results = [];

          sentences.forEach((sentence, idx) => {
            keywordList.forEach(keyword => {
              const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
              const regex = keyword.includes(" ")
                ? new RegExp("(" + escaped + ")", "gi")
                : new RegExp("\\b(" + escaped + ")\\b", "gi");

              if (regex.test(sentence)) {
                summary[keyword] = summary[keyword] || [];
                summary[keyword].push(idx + 1);
                const highlighted = sentence.replace(regex, "<span class='highlight'>$1</span>");
                results.push({ page: idx + 1, raw: sentence, html: highlighted, keyword });
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
            summaryHTML += `<li>${keyword} — ${pages.length} match(es) (Pages ${pageStr})</li>`;
          });
          summaryHTML += "</ul></div>";

          let resultsHTML = "<div class='results'><h3>Matched Sentences</h3>";
          results.forEach(entry => {
            resultsHTML += `<div class="result-sentence">Sentence ${entry.page}: “${entry.html}”</div>`;
          });
          resultsHTML += "</div>";

          section.innerHTML += summaryHTML + resultsHTML;
          output.appendChild(section);

          renderChart("bar");
        });
    };
    reader.readAsArrayBuffer(file);
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

function renderChart(type) {
  if (!lastParsedData.length) return;

  const ctx = document.getElementById("chart").getContext("2d");
  if (chartInstance) chartInstance.destroy();

  const keywordCounts = {};
  lastParsedData.forEach(file => {
    Object.entries(file.summary).forEach(([keyword, pages]) => {
      keywordCounts[keyword] = (keywordCounts[keyword] || 0) + pages.length;
    });
  });

  const keywords = Object.keys(keywordCounts);
  const counts = Object.values(keywordCounts);

  chartInstance = new Chart(ctx, {
    type: (type === "bar" && keywords.length > 6) ? "bar" : type,
    data: {
      labels: keywords,
      datasets: [{
        label: "Keyword Matches",
        data: counts,
        backgroundColor: keywords.map(() => `hsl(${Math.random()*360}, 70%, 70%)`)
      }]
    },
    options: {
      indexAxis: (type === "bar" && keywords.length > 6) ? 'y' : 'x',
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => `${ctx.parsed.y ?? ctx.parsed} matches` } }
      },
      responsive: true
    }
  });
}

document.getElementById("chart-bar").addEventListener("click", () => renderChart("bar"));
document.getElementById("chart-pie").addEventListener("click", () => renderChart("pie"));
